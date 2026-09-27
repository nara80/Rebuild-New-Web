import { handleSalesApi } from "../../../workers/api/sales";
import { handleGscApi } from "../../../workers/api/gsc";
import { handleGa4Api } from "../../../workers/api/ga4";
import { handleEtsyApi } from "../../../workers/api/etsy";
import { handleGoogleAdsApi } from "../../../workers/api/google-ads";

export const onRequest: PagesFunction<{
  DB: D1Database;
}> = async (context) => {
  const path = new URL(context.request.url).pathname.replace(/\/+$/, "");

  // Phase 09 — GSC collector endpoints under /api/v1/gsc/*
  if (path.startsWith("/api/v1/gsc") || path.startsWith("/v1/gsc")) {
    const gscRes = await handleGscApi(context.request, context.env);
    if (gscRes) return gscRes;
  }

  // Phase 10 — GA4 collector endpoints under /api/v1/ga4/*
  if (path.startsWith("/api/v1/ga4") || path.startsWith("/v1/ga4")) {
    const ga4Res = await handleGa4Api(context.request, context.env);
    if (ga4Res) return ga4Res;
  }

  // Phase 11 — Etsy listing analytics collector endpoints under /api/v1/etsy/*
  if (path.startsWith("/api/v1/etsy") || path.startsWith("/v1/etsy")) {
    const etsyRes = await handleEtsyApi(context.request, context.env);
    if (etsyRes) return etsyRes;
  }

  // Phase 12 — Google Ads paid-media collector endpoints under /api/v1/google-ads/*
  if (path.startsWith("/api/v1/google-ads") || path.startsWith("/v1/google-ads")) {
    const googleAdsRes = await handleGoogleAdsApi(context.request, context.env);
    if (googleAdsRes) return googleAdsRes;
  }

  const salesRes = await handleSalesApi(context.request, context.env);
  if (salesRes) return salesRes;

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};
