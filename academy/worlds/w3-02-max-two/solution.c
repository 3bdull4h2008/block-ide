#include <stdio.h>

int main(void) {
    int a, b;
    if (scanf("%d %d", &a, &b) != 2) return 1;
    if (a >= b) printf("%d\n", a);
    else printf("%d\n", b);
    return 0;
}
