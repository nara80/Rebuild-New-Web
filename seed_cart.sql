DELETE FROM abandoned_carts WHERE email='mildmatelaz@gmail.com';
     DELETE FROM discount_claims WHERE email='mildmatelaz@gmail.com';

     INSERT INTO abandoned_carts (email, cart_json, recovered, recovery_stage, created_at)
     VALUES (
       'mildmatelaz@gmail.com',
       '[{"name":"Family Fitted Sheet","price_usd":73},{"name":"3-Sided Duvet Cover","price_usd":130}]',
       0, 0, datetime('now','-25 hours')
     );