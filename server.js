const express = require('express');
const admin = require('firebase-admin');
const app = express();

// --------------------------
//   Firebase Service Account  
// --------------------------
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

// --------------------------
//     Firebase Admin Init
// --------------------------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// --------------------------
app.use(express.json());

// ----------------------------------------------------
//   نقطة استقبال البيانات من ESP32 وإرسال إشعار
// ----------------------------------------------------
app.post('/send-alert', async (req, res) => {
  const { area, water_level, ph } = req.body;

  if (!area) return res.status(400).json({ error: "المنطقة مطلوبة (area)" });

  console.log('البيانات المستلمة من ESP32:', { area, water_level, ph });

  try {
    const message = {
      notification: {
        title: `📊 تحديث مباشر - ${area}`,
        body: `💧 المنسوب: ${water_level.toFixed(1)} سم\n⚗️ pH: ${ph.toFixed(2)}`
      },
      topic: area
    };

    const response = await admin.messaging().send(message);
    console.log('إشعار أُرسل بنجاح:', response);

    res.json({ status: 'تم إرسال إشعار', response });

  } catch (error) {
    console.error('خطأ في FCM:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
//     نقطة إرسال اختبار (بدون ESP32)
// ----------------------------------------------------
app.get('/test-alert', async (req, res) => {
  const topic = 'rwmaya'; // موضوع تجريبي
  const message = {
    notification: {
      title: `⚡ إشعار تجريبي - ${topic}`,
      body: `هذا إشعار تجريبي لكل المشتركين في ${topic}`
    },
    topic: topic
  };

  try {
    const response = await admin.messaging().send(message);
    res.json({ status: 'تم إرسال إشعار تجريبي', response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`السيرفر يعمل على المنفذ ${PORT}`));
