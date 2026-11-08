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
        offset: top === 0 ? 0 : -88,
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
    });
    // Each card shrinks back while the next one slides over it.
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
})();
