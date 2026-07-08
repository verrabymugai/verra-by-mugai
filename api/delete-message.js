import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- CORS: restrict to own domain ---
const ALLOWED_ORIGINS = [
  'https://www.verrabymugai.com',
  'https://verrabymugai.com',
  'https://verra-by-mugai.vercel.app',
  'http://localhost:3000'
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase configuration is missing. Please configure SUPABASE_URL and SUPABASE_KEY in Vercel/environment settings.' });
    return;
  }

  if (req.method === 'POST') {
    try {
      // Read password from Authorization header
      const authHeader = req.headers['authorization'] || '';
      const password = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';

      if (!password || password !== expectedPassword) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
      }

      const { id } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Message ID is required.' });
        return;
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', String(id).substring(0, 50));

      if (error) {
        console.error('Supabase delete error:', error);
        res.status(500).json({ error: 'Database error. Failed to delete message.' });
        return;
      }

      res.status(200).json({ message: 'Message deleted successfully.' });
    } catch (err) {
      console.error('Error handling delete POST:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
