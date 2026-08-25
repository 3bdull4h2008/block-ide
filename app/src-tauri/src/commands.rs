use core_parser::{CTree, Lang};
use serde::{Deserialize, Serialize};
use std::path::{Component, PathBuf};
use std::sync::{Arc, Mutex};

fn lang_of(s: Option<&str>) -> Lang {
    Lang::from_opt(s)
}

#[derive(Serialize)]
pub struct ParseOut {
    pub tree: CTree,
    pub has_errors: bool,
}

#[tauri::command]
pub fn parse_c(src: String, lang: Option<String>) -> Result<ParseOut, String> {
    let tree =
        core_parser::parse_canonical_lang(&src, lang_of(lang.as_deref())).ok_or("grammar failed to load")?;
    let has_errors = core_parser::ctree_has_errors(&tree);
    Ok(ParseOut { tree, has_errors })
}

#[tauri::command]
pub fn canonicalize_c(src: String, lang: Option<String>) -> Result<String, String> {
    core_parser::canonical_source_lang(&src, lang_of(lang.as_deref()))
}

#[derive(Serialize)]
pub struct DiagOut {
    pub line: u32,
    pub col: u32,
    pub severity: String,
    pub message: String,
    pub offset: usize,
    pub node_id: u32,
    pub node_kind: String,
}

#[tauri::command]
pub fn diag_c(src: String, lang: Option<String>) -> Result<Vec<DiagOut>, String> {
    let l = lang_of(lang.as_deref());
    let stderr = core_parser::toolchain::syntax_check_stderr_lang(&src, l)?;
    let raws = core_parser::parse_clang_diags(&stderr, &format!("main.{}", l.as_str()));
    let ct = core_parser::parse_canonical_lang(&src, l).ok_or("grammar failed to load")?;
    Ok(core_parser::map_diags(&src, &ct, &raws)
        .into_iter()
        .map(|m| DiagOut {
            line: m.line,
            col: m.col,
            severity: m.severity,
            message: m.message,
            offset: m.offset,
            node_id: m.node_id,
            node_kind: m.node_kind,
        })
        .collect())
}

fn resolve_in_workspace(root: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = PathBuf::from(rel);
    if rel_path
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("path escapes workspace".into());
    }
    Ok(PathBuf::from(root).join(rel_path))
}

#[tauri::command]
pub fn list_c_files(root: String) -> Result<Vec<String>, String> {
    fn walk(dir: &PathBuf, base: &str, depth: u32, out: &mut Vec<String>) {
        if depth > 12 || out.len() > 20_000 {
            return;
        }
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let p = e.path();
            if p.is_dir() {
                if name.starts_with('.') || name == "target" || name == "node_modules" {
                    continue;
                }
                walk(&p, base, depth + 1, out);
            } else if is_source_file(&name) {
                if let Ok(rel) = p.strip_prefix(base) {
                    out.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    let mut out = Vec::new();
    walk(&PathBuf::from(&root), &root, 0, &mut out);
    out.sort();
    Ok(out)
}

/// C and the C++ subset pack share the workspace (.c/.cpp/.cc/.cxx + headers).
fn is_source_file(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [".c", ".cpp", ".cc", ".cxx", ".hpp", ".hh"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

#[tauri::command]
pub fn read_file(root: String, rel: String) -> Result<String, String> {
    let p = resolve_in_workspace(&root, &rel)?;
    std::fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(root: String, rel: String, content: String) -> Result<(), String> {
    let p = resolve_in_workspace(&root, &rel)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, content).map_err(|e| e.to_string())
}

const RUN_TIMEOUT_MS: u64 = 5000;

#[derive(Serialize, Clone)]
pub struct RunOut {
    pub stdout: String,
    pub stderr: String,
    pub exit: i32,
    pub timed_out: bool,
}

#[tauri::command]
pub fn run_c(src: String) -> Result<RunOut, String> {
    match runner::run_c(&src, RUN_TIMEOUT_MS) {
        Ok(o) => Ok(RunOut {
            stdout: o.stdout,
            stderr: o.stderr,
            exit: o.exit,
            timed_out: o.timed_out,
        }),
        Err(compile_stderr) => Ok(RunOut {
            stdout: String::new(),
            stderr: compile_stderr,
            exit: -1,
            timed_out: false,
        }),
    }
}

// ------------------------------------------------- async run + stage panel
fn stage_reader() -> &'static Mutex<Option<runner::stage::StageReader>> {
    static STAGE: std::sync::OnceLock<Mutex<Option<runner::stage::StageReader>>> =
        std::sync::OnceLock::new();
    STAGE.get_or_init(|| Mutex::new(None))
}

/// Start the program in the background as an inspectable supervised run;
/// poll with `run_poll`. `trace_mem` prepends memtrace.h to the staged copy
/// (disk file untouched).
#[tauri::command]
pub fn run_start(src: String, trace_mem: Option<bool>, lang: Option<String>) -> Result<(), String> {
    let trace = trace_mem.unwrap_or(false);
    let run = runner::spawn_inspectable_lang(
        &src,
        RUN_TIMEOUT_MS,
        trace,
        lang_of(lang.as_deref()),
    )
    .map_err(|e| e.replace("child never spawned", "program failed to launch"))?;
    let pid = run.pid;
    let run = Arc::new(run);
    *inspect_run().lock().map_err(|e| e.to_string())? = Some((run, pid));
    *stage_reader().lock().map_err(|e| e.to_string())? = None;
    *mem_reader().lock().map_err(|e| e.to_string())? = None;
    *live_heap().lock().map_err(|e| e.to_string())? = LiveHeap::default();
    Ok(())
}

fn inspect_run() -> &'static Mutex<Option<(Arc<runner::InspectableRun>, u32)>> {
    static R: std::sync::OnceLock<Mutex<Option<(Arc<runner::InspectableRun>, u32)>>> =
        std::sync::OnceLock::new();
    R.get_or_init(|| Mutex::new(None))
}

/// Some(outcome) once the background run finished (consumed on read).
#[tauri::command]
pub fn run_poll() -> Result<Option<RunOut>, String> {
    let guard = inspect_run().lock().map_err(|e| e.to_string())?;
    let taken = match guard.as_ref() {
        None => None,
        Some((r, _)) => r.poll(),
    };
    Ok(taken.map(|res| match res {
        Ok(o) => RunOut {
            stdout: o.stdout,
            stderr: o.stderr,
            exit: o.exit,
            timed_out: o.timed_out,
        },
        // launch/supervision failure: surface it instead of spinning forever
        Err(e) => RunOut {
            stdout: String::new(),
            stderr: format!("[launch] {e}"),
            exit: -1,
            timed_out: false,
        },
    }))
}

/// Write one typed line to the running program's stdin (console input box).
#[tauri::command]
pub fn run_stdin(line: String) -> Result<(), String> {
    let guard = inspect_run().lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some((r, _)) => r.send_line(&line),
        None => Err("no program is running".into()),
    }
}

fn mem_reader() -> &'static Mutex<Option<runner::memtrace::MemTraceReader>> {
    static MEM: std::sync::OnceLock<Mutex<Option<runner::memtrace::MemTraceReader>>> =
        std::sync::OnceLock::new();
    MEM.get_or_init(|| Mutex::new(None))
}

/// Attach to the child's tracer ring (only present when trace_mem was on).
#[tauri::command]
pub fn mem_attach() -> Result<bool, String> {
    let mut guard = mem_reader().lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = runner::memtrace::MemTraceReader::attach(2500);
    }
    Ok(guard.is_some())
}

#[derive(Serialize, Clone)]
pub struct MemBoxOut {
    /// hex string for stable JS keys
    pub addr: String,
    pub size: u64,
    pub line: u32,
}

#[derive(Serialize, Clone)]
pub struct MemEdgeOut {
    pub from: String,
    /// byte offset inside `from` holding the pointer
    pub offset: u64,
    pub to: String,
}

#[derive(Serialize, Clone, Default)]
pub struct MemStateOut {
    pub boxes: Vec<MemBoxOut>,
    pub edges: Vec<MemEdgeOut>,
    pub live: bool,
}

/// Server-side heap reconstruction from tracer events.
#[derive(Default)]
struct LiveHeap {
    order: Vec<String>, // insertion-ordered addr keys
    map: std::collections::HashMap<String, (u64, u32)>,
}

fn live_heap() -> &'static Mutex<LiveHeap> {
    static L: std::sync::OnceLock<Mutex<LiveHeap>> = std::sync::OnceLock::new();
    L.get_or_init(|| Mutex::new(LiveHeap::default()))
}

/// Drain new tracer events into the live heap, then scan each box's contents
/// via ReadProcessMemory for words that point at other boxes → pointer edges.
#[tauri::command]
pub fn mem_state() -> Result<MemStateOut, String> {
    const SCAN_MAX_BOXES: usize = 48;
    const SCAN_BYTES: usize = 512;
    const MAX_EDGES: usize = 200;

    // 1. drain tracer events
    let mut events: Vec<(u32, u32, u64, u64, u64)> = Vec::new(); // op,line,addr,size,aux
    {
        let mut guard = mem_reader().lock().map_err(|e| e.to_string())?;
        if let Some(r) = guard.as_mut() {
            for e in r.since().0 {
                events.push((e.op, e.line, e.addr, e.size, e.aux));
            }
        }
    }
    {
        let mut lh = live_heap().lock().map_err(|e| e.to_string())?;
        for (op, line, addr, size, aux) in events {
            let key = format!("0x{addr:x}");
            match op {
                0 => {
                    if !lh.map.contains_key(&key) {
                        lh.order.push(key.clone());
                    }
                    lh.map.insert(key, (size, line));
                }
                1 => {
                    if lh.map.remove(&key).is_some() {
                        lh.order.retain(|k| k != &key);
                    }
                }
                _ => {
                    let oldk = format!("0x{aux:x}");
                    if aux != 0 && lh.map.remove(&oldk).is_some() {
                        lh.order.retain(|k| k != &oldk);
                    }
                    if addr != 0 && size > 0 {
                        if !lh.map.contains_key(&key) {
                            lh.order.push(key.clone());
                        }
                        lh.map.insert(key, (size, line));
                    }
                }
            }
        }
    }

    // 2. snapshot + pointer scan
    let lh = live_heap().lock().map_err(|e| e.to_string())?;
    let run_guard = inspect_run().lock().map_err(|e| e.to_string())?;
    let inspector = run_guard.as_ref().map(|(r, _)| Arc::clone(r));

    let mut addr_keys: Vec<u64> = Vec::new();
    for k in &lh.order {
        if let Ok(a) = u64::from_str_radix(k.trim_start_matches("0x"), 16) {
            addr_keys.push(a);
        }
    }
    let set: std::collections::HashSet<u64> = addr_keys.iter().copied().collect();

    let mut out = MemStateOut { live: inspector.is_some(), ..Default::default() };
    'boxes: for key in lh.order.iter().take(SCAN_MAX_BOXES) {
        let a = u64::from_str_radix(key.trim_start_matches("0x"), 16).unwrap_or(0);
        let Some((size, line)) = lh.map.get(key) else { continue };
        out.boxes.push(MemBoxOut { addr: key.clone(), size: *size, line: *line });
        let Some(insp) = inspector.as_ref() else { continue };
        if insp.is_finished() {
            continue;
        }
        let n = (*size as usize).min(SCAN_BYTES);
        if n < 8 {
            continue;
        }
        let mut buf = vec![0u8; n];
        if !insp.read_mem(a, &mut buf) {
            continue;
        }
        for off in (0..=(n - 8)).step_by(8) {
            let word = u64::from_le_bytes(buf[off..off + 8].try_into().unwrap());
            if word != 0 && word != a && set.contains(&word) {
                out.edges.push(MemEdgeOut {
                    from: key.clone(),
                    offset: off as u64,
                    to: format!("0x{word:x}"),
                });
                if out.edges.len() >= MAX_EDGES {
                    break 'boxes;
                }
            }
        }
    }
    Ok(out)
}

/// Attach to the child's stage framebuffer (polls while the program starts).
#[tauri::command]
pub fn stage_attach() -> Result<Option<(i32, i32)>, String> {
    let mut guard = stage_reader().lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = runner::stage::StageReader::attach(2500);
    }
    Ok(guard.as_ref().map(|r| r.dims()))
}

#[derive(Serialize)]
pub struct StageFrameOut {
    pub frame: u32,
    pub w: i32,
    pub h: i32,
    /// base64 RGBA
    pub b64: String,
}

/// New frame since `last` (base64 RGBA), or null when nothing new.
#[tauri::command]
pub fn stage_frame(last: u32) -> Result<Option<StageFrameOut>, String> {
    let guard = stage_reader().lock().map_err(|e| e.to_string())?;
    let r = match guard.as_ref() {
        Some(r) => r,
        None => return Ok(None),
    };
    // Only treat frames newer than `last` as fresh (first poll takes all).
    let cur = match r.peek_frame() {
        Some(f) => f,
        None => return Ok(None),
    };
    if last != u32::MAX && cur <= last {
        return Ok(None);
    }
    let f = r.frame().ok_or("frame vanished")?;
    Ok(Some(StageFrameOut {
        frame: f.frame,
        w: f.w,
        h: f.h,
        b64: base64_encode(&f.rgba),
    }))
}

fn base64_encode(data: &[u8]) -> String {
    const TBL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(TBL[(n >> 18) as usize & 63] as char);
        out.push(TBL[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            TBL[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TBL[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
pub fn stage_keys(down: Vec<u8>) -> Result<(), String> {
    let guard = stage_reader().lock().map_err(|e| e.to_string())?;
    if let Some(r) = guard.as_ref() {
        r.send_keys(&down);
    }
    Ok(())
}

/// Ask a well-behaved stage program to exit; also flips the supervision
/// hard-stop flag so non-stage runaway programs die at the next tick.
#[tauri::command]
pub fn stage_stop() -> Result<(), String> {
    let guard = stage_reader().lock().map_err(|e| e.to_string())?;
    if let Some(r) = guard.as_ref() {
        r.request_quit();
    }
    runner::request_hard_stop();
    Ok(())
}

// ------------------------------------------------------------- academy
fn academy_root() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("BLOCKIDE_ACADEMY") {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            return Ok(pb);
        }
    }
    // dev builds: repo root sits above the exe's target dir
    if let Ok(exe) = std::env::current_exe() {
        for anc in exe.ancestors().skip(1) {
            let cand = anc.join("academy").join("worlds");
            if cand.is_dir() {
                return Ok(cand);
            }
        }
    }
    Err("academy levels not found".into())
}

#[derive(Serialize)]
pub struct LevelInfoOut {
    pub id: String,
    pub world: u8,
    pub title: String,
    pub xp: u32,
    pub done: bool,
}

#[tauri::command]
pub fn academy_levels(app: tauri::AppHandle) -> Result<Vec<LevelInfoOut>, String> {
    let root = academy_root()?;
    let prof = crate::profile::Profile::load(&app);
    let mut out: Vec<LevelInfoOut> = Vec::new();
    for e in std::fs::read_dir(&root).map_err(|e| e.to_string())?.flatten() {
        let toml_path = e.path().join("level.toml");
        if !toml_path.is_file() {
            continue;
        }
        match runner::academy::Level::load(&toml_path) {
            Ok(lv) => {
                let done = prof.completed.contains_key(&lv.id);
                out.push(LevelInfoOut {
                    id: lv.id,
                    world: lv.world,
                    title: lv.title,
                    xp: lv.xp,
                    done,
                })
            }
            Err(err) => eprintln!("level {}: {err}", e.path().display()),
        }
    }
    out.sort_by(|a, b| a.world.cmp(&b.world).then(a.id.cmp(&b.id)));
    Ok(out)
}

#[derive(Serialize)]
pub struct LevelLoadOut {
    pub starter: String,
    pub hints: Vec<String>,
}

/// Starter code + hint tiers (4.5). The solution file NEVER leaves the server side.
#[tauri::command]
pub fn academy_load(level_id: String) -> Result<LevelLoadOut, String> {
    let root = academy_root()?;
    let dir = root.join(&level_id);
    let lv = runner::academy::Level::load(&dir.join("level.toml"))?;
    Ok(LevelLoadOut {
        starter: lv.starter.clone(),
        hints: lv.hints.iter().map(|h| h.text.clone()).collect(),
    })
}

#[derive(Serialize)]
pub struct TestResultOut {
    pub index: usize,
    pub ok: bool,
    pub got: String,
}

#[derive(Serialize)]
pub struct CheckOut {
    pub passed: bool,
    pub results: Vec<TestResultOut>,
    pub xp_awarded: u32,
    pub total_xp: u32,
}

/// Run the player's source against the level's hidden tests; award XP on a
/// first-time pass. The reference solution is never exposed.
#[tauri::command]
pub fn academy_check(
    app: tauri::AppHandle,
    level_id: String,
    src: String,
) -> Result<CheckOut, String> {
    use runner::academy::Level;
    let root = academy_root()?;
    let lv = Level::load(&root.join(&level_id).join("level.toml"))?;
    let prepared = runner::prepare(&src, false)?;

    let mut results = Vec::new();
    let mut passed = true;
    for (i, t) in lv.tests.iter().enumerate() {
        let ok = match runner::run_prepared(&prepared, 10_000, &t.stdin) {
            Ok(o) => {
                let norm = |s: &str| s.replace("\r\n", "\n");
                !o.timed_out && o.exit == t.exit && norm(&o.stdout) == norm(&t.stdout)
            }
            Err(_) => false,
        };
        passed &= ok;
        results.push(TestResultOut {
            index: i,
            ok,
            got: String::new(),
        });
    }

    let mut prof = crate::profile::Profile::load(&app);
    let mut xp_awarded = 0;
    if passed && !prof.completed.contains_key(&level_id) {
        xp_awarded = lv.xp;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        prof.completed.insert(level_id, now);
        prof.xp += xp_awarded;
        prof.save(&app)?;
    }
    Ok(CheckOut {
        passed,
        results,
        xp_awarded,
        total_xp: prof.xp,
    })
}

#[derive(Serialize)]
pub struct ProfileOut {
    pub xp: u32,
    pub completed: Vec<String>,
    pub unlocked: Vec<String>,
}

#[tauri::command]
pub fn profile_get(app: tauri::AppHandle) -> Result<ProfileOut, String> {
    let p = crate::profile::Profile::load(&app);
    Ok(ProfileOut {
        xp: p.xp,
        completed: p.completed.keys().cloned().collect(),
        unlocked: p.unlocked_categories(),
    })
}

// ------------------------------------------------------- crash journal (1.6)
/// Overridable data root so automated gate runs never touch the user's real
/// profile/journal (Golden Rule 6: kid-safe defaults; tests must be invisible).
fn data_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(dir) = std::env::var("BLOCKIDE_DATA_DIR") {
        if !dir.trim().is_empty() {
            return Ok(std::path::PathBuf::from(dir));
        }
    }
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map_err(|_| "no app data dir".to_string())
}

fn journal_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = data_root(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("journal.json"))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct JournalEntry {
    pub path: String,
    pub content: String,
    pub saved_unix: i64,
}

/// Atomic journal write into an explicit directory (testable seam).
pub fn journal_write_at(dir: &std::path::Path, entry: &JournalEntry) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let p = dir.join("journal.json");
    let s = serde_json::to_string(entry).map_err(|e| e.to_string())?;
    // write-temp-then-rename so a kill mid-write never corrupts the journal
    let tmp = p.with_extension("tmp");
    std::fs::write(&tmp, s).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

pub fn journal_read_at(dir: &std::path::Path) -> Option<JournalEntry> {
    let s = std::fs::read_to_string(dir.join("journal.json")).ok()?;
    serde_json::from_str(&s).ok()
}

pub fn journal_clear_at(dir: &std::path::Path) {
    let _ = std::fs::remove_file(dir.join("journal.json"));
    let _ = std::fs::remove_file(dir.join("journal.tmp"));
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Debounced from the editor on every change; survives a hard kill.
#[tauri::command]
pub fn journal_write(
    app: tauri::AppHandle,
    path: String,
    content: String,
) -> Result<(), String> {
    let p = journal_path(&app)?;
    journal_write_at(
        p.parent().unwrap_or(std::path::Path::new(".")),
        &JournalEntry {
            path,
            content,
            saved_unix: now_unix(),
        },
    )
}

#[derive(Serialize)]
pub struct JournalReadOut {
    pub path: String,
    pub content: String,
    pub age_secs: i64,
}

/// Some(entry) when unsaved work was journalled — the frontend decides
/// whether to restore it.
#[tauri::command]
pub fn journal_read(app: tauri::AppHandle) -> Result<Option<JournalReadOut>, String> {
    let p = journal_path(&app)?;
    let Some(j) = journal_read_at(p.parent().unwrap_or(std::path::Path::new("."))) else {
        return Ok(None);
    };
    if j.content.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(JournalReadOut {
        path: j.path,
        content: j.content,
        age_secs: (now_unix() - j.saved_unix).max(0),
    }))
}

/// Clear the journal after an explicit save or a discarded recovery.
#[tauri::command]
pub fn journal_clear(app: tauri::AppHandle) -> Result<(), String> {
    let p = journal_path(&app)?;
    journal_clear_at(p.parent().unwrap_or(std::path::Path::new(".")));
    Ok(())
}
