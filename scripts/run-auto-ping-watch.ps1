# Keeps Auto-Ping (mentor, volunteer and judge DMs) syncing on this PC for the
# event weekend: one --sync a minute, timestamped log, keeps going after errors.
# Started at logon by the "HW Auto-Ping" scheduled task.
# Check it over SSH:  Get-Content <repo>\auto-ping-watch.log -Tail 5

$repo = Split-Path -Parent $PSScriptRoot
$log = Join-Path $repo "auto-ping-watch.log"
Set-Location $repo
$env:AUTO_PING_ENABLED = "1"

"$(Get-Date -Format s) auto-ping watcher starting" | Out-File -Append -Encoding utf8 $log
while ($true) {
  & npm.cmd run -s auto-ping -- --sync 2>&1 |
    ForEach-Object { "$(Get-Date -Format s) $_" | Out-File -Append -Encoding utf8 $log }
  Start-Sleep -Seconds 60
}
