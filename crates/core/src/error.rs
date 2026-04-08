use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Audio error: {0}")]
    Audio(String),

    #[error("Session error: {0}")]
    Session(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Auth error: {0}")]
    Auth(String),

    #[error("Entitlement error: {0}")]
    Entitlement(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Stealth error: {0}")]
    Stealth(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
