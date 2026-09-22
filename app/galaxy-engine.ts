import * as THREE from 'three';
import { artworkScale, CORE, randomSequence, type JourneyStage } from './galaxy-model';

type Input = { stage: JourneyStage; charge: number; launching: boolean; motion: boolean; resetView: number };
export type GalaxyController = { update: () => void; dispose: () => void };
const vertexShader = `
  attribute float size;
  attribute float phase;
  attribute vec3 scatter;
  uniform float time, pixelRatio, assembly, charge, opacity;
  uniform vec2 pointer;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 nucleus = vec3(-.3, -1.22, 0.0);
    vec3 p = mix(scatter, position, assembly);
    vec2 delta = p.xy - nucleus.xy;
    float radius = length(delta);
    float angle = charge * charge * (3.0 + radius * .6);
    delta = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * delta;
    p.xy = nucleus.xy + delta * (1.0 - charge * .88);
    p.z *= 1.0 - charge * .75;
    float proximity = exp(-length(p.xy - pointer) * 1.4);
    p.z += proximity * .55 + sin(time * .45 + phase) * .028;
    p.xy += normalize(p.xy - pointer + vec2(.001)) * proximity * .12;
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(size * pixelRatio * (18.0 / max(1.0, -viewPosition.z)) * (1.0 + proximity * .6 + charge * .6), 1.0, 60.0);
    vColor = color * (1.1 + charge * .4) + vec3(.12, .16, .2) * proximity;
    vAlpha = (.83 + .17 * sin(time * .7 + phase)) * opacity;
  }
`;
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = (gl_PointCoord - .5) * 2.0;
    float d = length(uv);
    if (d > 1.0) discard;
    float halo = exp(-d*d*6.0) * .65;
    float core = exp(-d*d*55.0);
    float cross = pow(max(0.0, 1.0-abs(uv.x*uv.y)*90.0), 8.0) * pow(1.0-d, 5.0) * .2;
    gl_FragColor = vec4(vColor + vec3(core * .3), (halo + core + cross) * vAlpha);
  }
`;

async function artworkParticles(compact: boolean) {
  const image = new Image(); image.src = '/images/astra.jpg'; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Artwork sampling unavailable');
  ctx.drawImage(image, 0, 0, 960, 540);
  const pixels = ctx.getImageData(0, 0, 960, 540).data, random = randomSequence();
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [], phases: number[] = [], scatter: number[] = [];
  // Each point is sampled from the supplied key visual. Depth comes from the
  // spiral's radius, so a side view has volume while the front keeps Astra's six.
  const step = compact ? 3 : 2;
  for (let y = 18; y < 520; y += step) for (let x = 245; x < 715; x += step) {
    let best = 0, px = x, py = y;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const k = ((y + dy) * 960 + x + dx) * 4;
      const lum = (pixels[k] + pixels[k + 1] + pixels[k + 2]) / 765;
      if (lum > best) { best = lum; px = x + dx; py = y + dy; }
    }
    if (best < .16 || (best < .29 && random() > .52)) continue;
    const k = (py * 960 + px) * 4, wx = (px / 960 - .5) * 20, wy = (.5 - py / 540) * 11.25;
    const r = Math.hypot(wx + .3, wy + 1.22), theta = Math.atan2(wy + 1.22, wx + .3);
    positions.push(wx, wy, Math.sin(theta * 1.5 + r * .7) * .28 + (random()-.5) * (.18 + r * .14));
    colors.push(pixels[k]/255, pixels[k+1]/255, pixels[k+2]/255);
    sizes.push(1.5 + best * 6.5 + (best > .8 && random() > .94 ? 8 : 0));
    phases.push(random() * Math.PI * 2);
    scatter.push((random()-.5)*28, (random()-.5)*19, (random()-.5)*16);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('scatter', new THREE.Float32BufferAttribute(scatter, 3));
  return { geometry, image };
}
function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'#ffffff'); gradient.addColorStop(.04,'#ffffff');
  gradient.addColorStop(.14,'#d3e8ffcc'); gradient.addColorStop(.4,'#9abaff33'); gradient.addColorStop(1,'#89bbff00');
  ctx.fillStyle=gradient; ctx.fillRect(0,0,128,128); return new THREE.CanvasTexture(canvas);
}

export async function createGalaxy(host: HTMLDivElement, getCore: () => HTMLDivElement | null, read: () => Input, onFailure: () => void): Promise<GalaxyController> {
  const compact = host.clientWidth < 760;
  const { geometry, image } = await artworkParticles(compact);
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ alpha:true, antialias:false, powerPreference:'low-power' }); }
  catch (error) { geometry.dispose(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.5 : 2));
  renderer.setClearColor(0x03080e,0);
  const el = renderer.domElement;
  el.tabIndex = 0; el.setAttribute('role','img'); el.setAttribute('aria-label','Interactive Astra star field. Drag or use arrow keys to rotate. Plus and minus zoom. R replays the formation.');
  host.appendChild(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42,1,.1,100);
  camera.position.set(0,0,18);
  const galaxy = new THREE.Group(); scene.add(galaxy);
  const uniforms = { time:{value:0}, pixelRatio:{value:renderer.getPixelRatio()}, assembly:{value:0}, charge:{value:0}, opacity:{value:1}, pointer:{value:new THREE.Vector2(100,100)} };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  const stars = new THREE.Points(geometry,material); stars.frustumCulled=false; galaxy.add(stars);

  // Soft photographic detail anchors the untouched front view. It recedes as
  // the actual point volume rotates or assembles; no opaque rotating image card.
  const artworkTexture = new THREE.Texture(image); artworkTexture.colorSpace=THREE.SRGBColorSpace; artworkTexture.needsUpdate=true;
  const artworkGeometry = new THREE.PlaneGeometry(20,11.25);
  const artworkMaterial = new THREE.ShaderMaterial({
    uniforms:{image:{value:artworkTexture},opacity:{value:0}}, transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D image;uniform float opacity;varying vec2 vUv;void main(){
      float edge=smoothstep(0.0,.17,vUv.x)*smoothstep(0.0,.17,1.0-vUv.x)*smoothstep(0.0,.18,vUv.y)*smoothstep(0.0,.18,1.0-vUv.y);
      gl_FragColor=vec4(texture2D(image,vUv).rgb,opacity*edge);
      #include <colorspace_fragment>
    }`,
  });
  const keyVisual = new THREE.Mesh(artworkGeometry,artworkMaterial); keyVisual.position.z=-.35; galaxy.add(keyVisual);
  const glow = glowTexture();
  const coreMaterial = new THREE.SpriteMaterial({ map:glow, color:0xe9f3ff, transparent:true, opacity:.75, depthWrite:false, blending:THREE.AdditiveBlending });
  const core = new THREE.Sprite(coreMaterial); core.position.fromArray(CORE); galaxy.add(core);
  const random = randomSequence(821), dustPositions = [], dustColors = [];
  for(let i=0;i<(compact?250:650);i++) {
    dustPositions.push((random()-.5)*34,(random()-.5)*24,(random()-.5)*20);
    const warm=random()>.8; dustColors.push(warm?.65:.35,warm?.5:.52,warm?.35:.75);
  }
  const dustGeometry=new THREE.BufferGeometry(); dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3)); dustGeometry.setAttribute('color',new THREE.Float32BufferAttribute(dustColors,3));
  const dustMaterial=new THREE.PointsMaterial({ size:.038, map:glow, vertexColors:true, transparent:true, opacity:.65, depthWrite:false, blending:THREE.AdditiveBlending });
  const dust=new THREE.Points(dustGeometry,dustMaterial); scene.add(dust);
  const projected=new THREE.Vector3(), coreWorld=new THREE.Vector3(), focus=new THREE.Vector3(), raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(), intersection=new THREE.Vector3();
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  let width=1,height=1,frame=0,disposed=false,failed=false,hidden=document.hidden;
  let time=0,previous=0,assemblyAge=0,flightAge=0,lastStage=read().stage,lastReset=read().resetView;
  let yaw=0,pitch=0,targetYaw=0,targetPitch=0,zoom=1,targetZoom=1,velocityX=0,velocityY=0;
  let pointerId:number|null=null,lastX=0,lastY=0;
  const reset=()=> { targetYaw=targetPitch=velocityX=velocityY=0; targetZoom=1; assemblyAge=0; wake(); };
  function draw(now:number) {
    frame=0; if(disposed||failed||hidden)return;
    const state=read(), dt=Math.min(previous?(now-previous)/1000:.016,.05); previous=now;
    if(state.motion) {time+=dt;assemblyAge+=dt;if(state.launching)flightAge+=dt;else flightAge=0;}
    const ease=state.motion?1-Math.exp(-dt*7):1;
    if(pointerId===null&&state.motion) { targetYaw=THREE.MathUtils.clamp(targetYaw+velocityX,-1.35,1.35); targetPitch=THREE.MathUtils.clamp(targetPitch+velocityY,-.65,.65); velocityX*=Math.pow(.04,dt);velocityY*=Math.pow(.04,dt); }
    yaw+=(targetYaw-yaw)*ease; pitch+=(targetPitch-pitch)*ease; zoom+=(targetZoom-zoom)*ease;
    const assembling=state.motion?THREE.MathUtils.smoothstep(assemblyAge,0,2.4):1;
    uniforms.assembly.value=assembling;
    uniforms.charge.value=state.motion?state.charge:0;
    uniforms.time.value=time; uniforms.opacity.value=state.stage==='rewards'?.28:1;
    const scale=artworkScale(width,height,18,state.stage);
    galaxy.scale.setScalar(scale);
    const worldHeight=2*18*Math.tan(Math.PI*42/360);
    galaxy.position.x=width>760&&state.stage!=='rewards'?worldHeight*camera.aspect*(state.stage==='sky'?.14:.16):0;
    galaxy.position.y=state.stage==='sky'?-worldHeight*(width>760?.015:.055):width<=760?-worldHeight*.015:worldHeight*.03;
    galaxy.rotation.set(pitch,yaw,0);
    const rotation=Math.hypot(yaw,pitch);
    artworkMaterial.uniforms.opacity.value=.45*assembling*assembling*Math.max(0,1-rotation*1.8)*(1-state.charge);
    coreMaterial.opacity=assembling*(.62+state.charge*.35);
    core.scale.setScalar((1.4+state.charge*2.7)*(1+Math.sin(time*1.8)*.025));
    galaxy.updateMatrixWorld();core.getWorldPosition(coreWorld);
    const flight=state.motion?THREE.MathUtils.smoothstep(flightAge,0,1.15):0;
    camera.position.set(coreWorld.x*flight,coreWorld.y*flight,18*zoom*(1-flight*.88));
    focus.copy(coreWorld).multiplyScalar(flight);camera.lookAt(focus);camera.updateMatrixWorld();
    dust.rotation.y=time*.006+yaw*.09;dust.rotation.x=pitch*.06;
    dustMaterial.opacity=state.stage==='rewards'?.12:.65+state.charge*.25;
    const label=getCore();
    if(label) { projected.copy(coreWorld).project(camera);label.style.left=`${(projected.x*.5+.5)*width}px`;label.style.top=`${(-projected.y*.5+.5)*height}px`;label.style.opacity=String(1-flight); }
    renderer.render(scene,camera);
    if(state.motion) frame=requestAnimationFrame(draw);
  }
  function wake(){if(!frame&&!disposed&&!failed&&!hidden)frame=requestAnimationFrame(draw);}
  function resize(){width=Math.max(host.clientWidth,1);height=Math.max(host.clientHeight,1);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();wake();}
  function update(){const state=read();if(state.stage!==lastStage||state.resetView!==lastReset){lastStage=state.stage;lastReset=state.resetView;flightAge=0;reset();}wake();}
  function down(e:PointerEvent){if(read().launching||pointerId!==null||e.button!==0)return;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;velocityX=velocityY=0;el.setPointerCapture(e.pointerId);host.dataset.dragging='true';}
  function move(e:PointerEvent){
    if(read().launching)return;
    if(pointerId===e.pointerId){
      const dx=(e.clientX-lastX)*.006,dy=(e.clientY-lastY)*.005;
      targetYaw=THREE.MathUtils.clamp(targetYaw+dx,-1.35,1.35);targetPitch=THREE.MathUtils.clamp(targetPitch+dy,-.65,.65);
      velocityX=dx*.11;velocityY=dy*.11;lastX=e.clientX;lastY=e.clientY;
    }
    const bounds=host.getBoundingClientRect();pointer.set((e.clientX-bounds.left)/width*2-1,-(e.clientY-bounds.top)/height*2+1);
    raycaster.setFromCamera(pointer,camera);
    if(raycaster.ray.intersectPlane(plane,intersection)){galaxy.worldToLocal(intersection);uniforms.pointer.value.set(intersection.x,intersection.y);}
    wake();
  }
  function up(e:PointerEvent){if(pointerId!==e.pointerId)return;pointerId=null;host.dataset.dragging='false';if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);wake();}
  function cancel(){pointerId=null;host.dataset.dragging='false';}
  function leave(){uniforms.pointer.value.set(100,100);wake();}
  function wheel(e:WheelEvent){if(e.ctrlKey||width<760||read().launching)return;e.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom+e.deltaY*.0006,.7,1.3);wake();}
  function key(e:KeyboardEvent){
    if(read().launching)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','r','R'].includes(e.key))return;
    e.preventDefault();velocityX=velocityY=0;
    if(e.key==='ArrowLeft')targetYaw-=.16;if(e.key==='ArrowRight')targetYaw+=.16;
    if(e.key==='ArrowUp')targetPitch-=.13;if(e.key==='ArrowDown')targetPitch+=.13;
    if(e.key==='+'||e.key==='=')targetZoom-=.1;if(e.key==='-')targetZoom+=.1;
    targetYaw=THREE.MathUtils.clamp(targetYaw,-1.35,1.35);targetPitch=THREE.MathUtils.clamp(targetPitch,-.65,.65);targetZoom=THREE.MathUtils.clamp(targetZoom,.7,1.3);
    if(e.key.toLowerCase()==='r')reset();wake();
  }
  function visibility(){hidden=document.hidden;previous=0;if(hidden){cancelAnimationFrame(frame);frame=0;cancel();}else wake();}
  function contextLost(e:Event){e.preventDefault();failed=true;cancelAnimationFrame(frame);frame=0;el.tabIndex=-1;el.setAttribute('aria-hidden','true');onFailure();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);el.addEventListener('pointerleave',leave);
  el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('keydown',key);el.addEventListener('webglcontextlost',contextLost);document.addEventListener('visibilitychange',visibility);
  resize();update();
  return {update,dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);
    el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);el.removeEventListener('pointerleave',leave);el.removeEventListener('wheel',wheel);el.removeEventListener('keydown',key);el.removeEventListener('webglcontextlost',contextLost);
    geometry.dispose();material.dispose();artworkTexture.dispose();artworkGeometry.dispose();artworkMaterial.dispose();glow.dispose();coreMaterial.dispose();dustGeometry.dispose();dustMaterial.dispose();renderer.dispose();el.remove();
  }};
}
