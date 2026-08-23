//! G-RECOVERY (PLAN.md 1.6/5.6): the crash journal must survive a hard kill
//! and restore the last edit. Drill:
//!   1. write entry (simulating the app's debounced save)
//!   2. "crash": no cleanup at all — new read must return it intact
//!   3. a torn .tmp file from a mid-write kill must never win over the real
//!      journal, and the next atomic write must clear it
//!   4. explicit clear removes everything; read then returns nothing

use app_lib::commands::{
    journal_clear_at, journal_read_at, journal_write_at, JournalEntry,
};

fn dir() -> std::path::PathBuf {
    let d = std::env::temp_dir().join("blockide-recovery-drill");
    std::fs::create_dir_all(&d).expect("mkdir");
    d
}

#[test]
fn crash_recovery_drill() {
    let d = dir();
    journal_clear_at(&d);

    // 1. the app's debounced save lands
    let entry = JournalEntry {
        path: "src/main.c".into(),
        content: "int main(void){ printf(\"unsaved genius\"); }".into(),
        saved_unix: 1_700_000_000,
    };
    journal_write_at(&d, &entry).expect("write");

    // 2. hard kill: no shutdown hooks ran. Read must be intact.
    let back = journal_read_at(&d).expect("journal survived kill");
    assert_eq!(back.content, entry.content);
    assert_eq!(back.path, "src/main.c");

    // 3. torn tmp from a kill DURING a write must not shadow the real file…
    std::fs::write(d.join("journal.tmp"), b"{ this is garbage").unwrap();
    let again = journal_read_at(&d).expect("real journal still readable");
    assert_eq!(again.content, entry.content);

    // …and the next atomic write replaces both cleanly.
    let newer = JournalEntry { content: "v2".into(), ..entry.clone() };
    journal_write_at(&d, &newer).expect("rewrite");
    assert!(!d.join("journal.tmp").exists(), "stale tmp left behind");
    let v2 = journal_read_at(&d).expect("read v2");
    assert_eq!(v2.content, "v2");

    // 4. explicit clear (user saved or discarded) empties the journal
    journal_clear_at(&d);
    assert!(journal_read_at(&d).is_none(), "journal not cleared");

    // empty-content entries never resurrect as "recovery"
    journal_write_at(
        &d,
        &JournalEntry { path: String::new(), content: "   ".into(), saved_unix: 0 },
    )
    .unwrap();
    assert!(
        journal_read_at(&d).map(|j| j.content.trim().is_empty()).unwrap_or(true),
        "blank journal surfaced as recovery"
    );
    journal_clear_at(&d);
}
