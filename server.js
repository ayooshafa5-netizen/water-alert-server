import express from "express";
import admin from "firebase-admin";

const app = express();

// -----------------------
//  Firebase Credentials
// -----------------------
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://watermoitoringsystem-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

app.use(express.json());

// ----------------------------------------------------
//      استقبال بيانات ESP32 + مقارنة الحدود
// ----------------------------------------------------
app.post("/send-alert", async (req, res) => {
  try {
    const { area, water_level, ph } = req.body;

    if (!area) return res.status(400).json({ error: "area مفقودة" });

    console.log("🚰 بيانات مستلمة:", { area, water_level, ph });

    // --- 1) تحميل الحدود ---
    const thresholdsSnap = await db.ref("settings/thresholds").once("value");
    const thresholds = thresholdsSnap.val();

    const { level_min, level_max, ph_min, ph_max } = thresholds;

    // --- 2) تحديد المشكلة بالضبط ---
    let alertMessage = "";
    let alertDetails = "";

    // *** مستوى الماء فقط ***
    if (water_level < level_min) {
      alertMessage += "⚠️ مستوى الماء منخفض!\n";
      alertDetails += `💧 المنسوب الحالي: ${water_level.toFixed(1)} سم\n`;
    }

    if (water_level > level_max) {
      alertMessage += "⚠️ مستوى الماء مرتفع!\n";
      alertDetails += `💧 المنسوب الحالي: ${water_level.toFixed(1)} سم\n`;
    }

    // *** pH فقط ***
    if (ph < ph_min) {
      alertMessage += "⚗️ الماء حامضي أكثر من الطبيعي!\n";
      alertDetails += `⚗️ قيمة pH: ${ph.toFixed(2)}\n`;
    }

    if (ph > ph_max) {
      alertMessage += "⚗️ الماء قلوي أكثر من الطبيعي!\n";
      alertDetails += `⚗️ قيمة pH: ${ph.toFixed(2)}\n`;
    }

    // --- 3) كل القيم طبيعية → لا إشعار ---
    if (alertMessage === "") {
      console.log("✔️ القراءات طبيعية — لا إشعار");
      return res.json({
        status: "normal",
        message: "القراءات طبيعية — لم يتم إرسال إشعار"
      });
    }

    // --- 4) إرسال الإشعار — يحتوي فقط القيم المخالفة ---
    const message = {
      notification: {
        title: `📢 تنبيه - منطقة ${area}`,
        body: alertMessage + "\n" + alertDetails
      },
      topic: area
    };

    const response = await admin.messaging().send(message);
    console.log("📨 إشعار أرسل:", response);

    res.json({
      status: "alert_sent",
      alertMessage,
      alertDetails,
      checked_thresholds: thresholds,
      response
    });

  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
app.get("/", (req, res) => {
  res.send("Water alert server is running...");
});
// ----------------------------------------------------

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
