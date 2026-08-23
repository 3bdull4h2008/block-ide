//! memtrace: replay the event ring published by third_party/include/memtrace.h
//! (PLAN.md step 3.3). The IDE polls `since(seq)` and rebuilds the live heap:
//! alloc opens a box, free closes it, realloc closes aux and opens addr.

use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, FILE_MAP_READ, MEMORY_MAPPED_VIEW_ADDRESS,
    UnmapViewOfFile,
};

pub const MAP_NAME_W: &[u16] = &[
    'L' as u16, 'o' as u16, 'c' as u16, 'a' as u16, 'l' as u16, '\\' as u16, 'B' as u16,
    'l' as u16, 'o' as u16, 'c' as u16, 'k' as u16, 'I' as u16, 'D' as u16, 'E' as u16,
    'M' as u16, 'e' as u16, 'm' as u16, 'T' as u16, 'r' as u16, 'a' as u16, 'c' as u16,
    'e' as u16, 'V' as u16, '1' as u16, 0,
];

const MT_MAGIC: u32 = 0x3152_544D; // 'MTR1' little-endian, matches memtrace.h
const HDR_SIZE: usize = 16;

#[derive(Debug, Clone)]
pub struct MemEvent {
    pub seq: u32,
    /// 0=alloc 1=free 2=realloc
    pub op: u32,
    pub line: u32,
    pub addr: u64,
    pub size: u64,
    /// realloc: old address
    pub aux: u64,
}

#[repr(C)]
struct RawHeader {
    magic: u32,
    seq: u32,
    capacity: u32,
    dropped: u32,
}

#[repr(C)]
struct RawEvent {
    seq: u32,
    op: u32,
    line: u32,
    pad: u32,
    addr: u64,
    size: u64,
    aux: u64,
}

pub struct MemTraceReader {
    map: HANDLE,
    view: MEMORY_MAPPED_VIEW_ADDRESS,
    last_seq: u32,
}

impl MemTraceReader {
    pub fn attach(timeout_ms: u32) -> Option<MemTraceReader> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms as u64);
        loop {
            if let Some(r) = MemTraceReader::try_attach() {
                return Some(r);
            }
            if Instant::now() >= deadline {
                return None;
            }
            std::thread::sleep(Duration::from_millis(15));
        }
    }

    fn try_attach() -> Option<MemTraceReader> {
        unsafe {
            let map = OpenFileMappingW(FILE_MAP_READ, 0, MAP_NAME_W.as_ptr());
            if map.is_null() {
                return None;
            }
            let view = MapViewOfFile(map, FILE_MAP_READ, 0, 0, 0);
            if view.Value.is_null() {
                CloseHandle(map);
                return None;
            }
            let hdr = &*(view.Value as *const RawHeader);
            if hdr.magic != MT_MAGIC {
                UnmapViewOfFile(view);
                CloseHandle(map);
                return None;
            }
            Some(MemTraceReader {
                map,
                view,
                last_seq: 0,
            })
        }
    }

    fn hdr(&self) -> &RawHeader {
        unsafe { &*(self.view.Value as *const RawHeader) }
    }

    /// Events published since the last poll (session reset aware).
    /// `gaps > 0` means the ring wrapped before we kept up.
    pub fn since(&mut self) -> (Vec<MemEvent>, u32) {
        let hdr = self.hdr();
        let target = hdr.seq;
        let cap = hdr.capacity.max(1);
        let mut gaps = 0u32;
        let mut out = Vec::new();
        // Session reset (child re-ran): counter went backwards.
        if target < self.last_seq {
            self.last_seq = 0;
        }
        let mut s = self.last_seq;
        // If we fell more than one ring behind, jump to the oldest survivor.
        if target.saturating_sub(s) > cap {
            gaps += 1;
            s = target - cap;
        }
        while s < target {
            let idx = (s % cap) as usize;
            let base = unsafe { (self.view.Value as *const u8).add(HDR_SIZE) };
            let e = unsafe { &*(base as *const RawEvent).add(idx) };
            if e.seq != s + 1 {
                // slot not yet visible or overwritten: count and move on
                gaps += 1;
                s += 1;
                continue;
            }
            out.push(MemEvent {
                seq: e.seq,
                op: e.op,
                line: e.line,
                addr: e.addr,
                size: e.size,
                aux: e.aux,
            });
            s += 1;
            if out.len() >= 4096 {
                break;
            }
        }
        self.last_seq = s;
        out.shrink_to_fit();
        (out, gaps)
    }

    #[allow(dead_code)]
    pub fn total_published(&self) -> u32 {
        self.hdr().seq
    }

    #[allow(dead_code)]
    pub fn total_dropped(&self) -> u32 {
        self.hdr().dropped
    }
}

impl Drop for MemTraceReader {
    fn drop(&mut self) {
        unsafe {
            UnmapViewOfFile(self.view);
            CloseHandle(self.map);
        }
    }
}

unsafe impl Send for MemTraceReader {}
unsafe impl Sync for MemTraceReader {}
