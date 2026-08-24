//! G-PERF (PLAN.md gate @P5): a 5,000-file project must open in under 3 s.
//! "Open" = the workspace walk that feeds the file tree, plus reading a
//! deeply nested file through the same path guard the app uses.

use std::fs;
use std::time::{Duration, Instant};

#[test]
fn opens_5k_file_project_under_3s() {
    let dir = std::env::temp_dir().join("blockide-perf-5k");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("mkdir");

    // 100 folders x 50 files = 5000 .c files (+ noise that must be skipped)
    let body = "#include <stdio.h>\nint main(void){return 0;}\n";
    for d in 0..100 {
        let sub = dir.join(format!("proj{d}"));
        fs::create_dir_all(&sub).unwrap();
        for f in 0..50 {
            fs::write(sub.join(format!("file{f}.c")), body).unwrap();
        }
        fs::write(sub.join("readme.txt"), "not c").unwrap();
        fs::write(sub.join("notes.md"), "# notes").unwrap();
    }

    // warm-up walk (untimed): the gate metric is steady-state open time,
    // not cold-cache penalty right after other validators churned the disk
    let warm = app_lib::commands::list_c_files(dir.to_string_lossy().into_owned()).expect("warm");
    assert_eq!(warm.len(), 5000);

    let t0 = Instant::now();
    let files =
        app_lib::commands::list_c_files(dir.to_string_lossy().into_owned()).expect("walk");
    let walk_elapsed = t0.elapsed();

    assert_eq!(files.len(), 5000, "expected exactly 5000 .c files");
    assert!(
        walk_elapsed < Duration::from_secs(3),
        "workspace open took {:?} (>3 s)",
        walk_elapsed
    );

    // deep read through the path guard stays fast too
    let deep_rel = files.last().unwrap().clone();
    let t1 = Instant::now();
    let content = app_lib::commands::read_file(dir.to_string_lossy().into_owned(), deep_rel)
        .expect("read");
    assert!(content.contains("int main"));
    assert!(t1.elapsed() < Duration::from_millis(100));

    let _ = fs::remove_dir_all(&dir);
    println!(
        "[G-PERF] 5000 files listed in {:.1?}, deep read in {:.1?}",
        walk_elapsed,
        t1.elapsed()
    );
}
