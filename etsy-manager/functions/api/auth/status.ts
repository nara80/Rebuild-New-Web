import { getValidEtsyToken } from "./helper";

interface Env {
  ETSY_CLIENT_ID: string;
  ETSY_CLIENT_SECRET: string;
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const token = await getValidEtsyToken(env.DB, env.ETSY_CLIENT_ID, env.ETSY_CLIENT_SECRET);
    
    return new Response(
      JSON.stringify({ authenticated: token !== null }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ authenticated: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
