#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1 || n < 1) return 1;
    for (int i = 1; i <= n; i++) {
        for (int s = 0; s < n - i; s++) printf(" ");
        for (int k = 0; k < 2 * i - 1; k++) printf("*");
        printf("\n");
    }
    return 0;
}
