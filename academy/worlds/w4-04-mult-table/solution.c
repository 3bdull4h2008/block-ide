#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1 || n < 1) return 1;
    for (int i = 1; i <= n; i++) printf("%d x %d = %d\n", i, n, i * n);
    return 0;
}
