$ErrorActionPreference = 'Stop'
cd D:\00_mildmate\Re-Build_web

# Run wrangler and capture output
$out = npx wrangler pages functions build --outfile 'public\_worker.js' 2>&1
$out | Out-Host

# The output file is formdata multipart, not valid JS. Extract the JS portion.
$path = 'public\_worker.js'
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

if ($content.StartsWith('------formdata-undici-')) {
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
    Write-Host "Output is already plain JS: $($content.Length) chars"
}
