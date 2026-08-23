//! G-ACADEMY (PLAN.md gate @P4): every committed level must (a) pass the
//! TOML schema + content lints (≥2 distinct stdin inputs, exactly 3 hints,
//! solution file present, unique ids), and (b) its reference solution must
//! solve every hidden test headlessly — compile via the D4 backend, feed
//! stdin, compare stdout after CRLF normalization plus exit code.
//!
//! Also enforces anti-cheat: mutating a test's stdin into a wrong answer
//! (hardcoded output) must FAIL at least one test per level.

use runner::academy::Level;

fn norm(s: &str) -> String {
    s.replace("\r\n", "\n")
}

fn main() {
    let manifest = env!("CARGO_MANIFEST_DIR");
    let worlds = std::path::Path::new(manifest)
        .join("..")
        .join("..")
        .join("academy")
        .join("worlds");

    let mut files: Vec<std::path::PathBuf> = match std::fs::read_dir(&worlds) {
        Ok(rd) => rd
            .flatten()
            .map(|e| e.path().join("level.toml"))
            .filter(|p| p.is_file())
            .collect(),
        Err(e) => {
            eprintln!("[G-ACADEMY] FAIL: cannot read {}: {e}", worlds.display());
            std::process::exit(1);
        }
    };
    files.sort();

    if files.is_empty() {
        eprintln!("[G-ACADEMY] FAIL: no levels found under {}", worlds.display());
        std::process::exit(1);
    }

    let mut ids = std::collections::HashSet::new();
    let mut failed = 0usize;
    let mut total_tests = 0usize;

    for f in &files {
        let name = f.parent().unwrap().file_name().unwrap().to_string_lossy().into_owned();
        let lv = match Level::load(f) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("  FAIL {name}: schema/lint: {e}");
                failed += 1;
                continue;
            }
        };
        if !ids.insert(lv.id.clone()) {
            eprintln!("  FAIL {}: duplicate id '{}'", name, lv.id);
            failed += 1;
            continue;
        }
        let dir = f.parent().unwrap();
        let sol_src = match lv.solution_src(dir) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("  FAIL {name}: {e}");
                failed += 1;
                continue;
            }
        };
        let prepared = match runner::prepare(&sol_src, false) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("  FAIL {name}: reference solution does not compile: {}",
                    e.lines().next().unwrap_or(""));
                failed += 1;
                continue;
            }
        };

        // anti-hardcode control: wrong program must fail this level's tests
        let decoy_src =
            format!("/* decoy */\n#include <stdio.h>\nint main(void){{ printf(\"hardcoded\\n\"); return 0; }}\n");
        let decoy_failures = match runner::prepare(&decoy_src, false) {
            Ok(dp) => lv
                .tests
                .iter()
                .filter(|t| {
                    match runner::run_prepared(&dp, 10_000, &t.stdin) {
                        Ok(o) => norm(&o.stdout) == norm(&t.stdout) && o.exit == t.exit,
                        Err(_) => false,
                    }
                })
                .count(),
            Err(_) => 0,
        };
        if decoy_failures == lv.tests.len() {
            // decoy passed EVERYTHING → tests don't discriminate; reject
            eprintln!("  FAIL {name}: hardcoded decoy passes all tests (weak tests)");
            failed += 1;
            continue;
        }

        let mut ok = true;
        for (i, t) in lv.tests.iter().enumerate() {
            total_tests += 1;
            match runner::run_prepared(&prepared, 10_000, &t.stdin) {
                Ok(o) => {
                    let out_ok = norm(&o.stdout) == norm(&t.stdout);
                    let exit_ok = o.exit == t.exit;
                    if !out_ok || !exit_ok || o.timed_out {
                        eprintln!(
                            "  FAIL {name} test[{i}]: stdout={} exit={} timed_out={} (want {:?} / {})",
                            o.stdout.replace('\r', "\\r").replace('\n', "\\n"),
                            o.exit,
                            o.timed_out,
                            t.stdout.replace('\n', "\\n"),
                            t.exit
                        );
                        ok = false;
                    }
                }
                Err(e) => {
                    eprintln!("  FAIL {name} test[{i}]: run error: {}", e.lines().next().unwrap_or(""));
                    ok = false;
                }
            }
        }
        if ok {
            println!(
                "  ok   {:<18} world {} xp {:>3} · {} tests solved",
                lv.id,
                lv.world,
                lv.xp,
                lv.tests.len()
            );
        } else {
            failed += 1;
        }
    }

    println!(
        "[G-ACADEMY] {} levels, {total_tests} hidden tests, {failed} failures",
        files.len()
    );
    if failed > 0 {
        std::process::exit(1);
    }
}
