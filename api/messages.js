import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
  // Add simple CORS headers
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

  // POST /api/messages (Submit message)
  if (req.method === 'POST') {
    try {
      const { name, email, phone, message } = req.body;

      if (!name || !email || !message) {
        res.status(400).json({ error: 'Name, email, and message are required.' });
        return;
      }

      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const newMessage = {
        id,
        name,
        email,
        phone: phone || '',
        message,
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from('messages')
        .insert([newMessage]);

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

  // GET /api/messages (Retrieve messages)
  if (req.method === 'GET') {
    try {
      const { password } = req.query;
      const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';

      if (password !== expectedPassword) {
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
