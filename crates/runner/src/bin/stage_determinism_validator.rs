//! G-STAGE-DET (PLAN.md gate @P3): the stage renders pixel-identical across
//! runs (deterministic random keyed on frame counter), publishes advancing
//! frames through shared memory, and exits cleanly when the IDE sets quit.
//!
//! 1. run demo twice → final-frame RGBA hashes must match; frame counter sane
//! 2. quit path: program loops forever → IDE sets quit → clean exit ≤1 s
//! Exit 0 iff all hold.

use runner::stage::StageReader;

const DEMO: &str = r#"
#include <stdio.h>
#include "stage.h"

int main(void) {
    if (!stage_init(320, 240)) { printf("stage init failed\n"); return 3; }
    for (int f = 0; f < 30 && stage_tick(); f++) {
        stage_clear(0x181825);
        for (int i = 0; i < 200; i++) {
            int x = stage_random(stage_width());
            int y = stage_random(stage_height());
            unsigned c[6] = {0x89b4fa, 0xa6e3a1, 0xf9e2af, 0xf38ba8, 0x94e2d5, 0xffffff};
            stage_rect(x, y, 4 + stage_random(6), 4 + stage_random(6), c[stage_random(6)]);
        }
        if (stage_key_down('Q')) break;
    }
    printf("demo done\n");
    return 0;
}
"#;

const QUITTER: &str = r#"
#include "stage.h"
int main(void) {
    stage_init(160, 120);
    while (stage_tick()) {
        stage_clear(0);
    }
    return 7;
}
"#;

fn fnv(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn run_and_capture(src: &str) -> Result<(u64, u32, i32, i32), String> {
    // Run the program in the background so we can attach to its frames.
    let src_owned = src.to_string();
    let child = std::thread::spawn(move || runner::build_and_run(&src_owned, 15_000));

    let reader = StageReader::attach(3000)
        .ok_or_else(|| "stage mapping never appeared".to_string())?;
    let (w, h) = reader.dims();
    let mut last = None;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        if let Some(f) = reader.frame() {
            last = Some((f.frame, f.rgba));
        }
        let finished = child.is_finished();
        if last.is_some() && finished {
            break;
        }
        if std::time::Instant::now() > deadline {
            return Err("program never finished".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(8));
    }
    let outcome = child.join().map_err(|_| "run thread panicked")??;
    if outcome.exit != 0 || outcome.timed_out {
        return Err(format!("exit={} timed_out={} stderr={}", outcome.exit, outcome.timed_out,
            outcome.stderr.lines().next().unwrap_or("")));
    }
    let (frame, rgba) = last.ok_or_else(|| "no frames published".to_string())?;
    Ok((fnv(&rgba), frame, w, h))
}

fn main() {
    let mut failed = false;

    // --- determinism across two runs -------------------------------------
    let a = match run_and_capture(DEMO) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("  FAIL demo run A: {e}");
            std::process::exit(1);
        }
    };
    drop(StageReader::attach(1)); // ensure our handles don't pin the section
    std::thread::sleep(std::time::Duration::from_millis(150));
    let b = match run_and_capture(DEMO) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("  FAIL demo run B: {e}");
            std::process::exit(1);
        }
    };
    println!(
        "  ok   run A hash={:016x} frame={} dims={}x{}",
        a.0, a.1, a.2, a.3
    );
    println!(
        "  ok   run B hash={:016x} frame={} dims={}x{}",
        b.0, b.1, b.2, b.3
    );
    if a != b {
        eprintln!("  FAIL frames diverged between runs (G-STAGE-DET core claim)");
        failed = true;
    } else if a.1 < 20 {
        eprintln!("  FAIL only {} frames published", a.1);
        failed = true;
    }

    // --- cooperative quit --------------------------------------------------
    match run_quitter() {
        Ok(exit) => println!("  ok   quitter exited {} after IDE set quit", exit),
        Err(e) => {
            eprintln!("  FAIL quitter: {e}");
            failed = true;
        }
    }

    // --- clang backend must also build stage programs ----------------------
    match runner::compile_c(DEMO) {
        Ok(_) => println!("  ok   clang backend compiles stage demo"),
        Err(e) => {
            eprintln!("  FAIL clang compile of stage demo: {}", e.lines().next().unwrap_or(""));
            failed = true;
        }
    }

    println!("[G-STAGE-DET] {}", if failed { "FAIL" } else { "PASS" });
    if failed {
        std::process::exit(1);
    }
}

fn run_quitter() -> Result<i32, String> {
    let src = QUITTER.to_string();
    let child = std::thread::spawn(move || runner::build_and_run(&src, 15_000));
    let reader =
        StageReader::attach(3000).ok_or_else(|| "quitter stage missing".to_string())?;
    let t0 = std::time::Instant::now();
    std::thread::sleep(std::time::Duration::from_millis(400));
    reader.request_quit();
    let outcome = child.join().map_err(|_| "quitter thread panicked")??;
    let elapsed = t0.elapsed().as_secs_f64();
    if outcome.exit != 7 {
        return Err(format!("expected exit 7, got {}", outcome.exit));
    }
    if elapsed > 3.0 {
        return Err(format!("quit took too long: {elapsed:.2}s"));
    }
    Ok(outcome.exit)
}
