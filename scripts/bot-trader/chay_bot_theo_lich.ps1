<#
.SYNOPSIS
    Script dieu phoi va thuc thi Bot Trader theo lich trinh tu dong.
.DESCRIPTION
    Ho tro goi cac chuc nang: scan, post-scheduled, check-eod, check-h4.
    Tu dong ghi nhat ky (log) thoi gian bat dau, ket thuc va toan bo ket qua output vao file log.
.PARAMETER HanhDong
    Hanh dong can chay:
    - scan: Quet tin hieu toan dien (Co phieu VN va Quoc te H4).
    - post-scheduled: Dang bai trade theo lich luan phien.
    - check-eod: Kiem tra EOD sau 15h cho Co phieu VN (TP/SL/trailing).
    - check-h4: Kiem tra vi the H4 Quoc te (TP/SL/trailing).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('scan', 'post-scheduled', 'check-eod', 'check-h4')]
    [string]$HanhDong
)

# Thiet lap ma hoa UTF-8 cho console va moi truong
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# 1. Chuyen thu muc lam viec ve thu muc goc du an
$RootDir = "d:\Projects\gikky-net"
if (Test-Path -Path $RootDir) {
    Set-Location -Path $RootDir
} else {
    Write-Error "Khong tim thay thu muc goc du an: $RootDir"
    exit 1
}

# 2. Xac dinh trinh thong dich Python
$PythonExe = Join-Path $HOME ".venv\Scripts\python.exe"
if (-not (Test-Path -Path $PythonExe)) {
    $Command = Get-Command python -ErrorAction SilentlyContinue
    if ($Command) {
        $PythonExe = $Command.Source
    } else {
        $PythonExe = "python.exe"
    }
}

# 3. Anh xa tham so HanhDong sang co cua bot_trader_cli.py
$CliFlag = switch ($HanhDong) {
    'scan'           { '--scan' }
    'post-scheduled' { '--post-scheduled' }
    'check-eod'      { '--check-eod' }
    'check-h4'       { '--check-h4' }
    Default          { throw "Hanh dong '$HanhDong' khong hop le." }
}

# 4. Chuan bi thu muc logs va file bot_runner.log
$LogDir = Join-Path $RootDir "scripts\bot-trader\data\logs"
if (-not (Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "bot_runner.log"

$ScriptPath = Join-Path $RootDir "scripts\bot-trader\bot_trader_cli.py"
if (-not (Test-Path -Path $ScriptPath)) {
    Write-Error "Khong tim thay file: $ScriptPath"
    exit 1
}

# 5. Ghi nhan thoi gian bat dau
$StartTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$Banner = "================================================================================"
$StartMsg = "[$StartTime] [START] Action: $HanhDong | Flag: $CliFlag"

Add-Content -Path $LogFile -Value $Banner -Encoding utf8
Add-Content -Path $LogFile -Value $StartMsg -Encoding utf8
Write-Host $StartMsg -ForegroundColor Cyan

# 6. Thuc thi Python script va gom toan bo output
$OutputLines = & $PythonExe $ScriptPath $CliFlag 2>&1
$ExitCode = $LASTEXITCODE

if ($OutputLines) {
    foreach ($line in $OutputLines) {
        $lineStr = "$line"
        Add-Content -Path $LogFile -Value $lineStr -Encoding utf8
        Write-Host $lineStr
    }
}

# 7. Ghi nhan thoi gian hoan tat
$EndTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$StatusStr = if ($ExitCode -eq 0) { "SUCCESS" } else { "FAILED (ExitCode: $ExitCode)" }
$FinishMsg = "[$EndTime] [FINISH] Action: $HanhDong | Status: $StatusStr"

Add-Content -Path $LogFile -Value $FinishMsg -Encoding utf8
Add-Content -Path $LogFile -Value "$Banner`n" -Encoding utf8

if ($ExitCode -eq 0) {
    Write-Host $FinishMsg -ForegroundColor Green
} else {
    Write-Host $FinishMsg -ForegroundColor Red
}

exit $ExitCode