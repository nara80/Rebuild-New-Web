import { handleSalesApi } from "../../workers/api/sales";

export const onRequest: PagesFunction<{
  DB: D1Database;
}> = async (context) => {
  const res = await handleSalesApi(context.request, context.env);
  if (res) return res;
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};
