# Keeps the organizer reminder watcher running on this PC for the event
# weekend: restarts it if it ever exits and timestamps every log line.
# Started at logon by the "HW Organizer Reminders" scheduled task.
# Check it over SSH:  Get-Content <repo>\organizer-watch.log -Tail 5

$repo = Split-Path -Parent $PSScriptRoot
$log = Join-Path $repo "organizer-watch.log"
Set-Location $repo
$env:ORGANIZER_NOTIFICATIONS_ENABLED = "1"

while ($true) {
  "$(Get-Date -Format s) watcher starting" | Out-File -Append -Encoding utf8 $log
  & npm.cmd run -s organizer:notifications -- --watch 2>&1 |
    ForEach-Object { "$(Get-Date -Format s) $_" | Out-File -Append -Encoding utf8 $log }
  "$(Get-Date -Format s) watcher exited; restarting in 15s" | Out-File -Append -Encoding utf8 $log
  Start-Sleep -Seconds 15
}
