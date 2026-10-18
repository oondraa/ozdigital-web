// OZDIGITAL fx layer for index.html, on top of motion.js. Styles live in fx.css.
// Needs GSAP + ScrollTrigger + Lenis (loaded deferred before this file). Without them, or with
// prefers-reduced-motion, nothing here runs and the page keeps the plain motion.js reveals.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var root = document.documentElement;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("fx");

  // ---------- Smooth scroll: Lenis drives the native scroll, ScrollTrigger listens to it ----------
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute("href");
      var target = hash.length > 1 && document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = hash === "#about" ? 0 : target;
      var dist = Math.abs((top === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY) - window.scrollY);
      lenis.scrollTo(top, {
        offset: top === 0 ? 0 : -72,
        duration: Math.min(1.8, Math.max(0.8, dist / 2600)),
        easing: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
        onComplete: function () {
          if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
      });
      if (history.replaceState) history.replaceState(null, "", hash === "#about" ? location.pathname + location.search : hash);
    });

    // Dialogs scroll on their own; the page behind them stays put.
    document.querySelectorAll("dialog").forEach(function (d) {
      d.setAttribute("data-lenis-prevent", "");
      new MutationObserver(function () { if (d.open) lenis.stop(); else lenis.start(); }).observe(d, { attributes: true, attributeFilter: ["open"] });
    });
  }

  // ---------- Ink reveal: text condenses out of a blurred blot (blur + alpha threshold) ----------
  // Safari repaints SVG filters on HTML badly, so it gets a plain blur-in instead of the ink.
  var SAFARI = /^Apple/.test(navigator.vendor || "");
  var NS = "http://www.w3.org/2000/svg";
  var defs = null, uid = 0;

  function inkPrep(el) {
    if (el._ink) return el._ink;
    var size = parseFloat(getComputedStyle(el).fontSize) || 40;
    var ink = { el: el, max: Math.max(10, Math.min(56, size * 0.42)), st: { b: 0, t: 1 }, tl: null, shown: false };
    if (!SAFARI) {
      if (!defs) {
        defs = document.createElementNS(NS, "svg");
        defs.setAttribute("aria-hidden", "true");
        defs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
        document.body.insertBefore(defs, document.body.firstChild);
      }
      ink.id = "ink-" + (++uid);
      var f = document.createElementNS(NS, "filter");
      f.setAttribute("id", ink.id);
      f.setAttribute("x", "-20%"); f.setAttribute("y", "-40%");
      f.setAttribute("width", "140%"); f.setAttribute("height", "180%");
      f.setAttribute("color-interpolation-filters", "sRGB");
      f.innerHTML = '<feGaussianBlur in="SourceGraphic"/><feColorMatrix type="matrix"/>';
      defs.appendChild(f);
      ink.blur = f.firstChild; ink.mat = f.lastChild;
    }
    el.classList.remove("reveal");
    el.style.opacity = "0";
    el._ink = ink;
    return ink;
  }

  function inkRender(ink) {
    // Alpha row: a' = a * gain + off. At t=1 only the dense core of the blur survives (the blot);
    // at t=0 it is the identity, so the text ends up exactly as authored.
    var gain = 1 + 19 * ink.st.t, off = -8 * ink.st.t;
    ink.blur.setAttribute("stdDeviation", ink.st.b.toFixed(2));
    ink.mat.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 " + gain.toFixed(3) + " " + off.toFixed(3));
  }

  function inkReveal(el, opts) {
    opts = opts || {};
    var ink = inkPrep(el);
    if (ink.shown) return;
    ink.shown = true;
    if (ink.tl) ink.tl.kill();
    var dur = opts.duration || (finePointer ? 1.2 : 0.8);
    if (SAFARI) {
      ink.tl = gsap.fromTo(el, { opacity: 0, filter: "blur(" + ink.max * 0.5 + "px)" },
        { opacity: 1, filter: "blur(0px)", duration: dur, delay: opts.delay || 0, ease: "power3.out", clearProps: "filter" });
      return;
    }
    ink.st.b = ink.max; ink.st.t = 1;
    ink.tl = gsap.timeline({
      delay: opts.delay || 0,
      onStart: function () { inkRender(ink); el.style.filter = "url(#" + ink.id + ")"; el.style.opacity = "1"; },
      onUpdate: function () { inkRender(ink); },
      onComplete: function () { el.style.filter = ""; ink.tl = null; }
    });
    ink.tl.to(ink.st, { b: 0, duration: dur, ease: "power3.out" }, 0);
    ink.tl.to(ink.st, { t: 0, duration: dur * 0.4, ease: "none" }, dur * 0.6);
  }

  function inkHide(el) {
    var ink = el._ink;
    if (!ink || !ink.shown) return;
    if (ink.tl) { ink.tl.kill(); ink.tl = null; }
    ink.shown = false;
    el.style.filter = "";
    el.style.opacity = "0";
  }

  // Replays each time it comes in from below; scrolling back up past it resets it.
  function inkWatch(el) {
    inkPrep(el);
    ScrollTrigger.create({
      trigger: el,
      start: finePointer ? "top 88%" : "top 95%",
      onEnter: function () { inkReveal(el); },
      onLeaveBack: function () { inkHide(el); }
    });
  }

  var heroTitle = document.querySelector(".hero h1");
  if (heroTitle) {
    inkPrep(heroTitle);
    root.classList.remove("fx-wait");
    var start = function () { inkReveal(heroTitle, { duration: 1.6, delay: 0.15 }); };
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })]).then(start);
    else start();
  }
  document.querySelectorAll(".sec-head, #connect h2").forEach(inkWatch);

  // ---------- Services: cards stack on top of each other while scrolling ----------
  var services = document.querySelector(".services");
  if (services) {
    var cards = Array.prototype.slice.call(services.querySelectorAll(".svc"));
    services.classList.add("fx-stack");
    cards.forEach(function (card, i) {
      card.classList.remove("reveal");
      card.style.setProperty("--k", i);
      var shade = document.createElement("span");
      shade.className = "svc-shade"; shade.setAttribute("aria-hidden", "true");
      card.appendChild(shade);
    });
    // Each card shrinks back and dims while the next one slides over it.
    cards.slice(0, -1).forEach(function (card, i) {
      var next = cards[i + 1];
      gsap.fromTo(card, { "--st": 0 }, {
        "--st": 1, ease: "none",
        scrollTrigger: {
          trigger: next, start: "top bottom", scrub: true,
          end: function () { return "top " + (parseFloat(getComputedStyle(next).top) || 0) + "px"; },
          invalidateOnRefresh: true
        }
      });
    });
  }

  // ---------- Team: a stacked deck that fans out into the grid (wide screens) ----------
  var team = document.querySelector(".team");
  if (team) {
    var members = Array.prototype.slice.call(team.querySelectorAll(".member"));
    var fan = [{ r: -7, y: 14 }, { r: 2, y: -8 }, { r: 6.5, y: 18 }];
    gsap.matchMedia().add("(min-width: 961px)", function () {
      team.classList.add("fx-deck");
      members.forEach(function (m) { m.classList.remove("reveal"); });
      // Offset that puts each card on the middle of the grid.
      function toCenter(m) {
        var t = team.getBoundingClientRect(), r = m.getBoundingClientRect();
        return (t.left + t.width / 2) - (r.left + r.width / 2);
      }
      var tl = gsap.timeline({
        scrollTrigger: { trigger: team, start: "top 92%", end: "top 30%", scrub: 0.8, invalidateOnRefresh: true }
      });
      members.forEach(function (m, i) {
        var f = fan[i % fan.length];
        tl.fromTo(m,
          { "--fx": function () { return toCenter(m) + "px"; }, "--fy": f.y + "px", "--fr": f.r + "deg" },
          { "--fx": "0px", "--fy": "0px", "--fr": "0deg", ease: "power2.inOut" }, 0);
      });
      return function () {
        team.classList.remove("fx-deck");
        members.forEach(function (m) { m.classList.add("reveal", "in"); });
      };
    });
  }

  // ---------- Hero: WebGL ink that trails the cursor ----------
  var hero = document.querySelector(".hero");
  if (hero) heroFluid(hero);

  function heroFluid(hero) {
    var cv = document.createElement("canvas");
    cv.className = "hero-fluid"; cv.setAttribute("aria-hidden", "true");
    var gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;
    hero.insertBefore(cv, hero.firstChild);

    var VERT = "#version 300 es\nin vec2 aPos; out vec2 vUv;\nvoid main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";
    var HEAD = "#version 300 es\nprecision highp float;\nin vec2 vUv; out vec4 outColor;\nuniform sampler2D uField;\n";
    var NOISE =
      "float hash(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.5); return fract(p.x * p.y); }\n" +
      "float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n" +
      "  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }\n" +
      "float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.3) * 0.3 + noise(p * 5.1) * 0.1; }\n";
    // Field: r = ink density, gb = velocity (uv per second). The ink rides its own velocity
    // plus a slow curl-noise current, so it keeps curling after the cursor has gone.
    var STEP = HEAD + NOISE +
      "uniform float uTime, uDt, uAspect;\n" +
      "vec2 curl(vec2 p) { float e = 0.02;\n" +
      "  return vec2(fbm(p + vec2(0, e)) - fbm(p - vec2(0, e)), fbm(p - vec2(e, 0)) - fbm(p + vec2(e, 0))) / (2.0 * e); }\n" +
      "void main() {\n" +
      "  vec4 f = texture(uField, vUv);\n" +
      "  vec2 drift = curl(vec2(vUv.x * uAspect, vUv.y) * 2.4 + uTime * 0.04) * 0.035;\n" +
      "  vec4 s = texture(uField, vUv - (f.gb + drift) * uDt);\n" +
      "  outColor = vec4(max(s.r * 0.988 - 0.001, 0.0), s.gb * 0.955, 1.0);\n" +
      "}";
    var SPLAT = HEAD +
      "uniform float uAspect, uRadius, uAmount; uniform vec2 uFrom, uTo, uVel;\n" +
      "void main() {\n" +
      "  vec2 k = vec2(uAspect, 1.0), p = vUv * k, a = uFrom * k, ab = uTo * k - a;\n" +
      "  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);\n" +
      "  vec2 d = p - a - ab * h;\n" +
      "  float g = exp(-dot(d, d) / uRadius);\n" +
      "  vec4 f = texture(uField, vUv);\n" +
      "  outColor = vec4(min(f.r + g * uAmount, 2.0), f.gb + g * uVel, 1.0);\n" +
      "}";
    var SHOW = HEAD +
      "uniform vec3 uA, uB; uniform float uAlpha;\n" +
      "void main() {\n" +
      "  float d = texture(uField, vUv).r;\n" +
      "  float a = smoothstep(0.02, 1.1, d) * uAlpha;\n" +
      "  vec3 c = mix(uA, uB, smoothstep(0.35, 1.4, d));\n" +
      "  outColor = vec4(c * a, a);\n" +
      "}";

    function program(fs) {
      var p = gl.createProgram();
      [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
        var sh = gl.createShader(s[0]);
        gl.shaderSource(sh, s[1]); gl.compileShader(sh); gl.attachShader(p, sh);
      });
      gl.bindAttribLocation(p, 0, "aPos");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[fx] shader:", gl.getProgramInfoLog(p)); return null; }
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p: p, u: u };
    }
    var step = program(STEP), splat = program(SPLAT), show = program(SHOW);
    if (!step || !splat || !show) { cv.remove(); return; }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var targets = [], W = 0, H = 0, simW = 0, simH = 0, aspect = 1;
    function target() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, simW, simH, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return { t: t, fb: fb };
    }
    function resize() {
      var r = hero.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w === W && h === H) return;
      W = cv.width = w; H = cv.height = h; aspect = w / h;
      var s = Math.min(1, 640 / Math.max(r.width, r.height));
      simW = Math.max(16, Math.round(r.width * s)); simH = Math.max(16, Math.round(r.height * s));
      targets.forEach(function (o) { gl.deleteTexture(o.t); gl.deleteFramebuffer(o.fb); });
      targets = [target(), target()];
    }
    function pass(prog, setup) {
      var src = targets[0], dst = targets[1];
      gl.useProgram(prog.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, simW, simH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
      gl.uniform1i(prog.u.uField, 0);
      setup(prog.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      targets = [dst, src];
    }

    // Ink colours follow the theme: the accent and its deeper fill.
    var colA = [0.36, 0.58, 1], colB = [0.12, 0.4, 0.95], alpha = 0.55;
    var probe = document.createElement("canvas").getContext("2d");
    function rgb(v, fb) {
      probe.fillStyle = "#000"; probe.fillStyle = v.trim() || fb;
      var hx = probe.fillStyle;
      return hx[0] === "#" ? [1, 3, 5].map(function (i) { return parseInt(hx.substr(i, 2), 16) / 255; }) : colA;
    }
    function readColors() {
      var cs = getComputedStyle(root);
      colA = rgb(cs.getPropertyValue("--accent"), "#5b93ff");
      colB = rgb(cs.getPropertyValue("--accent-fill"), "#1f66f2");
      var bg = rgb(cs.getPropertyValue("--bg"), "#0b0b0d");
      alpha = (bg[0] + bg[1] + bg[2]) / 3 > 0.5 ? 0.42 : 0.62;
    }
    readColors();
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

    var queue = [], last = null, visible = true, running = false, idleUntil = 0, time = 0, prevT = 0;
    function addSplat(from, to, vel, amount, radius) {
      queue.push({ from: from, to: to, vel: vel, amount: amount, radius: radius });
      wake(2500);
    }
    function wake(ms) {
      idleUntil = Math.max(idleUntil, performance.now() + ms);
      if (!running && visible) { running = true; prevT = performance.now(); requestAnimationFrame(frame); }
    }
    function frame(now) {
      if (!visible || now > idleUntil) { running = false; return; }
      var dt = Math.min(1 / 30, Math.max(1 / 240, (now - prevT) / 1000)); prevT = now; time += dt;
      resize();
      gl.disable(gl.BLEND);
      queue.splice(0).forEach(function (s) {
        pass(splat, function (u) {
          gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uRadius, s.radius); gl.uniform1f(u.uAmount, s.amount);
          gl.uniform2f(u.uFrom, s.from[0], s.from[1]); gl.uniform2f(u.uTo, s.to[0], s.to[1]);
          gl.uniform2f(u.uVel, s.vel[0], s.vel[1]);
        });
      });
      pass(step, function (u) { gl.uniform1f(u.uTime, time); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uAspect, aspect); });
      gl.useProgram(show.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, targets[0].t);
      gl.uniform1i(show.u.uField, 0);
      gl.uniform3fv(show.u.uA, colA); gl.uniform3fv(show.u.uB, colB); gl.uniform1f(show.u.uAlpha, alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    }

    function uvOf(e) {
      var r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    }
    if (finePointer) {
      hero.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var p = uvOf(e), now = performance.now();
        if (last) {
          var dt = Math.max(8, now - last.t) / 1000;
          var vx = (p[0] - last.p[0]) / dt, vy = (p[1] - last.p[1]) / dt;
          var speed = Math.min(1, Math.hypot(vx * aspect, vy) / 2.5);
          addSplat(last.p, p, [vx * 0.35, vy * 0.35], 0.25 + speed * 0.45, 0.0014 + speed * 0.002);
        }
        last = { p: p, t: now };
      });
      hero.addEventListener("pointerleave", function () { last = null; });
    }

    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) wake(600);
    }).observe(hero);
    window.addEventListener("resize", function () { wake(300); });

    // Intro: one brush stroke sweeps across the hero behind the headline.
    var t0 = null, prev = null;
    function brush(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / 1500);
      var k = 1 - Math.pow(1 - e, 3);
      var p = [0.06 + 0.88 * k, 0.5 + 0.14 * Math.sin(k * Math.PI * 2.2)];
      if (prev) addSplat(prev, p, [(p[0] - prev[0]) * 30, (p[1] - prev[1]) * 30], 0.42 * (1 - e * 0.5), 0.0022);
      prev = p;
      if (e < 1) requestAnimationFrame(brush);
    }
    setTimeout(function () { requestAnimationFrame(brush); }, 250);
  }
})();
