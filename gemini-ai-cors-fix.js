// ============================================
// Gemini AI - CORS Fix (بدون Cloud Function)
// استخدام CORS proxy مؤقت
// ============================================

class GeminiAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
   إلى: this.baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';    // CORS proxy (لفترة مؤقتة فقط)
    this.proxyUrl = 'https://api.allorigins.win/raw?url=';
    this.initialized = !!apiKey;
  }

  async complete(prompt) {
    if (!this.initialized) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // محاولة 1: استخدام fetch عادي (قد يفشل في بعض المتصفحات)
      return await this.directFetch(prompt);
    } catch (directError) {
      console.warn('Direct fetch failed, trying alternative method...');
      try {
        // محاولة 2: استخدام طريقة بديلة
        return await this.alternativeFetch(prompt);
      } catch (altError) {
        throw new Error(`All methods failed: ${directError.message}`);
      }
    }
  }

  async directFetch(prompt) {
    const fullUrl = `${this.baseUrl}?key=${this.apiKey}`;

    const response = await fetch(fullUrl, {
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
      throw new Error(`HTTP ${response.status}: ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    return this.extractText(data);
  }

  async alternativeFetch(prompt) {
    // طريقة بديلة: إرسال عبر XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fullUrl = `${this.baseUrl}?key=${this.apiKey}`;

      xhr.open('POST', fullUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          const text = this.extractText(data);
          resolve(text);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error(`Network error: ${xhr.statusText}`));
      };

      xhr.send(JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }));
    });
  }

  extractText(data) {
    if (data.candidates && data.candidates.length > 0) {
      const content = data.candidates[0].content;
      if (content && content.parts && content.parts.length > 0) {
        return content.parts[0].text;
      }
    }
    throw new Error('No response from Gemini API');
  }

  setApiKey(newKey) {
    this.apiKey = newKey;
    this.initialized = !!newKey;
  }
}

// Global instance
window.geminiAI = null;

// Initialize Gemini
function initGemini(apiKey) {
  if (!apiKey) {
    console.warn('Gemini API key not provided');
    return false;
  }

  window.geminiAI = new GeminiAI(apiKey);
  console.log('✅ Gemini AI initialized (CORS Fix)');
  return true;
}

// Compatible interface
window.claude = {
  complete: async (prompt) => {
    if (!window.geminiAI) {
      throw new Error('Gemini AI not initialized');
    }
    return await window.geminiAI.complete(prompt);
  }
};
