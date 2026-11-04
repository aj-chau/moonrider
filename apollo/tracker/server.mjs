import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const port=8422;
const origin='http://127.0.0.1:'+port;
const ffmpeg=fileURLToPath(new URL('./.camera-runtime/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe',import.meta.url));
const types={html:'text/html',mjs:'text/javascript',js:'text/javascript',wasm:'application/wasm',task:'application/octet-stream'};
http.createServer(async(req,res)=>{
  if (req.url==='/camera') {
    if (req.method!=='POST' || req.headers.origin!==origin || 'http://'+req.headers.host!==origin || req.headers['x-apollo-camera']!=='start') {
      res.writeHead(403).end(); return;
    }
    const capture=spawn(ffmpeg,['-nostdin','-loglevel','error','-f','dshow','-video_size','640x360','-framerate','30','-vcodec','mjpeg','-i','video=DELL Monitor RGB Webcam','-an','-c:v','copy','-flush_packets','1','-f','mpjpeg','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    res.setHeader('Content-Type','multipart/x-mixed-replace; boundary=ffmpeg');
    res.setHeader('Cache-Control','no-store');
    capture.stdout.pipe(res,{end:false});
    const finish=()=>{if (!res.headersSent) res.statusCode=503; res.end();};
    capture.on('error',finish); capture.on('close',finish);
    res.on('close',()=>capture.kill());
    return;
  }
  const path=req.url==='/'?'index.html':req.url.slice(1);
  if (!/^(index\.html|tracker\.mjs|assets\/(wasm\/)?[\w.-]+)$/.test(path)){res.writeHead(404).end();return;}
  try {
    const body=await readFile(new URL(path,import.meta.url));
    res.writeHead(200,{'Content-Type':types[path.split('.').pop()]||'application/octet-stream'}).end(body);
  } catch {res.writeHead(404).end();}
}).listen(port,'127.0.0.1');
