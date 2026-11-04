/* Optional desktop input for Moon Rider's Classic mode. */
(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('apollo')) return;
  if (params.get('debugvr') !== 'true') {
    params.set('debugvr', 'true');
    location.replace('?' + params);
    return;
  }
  function setup () {
    const scene = document.querySelector('a-scene');
    const trackerOrigin = 'http://127.0.0.1:8422';
    const panel = document.createElement('aside');
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:100000;width:min(320px,45vw);background:#132332;color:white;padding:10px;font:14px system-ui;border-radius:8px';
    panel.innerHTML = '<b>Apollo movement</b> <button id="recenter">Recenter</button> <button id="preview">Hide preview</button><p aria-live="polite">Start the camera below and face forward.</p><iframe title="Apollo webcam controls" style="width:100%;height:215px;border:0" allow="camera"></iframe>';
    document.body.appendChild(panel);
    const frame = panel.querySelector('iframe');
    frame.src = trackerOrigin + '/#moonrider';
    const status = panel.querySelector('p');
    const hands = ['leftHand','rightHand'].map(id => document.getElementById(id));
    const camera = document.getElementById('camera');
    const valid = [false,false];
    const lastSeen = [0,0];
    let center, lastPose = 0;
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0,0,-1);
    const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
    const seen = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.visibility >= 0.55;
    hands.forEach((hand,i) => {
      const blade = hand.components.blade;
      const hit = blade.checkCollision.bind(blade);
      blade.checkCollision = beat => valid[i] && performance.now()-lastSeen[i] < 250 && hit(beat);
      hand.object3D.visible = false;
    });
    // Keep mouse menus usable while enabling Moon Rider's physical hit testing.
    const mouse = document.getElementById('mouseCursor');
    mouse.removeAttribute('bind__raycaster');
    mouse.setAttribute('raycaster','enabled',true);
    scene.emit('gamemode','classic');
    panel.querySelector('#recenter').onclick = () => {
      center = null;
      status.textContent = 'Face forward with shoulders visible.';
    };
    const preview = panel.querySelector('#preview');
    preview.onclick = () => {
      // Keep the iframe rendering while compacted so pose updates continue.
      const small = frame.style.height === '2px';
      frame.style.height = small ? '215px' : '2px';
      preview.textContent = small ? 'Hide preview' : 'Show preview';
    };
    window.addEventListener('message', event => {
      if (event.origin !== trackerOrigin || event.source !== frame.contentWindow ||
          event.data?.type !== 'apollo-pose') return;
      const {pose,aspect} = event.data;
      if (!pose || !seen(pose[11]) || !seen(pose[12])) return;
      const now = performance.now();
      const sx = (pose[11].x + pose[12].x)/2;
      const sy = (pose[11].y + pose[12].y)/2;
      if (!center) {
        const span = Math.abs(pose[11].x-pose[12].x);
        if (span < 0.035) return;
        center = {x:sx,y:sy,scale:0.44/span};
      }
      lastPose = now;
      const x = p => (center.x-p.x)*center.scale;
      const y = p => 1.42+(center.y-p.y)*center.scale/aspect;
      camera.object3D.position.set(clamp((center.x-sx)*center.scale,-1.25,1.25),
        clamp(1.6+(center.y-sy)*center.scale/aspect,0.55,2.25),0.5);
      hands.forEach((hand,i) => {
        const wrist = pose[15+i], elbow = pose[13+i];
        const tracked = seen(wrist) && seen(elbow);
        hand.object3D.visible = tracked;
        if (!tracked) { valid[i] = false; lastSeen[i] = 0; return; }
        const obj = hand.object3D;
        obj.position.set(clamp(x(wrist)*1.35,-1.5,1.5),clamp(y(wrist),0.2,2.6),-0.25);
        direction.set(x(wrist)-x(elbow),y(wrist)-y(elbow),-0.27).normalize();
        obj.quaternion.setFromUnitVectors(forward,direction);
        // Let the native blade rebuild its short velocity history after loss.
        if (now-lastSeen[i]>250) hand.dataset.warmup = String(now+120);
        lastSeen[i] = now;
        valid[i] = now >= Number(hand.dataset.warmup || 0);
      });
      const message = 'Classic · ' + hands.filter(h=>h.object3D.visible).length + '/2 wrists · mouse to select a song';
      if (status.textContent !== message) status.textContent = message;
    });
    setInterval(() => {
      if (!lastPose || performance.now()-lastPose < 300) return;
      hands.forEach((h,i) => { h.object3D.visible=false; valid[i]=false; });
      status.textContent='Tracking lost · face the camera with shoulders visible';
    },150);
  }
  const scene = document.querySelector('a-scene');
  if (scene?.hasLoaded) setup();
  else if (scene) scene.addEventListener('loaded',setup,{once:true});
  else window.addEventListener('loaded', e => {if(e.target.tagName==='A-SCENE') setup();},true);
})();

