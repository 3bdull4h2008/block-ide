#include <stdio.h>

int main(void) {
    int y;
    if (scanf("%d", &y) != 1) return 1;
    int leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    if (leap) printf("leap\n");
    else printf("common\n");
    return 0;
}
