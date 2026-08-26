//! Canonical emission: CTree → token reflow → clang-format.
//! PLAN.md step 0.4. Output is deterministic for a given style file;
//! double-emission MUST be byte-stable (gate G-CANON-IDEMPOTENT).

use crate::canonical::{CNode, CTree};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::os::windows::process::CommandExt;

/// Locate a usable clang-format.exe. Order: env override → PATH → known dirs.
pub fn detect_clang_format() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("BLOCKIDE_CLANG_FORMAT") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    for name in ["clang-format.exe", "clang-format"] {
        if which_exists(name) {
            return Some(PathBuf::from(name));
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(llvm) = home_llvm() {
        candidates.push(llvm.join("bin").join("clang-format.exe"));
    }
    candidates.push(PathBuf::from(
        r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\Llvm\x64\bin\clang-format.exe",
    ));
    candidates.into_iter().find(|p| p.is_file())
}

fn home_llvm() -> Option<PathBuf> {
    std::env::var("ProgramFiles")
        .ok()
        .map(|pf| PathBuf::from(pf).join("LLVM"))
}

fn which_exists(name: &str) -> bool {
    Command::new(name)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .status()
        .is_ok()
}

/// Style file lives at repo root (two levels above this crate).
fn style_arg() -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join(".clang-format");
    format!("--style=file:{}", root.display())
}

pub fn clang_format(code: &str) -> Result<String, String> {
    let exe = detect_clang_format().ok_or("clang-format.exe not found")?;
    let mut child = Command::new(exe)
        .arg(style_arg())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| e.to_string())?;
    // Write stdin from a helper thread: for documents whose formatted output
    // exceeds the ~64 KB pipe buffer, the child blocks writing stdout while
    // we block writing stdin — a deadlock. Draining happens in
    // wait_with_output, so the writer must run concurrently (and closing our
    // stdin handle afterwards is what signals EOF to the child).
    let mut stdin = child.stdin.take().ok_or("stdin unavailable")?;
    let payload = code.as_bytes().to_vec();
    let writer =
        std::thread::spawn(move || -> std::io::Result<()> {
            use std::io::Write;
            stdin.write_all(&payload)?;
            Ok(())
        });
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    let write_result = writer
        .join()
        .map_err(|_| "stdin writer panicked".to_string())
        .and_then(|r| r.map_err(|e| e.to_string()));
    if let Err(e) = write_result {
        return Err(e);
    }
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn concat_leaves(n: &CNode, out: &mut String) {
    out.push_str(&n.pre);
    if let Some(t) = &n.text {
        out.push_str(t);
        return;
    }
    for c in &n.children {
        concat_leaves(c, out);
    }
}

fn is_stringy(kind: &str) -> bool {
    kind == "string_literal" || kind == "char_literal" || kind == "system_lib_string"
}

fn collect_tokens(n: &CNode, out: &mut Vec<String>) {
    if n.kind == "comment" {
        return;
    }
    if is_stringy(&n.kind) {
        let mut s = String::new();
        concat_leaves(n, &mut s);
        out.push(s);
        return;
    }
    if let Some(t) = &n.text {
        let t = t.trim();
        if !t.is_empty() {
            out.push(t.to_string());
        }
        return;
    }
    let is_preproc = n.kind.starts_with("preproc");
    for c in &n.children {
        collect_tokens(c, out);
    }
    if is_preproc {
        out.push("\n".to_string());
    }
}

/// One-token-per-space reflow with forced newlines after `;`, `{`,
/// preprocessor lines, and before `}` — enough structure for clang-format
/// to normalize deterministically.
pub fn reflow(ctree: &CTree) -> String {
    let mut tokens = Vec::new();
    collect_tokens(&ctree.root, &mut tokens);
    let mut out = String::new();
    let mut indent = 0usize;
    let mut need_space = false;
    for t in tokens {
        if t == "\n" {
            out.push('\n');
            need_space = false;
            continue;
        }
        match t.as_str() {
            "{" => {
                out.push_str(" {\n");
                indent += 1;
                need_space = false;
            }
            "}" => {
                indent = indent.saturating_sub(1);
                out.push('\n');
                out.push_str(&"    ".repeat(indent));
                out.push('}');
                need_space = false;
            }
            ";" => {
                out.push_str(";\n");
                need_space = false;
            }
            _ => {
                if need_space {
                    out.push(' ');
                }
                out.push_str(&t);
                need_space = true;
            }
        }
        if out.ends_with('\n') {
            out.push_str(&"    ".repeat(indent));
        }
    }
    out
}

/// Full canonical pipeline: parse → reflow → clang-format.
pub fn canonical_source(src: &str) -> Result<String, String> {
    canonical_source_lang(src, crate::Lang::C)
}

/// Language-aware variant (C++ subset pack, D3 amendment). clang-format is
/// language-agnostic here (style-file driven), so only parsing differs.
pub fn canonical_source_lang(src: &str, lang: crate::Lang) -> Result<String, String> {
    let ct = crate::parse_canonical_lang(src, lang).ok_or("grammar failed to load")?;
    let raw = reflow(&ct);
    clang_format(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_idempotent(src: &str) {
        let once = canonical_source(src).expect("pipeline");
        let twice = canonical_source(&once).expect("pipeline 2");
        assert_eq!(once, twice, "double-emission diverged");
    }

    #[test]
    fn detects_clang_format() {
        assert!(detect_clang_format().is_some(), "no clang-format found");
    }

    #[test]
    fn idempotent_clean_hello() {
        assert_idempotent(
            "#include <stdio.h>\n\nint main(void) {\n    printf(\"hi\\n\");\n    return 0;\n}\n",
        );
    }

    #[test]
    fn idempotent_mangled_input_matches_clean_input() {
        let mangled = "#include<stdio.h>\nint   main(void){printf(\"hi\\n\");return 0;}\n";
        let clean = "#include <stdio.h>\n\nint main(void) {\n    printf(\"hi\\n\");\n    return 0;\n}\n";
        assert_eq!(
            canonical_source(mangled).unwrap(),
            canonical_source(clean).unwrap(),
            "mangling survived canonicalization"
        );
    }

    #[test]
    fn string_literals_survive_canonicalization() {
        let out = canonical_source(
            "#include <stdio.h>\nint main(void){printf(\"%d\\n\\t x\", i);return 0;}\n",
        )
        .unwrap();
        assert!(
            out.contains("\"%d\\n\\t x\""),
            "string literal corrupted: {out}"
        );
    }

    #[test]
    fn preproc_lines_stay_isolated() {
        let out = canonical_source("#include <stdio.h>\n#include <stdlib.h>\nint x;\n").unwrap();
        assert!(out.contains("#include <stdio.h>\n"), "got: {out}");
        assert!(out.contains("#include <stdlib.h>\n"), "got: {out}");
    }
}
