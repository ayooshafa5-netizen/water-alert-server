const express = require('express');
const admin = require('firebase-admin');
const app = express();

// === إعداد Firebase Admin من المتغيرات البيئية ===
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(express.json());

// === نقطة الاستقبال: إرسال إشعار بكل قراءة ===
app.post('/send-alert', async (req, res) => {
  const { area, water_level, ph } = req.body;
  console.log('البيانات من ESP32:', { area, water_level, ph });

  try {
    await admin.messaging().send({
      notification: {
        title: `📊 تحديث مباشر - ${area}`,
        body: `💧 المنسوب: ${water_level.toFixed(1)} سم\n⚗️ pH: ${ph.toFixed(2)}`
      },
      topic: area
    });
    console.log('✅ تم إرسال إشعار');
  } catch (error) {
    console.error('❌ خطأ في FCM:', error.message);
  }

  res.json({ status: 'تم إرسال إشعار' });
});

app.listen(process.env.PORT || 10000);
