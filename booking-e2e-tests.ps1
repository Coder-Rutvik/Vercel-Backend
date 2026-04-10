$ErrorActionPreference = "Stop"

$base = "http://localhost:5000"

function Invoke-PostJson($url, $token, $bodyObj) {
  $headers = @{}
  if ($token) {
    $headers["Authorization"] = "Bearer " + $token
  }

  $bodyJson = $bodyObj | ConvertTo-Json -Depth 20

  try {
    return @{
      ok = $true
      res = (Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body $bodyJson)
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      $stream = $resp.GetResponseStream()
      $sr = New-Object System.IO.StreamReader($stream)
      $txt = $sr.ReadToEnd()
      return @{
        ok = $false
        status = $resp.StatusCode.Value__
        body = $txt
      }
    }
    return @{
      ok = $false
      message = $_.Exception.Message
    }
  }
}

function ResetAll($token) {
  $url = $base + "/api/rooms/reset-all"
  return Invoke-PostJson $url $token (@{})
}

function TryBook($token, $checkIn, $checkOut, $floorPref, $roomType, $numRooms, $selectedRooms) {
  $url = $base + "/api/bookings"
  $body = @{
    numRooms = $numRooms
    checkInDate = $checkIn
    checkOutDate = $checkOut
    roomType = $roomType
    floorPreference = $floorPref
    selectedRoomNumbers = $selectedRooms
  }
  return Invoke-PostJson $url $token $body
}

# 1) Login
$loginBody = @{
  email = "seed@hotel.com"
  password = "seed"
} | ConvertTo-Json -Depth 10

$login = Invoke-RestMethod -Method Post -Uri ($base + "/api/auth/login") -ContentType "application/json" -Body $loginBody
$token = $login.token

Write-Output ("TOKEN_OK=" + [bool]$token)

Write-Output "--- TOUCH TEST (should PASS) ---"
ResetAll $token | Out-Null

$touch1 = TryBook $token "2026-03-20" "2026-03-21" 12 "Any" 1 @(1202)
$touch2 = TryBook $token "2026-03-21" "2026-03-22" 12 "Any" 1 @(1202)

Write-Output ($touch1 | ConvertTo-Json -Depth 30)
Write-Output ($touch2 | ConvertTo-Json -Depth 30)

Write-Output "--- OVERLAP TEST (should FAIL on 2nd) ---"
ResetAll $token | Out-Null

$over1 = TryBook $token "2026-03-20" "2026-03-22" 12 "Any" 1 @(1201)
$over2 = TryBook $token "2026-03-21" "2026-03-23" 12 "Any" 1 @(1201)

Write-Output ($over1 | ConvertTo-Json -Depth 30)
Write-Output ($over2 | ConvertTo-Json -Depth 30)
