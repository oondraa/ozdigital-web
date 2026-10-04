// OZDIGITAL mascot "Oz", rendered live with three.js.
// Model ported from the Claude Design "Cube Mascot v2" file; the viewer UI, orbit controls and exporters are dropped.
// One shared WebGL renderer draws every [data-mascot] slot into that slot's own 2D canvas,
// so the page holds a single GL context no matter how many mascots it shows.
import * as THREE from "three";

const BLUE = "#2E96FF";
const TONES = {
  white:    { body: "#F2F2F4", rough: 0.28, badge: "#0d0d0f" },
  graphite: { body: "#1A1B1E", rough: 0.34, badge: "#F2F2F4" },
  blue:     { body: BLUE,      rough: 0.3,  badge: "#F2F2F4" },
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Geometry helpers (from the design file) ----------
function weldNormals(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map();
  const k = (i) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
  for (let i = 0; i < p.count; i++) {
    const key = k(i), a = map.get(key) || [0, 0, 0];
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); map.set(key, a);
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(...map.get(k(i))).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return geo;
}
function pillowBox(w, h, d, r, bulge = [0, 0, 0], seg = 48) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const inner = half.clone().subScalar(r), v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.copy(v).clamp(inner.clone().negate(), inner);
    v.sub(c).normalize().multiplyScalar(r).add(c);
    const nx = v.x / half.x, ny = v.y / half.y, nz = v.z / half.z;
    v.x *= 1 + bulge[0] * (1 - ny * ny) * (1 - nz * nz);
    v.y *= 1 + bulge[1] * (1 - nx * nx) * (1 - nz * nz);
    v.z *= 1 + bulge[2] * (1 - nx * nx) * (1 - ny * ny);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return weldNormals(g);
}
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ---------- Shared geometry ----------
const W = 0.32, H = 0.30, D = 0.29, R = 0.085, LEG = 0.028;
const bodyY = LEG + H / 2;
const SW = 0.19, SH = 0.125, SD = 0.02, BEV = 0.004, SY = bodyY + 0.01;
const screenFront = D / 2 * 1.03 + 0.001;
const T = 0.0062;

const GEO = {
  body: pillowBox(W, H, D, R, [0.05, 0.05, 0.03]),
  screen: (() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(SW - 2 * BEV, SH - 2 * BEV, 0.032),
      { depth: SD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 6, curveSegments: 24 });
    g.translate(0, 0, -SD - BEV);
    return g;
  })(),
  pin: pillowBox(0.028, 0.05, 0.018, 0.008, [0, 0, 0], 12),
  stem: new THREE.CylinderGeometry(0.0035, 0.0045, 0.06, 24),
  ball: new THREE.SphereGeometry(0.019, 48, 32),
};

// Open ring from the OZDIGITAL mark: gap in the upper-right quadrant, dot in the gap.
function logoRing(parent, R, tube, ringMat, dotR, dMat, flat) {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 16, 72, Math.PI * 1.5), ringMat);
  arc.rotation.z = Math.PI / 2; g.add(arc);
  [Math.PI / 2, 0].forEach((a) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(tube, 16, 12), ringMat);
    cap.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.add(cap);
  });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(dotR, 24, 16), dMat);
  dot.position.set(Math.cos(Math.PI / 4) * R, Math.sin(Math.PI / 4) * R, 0); g.add(dot);
  g.scale.z = flat; parent.add(g); return g;
}

// Builds one mascot. Returns the pivot (rotates around the body center) plus parts the idle loop animates.
function buildMascot(face, tone) {
  const t = TONES[tone] || TONES.white;
  const ceramic = new THREE.MeshPhysicalMaterial({ color: t.body, roughness: t.rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#030406", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
  const glow = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 3, toneMapped: false });
  const glowBlue = new THREE.MeshStandardMaterial({ color: BLUE, emissive: BLUE, emissiveIntensity: 1.0, toneMapped: false });
  const silver = new THREE.MeshStandardMaterial({ color: "#dfe3ea", metalness: 1, roughness: 0.22 });
  const badgeMat = new THREE.MeshPhysicalMaterial({ color: t.badge, roughness: 0.2, clearcoat: 1 });
  const dotMat = new THREE.MeshPhysicalMaterial({ color: BLUE, emissive: BLUE, emissiveIntensity: 0.35, roughness: 0.15, clearcoat: 1 });

  const model = new THREE.Group();
  const body = new THREE.Mesh(GEO.body, ceramic); body.position.y = bodyY; model.add(body);
  const screen = new THREE.Mesh(GEO.screen, glass); screen.position.set(0, SY, screenFront); model.add(screen);

  const faces = {};
  const parts = { cursor: null, eyes: [] };
  const makeFace = (key, build) => {
    const g = new THREE.Group();
    g.position.set(0, SY, screenFront + 0.0012); g.visible = false; model.add(g);
    const stroke = (ax, ay, bx, by, mat = glow) => {
      const len = Math.hypot(bx - ax, by - ay);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(T, len, 8, 24), mat);
      m.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      m.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2; m.scale.z = 0.35;
      g.add(m); return m;
    };
    build(g, stroke);
    faces[key] = g;
  };
  makeFace(">_", (g, stroke) => {
    stroke(-0.056, 0.024, -0.024, 0.002);
    stroke(-0.056, -0.020, -0.024, 0.002);
    parts.cursor = stroke(0.002, -0.024, 0.050, -0.024, glowBlue);
  });
  makeFace("^_^", (g, stroke) => {
    stroke(-0.074, 0.002, -0.052, 0.022); stroke(-0.052, 0.022, -0.030, 0.002);
    stroke(0.030, 0.002, 0.052, 0.022); stroke(0.052, 0.022, 0.074, 0.002);
    stroke(-0.014, -0.026, 0.014, -0.026, glowBlue);
  });
  makeFace("o_o", (g, stroke) => {
    const l = logoRing(g, 0.016, T, glow, 0.0058, glowBlue, 0.35); l.position.set(-0.052, 0.008, 0);
    const r = logoRing(g, 0.016, T, glow, 0.0058, glowBlue, 0.35); r.position.set(0.052, 0.008, 0);
    parts.eyes.push(l, r);
    stroke(-0.014, -0.026, 0.014, -0.026, glowBlue);
  });
  const setFace = (f) => { Object.keys(faces).forEach((k) => { faces[k].visible = k === f; }); };
  setFace(faces[face] ? face : ">_");

  // Antenna: the blue dot of the mark, off the top-right like in the logo.
  const antenna = new THREE.Group();
  const stem = new THREE.Mesh(GEO.stem, silver); stem.position.y = 0.03; antenna.add(stem);
  const ball = new THREE.Mesh(GEO.ball, dotMat); ball.position.y = 0.068; antenna.add(ball);
  antenna.position.set(0.06, LEG + H / 2 + H / 2 * 1.05 - 0.012, -0.02); antenna.rotation.z = -0.22;
  model.add(antenna);

  // Side badge: the OZDIGITAL mark on the right flank.
  const badge = logoRing(model, 0.034, 0.0075, badgeMat, 0.0085, dotMat, 0.45);
  badge.rotation.y = Math.PI / 2;
  badge.position.set(W / 2 * 1.05 + 0.0005, bodyY + 0.005, 0);

  [-0.072, 0.072].forEach((x) => {
    const pin = new THREE.Mesh(GEO.pin, silver); pin.position.set(x, 0.025, 0); model.add(pin);
  });

  model.position.y = -bodyY;
  const pivot = new THREE.Group(); pivot.add(model);
  return { pivot, setFace, face: faces[face] ? face : ">_", ...parts };
}

// ---------- Renderer, lights, environment ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
} catch (e) {
  throw new Error("mascot: WebGL unavailable");
}
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.setScissorTest(true);

const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x202228, side: THREE.BackSide })));
const panel = (w, h, rgb, pos) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.material.color.setRGB(...rgb); m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
};
panel(10, 7, [5, 5, 5], [-6, 9, 6]);
panel(2.5, 10, [1.6, 2.8, 5], [9, 1, -6]);
panel(8, 4, [0.6, 0.6, 0.7], [4, 2, 10]);
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(envScene, 0.04).texture;
pmrem.dispose();

function makeScene() {
  const scene = new THREE.Scene();
  scene.environment = envMap;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 6, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 3.6); rim.position.set(4, 1.2, -3.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa6c8, 0.25));
  return scene;
}

// ---------- Slots ----------
const FOV = 26;
const slots = [];
document.querySelectorAll("[data-mascot]").forEach((wrap, i) => {
  const host = wrap.querySelector(".orb");
  if (!host) return;
  const m = buildMascot(wrap.dataset.face || ">_", wrap.dataset.tone || "white");
  const scene = makeScene();
  scene.add(m.pivot);

  // Frame from the bounding sphere so the antenna never clips.
  const sphere = new THREE.Box3().setFromObject(m.pivot).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);
  const dist = sphere.radius / Math.sin((FOV * Math.PI) / 360) * 0.84;
  camera.position.copy(sphere.center).add(new THREE.Vector3(0.16, 0.22, 1).normalize().multiplyScalar(dist));
  camera.lookAt(sphere.center);

  const canvas = document.createElement("canvas");
  canvas.className = "mascot";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  slots.push({
    wrap, host, canvas, ctx: canvas.getContext("2d"), scene, camera, ...m,
    yaw: parseFloat(wrap.dataset.yaw || "0"), phase: i * 1.7,
    rx: 0, ry: 0, w: 0, h: 0, visible: false, shown: false,
  });
});

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
function measure() {
  let maxW = 1, maxH = 1;
  slots.forEach((s) => {
    const zoom = parseFloat(s.wrap.dataset.zoom || "1");
    s.w = Math.round(s.host.clientWidth * dpr() * zoom);
    s.h = Math.round(s.host.clientHeight * dpr() * zoom);
    if (s.canvas.width !== s.w) s.canvas.width = s.w;
    if (s.canvas.height !== s.h) s.canvas.height = s.h;
    s.camera.aspect = s.w / Math.max(s.h, 1);
    s.camera.updateProjectionMatrix();
    maxW = Math.max(maxW, s.w); maxH = Math.max(maxH, s.h);
  });
  const c = renderer.domElement;
  if (c.width < maxW || c.height < maxH) renderer.setSize(Math.max(c.width, maxW), Math.max(c.height, maxH), false);
}

// Pointer: mascots turn their head toward the cursor.
const pointer = { x: 0, y: 0, active: false };
if (!reduceMotion) {
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
}

function pose(s, t) {
  let tx = 0, ty = 0;
  if (pointer.active) {
    const r = s.host.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (pointer.x - (r.left + r.width / 2)) / (window.innerWidth * 0.5)));
    ty = Math.max(-1, Math.min(1, (pointer.y - (r.top + r.height / 2)) / (window.innerHeight * 0.6)));
  }
  const yawT = s.near ? 0 : s.yaw + tx * 0.42;
  const rxT = s.near ? 0.12 : ty * 0.22;
  s.ry += (yawT - s.ry) * 0.045;
  s.rx += (rxT - s.rx) * 0.06;
  s.pivot.rotation.set(s.rx, s.ry + Math.sin(t * 0.6 + s.phase) * 0.06, Math.sin(t * 0.9 + s.phase) * 0.025);
  s.pivot.position.y = Math.sin(t * 1.3 + s.phase) * 0.008;
  if (s.cursor) s.cursor.visible = Math.floor(t / 0.53) % 2 === 0;
  if (s.eyes.length) {
    const blink = (t + s.phase) % 4.4 < 0.12 ? 0.12 : 1;
    s.eyes.forEach((e) => { e.scale.y = blink; });
  }
}

// Hero mascot comes closer once if the visitor stays on the first screen for 6 s:
// it scales up (CSS .is-near), smiles, shows a speech bubble (.is-talking), then goes back.
const GREET_AFTER = 6, NEAR_FOR = 4.2;
const greeter = slots.find((s) => "approach" in s.wrap.dataset);
let idleSince = null, approachAt = null, greeted = false;
function updateGreeter(t) {
  const s = greeter;
  if (!s || !s.shown) return;
  if (!greeted) {
    if (window.scrollY > 80 || document.visibilityState !== "visible") { idleSince = null; return; }
    if (idleSince === null) idleSince = t;
    if (t - idleSince >= GREET_AFTER) { greeted = true; approachAt = t; }
    return;
  }
  if (approachAt === null) return;
  const e = t - approachAt;
  s.near = e < NEAR_FOR;
  s.wrap.classList.toggle("is-near", s.near);
  s.wrap.classList.toggle("is-talking", e > 0.6 && e < NEAR_FOR - 0.3);
  s.setFace(e > 0.25 && e < NEAR_FOR + 0.4 ? "^_^" : s.face);
  if (e >= NEAR_FOR + 0.4) approachAt = null;
}

function draw(s) {
  if (!s.w || !s.h) return;
  const H = renderer.domElement.height;
  renderer.setViewport(0, 0, s.w, s.h);
  renderer.setScissor(0, 0, s.w, s.h);
  renderer.render(s.scene, s.camera);
  s.ctx.clearRect(0, 0, s.w, s.h);
  s.ctx.drawImage(renderer.domElement, 0, H - s.h, s.w, s.h, 0, 0, s.w, s.h);
  if (!s.shown) { s.shown = true; s.host.classList.add("is-3d"); }
}

function drawStatic() {
  measure();
  slots.forEach((s) => { s.ry = s.yaw; s.pivot.rotation.set(0, s.yaw, 0); draw(s); });
}

if (slots.length) {
  const ro = new ResizeObserver(reduceMotion ? drawStatic : measure);
  slots.forEach((s) => ro.observe(s.host));
  measure();

  if (reduceMotion) {
    drawStatic();
  } else {
    // Only animate mascots that are on screen.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const s = slots.find((x) => x.host === en.target);
        if (s) s.visible = en.isIntersecting;
      });
    }, { rootMargin: "100px" });
    // Start turned toward the side it slides in from, then settle to face the viewer.
    slots.forEach((s) => {
      const fromLeft = getComputedStyle(s.host).getPropertyValue("--from").trim().startsWith("-");
      s.ry = s.yaw + (fromLeft ? 1.1 : -1.1);
      io.observe(s.host);
    });
    renderer.setAnimationLoop((ms) => {
      const t = ms / 1000;
      updateGreeter(t);
      slots.forEach((s) => { if (s.visible) { pose(s, t); draw(s); } });
    });
  }
}
