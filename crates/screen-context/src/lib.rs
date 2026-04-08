//! Screen context capture for reading active window content.
//! Used to provide context to the AI (e.g., code editor content during interviews).

pub mod browser_url;
pub mod capture;

pub use browser_url::get_active_browser_url;
pub use capture::ScreenCapture;
