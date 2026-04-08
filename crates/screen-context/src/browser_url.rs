//! Read active browser tab URL (macOS via AppleScript). Used for LeetCode detection.

#[cfg(target_os = "macos")]
fn is_coding_problem_url(url: &str) -> bool {
    let u = url.trim().to_lowercase();
    u.contains("leetcode.com/problems/")
        || u.contains("neetcode.io/problems/")
        || u.contains("hackerrank.com/challenges/")
}

#[cfg(target_os = "macos")]
mod macos {
    use super::is_coding_problem_url;
    use std::process::Command;

    fn run_applescript(source: &str) -> Option<String> {
        let out = Command::new("osascript")
            .arg("-e")
            .arg(source)
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if s.is_empty() {
            return None;
        }
        Some(s)
    }

    /// Try common browsers; return first active tab URL that matches coding platforms.
    pub fn active_problem_url() -> Option<String> {
        let scripts: &[&str] = &[
            r#"tell application "Google Chrome" to get URL of active tab of front window"#,
            r#"tell application "Arc" to get URL of active tab of front window"#,
            r#"tell application "Brave Browser" to get URL of active tab of front window"#,
            r#"tell application "Microsoft Edge" to get URL of active tab of front window"#,
            r#"tell application "Safari" to get URL of current tab of front window"#,
            r#"tell application "Chromium" to get URL of active tab of front window"#,
        ];

        for script in scripts {
            if let Some(url) = run_applescript(script) {
                if is_coding_problem_url(&url) {
                    return Some(url);
                }
            }
        }

        // Firefox: limited AppleScript — try window name sometimes contains URL
        if let Some(name) =
            run_applescript(r#"tell application "Firefox" to get name of front window"#)
        {
            if (name.starts_with("http://") || name.starts_with("https://"))
                && is_coding_problem_url(&name)
            {
                return Some(name);
            }
        }

        None
    }
}

/// Returns the foreground browser tab URL if it points to LeetCode / NeetCode / HackerRank problem pages.
pub fn get_active_browser_url() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        macos::active_problem_url()
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg(test)]
#[test]
fn detects_target_urls() {
    assert!(is_coding_problem_url(
        "https://leetcode.com/problems/two-sum/"
    ));
    assert!(is_coding_problem_url(
        "https://neetcode.io/problems/two-sum"
    ));
    assert!(is_coding_problem_url(
        "https://www.hackerrank.com/challenges/arrays-ds"
    ));
    assert!(!is_coding_problem_url("https://google.com"));
}
