use std::path::{Path, PathBuf};

fn collect_c_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            collect_c_files(&p, out);
        } else if p.extension().map(|x| x == "c").unwrap_or(false) {
            out.push(p);
        }
    }
}

fn first_divergence(a: &str, b: &str) -> Option<usize> {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    let n = ab.len().min(bb.len());
    for i in 0..n {
        if ab[i] != bb[i] {
            return Some(i);
        }
    }
    if ab.len() != bb.len() {
        return Some(n);
    }
    None
}

fn ctx(s: &str, at: usize) -> String {
    let start = at.saturating_sub(40);
    let end = (at + 40).min(s.len());
    format!("{:?}…{:?}", &s[start..at], &s[at..end])
}

fn main() {
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..");
    let corpus = repo.join("corpus");
    let args: Vec<String> = std::env::args().collect();
    let root = args.get(1).map(PathBuf::from).unwrap_or(corpus);

    let mut good = Vec::new();
    let mut malformed = Vec::new();
    collect_c_files(&root.join("good"), &mut good);
    collect_c_files(&root.join("malformed"), &mut malformed);
    good.sort();
    malformed.sort();

    let mut pass = 0usize;
    let mut fail = 0usize;

    for f in &good {
        let src = match std::fs::read_to_string(f) {
            Ok(s) => s,
            Err(e) => {
                println!("[FAIL] {:?}: read error {e}", f.display());
                fail += 1;
                continue;
            }
        };
        let ct = match core_parser::parse_canonical(&src) {
            Some(ct) => ct,
            None => {
                println!("[FAIL] {:?}: grammar failed", f.display());
                fail += 1;
                continue;
            }
        };
        let verbatim = ct.emit_verbatim();
        if verbatim != src {
            match first_divergence(&verbatim, &src) {
                Some(at) => println!(
                    "[FAIL] {:?}: verbatim loss at byte {at}\n  got {:?}\n  want {:?}",
                    f.display(),
                    ctx(&verbatim, at),
                    ctx(&src, at)
                ),
                None => unreachable!(),
            }
            fail += 1;
            continue;
        }
        let once = match core_parser::canonical_source(&src) {
            Ok(s) => s,
            Err(e) => {
                println!("[FAIL] {:?}: canonicalize error: {e}", f.display());
                fail += 1;
                continue;
            }
        };
        let twice = match core_parser::canonical_source(&once) {
            Ok(s) => s,
            Err(e) => {
                println!("[FAIL] {:?}: canonicalize#2 error: {e}", f.display());
                fail += 1;
                continue;
            }
        };
        if once != twice {
            let note = first_divergence(&once, &twice)
                .map(|at| format!(
                    "first divergence @byte {at}: got {:?} want {:?}",
                    ctx(&twice, at),
                    ctx(&once, at)
                ))
                .unwrap_or_default();
            println!("[FAIL] {:?}: NOT idempotent\n  {note}", f.display());
            fail += 1;
            continue;
        }
        pass += 1;
    }

    for f in &malformed {
        let src = std::fs::read_to_string(f).expect("malformed file readable");
        let parsed = std::panic::catch_unwind(|| core_parser::parse_canonical(&src));
        match parsed {
            Err(_) => {
                println!("[FAIL] {:?}: PANICKED on malformed input", f.display());
                fail += 1;
            }
            Ok(None) => {
                println!("[FAIL] {:?}: grammar failed to load", f.display());
                fail += 1;
            }
            Ok(Some(ct)) => {
                if !core_parser::ctree_has_errors(&ct) {
                    println!(
                        "[FAIL] {:?}: expected error nodes on malformed input",
                        f.display()
                    );
                    fail += 1;
                    continue;
                }
                let _ = core_parser::canonical_source(&src);
                pass += 1;
            }
        }
    }

    println!("roundtrip_validator: {pass} passed, {fail} failed");
    if fail > 0 {
        std::process::exit(1);
    }
}
