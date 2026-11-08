// OZDIGITAL dot field. Replaces the 3D cube mascot.
// A cloud of dots rises out of the hero's dot grid and morphs between what we build: the OZ mark,
// a website, an app and an automation graph. The cursor pushes and swirls the dots, a click sends a
// shock wave through them, and dots that pass under the hero copy fade out.
// Hosts: [data-dots="hero"] (morphing scene + [data-dots-cap] caption) or [data-dots="<shape>"] (one shape).
// Plain WebGL 1, no libraries. Without WebGL the host simply stays empty.
(function () {
  "use strict";
  var hosts = document.querySelectorAll("[data-dots]");
  if (!hosts.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobileMQ = window.matchMedia("(max-width: 767px)");
  var PI = Math.PI, GOLD = PI * (3 - Math.sqrt(5));

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function bump(d, w) { d = d < 0 ? -d : d; return d >= w ? 0 : 1 - sstep(0, w, d); }
  function wrapd(d) { d -= Math.floor(d); return d > 0.5 ? d - 1 : d; }

  // ---------- Shape builder ----------
  // Each primitive gets a share of the points by weight (area, or length x 0.035 for a thin line) and lays them
  // out evenly: f(j, count, rand) -> [x, y, z, role, t, g]. role 0 faint, 1 body, 2 accent; t runs along the
  // primitive, g groups points for the shape's animation. The result is shuffled so morphs scatter.
  function Builder() { this.p = []; }
  Builder.prototype.add = function (w, f) { if (w > 0) this.p.push({ w: w, f: f }); return this; };
  Builder.prototype.seg = function (ax, ay, bx, by, o) {
    o = o || {};
    var th = o.th || 0, rows = o.rows || 1, za = o.za != null ? o.za : (o.z || 0), zb = o.zb != null ? o.zb : za;
    var dz = o.dz == null ? 0.015 : o.dz, role = o.role == null ? 1 : o.role, g = o.g || 0;
    var dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-6, nx = -dy / len, ny = dx / len;
    return this.add(len * (th ? th * 2 : 0.035) * (o.d || 1), function (j, c, r) {
      var cols = Math.max(1, Math.ceil(c / rows)), t = (Math.floor(j / rows) + 0.5) / cols;
      var k = rows > 1 ? ((j % rows + 0.5) / rows * 2 - 1) * th : (r() - 0.5) * 0.008;
      return [ax + dx * t + nx * k, ay + dy * t + ny * k, za + (zb - za) * t + (r() - 0.5) * 2 * dz, role, t, g];
    });
  };
  Builder.prototype.poly = function (pts, o) { for (var i = 0; i + 3 < pts.length; i += 2) this.seg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], o); return this; };
  Builder.prototype.arc = function (cx, cy, r0, r1, a0, a1, o) {
    o = o || {};
    var rows = o.rows || 1, z = o.z || 0, dz = o.dz == null ? 0.015 : o.dz, role = o.role == null ? 1 : o.role, g = o.g || 0;
    var band = r1 - r0, w = (r0 + r1) / 2 * Math.abs(a1 - a0) * (band > 0 ? band : 0.035) * (o.d || 1);
    return this.add(w, function (j, c, r) {
      var cols = Math.max(1, Math.ceil(c / rows)), t = (Math.floor(j / rows) + 0.5) / cols;
      var rr = rows > 1 ? r0 + band * ((j % rows + 0.5) / rows) : r0 + band * r(), a = a0 + (a1 - a0) * t;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z + (r() - 0.5) * 2 * dz, role, t, g];
    });
  };
  Builder.prototype.rrect = function (x0, y0, x1, y1, rad, o) {
    o = o || {};
    this.seg(x0 + rad, y0, x1 - rad, y0, o).seg(x1, y0 + rad, x1, y1 - rad, o)
      .seg(x1 - rad, y1, x0 + rad, y1, o).seg(x0, y1 - rad, x0, y0 + rad, o);
    if (rad > 0) {
      this.arc(x1 - rad, y0 + rad, rad, rad, -PI / 2, 0, o).arc(x1 - rad, y1 - rad, rad, rad, 0, PI / 2, o)
        .arc(x0 + rad, y1 - rad, rad, rad, PI / 2, PI, o).arc(x0 + rad, y0 + rad, rad, rad, PI, PI * 1.5, o);
    }
    return this;
  };
  Builder.prototype.rect = function (x0, y0, x1, y1, o) {
    o = o || {};
    var z = o.z || 0, dz = o.dz == null ? 0.01 : o.dz, role = o.role == null ? 1 : o.role, g = o.g || 0, w = x1 - x0, h = y1 - y0;
    return this.add(w * h * (o.d || 1), function (j, c, r) {
      var cols = Math.max(1, Math.round(Math.sqrt(c * w / h))), rows = Math.max(1, Math.ceil(c / cols));
      return [x0 + w * ((j % cols + 0.5) / cols), y1 - h * ((Math.floor(j / cols) + 0.5) / rows), z + (r() - 0.5) * 2 * dz, role, j / c, g];
    });
  };
  Builder.prototype.disc = function (cx, cy, rad, o) {
    o = o || {};
    var z = o.z || 0, dz = o.dz == null ? 0.01 : o.dz, role = o.role == null ? 1 : o.role, g = o.g || 0;
    return this.add(PI * rad * rad * (o.d || 1), function (j, c, r) {
      var rr = rad * Math.sqrt((j + 0.5) / c), a = j * GOLD;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z + (r() - 0.5) * 2 * dz, role, j / c, g];
    });
  };
  Builder.prototype.sphere = function (cx, cy, cz, rad, o) {
    o = o || {};
    var role = o.role == null ? 1 : o.role, g = o.g || 0;
    return this.add(4 * PI * rad * rad * (o.d || 1), function (j, c) {
      var y = 1 - 2 * (j + 0.5) / c, rr = Math.sqrt(1 - y * y), a = j * GOLD;
      return [cx + Math.cos(a) * rr * rad, cy + y * rad, cz + Math.sin(a) * rr * rad, role, j / c, g];
    });
  };
  Builder.prototype.build = function (n, seed) {
    var r = rng(seed), p = this.p, tot = 0, i, j, q;
    for (i = 0; i < p.length; i++) tot += p[i].w;
    var cnt = [], used = 0, rem = [];
    for (i = 0; i < p.length; i++) { var e = p[i].w / tot * n; cnt[i] = Math.floor(e); used += cnt[i]; rem.push([e - cnt[i], i]); }
    rem.sort(function (a, b) { return b[0] - a[0]; });
    for (i = 0; used < n; i++, used++) cnt[rem[i % rem.length][1]]++;
    var out = new Float32Array(n * 6), k = 0;
    for (i = 0; i < p.length; i++) for (j = 0; j < cnt[i]; j++) out.set(p[i].f(j, cnt[i], r), 6 * k++);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      for (q = 0; q < 6; q++) { var tmp = out[i * 6 + q]; out[i * 6 + q] = out[j * 6 + q]; out[j * 6 + q] = tmp; }
    }
    return out;
  };

  // ---------- Shapes (y up, about -1..1) ----------
  // anim(o, T) adjusts a point in place: x y z, a (alpha), hi (0 body colour .. 1 accent), s (size).
  var SHAPES = {
    // The OZ mark, from the logo SVG (viewBox 94 94 172 172): open ring, accent dot, accent Z.
    logo: function (n) {
      var S = 1 / 86, b = new Builder(), a0 = 84 / 180 * PI;
      b.arc(0, 0, 57.2 * S, 85.8 * S, a0, a0 + 282 / 180 * PI, { rows: 6, dz: 0.08 });
      b.disc(50 * S, 51 * S, 17 * S, { role: 2, z: 0.06, dz: 0.05, g: 1 });
      b.poly([-23 * S, 23 * S, 22.5 * S, 23 * S, -23 * S, -23 * S, 22.5 * S, -23 * S], { th: 9.2 * S, rows: 4, role: 2, z: 0.1, dz: 0.04, g: 2 });
      return { d: b.build(n, 11), anim: function (o, T) {
        if (o.g === 0) { var h = bump(wrapd(o.t - T * 0.16), 0.08); o.hi = h * 0.9; o.s += h * 0.4; o.z += h * 0.1; }
        else if (o.g === 1) o.s *= 1 + 0.18 * Math.sin(T * 3);
        else o.z += 0.05 * Math.sin(T * 2 - o.x * 5);
      } };
    },
    // A website: browser frame, headline typing itself in, button, picture, three cards taking turns.
    web: function (n) {
      var b = new Builder(), i, cw = 0.53;
      b.rrect(-1.05, -0.74, 1.05, 0.74, 0.08, { d: 1.4 });
      b.seg(-1.05, 0.52, 1.05, 0.52, { role: 0, d: 1.2 });
      for (i = 0; i < 3; i++) b.disc(-0.94 + i * 0.075, 0.63, 0.024, { role: 2, d: 1.6 });
      b.rrect(-0.5, 0.595, 0.55, 0.665, 0.035, { role: 0, d: 0.8 });
      b.seg(-0.88, 0.34, 0.18, 0.34, { th: 0.032, rows: 3, g: 1 });
      b.seg(-0.88, 0.2, -0.14, 0.2, { th: 0.032, rows: 3, g: 2 });
      b.seg(-0.88, 0.07, 0.12, 0.07, { role: 0 });
      b.seg(-0.88, 0.0, -0.06, 0.0, { role: 0 });
      b.rect(-0.88, -0.2, -0.52, -0.1, { role: 2, g: 3, z: 0.06 });
      b.rect(0.3, -0.2, 0.88, 0.4, { role: 0, d: 0.3, z: 0.1 });
      b.rrect(0.3, -0.2, 0.88, 0.4, 0.03, { z: 0.1 });
      b.poly([0.34, -0.14, 0.48, 0.06, 0.58, -0.04, 0.7, 0.16, 0.84, -0.14], { z: 0.1 });
      b.disc(0.44, 0.27, 0.045, { role: 2, z: 0.1 });
      for (i = 0; i < 3; i++) b.rrect(-0.88 + i * (cw + 0.085), -0.64, -0.88 + i * (cw + 0.085) + cw, -0.34, 0.03, { g: 5 + i, d: 0.9 });
      return { d: b.build(n, 23), anim: function (o, T) {
        if (o.g === 1 || o.g === 2) {
          var p = clamp((T * 0.16 % 1) * 2.6 - (o.g - 1), 0, 1), c = bump(o.t - p, 0.05);
          o.a = o.t < p ? 0.9 : 0.12; o.hi = c; o.s += c * 0.7;
        } else if (o.g === 3) o.s *= 1 + 0.15 * Math.sin(T * 3);
        else if (o.g >= 5) { var w = bump(wrapd(T * 0.22 - (o.g - 5) / 3), 0.17); o.hi = w * 0.9; o.z += w * 0.14; o.a += w * 0.2; }
      } };
    },
    // An app: phone, a grid of icons a wave runs through, dock.
    app: function (n) {
      var b = new Builder(), i;
      b.rrect(-0.52, -0.98, 0.52, 0.98, 0.17, { d: 1.6 });
      b.seg(-0.12, 0.87, 0.12, 0.87, { th: 0.014, rows: 2 });
      for (i = 0; i < 16; i++) {
        var x = -0.345 + (i % 4) * 0.23, y = 0.62 - Math.floor(i / 4) * 0.25;
        b.rect(x - 0.075, y - 0.075, x + 0.075, y + 0.075, { g: 10 + i });
      }
      b.rrect(-0.42, -0.8, 0.42, -0.56, 0.08, { role: 0, d: 1.2 });
      for (i = 0; i < 3; i++) b.rect(-0.3 + i * 0.23, -0.74, -0.16 + i * 0.23, -0.62, { role: 2, g: 30 + i });
      b.seg(-0.16, -0.9, 0.16, -0.9, { th: 0.01, rows: 2 });
      return { d: b.build(n, 37), anim: function (o, T) {
        if (o.g >= 10 && o.g < 26) {
          var k = o.g - 10, d = (k % 4 + Math.floor(k / 4)) / 6, w = bump((T * 0.3 % 1) * 1.7 - 0.35 - d, 0.2);
          o.hi = w; o.z += w * 0.2; o.s += w * 0.35;
        } else if (o.g >= 30) o.z += 0.03 * Math.sin(T * 2.4 + o.g);
      } };
    },
    // Automation: nodes wired to a hub, data pulses running along the wires.
    flow: function (n) {
      var b = new Builder();
      var N = [[0, 0, 0], [-0.84, 0.46, 0.28], [0.8, 0.56, -0.24], [-0.74, -0.58, -0.32], [0.84, -0.46, 0.3], [0.02, 0.96, 0.06], [-0.04, -0.96, -0.06]];
      var E = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [5, 2], [2, 4], [4, 6], [6, 3], [3, 1]];
      var R = function (i) { return i ? 0.1 : 0.18; };
      E.forEach(function (e, i) {
        var A = N[e[0]], B = N[e[1]], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz);
        var u0 = (R(e[0]) + 0.03) / L, u1 = 1 - (R(e[1]) + 0.03) / L;
        b.seg(A[0] + dx * u0, A[1] + dy * u0, A[0] + dx * u1, A[1] + dy * u1, { za: A[2] + dz * u0, zb: A[2] + dz * u1, role: 0, g: i, d: 2.2, dz: 0 });
      });
      N.forEach(function (p, i) { b.sphere(p[0], p[1], p[2], R(i), { role: i ? 1 : 2, g: 20 + i, d: 0.9 }); });
      return { d: b.build(n, 41), spin: 0.22, anim: function (o, T) {
        if (o.g < 20) { var w = bump(o.t - (T * 0.5 + o.g * 0.37) % 1, 0.07); o.hi = w; o.a = 0.32 + w * 0.68; o.s += w * 0.8; }
        else o.s *= 1 + 0.08 * Math.sin(T * 2 + o.g);
      } };
    },
    // Process section: a turning globe a bright band sweeps over.
    globe: function (n) {
      var b = new Builder();
      b.sphere(0, 0, 0, 0.95, {});
      return { d: b.build(n, 53), spin: 0.35, anim: function (o, T) {
        var h = bump(o.y - Math.sin(T * 0.9) * 0.95, 0.14); o.a = 0.5 + h * 0.5; o.s += h * 0.5;
      } };
    },
    // Team: three dotted discs in the team colours (o.tint 0 blue, 1 red, 2 green) circling the centre, flat.
    trio: function (n) {
      var b = new Builder();
      [0, 1, 2].forEach(function (k) { b.disc(0, 0, 0.21, { g: k, dz: 0 }); });
      return { d: b.build(n, 71), sway: 0.0001, anim: function (o, T) {
        var a = T * 1.3 + o.g * PI * 2 / 3;
        o.x += Math.cos(a) * 0.25; o.y += Math.sin(a) * 0.25; o.z = 0;
        o.a = 0.95; o.s = 1.05; o.tint = o.g;
      } };
    },
    // Contact: a speech bubble, three dots typing.
    chat: function (n) {
      var b = new Builder(), i;
      b.rrect(-1, -0.46, 1, 0.66, 0.32, { d: 2 });
      b.poly([-0.5, -0.46, -0.74, -0.86, -0.16, -0.46], { d: 2 });
      for (i = 0; i < 3; i++) b.disc(-0.42 + i * 0.42, 0.1, 0.13, { role: 2, g: 10 + i, d: 1.2 });
      return { d: b.build(n, 67), anim: function (o, T) {
        if (o.g >= 10) { var w = Math.max(0, Math.sin(T * 4.2 - (o.g - 10) * 0.9)); o.y += w * 0.09; o.z += w * 0.06; o.s += w * 0.25; o.hi = 0.45 + 0.55 * w; }
      } };
    }
  };

  // ---------- GL ----------
  // Per point: position (css px), size + alpha, colour (mixed on the CPU, so a dot can carry a team colour).
  var VS = "attribute vec2 aP; attribute vec2 aS; attribute vec3 aC; uniform vec2 uRes; uniform float uDpr; varying float vA; varying vec3 vC;\n" +
    "void main() { vA = aS.y; vC = aC; gl_PointSize = aS.x * uDpr; vec2 c = aP / uRes * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }";
  var FS = "precision mediump float; varying float vA; varying vec3 vC;\n" +
    "void main() { float d = length(gl_PointCoord - 0.5); float a = vA * (1.0 - smoothstep(0.3, 0.5, d)); if (a < 0.004) discard; gl_FragColor = vec4(vC * a, a); }";

  var probe = document.createElement("canvas").getContext("2d");
  function parseColor(str, fb) {
    if (!probe || !str) return fb;
    probe.fillStyle = "#000"; probe.fillStyle = str;
    var v = probe.fillStyle;
    if (v[0] === "#") return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
    var m = v.match(/[\d.]+/g);
    return m ? [m[0] / 255, m[1] / 255, m[2] / 255] : fb;
  }

  function Field(host) {
    var kind = host.getAttribute("data-dots"), isHero = kind === "hero", isTeam = kind === "team";
    var seq = isHero ? ["logo", "web", "app", "flow"] : isTeam ? ["logo", "trio"] : [kind];
    if (!SHAPES[seq[0]]) return;
    var cv = document.createElement("canvas");
    cv.className = "dots-cv"; cv.setAttribute("aria-hidden", "true");
    var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;
    host.appendChild(cv);

    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.removeChild(cv); return; }
    gl.useProgram(prog);
    var U = {}; ["uRes", "uDpr"].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    var aP = gl.getAttribLocation(prog, "aP"), aS = gl.getAttribLocation(prog, "aS"), aC = gl.getAttribLocation(prog, "aC");
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aP); gl.enableVertexAttribArray(aS); gl.enableVertexAttribArray(aC);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(aS, 2, gl.FLOAT, false, 28, 8);
    gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 28, 16);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    var n = isHero ? (mobileMQ.matches ? 1500 : 2600) : isTeam ? (mobileMQ.matches ? 1400 : 2400) : 900;
    var shapes = seq.map(function (k) { return SHAPES[k](n); });
    if (isTeam) {
      // Team scene: the big OZ mark, the three colours, then the mark again, faint, behind the cards.
      var big = shapes[0];
      big.sway = 0.12;
      shapes.push({ d: big.d, sway: 0.12, anim: function (o, T) { big.anim(o, T); o.a *= 0.2; o.hi *= 0.6; } });
    }
    var out = new Float32Array(n * 7);
    gl.bufferData(gl.ARRAY_BUFFER, out.byteLength, gl.DYNAMIC_DRAW);

    // Per-point randoms: morph delay, swirl, a spot in the core the morph passes through, intro delay.
    var r = rng(97), rd = new Float32Array(n), rz = new Float32Array(n), core = new Float32Array(n * 3), wd = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      rd[i] = r(); rz[i] = r(); wd[i] = r();
      var u = r() * 2 - 1, a = r() * PI * 2, rr = 0.14 * Math.cbrt(r()), q = Math.sqrt(1 - u * u);
      core[i * 3] = Math.cos(a) * q * rr; core[i * 3 + 1] = u * rr; core[i * 3 + 2] = Math.sin(a) * q * rr;
    }
    var ox = new Float32Array(n), oy = new Float32Array(n), gx = null, gy = null;

    var W = 1, H = 1, dpr = 1, cx = 0, cy = 0, sc = 1, base = [0.07, 0.07, 0.08], acc = [0.09, 0.38, 0.94];
    var pal = [[0.09, 0.38, 0.94], [0.9, 0.28, 0.3], [0.18, 0.62, 0.37]];
    var G = 22, GRID_A = isHero ? 0.2 : 0, R_MOUSE = isHero || isTeam ? 120 : 80, DOT = isHero || isTeam ? 2.7 : 2.4;
    var area = isHero ? (host.closest(".hero") || host) : isTeam ? (host.closest("section") || host) : host;
    var useAvoid = false, avoid = [], frameNo = 0;
    var avoidEls = Array.prototype.slice.call(area.querySelectorAll("[data-dots-avoid]"));
    var cards = isTeam ? Array.prototype.slice.call(area.querySelectorAll(".member")) : [], cardOff = [];

    function layout() {
      var b = host.getBoundingClientRect();
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      useAvoid = (isHero || isTeam) && !mobileMQ.matches;
      if (isHero && useAvoid) { cx = W * 0.72; cy = H * 0.59; sc = Math.min(W * 0.18, H * 0.29, 260); }
      else if (isTeam) { cx = W / 2; cy = H / 2; sc = Math.min(W * 0.3, H * 0.4, 420); }
      else { cx = W / 2; cy = H / 2; sc = Math.min(W, H) * (isHero ? 0.4 : 0.42); }
      gx = null;
      measure();
    }
    // Tight boxes around the copy (per text line), so dots under it fade out. For the team scene also
    // where each card sits at rest, measured with its fly-in offset taken off.
    var range = document.createRange();
    function measure() {
      avoid.length = 0;
      var b = host.getBoundingClientRect();
      if (useAvoid) avoidEls.forEach(function (el) {
        range.selectNodeContents(el);
        var rs = range.getClientRects();
        for (var k = 0; k < rs.length; k++) if (rs[k].width > 2) avoid.push(rs[k].left - b.left, rs[k].top - b.top, rs[k].right - b.left, rs[k].bottom - b.top);
      });
      if (isTeam && flying && !flown) {
        cardOff = cards.map(function (c) {
          var t = c.style.translate, s = c.style.scale;
          c.style.translate = "none"; c.style.scale = "none";
          var r = c.getBoundingClientRect();
          c.style.translate = t; c.style.scale = s;
          return [b.left + cx - (r.left + r.width / 2), b.top + cy - (r.top + r.height / 2)];
        });
      }
    }
    function readColors() {
      var cs = getComputedStyle(host);
      base = parseColor(cs.getPropertyValue("--dots-base").trim() || cs.color, base);
      acc = parseColor(cs.getPropertyValue("--dots-accent").trim(), acc);
      pal = [parseColor(cs.getPropertyValue("--accent").trim(), pal[0]), parseColor(cs.getPropertyValue("--c-red").trim(), pal[1]), parseColor(cs.getPropertyValue("--c-green").trim(), pal[2])];
    }

    // Team scene: plays once when the section comes into view (wide screens). The mark contracts into the three
    // colours, the cards fly out of them, the mark comes back faint behind the cards. No pinning, no scroll scrub.
    var seqT = -1, flying = false, flown = false, FAN = [-6, 0, 6];
    var wideMQ = window.matchMedia("(min-width: 961px)");
    if (isTeam && wideMQ.matches && !reduce) {
      flying = true;
      cards.forEach(function (c) { c.classList.remove("reveal"); c.style.opacity = "0"; });
    }
    function placeCards(e) {
      cards.forEach(function (c, k) {
        var o = cardOff[k] || [0, 0];
        c.style.translate = (o[0] * (1 - e)).toFixed(1) + "px " + (o[1] * (1 - e)).toFixed(1) + "px";
        c.style.scale = (0.3 + 0.7 * e).toFixed(3);
        c.style.rotate = (FAN[k % 3] * (1 - e)).toFixed(2) + "deg";
      });
    }
    function flyCards() {
      flown = true;
      cards.forEach(function (c, k) {
        c.style.transition = "translate 0.9s cubic-bezier(0.16, 1, 0.3, 1) " + k * 0.12 + "s, scale 0.9s cubic-bezier(0.16, 1, 0.3, 1) " + k * 0.12 + "s, rotate 0.9s cubic-bezier(0.16, 1, 0.3, 1) " + k * 0.12 + "s, opacity 0.4s ease-out " + k * 0.12 + "s";
        c.style.opacity = "1";
      });
      placeCards(1);
      setTimeout(function () { cards.forEach(function (c) { c.style.transition = c.style.translate = c.style.scale = c.style.rotate = ""; }); }, 1500);
    }
    function teamStep(dt) {
      if (!isTeam) return;
      if (!flying) { cur = to = 2; mT = -1; return; }
      if (seqT < 0) {
        var r = area.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.2) { cur = to = 0; mT = -1; return; }
        seqT = 0; measure(); placeCards(0);
      }
      seqT += dt;
      var t = seqT;
      // 0-.5 mark | .5-1.6 contracts into the colours | 1.6-2.3 they circle | 2.1 cards fly | 2.4-3.6 mark back, faint
      if (t < 0.5) { cur = to = 0; mT = -1; }
      else if (t < 1.6) { cur = 0; to = 1; mT = (t - 0.5) / 1.1; }
      else if (t < 2.4) { cur = to = 1; mT = -1; }
      else if (t < 3.6) { cur = 1; to = 2; mT = (t - 2.4) / 1.2; }
      else { cur = to = 2; mT = -1; }
      if (t >= 2.1 && !flown) flyCards();
    }

    // Pointer: a smoothed position and strength; leaving the area lets the dots settle back.
    var mx = -1e4, my = -1e4, mOn = 0, mAmt = 0, tx = 0, ty = 0, ptx = 0, pty = 0;
    window.addEventListener("pointermove", function (e) {
      var b = cv.getBoundingClientRect();
      mx = e.clientX - b.left; my = e.clientY - b.top;
      var ab = area.getBoundingClientRect();
      mOn = e.clientX >= ab.left - 40 && e.clientX <= ab.right + 40 && e.clientY >= ab.top - 40 && e.clientY <= ab.bottom + 40 ? 1 : 0;
      ptx = mOn ? clamp(mx / W - 0.5, -0.6, 0.6) : 0; pty = mOn ? clamp(my / H - 0.5, -0.6, 0.6) : 0;
      if (!running && !reduce) kick();
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mOn = 0; ptx = pty = 0; });
    var pulse = { x: 0, y: 0, t: -10 };
    area.addEventListener("pointerdown", function (e) {
      if (reduce || e.target.closest("a, button, input, textarea, summary, label")) return;
      var b = cv.getBoundingClientRect();
      pulse.x = e.clientX - b.left; pulse.y = e.clientY - b.top; pulse.t = wall;
    });

    // Timeline: hold a shape, then morph to the next. `clock` stops while paused, `wall` never does.
    var HOLD = 5.4, MORPH = 1.9, cur = 0, to = 0, mT = -1, hold = 0, clock = 0, wall = 0, wake = reduce || isTeam ? 1 : 0, paused = false, queued = -1;
    var cap = isHero ? document.querySelector("[data-dots-cap]") : null, labels = [], pauseBtn = null;
    if (cap) {
      labels = Array.prototype.slice.call(cap.querySelectorAll("[data-dots-go]"));
      labels.forEach(function (l) { l.addEventListener("click", function () { go(+l.getAttribute("data-dots-go")); }); });
      pauseBtn = cap.querySelector("[data-dots-pause]");
      if (pauseBtn) {
        if (reduce) pauseBtn.hidden = true;
        pauseBtn.addEventListener("click", function () { paused = !paused; syncCap(); if (!running) kick(); });
      }
      syncCap();
    }
    function go(k) {
      if (k === to && mT >= 0) return;
      if (mT >= 0) { queued = k; return; }
      if (k === cur) { hold = 0; return; }
      to = k; mT = 0; hold = 0; syncCap();
      if (reduce) { cur = to; mT = -1; syncCap(); draw(); }
      else if (!running) kick();
    }
    function syncCap() {
      if (!cap) return;
      labels.forEach(function (l, k) { l.classList.toggle("is-on", k === to); l.setAttribute("aria-pressed", k === to ? "true" : "false"); });
      if (pauseBtn) {
        var en = document.documentElement.lang === "en";
        pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
        pauseBtn.setAttribute("aria-label", paused ? (en ? "Play animation" : "Spustit animaci") : (en ? "Pause animation" : "Pozastavit animaci"));
        var ic = pauseBtn.querySelector(".ph"); if (ic) ic.className = "ph " + (paused ? "ph-play" : "ph-pause");
      }
    }
    function step(dt) {
      wall += dt;
      if (wake < 1) wake = Math.min(1, wake + dt / 2.2);
      mAmt += ((mOn ? 1 : 0) - mAmt) * Math.min(1, dt * 5);
      tx += (ptx - tx) * Math.min(1, dt * 3); ty += (pty - ty) * Math.min(1, dt * 3);
      if (paused) return;
      clock += dt;
      if (isTeam) { teamStep(dt); return; }
      if (mT >= 0) {
        mT += dt / MORPH;
        if (mT >= 1) { cur = to; mT = -1; hold = 0; if (queued >= 0) { var k = queued; queued = -1; go(k); } }
      } else if (seq.length > 1 && wake >= 1) {
        hold += dt;
        if (hold >= HOLD) go((cur + 1) % seq.length);
      }
      if (labels[to]) labels[to].style.setProperty("--p", mT >= 0 ? 0 : Math.min(1, hold / HOLD).toFixed(3));
    }

    var A = { x: 0, y: 0, z: 0, role: 0, t: 0, g: 0, a: 0, hi: 0, s: 1, tint: -1 }, B = { x: 0, y: 0, z: 0, role: 0, t: 0, g: 0, a: 0, hi: 0, s: 1, tint: -1 };
    function load(o, d, j, shape, T) {
      o.x = d[j]; o.y = d[j + 1]; o.z = d[j + 2]; o.role = d[j + 3]; o.t = d[j + 4]; o.g = d[j + 5]; o.tint = -1;
      o.a = o.role === 0 ? 0.3 : o.role === 1 ? 0.8 : 1; o.hi = o.role === 2 ? 1 : 0; o.s = o.role === 0 ? 0.85 : o.role === 2 ? 1.15 : 1;
      shape.anim(o, T);
    }
    // A point's own colour: its team colour, or body colour mixed toward the accent by `hi`.
    function colOf(o, k) {
      if (o.tint >= 0) return pal[o.tint][k];
      return base[k] + (acc[k] - base[k]) * o.hi;
    }

    // Spinning shapes turn all the way round; the rest sway. Wrapped so a morph between the two takes the short way.
    function yawOf(shape, T) { return shape.spin ? wrapd(T * shape.spin / (2 * PI)) * 2 * PI : Math.sin(T * 0.3) * (shape.sway || 0.42); }

    function draw() {
      var T = clock, sa = shapes[cur], sb = shapes[to], da = sa.d, db = sb.d, morphing = mT >= 0;
      var m = morphing ? mT : 0, ya = yawOf(sa, T), yb = yawOf(sb, T), ms = m * m * (3 - 2 * m);
      var yaw = ya + wrapd((yb - ya) / (2 * PI)) * 2 * PI * ms + tx * 0.5, pitch = -0.1 + Math.sin(T * 0.21) * 0.1 + ty * 0.3;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var first = !gx; if (first) { gx = new Float32Array(n); gy = new Float32Array(n); }
      var pAge = wall - pulse.t, pOn = pAge >= 0 && pAge < 1.4;
      var nav = avoid.length;
      if (useAvoid && (++frameNo % 30 === 0)) measure();

      for (var i = 0, j = 0, w = 0; i < n; i++, j += 6, w += 7) {
        load(A, da, j, sa, T);
        var x = A.x, y = A.y, z = A.z, al = A.a, hi = 0, s = A.s;
        var cr = colOf(A, 0), cg = colOf(A, 1), cb = colOf(A, 2);
        if (morphing) {
          load(B, db, j, sb, T);
          var mi = clamp(m * (isTeam ? 1.15 : 1.35) - rd[i] * (isTeam ? 0.15 : 0.35), 0, 1); mi = mi * mi * (3 - 2 * mi);
          var uu = 1 - mi, c3 = i * 3, tw = Math.sin(mi * PI), fl = 0;
          if (isTeam) {
            // Calm: every dot slides straight to its new place.
            x = A.x + (B.x - A.x) * mi; y = A.y + (B.y - A.y) * mi; z = A.z + (B.z - A.z) * mi;
          } else {
            x = uu * uu * A.x + 2 * uu * mi * core[c3] + mi * mi * B.x;
            y = uu * uu * A.y + 2 * uu * mi * core[c3 + 1] + mi * mi * B.y;
            z = uu * uu * A.z + 2 * uu * mi * core[c3 + 2] + mi * mi * B.z;
            var sw = tw * tw * (2.2 + 2.2 * rz[i]), cs = Math.cos(sw), sn = Math.sin(sw);
            var nx = cs * x + sn * z; z = cs * z - sn * x; x = nx;
            var ex = 1 + 0.16 * Math.sin(Math.max(0, mi - 0.5) * 2 * PI); x *= ex; y *= ex; z *= ex;
            fl = tw * tw;
          }
          al = A.a + (B.a - A.a) * mi; hi = fl * 0.85; s = (A.s + (B.s - A.s) * mi) * (1 + fl * 0.35);
          cr += (colOf(B, 0) - cr) * mi; cg += (colOf(B, 1) - cg) * mi; cb += (colOf(B, 2) - cb) * mi;
        }
        // Rotate, then perspective.
        var x1 = cyw * x + syw * z, z1 = -syw * x + cyw * z;
        var y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
        var per = 4.2 / (4.2 - z2), X = cx + x1 * sc * per, Y = cy - y2 * sc * per;
        var dep = clamp((z2 + 1.3) / 2.6, 0, 1);
        var size = DOT * s * (0.8 + 0.4 * dep) * Math.min(1.4, Math.max(0.7, sc / 200));
        al *= 0.6 + 0.4 * dep;

        // Intro: every dot starts as a dot of the grid and lifts off into the shape.
        if (wake < 1) {
          if (first) { gx[i] = Math.round((X - G / 2) / G) * G + G / 2; gy[i] = Math.round((Y - G / 2) / G) * G + G / 2; }
          var wk = clamp(wake * 1.6 - wd[i] * 0.6, 0, 1); wk = 1 - Math.pow(1 - wk, 3);
          X = gx[i] + (X - gx[i]) * wk; Y = gy[i] + (Y - gy[i]) * wk;
          size = 2.2 + (size - 2.2) * wk; al = GRID_A + (al - GRID_A) * wk;
          cr = base[0] + (cr - base[0]) * wk; cg = base[1] + (cg - base[1]) * wk; cb = base[2] + (cb - base[2]) * wk;
        }

        // Cursor pushes the dots away and swirls them around itself; they ease back when it leaves.
        var dx = X - mx, dy = Y - my, dist = Math.sqrt(dx * dx + dy * dy), tX = 0, tY = 0;
        if (mAmt > 0.001 && dist < R_MOUSE) {
          var inf = mAmt * (1 - sstep(0, R_MOUSE, dist)), f = inf * inf, ux = dist > 0.01 ? dx / dist : 0, uy = dist > 0.01 ? dy / dist : 0;
          tX = (ux * 26 - uy * 20) * f; tY = (uy * 26 + ux * 20) * f; hi = Math.max(hi, inf * 0.5);
        }
        ox[i] += (tX - ox[i]) * 0.14; oy[i] += (tY - oy[i]) * 0.14;
        X += ox[i]; Y += oy[i];

        // Click: a shock wave ring.
        if (pOn) {
          var px = X - pulse.x, py = Y - pulse.y, pl = Math.sqrt(px * px + py * py);
          var ring = (1 - sstep(0, 70, Math.abs(pl - pAge * 760))) * (1 - pAge / 1.4);
          if (ring > 0 && pl > 0.01) { X += px / pl * ring * 30; Y += py / pl * ring * 30; hi = Math.max(hi, ring * 0.7); }
        }

        if (nav) {
          var hide = 0;
          for (var q = 0; q < nav; q += 4) {
            var ddx = Math.max(avoid[q] - X, 0, X - avoid[q + 2]), ddy = Math.max(avoid[q + 1] - Y, 0, Y - avoid[q + 3]);
            if (ddx < 22 && ddy < 22) { var hd = 1 - sstep(4, 22, Math.sqrt(ddx * ddx + ddy * ddy)); if (hd > hide) hide = hd; }
          }
          al *= 1 - 0.9 * hide;
        }

        // `hi` here is only the transient glow (morph flash, cursor, shock wave): it pulls the colour toward the accent.
        hi = clamp(hi, 0, 1);
        out[w] = X; out[w + 1] = Y; out[w + 2] = size; out[w + 3] = clamp(al, 0, 1);
        out[w + 4] = cr + (acc[0] - cr) * hi; out[w + 5] = cg + (acc[1] - cg) * hi; out[w + 6] = cb + (acc[2] - cb) * hi;
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uDpr, dpr);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, out);
      gl.drawArrays(gl.POINTS, 0, n);
    }

    // Loop runs only while the host is on screen and the tab is visible.
    var visible = false, running = false, raf = 0, last = 0;
    function frame(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      step(dt); draw();
      if (visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
      else { running = false; raf = 0; }
    }
    function kick() {
      if (reduce) { draw(); return; }
      if (running || !visible || document.hidden) return;
      running = true; last = 0; raf = requestAnimationFrame(frame);
    }
    if (reduce) clock = 2.2;

    readColors(); layout();
    if (isTeam) teamStep(0);
    new ResizeObserver(function () { layout(); if (reduce || !running) draw(); }).observe(host);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: "80px" }).observe(host);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
    var retheme = function () { readColors(); syncCap(); if (reduce || !running) draw(); };
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });
    var dark = window.matchMedia("(prefers-color-scheme: dark)");
    if (dark.addEventListener) dark.addEventListener("change", retheme);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  function boot() { for (var i = 0; i < hosts.length; i++) Field(hosts[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
