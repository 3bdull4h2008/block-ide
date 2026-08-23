/* stage.h — Block-IDE teaching graphics library (PLAN.md step 3.1)
 *
 * A tiny pixel stage for kids' C programs. Frames live in named shared
 * memory so the IDE can embed the stage in its UI (Golden Rule: the file is
 * the truth; the stage is just output).
 *
 *   #include "stage.h"
 *   int main(void) {
 *       stage_init(320, 240);
 *       while (stage_tick()) {
 *           stage_clear(0x101018);
 *           stage_rect(10, 10, 50, 30, 0xffab19);
 *       }
 *       return 0;
 *   }
 *
 * Colors are 0xRRGGBB. Coordinates clip silently at stage edges.
 *
 * Keys (stage_key_down): 'A'..'Z', '0'..'9' as their character codes,
 * SPACE=32, ENTER=13, ESC=27, LEFT=1 UP=2 RIGHT=3 DOWN=4.
 *
 * Determinism: stage_random(n) is seeded from the frame counter, so the
 * same draw sequence renders pixel-identical across runs (G-STAGE-DET).
 *
 * Set BLOCKIDE_STAGE_WINDOW=1 to also pop a real window (vendored
 * fenster.h) for standalone play outside the IDE.
 */
#ifndef STAGE_H
#define STAGE_H

#include <windows.h>
#include <stdlib.h>
#include <string.h>

#if defined(STAGE_WINDOW)
#include "fenster.h"
#endif

#define STAGE_MAGIC 0x31545353u /* 'STG1' */
#define STAGE_KEY_LEFT 1
#define STAGE_KEY_UP 2
#define STAGE_KEY_RIGHT 3
#define STAGE_KEY_DOWN 4

typedef struct StageHeader {
    unsigned int magic;
    int w;
    int h;
    volatile unsigned int frame;
    volatile unsigned char keys[256];
    volatile unsigned char quit;
    unsigned char reserved[3];
} StageHeader; /* 276 bytes; pixels follow */

static HANDLE s_stage_map = NULL;
static StageHeader *s_stage = NULL;
static unsigned char *s_stage_px = NULL;
static int s_stage_w = 0;
static int s_stage_h = 0;
static unsigned int s_stage_frame = 0;
static unsigned long s_stage_t0 = 0;

#if defined(STAGE_WINDOW)
static struct fenster s_stage_fen;
#endif

static void stage_put_bgra(int x, int y, unsigned char b, unsigned char g,
                           unsigned char r) {
    if ((unsigned)x >= (unsigned)s_stage_w || (unsigned)y >= (unsigned)s_stage_h)
        return;
    unsigned char *p = s_stage_px + ((y * s_stage_w + x) << 2);
    p[0] = b;
    p[1] = g;
    p[2] = r;
    p[3] = 255;
}

/* Create/attach the shared framebuffer. Returns 0 on failure. */
static int stage_init(int w, int h) {
    if (w <= 0 || h <= 0 || w > 2048 || h > 2048)
        return 0;
    s_stage_w = w;
    s_stage_h = h;
    DWORD total = sizeof(StageHeader) + (DWORD)w * (DWORD)h * 4u;
    s_stage_map = CreateFileMappingA(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE,
                                     0, total, "Local\\BlockIDEStageV1");
    if (!s_stage_map)
        return 0;
    s_stage = (StageHeader *)MapViewOfFile(s_stage_map, FILE_MAP_ALL_ACCESS, 0,
                                           0, total);
    if (!s_stage) {
        CloseHandle(s_stage_map);
        s_stage_map = NULL;
        return 0;
    }
    s_stage->magic = STAGE_MAGIC;
    s_stage->w = w;
    s_stage->h = h;
    s_stage->frame = 0;
    s_stage->quit = 0;
    memset((void *)s_stage->keys, 0, 256);
    s_stage_px = (unsigned char *)s_stage + sizeof(StageHeader);
    memset(s_stage_px, 0, (size_t)w * (size_t)h * 4u);
    s_stage_frame = 0;
    s_stage_t0 = GetTickCount();

#if defined(STAGE_WINDOW)
    {
        char swin[8] = {0};
        if (GetEnvironmentVariableA("BLOCKIDE_STAGE_WINDOW", swin, 8) > 0) {
            memset(&s_stage_fen, 0, sizeof(s_stage_fen));
            static unsigned char winbuf[2048 * 2048 * 3];
            s_stage_fen.title = "Block-IDE Stage";
            s_stage_fen.width = w;
            s_stage_fen.height = h;
            s_stage_fen.buf = winbuf;
            if (fenster_open(&s_stage_fen) != 0)
                s_stage_fen.buf = NULL; /* mark unavailable but keep shm */
        }
    }
#endif
    return 1;
}

/* One animation frame (~60 fps). Returns 0 once a quit was requested. */
static int stage_tick(void) {
    if (!s_stage)
        return 0;
#if defined(STAGE_WINDOW)
    if (s_stage_fen.buf) {
        for (int y = 0; y < s_stage_h; y++) {
            for (int x = 0; x < s_stage_w; x++) {
                const unsigned char *p =
                    s_stage_px + ((y * s_stage_w + x) << 2);
                fenster_pixel(&s_stage_fen, x, y) =
                    (uint32_t)((p[2] << 16) | (p[1] << 8) | p[0]);
            }
        }
        if (fenster_loop(&s_stage_fen) != 0) {
            s_stage->quit = 1;
            s_stage->frame++;
            return 0;
        }
        for (int k = 0; k < 256; k++)
            s_stage->keys[k] = s_stage_fen.keys[k] ? 1 : 0;
    } else
#endif
    {
        unsigned long due = s_stage_t0 + (s_stage_frame + 1u) * 16u;
        unsigned long now = GetTickCount();
        while (now < due) {
            Sleep(1);
            now = GetTickCount();
        }
    }
    s_stage_frame++;
    s_stage->frame = s_stage_frame;
    return !s_stage->quit;
}

static int stage_width(void) { return s_stage_w; }
static int stage_height(void) { return s_stage_h; }

/* color 0xRRGGBB */
static void stage_pixel(int x, int y, unsigned int c) {
    stage_put_bgra(x, y, (unsigned char)(c & 255), (unsigned char)((c >> 8) & 255),
                   (unsigned char)((c >> 16) & 255));
}

static void stage_clear(unsigned int c) {
    for (int y = 0; y < s_stage_h; y++)
        for (int x = 0; x < s_stage_w; x++)
            stage_pixel(x, y, c);
}

static void stage_rect(int x, int y, int w, int h, unsigned int c) {
    for (int j = 0; j < h; j++)
        for (int i = 0; i < w; i++)
            stage_pixel(x + i, y + j, c);
}

/* Blit a w*h sprite of 0xRRGGBB values; color 0 pixels are transparent. */
static void stage_sprite(int x, int y, int w, int h, const unsigned int *px) {
    for (int j = 0; j < h; j++)
        for (int i = 0; i < w; i++) {
            unsigned int c = px[j * w + i];
            if (c)
                stage_pixel(x + i, y + j, c);
        }
}

static int stage_key_down(int k) {
    if (!s_stage || k < 0 || k > 255)
        return 0;
    return s_stage->keys[k] != 0;
}

/* Deterministic pseudo-random: xorshift32 keyed by the frame counter. */
static unsigned int stage_random(unsigned int n) {
    if (n == 0)
        return 0;
    unsigned int x = 0x9E3779B9u ^ (s_stage_frame * 2654435761u);
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return x % n;
}

#endif /* STAGE_H */
