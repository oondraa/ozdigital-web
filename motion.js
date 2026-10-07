// OZDIGITAL motion layer, shared by index.html and lab.html. Styles live in motion.css.
// Pointer effects only run on a real mouse; nothing here runs with prefers-reduced-motion.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var root = document.documentElement;

  // ---------- Split headings into words (letters for one-word titles) that rise out of a mask ----------
  function split(el, base) {
    var text = el.textContent.trim();
    var parts = /\s/.test(text) ? text.split(/\s+/) : Array.from(text);
    el.textContent = "";
    parts.forEach(function (p, i) {
      var w = document.createElement("span"), inner = document.createElement("span");
      w.className = "w"; inner.textContent = p; inner.style.setProperty("--wi", base + i);
      w.appendChild(inner); el.appendChild(w);
      if (i < parts.length - 1 && /\s/.test(text)) el.appendChild(document.createTextNode(" "));
    });
    return parts.length;
  }
  function splitAll(container) {
    var targets = container.matches("[data-split]") ? [container] : container.querySelectorAll("[data-split]");
    var n = 0;
    observer.disconnect();
    targets.forEach(function (el) { n += split(el, n); });
    container.classList.remove("split"); void container.offsetWidth; container.classList.add("split");
    targets.forEach(function (el) { observer.observe(el, { childList: true }); });
  }
  // The language toggle swaps textContent; split again so the new words animate in too.
  var observer = new MutationObserver(function (records) {
    var seen = new Set();
    records.forEach(function (r) {
      var c = r.target.closest(".split") || r.target;
      if (!seen.has(c)) { seen.add(c); splitAll(c); }
    });
  });
  document.querySelectorAll(".hero h1, .lab-title").forEach(splitAll);

  // ---------- Scroll progress bar ----------
  var bar = document.createElement("div");
  bar.className = "scroll-progress"; bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  // ---------- Tilt cards ----------
  var tiltRects = [];
  document.querySelectorAll(".card, .svc, .member, .work").forEach(function (el) {
    el.classList.add("tilt");
    if (!finePointer) return;
    var rect = null, raf = 0, maxDeg = el.offsetWidth > 640 || el.offsetHeight > 520 ? 4 : 7;
    tiltRects.push(function () { rect = null; });
    el.addEventListener("pointerenter", function () { rect = el.getBoundingClientRect(); el.classList.add("is-hover"); });
    el.addEventListener("pointermove", function (e) {
      if (!rect) rect = el.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        el.style.setProperty("--px", (x - 0.5).toFixed(3));
        el.style.setProperty("--py", (y - 0.5).toFixed(3));
        el.style.setProperty("--rx", ((0.5 - y) * maxDeg).toFixed(2) + "deg");
        el.style.setProperty("--ry", ((x - 0.5) * maxDeg).toFixed(2) + "deg");
      });
    });
    el.addEventListener("pointerleave", function () {
      cancelAnimationFrame(raf); rect = null;
      el.classList.remove("is-hover");
      ["--rx", "--ry", "--px", "--py"].forEach(function (p) { el.style.removeProperty(p); });
    });
  });

  // ---------- Magnetic buttons ----------
  if (finePointer) {
    document.querySelectorAll(".btn").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.classList.add("is-magnet");
        b.style.setProperty("--bx", ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + "px");
        b.style.setProperty("--by", ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + "px");
      });
      b.addEventListener("pointerleave", function () {
        b.classList.remove("is-magnet");
        b.style.removeProperty("--bx"); b.style.removeProperty("--by");
      });
    });
  }

  // ---------- Hero flashlight over the dot grid ----------
  var hero = document.querySelector(".hero");
  if (hero && finePointer) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--hx", (e.clientX - r.left) + "px");
      hero.style.setProperty("--hy", (e.clientY - r.top) + "px");
      hero.classList.add("is-lit");
    });
    hero.addEventListener("pointerleave", function () { hero.classList.remove("is-lit"); });
  }

  // ---------- Marquee: drifts on its own, speeds up and skews with scroll velocity, follows scroll direction ----------
  var marquee = document.querySelector(".marquee");
  var track = marquee && marquee.querySelector(".mq-track");
  var groupW = 0, mqX = 0, mqDir = 1, mqVisible = false;
  function measureMarquee() {
    if (!track) return;
    var group = track.querySelector(".mq-group");
    groupW = group.getBoundingClientRect().width;
    // Enough copies to cover the widest screen plus one group of slack.
    while (track.children.length * groupW < window.innerWidth + groupW * 2 && groupW > 0) {
      var c = group.cloneNode(true); c.setAttribute("aria-hidden", "true"); track.appendChild(c);
    }
  }
  if (track) {
    measureMarquee();
    new IntersectionObserver(function (en) { mqVisible = en[0].isIntersecting; }).observe(marquee);
    // Copies are clones, so re-clone after the language toggle changes the words (and their width).
    new MutationObserver(function () {
      while (track.children.length > 1) track.removeChild(track.lastChild);
      measureMarquee();
    }).observe(track.querySelector(".mq-group"), { subtree: true, characterData: true, childList: true });
  }

  // ---------- One frame loop for everything scroll-linked ----------
  var process = document.querySelector(".process");
  var lastY = window.scrollY, vel = 0, dirty = true;
  window.addEventListener("scroll", function () { dirty = true; tiltRects.forEach(function (f) { f(); }); }, { passive: true });
  window.addEventListener("resize", function () { dirty = true; measureMarquee(); });

  function frame() {
    var y = window.scrollY, vh = window.innerHeight;
    var dy = y - lastY; lastY = y;
    vel += (dy - vel) * 0.12;
    if (Math.abs(dy) > 0.5) mqDir = dy > 0 ? 1 : -1;

    if (dirty) {
      dirty = false;
      var max = root.scrollHeight - vh;
      bar.style.setProperty("--sp", max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      if (hero) hero.style.setProperty("--hs", Math.min(1, y / Math.max(1, hero.offsetHeight)).toFixed(3));
      var lab = document.querySelector(".lab-title");
      if (lab) lab.style.setProperty("--hs", Math.min(1, y / 400).toFixed(3));
      if (process) {
        // Grows from 92 % to full width as it scrolls into view.
        var r = process.getBoundingClientRect();
        var t = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.7)));
        process.style.setProperty("--ps", (0.92 + 0.08 * t).toFixed(4));
        process.style.setProperty("--pr", Math.round(64 - 32 * t) + "px");
      }
    }

    if (track && mqVisible && groupW > 0) {
      mqX -= (0.6 + Math.min(14, Math.abs(vel) * 0.35)) * mqDir;
      mqX = ((mqX % groupW) + groupW) % groupW - groupW;
      track.style.setProperty("--mq", mqX.toFixed(2) + "px");
      track.style.setProperty("--mk", Math.max(-12, Math.min(12, -vel * 0.25)).toFixed(2) + "deg");
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
