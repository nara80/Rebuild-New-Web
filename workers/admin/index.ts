// MildMate Admin Worker
// Phase 7 will add: orders API, products API, image upload to R2, subscriber export

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/admin/health") {
      return new Response(JSON.stringify({ status: "ok", admin: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
