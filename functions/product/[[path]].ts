const CANONICAL_PRODUCT_SLUGS = new Set([
  'standard-fitted-sheet',
  'deep-pocket-fitted-sheet',
  'marine-fitted-sheet',
  'dorm-fitted-sheet',
  'rv-truck-fitted-sheet',
  'family-fitted-sheet',
  'pet-owner-fitted-sheet',
  'flat-sheet-standard',
  'flat-sheet-extra-deep-pocket',
  '3-sided-duvet',
  'pet-owner-duvet-cover',
  'duvet-cover-marine',
  'duvet-cover-rv',
  'duvet-cover-dorm',
  'duvet-insert',
  'pillowcase-envelope',
  'pillowcase-zipper',
  'pillowcase-sham',
  'mattress-protector-standard',
  'mattress-protector-family',
  'mattress-protector-deep-pocket',
  'pet-proof-mattress-protector',
  'mattress-encasement-general',
  'rv-truck-mattress-encasement',
  'pillow-protector-general',
  'bedbridge-connector',
  'mattress-lift-helper'
]);

function hasToken(slug: string, token: string): boolean {
  return new RegExp(`(^|[-/])${token}($|[-/])`).test(slug);
}

function resolveLegacyProduct(slug: string): string {
  if (slug === '%e0%b9%84%e0%b8%aa%e0%b9%89%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%99%e0%b8%a7%e0%b8%a1') return '/product/duvet-insert/';
  if (slug.startsWith('%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%9b%e0%b8%b9')) return '/product/family-fitted-sheet/';
  if (slug.startsWith('product-boat-bedding') || slug.startsWith('product-boat-top-sheet')) return '/product/marine-fitted-sheet/';
  if (slug.includes('boat') && slug.includes('pillow')) return '/product/pillowcase-envelope/';

  if (slug.includes('dorm')) return slug.includes('duvet') ? '/product/duvet-cover-dorm/' : '/product/dorm-fitted-sheet/';
  if (slug.includes('rv-truck') || hasToken(slug, 'rv') || slug.includes('truck')) {
    if (slug.includes('duvet')) return '/product/duvet-cover-rv/';
    if (slug.includes('encasement')) return '/product/rv-truck-mattress-encasement/';
    return '/product/rv-truck-fitted-sheet/';
  }
  if (slug.includes('marine') || slug.includes('boat')) return slug.includes('duvet') ? '/product/duvet-cover-marine/' : '/product/marine-fitted-sheet/';

  if (slug.includes('pet')) {
    if (slug.includes('duvet') || slug.includes('3-sided')) return '/product/pet-owner-duvet-cover/';
    if (slug.includes('protector')) return '/product/pet-proof-mattress-protector/';
    if (slug.includes('pillow')) return '/product/pillowcase-zipper/';
    return '/product/pet-owner-fitted-sheet/';
  }

  if (slug.includes('co-sleeping') || slug.includes('family')) return '/product/family-fitted-sheet/';
  if (slug.includes('duvet')) return '/product/3-sided-duvet/';
  if (slug.includes('encasement') || slug.includes('zippered-tpu-mattress-cover')) return '/product/mattress-encasement-general/';
  if (slug.includes('sheet-protectors') || slug.includes('protector') || slug === 'pillow-case') return '/product/mattress-protector-standard/';

  if (slug.includes('pillow') || slug.includes('pillowcase') || slug.includes('pillow-cover') || slug.includes('pillow-case')) {
    if (slug.includes('sham') || slug.includes('vent')) return '/product/pillowcase-sham/';
    if (slug.includes('zip') || slug.includes('hidden-zipper')) return '/product/pillowcase-zipper/';
    return '/product/pillowcase-envelope/';
  }

  if (slug.includes('fitted') || slug.includes('bed-sheet') || slug.includes('bedsheet')) return '/product/standard-fitted-sheet/';
  if (slug === 'tbar') return '/product/bedbridge-connector/';
  if (slug === 'mattress-lift-helper') return '/product/mattress-lift-helper/';
  if (slug === 'baby-blanket' || slug === 'animal-bedding') return '/products/';
  return '/products/';
}

export async function onRequest(context: any): Promise<Response> {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname === '/product' || pathname === '/product/') {
    return Response.redirect(new URL('/products/', url.origin).toString(), 301);
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'product') return context.next();

  const slug = (parts[1] || '').toLowerCase();
  if (!slug) {
    return Response.redirect(new URL('/products/', url.origin).toString(), 301);
  }

  if (CANONICAL_PRODUCT_SLUGS.has(slug)) return context.next();

  const target = resolveLegacyProduct(slug);
  return Response.redirect(new URL(target, url.origin).toString(), 301);
}
