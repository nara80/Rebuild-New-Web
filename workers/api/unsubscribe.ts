export interface UnsubscribeRequest {
  email: string;
}

export default async function handleUnsubscribe(
  request: Request,
  env: { DB: D1Database }
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: UnsubscribeRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ message: 'Valid email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Delete from subscribers table — returns info about deleted rows
    const result = await env.DB.prepare(
      'DELETE FROM subscribers WHERE email = ?'
    )
      .bind(email)
      .run();

    // Also update contacts table — unmark as subscribed but keep the record
    try {
      await env.DB.prepare(
        "UPDATE contacts SET is_subscribed = 0, sources = TRIM(REPLACE(REPLACE(REPLACE(sources, ',subscribe', ''), 'subscribe,', ''), 'subscribe', ''), ','), last_seen = datetime('now') WHERE email = ?"
      ).bind(email).run();
    } catch (e) { /* contacts table may not exist in older environments */ }

    // D1 returns meta.changes for number of rows affected
    const changes = (result as any).meta?.changes ?? 0;

    if (changes === 0) {
      // Email not found — still return success to avoid revealing who is subscribed
      return new Response(
        JSON.stringify({
          message:
            'If this email was subscribed to MildMate marketing emails, it has been removed.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        message:
          'You have been successfully unsubscribed from MildMate marketing emails.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    console.error('Unsubscribe error:', err);
    return new Response(
      JSON.stringify({ message: 'Database error. Please try again later.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
