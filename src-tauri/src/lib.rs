use tauri::{Emitter, Manager, WebviewWindowBuilder, WebviewUrl};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use std::sync::Mutex;

#[tauri::command]
fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn close_overlay(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.close();
    }
}

struct CurrentShortcut(Mutex<Shortcut>);

#[derive(serde::Deserialize)]
struct HotkeyConfig {
    modifiers: Vec<String>,
    key: String,
}

fn parse_key_code(key: &str) -> Option<Code> {
    match key.to_uppercase().as_str() {
        "A" => Some(Code::KeyA),
        "B" => Some(Code::KeyB),
        "C" => Some(Code::KeyC),
        "D" => Some(Code::KeyD),
        "E" => Some(Code::KeyE),
        "F" => Some(Code::KeyF),
        "G" => Some(Code::KeyG),
        "H" => Some(Code::KeyH),
        "I" => Some(Code::KeyI),
        "J" => Some(Code::KeyJ),
        "K" => Some(Code::KeyK),
        "L" => Some(Code::KeyL),
        "M" => Some(Code::KeyM),
        "N" => Some(Code::KeyN),
        "O" => Some(Code::KeyO),
        "P" => Some(Code::KeyP),
        "Q" => Some(Code::KeyQ),
        "R" => Some(Code::KeyR),
        "S" => Some(Code::KeyS),
        "T" => Some(Code::KeyT),
        "U" => Some(Code::KeyU),
        "V" => Some(Code::KeyV),
        "W" => Some(Code::KeyW),
        "X" => Some(Code::KeyX),
        "Y" => Some(Code::KeyY),
        "Z" => Some(Code::KeyZ),
        "0" => Some(Code::Digit0),
        "1" => Some(Code::Digit1),
        "2" => Some(Code::Digit2),
        "3" => Some(Code::Digit3),
        "4" => Some(Code::Digit4),
        "5" => Some(Code::Digit5),
        "6" => Some(Code::Digit6),
        "7" => Some(Code::Digit7),
        "8" => Some(Code::Digit8),
        "9" => Some(Code::Digit9),
        "SPACE" | " " => Some(Code::Space),
        "ENTER" => Some(Code::Enter),
        "TAB" => Some(Code::Tab),
        "ESCAPE" | "ESC" => Some(Code::Escape),
        _ => None,
    }
}

fn parse_hotkey(config: &HotkeyConfig) -> Option<Shortcut> {
    let mut mods = Modifiers::empty();

    for modifier in &config.modifiers {
        match modifier.to_uppercase().as_str() {
            "ALT" | "OPTION" => mods |= Modifiers::ALT,
            "CTRL" | "CONTROL" => mods |= Modifiers::CONTROL,
            "SHIFT" => mods |= Modifiers::SHIFT,
            "META" | "CMD" | "COMMAND" => mods |= Modifiers::META,
            _ => {}
        }
    }

    let code = parse_key_code(&config.key)?;
    let mods_option = if mods.is_empty() { None } else { Some(mods) };

    Some(Shortcut::new(mods_option, code))
}

#[tauri::command]
fn change_hotkey(app: tauri::AppHandle, hotkey: HotkeyConfig) -> Result<(), String> {
    let new_shortcut = parse_hotkey(&hotkey).ok_or("Invalid hotkey")?;

    // Get the current shortcut from state
    let state = app.state::<CurrentShortcut>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;

    // Unregister old shortcut
    let _ = app.global_shortcut().unregister(*current);

    // Register new shortcut
    app.global_shortcut()
        .register(new_shortcut)
        .map_err(|e| e.to_string())?;

    // Update state
    *current = new_shortcut;

    Ok(())
}

fn build_global_shortcut_plugin() -> impl tauri::plugin::Plugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                // Check if overlay already exists
                if let Some(_window) = app.get_webview_window("overlay") {
                    // Send stop event to trigger transcription
                    let _ = app.emit("stop-recording", ());
                } else {
                    // Check main window state before creating overlay
                    let main_was_minimized = app
                        .get_webview_window("main")
                        .map(|w| w.is_minimized().unwrap_or(false))
                        .unwrap_or(true);

                    let main_was_visible = app
                        .get_webview_window("main")
                        .map(|w| w.is_visible().unwrap_or(false))
                        .unwrap_or(false);

                    // Create overlay window
                    let _ = WebviewWindowBuilder::new(
                        app,
                        "overlay",
                        WebviewUrl::App("/overlay".into()),
                    )
                    .title("")
                    .inner_size(380.0, 150.0)
                    .resizable(false)
                    .decorations(false)
                    .always_on_top(true)
                    .center()
                    .transparent(true)
                    .shadow(false)
                    .visible_on_all_workspaces(true)
                    .skip_taskbar(true)
                    .build();

                    // Restore main window state
                    if let Some(main_window) = app.get_webview_window("main") {
                        if main_was_minimized {
                            let _ = main_window.minimize();
                        } else if !main_was_visible {
                            let _ = main_window.hide();
                        }
                    }

                    let _ = app.emit("start-recording", ());
                }
            }
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(build_global_shortcut_plugin());

    // macOS-specific permission plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    builder
        .setup(|app| {
            // Register global shortcut: Alt+M (Option+M on macOS)
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyM);

            app.global_shortcut().register(shortcut)?;

            // Store the current shortcut in state
            app.manage(CurrentShortcut(Mutex::new(shortcut)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![copy_to_clipboard, close_overlay, change_hotkey])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
