$ErrorActionPreference = "Stop"
$vbs = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\7AirTravels-ATFS-Worker.vbs"
if (-not (Test-Path $vbs)) { throw "Missing $vbs" }
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "7AirTravels-ATFS-Worker" -Action $action -Trigger $trigger -Principal $principal -Description "Starts the attendance worker when this user signs in." -Force | Out-Null
Get-ScheduledTask -TaskName "7AirTravels-ATFS-Worker" | Select-Object TaskName, State | Format-List

