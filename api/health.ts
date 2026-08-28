export const config = { maxDuration: 10 };

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET /api/health.' });
    return;
  }
  res.status(200).json({ ok: true, service: 'moonex', timestamp: new Date().toISOString() });
}
