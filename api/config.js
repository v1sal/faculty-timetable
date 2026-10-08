import publicConfig from '../config/supabase-public.js';

// Defaults are public application settings, not database credentials.
// Environment variables can override them without changing source.
export function createConfigHandler(defaults = {}) {
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const url = process.env.SUPABASE_URL || defaults.url;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || defaults.key;
    if (!url || !key) {
      return res.status(503).json({
        error: 'Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Environment Variables, then redeploy.',
      });
    }
    if (key.startsWith('sb_secret_')) {
      return res.status(503).json({ error: 'Use a publishable key, never a secret key.' });
    }
    if (key.split('.').length === 3) {
      try {
        const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
        if (claims.role !== 'anon') {
          return res.status(503).json({ error: 'Use a publishable key or legacy anon key.' });
        }
      } catch {
        return res.status(503).json({ error: 'Invalid Supabase publishable key.' });
      }
    } else if (!key.startsWith('sb_publishable_')) {
      return res.status(503).json({ error: 'Invalid Supabase publishable key.' });
    }
    return res.status(200).json({ url, key });
  };
}

export default createConfigHandler(publicConfig);
