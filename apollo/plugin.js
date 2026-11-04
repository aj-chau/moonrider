/* Optional desktop input for Moon Rider's Classic mode. */
(() => {
  const params = new URLSearchParams(location.search);
  const localService=location.origin==='http://localhost:8423';
  if (localService && !params.has('apollo')) return;
  if (params.get('debugvr') !== 'true') {
    params.set('debugvr', 'true');
    location.replace('?' + params);
    return;
  }
  function setup () {
    const scene = document.querySelector('a-scene');
    const panel = document.createElement('aside');
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:100000;width:min(320px,45vw);background:#132332;color:white;padding:10px;font:14px system-ui;border-radius:8px';
    panel.innerHTML = '<b>Apollo movement</b> <button id="recenter">Recenter</button> <button id="preview">Hide preview</button><p aria-live="polite">Start the camera below and face forward.</p><iframe title="Apollo webcam controls" style="width:100%;height:215px;border:0" allow="camera"></iframe>';
    document.body.appendChild(panel);
    const frame = panel.querySelector('iframe');
    const trackerOrigin=localService?'http://127.0.0.1:8422':location.origin;
    frame.src=localService?trackerOrigin+'/#moonrider':'./apollo/tracker/index.html#moonrider';
    const status = panel.querySelector('p');
    const reachLabel = document.createElement('label');
    reachLabel.innerHTML = 'Outer reach <select><option value="1">Original</option><option value="1.8" selected>Wide</option><option value="2.6">Extra wide</option></select>';
    panel.insertBefore(reachLabel,status);
    const reach = reachLabel.querySelector('select');
    const savedReach = localStorage.getItem('apollo.outerReach');
    if (Array.from(reach.options).some(option => option.value === savedReach)) reach.value = savedReach;
    reach.onchange = () => localStorage.setItem('apollo.outerReach',reach.value);
    const hands = ['leftHand','rightHand'].map(id => document.getElementById(id));
    const camera = document.getElementById('camera');
    const valid = [false,false];
    const lastSeen = [0,0];
    const lastElbow=[0,0];
    let center,lastPose=0;
    const seen=(p,t=0.55)=>p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.visibility>=t;
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0,0,-1);
    const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
    // Render ticks can repeat a camera pose several times. Keep the sweep
    // between actual camera samples in moving-player coordinates.
    const rig = document.getElementById('curveFollowRig').object3D;
    const swings = hands.map(() => ({
      points: Array.from({length:4}, () => new THREE.Vector3()),
      delta: new THREE.Vector3(), at:0, speed:0, available:false
    }));
    const local = Array.from({length:4}, () => new THREE.Vector3());
    const box = new THREE.Box3(), triangle = new THREE.Triangle(), scale = new THREE.Vector3();
    hands.forEach((hand,i) => {
      const blade = hand.components.blade;
      const swing = swings[i];
      const hit = blade.checkCollision.bind(blade);
      blade.checkCollision = beat => {
        const now = performance.now();
        if (!valid[i] || now-lastSeen[i]>=250) return false;
        if (hit(beat)) { swing.available=false; return true; }
        if (!swing.available || now-swing.at>95 || beat.data.type==='mine' ||
            beat.data.color !== (i===0?'red':'blue')) return false;
        const block = beat.blockEl.object3D;
        for(let j=0;j<4;j++){
          local[j].copy(swing.points[j]);
          block.worldToLocal(rig.localToWorld(local[j])).multiplyScalar(1.75);
        }
        box.copy(beat.bbox).expandByScalar(0.02);
        // Allow a late camera sample along the approach axis only.
        block.getWorldScale(scale);
        const depth=0.30*1.75/Math.max(0.001,Math.abs(scale.z));
        box.min.z-=depth; box.max.z+=depth;
        if (!box.intersectsTriangle(triangle.set(local[0],local[1],local[2])) &&
            !box.intersectsTriangle(triangle.set(local[2],local[3],local[1]))) return false;
        blade.strokeDirectionVector.copy(swing.delta).normalize();
        blade.strokeSpeed=swing.speed;
        swing.available=false;
        return true;
      };
      hand.object3D.visible = false;
    });
    // Keep mouse menus usable while enabling Moon Rider's physical hit testing.
    const mouse = document.getElementById('mouseCursor');
    mouse.removeAttribute('bind__raycaster');
    mouse.setAttribute('raycaster','enabled',true);
    scene.emit('gamemode','classic');
    if(params.has('monitor')){
      scene.emit('gamemode','punch');
      const summary=document.createElement('small');
      panel.insertBefore(summary,frame);
      const state=()=>scene.systems.state.state;
      let stats,previous=0,active=false;
      const reset=()=>{stats={mode:'punch',frames:0,bodyLost:0,leftLost:0,rightLost:0,
        gapMs:0,gaps:0,slowGaps:0,hits:0,misses:0,wrong:0,missWithTrackingGap:0,
        hitAtRest:0,score:0,playing:false};previous=0;};
      reset();
      const send=()=>{stats.playing=!!state().isPlaying;stats.mode=state().gameMode;stats.score=state().score.score;
        summary.textContent=(stats.playing?'Recording ':'Monitor connected · ')+stats.mode+' · '+stats.hits+' hits · '+stats.misses+' misses';
        if(localService) fetch('/apollo-session',{method:'POST',body:JSON.stringify(stats)}).catch(()=>{});
      };
      const playing=()=>state().isPlaying;
      window.addEventListener('message',e=>{
        if(e.origin!==trackerOrigin || e.source!==frame.contentWindow || e.data?.type!=='apollo-pose' || !playing()) return;
        if(!active){reset();active=true;}
        const t=performance.now(), p=e.data.pose;
        stats.frames++;if(previous){const gap=t-previous;stats.gapMs+=gap;stats.gaps++;if(gap>100)stats.slowGaps++;}
        previous=t;
        if(!seen(p?.[11]) || !seen(p?.[12]))stats.bodyLost++;
        if(!seen(p?.[15]))stats.leftLost++;
        if(!seen(p?.[16]))stats.rightLost++;
      });
      for(const [event,key] of [['beathit','hits'],['beatwrong','wrong'],['beatmiss','misses']]){
        scene.addEventListener(event,e=>{
          if(!playing())return;
          if(!active){reset();active=true;}
          stats[key]++;
          if(key==='hits' && e.detail?.percent<=60.01)stats.hitAtRest++;
          if(key==='misses' && (performance.now()-previous>100 || performance.now()-lastPose>100 ||
             lastSeen.some(t=>performance.now()-t>100)))stats.missWithTrackingGap++;
        });
      }
      setInterval(()=>{if(active && !playing()){active=false;send();}else send();},1000);
      summary.textContent='Local Punch monitor ready';
    }
    panel.querySelector('#recenter').onclick = () => {
      center=null;
      status.textContent = 'Face forward with shoulders visible.';
    };
    const preview = panel.querySelector('#preview');
    preview.onclick = () => {
      // Keep the iframe rendering while compacted so pose updates continue.
      const small = frame.style.height === '2px';
      frame.style.height = small ? '215px' : '2px';
      frame.contentWindow.postMessage({type:'apollo-preview',visible:small},trackerOrigin);
      preview.textContent = small ? 'Hide preview' : 'Show preview';
    };
    window.addEventListener('message',event=>{
      if(event.source!==frame.contentWindow || event.origin!==trackerOrigin || event.data?.type!=='apollo-pose') return;
      const {pose,aspect}=event.data;
      const now=performance.now();
      if(!pose || !seen(pose[11]) || !seen(pose[12])) return;
      const sx=(pose[11].x+pose[12].x)/2, sy=(pose[11].y+pose[12].y)/2;
      if(!center){
        const span=Math.abs(pose[11].x-pose[12].x);
        if(span<0.035) return;
        center={x:sx,y:sy,scale:0.44/span};
      }
      lastPose=now;
      const x=p=>(center.x-p.x)*center.scale;
      const y=p=>1.42+(center.y-p.y)*center.scale/aspect;
      camera.object3D.position.set(clamp((center.x-sx)*center.scale,-1.25,1.25),clamp(1.6+(center.y-sy)*center.scale/aspect,0.55,2.25),0.5);
      hands.forEach((hand,i)=>{
        const wrist=pose[15+i],elbow=pose[13+i];
        const continuing=lastSeen[i]>0 && now-lastSeen[i]<120;
        const elbowVisible=seen(elbow);
        const tracked=seen(wrist,continuing?0.40:0.55) && wrist.x>=0 && wrist.x<=1 && wrist.y>=0 && wrist.y<=1 &&
          (elbowVisible || (continuing && now-lastElbow[i]<120));
        hand.object3D.visible=tracked;
        if(!tracked){valid[i]=false;lastSeen[i]=0;return;}
        const obj = hand.object3D;
        // Classic inner lanes sit at +/-0.24. Amplify arm extension beyond
        // them, relative to the torso so leaning does not amplify the assist.
        const armX = (sx-wrist.x)*center.scale*1.35;
        const extra = Math.max(0,Math.abs(armX)-0.24)*(Number(reach.value)-1);
        const handX = x(wrist)*1.35 + Math.sign(armX)*extra;
        obj.position.set(clamp(handX,-1.5,1.5),clamp(y(wrist),0.2,2.6),-0.25);
        if (elbowVisible) {
          lastElbow[i]=now;
          direction.set(x(wrist)-x(elbow),y(wrist)-y(elbow),-0.27).normalize();
          obj.quaternion.setFromUnitVectors(forward,direction);
        }
        if(now-lastSeen[i]>250) hand.dataset.warmup=String(now+120);
        lastSeen[i]=now;
        valid[i]=now>=Number(hand.dataset.warmup||0);
        const swing=swings[i], points=swing.points, blade=hand.components.blade;
        points[2].copy(points[0]); points[3].copy(points[1]);
        rig.worldToLocal(blade.bladeTip.getWorldPosition(points[0]));
        rig.worldToLocal(blade.bladeHandle.getWorldPosition(points[1]));
        swing.delta.subVectors(points[0],points[2]);
        swing.delta.z=0;
        const elapsed=now-swing.at;
        swing.speed=swing.delta.length()*1000/Math.max(1,elapsed);
        swing.available=valid[i] && elapsed>0 && elapsed<150 &&
          swing.speed>=1 && swing.delta.lengthSq()>=0.0025;
        swing.at=now;
      });
      const message = scene.systems.state.state.gameMode+' · '+hands.filter(h=>h.object3D.visible).length+'/2 wrists · mouse to select a song';
      if (status.textContent !== message) status.textContent = message;
    });
    setInterval(() => {
      if (!lastPose || performance.now()-lastPose < 300) return;
      hands.forEach((h,i) => { h.object3D.visible=false; valid[i]=false; });
      status.textContent='Tracking lost Â· face the camera with shoulders visible';
    },150);
  }
  const scene = document.querySelector('a-scene');
  if (scene?.hasLoaded) setup();
  else if (scene) scene.addEventListener('loaded',setup,{once:true});
  else window.addEventListener('loaded', e => {if(e.target.tagName==='A-SCENE') setup();},true);
})();

