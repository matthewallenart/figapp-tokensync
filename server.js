const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Simple HTTP server to serve the plugin files and handle API requests
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoints
  if (pathname.startsWith('/api/')) {
    handleAPIRequest(req, res, pathname);
    return;
  }

  // Serve static files
  let filePath = '.' + pathname;
  if (pathname === '/') {
    filePath = './ui.html';
  }

  // Get file extension for content type
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

async function handleAPIRequest(req, res, pathname) {
  try {
    if (pathname === '/api/collections' && req.method === 'GET') {
      // Get all token collections from database
      const result = await pool.query(`
        SELECT tc.*, u.name as user_name 
        FROM token_collections tc 
        LEFT JOIN users u ON tc.user_id = u.id 
        ORDER BY tc.updated_at DESC 
        LIMIT 10
      `);
      
      const collections = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        figmaFileName: row.figma_file_name,
        tokenCount: row.token_count,
        updatedAt: row.updated_at
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(collections));
      return;
    }

    if (pathname === '/api/collections' && req.method === 'POST') {
      // Save a new token collection
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { figmaFileId, figmaFileName, name, tokens, metadata, tokenCount } = data;
          
          // First ensure user exists (demo user for now)
          const userResult = await pool.query(`
            INSERT INTO users (figma_user_id, name) 
            VALUES ('demo-user', 'Demo User') 
            ON CONFLICT (figma_user_id) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `);
          const userId = userResult.rows[0].id;
          
          // Insert token collection
          const result = await pool.query(`
            INSERT INTO token_collections (user_id, figma_file_id, figma_file_name, name, tokens, metadata, token_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [userId, figmaFileId, figmaFileName, name, JSON.stringify(tokens), JSON.stringify(metadata), tokenCount]);
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
          console.error('Save collection error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid data' }));
        }
      });
      return;
    }

    if (pathname === '/api/exports' && req.method === 'GET') {
      // Get export history from database
      const result = await pool.query(`
        SELECT eh.*, tc.name as collection_name 
        FROM export_history eh 
        LEFT JOIN token_collections tc ON eh.collection_id = tc.id 
        ORDER BY eh.created_at DESC 
        LIMIT 20
      `);
      
      const exports = result.rows.map(row => ({
        id: row.id,
        exportType: row.export_type,
        status: row.status,
        tokenCount: row.token_count,
        createdAt: row.created_at,
        commitUrl: row.commit_url,
        collectionName: row.collection_name,
        error: row.error_message
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(exports));
      return;
    }

    // 404 for unknown API endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  } catch (error) {
    console.error('Database error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database error' }));
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});