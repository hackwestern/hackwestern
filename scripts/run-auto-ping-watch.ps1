# Keeps Auto-Ping (mentor, volunteer and judge DMs) syncing on this PC for the
# event weekend: one --sync a minute, timestamped log, keeps going after errors.
# Started at logon by the "HW Auto-Ping" scheduled task.
# Check it over SSH:  Get-Content <repo>\auto-ping-watch.log -Tail 5

$repo = Split-Path -Parent $PSScriptRoot
$log = Join-Path $repo "auto-ping-watch.log"
Set-Location $repo
$env:AUTO_PING_ENABLED = "1"

# Final thank you: from Sun Nov 22 6:00 PM ET, try every minute until it goes
# (it refuses while {hackers} or {projects} is blank, and never re-sends to
# anyone already marked sent), then stop trying.
$finalAt = [DateTimeOffset]::Parse("2026-11-22T18:00:00-05:00")
$finalDone = Join-Path $repo ".auto-ping-final-sent"

"$(Get-Date -Format s) auto-ping watcher starting" | Out-File -Append -Encoding utf8 $log
while ($true) {
  & npm.cmd run -s auto-ping -- --sync 2>&1 |
    ForEach-Object { "$(Get-Date -Format s) $_" | Out-File -Append -Encoding utf8 $log }
  if ([DateTimeOffset]::Now -ge $finalAt -and -not (Test-Path $finalDone)) {
    "$(Get-Date -Format s) trying the final thank you" | Out-File -Append -Encoding utf8 $log
    & npm.cmd run -s auto-ping -- --send-final 2>&1 |
      ForEach-Object { "$(Get-Date -Format s) $_" | Out-File -Append -Encoding utf8 $log }
    if ($LASTEXITCODE -eq 0) { New-Item -ItemType File $finalDone | Out-Null }
  }
  Start-Sleep -Seconds 60
}
