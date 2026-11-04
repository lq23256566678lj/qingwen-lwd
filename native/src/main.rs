mod app;
mod config;
mod lwd;
mod model;
mod pdf;
mod webdav;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("轻文 LWD · Native")
            .with_inner_size([1280.0, 860.0])
            .with_min_inner_size([960.0, 640.0]),
        ..Default::default()
    };
    eframe::run_native(
        "轻文 LWD · Native",
        options,
        Box::new(|context| Ok(Box::new(app::NativeApp::new(context)))),
    )
}
