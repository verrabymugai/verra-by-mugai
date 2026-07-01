import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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
      const { page, referer, ua } = req.body;
      const userAgent = ua || req.headers['user-agent'] || 'Unknown';
      const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const referral = referer || 'Direct';

      // Device detection
      let device = 'Desktop';
      if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
        device = /iPad/i.test(userAgent) ? 'Tablet' : 'Mobile';
      }

      const visitEntry = {
        timestamp: new Date().toISOString(),
        page: page || '/',
        ip,
        device,
        referer: referral,
        ua: userAgent.substring(0, 150)
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

  // GET /api/analytics (Retrieve analytics data)
  if (req.method === 'GET') {
    try {
      const { password } = req.query;
      const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';

      if (password !== expectedPassword) {
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
