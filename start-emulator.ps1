# Start Firebase emulator and auto-seed data
Write-Host "Starting Firebase Emulator..." -ForegroundColor Cyan

# Start emulator in background
$emulatorJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx firebase emulators:start --only functions,firestore --project vietbank-final
}

# Wait for emulator to be ready
Write-Host "Waiting for emulator to start..." -ForegroundColor Yellow
$maxRetries = 30
$ready = $false

for ($i = 0; $i -lt $maxRetries; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:5001/vietbank-final/asia-southeast1/getVnLocations" -Method GET -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404) {
            $ready = $true
            break
        }
    } catch {
        Write-Host "  Attempt $($i + 1)/$maxRetries..." -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host "Emulator did not start in time. Check logs." -ForegroundColor Red
    Stop-Job $emulatorJob
    exit 1
}

Write-Host "Emulator is ready!" -ForegroundColor Green

# Seed data
Write-Host "`nSeeding hotels, rooms, and locations..." -ForegroundColor Cyan
try {
    $seedResult = Invoke-RestMethod -Uri "http://127.0.0.1:5001/vietbank-final/asia-southeast1/seedHotelsDemo?force=true" -Method POST -Headers @{"x-seed-secret"="dev-secret"} -ContentType "application/json"
    Write-Host "Hotels: $($seedResult.hotels.inserted), Locations: $($seedResult.locations.inserted), Rooms: $($seedResult.rooms.inserted)" -ForegroundColor Green
} catch {
    Write-Host "Failed to seed hotels: $_" -ForegroundColor Red
}

# Seed bank POIs
Write-Host "`nSeeding bank POIs..." -ForegroundColor Cyan
try {
    Set-Location functions
    $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
    $env:GOOGLE_CLOUD_PROJECT = "vietbank-final"
    node seedBankPois.js
    Set-Location ..
} catch {
    Write-Host "Failed to seed bank POIs: $_" -ForegroundColor Red
}

Write-Host "`n✅ Emulator started and data seeded!" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the emulator`n" -ForegroundColor Yellow

# Keep emulator running
Receive-Job $emulatorJob -Wait
