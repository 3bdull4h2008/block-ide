//! profile: local player profile (PLAN.md step 4.3/D8). One JSON file under
//! the OS app-data dir. Offline-first, no accounts (Golden Rule 6).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Profile {
    pub xp: u32,
    /// level id -> unix seconds when first completed
    pub completed: std::collections::BTreeMap<String, i64>,
}

/// D8 unlock ladder: block categories appear as levels get completed.
pub const UNLOCK_RULES: &[(&str, usize)] = &[
    ("comment", 0),
    ("statement", 0),
    ("control", 3),
    ("loops", 7),
    ("functions", 12),
    ("structs", 17),
];

impl Profile {
    pub fn path(app: &tauri::AppHandle) -> Option<PathBuf> {
        use tauri::Manager;
        app.path()
            .app_data_dir()
            .ok()
            .map(|d| d.join("profile.json"))
    }

    pub fn load(app: &tauri::AppHandle) -> Profile {
        let Some(p) = Self::path(app) else {
            return Profile::default();
        };
        match std::fs::read_to_string(&p) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Profile::default(),
        }
    }

    pub fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let Some(p) = Self::path(app) else {
            return Err("no app data dir".into());
        };
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let s = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&p, s).map_err(|e| e.to_string())
    }

    pub fn unlocked_categories(&self) -> Vec<String> {
        let done = self.completed.len();
        UNLOCK_RULES
            .iter()
            .filter(|(_, n)| done >= *n)
            .map(|(c, _)| c.to_string())
            .collect()
    }
}
