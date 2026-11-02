param(
  [string]$Database = "mildmate-db-prod",
  [switch]$Skip055
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "D:\00_mildmate\re-build_web"

function Invoke-D1Sql {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $stmt = $Sql.Trim()
  if (-not $stmt.EndsWith(";")) { $stmt += ";" }
  $tmpFile = Join-Path $env:TEMP ("mildmate-d1-" + [guid]::NewGuid().ToString() + ".sql")
  Set-Content -LiteralPath $tmpFile -Value $stmt -Encoding UTF8
  Write-Host "[$Label] running..."
  try {
    # Use cmd /c so Wrangler stderr does not become a terminating PowerShell error record.
    $cmd = "npx wrangler d1 execute $Database --remote --file `"$tmpFile`" 2>&1"
    $output = cmd /c $cmd
    $text = ($output | Out-String)

    if ($LASTEXITCODE -ne 0) {
      if ($text -match "duplicate column name" -or $text -match "already exists") {
        Write-Host "[$Label] skipped benign: $($matches[0])"
        return
      }
      Write-Host $text
      throw "Failed at: $Label"
    }
  } finally {
    Remove-Item -LiteralPath $tmpFile -Force -ErrorAction SilentlyContinue
  }
}

# 054_opportunity_engine.sql
Invoke-D1Sql -Label "054-1 add modeled_price_thb" -Sql @"
ALTER TABLE cost_model_products ADD COLUMN modeled_price_thb REAL;
"@

Invoke-D1Sql -Label "054-2 create opportunity_score_models" -Sql @"
CREATE TABLE IF NOT EXISTS opportunity_score_models (
  model_version TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"@

Invoke-D1Sql -Label "054-3 seed model v1" -Sql @"
INSERT OR IGNORE INTO opportunity_score_models (model_version, weights_json, notes)
VALUES (
  'v1',
  json_object(
    'momentum',30,
    'profitability',30,
    'channel_fit',20,
    'demand',15,
    'strategic',5,
    'conversion',0,
    'demand_ga4',80,
    'demand_gsc',20
  ),
  'Phase 14 v1'
);
"@

Invoke-D1Sql -Label "054-4 create opportunity_scores" -Sql @"
CREATE TABLE IF NOT EXISTS opportunity_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score_date TEXT NOT NULL,
  score_model_version TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  score REAL,
  rank INTEGER,
  tier TEXT NOT NULL,
  confidence REAL,
  components_json TEXT NOT NULL DEFAULT '{}',
  available_weight REAL NOT NULL DEFAULT 0,
  missing_components TEXT NOT NULL DEFAULT '',
  reasons TEXT NOT NULL DEFAULT '',
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(score_date, score_model_version, product_id, channel)
);
"@

Invoke-D1Sql -Label "054-5 idx latest" -Sql @"
CREATE INDEX IF NOT EXISTS idx_opportunity_scores_latest
ON opportunity_scores(score_model_version, score_date DESC, channel, rank);
"@

Invoke-D1Sql -Label "054-6 idx product" -Sql @"
CREATE INDEX IF NOT EXISTS idx_opportunity_scores_product
ON opportunity_scores(product_id, score_date DESC);
"@

if (-not $Skip055) {
  # 055_ga4_multi_property.sql (idempotent-safe subset for failed/partial runs)
  Invoke-D1Sql -Label "055-1 add property_id" -Sql @"
ALTER TABLE ga4_funnel_daily ADD COLUMN property_id TEXT NOT NULL DEFAULT '366290587';
"@

  Invoke-D1Sql -Label "055-2 add property_scope" -Sql @"
ALTER TABLE ga4_funnel_daily ADD COLUMN property_scope TEXT NOT NULL DEFAULT 'website';
"@

  Invoke-D1Sql -Label "055-3 add listing_id" -Sql @"
ALTER TABLE ga4_funnel_daily ADD COLUMN listing_id TEXT;
"@
}

Write-Host "`n--- Verification ---"
npx wrangler d1 execute $Database --remote --command "SELECT name, type FROM sqlite_master WHERE name IN ('opportunity_score_models','opportunity_scores','idx_opportunity_scores_latest','idx_opportunity_scores_product') ORDER BY name;"
npx wrangler d1 execute $Database --remote --command "PRAGMA table_info(ga4_funnel_daily);"

Write-Host "`nDone."
