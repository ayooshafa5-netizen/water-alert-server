const express = require('express');
const admin = require('firebase-admin');
const app = express();

// ============== Firebase Service Account ==============
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// ============== Firebase Admin Init ==============
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://YOUR_PROJECT_ID.europe-west1.firebasedatabase.app"
});

app.use(express.json());

// =====================================================
//         نقطة استقبال البيانات من ESP32
// =====================================================
app.post('/send-alert', async (req, res) => {
  try {
    const { area, water_level, ph } = req.body;

    if (!area) return res.status(400).json({ error: "area مفقودة" });

    console.log("بيانات مستلمة:", { area, water_level, ph });

    // ============ جلب الحدود من القاعدة ============
    const thresholdsSnap = await admin
      .database()
      .ref("settings/thresholds")
      .once("value");

    const thresholds = thresholdsSnap.val();
    const { level_min, level_max, ph_min, ph_max } = thresholds;

    // ============ تحديد نوع الخطر ============
    let alertText = "";
    let isDanger = false;

    if (water_level < level_min) {
      alertText += `⚠️ مستوى الماء منخفض (${water_level} سم)\n`;
      isDanger = true;
    }
    if (water_level > level_max) {
      alertText += `⚠️ مستوى الماء مرتفع (${water_level} سم)\n`;
      isDanger = true;
    }
    if (ph < ph_min) {
      alertText += `⚠️ قيمة pH منخفضة (حمضية أكثر من اللازم) – ${ph}\n`;
      isDanger = true;
    }
    if (ph > ph_max) {
      alertText += `⚠️ قيمة pH مرتفعة (قلوية أكثر من اللازم) – ${ph}\n`;
      isDanger = true;
    }

    // إذا لا يوجد خطر
    if (!isDanger) {
      alertText = `القراءات طبيعية:\n💧 المنسوب: ${water_level} سم\n⚗️ pH: ${ph}`;
    }

    // ============ حفظ القراءة في القاعدة ============
    await admin
      .database()
      .ref(`readings/${area}`)
      .push({
        water_level,
        ph,
        timestamp: Date.now()
      });

    // ============ تجهيز رسالة FCM ============
    const message = {
      topic: area,
      notification: {
        title: `📡 تحديث جديد - ${area}`,
        body: alertText
      }
    };

    // إذا يوجد خطر → يرسل إشعار
    let fcmResponse = null;
    if (isDanger) {
      fcmResponse = await admin.messaging().send(message);
      console.log("تم إرسال إشعار:", fcmResponse);
    } else {
      console.log("لا يوجد خطر — لم يُرسل إشعار.");
    }

    return res.json({
      status: "تم الاستقبال",
      danger: isDanger,
      sent_notification: !!isDanger,
      fcmResponse
    });

  } catch (error) {
    console.error("خطأ:", error);
    return res.status(500).json({ error: error.message });
  }
});

// =====================================================
//     اختبار إرسال إشعار يدوي
// =====================================================
app.get('/test-alert', async (req, res) => {
  const topic = "rwmaya";

  try {
    const resp = await admin.messaging().send({
      topic,
      notification: {
        title: "اختبار",
        body: "نجاح الاختبار"
      }
    });

    return res.json({ sent: true, resp });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =====================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
