import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- Rate Limiting (in-memory, per serverless instance) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // max 30 analytics pings per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) return true;
  return false;
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // POST /api/analytics (Record a new visit)
  if (req.method === 'POST') {
    try {
      const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '').split(',')[0].trim();

      // Rate limiting by IP
      if (isRateLimited(ip)) {
        res.status(429).json({ error: 'Too many requests.' });
        return;
      }

      const { page, referer, ua } = req.body;
      const userAgent = ua || req.headers['user-agent'] || 'Unknown';
      const referral = referer || 'Direct';

      // Device detection
      let device = 'Desktop';
      if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
        device = /iPad/i.test(userAgent) ? 'Tablet' : 'Mobile';
      }

      const visitEntry = {
        timestamp: new Date().toISOString(),
        page: String(page || '/').substring(0, 200),
        ip,
        device,
        referer: String(referral).substring(0, 500),
        ua: String(userAgent).substring(0, 150)
      };

      const { error } = await supabase
        .from('analytics')
        .insert([visitEntry]);

      if (error) {
        console.error('Supabase analytics insert error:', error);
        res.status(500).json({ error: 'Database error. Failed to save visit.' });
        return;
      }

      res.status(201).json({ message: 'Visit recorded successfully.' });
    } catch (err) {
      console.error('Error handling analytics POST:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
    return;
  }

  // GET /api/analytics (Retrieve analytics data — admin only)
  if (req.method === 'GET') {
    try {
      // Read password from Authorization header instead of query string
      const authHeader = req.headers['authorization'] || '';
      const password = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';

      if (!password || password !== expectedPassword) {
        res.status(401).json({ error: 'Unauthorized. Invalid password.' });
        return;
      }

      const { data, error } = await supabase
        .from('analytics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Supabase analytics query error:', error);
        res.status(500).json({ error: 'Database error. Failed to load analytics.' });
        return;
      }

      res.status(200).json(data || []);
    } catch (err) {
      console.error('Error handling analytics GET:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
