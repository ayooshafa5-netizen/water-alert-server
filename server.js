const express = require('express');
const admin = require('firebase-admin');
const app = express();

// === إعداد Firebase Admin من المتغيرات البيئية ===
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(express.json());

// === نقطة استقبال لإرسال إشعار حسب المنطقة ===
app.post('/send-alert', async (req, res) => {
  const { area, water_level, ph } = req.body;

  if (!area) return res.status(400).json({ error: "المنطقة مطلوبة (area)" });

  console.log('البيانات من ESP32:', { area, water_level, ph });

  try {
    const message = {
      notification: {
        title: `📊 تحديث مباشر - ${area}`,
        body: `💧 المنسوب: ${water_level.toFixed(1)} سم\n⚗️ pH: ${ph.toFixed(2)}`
      },
      topic: area // الإرسال لكل المشتركين في الـ topic الخاص بالمنطقة
    };

    const response = await admin.messaging().send(message);
    console.log('✅ تم إرسال إشعار بنجاح:', response);
    res.json({ status: 'تم إرسال إشعار', response });
  } catch (error) {
    console.error('❌ خطأ في FCM:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ السيرفر يعمل على المنفذ: ${PORT}`);
});
