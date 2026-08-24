//! Canonical node model: stable-id projection of the tree-sitter CST.
//! PLAN.md step 0.2 — the single shape the block renderer consumes.

use std::fmt::Write as _;
use tree_sitter::Tree;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CNode {
    /// Stable synthetic id assigned in document (pre-)order.
    pub id: u32,
    pub kind: String,
    /// Tree-sitter field name relative to the parent (e.g. `body`, `declarator`).
    pub field: Option<String>,
    pub named: bool,
    /// Zero-width node inserted by the parser's error recovery (e.g. missing ';').
    pub missing: bool,
    pub start: usize,
    pub end: usize,
    /// Source bytes skipped immediately before this node (whitespace etc.).
    pub pre: String,
    /// Token text for leaves; None when the node has children.
    pub text: Option<String>,
    pub children: Vec<CNode>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CTree {
    pub root: CNode,
    /// Source bytes after the root node ends (trailing whitespace).
    pub tail: String,
}

impl CTree {
    /// Debug S-expression: `(kind [field:]child...)`, leaves render their text.
    pub fn to_sexp(&self) -> String {
        let mut s = String::new();
        rec_sexp(&self.root, &mut s);
        s
    }

    /// Lossless emission: pre-gaps + leaf text + tail reproduce the input.
    pub fn emit_verbatim(&self) -> String {
        let mut s = String::new();
        rec_emit(&self.root, &mut s);
        s.push_str(&self.tail);
        s
    }
}

fn rec_sexp(node: &CNode, out: &mut String) {
    match (&node.text, node.children.is_empty()) {
        (Some(t), _) => {
            let _ = write!(out, "({} {:?})", node.kind, t);
        }
        (None, true) => {
            let _ = write!(out, "({})", node.kind);
        }
        (None, false) => {
            out.push('(');
            out.push_str(&node.kind);
            for c in &node.children {
                out.push(' ');
                if let Some(f) = &c.field {
                    let _ = write!(out, "{}:", f);
                }
                rec_sexp(c, out);
            }
            out.push(')');
        }
    }
}

fn rec_emit(node: &CNode, out: &mut String) {
    out.push_str(&node.pre);
    if let Some(t) = &node.text {
        out.push_str(t);
        return;
    }
    for c in &node.children {
        rec_emit(c, out);
    }
}

/// Build the canonical tree. Ids increase in document order starting at 0.
pub fn canonicalize(tree: &Tree, src: &str) -> CTree {
    struct St {
        next_id: u32,
    }
    fn build(
        node: tree_sitter::Node,
        field: Option<&str>,
        src: &str,
        cursor_pos: &mut usize,
        st: &mut St,
    ) -> CNode {
        let start = node.start_byte();
        let my_id = st.next_id;
        st.next_id += 1;
        let mut inner_pos = *cursor_pos;
        let mut children = Vec::new();
        for i in 0..node.child_count() {
            if let Some(c) = node.child(i as u32) {
                let f = node.field_name_for_child(i as u32);
                children.push(build(c, f, src, &mut inner_pos, st));
            }
        }
        let (pre, text) = if children.is_empty() {
            let gap = src[inner_pos..start].to_string();
            *cursor_pos = node.end_byte();
            (gap, Some(src[node.byte_range()].to_string()))
        } else {
            *cursor_pos = inner_pos;
            (String::new(), None)
        };
        let me = CNode {
            id: my_id,
            kind: node.kind().to_string(),
            field: field.map(str::to_string),
            named: node.is_named(),
            missing: node.is_missing(),
            start,
            end: node.end_byte(),
            pre,
            text,
            children,
        };
        me
    }

    let root_node = tree.root_node();
    let mut pos = 0usize;
    let root = build(
        root_node,
        None,
        src,
        &mut pos,
        &mut St { next_id: 0 },
    );
    let tail = src[pos..].to_string();
    CTree { root, tail }
}

/// Convenience: parse then canonicalize in one call.
pub fn parse_canonical(src: &str) -> Option<CTree> {
    parse_canonical_lang(src, crate::Lang::C)
}

/// Language-aware variant (C++ subset pack, D3 amendment).
pub fn parse_canonical_lang(src: &str, lang: crate::Lang) -> Option<CTree> {
    let tree = crate::parse_c_lang(src, lang)?;
    Some(canonicalize(&tree, src))
}

/// Error detection directly on a canonical tree.
pub fn ctree_has_errors(tree: &CTree) -> bool {
    fn rec(n: &CNode) -> bool {
        n.kind == "ERROR" || n.missing || n.children.iter().any(|c| rec(c))
    }
    rec(&tree.root)
}

#[cfg(test)]
mod cpp_tests {
    use super::*;

    const CPP: &str = r#"#include <iostream>

class Greeter {
public:
    void greet(int times) {
        for (int i = 0; i < times; i++) {
            std::cout << "hi\n";
        }
    }
};

int main() {
    Greeter g;
    g.greet(2);
    return 0;
}
"#;

    #[test]
    fn cpp_parses_clean_with_dense_ids() {
        let ct = crate::parse_canonical_lang(CPP, crate::Lang::Cpp).expect("cpp parse");
        assert!(!ctree_has_errors(&ct));
        let mut ids = Vec::new();
        fn walk(n: &CNode, ids: &mut Vec<u32>) {
            ids.push(n.id);
            for c in &n.children {
                walk(c, ids);
            }
        }
        walk(&ct.root, &mut ids);
        assert_eq!(ids, (0..ids.len() as u32).collect::<Vec<_>>());
        // the class renders as a container (compound found)
        fn find<'a>(n: &'a CNode, kind: &str) -> Option<&'a CNode> {
            if n.kind == kind {
                return Some(n);
            }
            n.children.iter().find_map(|c| find(c, kind))
        }
        assert!(find(&ct.root, "class_specifier").is_some());
    }

    #[test]
    fn cpp_language_flag_selects_cpp_grammar() {
        // the language must ride with the file, not be guessed
        let cpp = crate::parse_canonical_lang("class X {};", crate::Lang::Cpp).expect("cpp");
        assert!(!ctree_has_errors(&cpp));
        let as_c = crate::parse_canonical_lang("class X {};", crate::Lang::C).expect("c");
        let cpp_kinds = format!("{:?}", cpp.root);
        // only the C++ grammar produces a class_specifier node
        assert!(cpp_kinds.contains("class_specifier"));
        assert!(!format!("{:?}", as_c.root).contains("class_specifier"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HELLO: &str = r#"#include <stdio.h>

/* adds two ints */
int add(int a, int b) {
    return a + b;
}
"#;

    #[test]
    fn canonical_roundtrip_is_lossless() {
        for src in [HELLO, "int x;\n", "\n\n  // only a comment\n"] {
            let ct = parse_canonical(src).unwrap();
            assert_eq!(ct.emit_verbatim(), src);
        }
    }

    #[test]
    fn ids_are_preorder_and_dense() {
        let ct = parse_canonical(HELLO).unwrap();
        let mut ids = Vec::new();
        fn walk(n: &CNode, ids: &mut Vec<u32>) {
            ids.push(n.id);
            for c in &n.children {
                walk(c, ids);
            }
        }
        walk(&ct.root, &mut ids);
        assert_eq!(ids, (0..ids.len() as u32).collect::<Vec<_>>());
    }

    #[test]
    fn fields_are_captured() {
        let ct = parse_canonical(HELLO).unwrap();
        let sexp = ct.to_sexp();
        assert!(sexp.contains("body:"), "function body field missing");
        assert!(sexp.contains("declarator:"), "declarator field missing");
    }

    #[test]
    fn detects_missing_semicolon_flag() {
        let broken = "int main(void) {\n    return 0\n}\n";
        let ct = parse_canonical(broken).unwrap();
        assert!(
            ctree_has_errors(&ct),
            "missing ';' must surface via the missing flag"
        );
        let clean = "int main(void) {\n    return 0;\n}\n";
        assert!(!ctree_has_errors(&parse_canonical(clean).unwrap()));
    }

    #[test]
    fn golden_sexp_tiny_program() {
        let ct = parse_canonical("int x;\n").unwrap();
        let sexp = ct.to_sexp();
        assert!(
            sexp.starts_with("(translation_unit (declaration type:(primitive_type \"int\") declarator:(identifier \"x\") (; \";\")))"),
            "unexpected shape: {sexp}"
        );
    }
}
