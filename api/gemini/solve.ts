import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { contents, apiKey } = req.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(200).json({
        text: '',
        success: false,
        reason: 'no_key',
        message: 'No API key provided, using local solver.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contentPayload = Array.isArray(contents) ? contents : [contents];
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastReason = 'unknown';

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: contentPayload,
          config: { temperature: 0.1 },
        });

        const text = response?.text ? response.text.trim() : '';
        if (text) {
          return res.status(200).json({ text, success: true, model });
        }
      } catch (err: any) {
        const msg = (err && err.message) ? err.message : String(err);
        const is429 = msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
        const is403 = msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('does not have permission');
        const isInvalid = msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('400') || msg.includes('INVALID_ARGUMENT');

        if (is429) {
          lastReason = 'quota_exhausted';
          continue;
        }

        if (is403) {
          lastReason = 'permission_denied';
          break;
        }

        if (isInvalid) {
          lastReason = 'invalid_key';
          break;
        }

        lastReason = 'error';
        break;
      }
    }

    let failureMessage = 'Gemini rate-limited or unavailable.';
    if (lastReason === 'invalid_key') failureMessage = 'API key is not valid.';
    else if (lastReason === 'permission_denied') failureMessage = 'Permission denied (403): Generative Language API disabled or restricted in Cloud Console.';
    else if (lastReason === 'quota_exhausted') failureMessage = 'Gemini rate-limited or free quota reached (429).';

    return res.status(200).json({
      text: '',
      success: false,
      reason: lastReason,
      message: failureMessage,
    });
  } catch (err: any) {
    return res.status(200).json({
      text: '',
      success: false,
      reason: 'error',
      message: err?.message || 'Gemini solver error.',
    });
  }
}
