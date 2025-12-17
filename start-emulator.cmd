@echo off
echo Starting Firebase Emulator with auto-seed...
echo.

REM Start emulator in a new window using npm script
start "Firebase Emulator" cmd /c "npm run emulator"

echo Waiting 20 seconds for emulator to start...
timeout /t 20 /nobreak > nul

echo.
echo Seeding hotels, rooms, and locations...
curl -X POST "http://127.0.0.1:5001/vietbank-final/asia-southeast1/seedHotelsDemo?force=true" -H "x-seed-secret: dev-secret" -H "Content-Type: application/json"

echo.
echo Seeding bank POIs...
cd functions
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
set GOOGLE_CLOUD_PROJECT=vietbank-final
node seedBankPois.js
cd ..

echo.
echo Done! Emulator is running in another window.
echo Press any key to exit this window...
pause > nul
