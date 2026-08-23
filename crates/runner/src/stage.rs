//! stage: read/write the shared framebuffer published by third_party's
//! stage.h (PLAN.md step 3.2 — embedded stage panel). The child program
//! creates the `Local\BlockIDEStageV1` mapping; the IDE attaches read-write
//! (frames out, keys/quit in).

use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, FILE_MAP_ALL_ACCESS, MEMORY_MAPPED_VIEW_ADDRESS,
};

pub const MAP_NAME_W: &[u16] = &[
    'L' as u16, 'o' as u16, 'c' as u16, 'a' as u16, 'l' as u16, '\\' as u16, 'B' as u16,
    'l' as u16, 'o' as u16, 'c' as u16, 'k' as u16, 'I' as u16, 'D' as u16, 'E' as u16,
    'S' as u16, 't' as u16, 'a' as u16, 'g' as u16, 'e' as u16, 'V' as u16, '1' as u16,
    0,
];

const MAGIC: u32 = 0x3154_5353; // 'STG1'
const HDR_SIZE: usize = 276; // magic+w+h+frame+keys[256]+quit+reserved[3]

#[repr(C)]
struct StageHeader {
    magic: u32,
    w: i32,
    h: i32,
    frame: u32,
    keys: [u8; 256],
    quit: u8,
    reserved: [u8; 3],
}

pub struct StageFrame {
    pub frame: u32,
    pub w: i32,
    pub h: i32,
    /// RGBA bytes, w*h*4
    pub rgba: Vec<u8>,
}

pub struct StageReader {
    map: HANDLE,
    view: MEMORY_MAPPED_VIEW_ADDRESS,
    last_frame: std::sync::atomic::AtomicU32,
}

impl StageReader {
    /// Poll for a freshly published stage (child may still be starting).
    pub fn attach(timeout_ms: u32) -> Option<StageReader> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms as u64);
        loop {
            if let Some(r) = StageReader::try_attach() {
                return Some(r);
            }
            if Instant::now() >= deadline {
                return None;
            }
            std::thread::sleep(Duration::from_millis(15));
        }
    }

    fn try_attach() -> Option<StageReader> {
        unsafe {
            let map = OpenFileMappingW(FILE_MAP_ALL_ACCESS, 0, MAP_NAME_W.as_ptr());
            if map.is_null() {
                return None;
            }
            let view = MapViewOfFile(map, FILE_MAP_ALL_ACCESS, 0, 0, 0);
            if view.Value.is_null() {
                CloseHandle(map);
                return None;
            }
            let hdr = &*(view.Value as *const StageHeader);
            let ok = hdr.magic == MAGIC && hdr.w > 0 && hdr.w <= 2048 && hdr.h > 0 && hdr.h <= 2048;
            if !ok {
                UnmapViewOfFile(view);
                CloseHandle(map);
                return None;
            }
            Some(StageReader {
                map,
                view,
                last_frame: std::sync::atomic::AtomicU32::new(u32::MAX),
            })
        }
    }

    fn hdr(&self) -> &StageHeader {
        unsafe { &*(self.view.Value as *const StageHeader) }
    }

    pub fn dims(&self) -> (i32, i32) {
        let h = self.hdr();
        (h.w, h.h)
    }

    /// Current published frame counter (no copy).
    pub fn peek_frame(&self) -> Option<u32> {
        let hdr = self.hdr();
        if hdr.magic != MAGIC {
            return None;
        }
        Some(hdr.frame)
    }

    /// Some(frame) only when the program published a new frame. `&self` so
    /// the reader can live behind a shared mutex guard.
    pub fn frame(&self) -> Option<StageFrame> {
        let hdr = self.hdr();
        let f = hdr.frame;
        let last = self.last_frame.load(std::sync::atomic::Ordering::Relaxed);
        if f == last || hdr.magic != MAGIC {
            return None;
        }
        self.last_frame
            .store(f, std::sync::atomic::Ordering::Relaxed);
        let (w, h) = (hdr.w as usize, hdr.h as usize);
        let base = self.view.Value as *const u8;
        let px =
            unsafe { std::slice::from_raw_parts(base.add(HDR_SIZE), w * h * 4) };
        let mut rgba = vec![0u8; w * h * 4];
        for i in 0..w * h {
            rgba[i * 4] = px[i * 4 + 2];
            rgba[i * 4 + 1] = px[i * 4 + 1];
            rgba[i * 4 + 2] = px[i * 4];
            rgba[i * 4 + 3] = 255;
        }
        self.last_frame
            .store(f, std::sync::atomic::Ordering::Relaxed);
        Some(StageFrame {
            frame: f,
            w: w as i32,
            h: h as i32,
            rgba,
        })
    }

    pub fn send_keys(&self, down: &[u8]) {
        let hdr = self.hdr() as *const StageHeader as *mut StageHeader;
        unsafe {
            (*hdr).keys = [0u8; 256];
            for &k in down {
                if (k as usize) < 256 {
                    (*hdr).keys[k as usize] = 1;
                }
            }
        }
    }

    pub fn request_quit(&self) {
        let hdr = self.hdr() as *const StageHeader as *mut StageHeader;
        unsafe {
            (*hdr).quit = 1;
        }
    }
}

impl Drop for StageReader {
    fn drop(&mut self) {
        unsafe {
            UnmapViewOfFile(self.view);
            CloseHandle(self.map);
        }
    }
}

// SAFETY: StageReader owns a raw mapping handle and a stable view pointer.
// All shared-header access is either read-only or behind the caller's lock;
// frame bookkeeping uses an atomic. The handle is just an integer token.
unsafe impl Send for StageReader {}
unsafe impl Sync for StageReader {}

use windows_sys::Win32::System::Memory::UnmapViewOfFile;

/// Repo-relative include dir so user programs can `#include "stage.h"`.
pub fn include_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("third_party")
        .join("include")
}
