/**
 * Auto-seed script for Firebase emulator
 * Run after emulator starts to seed all demo data
 */

const EMULATOR_HOST = "http://127.0.0.1:5001";
const PROJECT_ID = "vietbank-final";
const REGION = "asia-southeast1";

async function waitForEmulator(maxRetries = 30, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${EMULATOR_HOST}/${PROJECT_ID}/${REGION}/getVnLocations`, {
        method: "GET",
      });
      if (response.ok || response.status === 404) {
        console.log("✓ Emulator is ready");
        return true;
      }
    } catch {
      // Emulator not ready yet
    }
    console.log(`Waiting for emulator... (${i + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Emulator did not start in time");
}

async function seedHotels() {
  console.log("Seeding hotels, rooms, and locations...");
  try {
    const response = await fetch(
      `${EMULATOR_HOST}/${PROJECT_ID}/${REGION}/seedHotelsDemo?force=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-seed-secret": "dev-secret",
        },
      }
    );
    const data = await response.json();
    console.log("✓ Hotels seed result:", data);
    return data;
  } catch (err) {
    console.error("✗ Failed to seed hotels:", err.message);
    return null;
  }
}

async function seedMovies() {
  console.log("Seeding movies, cinemas, and showtimes...");
  try {
    const response = await fetch(
      `${EMULATOR_HOST}/${PROJECT_ID}/${REGION}/seedMoviesDemo?force=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-seed-secret": "dev-secret",
        },
      }
    );
    const data = await response.json();
    console.log("✓ Movies seed result:", data);
    return data;
  } catch (err) {
    console.error("✗ Failed to seed movies:", err.message);
    return null;
  }
}

async function seedBankPois() {
  console.log("Seeding bank POIs...");
  try {
    // Run the seedBankPois script directly
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
    
    const { seedData, seedDocs } = require("../functions/seedBankPois.js");
    const admin = require("firebase-admin");
    
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID });
    }
    
    const db = admin.firestore();
    const result = await seedDocs(db, seedData);
    console.log("✓ Bank POIs seed result:", result);
    return result;
  } catch (err) {
    console.error("✗ Failed to seed bank POIs:", err.message);
    return null;
  }
}

async function main() {
  console.log("\n🚀 Firebase Emulator Auto-Seed Script\n");
  
  await waitForEmulator();
  
  console.log("\n--- Seeding Data ---\n");
  
  await seedHotels();
  await seedMovies();
  await seedBankPois();
  
  console.log("\n✅ Seed complete!\n");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
