import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Helper to determine Content-Type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': return 'image/jpeg';
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

// Load environment variables from .env if present
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  console.log(`[${req.method}] ${pathname}`);

  if (pathname.startsWith('/api/') && !supabase) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Supabase configuration is missing. Please configure SUPABASE_URL and SUPABASE_KEY in your local .env file.' }));
    return;
  }

  // API Route: POST /api/messages (Submit message)
  if (req.method === 'POST' && pathname === '/api/messages') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { name, email, phone, message } = payload;
        
        if (!name || !email || !message) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Name, email, and message are required.' }));
          return;
        }
        
        const newMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
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
          console.error('Supabase messages insert error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Database error.' }));
          return;
        }
        
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Thank you! Your message has been submitted successfully.' }));
      } catch (err) {
        console.error('Error parsing POST body:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error.' }));
      }
    });
    return;
  }

  // API Route: GET /api/messages (Retrieve messages)
  if (req.method === 'GET' && pathname === '/api/messages') {
    const password = parsedUrl.searchParams.get('password') || req.headers['authorization'];
    const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
    
    if (password !== expectedPassword) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized. Invalid password.' }));
      return;
    }
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (error) {
      console.error('Supabase query error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Database error.' }));
      return;
    }
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data || []));
    return;
  }

  // API Route: POST /api/messages/delete (Delete message)
  if (req.method === 'POST' && pathname === '/api/messages/delete') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { id, password } = payload;
        const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
        
        if (password !== expectedPassword) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized.' }));
          return;
        }
        
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', id);
          
        if (error) {
          console.error('Supabase delete error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Database error.' }));
          return;
        }
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Message deleted successfully.' }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error.' }));
      }
    });
    return;
  }

  // API Route: POST /api/analytics (Record visit)
  if (req.method === 'POST' && pathname === '/api/analytics') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { page, referer, ua } = payload;
        const userAgent = ua || req.headers['user-agent'] || 'Unknown';
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        const referral = referer || 'Direct';
        
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
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Database error.' }));
          return;
        }
        
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Visit recorded successfully.' }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error.' }));
      }
    });
    return;
  }

  // API Route: GET /api/analytics (Retrieve visitor data)
  if (req.method === 'GET' && pathname === '/api/analytics') {
    const password = parsedUrl.searchParams.get('password') || req.headers['authorization'];
    const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
    
    if (password !== expectedPassword) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized. Invalid password.' }));
      return;
    }
    
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (error) {
      console.error('Supabase query error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Database error.' }));
      return;
    }
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data || []));
    return;
  }

  // Fallback to index.html for root path
  if (pathname === '/') {
    pathname = '/index.html';
  }


  const filePath = path.join(__dirname, pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const contentType = getContentType(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<html><head><title>404 Not Found</title></head><body style="font-family: sans-serif; background: #f5ede3; color: #1c2b1f; padding: 2rem; text-align: center;"><h1>404 Not Found</h1><p>The file <b>${pathname}</b> could not be found locally.</p><a href="/" style="color: #c19a6b; font-weight: bold;">Go back to home</a></body></html>`);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Local dev server running at: http://localhost:${PORT}/`);
  console.log(`📁 Serving static files from: ${__dirname}`);
  console.log(`======================================================\n`);
});
