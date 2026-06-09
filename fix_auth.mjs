import re

filepath = r'D:\00_MildMate\Re-Build_Web\public\admin\blog.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = """    // ── Auth: wait for Clerk to be ready ─────────────────────────
    toast('Signing in…');
    var clerkToken = null;
    var waited = 0;
    var waitStep = 200;

    // Poll until Clerk session is available (or Clerk is definitively unavailable)
    while (waited < 10000) {
      if (typeof window.getClerkToken === 'function') {
        try {
          clerkToken = await window.getClerkToken();
          if (clerkToken) break; // Got a token
        } catch (e) { /* keep waiting */ }
      }
      // Clerk not ready yet — wait
      await new Promise(function(r) { setTimeout(r, waitStep); });
      waited += waitStep;
      waitStep = Math.min(waitStep * 1.5, 2000); // back off to max 2s
    }

    if (!clerkToken) {
      toast('Sign in required. Open /admin/super-admin.html to sign in, then return here.');
      return;
    }

    toast('Uploading to CDN…');
    // Send BOTH Clerk Bearer and X-Admin-Secret — Worker accepts either on non-production hosts.
    // Clerk JWT works if user signed in via Clerk. admin_secret works if user set it in super-admin.html settings.
    var headers = { 'Authorization': 'Bearer ' + clerkToken };
    var adminSecret = getSecret();
    if (adminSecret) headers['X-Admin-Secret'] = adminSecret;"""

new = """    // ── Auth ──────────────────────────────────────────────────────────
    // blog.html is accessed from super-admin context. Try Clerk JWT (1.5s timeout) AND admin_secret
    // from localStorage (set in super-admin.html settings). The Worker accepts either on pages.dev.
    toast('Uploading…');
    var clerkToken = null;
    var adminSecret = getSecret();

    // Try Clerk token with a 1.5s timeout — Clerk may not be signed in on blog.html
    if (typeof window.getClerkToken === 'function') {
      clerkToken = await Promise.race([
        window.getClerkToken(),
        new Promise(function(_, reject) { setTimeout(function() { reject(new Error('clerk-timeout')); }, 1500); }
      ]).catch(function() { return null; });
    }

    // Build headers: Clerk Bearer if token available, admin_secret fallback from super-admin settings
    var headers = {};
    if (clerkToken && clerkToken.trim()) headers['Authorization'] = 'Bearer ' + clerkToken;
    if (adminSecret) headers['X-Admin-Secret'] = adminSecret;
    if (Object.keys(headers).length === 0) {
      toast('No auth available. Open super-admin.html first to sign in or set admin secret.');
      return;
    }"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('NOT FOUND - checking partial...')
    # Try to find similar text
    idx = content.find('Auth: wait for Clerk')
    if idx >= 0:
        print(f'Found partial at index {idx}')
        print(repr(content[idx:idx+200]))
    else:
        print('Partial not found either')
