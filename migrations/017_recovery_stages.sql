-- Migration 017: Abandoned Cart Recovery Stages + Discount Codes
-- Adds support for multi-stage recovery (1=24h, 2=72h, 3=7d) controlled by Super-Admin
-- Post-launch: configurable from Marketing → Automated Email Offers → Abandoned Cart Recovery

ALTER TABLE abandoned_carts ADD COLUMN recovery_stage INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN discount_code TEXT;
