//! G-SANDBOX-ESCAPE (PLAN.md gate @P2): throw jailbreak attempts at the
//! runner seam and assert the Job Object jail holds — every hostile program
//! must terminate within its deadline, and the positive control must still
//! run normally.
//!
//! Cases:
//!   normal_exit    — control: hello world exits 0 with exact stdout
//!   infinite_loop  — CPU burn: hard-killed at timeout
//!   unbounded_mem  — 16 MB/iter alloc+touch past the 256 MB job cap
//!   spawn_tree     — persistent children spawned in a loop (tree reaped by
//!                    KILL_ON_JOB_CLOSE when the job closes)
//!   file_thrash    — open/write/close loop in the jail cwd
//!
//! Wall-clock bound per case: deadline + 2.5 s slack. Exit 0 iff all hold.

use std::time::{Duration, Instant};

const TIMEOUT_MS: u64 = 5000;
const SLACK_MS: u64 = 2500;

const NORMAL_EXIT: &str = r#"
#include <stdio.h>
int main(void) {
    printf("hello\n");
    return 0;
}
"#;

const INFINITE_LOOP: &str = r#"
int main(void) {
    volatile int x = 0;
    for (;;) { x++; }
    return x;
}
"#;

const UNBOUNDED_MEM: &str = r#"
#include <stdlib.h>
int main(void) {
    for (;;) {
        char *p = malloc(16u * 1024u * 1024u);
        if (!p) { for (;;) {} }
        for (int i = 0; i < 16 * 1024 * 1024; i += 4096) { p[i] = 1; }
    }
    return 0;
}
"#;

const SPAWN_TREE: &str = r#"
#include <stdlib.h>
int main(void) {
    for (;;) {
        system("start /B cmd /C \"ping -n 31 127.0.0.1 >nul\"");
    }
    return 0;
}
"#;

const FILE_THRASH: &str = r#"
#include <stdio.h>
int main(void) {
    for (;;) {
        FILE *f = fopen("thrash.tmp", "wb");
        if (f) { fputs("x", f); fclose(f); }
    }
    return 0;
}
"#;

struct CaseResult {
    name: &'static str,
    ok: bool,
    detail: String,
}

fn bounded(elapsed: Duration) -> bool {
    elapsed <= Duration::from_millis(TIMEOUT_MS + SLACK_MS)
}

fn check(name: &'static str, src: &str) -> CaseResult {
    let t0 = Instant::now();
    let outcome = runner::build_and_run(src, TIMEOUT_MS);
    let elapsed = t0.elapsed();

    let o = match outcome {
        Ok(o) => o,
        Err(e) => {
            return CaseResult { name, ok: false, detail: format!("run error: {e}") };
        }
    };

    let (ok, why): (bool, String) = match name {
        "normal_exit" => (
            !o.timed_out && o.exit == 0 && o.stdout.replace("\r\n", "\n") == "hello\n",
            format!(
                "exit={} timed_out={} stdout={:?}",
                o.exit, o.timed_out, o.stdout
            ),
        ),
        _ => (
            (o.timed_out || o.exit != 0) && bounded(elapsed),
            format!(
                "exit={} timed_out={} elapsed_ms={}",
                o.exit,
                o.timed_out,
                elapsed.as_millis()
            ),
        ),
    };

    CaseResult { name, ok, detail: why }
}

fn main() {
    let cases = [
        ("normal_exit", NORMAL_EXIT),
        ("infinite_loop", INFINITE_LOOP),
        ("unbounded_mem", UNBOUNDED_MEM),
        ("spawn_tree", SPAWN_TREE),
        ("file_thrash", FILE_THRASH),
    ];

    let mut failed = 0usize;
    for (name, src) in cases {
        let r = check(name, src);
        if r.ok {
            println!("  ok   {:<14} {}", r.name, r.detail);
        } else {
            failed += 1;
            eprintln!("  FAIL {:<14} {}", r.name, r.detail);
        }
    }

    println!("[G-SANDBOX-ESCAPE] {} cases, {failed} failures", cases.len());
    if failed > 0 {
        std::process::exit(1);
    }
}
