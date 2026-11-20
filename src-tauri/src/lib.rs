
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            std::thread::spawn(move || {
                // Keep the original branded splash visible while the new editor shell initializes.
                std::thread::sleep(std::time::Duration::from_millis(1800));
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }

                if let Some(splash) = handle.get_webview_window("splash") {
                    let _ = splash.close();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running YutuGs-Photo");
}
