//! Prints {tree, hasErrors} JSON for C/C++ source given on stdin.
//! Bridge for headless E2E tests of the frontend block model.
//! Language: argv[1] == "cpp" selects tree-sitter-cpp (default C).

use std::io::Read;

fn main() {
    let lang = core_parser::Lang::from_opt(std::env::args().nth(1).as_deref());
    let mut src = String::new();
    std::io::stdin().read_to_string(&mut src).expect("read stdin");
    let tree = match core_parser::parse_canonical_lang(&src, lang) {
        Some(t) => t,
        None => {
            eprintln!("grammar failed");
            std::process::exit(2);
        }
    };
    let out = serde_json::json!({
        "tree": tree,
        "has_errors": core_parser::ctree_has_errors(&tree),
    });
    println!("{}", serde_json::to_string(&out).unwrap());
}
