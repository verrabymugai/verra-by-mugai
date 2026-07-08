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

// --- Rate Limiting (in-memory) ---
const rateLimitMap = new Map();

function isRateLimited(ip, maxRequests, windowMs) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
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
  } else if (!origin) {
    // Same-origin requests (no Origin header) — allow for local dev
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

// --- Security Headers ---
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// --- Helper to extract password from Authorization header ---
function getPasswordFromHeader(req) {
  const authHeader = req.headers['authorization'] || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  console.log(`[${req.method}] ${pathname}`);

  // Apply security headers to all responses
  setSecurityHeaders(res);
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

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
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        if (isRateLimited(ip, 5, 60000)) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Too many requests. Please wait a minute before submitting again.' }));
          return;
        }

        const payload = JSON.parse(body);
        const { name, email, phone, message } = payload;
        
        if (!name || !email || !message) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Name, email, and message are required.' }));
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(email))) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Please provide a valid email address.' }));
          return;
        }
        
        const newMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          name: String(name).substring(0, 100),
          email: String(email).substring(0, 150),
          phone: phone ? String(phone).substring(0, 20) : '',
          message: String(message).substring(0, 2000),
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

  // API Route: GET /api/messages (Retrieve messages — admin only)
  if (req.method === 'GET' && pathname === '/api/messages') {
    const password = getPasswordFromHeader(req);
    const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
    
    if (!password || password !== expectedPassword) {
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

  // API Route: POST /api/messages/delete (Delete message — admin only)
  if (req.method === 'POST' && pathname === '/api/messages/delete') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const password = getPasswordFromHeader(req);
        const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
        
        if (!password || password !== expectedPassword) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized.' }));
          return;
        }

        const payload = JSON.parse(body);
        const { id } = payload;
        
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', String(id).substring(0, 50));
          
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
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        if (isRateLimited(ip, 30, 60000)) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Too many requests.' }));
          return;
        }

        const payload = JSON.parse(body);
        const { page, referer, ua } = payload;
        const userAgent = ua || req.headers['user-agent'] || 'Unknown';
        const referral = referer || 'Direct';
        
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

  // API Route: GET /api/analytics (Retrieve visitor data — admin only)
  if (req.method === 'GET' && pathname === '/api/analytics') {
    const password = getPasswordFromHeader(req);
    const expectedPassword = process.env.PORTAL_PASSWORD || 'verra2026';
    
    if (!password || password !== expectedPassword) {
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
    const safePath = pathname.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    res.end(`<html><head><title>404 Not Found</title></head><body style="font-family: sans-serif; background: #f5ede3; color: #1c2b1f; padding: 2rem; text-align: center;"><h1>404 Not Found</h1><p>The file <b>${safePath}</b> could not be found locally.</p><a href="/" style="color: #c19a6b; font-weight: bold;">Go back to home</a></body></html>`);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Local dev server running at: http://localhost:${PORT}/`);
  console.log(`📁 Serving static files from: ${__dirname}`);
  console.log(`======================================================\n`);
});
