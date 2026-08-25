//! runner: compile user C with the bundled toolchain and execute it inside a
//! Windows Job Object (memory cap + kill-on-close) with a hard timeout.
//! PLAN.md step 2.2 — Golden Rule 8: this crate is the ONE owner of the
//! "compile + run" seam; the Tauri app and validators both call into here.

use std::os::windows::io::AsRawHandle;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::CloseHandle;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOB_OBJECT_LIMIT_PROCESS_MEMORY,
};

pub mod academy;
pub mod memtrace;
pub mod stage;

pub struct Job(*mut core::ffi::c_void);

impl Job {
    pub fn new(mem_limit_mb: usize) -> Option<Job> {
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return None;
            }
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags =
                JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            limits.ProcessMemoryLimit = mem_limit_mb * 1024 * 1024;
            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                CloseHandle(job);
                return None;
            }
            Some(Job(job))
        }
    }

    pub fn assign(&self, child: &std::process::Child) -> bool {
        unsafe { AssignProcessToJobObject(self.0, child.as_raw_handle() as _) != 0 }
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

/// Directory all user compiles/runs stage into (jail cwd).
fn run_dir() -> PathBuf {
    std::env::temp_dir().join("blockide-run")
}

/// FNV-1a 64-bit — stable across builds, used only for compile-skip caching.
fn fnv1a(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

/// Stage `src` as `main.c` in the jail dir; returns its path.
pub fn stage_source(src: &str) -> Result<PathBuf, String> {
    let dir = run_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let cpath = dir.join("main.c");
    std::fs::write(&cpath, src).map_err(|e| e.to_string())?;
    Ok(cpath)
}

/// Compile `src` as `main.c` -> `prog.exe` via vcvars env + clang. Returns
/// the exe path, or the compiler stderr on failure. Skips compilation when
/// the exact same source already produced the current exe (Run-button spam).
pub fn compile_c(src: &str) -> Result<PathBuf, String> {
    let dir = run_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let cpath = dir.join("main.c");
    let exe = dir.join("prog.exe");
    let marker = dir.join("prog.hash");

    let hash = format!("{:016x}", fnv1a(src.as_bytes()));
    let cached = std::fs::read_to_string(&marker).map(|m| m == hash).unwrap_or(false);
    if exe.is_file() && cached {
        return Ok(exe);
    }

    stage_source(src)?;

    let mut cc = core_parser::toolchain::clang_command()?;
    let inc = format!("-I{}", stage::include_dir().display());
    let out = cc
        .arg("-O0")
        .arg(&inc)
        .arg(&cpath)
        .arg("-o")
        .arg(&exe)
        .current_dir(&dir)
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() || !exe.is_file() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    std::fs::write(&marker, hash).map_err(|e| e.to_string())?;
    Ok(exe)
}

#[derive(Debug)]
pub struct RunOutcome {
    pub stdout: String,
    pub stderr: String,
    pub exit: i32,
    pub timed_out: bool,
}

/// Everything needed to launch a user program through either backend.
pub struct Prepared {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub envs: Vec<(&'static str, &'static str)>,
}

pub fn prepare(src: &str, trace_mem: bool) -> Result<Prepared, String> {
    prepare_lang(src, trace_mem, core_parser::Lang::C)
}

/// Language-aware staging (C++ subset pack, D3 amendment). tcc is C-ONLY —
/// C++ always routes to the clang backend (staged as `.cpp`, driver infers
/// C++ and links the C++ runtime). Memory tracing is C-only in v1: the
/// interposed header is a C header; the flag is ignored for C++ sources.
pub fn prepare_lang(
    src: &str,
    trace_mem: bool,
    lang: core_parser::Lang,
) -> Result<Prepared, String> {
    // Content-addressed staging: two Prepared values must never share a
    // staged file (an academy validator holds several at once).
    let tag = format!("{:016x}", fnv1a(src.as_bytes()));
    let dir = run_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ext = lang.file_ext();
    let staged = if trace_mem && lang == core_parser::Lang::C {
        format!("#include \"memtrace.h\"\n{src}")
    } else {
        src.to_string()
    };
    let inc = format!("-I{}", stage::include_dir().display());
    let cpath = stage_source_as(&staged, &format!("main-{tag}.{ext}"))?;
    match lang {
        core_parser::Lang::C if tcc_path().is_some() => Ok(Prepared {
            program: tcc_path().expect("tcc checked above"),
            args: vec![
                "-run".to_string(),
                inc,
                cpath.display().to_string(),
            ],
            envs: if trace_mem {
                vec![("BLOCKIDE_MEMTRACE", "1")]
            } else {
                vec![]
            },
        }),
        core_parser::Lang::Python => {
            let py = python_path().ok_or_else(|| {
                "Python not found on this computer — install it from python.org, then try again"
                    .to_string()
            })?;
            Ok(Prepared {
                program: PathBuf::from(py),
                args: vec![cpath.display().to_string()],
                envs: vec![],
            })
        }
        core_parser::Lang::JavaScript => {
            let node = node_path().ok_or_else(|| {
                "Node.js not found on this computer — install it from nodejs.org, then try again"
                    .to_string()
            })?;
            Ok(Prepared {
                program: PathBuf::from(node),
                args: vec![cpath.display().to_string()],
                envs: vec![],
            })
        }
        core_parser::Lang::Rust => {
            let rustc = rustc_path().ok_or_else(|| {
                "Rust not found on this computer — install it from rustup.rs, then try again"
                    .to_string()
            })?;
            let exe = dir.join(format!("prog-{tag}.exe"));
            let marker = dir.join(format!("prog-{tag}.hash"));
            let cached = std::fs::read_to_string(&marker)
                .map(|m| m == tag)
                .unwrap_or(false);
            if !(exe.is_file() && cached) {
                let out = Command::new(rustc)
                    .arg("-O0")
                    .arg(&cpath)
                    .arg("-o")
                    .arg(&exe)
                    .current_dir(&dir)
                    .output()
                    .map_err(|e| e.to_string())?;
                if !out.status.success() || !exe.is_file() {
                    return Err(String::from_utf8_lossy(&out.stderr).into_owned());
                }
                std::fs::write(&marker, &tag).map_err(|e| e.to_string())?;
            }
            Ok(Prepared {
                program: exe,
                args: vec![],
                envs: vec![],
            })
        }
        // C without tcc, or C++: clang backend (driver infers language)
        _ => {
            let exe = dir.join(format!("prog-{tag}.exe"));
            let marker = dir.join(format!("prog-{tag}.hash"));
            let cached = std::fs::read_to_string(&marker)
                .map(|m| m == tag)
                .unwrap_or(false);
            if !(exe.is_file() && cached) {
                let mut cc = core_parser::toolchain::clang_command()?;
                let out = cc
                    .arg("-O0")
                    .arg("-fno-color-diagnostics")
                    .arg(&inc)
                    .arg(&cpath)
                    .arg("-o")
                    .arg(&exe)
                    .current_dir(&dir)
                    .output()
                    .map_err(|e| e.to_string())?;
                if !out.status.success() || !exe.is_file() {
                    return Err(String::from_utf8_lossy(&out.stderr).into_owned());
                }
                std::fs::write(&marker, &tag).map_err(|e| e.to_string())?;
            }
            Ok(Prepared {
                program: exe,
                args: vec![],
                envs: if trace_mem && lang == core_parser::Lang::C {
                    vec![("BLOCKIDE_MEMTRACE", "1")]
                } else {
                    vec![]
                },
            })
        }
    }
}

/// Stage text under an explicit filename in the jail dir.
pub fn stage_source_as(text: &str, name: &str) -> Result<PathBuf, String> {
    let dir = run_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = dir.join(name);
    std::fs::write(&p, text).map_err(|e| e.to_string())?;
    Ok(p)
}

/// Execute `program args...` under a fresh Job Object (256 MB per-process
/// memory cap, KILL_ON_JOB_CLOSE so processes spawned by the target die with
/// the job). Hard-kills at `timeout_ms`; cwd is the staged run dir.
pub fn run_program(
    program: &Path,
    args: &[String],
    timeout_ms: u64,
    extra_env: &[(&str, &str)],
) -> Result<RunOutcome, String> {
    run_job(program, args, extra_env, timeout_ms, "", None)
}

/// Shared spawn+supervise core. `watch` receives the child pid right after
/// spawn when an inspector wants to ReadProcessMemory mid-run. `stdin_text`
/// is written to the child then closed (must stay < pipe buffer ~64 KB).
fn run_job(
    program: &Path,
    args: &[String],
    extra_env: &[(&str, &str)],
    timeout_ms: u64,
    stdin_text: &str,
    on_spawn: Option<&mut dyn FnMut(u32)>,
) -> Result<RunOutcome, String> {
    run_job_opts(
        program,
        args,
        extra_env,
        timeout_ms,
        stdin_text,
        on_spawn,
        None,
    )
}

fn run_job_opts(
    program: &Path,
    args: &[String],
    extra_env: &[(&str, &str)],
    timeout_ms: u64,
    stdin_text: &str,
    mut on_spawn: Option<&mut dyn FnMut(u32)>,
    stdin_slot: Option<&std::sync::Arc<std::sync::Mutex<Option<std::process::ChildStdin>>>>,
) -> Result<RunOutcome, String> {
    use std::io::{Read, Write};

    let job = Job::new(256);

    let mut cmd = Command::new(program);
    cmd.args(args)
        .current_dir(run_dir())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // tcc is a console-subsystem binary spawned from a GUI process: without
    // this flag Windows allocates a fresh console per run (flicker) and the
    // child's CRT init can transiently fail against a dying parent console
    // with ERROR_NO_DATA (os error 232). NUL-piped stdio needs no console.
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    if stdin_text.is_empty() && stdin_slot.is_none() {
        cmd.stdin(Stdio::null());
    } else {
        cmd.stdin(Stdio::piped());
    }
    for (k, v) in extra_env {
        cmd.env(k, v);
    }
    // One transparent retry: launch failures of this class are transient
    // (handle/console teardown races), leave nothing behind, and a second
    // attempt costs 60 ms once instead of a stuck spinner.
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(first) => {
            thread::sleep(Duration::from_millis(60));
            cmd.spawn().map_err(|e| {
                format!("launch failed: {e} (first attempt: {first})")
            })?
        }
    };
    if let Some(j) = &job {
        j.assign(&child);
    }
    if !stdin_text.is_empty() {
        if let Some(mut si) = child.stdin.take() {
            let _ = si.write_all(stdin_text.as_bytes());
        }
    } else if let Some(slot) = stdin_slot {
        // interactive run: hand the LIVE stdin pipe to the caller — the
        // console panel writes typed lines into it while the program waits
        *slot.lock().unwrap() = child.stdin.take();
    }
    if let Some(f) = on_spawn.take() {
        f(child.id());
    }

    // timeout_ms == 0 → NO deadline: interactive runs (waiting on stdin)
    // must never be killed mid-typing — the Stop button / hard-stop govern.
    let deadline = if timeout_ms == 0 {
        None
    } else {
        Some(Instant::now() + Duration::from_millis(timeout_ms))
    };
    let mut timed_out = false;
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => break,
            None => {
                let expired = deadline.is_some_and(|d| Instant::now() >= d);
                if expired || super_stop_requested() {
                    let _ = child.kill();
                    timed_out = expired;
                    break;
                }
                thread::sleep(Duration::from_millis(15));
            }
        }
    }
    // Take the pipes before dropping the job: grandchildren may inherit the
    // write ends, so drain order matters — KILL_ON_JOB_CLOSE must reap the
    // whole tree FIRST, or read_to_end below blocks until stragglers die out.
    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    drop(job);
    let mut buf_s = Vec::new();
    let mut buf_e = Vec::new();
    let _ = so.read_to_end(&mut buf_s);
    let _ = se.read_to_end(&mut buf_e);
    let exit = child.wait().map_err(|e| e.to_string())?;
    Ok(RunOutcome {
        stdout: String::from_utf8_lossy(&buf_s).into_owned(),
        stderr: String::from_utf8_lossy(&buf_e).into_owned(),
        exit: exit.code().unwrap_or(-1),
        timed_out,
    })
}

// cooperative stop shared between the app UI and supervised runs
static STOP_FLAG: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn super_stop_requested() -> bool {
    STOP_FLAG.load(std::sync::atomic::Ordering::Relaxed)
}

/// Ask every supervised run to stop at its next 15 ms supervision tick
/// (backstop for programs without a stage quit flag).
pub fn request_hard_stop() {
    STOP_FLAG.store(true, std::sync::atomic::Ordering::Relaxed);
}

pub fn clear_hard_stop() {
    STOP_FLAG.store(false, std::sync::atomic::Ordering::Relaxed);
}

/// Locate the vendored tcc-class compiler (D4 default execution backend).
/// Order: BLOCKIDE_TCC override → next to the running exe (installed app)
/// → repo third_party/ (dev builds).
pub fn tcc_path() -> Option<PathBuf> {
    fn usable(p: PathBuf) -> Option<PathBuf> {
        if p.is_file() { Some(p) } else { None }
    }
    if let Ok(p) = std::env::var("BLOCKIDE_TCC") {
        if let Some(found) = usable(PathBuf::from(&p)) {
            return Some(found);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // installed layout: tcc ships as a Tauri resource beside the exe
            if let Some(c) =
                usable(dir.join("tcc").join("tcc.exe")).or_else(|| {
                    usable(dir.join("resources").join("tcc").join("tcc.exe"))
                })
            {
                return Some(c);
            }
            let candidate = dir
                .ancestors()
                .find_map(|a| usable(a.join("third_party").join("tcc").join("tcc").join("tcc.exe")));
            if let Some(c) = candidate {
                return Some(c);
            }
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    usable(manifest
        .join("..")
        .join("..")
        .join("third_party")
        .join("tcc")
        .join("tcc")
        .join("tcc.exe"))
}

// ------------------------------------------------ D11 interpreter detection
// Same seam pattern as clang detection: PATH probe with a version flag.
// The probe requires a SUCCESSFUL exit — the Windows Store `python` alias
// spawns fine but exits nonzero when Python is not actually installed.
fn probe(candidates: &[&str], version_flag: &str) -> Option<String> {
    for c in candidates {
        if Command::new(c)
            .arg(version_flag)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Some(c.to_string());
        }
    }
    None
}

pub fn python_path() -> Option<String> {
    probe(&["python", "py", "python3"], "--version")
}

pub fn node_path() -> Option<String> {
    probe(&["node", "node.exe"], "--version")
}

pub fn rustc_path() -> Option<String> {
    probe(&["rustc"], "--version")
}

/// Execute a compiled binary (clang backend).
pub fn run_exe(exe: &Path, timeout_ms: u64) -> Result<RunOutcome, String> {
    run_program(exe, &[], timeout_ms, &[])
}

/// Compile `src` and execute it through the selected backend.
///
/// D4 decision (2026-08-23): tcc `-run` when vendored (~12 ms total);
/// clang -O0 + cached vcvars env otherwise (~155 ms). clang remains the
/// diagnostic authority (`diag_c`); this seam only decides how code EXECUTES.
///
/// `trace_mem` prepends memtrace.h to the staged copy (never to the file on
/// disk — Golden Rule 1) and sets BLOCKIDE_MEMTRACE=1 for the child.
pub fn build_and_run(src: &str, timeout_ms: u64) -> Result<RunOutcome, String> {
    build_and_run_opts(src, timeout_ms, false)
}

pub fn build_and_run_opts(
    src: &str,
    timeout_ms: u64,
    trace_mem: bool,
) -> Result<RunOutcome, String> {
    build_and_run_lang(src, timeout_ms, trace_mem, core_parser::Lang::C)
}

/// Language-aware compile+run (C++ routes to the clang backend).
pub fn build_and_run_lang(
    src: &str,
    timeout_ms: u64,
    trace_mem: bool,
    lang: core_parser::Lang,
) -> Result<RunOutcome, String> {
    run_prepared(&prepare_lang(src, trace_mem, lang)?, timeout_ms, "")
}

/// Execute a prepared program with stdin text (used by the academy runner).
pub fn run_prepared(
    p: &Prepared,
    timeout_ms: u64,
    stdin_text: &str,
) -> Result<RunOutcome, String> {
    clear_hard_stop();
    run_job(&p.program, &p.args, &p.envs, timeout_ms, stdin_text, None)
}

/// Convenience: compile then run with the app's default timeout (production
/// entry point — backend selected per D4).
pub fn run_c(src: &str, timeout_ms: u64) -> Result<RunOutcome, String> {
    build_and_run(src, timeout_ms)
}

#[cfg(test)]
mod cpp_backend_tests {
    use super::*;

    const CPP_HELLO: &str = r#"#include <iostream>

int main() {
    std::cout << "cpp-hello" << std::endl;
    return 0;
}
"#;

    #[test]
    #[ignore = "requires local clang + MSVC env; verified per-run via `cargo test -- --ignored`"]
    fn cpp_runs_via_clang_backend() {
        // tcc must NEVER be selected for C++ (C-only compiler)
        let out = build_and_run_lang(CPP_HELLO, 30_000, false, core_parser::Lang::Cpp)
            .expect("cpp compile+run");
        assert_eq!(out.exit, 0, "stderr: {}", out.stderr);
        assert!(out.stdout.contains("cpp-hello"), "stdout: {}", out.stdout);
    }

    #[test]
    fn cpp_never_selects_tcc() {
        // the staging decision is checkable WITHOUT a toolchain: a C++
        // Prepared must always be the clang-produced exe, never tcc -run
        let p = prepare_lang(CPP_HELLO, false, core_parser::Lang::Cpp).expect("prepare");
        assert!(p.program.extension().and_then(|e| e.to_str()) == Some("exe"));
        assert!(p.args.is_empty(), "tcc -run args leaked into C++ backend");
    }
}

/// A supervised run whose memory can be inspected while it lives.
pub struct InspectableRun {
    pub pid: u32,
    done: Arc<Mutex<Option<Result<RunOutcome, String>>>>,
    finished: Arc<std::sync::atomic::AtomicBool>,
    /// Live stdin pipe (interactive runs) — console panel writes into it.
    stdin: Arc<Mutex<Option<std::process::ChildStdin>>>,
}

/// Spawn a run that stays inspectable (same backend selection + jail).
pub fn spawn_inspectable(
    src: &str,
    timeout_ms: u64,
    trace_mem: bool,
) -> Result<InspectableRun, String> {
    spawn_inspectable_lang(src, timeout_ms, trace_mem, core_parser::Lang::C)
}

/// Language-aware inspectable spawn (C++ routes to clang automatically).
/// The child's stdin stays OPEN for interactive runs — the console panel
/// writes typed lines into it via `send_line` (cin/scanf/input()).
pub fn spawn_inspectable_lang(
    src: &str,
    timeout_ms: u64,
    trace_mem: bool,
    lang: core_parser::Lang,
) -> Result<InspectableRun, String> {
    use std::process::ChildStdin;
    let p = prepare_lang(src, trace_mem, lang)?;
    clear_hard_stop();
    let done: Arc<Mutex<Option<Result<RunOutcome, String>>>> = Arc::new(Mutex::new(None));
    let finished = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let done2 = done.clone();
    let fin2 = finished.clone();
    let pid_slot: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(None));
    let pid_for_thread = pid_slot.clone();
    let stdin_slot: Arc<Mutex<Option<ChildStdin>>> = Arc::new(Mutex::new(None));
    let stdin_for_struct = stdin_slot.clone();
    let stdin_for_thread = stdin_slot.clone();
    thread::spawn(move || {
        let mut cb = |pid: u32| {
            *pid_for_thread.lock().unwrap() = Some(pid);
        };
        // prepare() ran on the caller thread; program/args/envs move in.
        // Launch errors are PRESERVED (not .ok()-dropped) so the UI can show
        *done2.lock().unwrap() = Some(run_job_opts(
            &p.program,
            &p.args,
            &p.envs,
            timeout_ms,
            "",
            Some(&mut cb),
            Some(&stdin_for_thread),
        ));
        // child is gone — drop the pipe so send_line fails fast
        *stdin_for_thread.lock().unwrap() = None;
        fin2.store(true, std::sync::atomic::Ordering::Relaxed);
    });
    // wait briefly for the spawn callback so callers get a real pid
    for _ in 0..200 {
        if let Some(pid) = *pid_slot.lock().unwrap() {
            return Ok(InspectableRun {
                pid,
                done,
                finished,
                stdin: stdin_for_struct,
            });
        }
        if finished.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }
        thread::sleep(Duration::from_millis(5));
    }
    Err("child never spawned".into())
}

impl InspectableRun {
    /// Some(Ok(outcome)) once the run finished; Some(Err(reason)) when the
    /// program could not be launched/supervised (consumed on read).
    pub fn poll(&self) -> Option<Result<RunOutcome, String>> {
        self.done.lock().unwrap().take()
    }

    pub fn is_finished(&self) -> bool {
        self.finished.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Write one line to the running program's stdin (console input box).
    pub fn send_line(&self, line: &str) -> Result<(), String> {
        use std::io::Write;
        let mut guard = self.stdin.lock().unwrap();
        match guard.as_mut() {
            Some(si) => {
                si.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
                si.write_all(b"\n").map_err(|e| e.to_string())?;
                si.flush().map_err(|e| e.to_string())
            }
            None => Err("program is not running (or does not read input)".into()),
        }
    }

    /// Read arbitrary child memory (heap contents for pointer scanning).
    pub fn read_mem(&self, addr: u64, buf: &mut [u8]) -> bool {
        use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
        };
        unsafe {
            let h = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, 0, self.pid);
            if h.is_null() {
                return false;
            }
            let mut got = 0usize;
            let ok = ReadProcessMemory(
                h,
                addr as *const core::ffi::c_void,
                buf.as_mut_ptr() as *mut core::ffi::c_void,
                buf.len(),
                &mut got,
            ) != 0
                && got == buf.len();
            CloseHandle(h);
            ok
        }
    }
}
