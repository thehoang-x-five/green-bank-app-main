/**
 * Start Firebase emulator and auto-seed data
 * Usage: node scripts/start-emulator-with-seed.js
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const FUNCTIONS_URL = "http://127.0.0.1:5001/vietbank-final/asia-southeast1";
const MAX_RETRIES = 30;
const RETRY_DELAY = 2000;

function log(msg, type = "info") {
  const colors = {
    info: "\x1b[36m",
    success: "\x1b[32m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]\x1b[0m ${msg}`);
}

function waitForEmulator() {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const check = () => {
      const req = http.get(`${FUNCTIONS_URL}/getVnLocations`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 405) {
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      retries++;
      if (retries >= MAX_RETRIES) {
        reject(new Error("Emulator did not start in time"));
        return;
      }
      log(`Waiting for emulator... (${retries}/${MAX_RETRIES})`, "warn");
      setTimeout(check, RETRY_DELAY);
    };

    check();
  });
}

async function seedHotels() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({});
    const url = new URL(`${FUNCTIONS_URL}/seedHotelsDemo?force=false`);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-seed-secret": "dev-secret",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch {
            resolve({ raw: data });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function seedBankPois() {
  return new Promise((resolve, reject) => {
    const functionsDir = path.join(__dirname, "..", "functions");
    
    const seedProcess = spawn("node", ["seedBankPois.js"], {
      cwd: functionsDir,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        GOOGLE_CLOUD_PROJECT: "vietbank-final",
      },
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    seedProcess.stdout.on("data", (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    seedProcess.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    seedProcess.on("close", (code) => {
      if (code === 0) {
        // Parse output to get counts
        const match = output.match(/Created: (\d+), skipped: (\d+)/);
        if (match) {
          resolve({ created: parseInt(match[1]), skipped: parseInt(match[2]) });
        } else {
          resolve({ created: 0, skipped: 0 });
        }
      } else {
        reject(new Error(`Seed process exited with code ${code}`));
      }
    });
  });
}

async function main() {
  log("Starting Firebase Emulator with auto-seed...");

  // Start emulator
  const emulator = spawn("npx", ["firebase", "emulators:start", "--only=functions,firestore", "--project=vietbank-final"], {
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
  });

  let emulatorReady = false;

  emulator.stdout.on("data", (data) => {
    const output = data.toString();
    process.stdout.write(output);

    // Detect when emulator is ready
    if (output.includes("All emulators ready") && !emulatorReady) {
      emulatorReady = true;
      runSeed();
    }
  });

  emulator.stderr.on("data", (data) => {
    process.stderr.write(data.toString());
  });

  emulator.on("close", (code) => {
    log(`Emulator exited with code ${code}`, code === 0 ? "info" : "error");
    process.exit(code);
  });

  async function runSeed() {
    log("Emulator ready! Starting seed...", "success");

    // Small delay to ensure functions are fully loaded
    await new Promise((r) => setTimeout(r, 3000));

    try {
      log("Seeding hotels, rooms, and locations...");
      const hotelResult = await seedHotels();
      if (hotelResult.hotels?.skipped) {
        log("Hotels already seeded, skipping", "warn");
      } else {
        log(`Hotels: ${hotelResult.hotels?.inserted || 0}, Rooms: ${hotelResult.rooms?.inserted || 0}, Locations: ${hotelResult.locations?.inserted || 0}`, "success");
      }
    } catch (err) {
      log(`Failed to seed hotels: ${err.message}`, "error");
    }

    try {
      log("Seeding bank POIs...");
      const poiResult = await seedBankPois();
      if (poiResult.skipped > 0 && poiResult.created === 0) {
        log("Bank POIs already seeded, skipping", "warn");
      } else {
        log(`Bank POIs: created ${poiResult.created}, skipped ${poiResult.skipped}`, "success");
      }
    } catch (err) {
      log(`Failed to seed bank POIs: ${err.message}`, "error");
    }

    log("\n✅ Emulator running with seeded data!", "success");
    log("Press Ctrl+C to stop\n", "info");
  }
}

main().catch((err) => {
  log(err.message, "error");
  process.exit(1);
});
