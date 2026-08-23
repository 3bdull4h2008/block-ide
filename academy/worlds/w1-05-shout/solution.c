#include <stdio.h>

int main(void) {
    char w[64];
    if (scanf("%63s", w) != 1) return 1;
    printf("%s!\n", w);
    return 0;
}
