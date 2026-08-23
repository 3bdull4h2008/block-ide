#include <stdio.h>

int main(void) {
    int s;
    if (scanf("%d", &s) != 1) return 1;
    if (s >= 90) printf("A\n");
    else if (s >= 80) printf("B\n");
    else if (s >= 70) printf("C\n");
    else printf("F\n");
    return 0;
}
