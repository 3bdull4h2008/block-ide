#include <stdio.h>
#include <stdlib.h>

typedef struct { int x, y; } Point;

static int manhattan(Point a, Point b) {
    return abs(a.x - b.x) + abs(a.y - b.y);
}

int main(void) {
    Point p, q;
    if (scanf("%d %d %d %d", &p.x, &p.y, &q.x, &q.y) != 4) return 1;
    printf("%d\n", manhattan(p, q));
    return 0;
}
