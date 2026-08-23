//! G-RUN-HELLO (PLAN.md gate @P2): run→output latency budget of 150 ms.
//!
//! Measures three user-visible paths through the runner seam:
//!   env_capture       — one-time vcvars environment capture (app startup cost)
//!   edit_compile_run  — user edited code since last Run (full recompile)
//!   spam_run          — Run pressed again with unchanged source (hash hit)
//!
//! ENFORCED: spam_run median ≤ 150 ms (the interactive feel of the button).
//! TRACKED: edit_compile_run median reported alongside for decision D4.
//! Exit 0 iff enforced bound holds and every run produced correct output.

use std::time::Instant;

use runner::build_and_run;

const HELLO: &str = "#include <stdio.h>\nint main(void) {\n    printf(\"hello\\n\");\n    return 0;\n}\n";
const ITERS: usize = 9;

fn sample_ms<F: FnMut() -> Result<(), String>>(mut f: F) -> Vec<f64> {
    let mut out = Vec::new();
    for _ in 0..ITERS {
        let t = Instant::now();
        f().expect("run failed");
        out.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    out.sort_by(|a, b| a.partial_cmp(b).unwrap());
    out
}

/// Force the clang backend (bypasses D4 selection) for comparison rows.
fn clang_run(src: &str, timeout_ms: u64) -> Result<runner::RunOutcome, String> {
    runner::run_exe(&runner::compile_c(src)?, timeout_ms)
}

fn stats(v: &[f64]) -> (f64, f64, f64) {
    (
        v[0],
        v[v.len() / 2],
        v[v.len() - 1],
    )
}

fn main() {
    println!("G-RUN-HELLO bench: {ITERS} iterations per phase\n");

    // Phase 0 — one-time env capture cost
    let t = Instant::now();
    let env_ok = core_parser::toolchain::vcvars_env().is_ok();
    let env_ms = t.elapsed().as_secs_f64() * 1000.0;
    println!(
        "  {:<18} min/med/max (ms)   — capture={}ms ok={}",
        "env_capture", env_ms as u64, env_ok
    );
    // Phase 1 — clang backend, true cold compile every iteration (artifacts wiped).
    let dir = std::env::temp_dir().join("blockide-run");
    let first = sample_ms(|| {
        let _ = std::fs::remove_file(dir.join("prog.exe"));
        let _ = std::fs::remove_file(dir.join("prog.hash"));
        let o = clang_run(HELLO, 10_000)?;
        if o.exit != 0 || !o.stdout.contains("hello") {
            return Err(format!("bad outcome exit={} stdout={:?}", o.exit, o.stdout));
        }
        Ok(())
    });

    // Phase 2 — clang backend, user edited the program before every Run.
    let mut variant = 0usize;
    let edited = sample_ms(|| {
        variant += 1;
        let src = format!("/* v{variant} */\n{HELLO}");
        let o = clang_run(&src, 10_000)?;
        if o.exit != 0 || !o.stdout.contains("hello") {
            return Err(format!("bad outcome exit={} stdout={:?}", o.exit, o.stdout));
        }
        Ok(())
    });

    // Phase 3 — clang backend, Run pressed repeatedly without edits (hash skip).
    let spam = sample_ms(|| {
        let o = clang_run(HELLO, 10_000)?;
        if o.exit != 0 || !o.stdout.contains("hello") {
            return Err(format!("bad outcome exit={} stdout={:?}", o.exit, o.stdout));
        }
        Ok(())
    });

    // Phase 4 — production entry point with D4-selected backend (tcc when
    // vendored). This is the number the gate enforces.
    let production = sample_ms(|| {
        let o = build_and_run(HELLO, 10_000)?;
        if o.exit != 0 || !o.stdout.contains("hello") {
            return Err(format!("bad outcome exit={} stdout={:?}", o.exit, o.stdout));
        }
        Ok(())
    });

    let _ = core_parser::toolchain::vcvars_env();

    for (name, v) in [
        ("clang_cold_compile", &first),
        ("clang_edit_compile", &edited),
        ("clang_spam_run", &spam),
        ("PRODUCTION_run", &production),
    ] {
        let (min, med, max) = stats(v);
        println!("  {name:<18} {min:>7.1} / {med:>7.1} / {max:>7.1}");
    }

    let (_, prod_med, _) = stats(&production);
    let (_, edit_med, _) = stats(&edited);
    let pass = prod_med <= 150.0;
    println!(
        "\n[G-RUN-HELLO] enforced production_median={prod_med:.1}ms (≤150) — {} | tracked clang edit_median={edit_med:.1}ms",
        if pass { "PASS" } else { "FAIL" }
    );

    // leave the workspace in a defined state: keep last successful build cached
    if !pass {
        std::process::exit(1);
    }
}
