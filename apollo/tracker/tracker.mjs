import {FilesetResolver, PoseLandmarker} from './assets/vision_bundle.mjs';
const get = selector => document.querySelector(selector);
if (location.hash==='#moonrider') {
  const compact=document.createElement('style');
  compact.textContent='main{margin:0;padding:4px}main>small,main>h1,main>p:first-of-type{display:none}select{max-width:52%}button,select{font-size:13px}#status{font-size:12px;margin:5px 0}canvas{max-height:145px;object-fit:contain}';
  document.head.appendChild(compact);
}
const video=get('video'), canvas=get('canvas'), ctx=canvas.getContext('2d');
const camera=get('#camera'), button=get('#toggle'), status=get('#status');
let model, stream, animation, previousTime, count, since, fps;
let native;
function stop(message='Camera stopped') {
  cancelAnimationFrame(animation);
  native?.abort(); native=null;
  stream?.getTracks().forEach(track=>track.stop());
  stream=null; video.srcObject=null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  status.textContent=message; button.textContent='Start camera';
  button.disabled=false; camera.disabled=false;
}
function draw(now,source=video) {
  try {
    if (source!==video || (video.readyState>=2 && video.currentTime!==previousTime)) {
      previousTime=video.currentTime;
      const {width:w,height:h}=canvas;
      const pose=model.detectForVideo(source,now).landmarks[0];
      if (window.parent!==window && location.hash==='#moonrider') {
        window.parent.postMessage({type:'apollo-pose',pose,aspect:w/h},'http://localhost:8423');
      }
      ctx.save(); ctx.translate(w,0); ctx.scale(-1,1); ctx.drawImage(source,0,0,w,h); ctx.restore();
      const xy=p=>[(1-p.x)*w,p.y*h];
      const visible=p=>p && (p.visibility??1)>=0.55;
      if (pose) {
        ctx.strokeStyle='#64ffca'; ctx.lineWidth=3;
        for (const {start,end} of PoseLandmarker.POSE_CONNECTIONS) {
          if (!visible(pose[start]) || !visible(pose[end])) continue;
          ctx.beginPath(); ctx.moveTo(...xy(pose[start])); ctx.lineTo(...xy(pose[end])); ctx.stroke();
        }
        for (const [i,label] of [[15,'L'],[16,'R']]) {
          if (!visible(pose[i])) continue;
          const [x,y]=xy(pose[i]);
          ctx.fillStyle='#102538'; ctx.beginPath(); ctx.arc(x,y,14,0,2*Math.PI); ctx.fill();
          ctx.fillStyle='white'; ctx.font='bold 16px system-ui'; ctx.textAlign='center'; ctx.fillText(label,x,y+6);
        }
      }
      count++;
      if (now-since>=1000) {fps=Math.round(count*1000/(now-since)); count=0; since=now;}
      status.textContent=(pose?'Body detected':'Looking for player')+' · '+(fps??'…')+' FPS';
    }
    if(source===video) animation=requestAnimationFrame(draw);
  } catch(error) {stop(error.message);}
}
async function loadModel(){
  model??=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('./assets/wasm'),{baseOptions:{modelAssetPath:'./assets/pose.task'},runningMode:'VIDEO',numPoses:1});
}
async function nativeCamera(){
  const controller=new AbortController();
  native=controller;
  status.textContent='Opening Dell RGB webcam through Windows';
  button.textContent='Stop camera'; button.disabled=false;
  try {
    await loadModel();
    const response=await fetch('/camera',{method:'POST',headers:{'X-Apollo-Camera':'start'},signal:controller.signal});
    if(!response.ok) throw Error('Windows could not open the Dell webcam ('+response.status+')');
    const reader=response.body.getReader(), decoder=new TextDecoder();
    let pending=new Uint8Array(0);
    count=0; since=performance.now(); fps=null;
    while(!controller.signal.aborted){
      const {value,done}=await reader.read();
      if(done) throw Error('Dell camera stream ended');
      const bytes=new Uint8Array(pending.length+value.length);
      bytes.set(pending); bytes.set(value,pending.length); pending=bytes;
      let latest;
      while(pending.length){
        const header=decoder.decode(pending.subarray(0,256));
        const end=header.indexOf('\r\n\r\n');
        if(end<0) break;
        const length=Number(/Content-length:\s*(\d+)/i.exec(header.slice(0,end))?.[1]);
        if(!length) throw Error('Invalid camera frame');
        const start=end+4;
        if(pending.length<start+length) break;
        latest=pending.subarray(start,start+length); pending=pending.subarray(start+length);
      }
      if(latest){
        const bitmap=await createImageBitmap(new Blob([latest],{type:'image/jpeg'}));
        try {
          if(controller.signal.aborted) return;
          if(canvas.width!==bitmap.width || canvas.height!==bitmap.height){canvas.width=bitmap.width; canvas.height=bitmap.height;}
          draw(performance.now(),bitmap);
        } finally {bitmap.close();}
      }
    }
  } catch(error){if(!controller.signal.aborted) stop(error.message);}
}
button.onclick=async()=>{
  if (stream || native) {stop(); return;}
  button.disabled=true; camera.disabled=true;
  try {
    status.textContent='Opening webcam · allow camera access if prompted';
    const open=id=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:540},...(id && {deviceId:{exact:id}})},audio:false});
    const known=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const selected=camera.value || known.find(d=>/DELL.*RGB/i.test(d.label))?.deviceId;
    stream=await open(selected);
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const dell=devices.find(d=>/DELL.*RGB/i.test(d.label));
    if (!camera.value && dell && stream.getVideoTracks()[0].getSettings().deviceId!==dell.deviceId) {
      stream.getTracks().forEach(t=>t.stop()); stream=await open(dell.deviceId);
    }
    camera.replaceChildren(...devices.map(d=>new Option(d.label,d.deviceId)));
    camera.value=stream.getVideoTracks()[0].getSettings().deviceId;
    video.srcObject=stream; await video.play();
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    status.textContent='Loading body tracker';
    await loadModel();
    previousTime=-1; count=0; since=performance.now(); fps=null;
    button.textContent='Stop camera'; button.disabled=false;
    stream.getVideoTracks()[0].onended=()=>stop('Camera disconnected');
    animation=requestAnimationFrame(draw);
  } catch(error) {
    if(error.name==='NotAllowedError') {
      stream?.getTracks().forEach(track=>track.stop()); stream=null;
      await nativeCamera();
    } else stop(error.name+' · '+error.message);
  }
};
window.addEventListener('pagehide',()=>stop());

