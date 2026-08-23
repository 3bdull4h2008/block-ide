//! Prints {tree, hasErrors} JSON for C source given on stdin.
//! Bridge for headless E2E tests of the frontend block model.

use std::io::Read;

fn main() {
    let mut src = String::new();
    std::io::stdin().read_to_string(&mut src).expect("read stdin");
    let tree = match core_parser::parse_canonical(&src) {
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
