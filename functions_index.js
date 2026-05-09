// ============================================
// Firebase Cloud Function للمساعد الذكي
// (انسخ هذا الملف إلى: functions/index.js)
// ============================================

const functions = require('firebase-functions');
const fetch = require('node-fetch');

// مفتاح Gemini API (محمي على الخادم!)
const GEMINI_API_KEY = 'AIzaSyANdfNaoJx3HkymGSScgN1LwYkQ1hirKL4';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Cloud Function عام للطلبات من المتصفح
exports.geminiProxy = functions.https.onCall(async (data, context) => {
  try {
    const { prompt } = data;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // الاتصال الآمن من الخادم بدون عرض المفتاح
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini Error: ${error.error?.message || 'Unknown'}`);
    }

    const result = await response.json();

    if (result.candidates && result.candidates.length > 0) {
      const content = result.candidates[0].content;
      if (content && content.parts && content.parts.length > 0) {
        return {
          success: true,
          text: content.parts[0].text
        };
      }
    }

    throw new Error('No response from Gemini API');
  } catch (error) {
    console.error('Cloud Function Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// تصدير كـ HTTP function أيضاً (للاختبار)
exports.geminiHttp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
