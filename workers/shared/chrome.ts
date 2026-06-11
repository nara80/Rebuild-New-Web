// ─── Shared Chrome Module ────────────────────────────────────────────────────
// Centralized header/footer from D1 site_templates table.
// Module-level cache persists across requests in the same Worker isolate.
// Cache TTL: 5 minutes. Admin updates invalidate cache immediately.

interface SiteTemplate {
  template_key: string;
  template_html: string;
  updated_at: string;
}

let _cache: { header?: string; footer?: string; fetchedAt: number } = { fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function ensureCache(db: any): Promise<void> {
  const now = Date.now();
  if (_cache.header && _cache.footer && (now - _cache.fetchedAt) < CACHE_TTL) return;

  try {
    const stmt = db.prepare(
      "SELECT template_key, template_html FROM site_templates WHERE template_key IN ('header-standard', 'footer-standard')"
    );
    const { results } = await stmt.all<SiteTemplate>();
    for (const row of results) {
      if (row.template_key === 'header-standard') _cache.header = row.template_html;
      if (row.template_key === 'footer-standard') _cache.footer = row.template_html;
    }
    _cache.fetchedAt = now;
  } catch (e) {
    console.error('chrome.ts: D1 fetch failed:', e);
  }
}

export async function getHeader(db: any): Promise<string> {
  await ensureCache(db);
  return _cache.header || '<!-- __HEADER_ERROR__ -->';
}

export async function getFooter(db: any): Promise<string> {
  await ensureCache(db);
  return _cache.footer || '<!-- __FOOTER_ERROR__ -->';
}

/** Admin: update a template row and invalidate cache. */
export async function updateTemplate(db: any, key: string, html: string): Promise<void> {
  await db.prepare(
    "INSERT OR REPLACE INTO site_templates (template_key, template_html, updated_at) VALUES (?, ?, datetime('now'))"
  ).bind(key, html).run();
  _cache.fetchedAt = 0;
}

/** Admin: list all templates. */
export async function getAllTemplates(db: any): Promise<SiteTemplate[]> {
  const { results } = await db.prepare(
    "SELECT template_key, template_html, updated_at FROM site_templates ORDER BY template_key"
  ).all<SiteTemplate>();
  return results;
}
