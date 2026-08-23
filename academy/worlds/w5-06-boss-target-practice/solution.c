#include <stdio.h>
#include "stage.h"

/* Boss battle: Target Practice. Read T targets and S shots,
   animate the scene on the stage, count hits (square radius 2). */

static int hit(int tx, int ty, int sx, int sy) {
    int dx = sx - tx; if (dx < 0) dx = -dx;
    int dy = sy - ty; if (dy < 0) dy = -dy;
    return dx <= 2 && dy <= 2;
}

int main(void) {
    static int tx[16], ty[16], shx[64], shy[64], scored[64];
    int T = 0;
    if (scanf("%d", &T) != 1 || T < 1 || T > 16) return 1;
    for (int t = 0; t < T; t++)
        if (scanf("%d %d", &tx[t], &ty[t]) != 2) return 1;

    int S = 0, hits = 0;
    if (scanf("%d", &S) != 1 || S < 1 || S > 64) return 1;
    for (int s = 0; s < S; s++) {
        if (scanf("%d %d", &shx[s], &shy[s]) != 2) return 1;
        scored[s] = 0;
        for (int t = 0; t < T; t++)
            if (hit(tx[t], ty[t], shx[s], shy[s])) scored[s] = 1;
        hits += scored[s];
    }

    if (!stage_init(320, 240)) return 3;

    /* grid backdrop */
    stage_clear(0x181825);
    for (int g = 0; g < 320; g += 40)
        for (int y = 0; y < 240; y += 8) stage_pixel(g, y, 0x313244);
    for (int g = 0; g < 240; g += 40)
        for (int x = 0; x < 320; x += 8) stage_pixel(x, g, 0x313244);

    /* targets pulse: blue ring grows over the first 12 frames */
    for (int f = 0; f < 12 && stage_tick(); f++) {
        int r = 4 + f;
        for (int t = 0; t < T; t++) {
            stage_rect(tx[t] * 8 - r, ty[t] * 8 - r, 2 * r, 1, 0x89b4fa);
            stage_rect(tx[t] * 8 - r, ty[t] * 8 + r, 2 * r, 1, 0x89b4fa);
            stage_rect(tx[t] * 8 - r, ty[t] * 8 - r, 1, 2 * r, 0x89b4fa);
            stage_rect(tx[t] * 8 + r, ty[t] * 8 - r, 1, 2 * r, 0x89b4fa);
            stage_rect(tx[t] * 8 - 2, ty[t] * 8 - 2, 5, 5, 0x89b4fa);
        }
    }

    /* shots fly in one per frame: green hit, red miss, with a flash */
    for (int s = 0; s < S && stage_tick(); s++) {
        stage_rect(shx[s] * 8, shy[s] * 8, 6, 6,
                   scored[s] ? 0xa6e3a1 : 0xf38ba8);
        if (scored[s])
            stage_rect(shx[s] * 8 - 3, shy[s] * 8 - 3, 12, 12, 0xa6e3a1);
    }
    /* hold the final board */
    for (int f = 0; f < 30 && stage_tick(); f++) {}

    printf("%d of %d shots hit\n", hits, S);
    return 0;
}
