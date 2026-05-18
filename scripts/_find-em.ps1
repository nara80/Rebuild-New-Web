$bytes = [System.IO.File]::ReadAllBytes('D:\00_MildMate\Re-Build_Web\public\products\index.html')
for ($i = 0; $i -lt $bytes.Length - 2; $i++) {
    if ($bytes[$i] -eq 0xE2 -and $bytes[$i+1] -eq 0x80 -and $bytes[$i+2] -eq 0x94) {
        $start = [Math]::Max(0, $i - 20)
        $end = [Math]::Min($bytes.Length - 1, $i + 20)
        $context = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $end - $start + 1)
        Write-Host "em-dash (UTF8 E2 80 94) at byte $i"
        Write-Host "Context: $context"
    }
    if ($bytes[$i] -eq 0xC3 -and $bytes[$i+1] -eq 0xA2) {
        $start = [Math]::Max(0, $i - 20)
        $end = [Math]::Min($bytes.Length - 1, $i + 20)
        $context = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $end - $start + 1)
        Write-Host "UTF8 A2 (â) at byte $i"
        Write-Host "Context: $context"
    }
}
Write-Host "Done scanning"
