const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

// Lấy config SMTP từ firebase functions:config:set
// smtp.email = email Gmail của anh
// smtp.pass  = app password 16 ký tự
const smtpEmail = functions.config().smtp.email;
const smtpPass = functions.config().smtp.pass;

// Tạo transporter dùng Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: smtpEmail,
    pass: smtpPass,
  },
});

// Cloud Function HTTP để gửi OTP giao dịch
exports.sendOtpEmail = functions
  .region("asia-southeast1") // region gần VN, trùng với DB của anh thì càng tốt
  .https.onRequest(async (req, res) => {
    // CORS đơn giản cho FE gọi trực tiếp
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { email, otp, txnId } = req.body || {};
    if (!email || !otp) {
      res.status(400).send("Missing email or otp");
      return;
    }

    try {
      await transporter.sendMail({
        from: `"VietBank Digital" <${smtpEmail}>`,
        to: email,
        subject: "Mã OTP xác thực giao dịch VietBank",
        text: `Mã OTP của bạn là: ${otp} cho giao dịch ${txnId}. OTP có hiệu lực trong 5 phút.`,
        html: `
          <p>Xin chào,</p>
          <p>Mã OTP xác thực giao dịch của bạn là:</p>
          <h2>${otp}</h2>
          <p>Giao dịch: <strong>${txnId}</strong></p>
          <p>OTP có hiệu lực trong <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
          <p>Trân trọng,<br/>VietBank Digital</p>
        `,
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("sendOtpEmail error:", err);
      res.status(500).send("Failed to send email");
    }
  });
