//! Security Module - Session Management & Authentication
//!
//! Handles user authentication, session management, and role-based access control.

use chrono::{DateTime, Utc};
use manchengo_core::{EntityId, UserRole};
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use thiserror::Error;

/// Security-related errors
#[derive(Error, Debug)]
pub enum SecurityError {
    #[error("Non authentifie - veuillez vous connecter")]
    NotAuthenticated,

    #[error("Acces refuse - role requis: {required:?}")]
    InsufficientRole { required: UserRole },

    #[error("Session expiree")]
    SessionExpired,

    #[error("Device non enregistre")]
    DeviceNotRegistered,

    #[error("Erreur interne de verrouillage")]
    InternalLockError,
}

/// Authenticated user information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatedUser {
    pub id: EntityId,
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub authenticated_at: DateTime<Utc>,
    /// JWT token for backend API calls
    pub token: Option<String>,
}

impl AuthenticatedUser {
    /// Check if user has required role or higher
    pub fn has_role(&self, required: UserRole) -> bool {
        self.role.can_access(&required)
    }

    /// Check if user can access a specific module
    pub fn can_access_module(&self, module: &str) -> bool {
        match module {
            "admin" => self.role == UserRole::Admin,
            "appro" => matches!(self.role, UserRole::Admin | UserRole::Appro),
            "production" => matches!(self.role, UserRole::Admin | UserRole::Production),
            "commercial" => matches!(self.role, UserRole::Admin | UserRole::Commercial),
            "comptable" => matches!(self.role, UserRole::Admin | UserRole::Comptable),
            _ => true, // Default modules accessible to all
        }
    }
}

/// Session manager for handling user authentication state
pub struct SessionManager {
    current_user: RwLock<Option<AuthenticatedUser>>,
    device_id: EntityId,
    device_token: RwLock<Option<String>>,
}

impl SessionManager {
    /// Create new session manager
    pub fn new(device_id: EntityId) -> Self {
        Self {
            current_user: RwLock::new(None),
            device_id,
            device_token: RwLock::new(None),
        }
    }

    /// Get device ID
    pub fn device_id(&self) -> EntityId {
        self.device_id
    }

    /// Login user
    pub fn login(&self, user: AuthenticatedUser) -> Result<(), SecurityError> {
        let mut current = self.current_user.write().map_err(|_| SecurityError::InternalLockError)?;
        *current = Some(user);
        Ok(())
    }

    /// Logout user
    pub fn logout(&self) -> Result<(), SecurityError> {
        let mut current = self.current_user.write().map_err(|_| SecurityError::InternalLockError)?;
        *current = None;

        let mut token = self.device_token.write().map_err(|_| SecurityError::InternalLockError)?;
        *token = None;

        Ok(())
    }

    /// Get current authenticated user (if any)
    pub fn current_user(&self) -> Option<AuthenticatedUser> {
        self.current_user
            .read()
            .ok()
            .and_then(|guard| guard.clone())
    }

    /// Require authenticated user or return error
    pub fn require_user(&self) -> Result<AuthenticatedUser, SecurityError> {
        self.current_user()
            .ok_or(SecurityError::NotAuthenticated)
    }

    /// Require user with specific role
    pub fn require_role(&self, required: UserRole) -> Result<AuthenticatedUser, SecurityError> {
        let user = self.require_user()?;

        if !user.has_role(required) {
            return Err(SecurityError::InsufficientRole { required });
        }

        Ok(user)
    }

    /// Set device token (for API authentication)
    pub fn set_device_token(&self, token: String) -> Result<(), SecurityError> {
        let mut device_token = self.device_token.write().map_err(|_| SecurityError::InternalLockError)?;
        *device_token = Some(token);
        Ok(())
    }

    /// Get device token
    pub fn get_device_token(&self) -> Option<String> {
        self.device_token
            .read()
            .ok()
            .and_then(|guard| guard.clone())
    }

    /// Check if user is logged in
    pub fn is_authenticated(&self) -> bool {
        self.current_user().is_some()
    }

    /// Get user's JWT token for API calls
    pub fn get_auth_token(&self) -> Option<String> {
        self.current_user()
            .and_then(|u| u.token.clone())
    }
}

// Extension trait for UserRole to check access hierarchy
trait UserRoleExt {
    fn can_access(&self, required: &UserRole) -> bool;
}

impl UserRoleExt for UserRole {
    fn can_access(&self, required: &UserRole) -> bool {
        match self {
            UserRole::Admin => true, // Admin can access everything
            _ => self == required,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_manager() {
        let device_id = EntityId::new();
        let manager = SessionManager::new(device_id);

        assert!(!manager.is_authenticated());
        assert!(manager.require_user().is_err());

        let user = AuthenticatedUser {
            id: EntityId::new(),
            email: "test@example.com".to_string(),
            name: "Test User".to_string(),
            role: UserRole::Admin,
            authenticated_at: Utc::now(),
            token: Some("test-token".to_string()),
        };

        manager.login(user).unwrap();
        assert!(manager.is_authenticated());
        assert!(manager.require_user().is_ok());

        manager.logout().unwrap();
        assert!(!manager.is_authenticated());
    }
}
