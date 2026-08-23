#include <stdio.h>

static int area(int w, int h) { return w * h; }

int main(void) {
    int w, h;
    if (scanf("%d %d", &w, &h) != 2) return 1;
    printf("%d\n", area(w, h));
    return 0;
}
