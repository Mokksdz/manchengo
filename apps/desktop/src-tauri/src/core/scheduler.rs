//! Background Scheduler
//!
//! Manages background tasks like sync, expiry checks, and connectivity monitoring.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{error, info, warn};

/// Background task scheduler
pub struct BackgroundScheduler {
    running: Arc<AtomicBool>,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl BackgroundScheduler {
    /// Create a new scheduler (not started)
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: None,
        }
    }

    /// Check if scheduler is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Start the background scheduler with given tasks
    pub fn start<F1, F2, F3>(
        &mut self,
        sync_interval: Duration,
        expiry_interval: Duration,
        connectivity_interval: Duration,
        sync_task: F1,
        expiry_task: F2,
        connectivity_task: F3,
    ) where
        F1: Fn() + Send + Sync + 'static,
        F2: Fn() + Send + Sync + 'static,
        F3: Fn() + Send + Sync + 'static,
    {
        if self.running.load(Ordering::SeqCst) {
            warn!("Scheduler already running");
            return;
        }

        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx);
        self.running.store(true, Ordering::SeqCst);

        let running = self.running.clone();
        let sync_task = Arc::new(sync_task);
        let expiry_task = Arc::new(expiry_task);
        let connectivity_task = Arc::new(connectivity_task);
        let sync_running = Arc::new(AtomicBool::new(false));

        tokio::spawn(async move {
            let mut sync_timer = interval(sync_interval);
            let mut expiry_timer = interval(expiry_interval);
            let mut connectivity_timer = interval(connectivity_interval);

            info!(
                "Background scheduler started: sync={}s, expiry={}s, connectivity={}s",
                sync_interval.as_secs(),
                expiry_interval.as_secs(),
                connectivity_interval.as_secs()
            );

            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => {
                        info!("Scheduler shutdown requested");
                        break;
                    }
                    _ = sync_timer.tick() => {
                        if running.load(Ordering::SeqCst) && !sync_running.load(Ordering::SeqCst) {
                            sync_running.store(true, Ordering::SeqCst);
                            let task = sync_task.clone();
                            let flag = sync_running.clone();
                            tokio::task::spawn_blocking(move || {
                                task();
                                flag.store(false, Ordering::SeqCst);
                            });
                        }
                    }
                    _ = expiry_timer.tick() => {
                        if running.load(Ordering::SeqCst) {
                            let task = expiry_task.clone();
                            tokio::task::spawn_blocking(move || {
                                task();
                            });
                        }
                    }
                    _ = connectivity_timer.tick() => {
                        if running.load(Ordering::SeqCst) {
                            let task = connectivity_task.clone();
                            tokio::task::spawn_blocking(move || {
                                task();
                            });
                        }
                    }
                }
            }

            running.store(false, Ordering::SeqCst);
            info!("Scheduler stopped");
        });
    }

    /// Stop the scheduler
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.blocking_send(());
        }
        self.running.store(false, Ordering::SeqCst);
    }
}

impl Default for BackgroundScheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for BackgroundScheduler {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Simple task that can be scheduled
pub struct ScheduledTask {
    pub name: String,
    pub interval: Duration,
    pub enabled: bool,
}

impl ScheduledTask {
    pub fn new(name: &str, interval_secs: u64) -> Self {
        Self {
            name: name.to_string(),
            interval: Duration::from_secs(interval_secs),
            enabled: true,
        }
    }

    pub fn disable(&mut self) {
        self.enabled = false;
    }

    pub fn enable(&mut self) {
        self.enabled = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    #[tokio::test]
    async fn test_scheduler_creation() {
        let scheduler = BackgroundScheduler::new();
        assert!(!scheduler.is_running());
    }
}
