import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- Rate Limiting (in-memory, per serverless instance) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // max 5 submissions per minute per IP

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

  // POST /api/messages (Submit message)
  if (req.method === 'POST') {
    try {
      // Rate limiting by IP
      const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
      if (isRateLimited(ip)) {
        res.status(429).json({ error: 'Too many requests. Please wait a minute before submitting again.' });
        return;
      }

      const { name, email, phone, message } = req.body;

      if (!name || !email || !message) {
        res.status(400).json({ error: 'Name, email, and message are required.' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email))) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }

      // Sanitize: limit field lengths to prevent abuse
      const sanitized = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: String(name).substring(0, 100),
        email: String(email).substring(0, 150),
        phone: phone ? String(phone).substring(0, 20) : '',
        message: String(message).substring(0, 2000),
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from('messages')
        .insert([sanitized]);

      if (error) {
        console.error('Supabase insert error:', error);
        res.status(500).json({ error: 'Database error. Failed to save message.' });
        return;
      }

      res.status(201).json({ message: 'Thank you! Your message has been submitted successfully.' });
    } catch (err) {
      console.error('Error handling message POST:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
    return;
  }

  // GET /api/messages (Retrieve messages — admin only)
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
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        res.status(500).json({ error: 'Database error. Failed to load messages.' });
        return;
      }

      res.status(200).json(data || []);
    } catch (err) {
      console.error('Error handling messages GET:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
