try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:42617/health' -UseBasicParsing -TimeoutSec 5
  Write-Output ("DAEMON_OK: " + $r.Content)
} catch {
  Write-Output ("DAEMON_UNREACHABLE: " + $_.Exception.Message)
}
try {
  $r2 = Invoke-WebRequest -Uri 'http://localhost:3200/api/v1/health' -UseBasicParsing -TimeoutSec 5
  Write-Output ("BACKEND_OK: " + $r2.StatusCode)
} catch {
  Write-Output ("BACKEND_UNREACHABLE: " + $_.Exception.Message)
}
