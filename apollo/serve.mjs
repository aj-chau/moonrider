import http from 'node:http';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const types = {html:'text/html',js:'text/javascript',json:'application/json',png:'image/png',jpg:'image/jpeg',ogg:'audio/ogg',woff:'font/woff',obj:'text/plain'};
http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|apollo\/plugin\.js|(?:assets|build|vendor)\/[\w./%-]+)$/.test(path) || path.includes('..')) {
    res.writeHead(404).end(); return;
  }
  try {
    let body = await readFile(new URL(path,root));
    if (path === 'index.html') body = body.toString().replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/aframevr[^"]+/, 'build/aframe.min.js');
    res.writeHead(200,{'Content-Type':types[path.split('.').pop()] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(8423,'localhost');
