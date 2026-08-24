//! Toolchain detection + invocation seam (PLAN.md Rule 8: exactly one owner).
//! Used by the app (`diag_c`), `diag_map_validator`, and the `runner` crate.

use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

pub fn clang_path() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("BLOCKIDE_CLANG") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Ok(pb);
        }
    }
    if Command::new("clang")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
    {
        return Ok(PathBuf::from("clang"));
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        let p = PathBuf::from(pf).join("LLVM").join("bin").join("clang.exe");
        if p.is_file() {
            return Ok(p);
        }
    }
    Err("clang.exe not found".into())
}

pub fn vcvars_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("BLOCKIDE_VCVARS") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    let candidates = [
        r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        r"C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        r"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
    ];
    candidates.iter().map(PathBuf::from).find(|p| p.is_file())
}

/// Full environment as produced by vcvars64.bat, captured ONCE per process
/// (~1 s) and cached — calling vcvars on every Run click cost ~1.4 s each.
static VCVARS_ENV: OnceLock<Result<HashMap<String, String>, String>> = OnceLock::new();

pub fn vcvars_env() -> Result<&'static HashMap<String, String>, String> {
    let slot = VCVARS_ENV.get_or_init(|| {
        let vc = vcvars_path().ok_or_else(|| "vcvars64.bat not found".to_string())?;
        let out = Command::new("cmd")
            .arg("/C")
            .raw_arg(format!("call \"{}\" >nul 2>&1 && set", vc.display()))
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err("vcvars64.bat failed".into());
        }
        let mut env = HashMap::new();
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if let Some((name, value)) = line.split_once('=') {
                if !name.is_empty() {
                    env.insert(name.to_string(), value.to_string());
                }
            }
        }
        if env.is_empty() {
            return Err("vcvars env capture produced nothing".into());
        }
        Ok(env)
    });
    slot.as_ref().map_err(Clone::clone)
}

pub fn clang_command() -> Result<Command, String> {
    let mut cmd = Command::new(clang_path()?);
    if let Ok(env) = vcvars_env() {
        cmd.env_clear().envs(env);
    }
    Ok(cmd)
}

/// Repo-relative include dir vendored headers (stage.h, fenster.h).
fn vendor_include_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("third_party")
        .join("include")
}

/// Run `clang -fsyntax-only` over `src`; returns raw compiler stderr.
/// The source is staged as `main.c` so diagnostics reference a stable stem.
pub fn syntax_check_stderr(src: &str) -> Result<String, String> {
    syntax_check_stderr_lang(src, crate::Lang::C)
}

/// Language-aware variant: C++ sources stage as `main.cpp` so the clang
/// driver compiles/links as C++ and diagnostics reference the right stem.
pub fn syntax_check_stderr_lang(src: &str, lang: crate::Lang) -> Result<String, String> {
    let dir = std::env::temp_dir().join("blockide-syntax");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let cpath = dir.join(match lang {
        crate::Lang::C => "main.c",
        crate::Lang::Cpp => "main.cpp",
    });
    std::fs::write(&cpath, src).map_err(|e| e.to_string())?;
    let out = clang_command()?
        .arg("-O0")
        .arg("-fno-color-diagnostics")
        .arg("-fsyntax-only")
        .arg(format!("-I{}", vendor_include_dir().display()))
        .arg(&cpath)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stderr).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires local clang + MSVC env; exercised by diag_map_validator gate"]
    fn finds_clang() {
        assert!(clang_path().is_ok());
    }
}
