#include <stdio.h>

int main(void) {
    char name[64];
    if (scanf("%63s", name) != 1) return 1;
    printf("hi %s\n", name);
    return 0;
}
