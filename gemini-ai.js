// ============================================
// Google Gemini AI Integration
// ربط Gemini API مع المساعد الذكي
// ============================================

class GeminiAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    this.initialized = !!apiKey;
  }

  async complete(prompt) {
    if (!this.initialized) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const response = await fetch(this.baseUrl, {
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
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Gemini API Error:', error);
        throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0].content;
        if (content && content.parts && content.parts.length > 0) {
          return content.parts[0].text;
        }
      }

      throw new Error('No response from Gemini API');
    } catch (error) {
      console.error('Gemini AI Error:', error);
      throw error;
    }
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
  console.log('✅ Gemini AI initialized');
  return true;
}

// إنشّئ واجهة متوافقة مع كود assistant.js
window.claude = {
  complete: async (prompt) => {
    if (!window.geminiAI) {
      throw new Error('Gemini AI not initialized. Please set API key.');
    }
    return await window.geminiAI.complete(prompt);
  }
};
