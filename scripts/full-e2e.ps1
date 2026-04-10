param(
  [string]$BaseUrl = "http://127.0.0.1:5000",
  [string]$AdminEmail = "admin.test@local.dev",
  [string]$AdminPassword = "Pass1234"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [object]$Body
  )

  if ($null -ne $Body) {
    $bodyJson = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $bodyJson
  }

  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
}

Write-Host "1) Login as admin..."
$login = Invoke-Json -Method "POST" -Url "$BaseUrl/api/auth/login" -Headers @{} -Body @{
  email = $AdminEmail
  password = $AdminPassword
}

$token = $login.token
if (-not $token) {
  throw "Login failed: token not returned."
}

$headers = @{ Authorization = "Bearer $token" }

Write-Host "2) Seed demo inventory..."
Invoke-Json -Method "POST" -Url "$BaseUrl/api/inventory/seed-demo" -Headers $headers -Body @{ replace = $true } | Out-Null

Write-Host "3) Create booking..."
$bookingRes = Invoke-Json -Method "POST" -Url "$BaseUrl/api/bookings" -Headers $headers -Body @{
  numRooms = 1
  checkInDate = "2026-04-20"
  checkOutDate = "2026-04-21"
  roomType = "Any"
  floorPreference = "Any"
}
$bookingId = $bookingRes.data.bookingId
Write-Host "   Booking ID: $bookingId"

Write-Host "4) Place KOT order (water bottle)..."
$menu = Invoke-Json -Method "GET" -Url "$BaseUrl/api/restaurant/menu" -Headers @{} -Body $null
$water = $menu.data | Where-Object { $_.name -like "Water Bottle*" } | Select-Object -First 1
if (-not $water) {
  throw "Menu item 'Water Bottle' not found."
}
$orderRes = Invoke-Json -Method "POST" -Url "$BaseUrl/api/restaurant/order" -Headers $headers -Body @{
  bookingId = $bookingId
  items = @(
    @{
      menuItemId = $water.id
      quantity = 2
    }
  )
}
$orderId = $orderRes.data.orderId
Write-Host "   Order ID: $orderId"

Write-Host "5) Mark order prepared (triggers inventory deduction)..."
$prepared = Invoke-Json -Method "PUT" -Url "$BaseUrl/api/restaurant/order/$orderId/status" -Headers $headers -Body @{
  status = "prepared"
}

Write-Host "6) Fetch trends and invoice PDF..."
$trends = Invoke-Json -Method "GET" -Url "$BaseUrl/api/accounting/trends?days=14" -Headers $headers -Body $null
$pdfPath = Join-Path $PSScriptRoot "..\\invoice-e2e.pdf"
Invoke-WebRequest -Uri "$BaseUrl/api/billing/$bookingId/invoice-pdf" -Headers $headers -OutFile $pdfPath | Out-Null

Write-Host ""
Write-Host "E2E OK"
Write-Host ("- Order prepared: " + $prepared.success)
Write-Host ("- Inventory deductions: " + $prepared.inventoryImpact.deducted.Count)
Write-Host ("- Trend points: " + $trends.data.labels.Count)
Write-Host ("- Invoice path: " + (Resolve-Path $pdfPath))
