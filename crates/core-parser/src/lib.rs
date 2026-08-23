//! core-parser: canonical text ⇄ AST ⇄ blocks pipeline for C.
//!
//! Rule 2 (PLAN.md): one parser, pinned — tree-sitter-c.
//! This crate owns: parsing, error detection, S-expression debug rendering,
//! and verbatim CST emission.

use tree_sitter::{Parser, Tree};

pub mod canonical;
pub mod diagmap;
pub mod emitter;
pub mod toolchain;
pub use canonical::{
    canonicalize, ctree_has_errors, parse_canonical, CNode, CTree,
};
pub use diagmap::{
    map_diags, map_offset, parse_clang_diags, MappedDiag, RawDiag,
};
pub use emitter::{canonical_source, clang_format, reflow};

/// Parse C source. Returns None only if the grammar failed to load.
pub fn parse_c(src: &str) -> Option<Tree> {
    let mut parser = Parser::new();
    parser.set_language(&tree_sitter_c::LANGUAGE.into()).ok()?;
    parser.parse(src, None)
}

/// True if the tree contains ERROR or MISSING nodes.
pub fn has_errors(tree: &Tree) -> bool {
    fn rec(node: tree_sitter::Node) -> bool {
        if node.is_error() || node.is_missing() {
            return true;
        }
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i as u32) {
                if rec(child) {
                    return true;
                }
            }
        }
        false
    }
    rec(tree.root_node())
}

/// Debug S-expression of the full CST (includes anonymous tokens).
pub fn to_sexp(tree: &Tree, src: &str) -> String {
    fn rec(node: tree_sitter::Node, src: &str, out: &mut String) {
        if node.child_count() == 0 {
            out.push_str(&format!("{:?}", src[node.byte_range()].to_string()));
            return;
        }
        out.push('(');
        out.push_str(node.kind());
        for i in 0..node.child_count() {
            out.push(' ');
            rec(node.child(i as u32).unwrap(), src, out);
        }
        out.push(')');
    }
    let mut s = String::new();
    rec(tree.root_node(), src, &mut s);
    s
}

/// Verbatim CST emission: reconstructs source bytes exactly from the tree.
/// Leaf ranges are collected in order; inter-token gaps (whitespace) are
/// stitched from the source so output is byte-identical. Canonical
/// clang-format normalization lands in step 0.4.
pub fn emit_verbatim(tree: &Tree, src: &str) -> String {
    fn leaves(node: tree_sitter::Node, ranges: &mut Vec<std::ops::Range<usize>>) {
        if node.child_count() == 0 {
            ranges.push(node.byte_range());
            return;
        }
        for i in 0..node.child_count() {
            leaves(node.child(i as u32).unwrap(), ranges);
        }
    }
    let mut ranges = Vec::new();
    leaves(tree.root_node(), &mut ranges);
    let mut out = String::new();
    let mut pos = 0usize;
    let bytes = src.as_bytes();
    for r in &ranges {
        out.push_str(&String::from_utf8_lossy(&bytes[pos..r.start]));
        out.push_str(&src[r.clone()]);
        pos = r.end;
    }
    out.push_str(&String::from_utf8_lossy(&bytes[pos..]));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const HELLO: &str = r#"#include <stdio.h>

int main(void) {
    printf("hello\n");
    return 0;
}
"#;

    #[test]
    fn parses_clean_hello() {
        let tree = parse_c(HELLO).expect("grammar load");
        assert_eq!(tree.root_node().kind(), "translation_unit");
        assert!(!has_errors(&tree), "unexpected errors in clean source");
    }

    #[test]
    fn verbatim_roundtrip_is_lossless() {
        let tree = parse_c(HELLO).unwrap();
        assert_eq!(emit_verbatim(&tree, HELLO), HELLO);
    }

    #[test]
    fn sexp_contains_root_and_comment_nodes() {
        let src = "// lead comment\nint x;\n";
        let tree = parse_c(src).unwrap();
        let sexp = to_sexp(&tree, src);
        assert!(sexp.starts_with("(translation_unit"));
        assert!(sexp.contains("comment"));
    }

    #[test]
    fn detects_error_nodes() {
        let src = "int main( { }";
        let tree = parse_c(src).unwrap();
        assert!(has_errors(&tree));
    }
}
