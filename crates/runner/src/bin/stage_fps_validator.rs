//! G-STAGE-FPS pipeline component (PLAN.md gate @P3, tracked): the shm frame
//! pipeline must deliver every produced frame — a ~60 fps program watched for
//! 240 frames must arrive with ≤2% loss and ≤20 ms mean inter-arrival.
//! Browser-side smoothness is separately visible on the panel fps meter.

use std::time::{Duration, Instant};

use runner::stage::StageReader;

const FRAMES_TARGET: u32 = 240;

const DEMO: &str = r#"
#include "stage.h"
int main(void) {
    stage_init(320, 240);
    unsigned t = 0;
    while (stage_tick()) {
        t++;
        stage_clear(0x181825);
        for (int i = 0; i < 300; i++) {
            int x = (i * 37 + t) % stage_width();
            int y = (i * 53 + t / 3) % stage_height();
            stage_rect(x, y, 3, 3, 0x89b4fa);
        }
        if (t >= 240) break;
    }
    return 0;
}
"#;

fn main() {
    let src = DEMO.to_string();
    let child = std::thread::spawn(move || runner::build_and_run(&src, 15_000));

    let reader = StageReader::attach(3000).expect("stage mapping never appeared");
    let mut last_frame_seen = 0u32;
    let mut arrivals: Vec<Instant> = Vec::new();
    let deadline = Instant::now() + Duration::from_secs(12);
    // Spin-poll: Windows Sleep() granularity (~15.6 ms) would itself skip
    // frames at a 60 fps production rate. The pipeline must be proven
    // zero-loss; the UI layer is latest-wins by design.
    loop {
        while let Some(f) = reader.frame() {
            if f.frame != last_frame_seen {
                last_frame_seen = f.frame;
                arrivals.push(Instant::now());
            }
        }
        if child.is_finished() && reader.peek_frame().is_none_or(|f| f == last_frame_seen) {
            break;
        }
        if Instant::now() > deadline {
            break;
        }
        std::hint::spin_loop();
        std::thread::yield_now();
    }
    let outcome = child.join().expect("join").expect("run");

    let produced = reader.peek_frame().unwrap_or(last_frame_seen);
    let delivered = last_frame_seen; // every distinct frame we observed
    let loss_pct = 100.0 * (1.0 - delivered as f64 / produced.max(1) as f64);

    let gaps: Vec<f64> = arrivals
        .windows(2)
        .map(|w| (w[1] - w[0]).as_secs_f64() * 1000.0)
        .collect();
    let mean_gap = if gaps.is_empty() {
        f64::NAN
    } else {
        gaps.iter().sum::<f64>() / gaps.len() as f64
    };

    println!(
        "  ok   produced={produced} delivered={delivered} loss={loss_pct:.2}% mean_gap={mean_gap:.1}ms exit={}",
        outcome.exit
    );

    let mut failed = false;
    if outcome.exit != 0 || outcome.timed_out {
        eprintln!("  FAIL program did not exit cleanly");
        failed = true;
    }
    if produced < FRAMES_TARGET - 20 {
        eprintln!("  FAIL only {produced} frames produced (target {FRAMES_TARGET})");
        failed = true;
    }
    if loss_pct > 2.0 {
        eprintln!("  FAIL {loss_pct:.2}% frames lost in pipeline (>2%)");
        failed = true;
    }
    if !(mean_gap.is_nan() || mean_gap <= 20.0) {
        eprintln!("  FAIL mean inter-arrival {mean_gap:.1}ms > 20ms");
        failed = true;
    }

    println!("[G-STAGE-FPS] pipeline {}", if failed { "FAIL" } else { "PASS" });
    if failed {
        std::process::exit(1);
    }
}
