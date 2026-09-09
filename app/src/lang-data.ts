import type { SourceLang } from './palette'

type Lang = SourceLang

const SAMPLE = `#include <stdio.h>

int main(void) {
    printf("hello\\n");
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total = total + i;
    }
    return 0;
}
`

const NEW_TEMPLATE = `#include <stdio.h>

int main(void) {
    printf("hi\\n");
    return 0;
}
`

/** C++ mirror of SAMPLE — same statement shape (total/for/return) so the
 *  scripted gate assertions hold for either launch language. */
const CPP_SAMPLE = `#include <iostream>

int main() {
    std::cout << "hello\\n";
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total = total + i;
    }
    std::cout << total << "\\n";
    return 0;
}
`

const CPP_TEMPLATE = `#include <iostream>

int main() {
    std::cout << "hi\\n";
    return 0;
}
`

export const SAMPLES: Record<Lang, string> = {
  c: SAMPLE,
  cpp: CPP_SAMPLE,
  python: `print("hello")

total = 0
for i in range(5):
    total = total + i

print(total)
`,
  javascript: `let total = 0;

for (let i = 0; i < 5; i++) {
    total = total + i;
}

console.log("hello");
console.log(total);
`,
  rust: `fn main() {
    let mut total = 0;

    for i in 0..5 {
        total = total + i;
    }

    println!("hello");
    println!("{}", total);
}
`,
  go: `package main

import "fmt"

func main() {
    total := 0
    for i := 0; i < 5; i++ {
        total = total + i
    }

    fmt.Println("hello")
    fmt.Println(total)
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        int total = 0;
        for (int i = 0; i < 5; i++) {
            total = total + i;
        }
        System.out.println("hello");
        System.out.println(total);
    }
}
`,
  typescript: `let total = 0;

for (let i = 0; i < 5; i++) {
    total = total + i;
}

console.log("hello");
console.log(total);
`,
}

export const NEW_TEMPLATES: Record<Lang, string> = {
  c: NEW_TEMPLATE,
  cpp: CPP_TEMPLATE,
  python: `def main():
    print("hi")


main()
`,
  javascript: `function main() {
    console.log("hi");
}

main();
`,
  rust: `fn main() {
    println!("hi");
}
`,
  go: `package main

import "fmt"

func main() {
    fmt.Println("hi")
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("hi");
    }
}
`,
  typescript: `function main() {
    console.log("hi");
}

main();
`,
}
