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
    window.__lenis = lenis; // scrollbar.js drags through it
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

  // ---------- Ink reveal: text sharpens out of a soft blur ----------
  // A plain CSS blur + opacity on its own compositor layer, so the GPU does the work. (The old SVG
  // filter version re-rasterised the whole heading on the CPU every frame and made first load stutter.)
  function inkPrep(el) {
    if (el._ink) return el._ink;
    var size = parseFloat(getComputedStyle(el).fontSize) || 40;
    var ink = { el: el, max: Math.max(6, Math.min(18, size * 0.14)), tl: null, shown: false };
    el.classList.remove("reveal");
    el.style.opacity = "0";
    el._ink = ink;
    return ink;
  }

  function inkReveal(el, opts) {
    opts = opts || {};
    var ink = inkPrep(el);
    if (ink.shown) return;
    ink.shown = true;
    if (ink.tl) ink.tl.kill();
    var dur = opts.duration || (finePointer ? 1.1 : 0.8);
    el.style.willChange = "filter, opacity, transform";
    ink.tl = gsap.fromTo(el,
      { opacity: 0, filter: "blur(" + ink.max + "px)", y: 12 },
      { opacity: 1, filter: "blur(0px)", y: 0, duration: dur, delay: opts.delay || 0, ease: "power3.out", clearProps: "filter,transform,willChange",
        onComplete: function () { ink.tl = null; } });
  }

  function inkHide(el) {
    var ink = el._ink;
    if (!ink || !ink.shown) return;
    if (ink.tl) { ink.tl.kill(); ink.tl = null; }
    ink.shown = false;
    gsap.set(el, { clearProps: "filter,transform,willChange" });
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
    var start = function () { inkReveal(heroTitle, { duration: 1.2, delay: 0.05 }); };
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 500); })]).then(start);
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
})();
