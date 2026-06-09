$filepath = 'D:\00_MildMate\Re-Build_Web\public\admin\blog.html'
$content = [System.IO.File]::ReadAllText($filepath, [System.Text.Encoding]::UTF8)

# Find the auth block: look for the unique ASCII line that ENDS the auth section
$endMarker = "headers['Authorization'] = 'Bearer ' + clerkToken"
$endIdx = $content.IndexOf($endMarker)
if ($endIdx -lt 0) {
    Write-Host "END MARKER NOT FOUND"
    exit 1
}
Write-Host "End marker found at $endIdx"

# Find the start of that line
$endLineStart = $endIdx
while ($endLineStart -gt 0 -and $content[$endLineStart - 1] -ne "`n") { $endLineStart-- }

# Find "// Auth: wait for Clerk" backwards from endIdx
$authComment = "// Auth: wait for Clerk"
$authIdx = $content.LastIndexOf($authComment, $endIdx)
if ($authIdx -lt 0) { Write-Host "AUTH START NOT FOUND"; exit 1 }
Write-Host "Auth start at $authIdx"

# Find the start of that line
$authStart = $authIdx
while ($authStart -gt 0 -and $content[$authStart - 1] -ne "`n") { $authStart-- }
Write-Host "Auth block from $authStart to $($endLineStart + $endMarker.Length)"

$oldBlock = $content.Substring($authStart, $endLineStart + $endMarker.Length - $authStart)
Write-Host "Old block length: $($oldBlock.Length) chars"
Write-Host "Old block (first 100): $($oldBlock.Substring(0, [Math]::Min(100, $oldBlock.Length))"

$newBlock = @"
// Auth: try Clerk JWT (1.5s timeout) + admin_secret from super-admin settings
    // blog.html is accessed via super-admin. Worker accepts either auth on pages.dev.
    toast('Uploading…');
    var clerkToken = null;
    var adminSecret = getSecret();

    // Clerk JWT with 1.5s timeout \u2014 Clerk may not be signed in on blog.html
    if (typeof window.getClerkToken === 'function') {
      clerkToken = await Promise.race([
        window.getClerkToken(),
        new Promise(function(_, reject) { setTimeout(function() { reject(new Error('clerk-timeout')); }, 1500); }
      ]).catch(function() { return null; });
    }

    // Clerk Bearer if available; admin_secret fallback from super-admin settings
    var headers = {};
    if (clerkToken && clerkToken.trim()) headers['Authorization'] = 'Bearer ' + clerkToken;
    if (adminSecret) headers['X-Admin-Secret'] = adminSecret;
    if (Object.keys(headers).length === 0) {
      toast('No auth. Open super-admin.html to sign in or set admin secret, then return here.');
      return;
    }
"@

$newContent = $content.Substring(0, $authStart) + $newBlock + $content.Substring($endLineStart + $endMarker.Length)
[System.IO.File]::WriteAllText($filepath, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "SUCCESS: replaced auth block"
