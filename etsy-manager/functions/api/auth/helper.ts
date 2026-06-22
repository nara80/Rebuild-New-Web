interface EtsyAuthRow {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_lock_acquired_at: number;
}

export async function getValidEtsyToken(db: D1Database, clientId: string, clientSecret?: string): Promise<string | null> {
  const LOCK_TIMEOUT = 10; // seconds
  const POLL_INTERVAL = 300; // milliseconds
  const MAX_POLLS = 15; // 4.5 seconds max wait time

  let pollCount = 0;
  
  while (pollCount < MAX_POLLS) {
    // 1. Fetch credentials from D1
    const authRecord = await db
      .prepare("SELECT access_token, refresh_token, expires_at, refresh_lock_acquired_at FROM etsy_auth WHERE id = 1")
      .first<EtsyAuthRow>();

    if (!authRecord) {
      return null; // Not authenticated yet
    }

    const now = Math.floor(Date.now() / 1000);

    // 2. If token is still valid (with a 60-second buffer), return it
    if (authRecord.expires_at > now + 60) {
      return authRecord.access_token;
    }

    // 3. Check lock status
    const lockAcquired = authRecord.refresh_lock_acquired_at || 0;
    if (lockAcquired > 0 && (now - lockAcquired) < LOCK_TIMEOUT) {
      // Another instance is actively refreshing. Sleep and retry.
      console.log(`Token refresh locked by another request. Retrying (${pollCount + 1}/${MAX_POLLS})...`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      pollCount++;
      continue;
    }

    // 4. Try to acquire the lock atomically
    const acquireRes = await db
      .prepare(
        `UPDATE etsy_auth 
         SET refresh_lock_acquired_at = ? 
         WHERE id = 1 AND (refresh_lock_acquired_at = 0 OR ? - refresh_lock_acquired_at >= ?)`
      )
      .bind(now, now, LOCK_TIMEOUT)
      .run();

    if (acquireRes.meta.changes === 0) {
      // Failed to acquire lock (another request acquired it just now). Loop and wait.
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      pollCount++;
      continue;
    }

    // 5. We successfully acquired the lock! Perform the refresh.
    console.log("Acquired token refresh lock. Refreshing token with Etsy...");
    const bodyParams = new URLSearchParams();
    bodyParams.append("grant_type", "refresh_token");
    bodyParams.append("client_id", clientId);
    if (clientSecret) {
      bodyParams.append("client_secret", clientSecret);
    }
    bodyParams.append("refresh_token", authRecord.refresh_token);

    try {
      const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: bodyParams.toString()
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Token refresh failed: ${errText}`);
        
        // Release lock on failure
        await db.prepare("UPDATE etsy_auth SET refresh_lock_acquired_at = 0 WHERE id = 1").run();
        return null;
      }

      const tokenData = (await res.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const newExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // 6. Save new credentials and release lock
      await db.prepare(
        `UPDATE etsy_auth 
         SET access_token = ?, refresh_token = ?, expires_at = ?, refresh_lock_acquired_at = 0 
         WHERE id = 1`
      )
        .bind(tokenData.access_token, tokenData.refresh_token, newExpiresAt)
        .run();

      return tokenData.access_token;
    } catch (error) {
      console.error("Token refresh operation encountered an error:", error);
      // Release lock on error
      await db.prepare("UPDATE etsy_auth SET refresh_lock_acquired_at = 0 WHERE id = 1").run();
      return null;
    }
  }

  console.error("Maximum retry poll limit reached for token refresh.");
  return null;
}
