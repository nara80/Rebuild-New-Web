$f = "D:\00_MildMate\Re-Build_Web\public\admin\super-admin.html"
$c = Get-Content $f -Raw
$newBlog = @"

function rBlog() {
  window.open('/admin/blog.html', '_blank');
  return '<div class="card"><div class="card-header">Blog</div><div class="card-body"><p style="color:var(--c-muted);text-align:center;padding:40px">Opening blog manager... <a href="/admin/blog.html" target="_blank">Click here if nothing happens.</a></p></div></div>';
}
"@
# Find the blog section start and replace everything from it to the end of the file's blog functions
$start = $c.IndexOf("// ── Blog Posts Admin ──────────────────────────────")
if ($start -eq -1) {
    Write-Host "Blog section not found"
    exit 1
}
$before = $c.Substring(0, $start)
$newContent = $before + $newBlog
[System.IO.File]::WriteAllText($f, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done, new length: $($newContent.Length)"
