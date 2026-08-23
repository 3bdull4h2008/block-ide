#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    if (n > 0) printf("positive\n");
    else if (n < 0) printf("negative\n");
    else printf("zero\n");
    return 0;
}
