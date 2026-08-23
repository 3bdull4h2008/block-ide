//! G-MEMVIEW (PLAN.md step 3.4): pointer arrows must appear from REAL child
//! memory, not guesses. A linked list of 8 nodes is built; the validator
//! reconstructs the live heap from tracer events, ReadProcessMemory-scans
//! each node for words matching other nodes' addresses, and asserts:
//!   - 8 boxes visible mid-run
//!   - exactly 7 edges forming a chain (each node → one other node / null)
//!   - every edge offset is 8 (the `next` field after int+padding)
//!   - after clean exit: 0 boxes remain (teardown visible end-to-end)

use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use runner::memtrace::MemTraceReader;
use runner::spawn_inspectable;

const LIST: &str = r#"
#include <stdlib.h>
#include <stdio.h>
#include <windows.h>

typedef struct Node {
    int v;
    struct Node *next;
} Node;

int main(void) {
    Node *head = NULL;
    for (int i = 0; i < 8; i++) {
        Node *n = (Node *)malloc(sizeof(Node));
        if (!n) return 1;
        n->v = i * i;
        n->next = head;
        head = n;
    }
    printf("list built\n");
    fflush(stdout);
    Sleep(2500);
    while (head) {
        Node *nx = head->next;
        free(head);
        head = nx;
    }
    printf("freed\n");
    return 0;
}
"#;

fn main() {
    let src = LIST.to_string();
    let run = spawn_inspectable(&src, 20_000, true).expect("spawn");
    let mut tracer = MemTraceReader::attach(4000).expect("tracer ring");

    // drain until we have all 8 alloc events or timeout
    let mut live: HashMap<String, (u64, u32)> = HashMap::new();
    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        for e in tracer.since().0 {
            let key = format!("0x{:x}", e.addr);
            match e.op {
                0 => {
                    live.insert(key, (e.size, e.line));
                }
                1 => {
                    live.remove(&key);
                }
                _ => {}
            }
        }
        if live.len() >= 8 || Instant::now() > deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
    }

    let mut failed = false;
    println!("  ok   boxes={}", live.len());
    if live.len() != 8 {
        eprintln!("  FAIL expected 8 live nodes, saw {}", live.len());
        failed = true;
    }

    // scan contents for pointers to other boxes
    let set: HashSet<u64> = live
        .keys()
        .filter_map(|k| u64::from_str_radix(k.trim_start_matches("0x"), 16).ok())
        .collect();
    let mut edges: Vec<(u64, u64, u64)> = Vec::new(); // from, offset, to
    for (k, (size, _)) in &live {
        let a = u64::from_str_radix(k.trim_start_matches("0x"), 16).unwrap_or(0);
        if *size < 8 {
            continue;
        }
        let mut buf = vec![0u8; (*size as usize).min(512)];
        if !run.read_mem(a, &mut buf) {
            eprintln!("  FAIL read_mem failed for {k} (pid {})", run.pid);
            failed = true;
            continue;
        }
        for off in (0..=(buf.len() - 8)).step_by(8) {
            let w = u64::from_le_bytes(buf[off..off + 8].try_into().unwrap());
            if w != 0 && w != a && set.contains(&w) {
                edges.push((a, off as u64, w));
            }
        }
    }

    println!(
        "  ok   edges={} offsets={:?}",
        edges.len(),
        {
            let mut v: Vec<u64> = edges.iter().map(|e| e.1).collect();
            v.sort_unstable();
            v.dedup();
            v
        }
    );

    if edges.len() != 7 {
        eprintln!("  FAIL expected exactly 7 next-pointers, saw {}", edges.len());
        failed = true;
    }
    if !edges.iter().all(|(_, off, _)| *off == 8) {
        eprintln!("  FAIL some pointer not at offset 8 (int v + padding)");
        failed = true;
    }

    // wait for exit and confirm teardown reaches the UI path too
    let mut outcome = None;
    let t_end = Instant::now() + Duration::from_secs(10);
    while !run.is_finished() && Instant::now() < t_end {
        std::thread::sleep(Duration::from_millis(25));
    }
    loop {
        match run.poll() {
            Some(o) => {
                outcome = Some(o);
                break;
            }
            None if Instant::now() > t_end => break,
            None => std::thread::sleep(Duration::from_millis(25)),
        }
    }
    let o = outcome.expect("program never reported completion");
    println!(
        "  ok   exited {} stdout={:?}",
        o.exit,
        o.stdout.replace("\r\n", " ").trim()
    );
    // final drain: all frees should have landed
    loop {
        let (batch, gaps) = tracer.since();
        for e in &batch {
            let key = format!("0x{:x}", e.addr);
            if e.op == 1 {
                live.remove(&key);
            } else if e.op == 0 {
                live.insert(key, (e.size, e.line));
            }
        }
        if gaps == 0 && batch.is_empty() {
            break;
        }
    }
    if !live.is_empty() {
        eprintln!("  FAIL {} boxes survived clean teardown", live.len());
        failed = true;
    } else {
        println!("  ok   heap empty after free loop");
    }
    if o.exit != 0 {
        failed = true;
    }

    println!("[G-MEMVIEW] {}", if failed { "FAIL" } else { "PASS" });
    if failed {
        std::process::exit(1);
    }
}
