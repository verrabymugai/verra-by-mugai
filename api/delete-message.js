import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { id, password } = req.body;
      const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';

      if (password !== expectedPassword) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
      }

      if (!id) {
        res.status(400).json({ error: 'Message ID is required.' });
        return;
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

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
