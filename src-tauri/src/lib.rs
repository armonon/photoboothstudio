use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // macOS WKWebView can leave the window blank until it receives an input/resize
      // event (a known Tauri quirk — the main thread is idle, it just hasn't painted).
      // Nudge the window size once shortly after launch to force the first composite.
      #[cfg(target_os = "macos")]
      {
        for (_, win) in app.webview_windows() {
          let w = win.clone();
          std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            if let Ok(size) = w.inner_size() {
              let _ = w.set_size(tauri::PhysicalSize::new(size.width + 1, size.height));
              std::thread::sleep(std::time::Duration::from_millis(60));
              let _ = w.set_size(size);
              let _ = w.set_focus();
            }
          });
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
