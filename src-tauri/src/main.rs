// 发布版本不显示控制台窗口；调试版本保留控制台便于查看 Rust 日志。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    qingwen_lib::run()
}
