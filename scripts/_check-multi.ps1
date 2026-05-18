$bytes = [System.IO.File]::ReadAllBytes('D:\00_MildMate\Re-Build_Web\public\duvet-covers\index.html')
for ($i = 35240; $i -lt 35280; $i++) {
    Write-Host ("Byte $i : " + $bytes[$i] + " (0x" + [System.Convert]::ToString($bytes[$i], 16) + ")")
}
