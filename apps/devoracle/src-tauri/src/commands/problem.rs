//! Detect active browser URL for LeetCode / NeetCode / HackerRank (macOS).

#[tauri::command]
pub fn detect_leetcode_problem() -> Option<String> {
    cw_screen_context::get_active_browser_url()
}
