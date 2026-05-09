// ============================================
// Google Gemini AI Integration v2
// ربط Gemini API عبر Firebase Cloud Function (آمن!)
// ============================================

class GeminiAI {
  constructor(firebaseApp) {
    this.firebaseApp = firebaseApp;
    this.initialized = !!firebaseApp;
    this.useHttpFallback = false; // استخدم HTTP fallback إذا لم تعمل Cloud Functions
  }

  async complete(prompt) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      // جرّب Cloud Function أولاً (الطريقة الآمنة)
      return await this.callCloudFunction(prompt);
    } catch (error) {
      console.warn('Cloud Function failed, trying HTTP fallback:', error);
      try {
        // Fallback إلى HTTP إذا فشلت Cloud Function
        return await this.callHttpEndpoint(prompt);
      } catch (httpError) {
        console.error('Both methods failed:', httpError);
        throw new Error(`Failed to get AI response: ${httpError.message}`);
      }
    }
  }

  async callCloudFunction(prompt) {
    // Import Firebase functions (سيتم تحميله من index.html)
    if (!window.firebase?.functions) {
      throw new Error('Firebase Functions not available');
    }

    const functions = window.firebase.functions();
    const geminiProxy = functions.httpsCallable('geminiProxy');

    try {
      const result = await geminiProxy({ prompt });

      if (result.data.success) {
        return result.data.text;
      } else {
        throw new Error(result.data.error || 'Unknown error');
      }
    } catch (error) {
      throw new Error(`Cloud Function error: ${error.message}`);
    }
  }

  async callHttpEndpoint(prompt) {
    // Fallback: استخدم HTTP endpoint المباشر
    const functionUrl = 'https://us-central1-op-biomedical.cloudfunctions.net/geminiHttp';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const content = data.candidates[0].content;
      if (content && content.parts && content.parts.length > 0) {
        return content.parts[0].text;
      }
    }

    throw new Error('No response from Gemini API');
  }
}

// Global instance
window.geminiAI = null;

// Initialize with Firebase (سيتم استدعاؤها من firebase-sync.js)
function initGeminiWithFirebase(firebaseApp) {
  if (!firebaseApp) {
    console.warn('Firebase app not provided');
    return false;
  }

  window.geminiAI = new GeminiAI(firebaseApp);
  console.log('✅ Gemini AI initialized with Firebase');
  return true;
}

// Create compatible interface
window.claude = {
  complete: async (prompt) => {
    if (!window.geminiAI) {
      throw new Error('Gemini AI not initialized');
    }
    return await window.geminiAI.complete(prompt);
  }
};

// حاول التهيئة من Firebase إذا كان متاحاً
document.addEventListener('DOMContentLoaded', () => {
  // سينتظر firebase-sync.js ليقيم firebase أولاً
  setTimeout(() => {
    if (window.firebase?.apps?.length > 0) {
      initGeminiWithFirebase(window.firebase.app());
    }
  }, 1000);
});
