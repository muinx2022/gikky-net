<#
.SYNOPSIS
    Script đăng ký 4 tác vụ Windows Task Scheduler cho Gikky Bot Trader.
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = "d:\Projects\gikky-net"
$RunnerScript = Join-Path $RootDir "scripts\bot-trader\chay_bot_theo_lich.ps1"

Write-Host ">>> Bat dau dang ky 4 tac vu GikkyBotTrader vao Windows Task Scheduler..." -ForegroundColor Cyan

# 1. GikkyBotTrader_Scan (09:30 T2-T6)
$task1Cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`" -HanhDong scan"
schtasks /create /tn "GikkyBotTrader_Scan" /tr "$task1Cmd" /sc WEEKLY /d MON,TUE,WED,THU,FRI /st 09:30 /f | Out-Null
Write-Host "[OK] Da tao task: GikkyBotTrader_Scan (09:30 Mon-Fri)" -ForegroundColor Green

# 2. GikkyBotTrader_Post (13:45 T2-T6)
$task2Cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`" -HanhDong post-scheduled"
schtasks /create /tn "GikkyBotTrader_Post" /tr "$task2Cmd" /sc WEEKLY /d MON,TUE,WED,THU,FRI /st 13:45 /f | Out-Null
Write-Host "[OK] Da tao task: GikkyBotTrader_Post (13:45 Mon-Fri)" -ForegroundColor Green

# 3. GikkyBotTrader_CheckEOD (15:20 T2-T6)
$task3Cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`" -HanhDong check-eod"
schtasks /create /tn "GikkyBotTrader_CheckEOD" /tr "$task3Cmd" /sc WEEKLY /d MON,TUE,WED,THU,FRI /st 15:20 /f | Out-Null
Write-Host "[OK] Da tao task: GikkyBotTrader_CheckEOD (15:20 Mon-Fri)" -ForegroundColor Green

# 4. GikkyBotTrader_CheckH4 (Moi 4 gio, bat dau tu 05:05 hang ngay)
$task4Cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`" -HanhDong check-h4"
schtasks /create /tn "GikkyBotTrader_CheckH4" /tr "$task4Cmd" /sc DAILY /st 05:05 /ri 240 /du 24:00 /f | Out-Null
Write-Host "[OK] Da tao task: GikkyBotTrader_CheckH4 (Every 4h from 05:05)" -ForegroundColor Green

# Cau hinh settings bo tro (cho phep chay tren pin va chay bu khi bi lo)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$tasks = @("GikkyBotTrader_Scan", "GikkyBotTrader_Post", "GikkyBotTrader_CheckEOD", "GikkyBotTrader_CheckH4")
foreach ($t in $tasks) {
    Set-ScheduledTask -TaskName $t -Settings $settings | Out-Null
}
Write-Host "[OK] Da cap nhat Power Management & StartWhenAvailable cho ca 4 task." -ForegroundColor Green
