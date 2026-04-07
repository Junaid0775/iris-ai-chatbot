import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// =============================================
//   PASTE YOUR API KEYS HERE
// =============================================
const OPENAI_KEY  = "YOUR_OPENAI_API_KEY_HERE";
const CLAUDE_KEY  = "YOUR_CLAUDE_API_KEY_HERE";
// =============================================

// Health check route — open http://localhost:3000 to confirm server is running
app.get('/', (req, res) => {
  res.json({ status: 'IRIS backend is running', port: PORT });
});

// Main chat route
app.post('/chat', async (req, res) => {
  const { model, messages, system } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'Missing model or messages' });
  }

  try {

    // ── LOCAL (Ollama) ──────────────────────────────────────────────────────
    if (model === 'local') {
      const ollamaMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const r = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          stream: false,
          messages: ollamaMessages
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!r.ok) {
        const err = await r.text();
        return res.status(502).json({ error: 'Ollama error: ' + err });
      }

      const data = await r.json();
      const reply = data.message?.content || data.response || 'No response from Ollama';
      return res.json({ reply, model: 'llama3.2 (local)' });
    }

    // ── OPENAI ──────────────────────────────────────────────────────────────
    if (model === 'openai') {
      const openaiMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openaiMessages
        })
      });

      if (!r.ok) {
        const err = await r.text();
        return res.status(502).json({ error: 'OpenAI error: ' + err });
      }

      const data = await r.json();
      const reply = data.choices?.[0]?.message?.content || 'No response from OpenAI';
      return res.json({ reply, model: 'gpt-4o-mini (OpenAI)' });
    }

    // ── CLAUDE ──────────────────────────────────────────────────────────────
    if (model === 'claude') {
      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: messages
      };
      if (system) body.system = system;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      if (!r.ok) {
        const err = await r.text();
        return res.status(502).json({ error: 'Claude error: ' + err });
      }

      const data = await r.json();
      const reply = data.content?.map(b => b.type === 'text' ? b.text : '').join('') || 'No response from Claude';
      return res.json({ reply, model: 'claude-sonnet (Claude)' });
    }

    return res.status(400).json({ error: `Unknown model: ${model}` });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════╗');
  console.log('  ║   IRIS Backend · Port ' + PORT + '      ║');
  console.log('  ║   http://localhost:' + PORT + '          ║');
  console.log('  ╚════════════════════════════════╝');
  console.log('');
  console.log('  Models ready:');
  console.log('  • Local  → Ollama (ollama serve + ollama pull llama3.2)');
  console.log('  • OpenAI → paste key in OPENAI_KEY');
  console.log('  • Claude → paste key in CLAUDE_KEY');
  console.log('');
});
