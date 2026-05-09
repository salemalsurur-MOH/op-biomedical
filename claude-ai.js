// ============================================
// Claude AI Integration
// ربط Claude API مع المساعد الذكي
// ============================================

class ClaudeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.initialized = !!apiKey;
  }

  async complete(prompt) {
    if (!this.initialized) {
      throw new Error('Claude API key not configured');
    }

    try {
      const systemPrompt = `أنت مساعد إداري عربي ذكي. حلّل أمر المستخدم وأرجع JSON فقط.

أرجع JSON بهذه البنية:
{
  "intent": "create" أو "update" أو "complete" أو "unclear",
  "title": "عنوان قصير",
  "priority": "high" أو "medium" أو "low",
  "deadline_days": عدد أو null,
  "action_text": "نص الإجراء"
}`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: prompt
          }]
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Claude API Error:', error);
        throw new Error(`Claude Error: ${error.error?.message || `HTTP ${response.status}`}`);
      }

      const data = await response.json();

      if (data.content && data.content.length > 0) {
        const text = data.content[0].text;

        // استخرج JSON من الرد
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return jsonMatch[0];
        }

        return text;
      }

      throw new Error('No response from Claude API');
    } catch (error) {
      console.error('Claude AI Error:', error);
      throw error;
    }
  }
}

// Global instance
window.claudeAI = null;

// Initialize Claude
function initClaude(apiKey) {
  if (!apiKey) {
    console.warn('Claude API key not provided');
    return false;
  }

  window.claudeAI = new ClaudeAI(apiKey);
  console.log('✅ Claude AI initialized');
  return true;
}

// Compatible interface
window.claude = {
  complete: async (prompt) => {
    if (!window.claudeAI) {
      throw new Error('Claude AI not initialized');
    }
    return await window.claudeAI.complete(prompt);
  }
};
