//! G-DIAG-MAP (PLAN.md gate @P2): 100% of test-suite diagnostics carry valid
//! ranges and land on a real canonical node id. Fixtures: corpus/diag/*.c,
//! one file per diagnostic class.
//!
//! Exit 0 = every fixture produced ≥1 error/warning diagnostic and every one
//! of them mapped to an existing node (never a fabricated id), with ≥1 deep
//! (non-root) mapping per fixture.

use core_parser::{
    map_diags, parse_canonical, parse_clang_diags, toolchain::syntax_check_stderr,
};

fn collect_ids(node: &core_parser::CNode, ids: &mut std::collections::HashSet<u32>) {
    ids.insert(node.id);
    for c in &node.children {
        collect_ids(c, ids);
    }
}

fn check_fixture(path: &std::path::Path) -> Result<usize, String> {
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let src = std::fs::read_to_string(path)
        .map_err(|e| format!("{name}: unreadable: {e}"))?;

    let stderr = syntax_check_stderr(&src)?;
    let raws: Vec<_> = parse_clang_diags(&stderr, "main.c")
        .into_iter()
        .filter(|d| d.severity != "note")
        .collect();
    if raws.is_empty() {
        return Err(format!(
            "{name}: fixture produced no error/warning diagnostics \
             (clang stderr was {stderr:?})"
        ));
    }

    let tree = parse_canonical(&src).ok_or_else(|| format!("{name}: grammar load failed"))?;
    let mut ids = std::collections::HashSet::new();
    collect_ids(&tree.root, &mut ids);

    let mapped = map_diags(&src, &tree, &raws);
    if mapped.len() != raws.len() {
        return Err(format!(
            "{name}: {} of {} diags failed line:col→offset resolution",
            raws.len() - mapped.len(),
            raws.len()
        ));
    }

    let root_id = tree.root.id;
    let mut deep = 0usize;
    for m in &mapped {
        if m.offset > src.len() {
            return Err(format!(
                "{name}: diag L{}C{} offset {} beyond src len {}",
                m.line,
                m.col,
                m.offset,
                src.len()
            ));
        }
        if !ids.contains(&m.node_id) {
            return Err(format!(
                "{name}: diag L{}C{} mapped to nonexistent node id {}",
                m.line, m.col, m.node_id
            ));
        }
        if m.node_id != root_id {
            deep += 1;
        }
    }
    if deep == 0 {
        return Err(format!(
            "{name}: all {} diags fell back to translation_unit root",
            mapped.len()
        ));
    }
    Ok(mapped.len())
}

fn main() {
    let manifest = env!("CARGO_MANIFEST_DIR");
    let dir = std::path::Path::new(manifest)
        .join("..")
        .join("..")
        .join("corpus")
        .join("diag");

    let mut fixtures: Vec<std::path::PathBuf> = match std::fs::read_dir(&dir) {
        Ok(rd) => rd
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "c"))
            .collect(),
        Err(e) => {
            eprintln!("[G-DIAG-MAP] FAIL: cannot read {}: {e}", dir.display());
            std::process::exit(1);
        }
    };
    fixtures.sort();

    if fixtures.is_empty() {
        eprintln!("[G-DIAG-MAP] FAIL: no fixtures in {}", dir.display());
        std::process::exit(1);
    }

    let mut total = 0usize;
    let mut failures = 0usize;
    for f in &fixtures {
        match check_fixture(f) {
            Ok(n) => {
                total += n;
                println!(
                    "  ok   {:<28} {} diags mapped",
                    f.file_name().unwrap().to_string_lossy(),
                    n
                );
            }
            Err(e) => {
                failures += 1;
                eprintln!("  FAIL {e}");
            }
        }
    }

    println!(
        "[G-DIAG-MAP] {} fixtures, {total} diagnostics mapped, {failures} fixture failures",
        fixtures.len()
    );
    if failures > 0 {
        std::process::exit(1);
    }
}
