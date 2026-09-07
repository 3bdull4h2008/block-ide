//! Map compiler diagnostics (line:col) onto canonical tree nodes.
//! PLAN.md step 2.4 — every diagnostic must reach a nodeId (Golden Rule 5).

use crate::canonical::{CNode, CTree};

#[derive(Debug, Clone)]
pub struct RawDiag {
    pub line: u32,
    pub col: u32,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct MappedDiag {
    pub line: u32,
    pub col: u32,
    pub severity: String,
    pub message: String,
    pub offset: usize,
    pub node_id: u32,
    pub node_kind: String,
}

pub fn line_col_to_offset(src: &str, line: u32, col: u32) -> Option<usize> {
    if line == 0 || col == 0 {
        return None;
    }
    let mut cur_line = 1u32;
    let mut offset = 0usize;
    for l in src.split_inclusive('\n') {
        if cur_line == line {
            let bytes = l.as_bytes();
            // clang cols are 1-based; a col at end-of-line (missing token)
            // maps to the newline position itself.
            let idx = (col as usize - 1).min(bytes.len());
            return Some(offset + idx);
        }
        offset += l.len();
        cur_line += 1;
    }
    // line beyond EOF: clamp to end
    if cur_line == line {
        return Some(offset);
    }
    None
}

/// Deepest node containing `off`, preferring non-missing leaves' parents for
/// zero-width missing tokens (a missing ';' at offset X belongs to its parent
/// statement, not the empty token itself). Diagnostics aimed past the last
/// token (e.g. "expected '}'" at EOF) contain nothing, so we back up one byte
/// onto the nearest preceding subtree instead of surfacing the invisible root.
pub fn map_offset(tree: &CTree, off: usize) -> (u32, String) {
    let mut o = off;
    loop {
        let (id, kind) = climb(&tree.root, o);
        if id != tree.root.id || o == 0 {
            return (id, kind);
        }
        o -= 1;
    }
}

fn climb(root: &CNode, off: usize) -> (u32, String) {
    fn rec(n: &CNode, off: usize) -> Option<(u32, &CNode)> {
        let contained =
            n.start <= off && (off < n.end || (n.start == off && n.end == off));
        if !contained {
            return None;
        }
        for c in &n.children {
            if let Some(found) = rec(c, off) {
                return Some(found);
            }
        }
        if n.missing && n.text.as_deref() == Some("") {
            return None; // skip zero-width missing nodes
        }
        Some((n.id, n))
    }
    match rec(root, off) {
        Some((id, n)) => (id, n.kind.clone()),
        None => (root.id, root.kind.clone()),
    }
}

/// Parse clang GNU-style diagnostic lines: `<path>/main.c:line:col: severity:
/// message`. One owner for this format (app `diag_c`, validators). Clang
/// echoes whatever path it was handed (often absolute), so we anchor on the
/// `main.c:` suffix anywhere in the line instead of a prefix strip.
/// Non-diagnostic lines are dropped; `note` lines are kept so callers can
/// choose (map_diags filters them).
pub fn parse_clang_diags(stderr: &str, file_stem: &str) -> Vec<RawDiag> {
    let needle = format!("{file_stem}:");
    stderr
        .lines()
        .filter_map(|l| {
            let rest = if l.starts_with(&needle) {
                &l[needle.len()..]
            } else {
                let i = l.find(&needle)?;
                &l[i + needle.len()..]
            };
            let mut it = rest.splitn(4, ':');
            let line_no: u32 = it.next()?.trim().parse().ok()?;
            let col: u32 = it.next()?.trim().parse().ok()?;
            let severity = it.next()?.trim().to_string();
            let message = it.next()?.trim().to_string();
            match severity.as_str() {
                "error" | "warning" | "note" | "fatal error" => {}
                _ => return None,
            }
            Some(RawDiag {
                line: line_no,
                col,
                severity,
                message,
            })
        })
        .collect()
}

/// Parse lightweight diagnostic stderr from Python, Node, or rustc.
///
/// Each tool emits a slightly different format, but all share a common
/// `filename:line:col…` prefix that we extract. Unrecognised lines are
/// skipped so stray notes / stack frames don't produce garbage entries.
///
/// Patterns handled:
///   Python  – `  File "main.py", line 3`  +  following `SyntaxError: …`
///   Node    – `main.js:3` … then an error message line
///   rustc   – `main.rs:3:5: error[E0308]: …`  (--error-format=short)
pub fn parse_simple_diags(stderr: &str, file_stem: &str) -> Vec<RawDiag> {
    let mut out = Vec::new();
    let lines: Vec<&str> = stderr.lines().collect();
    let needle = format!("{file_stem}:");

    // --- try rustc short format first: `main.rs:L:C: severity: msg` ---
    for line in &lines {
        if let Some(rest) = strip_after_needle(line, &needle) {
            if let Some(d) = parse_colon_diag(rest) {
                out.push(d);
            }
        }
    }
    if !out.is_empty() {
        return out;
    }

    // --- Python: `  File "main.py", line N` followed by a message ---
    let py_file = format!("\"{}\"", file_stem);
    let mut i = 0;
    while i < lines.len() {
        let l = lines[i].trim();
        if l.starts_with("File ") && l.contains(&py_file) {
            // extract line number from `File "main.py", line 3`
            if let Some(line_no) = l.rsplit("line ").next().and_then(|s| {
                s.trim().trim_end_matches(',').parse::<u32>().ok()
            }) {
                // scan forward for the error message (usually 2-3 lines down)
                let mut msg = String::new();
                for j in (i + 1)..lines.len().min(i + 5) {
                    let candidate = lines[j].trim();
                    if candidate.contains("Error") || candidate.contains("error") {
                        msg = candidate.to_string();
                        break;
                    }
                }
                if msg.is_empty() && i + 1 < lines.len() {
                    msg = lines[lines.len() - 1].trim().to_string();
                }
                if !msg.is_empty() {
                    out.push(RawDiag { line: line_no, col: 1, severity: "error".into(), message: msg });
                }
            }
        }
        i += 1;
    }
    if !out.is_empty() {
        return out;
    }

    // --- Node: `main.js:LINE`  … error on a nearby line ---
    for (i, line) in lines.iter().enumerate() {
        if let Some(rest) = strip_after_needle(line, &needle) {
            if let Some(line_no) = rest.split(|c: char| !c.is_ascii_digit()).next()
                .and_then(|s| s.parse::<u32>().ok())
            {
                // scan for "SyntaxError:" in nearby lines
                let mut msg = String::new();
                for j in i..lines.len().min(i + 6) {
                    if let Some(pos) = lines[j].find("SyntaxError:") {
                        msg = lines[j][pos..].to_string();
                        break;
                    }
                }
                if msg.is_empty() {
                    // last line often has the error
                    if let Some(last) = lines.last() {
                        let t = last.trim();
                        if t.contains("Error") {
                            msg = t.to_string();
                        }
                    }
                }
                if !msg.is_empty() {
                    out.push(RawDiag { line: line_no, col: 1, severity: "error".into(), message: msg });
                }
            }
        }
    }

    out
}

/// Strip everything up to and including `needle` in `line`.
fn strip_after_needle<'a>(line: &'a str, needle: &str) -> Option<&'a str> {
    line.find(needle).map(|i| &line[i + needle.len()..])
}

/// Parse `line:col: severity: message` from the remainder after the filename.
fn parse_colon_diag(rest: &str) -> Option<RawDiag> {
    let mut it = rest.splitn(4, ':');
    let line_no: u32 = it.next()?.trim().parse().ok()?;
    let col: u32 = it.next()?.trim().parse().ok()?;
    let severity_raw = it.next()?.trim().to_string();
    let message = it.next()?.trim().to_string();
    // normalise rustc `error[E0308]` → `error`
    let severity = severity_raw.split('[').next().unwrap_or(&severity_raw).trim().to_string();
    match severity.as_str() {
        "error" | "warning" | "note" | "fatal error" | "help" => {}
        _ => return None,
    }
    Some(RawDiag { line: line_no, col, severity, message })
}

pub fn map_diags(src: &str, tree: &CTree, diags: &[RawDiag]) -> Vec<MappedDiag> {
    diags
        .iter()
        .filter(|d| d.severity != "note")
        .filter_map(|d| {
            let offset = line_col_to_offset(src, d.line, d.col)?;
            let (node_id, node_kind) = map_offset(tree, offset);
            Some(MappedDiag {
                line: d.line,
                col: d.col,
                severity: d.severity.clone(),
                message: d.message.clone(),
                offset,
                node_id,
                node_kind,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse_canonical;

    const SRC: &str = "int main(void) {\n    return 0\n}\n";

    #[test]
    fn offsets_resolve() {
        assert_eq!(line_col_to_offset(SRC, 1, 1), Some(0));
        assert_eq!(line_col_to_offset(SRC, 2, 5), Some(21));
        assert_eq!(line_col_to_offset("abc", 1, 10), Some(3), "clamps to EOL");
        assert_eq!(line_col_to_offset("abc", 9, 1), None);
    }

    #[test]
    fn missing_semicolon_maps_to_parent_statement() {
        let tree = parse_canonical(SRC).unwrap();
        // clang reports the missing ';' at end of "return 0" line
        let (id, kind) = map_offset(
            &tree,
            line_col_to_offset(SRC, 2, 13).expect("offset"),
        );
        assert_ne!(kind, ";", "must not map to the zero-width token");
        assert!(
            kind == "return_statement" || kind == "compound_statement",
            "got {kind}"
        );
        let _ = id;
    }

    #[test]
    fn clang_stderr_parses() {
        let stderr = "\
C:\\Users\\dev\\AppData\\Local\\Temp\\blockide-syntax\\main.c:2:13: error: expected ';' after return statement
some unrelated linker noise
main.c:3:5: warning: unused variable 'q' [-Wunused-variable]
main.c:3:5: note: declared here
  2 |     return 0
";
        let diags = parse_clang_diags(stderr, "main.c");
        assert_eq!(diags.len(), 3, "noise + caret lines skipped: {diags:?}");
        assert_eq!(diags[0].severity, "error");
        assert_eq!(diags[0].line, 2);
        assert_eq!(diags[0].col, 13);
        assert_eq!(diags[1].severity, "warning");
        assert_eq!(diags[2].severity, "note");
    }

    #[test]
    fn eof_diag_backtracks_to_nearest_subtree() {
        let src = "int main(void) {\n    if (1) {\n        return 0;\n}\n";
        let tree = parse_canonical(src).unwrap();
        // clang puts "expected '}'" one past the final byte
        let (id, kind) = map_offset(&tree, src.len());
        assert_ne!(kind, "translation_unit", "must not surface root");
        assert_ne!(id, tree.root.id);
        let _ = id;
    }

    #[test]
    fn full_mapping_end_to_end() {
        let tree = parse_canonical(SRC).unwrap();
        let raws = vec![RawDiag {
            line: 2,
            col: 13,
            severity: "error".into(),
            message: "expected ';' after return statement".into(),
        }];
        let mapped = map_diags(SRC, &tree, &raws);
        assert_eq!(mapped.len(), 1);
        assert!(mapped[0].node_kind != ";");
    }
}
