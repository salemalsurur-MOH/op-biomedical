# 🔌 Gemini API Integration - Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           User Input (Arabic)                   │
│     "أحتاج متابعة صيانة خلال 3 أيام"             │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  assistant.js      │
        │  parseCommand()    │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  gemini-ai.js      │
        │  window.claude.    │
        │  complete(prompt)  │
        └────────┬───────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │  Google Gemini API       │
     │  (generativelanguage...) │
     └──────────┬───────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │  JSON Response         │
      │  {intent, title, ..}   │
      └────────┬───────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │  applyResult()         │
      │  Create/Update Task    │
      └────────┬───────────────┘
                 │
                 ▼
      ┌────────────────────────┐
      │  saveTasks()           │
      │  + Firebase Sync       │
      └────────────────────────┘
```

---

## Files Structure

### 1. **gemini-ai.js** (NEW)
- **Class**: `GeminiAI`
- **Config**: 
  - Base URL: `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash`
  - Temperature: 0.7
  - Max tokens: 1024

- **Methods**:
  - `constructor(apiKey)` - Initialize
  - `async complete(prompt)` - Send prompt, get response
  - `setApiKey(newKey)` - Update API key

- **Global Interface**:
  ```javascript
  window.claude.complete(prompt) // Proxies to Gemini
  ```

### 2. **assistant.js** (MODIFIED)
- **Main Flow**:
  1. User types command in `#asst-input`
  2. `handleAssistantSubmit()` triggered
  3. Call `parseCommand(text)`
  4. Sends prompt to `window.claude.complete()`
  5. Parse JSON response
  6. `applyResult()` updates tasks
  7. `saveTasks()` persists data

- **Prompt Template**:
  ```
  أنت مساعد إداري عربي ذكي...
  التاريخ: ${today}
  المهام النشطة: ${taskList}
  أمر المستخدم: "${text}"
  
  أرجع JSON بهذه البنية...
  ```

### 3. **index.html** (UPDATED)
- **Script Loading Order**:
  1. `app-v2.js` - Files management
  2. `gemini-ai.js` - AI integration (NEW)
  3. `initGemini(API_KEY)` - Initialize (NEW)
  4. `assistant.js` - Task assistant
  5. `firebase-sync.js` - Data sync

---

## API Response Format

**Request**:
```javascript
{
  "contents": [{
    "parts": [{ "text": "your prompt" }]
  }],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1024
  }
}
```

**Response**:
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "{\"intent\": \"create\", \"title\": \"...\"}"
      }]
    }
  }]
}
```

**Parsing**:
```javascript
const result = extractJSON(response);
// {
//   "intent": "create|update|complete",
//   "title": "Task title",
//   "priority": "high|medium|low",
//   "deadline_days": 3,
//   "target_id": "t_xxx",
//   "action_text": "Action description"
// }
```

---

## Command Examples

| User Input | Intent | Action |
|-----------|--------|--------|
| "أحتاج فحص الأجهزة" | `create` | Create new task |
| "خلال 3 أيام" | - | Sets deadline |
| "عاجل جداً" | - | Sets priority: high |
| "تم الاتصال بالشركة" | `update` | Add action to task |
| "انتهيت" | `complete` | Archive task |

---

## Error Handling

### In `gemini-ai.js`:
```javascript
try {
  const response = await fetch(this.baseUrl, {...});
  if (!response.ok) throw new Error(...);
  // Parse and return result
} catch (error) {
  console.error('Gemini AI Error:', error);
  throw error;
}
```

### In `assistant.js`:
```javascript
try {
  const result = await parseCommand(text);
  applyResult(result, text);
} catch (e) {
  asstToast('تعذّر فهم الأمر', 'warn');
  console.error(e);
}
```

---

## Security Considerations

### ⚠️ Current Setup:
- API Key is in HTML (visible in browser)
- Works for prototyping/development

### ✅ Recommended (Production):
Use **Firebase Cloud Functions** as proxy:

```javascript
// Client-side (safe)
const response = await fetch('https://your-cloud-function.cloudfunctions.net/gemini', {
  method: 'POST',
  body: JSON.stringify({ prompt })
});

// Server-side (secure)
// API Key is protected on the function
```

---

## Testing Checklist

- [ ] Gemini AI loads without errors
- [ ] `window.geminiAI` is initialized
- [ ] `window.claude.complete()` is available
- [ ] Type Arabic command in task input
- [ ] Task is created with correct priority/deadline
- [ ] Firebase syncs across devices
- [ ] Archive and update work correctly
- [ ] No API errors in browser console

---

## Next Steps (Optional)

1. **Firebase Cloud Functions**: Move API key to server
2. **Prompt Optimization**: Improve AI accuracy
3. **Logging**: Track AI decisions for analytics
4. **Fallback**: Implement offline mode
5. **Caching**: Cache common responses

---

## Resources

- [Google Gemini API Docs](https://ai.google.dev/)
- [REST API Reference](https://ai.google.dev/tutorials/rest_quickstart)
- [Model: gemini-1.5-flash](https://ai.google.dev/models/gemini-1-5-flash)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
