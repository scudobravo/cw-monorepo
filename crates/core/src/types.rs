use serde::{Deserialize, Serialize};

/// Vertical product identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Product {
    DevOracle,
    RingWise,
}

/// Session mode for DevOracle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InterviewMode {
    MockInterview,
    BehavioralTech,
    CodingInterview,
    SystemDesign,
}

/// Session mode for RingWise
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallMode {
    SalesCall,
    Discovery,
    Demo,
    Negotiation,
    FollowUp,
}

/// Unified session mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "product", content = "mode")]
pub enum SessionMode {
    DevOracle(InterviewMode),
    RingWise(CallMode),
}

/// Type of suggestion the AI can produce
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionType {
    Hint,
    Explanation,
    NextResponse,
    ObjectionHandling,
    Summary,
    Recap,
    Scorecard,
}

/// Channel for delivering suggestions in stealth mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StealthOutputChannel {
    SecondScreen,
    Overlay,
    Haptic,
    SystemTray,
}
