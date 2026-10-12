$ErrorActionPreference = "Continue"
$preview = "https://62a9de4c.mildmate-new.pages.dev/super-admin/marketing/data-analyst/"
Write-Output "=== preview data-analyst page (unauthenticated) ==="
try {
  $r = Invoke-WebRequest -Uri $preview -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 30
  Write-Output "HTTP $($r.StatusCode)"
  Write-Output "final URL: $($r.BaseResponse.ResponseUri)"
  $c = $r.Content
  Write-Output "contains gs-details CSS: $($c.Contains('gs-details'))"
  Write-Output "contains scoped nowrap override: $($c.Contains('#growth-signals-table td{white-space:normal'))"
  Write-Output "contains growthStructuredHtml: $($c.Contains('growthStructuredHtml'))"
  $needle = 'Full JSON ('
  Write-Output "contains disclosure label: $($c.Contains($needle))"
} catch {
  Write-Output "HTTP error: $($_.Exception.Message)"
  $resp = $_.Exception.Response
  if ($resp) { Write-Output "status: $([int]$resp.StatusCode) $($resp.ResponseUri)" }
}
Write-Output "=== production unchanged ==="
$h = Invoke-WebRequest -Uri "https://www.mildmate.com" -UseBasicParsing -TimeoutSec 30
Write-Output "www.mildmate.com HTTP $($h.StatusCode)"
$m = Invoke-WebRequest -Uri "https://www.mildmate.com/api/auth/me" -UseBasicParsing -TimeoutSec 30
Write-Output "/api/auth/me HTTP $($m.StatusCode)"
