#include <stdio.h>

static long long power(int base, int exp) {
    long long r = 1;
    for (int i = 0; i < exp; i++) r *= base;
    return r;
}

int main(void) {
    int b, e;
    if (scanf("%d %d", &b, &e) != 2) return 1;
    printf("%lld\n", power(b, e));
    return 0;
}
