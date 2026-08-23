/* Block-IDE stage demo: bouncing confetti. Run from the IDE and press Q
 * (or the Stage stop button) to quit.
 *
 * Determinism note for G-STAGE-DET: all randomness flows through
 * stage_random(), which is keyed on the frame counter — every run renders
 * pixel-identical output.
 */
#include <stdio.h>
#include "stage.h"

#define N 40

int main(void) {
    if (!stage_init(320, 240)) {
        printf("stage init failed\n");
        return 3;
    }
    unsigned c[N], x[N], y[N], dx[N], dy[N];
    for (int i = 0; i < N; i++) {
        unsigned pal[6] = {0x89b4fa, 0xa6e3a1, 0xf9e2af, 0xf38ba8, 0x94e2d5, 0xffffff};
        c[i] = pal[stage_random(6)];
        x[i] = stage_random(stage_width());
        y[i] = stage_random(stage_height());
        dx[i] = 1 + stage_random(3);
        dy[i] = 1 + stage_random(3);
    }
    while (stage_tick()) {
        stage_clear(0x181825);
        for (int i = 0; i < N; i++) {
            x[i] += dx[i];
            y[i] += dy[i];
            if (x[i] == 0 || x[i] >= (unsigned)stage_width() - 4) dx[i] = -dx[i];
            if (y[i] == 0 || y[i] >= (unsigned)stage_height() - 4) dy[i] = -dy[i];
            stage_rect((int)x[i], (int)y[i], 4, 4, c[i]);
        }
    }
    printf("bye\n");
    return 0;
}
