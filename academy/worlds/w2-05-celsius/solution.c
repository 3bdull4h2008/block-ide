#include <stdio.h>

int main(void) {
    int c;
    if (scanf("%d", &c) != 1) return 1;
    printf("%d\n", c * 9 / 5 + 32);
    return 0;
}
