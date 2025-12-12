/**
 * Shared seed data for Viet Bank TQT branches/ATMs.
 * - Export seedData + seedDocs so it can be reused by Functions and CLI.
 * - Run CLI: `cd functions && node seedBankPois.js`
 */
const admin = require("firebase-admin");

// Defaults so bạn không phải set env thủ công mỗi lần chạy seed (dùng emulator)
if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = "vietbank-final";
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "vietbank-final";

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// South: 15 branches (HCM/Q7-centric) + 20 ATMs around Q7
const southBranches = [
  ["Viet Bank TQT - Quan 1", "86 Nguyen Hue, Quan 1, TP.HCM", 10.772685, 106.704155],
  ["Viet Bank TQT - Quan 3", "45 Vo Van Tan, Quan 3, TP.HCM", 10.779167, 106.689342],
  ["Viet Bank TQT - Phu Nhuan", "120 Phan Xich Long, Phu Nhuan, TP.HCM", 10.80353, 106.68877],
  ["Viet Bank TQT - Thu Duc", "30 Vo Van Ngan, Thu Duc, TP.HCM", 10.85052, 106.75821],
  ["Viet Bank TQT - Binh Thanh", "215 Dien Bien Phu, Binh Thanh, TP.HCM", 10.80286, 106.70637],
  ["Viet Bank TQT - Tan Binh", "364 Cong Hoa, Tan Binh, TP.HCM", 10.800947, 106.64525],
  ["Viet Bank TQT - Q7 Phu My Hung", "801 Nguyen Van Linh, Quan 7, TP.HCM", 10.7296, 106.7189],
  ["Viet Bank TQT - Q7 Cau Anh Sao", "Crescent Mall, Quan 7, TP.HCM", 10.7291, 106.7198],
  ["Viet Bank TQT - Q7 Tan Quy", "15 Nguyen Thi Thap, Quan 7, TP.HCM", 10.7355, 106.7122],
  ["Viet Bank TQT - Q7 Tan Phu", "45 Hoang Quoc Viet, Quan 7, TP.HCM", 10.7204, 106.7241],
  ["Viet Bank TQT - Q7 Him Lam", "12 D1 Him Lam, Quan 7, TP.HCM", 10.743, 106.7065],
  ["Viet Bank TQT - Nha Be", "Nguyen Huu Tho, Nha Be, TP.HCM", 10.7002, 106.7058],
  ["Viet Bank TQT - Q7 RMIT", "702 Nguyen Van Linh, Quan 7, TP.HCM", 10.7306, 106.7098],
  ["Viet Bank TQT - Q7 Tan Thuan", "Khu Che Xuat Tan Thuan, Quan 7, TP.HCM", 10.7635, 106.729],
  ["Viet Bank TQT - Q7 Sky Garden", "Sky Garden, Phu My Hung, Quan 7, TP.HCM", 10.7279, 106.7124],
  ["Viet Bank TQT - Nha Be Phuoc Kien", "Phuoc Kien, Nha Be, TP.HCM", 10.7008, 106.7095],
  ["Viet Bank TQT - Nha Be Hiep Phuoc", "KCN Hiep Phuoc, Nha Be, TP.HCM", 10.637, 106.74],
  ["Viet Bank TQT - Can Tho", "23 Nguyen Trai, Ninh Kieu, Can Tho", 10.03405, 105.78376],
  ["Viet Bank TQT - Vung Tau", "15 Le Hong Phong, Vung Tau", 10.3557, 107.0865],
  ["Viet Bank TQT - Bien Hoa", "60 Vo Thi Sau, Bien Hoa, Dong Nai", 10.94843, 106.82205],
];

const southAtms = [
  ["ATM Viet Bank TQT - Nguyen Van Linh 1", 10.729, 106.718],
  ["ATM Viet Bank TQT - Nguyen Van Linh 2", 10.732, 106.72],
  ["ATM Viet Bank TQT - Nguyen Thi Thap 1", 10.736, 106.713],
  ["ATM Viet Bank TQT - Nguyen Thi Thap 2", 10.739, 106.707],
  ["ATM Viet Bank TQT - Cau Anh Sao", 10.7293, 106.7195],
  ["ATM Viet Bank TQT - Crescent Mall", 10.7295, 106.7201],
  ["ATM Viet Bank TQT - SC VivoCity", 10.7379, 106.7039],
  ["ATM Viet Bank TQT - Lotte Mart Q7", 10.7345, 106.7129],
  ["ATM Viet Bank TQT - Him Lam 1", 10.7427, 106.707],
  ["ATM Viet Bank TQT - Him Lam 2", 10.744, 106.704],
  ["ATM Viet Bank TQT - Phu My", 10.723, 106.737],
  ["ATM Viet Bank TQT - Tan Quy", 10.7359, 106.715],
  ["ATM Viet Bank TQT - Tan Phu", 10.722, 106.723],
  ["ATM Viet Bank TQT - Nha Be 1", 10.699, 106.704],
  ["ATM Viet Bank TQT - Nha Be 2", 10.7025, 106.708],
  ["ATM Viet Bank TQT - Nha Be 3", 10.695, 106.7],
  ["ATM Viet Bank TQT - Nha Be 4", 10.6905, 106.695],
  ["ATM Viet Bank TQT - Quan 4", 10.756, 106.707],
  ["ATM Viet Bank TQT - Quan 8", 10.739, 106.676],
  ["ATM Viet Bank TQT - Binh Chanh", 10.707, 106.623],
  ["ATM Viet Bank TQT - Phu My Hung Parkson", 10.7285, 106.7135],
  ["ATM Viet Bank TQT - Crescent Lake", 10.7275, 106.717],
  ["ATM Viet Bank TQT - RMIT", 10.7302, 106.7092],
  ["ATM Viet Bank TQT - KCX Tan Thuan", 10.764, 106.7295],
  ["ATM Viet Bank TQT - Cau Phu My", 10.742, 106.739],
  ["ATM Viet Bank TQT - Cho Tan Quy", 10.735, 106.7145],
  ["ATM Viet Bank TQT - Nha Be Hiep Phuoc", 10.638, 106.742],
  // Near TDTU (quận 7, đại học Tôn Đức Thắng)
  ["ATM Viet Bank TQT - TDTU Gate 1", 10.7298, 106.6935],
  ["ATM Viet Bank TQT - TDTU Gate 2", 10.7321, 106.6929],
  ["ATM Viet Bank TQT - TDTU Gym", 10.7305, 106.6948],
  ["ATM Viet Bank TQT - TDTU Dorm", 10.7289, 106.6915],
  ["ATM Viet Bank TQT - TDTU Nguyen Huu Tho", 10.7327, 106.6959],
  ["ATM Viet Bank TQT - Bien Hoa", 10.95, 106.82],
  ["ATM Viet Bank TQT - Binh Duong", 11.01, 106.67],
];

// Central
const centralBranches = [
  ["Viet Bank TQT - Da Nang", "12 Bach Dang, Hai Chau, Da Nang", 16.06778, 108.22083],
  ["Viet Bank TQT - Thanh Khe", "220 Dien Bien Phu, Thanh Khe, Da Nang", 16.0607, 108.1865],
  ["Viet Bank TQT - Hoi An", "25 Tran Hung Dao, Hoi An", 15.8794, 108.335],
  ["Viet Bank TQT - Hue", "18 Le Loi, TP Hue", 16.4668, 107.5909],
  ["Viet Bank TQT - Quy Nhon", "52 Le Duan, Quy Nhon", 13.7765, 109.2237],
  ["Viet Bank TQT - Nha Trang", "14 Tran Phu, Nha Trang", 12.2417, 109.1955],
  ["Viet Bank TQT - Buon Ma Thuot", "10 Le Thanh Tong, Buon Ma Thuot", 12.6811, 108.0442],
  ["Viet Bank TQT - Pleiku", "88 Hung Vuong, Pleiku", 13.9833, 108.0],
  ["Viet Bank TQT - Da Lat", "2 Nguyen Thi Minh Khai, Da Lat", 11.9465, 108.4419],
  ["Viet Bank TQT - Phan Thiet", "20 Tran Hung Dao, Phan Thiet", 10.9333, 108.1002],
];

const centralAtms = [
  ["ATM Viet Bank TQT - Bach Dang DN", 16.0679, 108.221],
  ["ATM Viet Bank TQT - Dien Bien Phu DN", 16.0604, 108.1861],
  ["ATM Viet Bank TQT - Nguyen Van Linh DN", 16.0614, 108.2123],
  ["ATM Viet Bank TQT - Hoi An 1", 15.8796, 108.3347],
  ["ATM Viet Bank TQT - Hoi An 2", 15.8821, 108.3278],
  ["ATM Viet Bank TQT - Hue 1", 16.4672, 107.5901],
  ["ATM Viet Bank TQT - Hue 2", 16.4705, 107.5798],
  ["ATM Viet Bank TQT - Nha Trang 1", 12.245, 109.1949],
  ["ATM Viet Bank TQT - Nha Trang 2", 12.2387, 109.1965],
  ["ATM Viet Bank TQT - Quy Nhon 1", 13.7768, 109.2235],
  ["ATM Viet Bank TQT - Quy Nhon 2", 13.77, 109.219],
  ["ATM Viet Bank TQT - Buon Ma Thuot 1", 12.6814, 108.0447],
  ["ATM Viet Bank TQT - Buon Ma Thuot 2", 12.678, 108.0465],
  ["ATM Viet Bank TQT - Pleiku 1", 13.9836, 108.0005],
  ["ATM Viet Bank TQT - Pleiku 2", 13.9803, 108.0061],
  ["ATM Viet Bank TQT - Da Lat 1", 11.9468, 108.4415],
  ["ATM Viet Bank TQT - Da Lat 2", 11.9432, 108.4438],
  ["ATM Viet Bank TQT - Phan Thiet 1", 10.9336, 108.1006],
  ["ATM Viet Bank TQT - Phan Thiet 2", 10.93, 108.103],
  ["ATM Viet Bank TQT - Tuy Hoa", 13.0954, 109.3209],
];

// North
const northBranches = [
  ["Viet Bank TQT - Hoan Kiem", "45 Ly Thuong Kiet, Hoan Kiem, Ha Noi", 21.028669, 105.852228],
  ["Viet Bank TQT - Cau Giay", "130 Cau Giay, Ha Noi", 21.033756, 105.800072],
  ["Viet Bank TQT - Hai Ba Trung", "120 Bach Mai, Hai Ba Trung, Ha Noi", 21.0043, 105.8497],
  ["Viet Bank TQT - Thanh Xuan", "98 Nguyen Trai, Thanh Xuan, Ha Noi", 20.9923, 105.8157],
  ["Viet Bank TQT - Long Bien", "15 Nguyen Van Cu, Long Bien, Ha Noi", 21.0463, 105.8745],
  ["Viet Bank TQT - Bac Ninh", "22 Tran Hung Dao, Bac Ninh", 21.185, 106.0763],
  ["Viet Bank TQT - Hai Phong", "15 Dien Bien Phu, Hai Phong", 20.8619, 106.6822],
  ["Viet Bank TQT - Ha Long", "30 Tran Quoc Nghien, Ha Long", 20.9516, 107.0747],
  ["Viet Bank TQT - Nam Dinh", "10 Hung Vuong, Nam Dinh", 20.4239, 106.1721],
  ["Viet Bank TQT - Thai Nguyen", "25 Hoang Van Thu, Thai Nguyen", 21.5942, 105.8482],
];

const northAtms = [
  ["ATM Viet Bank TQT - Hoan Kiem 1", 21.0289, 105.8524],
  ["ATM Viet Bank TQT - Hoan Kiem 2", 21.0302, 105.8481],
  ["ATM Viet Bank TQT - Cau Giay 1", 21.0339, 105.8003],
  ["ATM Viet Bank TQT - Cau Giay 2", 21.036, 105.7965],
  ["ATM Viet Bank TQT - Hai Ba Trung 1", 21.0046, 105.8501],
  ["ATM Viet Bank TQT - Hai Ba Trung 2", 21.0008, 105.855],
  ["ATM Viet Bank TQT - Thanh Xuan 1", 20.9926, 105.8162],
  ["ATM Viet Bank TQT - Thanh Xuan 2", 20.9885, 105.815],
  ["ATM Viet Bank TQT - Long Bien 1", 21.0466, 105.875],
  ["ATM Viet Bank TQT - Long Bien 2", 21.0432, 105.88],
  ["ATM Viet Bank TQT - Bac Ninh 1", 21.1854, 106.0768],
  ["ATM Viet Bank TQT - Bac Ninh 2", 21.183, 106.081],
  ["ATM Viet Bank TQT - Hai Phong 1", 20.8621, 106.6825],
  ["ATM Viet Bank TQT - Hai Phong 2", 20.86, 106.688],
  ["ATM Viet Bank TQT - Ha Long 1", 20.9519, 107.0751],
  ["ATM Viet Bank TQT - Ha Long 2", 20.948, 107.08],
  ["ATM Viet Bank TQT - Nam Dinh 1", 20.4242, 106.1725],
  ["ATM Viet Bank TQT - Nam Dinh 2", 20.421, 106.177],
  ["ATM Viet Bank TQT - Thai Nguyen 1", 21.5945, 105.8486],
  ["ATM Viet Bank TQT - Thai Nguyen 2", 21.592, 105.853],
];

const seedData = [
  ...southBranches.map(([name, address, lat, lon]) => ({
    region: "south",
    type: "BRANCH",
    name,
    address,
    lat,
    lon,
  })),
  ...southAtms.map(([name, lat, lon]) => ({
    region: "south",
    type: "ATM",
    name,
    address: name,
    lat,
    lon,
  })),
  ...centralBranches.map(([name, address, lat, lon]) => ({
    region: "central",
    type: "BRANCH",
    name,
    address,
    lat,
    lon,
  })),
  ...centralAtms.map(([name, lat, lon]) => ({
    region: "central",
    type: "ATM",
    name,
    address: name,
    lat,
    lon,
  })),
  ...northBranches.map(([name, address, lat, lon]) => ({
    region: "north",
    type: "BRANCH",
    name,
    address,
    lat,
    lon,
  })),
  ...northAtms.map(([name, lat, lon]) => ({
    region: "north",
    type: "ATM",
    name,
    address: name,
    lat,
    lon,
  })),
];

async function seedDocs(targetDb, dataList) {
  let created = 0;
  let skipped = 0;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  for (const item of dataList) {
    const docId = `${item.region}-${item.type.toLowerCase()}-${slugify(
      item.name
    )}`;
    const ref = targetDb.collection("bank_pois").doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      skipped++;
      continue;
    }
    await ref.set({
      ...item,
      official: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    created++;
  }

  return { created, skipped };
}

async function seed() {
  const { created, skipped } = await seedDocs(db, seedData);
  console.log(`Seed done. Created: ${created}, skipped: ${skipped}`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}

module.exports = { seedData, seedDocs };
