//! Canonicalizes C source from stdin, prints result to stdout.

use std::io::Read;

fn main() {
    let mut src = String::new();
    std::io::stdin().read_to_string(&mut src).expect("read stdin");
    match core_parser::canonical_source(&src) {
        Ok(s) => print!("{}", s),
        Err(e) => {
            eprintln!("error: {}", e);
            std::process::exit(1);
        }
    }
}
