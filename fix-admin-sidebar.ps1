$f = "D:\00_MildMate\Re-Build_Web\public\admin\sandbox\admin.html"
$c = Get-Content $f -Raw
$old = @'
    <div class="sidebar-section">Admin Features</div>
    <a href="#" data-page="marketing"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Marketing</a>
    <a href="#" data-page="products">
'@
$new = @'
    <a href="#" data-page="marketing"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Marketing</a>
    <div class="sidebar-section">Admin Features</div>
    <a href="#" data-page="products">
'@
if ($c.Contains($old)) {
    $c = $c.Replace($old, $new)
    Set-Content $f -Value $c -NoNewline
    Write-Output "Replaced CRLF"
} else {
    Write-Output "Pattern not found - trying LF"
    $old2 = $old.Replace("`r`n", "`n")
    $new2 = $new.Replace("`r`n", "`n")
    if ($c.Contains($old2)) {
        $c = $c.Replace($old2, $new2)
        Set-Content $f -Value $c -NoNewline
        Write-Output "Replaced LF"
    } else {
        Write-Output "NOT FOUND"
    }
}
