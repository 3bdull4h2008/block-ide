#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1 || n < 1) return 1;
    int s = 0;
    for (int i = 2; i <= n; i += 2) s += i;
    printf("%d\n", s);
    return 0;
}
