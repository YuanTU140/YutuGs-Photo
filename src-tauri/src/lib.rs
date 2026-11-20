use std::collections::BTreeSet;
use std::process::Command;
use tauri::Manager;


/// Enumerate font families installed on the host operating system.
#[tauri::command]
fn list_installed_fonts() -> Result<Vec<String>, String> {
    let mut fonts = BTreeSet::<String>::new();
    #[cfg(target_os = "windows")]
    {
        let script = r#"[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"#;
        if let Ok(output) = Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", script]).output() {
            if output.status.success() { for family in String::from_utf8_lossy(&output.stdout).lines() { let family=family.trim(); if !family.is_empty(){fonts.insert(family.to_string());} } }
        }
        if fonts.is_empty() {
            for key in [r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"] {
                if let Ok(output)=Command::new("reg").args(["query",key]).output(){if output.status.success(){for line in String::from_utf8_lossy(&output.stdout).lines(){if let Some(pos)=line.find("REG_"){let name=line[..pos].trim();let family=name.trim_end_matches(" (TrueType)").trim_end_matches(" (OpenType)").trim_end_matches(" (Type 1)").trim();if !family.is_empty(){fonts.insert(family.to_string());}}}}}
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    { if let Ok(output)=Command::new("fc-list").args(["--format","%{family}\\n"]).output(){if output.status.success(){for line in String::from_utf8_lossy(&output.stdout).lines(){for family in line.split(','){let family=family.trim();if !family.is_empty(){fonts.insert(family.to_string());}}}}} }
    if fonts.is_empty(){return Err("未能从操作系统读取已安装字体".into());}
    Ok(fonts.into_iter().collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_installed_fonts])
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
