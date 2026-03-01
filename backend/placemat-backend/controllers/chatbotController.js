const { GROQ_API_KEY, GROQ_MODEL } = require('../config/env');

const SYSTEM_PROMPT = [
  'You are PlaceMate AI, an assistant for SCSIT DAVV campus placements.',
  'You must provide concise, practical, student-friendly answers.',
  'Scope: placement process, eligibility, resume tips, interview prep, offers, registration/login guidance.',
  'If asked unrelated questions, politely redirect to placement topics.'
].join(' ');

function getFallbackReply(message) {
  const input = String(message || '').toLowerCase();

  if (input.includes('register') || input.includes('sign up') || input.includes('create')) {
    return [
      'To register on PlaceMate:',
      '1) Click Sign Up',
      '2) Select Student or Company role',
      '3) Fill the form and submit',
      '4) Verify your email using the verification code',
      '5) Login after verification (and admin approval for companies).'
    ].join('\n');
  }

  if (input.includes('eligib') || input.includes('criteria') || input.includes('cgpa') || input.includes('backlog')) {
    return [
      'Eligibility is drive-specific, but usually includes:',
      '- Minimum CGPA threshold',
      '- Allowed branches',
      '- Graduation year',
      '- Backlog constraints',
      'Always check the specific drive details before applying.'
    ].join('\n');
  }

  if (input.includes('resume') || input.includes('cv') || input.includes('upload')) {
    return [
      'Resume tips:',
      '- Keep it to 1 page (2 max)',
      '- Add measurable project outcomes',
      '- Highlight skills relevant to target roles',
      '- Upload PDF format in your profile before applying'
    ].join('\n');
  }

  if (input.includes('interview') || input.includes('prepare') || input.includes('tips')) {
    return [
      'Interview prep checklist:',
      '- Revise DSA fundamentals',
      '- Practice your project explanations',
      '- Prepare HR answers (strengths, goals, teamwork)',
      '- Research the company and role'
    ].join('\n');
  }

  return [
    'I can help with placements, eligibility, resumes, and interview preparation.',
    'Try asking:',
    '- "How do I register?"',
    '- "What are common eligibility rules?"',
    '- "How do I improve my resume?"'
  ].join('\n');
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || '').slice(0, 1500).trim()
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-10);
}

async function ask(req, res) {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }
    if (message.length > 1500) {
      return res.status(400).json({ success: false, message: 'message is too long.' });
    }

    if (!GROQ_API_KEY) {
      return res.json({
        success: true,
        data: {
          provider: 'fallback',
          reply: getFallbackReply(message)
        }
      });
    }

    const history = sanitizeHistory(req.body?.history);
    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: 0.3,
        max_tokens: 450
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Groq API error:', response.status, errorBody);
      return res.json({
        success: true,
        data: {
          provider: 'fallback',
          reply: getFallbackReply(message)
        }
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.json({
        success: true,
        data: {
          provider: 'fallback',
          reply: getFallbackReply(message)
        }
      });
    }

    return res.json({
      success: true,
      data: {
        provider: 'groq',
        reply
      }
    });
  } catch (err) {
    console.error('Chatbot error:', err);
    return res.json({
      success: true,
      data: {
        provider: 'fallback',
        reply: getFallbackReply(req.body?.message || '')
      }
    });
  }
}

module.exports = { ask };
