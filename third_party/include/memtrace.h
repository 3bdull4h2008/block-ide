/* memtrace.h — Block-IDE memory tracer (PLAN.md step 3.3, opt-in)
 *
 * The IDE prepends `#include "memtrace.h"` to the staged copy when the
 * memory toggle is on (the file on disk stays untouched — it is the truth).
 * malloc/free/calloc/realloc are macro-interposed and every call is logged
 * into a shared-memory event ring that the IDE replays live: heap boxes,
 * sizes, allocation lines, and end-of-run leak detection.
 *
 * Zero overhead when off: the ring is only created if the IDE sets
 * BLOCKIDE_MEMTRACE=1 for the child; otherwise each wrapper is one branch.
 *
 * Known v1 limits (documented, acceptable for teaching): strdup & friends
 * bypass the hooks; line numbers come from the macro call site.
 */
#ifndef MEMTRACE_H
#define MEMTRACE_H

#include <stdlib.h>
#include <windows.h>

/* capture real allocators BEFORE the macros shadow the names */
static void *(*mt_real_malloc)(size_t) = malloc;
static void (*mt_real_free)(void *) = free;
static void *(*mt_real_calloc)(size_t, size_t) = calloc;
static void *(*mt_real_realloc)(void *, size_t) = realloc;

#define MT_MAGIC 0x3152544Du /* 'MTR1' */
#define MT_CAP 65536u

typedef struct MemEvent {
    unsigned int seq;
    unsigned int op; /* 0=alloc 1=free 2=realloc */
    unsigned int line;
    unsigned int pad_;
    unsigned long long addr;
    unsigned long long size; /* alloc/realloc: requested size */
    unsigned long long aux;  /* realloc: old address */
} MemEvent; /* 40 bytes */

typedef struct MemTraceHeader {
    unsigned int magic;
    volatile unsigned int seq;     /* events published */
    unsigned int capacity;
    volatile unsigned int dropped; /* wrapped before a reader kept up */
} MemTraceHeader; /* 16 bytes */

static HANDLE mt_map_ = NULL;
static MemTraceHeader *mt_hdr_ = NULL;
static MemEvent *mt_slots_ = NULL;
static int mt_on_ = -1; /* tri-state: uninit/off/on */

static void mt_emit_(unsigned int op, const void *addr, unsigned long long size,
                     const void *aux, unsigned int line) {
    if (mt_on_ == -1) {
        char v[8] = {0};
        mt_on_ = (GetEnvironmentVariableA("BLOCKIDE_MEMTRACE", v, 8) > 0 &&
                  v[0] != '0')
                     ? 1
                     : 0;
        if (!mt_on_)
            return;
        DWORD total =
            sizeof(MemTraceHeader) + (DWORD)MT_CAP * (DWORD)sizeof(MemEvent);
        mt_map_ = CreateFileMappingA(INVALID_HANDLE_VALUE, NULL,
                                     PAGE_READWRITE, 0, total,
                                     "Local\\BlockIDEMemTraceV1");
        if (!mt_map_) {
            mt_on_ = 0;
            return;
        }
        mt_hdr_ = (MemTraceHeader *)MapViewOfFile(mt_map_, FILE_MAP_ALL_ACCESS,
                                                  0, 0, total);
        if (!mt_hdr_) {
            CloseHandle(mt_map_);
            mt_map_ = NULL;
            mt_on_ = 0;
            return;
        }
        mt_hdr_->magic = MT_MAGIC;
        mt_hdr_->capacity = MT_CAP;
        mt_hdr_->seq = 0;
        mt_hdr_->dropped = 0;
        mt_slots_ = (MemEvent *)((unsigned char *)mt_hdr_ +
                                 sizeof(MemTraceHeader));
    }
    if (!mt_on_)
        return;

    unsigned int s = mt_hdr_->seq;
    MemEvent *e = &mt_slots_[s % MT_CAP];
    e->seq = s + 1;
    e->op = op;
    e->line = line;
    e->pad_ = 0;
    e->addr = (unsigned long long)(uintptr_t)addr;
    e->size = size;
    e->aux = (unsigned long long)(uintptr_t)aux;
    mt_hdr_->seq = s + 1;
}

static void *mt_alloc_(size_t n, unsigned int line) {
    void *p = mt_real_malloc(n);
    if (p)
        mt_emit_(0, p, (unsigned long long)n, NULL, line);
    return p;
}

static void *mt_calloc_(size_t n, size_t sz, unsigned int line) {
    void *p = mt_real_calloc(n, sz);
    if (p)
        mt_emit_(0, p, (unsigned long long)n * sz, NULL, line);
    return p;
}

static void mt_free_(void *p, unsigned int line) {
    if (p)
        mt_emit_(1, p, 0, NULL, line);
    mt_real_free(p);
}

static void *mt_realloc_(void *p, size_t n, unsigned int line) {
    void *q = mt_real_realloc(p, n);
    if (p || q)
        mt_emit_(2, q, (unsigned long long)n, p, line);
    return q;
}

/* now shadow the names for the rest of the translation unit */
#define malloc(n) mt_alloc_((n), __LINE__)
#define calloc(n, s) mt_calloc_((n), (s), __LINE__)
#define free(p) mt_free_((p), __LINE__)
#define realloc(p, n) mt_realloc_((p), (n), __LINE__)

#endif /* MEMTRACE_H */
