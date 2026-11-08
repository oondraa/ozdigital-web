// A thin custom scrollbar for mouse users (the native one is hidden in scrollbar.css on fine pointers).
// Taken over from oondraa-web, so both sites share it.
// The thumb lights up while scrolling, widens on hover, can be dragged, and a click on the
// track jumps there. Scrolling goes through Lenis when fx.js has set it up (window.__lenis).
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const root = document.documentElement;
  const bar = document.createElement("div");
  bar.className = "scrollbar";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = '<div class="scrollbar-thumb"></div>';
  document.body.appendChild(bar);
  root.classList.add("has-scrollbar");
  const thumb = bar.firstElementChild;

  let trackH = 0, thumbH = 0, maxScroll = 0, idle = 0;

  function measure() {
    trackH = bar.clientHeight;
    maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
    bar.hidden = maxScroll < 2;
    thumbH = Math.max(40, trackH * (window.innerHeight / root.scrollHeight));
    thumb.style.height = thumbH + "px";
    place();
  }
  function place() {
    const p = maxScroll ? window.scrollY / maxScroll : 0;
    thumb.style.transform = `translateY(${p * (trackH - thumbH)}px)`;
  }
  function scrollToY(y) {
    y = Math.min(maxScroll, Math.max(0, y));
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }

  window.addEventListener("scroll", () => {
    place();
    bar.classList.add("is-active");
    clearTimeout(idle);
    idle = setTimeout(() => bar.classList.remove("is-active"), 900);
  }, { passive: true });

  // Drag the thumb; a press on the bare track first centres the thumb under the pointer.
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    let grab = e.clientY - t.top;
    if (e.target !== thumb) {
      grab = thumbH / 2;
      scrollToY(((e.clientY - r.top - grab) / (trackH - thumbH)) * maxScroll);
    }
    bar.setPointerCapture(e.pointerId);
    bar.classList.add("is-dragging");
    const move = (ev) => scrollToY(((ev.clientY - r.top - grab) / (trackH - thumbH)) * maxScroll);
    const up = () => {
      bar.classList.remove("is-dragging");
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  });

  new ResizeObserver(measure).observe(document.body);
  window.addEventListener("resize", measure);
  measure();
})();
