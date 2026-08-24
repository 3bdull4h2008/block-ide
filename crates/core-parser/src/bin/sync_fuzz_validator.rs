//! G-SYNC-FUZZ (PLAN.md gate @P0.5): 10,000-operation randomized edit
//! differential. Two drivers apply the SAME seeded op sequence to the same
//! starting program:
//!   driver A (text)  — splices ops into raw source, canonicalizes at end
//!   driver B (block) — canonicalizes after every op
//! Invariants:
//!   1. every intermediate source parses WITHOUT error nodes
//!   2. canonicalization is idempotent (spot-checked every 40 ops)
//!   3. both drivers converge to byte-identical canonical output
//! Ops are computed FROM THE CURRENT TREE (statement ranges), so both
//! drivers target structurally identical nodes even though their offsets
//! differ. Deterministic: seed via BLOCKIDE_FUZZ_SEED, default fixed.

use core_parser::{canonical_source, ctree_has_errors, parse_canonical, CNode};
use std::time::Instant;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn below(&mut self, n: usize) -> usize {
        if n == 0 { 0 } else { (self.next() % n as u64) as usize }
    }
}

const STATEMENT_KINDS: &[&str] = &[
    "expression_statement",
    "declaration",
    "return_statement",
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "break_statement",
    "continue_statement",
];

fn collect_statements<'a>(node: &'a CNode, parent_kind: &str, out: &mut Vec<&'a CNode>) {
    for c in &node.children {
        if STATEMENT_KINDS.contains(&c.kind.as_str()) && parent_kind == "compound_statement" {
            out.push(c);
        }
        collect_statements(c, &c.kind, out);
    }
}

fn collect_identifiers<'a>(node: &'a CNode, out: &mut Vec<&'a CNode>) {
    for c in &node.children {
        if c.kind == "identifier" {
            out.push(c);
        }
        collect_identifiers(c, out);
    }
}

/// Cuts must use the EXACT node span, not whole lines: raw-text lines can
/// hold several statements while canonical lines hold one, so a shared op
/// index would delete different amounts on each side and desync the drivers.
/// A statement never owns its parent's braces, so exact cuts cannot orphan
/// them either.
enum Op {
    Insert,
    Delete,
    Move,
    Edit,
}

fn insert_tu(src: &str, rng: &mut Rng, counter: &mut usize) -> Result<String, String> {
    // Appends at EOF: anchor selection would draw from root-child counts,
    // which legitimately differ between drivers (specifier + `;` parse as
    // separate root nodes in raw text but can merge after canonicalization)
    // and desynchronize the shared RNG sequence.
    let s = format!(
        "static int helper{counter}(int a) {{ return a + {}; }}\n",
        rng.below(100)
    );
    *counter += 1;
    let mut out = String::with_capacity(src.len() + s.len() + 1);
    out.push_str(src);
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out.push_str(&s);
    Ok(out)
}

fn apply_op(src: &str, op: &Op, rng: &mut Rng, counter: &mut usize) -> Result<String, String> {
    let tree = parse_canonical(src).ok_or("parse returned None")?;
    if ctree_has_errors(&tree) {
        return Err("intermediate source has error nodes".into());
    }
    let mut stmts = Vec::new();
    collect_statements(&tree.root, "", &mut stmts);
    if stmts.is_empty() {
        // all bodies empty (random deletes): Delete/Move/Edit no-op; the
        // TU-level function snippet in Insert repopulates statements later.
        return match op {
            Op::Insert => insert_tu(src, rng, counter),
            _ => Ok(src.to_string()),
        };
    }

    match op {
        Op::Insert => {
            if rng.below(4) == 0 {
                return insert_tu(src, rng, counter);
            }
            let s_node = stmts.get(rng.below(stmts.len())).ok_or("no statements")?;
            let k = rng.below(100);
            let n = *counter;
            *counter += 1;
            let snippet = match rng.below(5) {
                0 => format!("int v{n} = {k};\n"),
                1 => format!("total = total + {k};\n"),
                2 => format!("printf(\"s{n}\\n\");\n"),
                3 => format!("{{ int z{n} = {k}; }}\n"),
                _ => format!(
                    "for (int i{n} = 0; i{n} < {k}; i{n}++) {{ total = total + i{n}; }}\n"
                ),
            };
            let before = rng.below(2) == 0;
            // Exact node offset, NOT line start: in raw text a statement can
            // share its line with `int main(void) {`, and a line-start anchor
            // would insert at TU scope on driver A but inside the body on
            // driver B — instant structural desync.
            let p = if before { s_node.start } else { s_node.end };
            let mut out = String::with_capacity(src.len() + snippet.len() + 1);
            out.push_str(&src[..p]);
            if !out.ends_with('\n') && !out.is_empty() {
                out.push('\n');
            }
            out.push_str(&snippet);
            if !snippet.ends_with('\n') && !src[p..].starts_with('\n') {
                out.push('\n');
            }
            out.push_str(&src[p..]);
            Ok(out)
        }
        Op::Delete => {
            let s_node = stmts.get(rng.below(stmts.len())).ok_or("no statements")?;
            let (start, end) = (s_node.start, s_node.end);
            let mut out = String::with_capacity(src.len());
            out.push_str(&src[..start]);
            out.push_str(&src[end..]);
            Ok(out)
        }
        Op::Move => {
            let s_node = stmts.get(rng.below(stmts.len())).ok_or("no statements")?;
            let (start, end) = (s_node.start, s_node.end);
            let cut = src[start..end].to_string();
            let mut cut_src = String::with_capacity(src.len());
            cut_src.push_str(&src[..start]);
            cut_src.push_str(&src[end..]);

            // reparse the cut source to get valid target offsets
            let tree2 = parse_canonical(&cut_src).ok_or("post-cut parse None")?;
            let mut targets = Vec::new();
            collect_statements(&tree2.root, "", &mut targets);
            if targets.is_empty() {
                return Ok(cut_src); // nothing to move into: deletion stands
            }
            let t = targets.get(rng.below(targets.len())).unwrap();
            // exact offset — same rationale as Insert above
            let pos = t.start;
            let mut out = String::with_capacity(cut_src.len() + cut.len());
            out.push_str(&cut_src[..pos]);
            out.push_str(&cut);
            if !cut.ends_with('\n') {
                out.push('\n');
            }
            out.push_str(&cut_src[pos..]);
            Ok(out)
        }
        Op::Edit => {
            let mut ids = Vec::new();
            collect_identifiers(&tree.root, &mut ids);
            if ids.is_empty() {
                return Ok(src.to_string());
            }
            let id_node = ids.get(rng.below(ids.len())).unwrap();
            let n = *counter;
            *counter += 1;
            let mut out = String::with_capacity(src.len() + 8);
            out.push_str(&src[..id_node.start]);
            out.push_str(&format!("w{n}"));
            out.push_str(&src[id_node.end..]);
            Ok(out)
        }
    }
}

fn run_driver(
    label: &str,
    seed: u64,
    start: &str,
    ops: usize,
    canonical_each: bool,
) -> Result<(String, Vec<usize>), String> {
    let mut rng = Rng(seed);
    let mut src = start.to_string();
    let mut counter = 0usize;
    let mut trace: Vec<usize> = Vec::new();
    let max_ops: usize = std::env::var("BLOCKIDE_FUZZ_MAX_OPS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(ops);
    for i in 0..max_ops.min(ops) {
        let prev = src.clone();
        let op = match rng.below(4) {
            0 => Op::Insert,
            1 => Op::Delete,
            2 => Op::Move,
            _ => Op::Edit,
        };
        src = apply_op(&src, &op, &mut rng, &mut counter).map_err(|e| {
            let tag = format!("{}-op{}", label.replace(['(', ')', '/'], ""), i);
            let _ = std::fs::write(std::env::temp_dir().join(format!("syncfuzz-{tag}-prev.c")), &prev);
            let _ = std::fs::write(std::env::temp_dir().join(format!("syncfuzz-{tag}-bad.c")), &src);
            format!("{label} op#{i}: {e} — dumped prev/bad to %TEMP% ({tag})")
        })?;
        // shape signature: statement count of the current tree
        let tree = parse_canonical(&src).ok_or(format!("{label} op#{i}: post-op parse None"))?;
        if ctree_has_errors(&tree) {
            let tag = format!("{}-op{}", label.replace(['(', ')', '/'], ""), i);
            let _ = std::fs::write(std::env::temp_dir().join(format!("syncfuzz-{tag}-prev.c")), &prev);
            let _ = std::fs::write(std::env::temp_dir().join(format!("syncfuzz-{tag}-bad.c")), &src);
            return Err(format!(
                "{label} op#{i}: intermediate source has error nodes — dumped prev/bad ({tag})"
            ));
        }
        let mut stmts = Vec::new();
        collect_statements(&tree.root, "", &mut stmts);
        trace.push(stmts.len());
        if canonical_each {
            src = canonical_source(&src).map_err(|e| format!("{label} op#{i} canonicalize: {e}"))?;
            let tree2 = parse_canonical(&src).ok_or(format!("{label} op#{i}: post-canon parse None"))?;
            let mut s2 = Vec::new();
            collect_statements(&tree2.root, "", &mut s2);
            if s2.len() != stmts.len() {
                let tag = format!("{}-op{}", label.replace(['(', ')', '/'], ""), i);
                let _ = std::fs::write(std::env::temp_dir().join(format!("syncfuzz-{tag}-precanon.c")), &src);
                return Err(format!(
                    "{label} op#{i}: CANONICALIZE CHANGED SHAPE: stmts {} -> {} — dumped pre-canon ({tag})",
                    stmts.len(),
                    s2.len()
                ));
            }
        }
        if i % 40 == 39 && !canonical_each {
            // idempotency spot-check on the raw driver
            let c1 = canonical_source(&src).map_err(|e| format!("{label} op#{i} canon: {e}"))?;
            let c2 = canonical_source(&c1).map_err(|e| format!("{label} op#{i} canon2: {e}"))?;
            if c1 != c2 {
                return Err(format!("{label} op#{i}: canonicalization NOT idempotent"));
            }
        }
    }
    if !canonical_each {
        src = canonical_source(&src).map_err(|e| format!("{label} final canon: {e}"))?;
    }
    Ok((src, trace))
}

fn main() {
    let t0 = Instant::now();
    let seed: u64 = std::env::var("BLOCKIDE_FUZZ_SEED")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0x5EED_0000_0000_0001);
    println!("[G-SYNC-FUZZ] seed = {seed:#018x}");

    let manifest = env!("CARGO_MANIFEST_DIR");
    let good = std::path::Path::new(manifest).join("..").join("..").join("corpus").join("good");
    let mut programs: Vec<(String, String)> = Vec::new();
    let mut entries: Vec<_> = std::fs::read_dir(&good)
        .expect("corpus/good readable")
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "c"))
        .collect();
    entries.sort();
    for f in entries {
        let raw = std::fs::read_to_string(&f).expect("read");
        let base = canonical_source(&raw).expect("baseline canonicalize");
        programs.push((f.file_name().unwrap().to_string_lossy().into_owned(), base));
    }
    if programs.is_empty() {
        eprintln!("[G-SYNC-FUZZ] FAIL: no corpus programs");
        std::process::exit(1);
    }

    const OPS_PER_PROGRAM: usize = 500;
    let total = programs.len() * OPS_PER_PROGRAM * 2; // two drivers

    let mut failures = 0usize;
    for (name, base) in &programs {
        let a = run_driver("A(text)", seed ^ 0xA1, base, OPS_PER_PROGRAM, false);
        let b = run_driver("B(block)", seed ^ 0xA1, base, OPS_PER_PROGRAM, true);
        match (a, b) {
            (Ok((fa, ta)), Ok((fb, tb))) => {
                if fa != fb {
                    eprintln!("  FAIL {name}: drivers diverged");
                    if let Some(i) = ta.iter().zip(tb.iter()).position(|(x, y)| x != y) {
                        eprintln!(
                            "    first shape divergence at op#{}: A stmts={} B stmts={}",
                            i, ta[i], tb[i]
                        );
                    } else {
                        eprintln!(
                            "    shape traces equal (len {}), final bytes differ",
                            ta.len()
                        );
                    }
                    failures += 1;
                } else {
                    println!(
                        "  ok   {name:<18} {OPS_PER_PROGRAM} ops x2 drivers converged ({} bytes)",
                        fa.len()
                    );
                }
            }
            (Err(e), _) | (_, Err(e)) => {
                eprintln!("  FAIL {name}: {e}");
                eprintln!("    seed={seed:#018x} reproduce with BLOCKIDE_FUZZ_SEED");
                failures += 1;
            }
        }
    }

    let secs = t0.elapsed().as_secs_f64();
    println!(
        "[G-SYNC-FUZZ] {total} ops across {} programs in {secs:.1}s — {}",
        programs.len(),
        if failures == 0 { "PASS" } else { "FAIL" }
    );
    if failures > 0 {
        std::process::exit(1);
    }
}
