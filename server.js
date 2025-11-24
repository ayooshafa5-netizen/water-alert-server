const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = { /* استخدمي متغيرات البيئة كما عندك */ };
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(express.json());

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
      topic: area // topic لكل المنطقة
    };

    const response = await admin.messaging().send(message);
    console.log('✅ تم إرسال إشعار بنجاح:', response);
    res.json({ status: 'تم إرسال إشعار', response });
  } catch (error) {
    console.error('❌ خطأ في FCM:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// نقطة اختبار إشعار تجريبي
app.get('/test-alert', async (req, res) => {
  const topic = 'rwmaya';
  const message = {
    notification: {
      title: `⚡ إشعار تجريبي - ${topic}`,
      body: `هذا إشعار تجريبي لكل المشتركين في ${topic}`
    },
    topic: topic
  };
  try {
    const response = await admin.messaging().send(message);
    res.send({ status: 'تم إرسال إشعار تجريبي', response });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ السيرفر يعمل على المنفذ: ${PORT}`));
