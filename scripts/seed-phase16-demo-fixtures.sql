-- Phase 16 TEST/DEMO workflow fixtures — PREVIEW D1 ONLY (mildmate-db).
-- Clearly labeled manual fixtures; never AI-generated; never for production.
-- Re-running this file is the documented RESET: it removes every TEST/DEMO row
-- (including temporary TEST-DEMO-FIXTURE-SIM rows) and restores the three
-- canonical fixtures to their initial states
-- (proposed / proposed / approved with budget 3000 THB).
DELETE FROM marketing_actions WHERE ai_model LIKE 'TEST-DEMO-FIXTURE%';

INSERT INTO marketing_actions (action_date, source, ai_model, status, product_id, channel, action_type, title, detail, recommendation_json, baseline_metrics_json, approved_budget, budget_currency, success_target, confidence, caution, caution_note, review_date)
VALUES
('2026-11-07','human','TEST-DEMO-FIXTURE','proposed',1,'seo','push_product',
 '[TEST/DEMO] Refresh Standard Fitted Sheet product copy (owner approval workflow test)',
 'MANUAL TEST FIXTURE - NOT AI-GENERATED. Illustrative recommendation to exercise the approval workflow on the isolated preview.',
 '{"product_id":1,"action":"push_product","channel":"seo","budget_test":"THB 0 (organic)","success_target":"baseline comparison only","confidence":80,"test_fixture":true}',
 NULL,
 NULL,'THB','Illustrative only: +10% organic sessions in 30 days',80,0,'Fixture data - not a real insight','2026-12-07'),
('2026-11-07','human','TEST-DEMO-FIXTURE','proposed',2,'google-ads','campaign',
 '[TEST/DEMO] Deep Pocket Fitted Sheet Ads test (owner rejection workflow test)',
 'MANUAL TEST FIXTURE - NOT AI-GENERATED. Illustrative recommendation to exercise the rejection workflow on the isolated preview. Google Ads purchase attribution is UNVERIFIED (Phase 12 open).',
 '{"product_id":2,"action":"campaign","channel":"google-ads","budget_test":"THB 3000 test envelope","success_target":"baseline comparison only","confidence":55,"test_fixture":true,"caution":"google_ads_attribution_unverified"}',
 NULL,
 NULL,'THB','Illustrative only: 2 attributed purchases in 30 days',55,1,'Google Ads purchase attribution remains UNVERIFIED (Phase 12 open) - fixture reflects the forced caution flag','2026-12-07'),
('2026-11-07','human','TEST-DEMO-FIXTURE','approved',3,'','content',
 '[TEST/DEMO] Marine Fitted Sheet content update (owner post-action review test)',
 'MANUAL TEST FIXTURE - NOT AI-GENERATED. Pre-approved illustrative row so the owner can exercise the post-action review (result classification) step.',
 '{"product_id":3,"action":"content","channel":"","budget_test":"THB 3000","success_target":"baseline comparison only","confidence":70,"test_fixture":true}',
 '{"opportunity_note":"illustrative baseline snapshot - fixture","sessions_30d_baseline":1000}',
 '3000','THB','Illustrative only: +5% marine page sessions in 30 days',70,0,NULL,'2026-12-14');
