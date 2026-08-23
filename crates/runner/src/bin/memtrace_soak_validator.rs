//! G-MEMTRACE (PLAN.md gate @P3, tracked→enforced here): stress the memory
//! tracer end-to-end.
//!
//! 1. SOAK: 35k interleaved alloc/calloc/realloc/free ops through the
//!    macro-interposed header → every event arrives in order (no seq gaps,
//!    no drops) and replaying them reconstructs EXACTLY the 3 intentional
//!    leaks (addresses confirmed by the child printing its own __LINE__s).
//! 2. OVERHEAD-WHEN-OFF: hello world with tracing disabled is not measurably
//!    slower than plain (branch-only cost when BLOCKIDE_MEMTRACE is unset).

use std::collections::HashMap;
use std::time::{Duration, Instant};

use runner::{build_and_run_opts, memtrace::MemTraceReader};

const SOAK: &str = r#"
#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>
#include <windows.h>

int main(void) {
    for (int i = 0; i < 10000; i++) {
        char *a = (char *)malloc(64);
        if (!a) return 11;
        a[0] = 1;
        free(a);
    }
    for (int i = 0; i < 5000; i++) {
        int *b = (int *)calloc(16, sizeof(int));
        if (!b) return 12;
        b[0] = i;
        b = (int *)realloc(b, 128);
        if (!b) return 13;
        free(b);
    }
    void *ka = malloc(100);      int lka = __LINE__;
    void *kb = calloc(4, 8);     int lkb = __LINE__;
    void *kc = realloc(NULL, 250); int lkc = __LINE__;
    printf("MTLEAK ka %lu %u\n", (unsigned long)ka, lka);
    printf("MTLEAK kb %lu %u\n", (unsigned long)kb, lkb);
    printf("MTLEAK kc %lu %u\n", (unsigned long)kc, lkc);
    fflush(stdout);
    /* hold the section open so a late-attaching IDE can drain the ring */
    Sleep(2000);
    return 0;
}
"#;

const HELLO: &str =
    "#include <stdio.h>\nint main(void){ printf(\"hello\\n\"); return 0; }\n";

fn median(v: &mut [f64]) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

fn main() {
    let mut failed = false;

    // ------------------------------------------------------------- soak
    let src = SOAK.to_string();
    let child = std::thread::spawn(move || build_and_run_opts(&src, 20_000, true));
    let mut reader = match MemTraceReader::attach(4000) {
        Some(r) => r,
        None => {
            eprintln!("  FAIL tracer mapping never appeared");
            if let Ok(o) = child.join().unwrap_or_else(|_| Err("join".into())) {
                eprintln!(
                    "       child: exit={} timed_out={} stdout={:?} stderr={}",
                    o.exit,
                    o.timed_out,
                    o.stdout,
                    o.stderr.lines().next().unwrap_or("")
                );
            }
            std::process::exit(1);
        }
    };

    let mut events: Vec<(u32, u32, u32, u64, u64, u64)> = Vec::new(); // op,line,?,addr,size,aux
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut total_gaps = 0u32;
    loop {
        let (batch, gaps) = reader.since();
        total_gaps += gaps;
        for e in batch {
            events.push((e.op, e.line, 0, e.addr, e.size, e.aux));
        }
        if child.is_finished() {
            // drain once more after exit
            let (batch, gaps) = reader.since();
            total_gaps += gaps;
            for e in batch {
                events.push((e.op, e.line, 0, e.addr, e.size, e.aux));
            }
            break;
        }
        if Instant::now() > deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let outcome = child.join().expect("join").expect("run");

    let n_alloc = events.iter().filter(|e| e.0 == 0).count();
    let n_free = events.iter().filter(|e| e.0 == 1).count();
    let n_reloc = events.iter().filter(|e| e.0 == 2).count();

    println!(
        "  ok   events={} alloc={} free={} realloc={} gaps={total_gaps} dropped={} exit={}",
        events.len(),
        n_alloc,
        n_free,
        n_reloc,
        reader.total_dropped(),
        outcome.exit
    );

    // replay
    let mut live: HashMap<u64, (u64, u32)> = HashMap::new(); // addr -> (size, line)
    for &(op, _l, _, addr, size, aux) in &events {
        match op {
            0 => {
                live.insert(addr, (size, _l));
            }
            1 => {
                live.remove(&addr);
            }
            _ => {
                if aux != 0 {
                    live.remove(&aux);
                }
                if addr != 0 {
                    live.insert(addr, (size, _l));
                }
            }
        }
    }

    let mut expected: HashMap<u64, (u64,)> = HashMap::new();
    let mut want_lines = Vec::new();
    for line in outcome.stdout.lines() {
        let line = line.trim_end();
        if let Some(rest) = line.strip_prefix("MTLEAK ") {
            let mut it = rest.split_whitespace();
            let _name = it.next().unwrap_or("");
            let addr: u64 = it.next().unwrap_or("0").parse().unwrap_or(0);
            let lnum: u32 = it.next().unwrap_or("0").parse().unwrap_or(0);
            expected.insert(addr, (0,));
            want_lines.push((addr, lnum));
        }
    }

    if outcome.exit != 0 {
        eprintln!("  FAIL soak exited {} stderr={}", outcome.exit, outcome.stderr);
        failed = true;
    }
    if !(n_alloc == 15002 && n_free == 15000 && n_reloc == 5001) {
        eprintln!("  FAIL op counts {n_alloc}/{n_free}/{n_reloc} != 15002/15000/5001");
        failed = true;
    }
    if total_gaps > 0 || reader.total_dropped() > 0 {
        eprintln!("  FAIL ring lost events (gaps={total_gaps} dropped={})", reader.total_dropped());
        failed = true;
    }
    if live.len() != 3 {
        eprintln!(
            "  FAIL live heap after replay = {} boxes (want exactly the 3 leaks)",
            live.len()
        );
        failed = true;
    }
    for (addr, lnum) in &want_lines {
        match live.get(addr) {
            Some((_size, eline)) => {
                if eline != lnum {
                    eprintln!("  FAIL leak @0x{addr:x}: event line {eline} != reported {lnum}");
                    failed = true;
                }
            }
            None => {
                eprintln!("  FAIL leak @0x{addr:x} missing from replayed live set");
                failed = true;
            }
        }
    }
    let sizes: Vec<u64> = live.values().map(|v| v.0).collect();
    println!("  ok   live leak set: {} entries sizes={sizes:?} lines={:?}", live.len(), 
        live.values().map(|v| v.1).collect::<Vec<_>>());

    // ------------------------------------------- overhead when OFF
    let mut off = Vec::new();
    let mut on = Vec::new();
    for _ in 0..7 {
        let t = Instant::now();
        let _ = build_and_run_opts(HELLO, 10_000, false);
        off.push(t.elapsed().as_secs_f64() * 1000.0);
        let t = Instant::now();
        let o = build_and_run_opts(HELLO, 10_000, true);
        on.push(t.elapsed().as_secs_f64() * 1000.0);
        if !matches!(&o, Ok(r) if r.stdout.contains("hello")) {
            eprintln!("  FAIL traced hello broke output");
            failed = true;
        }
    }
    let (mo, mn) = (median(&mut off), median(&mut on));
    println!("  ok   overhead: off={mo:.1}ms traced-inactive={mn:.1}ms (delta = tcc parsing memtrace.h once)");
    // Runtime cost when inactive is one env-check branch; the measured delta
    // is dominated by tcc parsing the extra header at compile time.
    if mn > mo + 25.0 {
        eprintln!("  FAIL traced-inactive adds >25ms ({mn:.1} vs {mo:.1})");
        failed = true;
    }

    println!("[G-MEMTRACE] {}", if failed { "FAIL" } else { "PASS" });
    if failed {
        std::process::exit(1);
    }
}
