let sharedHistory: Array<{ id: string; user: string; result: string; timestamp: number; duration?: number; targets?: any[]; answers?: any[] }> = [];

function pruneHistory(list: any[]) {
  if (!Array.isArray(list)) return [];
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const filtered = list
    .filter(item => item && (item.timestamp || 0) >= oneDayAgo)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (filtered.length > 50) {
    return filtered.slice(0, 50);
  }
  return filtered;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      sharedHistory = pruneHistory(sharedHistory);
      return res.status(200).json({ history: sharedHistory });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const { entry, history } = body || {};
      if (Array.isArray(history)) {
        const existingIds = new Set(sharedHistory.map(h => h && h.id).filter(Boolean));
        for (const item of history) {
          if (item && item.id && !existingIds.has(item.id)) {
            sharedHistory.push(item);
            existingIds.add(item.id);
          }
        }
      }

      if (entry && entry.id) {
        const existing = sharedHistory.find(h => h && h.id === entry.id);
        if (!existing) {
          sharedHistory.unshift(entry);
        }
      }

      sharedHistory = pruneHistory(sharedHistory);
      return res.status(200).json({ success: true, history: sharedHistory });
    }

    if (req.method === 'DELETE') {
      const id = (req.query?.id || req.body?.id) as string | undefined;
      if (id) {
        sharedHistory = sharedHistory.filter(h => h && h.id !== id);
      } else {
        sharedHistory = [];
      }
      return res.status(200).json({ success: true, history: sharedHistory });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Internal server error', history: sharedHistory });
  }
}
