-- Migration 018: Recovery Config — stores basket threshold + stage controls for D1 worker reads
-- Read by cron.ts; written by Super-Admin Marketing → Send Offers

CREATE TABLE IF NOT EXISTS recovery_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default values: basket threshold $150, stage 2 enabled, stage 3 enabled
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('basket_threshold_usd', '150');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('stage2_enabled', 'true');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('stage2_discount', '10');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('stage3_enabled', 'true');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('stage3_discount', '10');
INSERT OR IGNORE INTO recovery_config (key, value) VALUES ('discount_expiry_days', '60');
