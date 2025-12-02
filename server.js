import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// تحميل مفتاح الخدمة من متغيرات البيئة (Render)
const serviceAccount = {
  type: process.env.FB_TYPE,
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FB_CLIENT_EMAIL,
  client_id: process.env.FB_CLIENT_ID,
  auth_uri: process.env.FB_AUTH_URI,
  token_uri: process.env.FB_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FB_AUTH_CERT,
  client_x509_cert_url: process.env.FB_CLIENT_CERT,
};

// تهيئة Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://watermoitoringsystem-default-rtdb.europe-west1.firebasedatabase.app",
});

// اتصال القاعدة
const db = admin.database();

// نقطة استقبال بيانات ESP32
app.post("/send-data", async (req, res) => {
  try {
    const { area, water_level, ph } = req.body;

    console.log("بيانات مستلمة:", req.body);

    // جلب الحدود من القاعدة
    const thresholdsSnap = await db.ref("settings/thresholds").once("value");

    if (!thresholdsSnap.exists()) {
      console.error("لا توجد حدود في settings/thresholds");
      return res.status(500).send("Thresholds not found");
    }

    const thresholds = thresholdsSnap.val();

    const dangerWater =
      water_level < thresholds.min_water || water_level > thresholds.max_water;

    const dangerPH = ph < thresholds.min_ph || ph > thresholds.max_ph;

    // إذا لم يكن هناك أي خطر → إنهاء
    if (!dangerWater && !dangerPH) {
      return res.send("No danger detected");
    }

    // إرسال إشعار FCM
    const message = {
      notification: {
        title: "تحذير من النظام",
        body: `منطقة ${area}: مستوى الماء ${water_level}, pH = ${ph}`,
      },
      topic: "alerts",
    };

    await admin.messaging().send(message);

    console.log("تم إرسال إشعار");
    res.send("Notification sent");
  } catch (error) {
    console.error("خطأ أثناء معالجة الطلب:", error);
    res.status(500).send("Error processing request");
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
