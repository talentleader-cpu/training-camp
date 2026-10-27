// Training Camp · estadio 3D de la portada ("La salida al campo")
import * as THREE from '/js/vendor/three.module.min.js';

const AZUL = 0x0653A1, NOCHE = 0x00182a;
const D_JERSEY = 'M96 18 C112 32 188 32 204 18 L262 42 L296 116 L248 136 L236 104 L236 318 Q150 330 64 318 L64 104 L52 136 L4 116 L38 42 Z';
const D_MANGAS = 'M38 42 L4 116 L52 136 L64 104 Z M262 42 L296 116 L248 136 L236 104 Z';

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function texturaRadial(c1 = 'rgba(255,240,200,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c1); g.addColorStop(.25, 'rgba(255,220,150,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function soporta3D() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

export function crearEstadio(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const esMovil = () => innerWidth < 900;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, esMovil() ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NOCHE);
  scene.fog = new THREE.Fog(NOCHE, 70, 220);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
  const PR = renderer.getPixelRatio();

  /* ---------------- luces ---------------- */
  const hemi = new THREE.HemisphereLight(0x96d4e7, 0x001020, 0); scene.add(hemi);
  const llave = new THREE.DirectionalLight(0xfff1d8, 0); llave.position.set(30, 45, 40); scene.add(llave);
  const contra = new THREE.DirectionalLight(0xF7A700, 0); contra.position.set(-35, 25, -45); scene.add(contra);
  const relleno = new THREE.PointLight(0x96d4e7, 0, 40); relleno.position.set(-8, 6, 10); scene.add(relleno);

  /* ---------------- cancha ---------------- */
  const cc = document.createElement('canvas'); cc.width = 1024; cc.height = 1536;
  const cx = cc.getContext('2d');
  function pintaCancha(logo) {
    for (let i = 0; i < 12; i++) { cx.fillStyle = i % 2 ? '#0a3f6c' : '#0c4778'; cx.fillRect(0, i * 128, 1024, 128); }
    cx.strokeStyle = 'rgba(150,212,231,.9)'; cx.lineWidth = 6; const m = 40;
    cx.strokeRect(m, m, 1024 - 2 * m, 1536 - 2 * m);
    cx.beginPath(); cx.moveTo(m, 768); cx.lineTo(1024 - m, 768); cx.stroke();
    cx.beginPath(); cx.arc(512, 768, 130, 0, Math.PI * 2); cx.stroke();
    cx.strokeRect(212, m, 600, 230); cx.strokeRect(212, 1536 - m - 230, 600, 230);
    cx.strokeRect(382, m, 260, 90); cx.strokeRect(382, 1536 - m - 90, 260, 90);
    if (logo) { const w = 190, h = w * logo.height / logo.width; cx.globalAlpha = .55; cx.drawImage(logo, 512 - w / 2, 768 - h / 2, w, h); cx.globalAlpha = 1; }
  }
  pintaCancha();
  const texCancha = new THREE.CanvasTexture(cc); texCancha.colorSpace = THREE.SRGBColorSpace; texCancha.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const img = new Image(); img.onload = () => { pintaCancha(img); texCancha.needsUpdate = true; }; img.src = '/assets/wexpand-logo-blanco.png';
  const cancha = new THREE.Mesh(new THREE.PlaneGeometry(70, 105), new THREE.MeshStandardMaterial({ map: texCancha, roughness: .85 }));
  cancha.rotation.x = -Math.PI / 2; scene.add(cancha);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x021a2c, roughness: 1 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -.02; scene.add(suelo);

  /* ---------------- gradas (elipse) ---------------- */
  const ESCZ = 1.45, HUECO = .13;
  const perfil = [[40, 0], [40, 1.6], [58, 14.5], [58, 16.5], [64, 25], [67, 25.5]].map(p => new THREE.Vector2(p[0], p[1]));
  const gradasGeo = new THREE.LatheGeometry(perfil, 120, HUECO, Math.PI * 2 - HUECO * 2);
  const gradas = new THREE.Mesh(gradasGeo, new THREE.MeshStandardMaterial({ color: 0x03253f, roughness: 1, side: THREE.DoubleSide }));
  gradas.scale.z = ESCZ; scene.add(gradas);

  // público: miles de puntos con flashes de cámara
  const nPub = esMovil() ? 5200 : 9500, pos = [], sem = [], col = [];
  const paleta = [[.06, .33, .63], [.94, .49, .18], [.59, .83, .91], [.97, .65, 0], [.85, .9, .95], [.0, .63, .76]];
  let filas = 24, porFila = nPub / filas;
  for (let f = 0; f < filas; f++) {
    const s = (f + .5) / filas, r = 40.6 + 17.2 * s, y = 1.9 + 12.6 * s + .55;
    const n = Math.round(porFila * (r / 50));
    for (let i = 0; i < n; i++) {
      const phi = HUECO + .02 + (Math.PI * 2 - HUECO * 2 - .04) * (i + Math.random() * .6) / n;
      pos.push(r * Math.sin(phi), y + Math.random() * .3, r * Math.cos(phi) * ESCZ);
      sem.push(Math.random());
      const p = paleta[(Math.random() * paleta.length) | 0], k = .35 + Math.random() * .5;
      col.push(p[0] * k, p[1] * k, p[2] * k);
    }
  }
  const pubGeo = new THREE.BufferGeometry();
  pubGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pubGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sem, 1));
  pubGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  const pubMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uOn: { value: 0 }, uSize: { value: .95 * PR } },
    vertexShader: `attribute float aSeed; attribute vec3 aCol; uniform float uTime,uFlash,uOn,uSize; varying vec3 vCol; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        float h=fract(sin(aSeed*91.7+floor(uTime*7.+aSeed*23.)*13.17)*43758.5453);
        float f=step(1.-(.0035+uFlash*.06)*uOn,h);
        float ola=.55+.45*sin(uTime*1.3+position.x*.08+position.z*.05);
        vCol=mix(aCol*(.25+.75*uOn)*(.8+.4*ola), vec3(1.), f); vA=.85;
        gl_PointSize=uSize*(1.+f*2.2)*(300./-mv.z); }`,
    fragmentShader: `varying vec3 vCol; varying float vA; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); if(d>.5) discard; gl_FragColor=vec4(vCol,vA*smoothstep(.5,.15,d)); }`
  });
  scene.add(new THREE.Points(pubGeo, pubMat));

  /* ---------------- túnel de salida ---------------- */
  const tunel = new THREE.Group(); scene.add(tunel);
  const tunelMat = new THREE.MeshStandardMaterial({ color: 0x0a2236, roughness: .9, side: THREE.BackSide });
  const caja = new THREE.Mesh(new THREE.BoxGeometry(7, 4.4, 30), tunelMat); caja.position.set(0, 2.2, 73); tunel.add(caja);
  const tiraTecho = new THREE.MeshBasicMaterial({ color: 0xcfefff }), tiraPared = new THREE.MeshBasicMaterial({ color: 0xF07E2E });
  for (let z = 60; z < 88; z += 2.6) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.6, .06, .5), tiraTecho); t.position.set(0, 4.36, z); tunel.add(t);
    [-3.46, 3.46].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .12, 1.4), tiraPared); p.position.set(x, 1.2, z); tunel.add(p); });
  }
  const tunelLuz = new THREE.PointLight(0xcfefff, 3, 16, 1.4); tunelLuz.position.set(0, 3.5, 70); scene.add(tunelLuz);

  /* ---------------- torres de luz ---------------- */
  const glowTex = texturaRadial();
  const torres = [];
  [[-47, -84], [47, -84], [-47, 84], [47, 84]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(.5, .9, 44, 10), new THREE.MeshStandardMaterial({ color: 0x0b2033, roughness: .8 }));
    poste.position.y = 22; g.add(poste);
    const cabeza = new THREE.Group(); cabeza.position.y = 45; g.add(cabeza);
    cabeza.lookAt(new THREE.Vector3(-x, 0, -z * .6).sub(g.position).add(new THREE.Vector3(0, 45, 0)).add(g.position));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, .6), new THREE.MeshStandardMaterial({ color: 0x0b2033 }));
    cabeza.add(panel);
    const focoMat = new THREE.MeshBasicMaterial({ color: 0x1b3346 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const f = new THREE.Mesh(new THREE.CircleGeometry(.75, 16), focoMat); f.position.set(-3.9 + i * 2.6, -1.7 + j * 1.7, .32); cabeza.add(f);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
    glow.scale.set(34, 34, 1); glow.position.set(x, 45, z); scene.add(glow);
    // cono de luz volumétrico
    const lamp = new THREE.Vector3(x, 45, z), dest = new THREE.Vector3(x * .15, 0, z * .2), dir = dest.clone().sub(lamp), h = dir.length();
    const conoGeo = new THREE.ConeGeometry(17, h, 40, 1, true); conoGeo.translate(0, -h / 2, 0);
    const conoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOn: { value: 0 }, uH: { value: h } },
      vertexShader: 'uniform float uH; varying float vT; void main(){ vT=clamp(-position.y/uH,0.,1.); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float uOn; varying float vT; void main(){ float a=uOn*.11*pow(1.-vT,1.6); gl_FragColor=vec4(vec3(1.,.93,.78)*a,a); }'
    });
    const cono = new THREE.Mesh(conoGeo, conoMat); cono.position.copy(lamp);
    cono.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()); scene.add(cono);
    torres.push({ focoMat, glow, conoMat, on: 0, objetivo: 0 });
  });

  /* ---------------- polvo en las luces ---------------- */
  const nPolvo = esMovil() ? 300 : 650, polvo = new Float32Array(nPolvo * 3);
  for (let i = 0; i < nPolvo; i++) { polvo[i * 3] = (Math.random() - .5) * 70; polvo[i * 3 + 1] = Math.random() * 30; polvo[i * 3 + 2] = (Math.random() - .5) * 110; }
  const polvoGeo = new THREE.BufferGeometry(); polvoGeo.setAttribute('position', new THREE.BufferAttribute(polvo, 3));
  const polvoMat = new THREE.PointsMaterial({ size: .22, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b0 });
  scene.add(new THREE.Points(polvoGeo, polvoMat));

  /* ---------------- jersey 3D de tela ---------------- */
  const TW = 1024, TH = Math.round(1024 * 330 / 300), K = TW / 300;
  const datos = { nombre: '', carrera: '', numero: '00' };
  function lado(frente) {
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return { c, tex, frente };
  }
  const L = { frente: lado(true), espalda: lado(false) };
  function ajusta(x, txt, max, px, fam, peso) { const f = q => (peso ? peso + ' ' : '') + q + 'px ' + fam; x.font = f(px); const w = x.measureText(txt).width; if (w > max) { px = Math.floor(px * max / w); x.font = f(px); } return px; }
  function texto(x, txt, y, px, fam, max, borde, peso) {
    ajusta(x, txt, max, px, fam, peso); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    if (borde) { x.lineJoin = 'round'; x.lineWidth = borde; x.strokeStyle = '#00273F'; x.strokeText(txt, 150, y); }
    x.fillText(txt, 150, y);
  }
  function pinta(l) {
    const x = l.c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, TW, TH); x.scale(K, K);
    const p = new Path2D(D_JERSEY);
    const g = x.createLinearGradient(0, 0, 300, 330); g.addColorStop(0, '#1E74C9'); g.addColorStop(.55, '#0653A1'); g.addColorStop(1, '#03417F');
    x.fillStyle = g; x.fill(p);
    x.save(); x.clip(p);
    x.fillStyle = '#F4FAFD'; x.fill(new Path2D(D_MANGAS));
    x.strokeStyle = '#0653A1'; x.lineWidth = 5; x.beginPath(); x.moveTo(8, 108); x.lineTo(54, 128); x.moveTo(292, 108); x.lineTo(246, 128); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(64, 104, 9, 214); x.fillRect(227, 104, 9, 214);
    x.fillStyle = 'rgba(0,0,0,.055)';
    for (let yy = 0; yy < 330; yy += 4.5) for (let xx = (Math.round(yy / 4.5) % 2) * 2.25; xx < 300; xx += 4.5) x.fillRect(xx, yy, 1.3, 1.3);
    const s = x.createLinearGradient(0, 0, 0, 330); s.addColorStop(0, 'rgba(255,255,255,.10)'); s.addColorStop(1, 'rgba(0,0,0,.14)'); x.fillStyle = s; x.fillRect(0, 0, 300, 330);
    x.strokeStyle = '#FFFFFF'; x.lineCap = 'round';
    if (l.frente) { x.lineWidth = 9; x.beginPath(); x.moveTo(104, 20); x.lineTo(150, 58); x.lineTo(196, 20); x.stroke(); }
    else { x.lineWidth = 8; x.beginPath(); x.moveTo(96, 18); x.bezierCurveTo(112, 32, 188, 32, 204, 18); x.stroke(); }
    x.restore();
    x.fillStyle = '#fff';
    const BEBAS = '"Bebas Neue", Oswald, "Arial Narrow", sans-serif', MONT = '800 ', MONTF = 'Montserrat, Arial, sans-serif';
    if (l.frente) {
      x.save(); x.font = '800 15px ' + MONTF; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('WEXPAND', 150, 92); x.restore();
      x.fillStyle = '#fff'; texto(x, datos.numero, 228, 118, BEBAS, 150, 7);
      x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '700 9px ' + MONTF; x.textAlign = 'center'; x.fillText('TRAINING CAMP', 150, 300);
    } else {
      const ap = datos.nombre ? apellido(datos.nombre).toUpperCase().slice(0, 24) : 'TU NOMBRE';
      x.fillStyle = '#fff'; texto(x, ap, 92, 40, BEBAS, 160, 5);
      texto(x, datos.numero, 238, 142, BEBAS, 160, 8);
      x.fillStyle = '#FFFFFF'; texto(x, (datos.carrera || 'Tu carrera').toUpperCase(), 284, 13, MONTF, 168, 0, '800');
    }
    l.tex.needsUpdate = true;
  }
  function apellido(n) { const p = String(n).trim().split(/\s+/).filter(Boolean); return p.length > 1 ? p.slice(1).join(' ') : (p[0] || ''); }
  function numero(s) { s = String(s || '').trim().toLowerCase(); if (!s) return '00'; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return String(h % 98 + 1); }
  function repinta() { pinta(L.frente); pinta(L.espalda); }
  repinta();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('40px "Bebas Neue"'), document.fonts.load('800 15px Montserrat')]).then(repinta, () => {});

  // volumen: máscara difuminada del contorno, para que el frente y la espalda se junten en las orillas
  const MW = 150, MH = 165, mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
  const mx = mc.getContext('2d'); mx.scale(MW / 300, MH / 330); mx.fillStyle = '#fff'; mx.fill(new Path2D(D_JERSEY));
  let a = Float32Array.from(mx.getImageData(0, 0, MW, MH).data.filter((_, i) => i % 4 === 3), v => v / 255);
  for (let pase = 0; pase < 3; pase++) {
    const b = new Float32Array(a.length), R = 5;
    for (let y = 0; y < MH; y++) for (let xx = 0; xx < MW; xx++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = xx + k; if (q >= 0 && q < MW) { s += a[y * MW + q]; n++; } } b[y * MW + xx] = s / n; }
    for (let y = 0; y < MH; y++) for (let xx = 0; xx < MW; xx++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = y + k; if (q >= 0 && q < MH) { s += b[q * MW + xx]; n++; } } a[y * MW + xx] = s / n; }
  }
  const muestra = (u, v) => a[clamp(Math.round((1 - v) * (MH - 1)), 0, MH - 1) * MW + clamp(Math.round(u * (MW - 1)), 0, MW - 1)];

  function tela(l) {
    const geo = new THREE.PlaneGeometry(6, 6.6, 54, 60), P = geo.attributes.position, U = geo.attributes.uv;
    const base = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const v = muestra(U.getX(i), U.getY(i)), bulto = .62 * Math.sqrt(clamp((v - .5) * 2, 0, 1));
      base[i * 3] = P.getX(i); base[i * 3 + 1] = P.getY(i); base[i * 3 + 2] = bulto + .006;
    }
    const mat = new THREE.MeshStandardMaterial({ map: l.tex, alphaTest: .5, roughness: .66, metalness: 0, emissive: 0xffffff, emissiveMap: l.tex, emissiveIntensity: .07 });
    const m = new THREE.Mesh(geo, mat); m.userData.base = base; m.userData.espalda = !l.frente;
    if (!l.frente) m.rotation.y = Math.PI;
    return m;
  }
  const jersey = new THREE.Group(), mFrente = tela(L.frente), mEspalda = tela(L.espalda);
  const cuerpo = new THREE.Group(); cuerpo.add(mFrente, mEspalda); jersey.add(cuerpo);
  jersey.position.set(0, 5.2, 0); jersey.visible = false; scene.add(jersey);
  // sombra suave bajo el jersey
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshBasicMaterial({ map: texturaRadial('rgba(0,0,0,.9)'), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.set(0, .03, 0); scene.add(sombra);

  function ondea(m, t, fuerza) {
    const P = m.geometry.attributes.position, B = m.userData.base, esp = m.userData.espalda;
    for (let i = 0; i < P.count; i++) {
      const lx = B[i * 3], y = B[i * 3 + 1], wx = esp ? -lx : lx;
      const amp = (.55 + .45 * (1 - (y + 3.3) / 6.6)) * fuerza;
      const w = (.11 * Math.sin(wx * 1.1 + t * 1.7) + .07 * Math.sin(y * 1.4 - t * 1.2) + .045 * Math.sin((wx + y) * 2.2 + t * 2.4)) * amp;
      const dx = .05 * Math.sin(y * 1.7 + t * 1.3) * amp;
      P.setXYZ(i, esp ? lx - dx : lx + dx, y, esp ? B[i * 3 + 2] - w : B[i * 3 + 2] + w);
    }
    P.needsUpdate = true; m.geometry.computeVertexNormals();
  }

  /* ---------------- fuegos artificiales ---------------- */
  const NF = 1800, fPos = new Float32Array(NF * 3), fCol = new Float32Array(NF * 3), fVel = new Float32Array(NF * 3), fVida = new Float32Array(NF), fBase = new Float32Array(NF * 3);
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const fuegos = new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 1.1, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(fuegos); let fNext = 0;
  const fColores = [[1, .66, .1], [.94, .49, .18], [.59, .83, .91], [1, 1, 1], [.2, .55, 1]];
  function estalla(cx, cy, cz) {
    const c = fColores[(Math.random() * fColores.length) | 0];
    for (let k = 0; k < 140; k++) {
      const i = fNext; fNext = (fNext + 1) % NF;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 9 + Math.random() * 6;
      fPos[i * 3] = cx; fPos[i * 3 + 1] = cy; fPos[i * 3 + 2] = cz;
      fVel[i * 3] = r * Math.cos(th) * sp; fVel[i * 3 + 1] = u * sp; fVel[i * 3 + 2] = r * Math.sin(th) * sp;
      fVida[i] = 1.4 + Math.random() * .6; fBase[i * 3] = c[0]; fBase[i * 3 + 1] = c[1]; fBase[i * 3 + 2] = c[2];
    }
  }

  /* ---------------- cámara: intro, pasos y parallax ---------------- */
  const ruta = new THREE.CatmullRomCurve3([[0, 1.8, 84], [0, 1.8, 66], [0, 2.6, 52], [7, 8, 32], [0, 6.6, 17.5]].map(p => new THREE.Vector3(...p)));
  const miradas = [[0, 1.8, 0], [0, 2.2, 0], [0, 4, 0], [0, 5, 0], [0, 5, 0]].map(p => new THREE.Vector3(...p));
  const DUR = 5.4, ENC = [1.7, 2.15, 2.6, 3.05], CAE = 3.6, LISTO = 4.6;
  let t0 = performance.now(), tIntro = reduce || opts.saltar ? DUR : 0, avisado = false;
  const est = { anguloObj: 0, angulo: 0, radioObj: 17.5, radio: 17.5, cy: .56, cyObj: .56, cx: .3, cxObj: .3, rot: 0, rotObj: 0, flash: 0, celebra: -1, mouse: [0, 0], caida: 0 };
  let celebraT = -1, ultimoFuego = 0;

  function vistaHero(t) {
    const a = est.angulo, r = est.radio, m = reduce ? [0, 0] : est.mouse;
    camera.position.set(Math.sin(a) * r + m[0] * 1.4, 6.6 + m[1] * .7 + (celebraT >= 0 ? 1.2 : 0), Math.cos(a) * r);
    camera.lookAt(0, 5 + (celebraT >= 0 ? 1.2 : 0), 0);
  }

  function layout() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    est.esMovil = esMovil();
  }
  function aplicaVista() {
    const w = innerWidth, h = innerHeight, cxp = est.cx, cyp = est.cy;
    const fw = cxp < .5 ? 2 * w * (1 - cxp) : 2 * w * cxp, ox = cxp < .5 ? w * (1 - 2 * cxp) : 0;
    const fh = cyp < .5 ? 2 * h * (1 - cyp) : 2 * h * cyp, oy = cyp < .5 ? h * (1 - 2 * cyp) : 0;
    camera.aspect = fw / fh;
    camera.fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) * fh / h) * 180 / Math.PI;
    camera.setViewOffset(fw, fh, ox, oy, w, h);
  }
  layout(); addEventListener('resize', layout);

  /* ---------------- arrastrar el jersey ---------------- */
  let arrastre = null;
  canvas.addEventListener('pointerdown', e => { arrastre = { x: e.clientX, r: est.rotObj }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (arrastre) est.rotObj = arrastre.r + (e.clientX - arrastre.x) * .012; });
  const suelta = () => { arrastre = null; }; canvas.addEventListener('pointerup', suelta); canvas.addEventListener('pointercancel', suelta);
  addEventListener('pointermove', e => { est.mouse = [(e.clientX / innerWidth - .5) * 2, -(e.clientY / innerHeight - .5) * 2]; });

  const masCercano = (actual, destino) => destino + Math.round((actual - destino) / (Math.PI * 2)) * Math.PI * 2;

  /* ---------------- bucle ---------------- */
  let ant = performance.now(), vivo = true;
  function cuadro(now) {
    if (!vivo) return;
    requestAnimationFrame(cuadro);
    if (document.hidden) return;
    const dt = Math.min(.05, (now - ant) / 1000); ant = now; const t = now / 1000;
    if (tIntro < DUR) tIntro += dt;
    const ti = tIntro;

    // luces
    torres.forEach((to, i) => {
      const enc = ti >= ENC[i];
      const destino = enc ? (ti - ENC[i] < .35 ? (Math.sin((ti - ENC[i]) * 60) > 0 ? 1 : .2) : 1) : 0;
      to.on = reduce || opts.saltar ? 1 : lerp(to.on, destino, enc && ti - ENC[i] < .35 ? 1 : .2);
      to.focoMat.color.setRGB(lerp(.1, 1.6, to.on), lerp(.2, 1.5, to.on), lerp(.27, 1.3, to.on));
      to.glow.material.opacity = .95 * to.on; to.conoMat.uniforms.uOn.value = to.on;
    });
    const on = torres.reduce((s, x) => s + x.on, 0) / 4;
    hemi.intensity = .75 * on; llave.intensity = 2.3 * on; contra.intensity = 1.6 * on; relleno.intensity = 30 * on;
    tunelLuz.intensity = 3 * (1 - on * .7);
    pubMat.uniforms.uOn.value = on; pubMat.uniforms.uTime.value = t; polvoMat.opacity = .55 * on;
    scene.background.setRGB(lerp(0, .002, on), lerp(.012, .03, on), lerp(.03, .07, on));
    scene.fog.color.copy(scene.background);

    // polvo flotando
    const PP = polvoGeo.attributes.position;
    for (let i = 0; i < nPolvo; i++) { let y = PP.getY(i) + dt * .4; if (y > 30) y = 0; PP.setY(i, y); PP.setX(i, PP.getX(i) + Math.sin(t * .3 + i) * dt * .2); }
    PP.needsUpdate = true;

    // jersey: cae del cielo y luego flota
    if (ti >= CAE || reduce || opts.saltar) {
      jersey.visible = true;
      est.caida = Math.min(1, est.caida + dt / 1.1);
      const c = reduce || opts.saltar ? 1 : est.caida, rebote = 1 + 2.70158 * Math.pow(c - 1, 3) + 1.70158 * Math.pow(c - 1, 2);
      const yb = 5.2 + Math.sin(t * 1.1) * .18 + (celebraT >= 0 ? Math.min(1.4, (t - celebraT) * 2) : 0);
      jersey.position.y = lerp(26, yb, rebote);
      const giroCaida = (1 - c) * Math.PI * 3;
      est.rot = lerp(est.rot, est.rotObj, .08);
      jersey.rotation.y = est.rot + giroCaida + (arrastre ? 0 : Math.sin(t * .55) * .22);
      jersey.rotation.z = Math.sin(t * .8) * .04;
      const esc = celebraT >= 0 ? 1 + Math.max(0, .12 * Math.sin(Math.min(Math.PI, (t - celebraT) * 3))) : 1;
      jersey.scale.setScalar(esc);
      sombra.material.opacity = .55 * c * on;
      sombra.scale.setScalar(1.1 - (jersey.position.y - 5.2) * .05);
      ondea(mFrente, t, 1); ondea(mEspalda, t, 1);
    }

    // celebración
    if (celebraT >= 0) {
      const tc = t - celebraT; est.flash = tc < 4.5 ? 1 : Math.max(0, est.flash - dt * .4);
      if (tc < 3.6 && t - ultimoFuego > .28) { ultimoFuego = t; estalla((Math.random() - .5) * 60, 22 + Math.random() * 14, -30 - Math.random() * 30); }
    }
    pubMat.uniforms.uFlash.value = est.flash;
    for (let i = 0; i < NF; i++) {
      if (fVida[i] <= 0) { fCol[i * 3] = fCol[i * 3 + 1] = fCol[i * 3 + 2] = 0; continue; }
      fVida[i] -= dt; fVel[i * 3 + 1] -= 7 * dt; fVel[i * 3] *= .985; fVel[i * 3 + 2] *= .985;
      fPos[i * 3] += fVel[i * 3] * dt; fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt; fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt;
      const k = clamp(fVida[i], 0, 1); fCol[i * 3] = fBase[i * 3] * k; fCol[i * 3 + 1] = fBase[i * 3 + 1] * k; fCol[i * 3 + 2] = fBase[i * 3 + 2] * k;
    }
    fGeo.attributes.position.needsUpdate = true; fGeo.attributes.color.needsUpdate = true;

    // cámara
    est.cx = lerp(est.cx, est.cxObj, .06); est.cy = lerp(est.cy, est.cyObj, .06);
    est.angulo = lerp(est.angulo, est.anguloObj, .035); est.radio = lerp(est.radio, est.radioObj, .04);
    if (ti < DUR) {
      const p = ease(clamp(ti / DUR, 0, 1)); camera.position.copy(ruta.getPointAt(p));
      const seg = p * (miradas.length - 1), i0 = Math.floor(seg), i1 = Math.min(miradas.length - 1, i0 + 1);
      const mira = miradas[i0].clone().lerp(miradas[i1], seg - i0);
      const fin = clamp((ti - (DUR - 1.2)) / 1.2, 0, 1);
      if (fin > 0) { const hp = camera.position.clone(); vistaHero(t); camera.position.lerp(hp, 1 - ease(fin)); mira.lerp(new THREE.Vector3(0, 5, 0), ease(fin)); }
      camera.lookAt(mira);
      const dentro = clamp((ti - 3.0) / 2, 0, 1); est.cxV = lerp(.5, est.cx, dentro); est.cyV = lerp(.5, est.cy, dentro);
    } else { vistaHero(t); est.cxV = est.cx; est.cyV = est.cy; }
    const gx = est.cx, gy = est.cy; est.cx = est.cxV; est.cy = est.cyV; aplicaVista(); est.cx = gx; est.cy = gy;

    if (!avisado && ti >= LISTO) { avisado = true; opts.alListo && opts.alListo(); }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(cuadro);

  return {
    saltar() { if (tIntro < DUR) { tIntro = DUR; torres.forEach(x => x.on = 1); est.caida = Math.max(est.caida, .6); } },
    enIntro() { return tIntro < LISTO; },
    datos(nombre, carrera) {
      const n = nombre != null ? nombre : datos.nombre, c = carrera != null ? carrera : datos.carrera;
      datos.nombre = n; datos.carrera = c; datos.numero = numero(n); repinta();
    },
    mostrar(ladoJ) { est.rotObj = masCercano(est.rot, ladoJ === 'espalda' ? Math.PI : 0); },
    paso(n) { const ang = [0, -.42, .36, -.3, .3, -.12, 0]; est.anguloObj = ang[n] || 0; },
    encuadre(cx, cy, radio) { est.cxObj = cx; est.cyObj = cy; if (radio) est.radioObj = radio; },
    celebrar() { celebraT = performance.now() / 1000; est.rotObj = masCercano(est.rot, Math.PI) + Math.PI * 2; est.radioObj += 2.5; },
    destruir() { vivo = false; renderer.dispose(); }
  };
}
