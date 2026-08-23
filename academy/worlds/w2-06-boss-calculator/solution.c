#include <stdio.h>

int main(void) {
    int a, b;
    char op;
    if (scanf("%d %c %d", &a, &op, &b) != 3) return 1;
    int r = 0;
    if (op == '+') r = a + b;
    else if (op == '-') r = a - b;
    else if (op == '*') r = a * b;
    else return 2;
    printf("%d\n", r);
    return 0;
}
