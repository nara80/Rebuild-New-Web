$ErrorActionPreference = 'Stop'
cd D:\00_mildmate\Re-Build_web

# Build to a TEMP file so public\_worker.js is never left as raw formdata.
# (The old version wrote formdata straight to public\_worker.js; if extraction
#  failed, the junk file poisoned every later build AND a --no-bundle deploy
#  would have shipped the formdata as the Worker script.)

$path = 'public\_worker.js'

# If the existing _worker.js is leftover formdata junk (failed earlier run),
# remove it so the build cannot try to parse it as an entry point.
if (Test-Path $path) {
    $first = Get-Content $path -TotalCount 1
    if ($first -like '------formdata-undici-*') {
        Write-Host "Removing leftover formdata junk from $path"
        Remove-Item $path -Force
    }
}

$temp = Join-Path $env:TEMP ("worker-build-" + [guid]::NewGuid().ToString('N') + ".js")
$out = npx wrangler pages functions build --outfile $temp 2>&1
$out | Out-Host

if (-not (Test-Path $temp)) { Write-Error 'Build did not produce an output file'; exit 1 }
$content = [System.IO.File]::ReadAllText($temp)

if ($content.StartsWith('------formdata-undici-')) {
    # The output file is formdata multipart, not valid JS. Extract the JS portion.
    $marker = 'Content-Type: application/javascript+module'
    $markerIdx = $content.IndexOf($marker)
    if ($markerIdx -lt 0) {
        $marker = 'Content-Type: text/javascript'
        $markerIdx = $content.IndexOf($marker)
    }
    if ($markerIdx -lt 0) {
        Write-Error 'Could not find JS content-type marker in wrangler output'
        exit 1
    }
    # Skip past the marker line
    $jsStart = $markerIdx + $marker.Length
    # Skip the empty line after the marker
    while ($jsStart -lt $content.Length -and ($content[$jsStart] -eq "`r" -or $content[$jsStart] -eq "`n" -or $content[$jsStart] -eq ' ')) {
        $jsStart++
    }
    # Find next formdata boundary
    $boundaryMarker = '------formdata-undici-'
    $boundaryIdx = $content.IndexOf($boundaryMarker, $jsStart)
    $jsLen = if ($boundaryIdx -gt 0) { $boundaryIdx - $jsStart - 2 } else { $content.Length - $jsStart }
    $js = $content.Substring($jsStart, $jsLen).TrimEnd()
    [System.IO.File]::WriteAllText($path, $js, [System.Text.Encoding]::UTF8)
    Write-Host "Extracted valid JS: $($js.Length) chars -> $path"
} else {
    # Output is already plain JS
    [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Output is already plain JS: $($content.Length) chars -> $path"
}

Remove-Item $temp -Force
