import http from 'node:http';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
let session=null;
const types = {html:'text/html',js:'text/javascript',json:'application/json',png:'image/png',jpg:'image/jpeg',ogg:'audio/ogg',woff:'font/woff',obj:'text/plain'};
http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if(path==='apollo-session' && req.headers.host==='localhost:8423'){
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(session));return;}
    if(req.method!=='POST' || req.headers.origin!=='http://localhost:8423'){res.writeHead(403).end();return;}
    let body='';
    for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413).end();return;}}
    try{session={updated:Date.now(),...JSON.parse(body)};res.writeHead(204).end();}
    catch{res.writeHead(400).end();}
    return;
  }
  if (!/^(index\.html|apollo\/plugin\.js|(?:assets|build|vendor)\/[\w./%-]+)$/.test(path) || path.includes('..')) {
    res.writeHead(404).end(); return;
  }
  try {
    let body = await readFile(new URL(path,root));
    if (path === 'index.html') body = body.toString().replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/aframevr[^"]+/, 'build/aframe.min.js');
    res.writeHead(200,{'Content-Type':types[path.split('.').pop()] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(8423,'localhost');
