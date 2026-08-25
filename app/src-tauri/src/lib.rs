use core_parser::CTree;
use serde::Serialize;

#[derive(Serialize)]
pub struct ParseOut {
    pub tree: CTree,
    pub has_errors: bool,
}

pub mod commands;
mod profile;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::parse_c,
            commands::canonicalize_c,
            commands::run_c,
            commands::run_start,
            commands::run_stdin,
            commands::run_poll,
            commands::mem_attach,
            commands::mem_state,
            commands::academy_levels,
            commands::academy_load,
            commands::academy_check,
            commands::profile_get,
commands::journal_write,
commands::journal_read,
commands::journal_clear,
commands::journal_backups,
commands::journal_restore_backup,
            commands::stage_attach,
            commands::stage_frame,
            commands::stage_keys,
            commands::stage_stop,
            commands::list_c_files,
            commands::read_file,
            commands::write_file,
            commands::diag_c
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
