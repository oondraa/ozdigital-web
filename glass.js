/*!
 * glass.js: liquid glass for plain HTML, no React and no build step.
 *
 * A vanilla port of the glass core of Glisse v0.5.0 by Kelvin Zhang
 * (https://github.com/0kzh/glisse): src/internal/lens.ts, refraction.ts and
 * svg.ts, cut down to the <Glass> panel (no switch, slider or tab bar lenses).
 * The comments explaining the optics are theirs, shortened.
 *
 * MIT License
 *
 * Copyright (c) 2026 Kelvin Zhang
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Usage (styles in glass.css):
 *
 *   <div class="stage">
 *     <div data-glass-backdrop>...content the glass bends...</div>
 *     <div class="lg-glass" data-glass>...</div>
 *   </div>
 *
 * Every [data-glass] element is attached once the DOM is ready. Glass.attach(el)
 * does it by hand and returns { refit, destroy }.
 *
 * Over content marked data-glass-backdrop, that content is filtered with the
 * glass's lens placed where the glass stands. This works in every browser. Over
 * anything else, only Chromium bends the live backdrop; other browsers keep the
 * frost and the lit rim. Safari filters on the CPU: a lens that moves over its
 * content costs about 40ms a frame for content 1200x800 @2x, so keep moving
 * glass over small content. Still glass costs nothing after its first frame.
 */
(function () {
  "use strict";

  // ---------- svg.ts ----------

  const SVG = "http://www.w3.org/2000/svg";
  let defs;

  function svg(name, attributes) {
    const element = document.createElementNS(SVG, name);
    for (const key in attributes) element.setAttribute(key, String(attributes[key]));
    return element;
  }

  /** The page's one hidden <defs>, where every filter lives. */
  function container() {
    if (defs && defs.isConnected) return defs;
    const root = svg("svg", { width: 0, height: 0, "aria-hidden": "true" });
    root.style.cssText = "position:absolute;pointer-events:none";
    defs = svg("defs", {});
    root.append(defs);
    document.body.append(root);
    return defs;
  }

  // ---------- lens.ts ----------

  // The glass's lens, after Aave's free-moving lens: a rim band a quarter of
  // the shorter side wide, a dome that sags the whole half of it, and a reach
  // of 0.45 of it. --lg-glass-bend overrides the strength, --lg-glass-dispersion
  // how far its colours split (0.4: red bends 8% further than blue). The glass
  // paints the light on its rim itself (rimMap below), so the filter only bends.
  const GLASS = { strength: 0.45, dispersion: 0.4, depth: 0.25, dome: 0.5 };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // erf(x) ~ tanh(sqrt(pi) x)
  const erf = (x) => Math.tanh(1.7724538509 * x);

  // Signed distance to a rounded rectangle centred on the origin; negative inside.
  function distance(x, y, halfWidth, halfHeight, radius) {
    const qx = Math.abs(x) - halfWidth + radius;
    const qy = Math.abs(y) - halfHeight + radius;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  }

  // The circular arc that sags by `sag` across `half`, scaled so its slope
  // averages a half over that span.
  function arc(sag, half) {
    const radius = (half * half + sag * sag) / (2 * sag);
    let sum = 0;
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * half;
      const s = x / Math.sqrt(radius * radius - x * x);
      sum += i === 0 || i === 200 ? s / 2 : s;
    }
    const mean = sum / 200;
    return { radius, scale: mean > 0 ? 0.5 / mean : 1 };
  }

  function slope(x, a) {
    const inside = Math.min(x, 0.999 * a.radius);
    return (inside / Math.sqrt(a.radius * a.radius - inside * inside)) * a.scale;
  }

  /**
   * The lens's map, in device pixels. Within a band around the rim each point
   * shows content from further in, by the slope of a shallow dome there; the
   * middle is left as it is. The map is greys, one per direction of pull, as
   * Chrome converts a coloured map's colours on wide-gamut displays but leaves
   * greys and alpha alone. `mask`'s alpha covers where the lens bends at all,
   * fading out with the bend, so the middle shows the content exactly.
   */
  function lensMap(shape, density) {
    const { width, height } = shape;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const radius = clamp(shape.radius, 0, Math.min(halfWidth, halfHeight));
    const columns = Math.max(1, Math.round(width * density));
    const rows = Math.max(1, Math.round(height * density));
    const pullAcross = new Uint8ClampedArray(columns * rows * 4);
    const pullDown = new Uint8ClampedArray(columns * rows * 4);
    const mask = new Uint8ClampedArray(columns * rows * 4);
    const grey = (data, i, value, alpha) => {
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = alpha === undefined ? 255 : alpha;
    };

    const share = Math.min(width, height);
    const depth = GLASS.depth * share;
    const dome = GLASS.dome * share;
    const innerWidth = Math.max(0, halfWidth - depth);
    const innerHeight = Math.max(0, halfHeight - depth);
    const innerRadius = clamp(radius, 0, Math.min(innerWidth, innerHeight));
    const ramp = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
    const sag = Math.max(0.01, Math.min(dome, Math.min(halfWidth, halfHeight) - 1));
    const across = dome > 0 ? arc(sag, halfWidth) : null;
    const down = dome > 0 ? arc(sag, halfHeight) : null;

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = (row * columns + column) * 4;
        const x = ((column + 0.5) / columns) * width - halfWidth;
        const y = ((row + 0.5) / rows) * height - halfHeight;
        const edge = distance(x, y, halfWidth, halfHeight, radius);
        if (edge >= 0) {
          grey(pullAcross, i, 128);
          grey(pullDown, i, 128);
          grey(mask, i, 128, 0);
          continue;
        }
        const dx = across ? Math.sign(x) * slope(Math.abs(x), across) : clamp(x / halfWidth, -1, 1);
        const dy = down ? Math.sign(y) * slope(Math.abs(y), down) : clamp(y / halfHeight, -1, 1);
        const falloff = 0.5 * (1 + erf(distance(x, y, innerWidth, innerHeight, innerRadius) * ramp));
        grey(pullAcross, i, Math.round((0.5 - 0.5 * dx * falloff) * 255));
        grey(pullDown, i, Math.round((0.5 - 0.5 * dy * falloff) * 255));
        // Fully in once the pull reaches about a twentieth of its strength,
        // and smoothed over the last pixel at the edge.
        grey(mask, i, 128, Math.round(255 * Math.min(1, falloff * 20, -edge)));
      }
    }
    return { columns, rows, across: pullAcross, down: pullDown, mask };
  }

  const encoded = new Map();

  // PNG data URLs of a lens's map, cached by shape.
  function encode(key, draw) {
    const cached = encoded.get(key);
    if (cached) return cached;
    const map = draw();
    const canvas = document.createElement("canvas");
    canvas.width = map.columns;
    canvas.height = map.rows;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const image = context.createImageData(map.columns, map.rows);
    const png = (data) => {
      image.data.set(data);
      context.putImageData(image, 0, 0);
      return canvas.toDataURL();
    };
    const result = { across: png(map.across), down: png(map.down), mask: png(map.mask) };
    encoded.set(key, result);
    return result;
  }

  // WebKit (Safari, every browser on iOS) draws SVG filters on HTML only in
  // bounding-box units, where it scales a displacement by the box's width
  // across and height down, so there each pass gets its own scale.
  const boxUnits = () => /AppleWebKit\//.test(navigator.userAgent) && !/Chrom(?:e|ium)\//.test(navigator.userAgent);

  const CHANNELS = ["1 0 0 0 0  0 0 0 0 0  0 0 0 0 0", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0"];

  const matrix = (input, values, result) => svg("feColorMatrix", { in: input, type: "matrix", values, result });
  const sum = (a, b, k2, k3, result) => svg("feComposite", { in: a, in2: b, operator: "arithmetic", k2, k3, result });

  // Lens k's rays added up: each colour keeps a third of its alpha, so content
  // that's partly transparent adds back up to what it was, then tripled.
  function spread(k) {
    return [
      ...CHANNELS.map((channel, i) => matrix(`ray-${k}-${i}`, `${channel}  0 0 0 0.3333 0`, `light-${k}-${i}`)),
      sum(`light-${k}-0`, `light-${k}-1`, 1, 1, `light-${k}-01`),
      sum(`light-${k}-01`, `light-${k}-2`, 1, 1, `spread-${k}`),
      matrix(`spread-${k}`, "3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0", `bent-${k}`),
    ];
  }

  // A filter that leaves the content as it is but for each lens's rim, where
  // it's displaced by the lens's map once for each of red, green and blue.
  // Each lens's maps and first passes are kept to its own box, so moving a lens
  // over large content redraws only the lens.
  function graph(lenses, box) {
    const unit = box ? "objectBoundingBox" : "userSpaceOnUse";
    const filter = svg("filter", { filterUnits: unit, primitiveUnits: unit, "color-interpolation-filters": "sRGB" });
    if (box) for (const [key, value] of Object.entries({ x: 0, y: 0, width: 1, height: 1 })) filter.setAttribute(key, String(value));

    const single = lenses.length === 1;
    const parts = lenses.map((maps, k) => {
      const merged = (name) => (single ? name : `${name}-${k}`);
      const image = (href, result) => svg("feImage", { href, preserveAspectRatio: "none", result });
      const boxed = [
        image(maps.across, `across-${k}`),
        image(maps.down, `down-${k}`),
        image(maps.mask, merged("raw")),
        svg("feFlood", { "flood-color": "rgb(128, 128, 128)", result: `neutral-${k}` }),
      ];
      filter.append(...boxed);

      // Each pull, with an alpha of one half for the direction it doesn't pull in.
      for (const pull of ["across", "down"]) {
        const half = svg("feComponentTransfer", { in: `${pull}-grey-${k}`, result: `${pull}-pull-${k}` });
        half.append(svg("feFuncA", { type: "linear", slope: 0, intercept: 0.5 }));
        filter.append(svg("feComposite", { in: `${pull}-${k}`, in2: `neutral-${k}`, operator: "over", result: `${pull}-grey-${k}` }), half);
      }
      // Each colour's ray: the content displaced as far as that colour bends.
      const rays = CHANNELS.map((_, i) => {
        const across = svg("feDisplacementMap", {
          in: "SourceGraphic", in2: `across-pull-${k}`, xChannelSelector: "R", yChannelSelector: "A", result: `across-${k}-${i}`,
        });
        const down = svg("feDisplacementMap", {
          in: `across-${k}-${i}`, in2: `down-pull-${k}`, xChannelSelector: "A", yChannelSelector: "R", result: `ray-${k}-${i}`,
        });
        boxed.push(across);
        filter.append(across, down);
        return [across, down];
      });
      filter.append(...spread(k));
      // Where the map covers, the bent content, split by the map's own alpha.
      filter.append(svg("feComposite", { in: `bent-${k}`, in2: merged("raw"), operator: "in", result: merged("inside") }));
      return { boxed, rays };
    });
    if (!single) {
      for (const name of ["raw", "inside"]) {
        const merge = svg("feMerge", { result: name });
        lenses.forEach((_, k) => merge.append(svg("feMergeNode", { in: `${name}-${k}` })));
        filter.append(merge);
      }
    }
    // Elsewhere the content as it was, split the other way, so the two add
    // back up exactly where the bend fades.
    filter.append(
      svg("feComposite", { in: "SourceGraphic", in2: "raw", operator: "out", result: "outside" }),
      svg("feComposite", { in: "inside", in2: "outside", operator: "arithmetic", k2: 1, k3: 1, result: "seen" }),
    );
    return { filter, parts };
  }

  // Places each lens's maps and passes over content `across` by `down` px.
  function place(built, placed, across, down, box) {
    if (!box) for (const [key, value] of Object.entries({ x: 0, y: 0, width: across, height: down })) built.filter.setAttribute(key, String(value));
    placed.forEach((lens, k) => {
      const part = built.parts[k];
      const spectrum = [1 + 0.2 * lens.dispersion, 1 + 0.1 * lens.dispersion, 1];
      part.rays.forEach(([pullAcross, pullDown], i) => {
        pullAcross.setAttribute("scale", String((box ? lens.reach / across : lens.reach) * spectrum[i]));
        pullDown.setAttribute("scale", String((box ? lens.reach / down : lens.reach) * spectrum[i]));
      });
      const rect = box
        ? { x: lens.x / across, y: lens.y / down, width: lens.width / across, height: lens.height / down }
        : { x: lens.x, y: lens.y, width: lens.width, height: lens.height };
      for (const element of part.boxed) for (const key in rect) element.setAttribute(key, String(rect[key]));
    });
  }

  /** The glass's size and corner radius in px, or null while it has no size. */
  function shapeOf(glass, style) {
    style = style || getComputedStyle(glass);
    const width = glass.offsetWidth;
    const height = glass.offsetHeight;
    if (!width || !height) return null;
    const corner = style.borderTopLeftRadius;
    const radius = Math.min(
      width / 2,
      height / 2,
      corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0,
    );
    return { width, height, radius };
  }

  // The map for the glass's size and shape (cached), with the strength and
  // dispersion read off the glass.
  function fit(glass) {
    const style = getComputedStyle(glass);
    const shape = shapeOf(glass, style);
    if (!shape) return null;
    const tuned = parseFloat(style.getPropertyValue("--lg-glass-bend"));
    const strength = Number.isFinite(tuned) ? tuned : GLASS.strength;
    const split = parseFloat(style.getPropertyValue("--lg-glass-dispersion"));
    const dispersion = Number.isFinite(split) ? Math.max(0, split) : GLASS.dispersion;
    const density = Math.min(devicePixelRatio || 1, 2);
    const key = [shape.width, shape.height, shape.radius, density].join("|");
    const maps = encode(key, () => lensMap(shape, density));
    return maps ? { maps, key, strength, dispersion, width: shape.width, height: shape.height } : null;
  }

  const surfaces = new Map();
  let made = 0;

  // Filters the content for wherever its active lenses stand now. WebKit keeps
  // showing a filter's old output until its id changes, so each move gets a new id.
  function render(surface) {
    const { content } = surface;
    const across = content.offsetWidth;
    const down = content.offsetHeight;
    const from = content.getBoundingClientRect();
    const shown = [];
    if (across && down) {
      // Each lens's box in the content's own pixels, past any scale on either.
      const unit = from.width / across || 1;
      for (const member of surface.members) {
        const at = member.glass.getBoundingClientRect();
        if (!member.fit || !at.width || !at.height) continue;
        const width = at.width / unit;
        const height = at.height / unit;
        member.placed = {
          x: (at.left - from.left) / unit,
          y: (at.top - from.top) / unit,
          width,
          height,
          reach: member.fit.strength * Math.min(width, height),
          dispersion: member.fit.dispersion,
        };
        shown.push(member);
      }
    }
    if (!shown.length) {
      surface.placed = "";
      content.style.removeProperty("filter");
      return;
    }

    const box = boxUnits();
    const structure = shown.map((member) => member.fit.key).join("\n");
    if (structure !== surface.built || !surface.graph) {
      if (surface.graph) surface.graph.filter.remove();
      surface.graph = graph(shown.map((member) => member.fit.maps), box);
      container().append(surface.graph.filter);
      surface.built = structure;
      surface.placed = "";
    }
    const placed = shown.map((member) => member.placed);
    const next = [across, down, ...placed.flatMap((p) => [p.x, p.y, p.width, p.height, p.reach, p.dispersion])]
      .map((value) => value.toFixed(2))
      .join(" ");
    if (next === surface.placed) return;
    surface.placed = next;
    place(surface.graph, placed, across, down, box);
    surface.graph.filter.id = `${surface.name}-${++surface.version}`;
    content.style.filter = `url("#${surface.graph.filter.id}")`;
  }

  /** Makes `glass` a lens over `content`, which must have room for the whole lens. */
  function createLens(glass, content) {
    let surface = surfaces.get(content);
    if (!surface) {
      surface = { content, lenses: 0, members: [], name: `glass-lens-${made++}`, built: "", placed: "", version: 0 };
      surfaces.set(content, surface);
    }
    const shared = surface;
    shared.lenses++;
    const member = { glass };
    let active = false;
    const prepare = () => {
      member.fit = fit(glass) || undefined;
    };
    const lens = {
      setActive(next) {
        if (next === active) return;
        active = next;
        if (active) {
          shared.members.push(member);
          prepare();
        } else {
          shared.members.splice(shared.members.indexOf(member), 1);
        }
        render(shared);
      },
      update() {
        if (active) render(shared);
      },
      refit() {
        if (!active) return;
        prepare();
        render(shared);
      },
      destroy() {
        lens.setActive(false);
        if (--shared.lenses > 0) return;
        if (shared.graph) shared.graph.filter.remove();
        surfaces.delete(content);
      },
    };
    return lens;
  }

  const backdrops = new Map();

  // Glass that bends its own live backdrop, as only Chromium can: the lens's
  // filter drawn for the glass's box, set as --lg-filter for its backdrop-filter.
  function fitBackdropLens(glass) {
    const fitted = fit(glass);
    if (!fitted) return;
    const { maps, key, strength, dispersion, width, height } = fitted;
    const reach = strength * Math.min(width, height);
    const id = `${key}|${reach}|${dispersion}`;
    let name = backdrops.get(id);
    if (!name) {
      const built = graph([maps], false);
      place(built, [{ x: 0, y: 0, width, height, reach, dispersion }], width, height, false);
      name = `glass-backdrop-${backdrops.size}`;
      built.filter.id = name;
      container().append(built.filter);
      backdrops.set(id, name);
    }
    glass.style.setProperty("--lg-filter", `url("#${name}") saturate(1.5)`);
  }

  // ---------- refraction.ts ----------

  // The light on the rim, as iOS 26.1 draws it: a line brightest at the very
  // edge and gone 1.2px in. A light from the top left lights the left side
  // and top, its reflection the right side and bottom, fading over the corners
  // between. Under it, the glass's 0.5px --lg-edge line.
  const RIM_WIDTH = 1.22;
  const EDGE_WIDTH = 0.5;

  function rimMap(shape, shine, density, edge) {
    const { width, height, radius } = shape;
    const columns = Math.max(1, Math.round(width * density));
    const rows = Math.max(1, Math.round(height * density));
    const data = new Uint8ClampedArray(columns * rows * 4);
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const corner = clamp(radius, 0, Math.min(halfWidth, halfHeight));
    const half = 0.5 / density;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = ((column + 0.5) / columns) * width - halfWidth;
        const y = ((row + 0.5) / rows) * height - halfHeight;
        const depth = -distance(x, y, halfWidth, halfHeight, corner);
        if (depth < -half || depth > 2 * RIM_WIDTH) continue;
        // The nearest edge's outward normal.
        const qx = Math.abs(x) - halfWidth + corner;
        const qy = Math.abs(y) - halfHeight + corner;
        let nx = 0;
        let ny = 0;
        if (qx > 0 && qy > 0) {
          const length = Math.hypot(qx, qy);
          nx = (Math.sign(x) * qx) / length;
          ny = (Math.sign(y) * qy) / length;
        } else if (qx > qy) nx = Math.sign(x);
        else ny = Math.sign(y);
        // 1 along the lit sides, sqrt 2 on the corners they meet at, 0 on the others.
        const facing = Math.abs(nx + ny);
        const along = Math.max(0, depth) / (RIM_WIDTH * Math.sqrt(Math.max(1, facing)));
        // How much of the pixel the shape, and the edge line, cover.
        const cover = clamp((depth + half) * density, 0, 1);
        const lined = clamp((Math.min(EDGE_WIDTH, depth + half) - Math.max(0, depth - half)) * density, 0, 1);
        const light = along < 1 ? shine * Math.min(1, facing) ** 1.5 * (1 - along ** 1.5) * cover : 0;
        const line = edge[3] * lined * (1 - light);
        const alpha = light + line;
        if (alpha <= 0) continue;
        const i = (row * columns + column) * 4;
        for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round((255 * light + edge[channel] * line) / alpha);
        data[i + 3] = Math.round(255 * alpha);
      }
    }
    return { columns, rows, data };
  }

  // A CSS colour as sRGB and alpha, by the canvas's own parsing.
  function parseColour(context, colour) {
    context.fillStyle = "#0000";
    context.fillStyle = colour;
    const value = String(context.fillStyle);
    if (value.startsWith("#")) return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(1);
    const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) || []).map(Number);
    return [r, g, b, a];
  }

  const rims = new Map();
  let palette;

  // Sets the glass's --lg-rim for its size, corners and page, and marks it
  // data-rim, as its rim now draws its edge line.
  function paintRim(element) {
    const style = getComputedStyle(element);
    const shape = shapeOf(element, style);
    if (palette === undefined) palette = document.createElement("canvas").getContext("2d");
    if (!shape || !palette) return;
    const tuned = parseFloat(style.getPropertyValue("--lg-rim-shine"));
    const shine = Number.isFinite(tuned) ? clamp(tuned, 0, 1) : 0.13;
    const edge = parseColour(palette, style.getPropertyValue("--lg-edge").trim() || "transparent");
    const density = Math.min(devicePixelRatio || 1, 3);
    const key = [shape.width, shape.height, shape.radius, shine, edge, density].join("|");
    let url = rims.get(key);
    if (!url) {
      const { columns, rows, data } = rimMap(shape, shine, density, edge);
      const canvas = document.createElement("canvas");
      canvas.width = columns;
      canvas.height = rows;
      const context = canvas.getContext("2d");
      if (!context) return;
      const image = context.createImageData(columns, rows);
      image.data.set(data);
      context.putImageData(image, 0, 0);
      url = `url("${canvas.toDataURL()}")`;
      rims.set(key, url);
    }
    element.style.setProperty("--lg-rim", url);
    element.setAttribute("data-rim", "");
  }

  // What to repaint when the theme changes, which no resize reports: a
  // data-theme set anywhere, or the system's light or dark.
  const repaints = new Set();
  let unwatch;

  function onThemeChange(repaint) {
    repaints.add(repaint);
    if (!unwatch) {
      const run = () => repaints.forEach((each) => each());
      const observer = new MutationObserver(run);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"], subtree: true });
      const scheme = matchMedia("(prefers-color-scheme: dark)");
      if (scheme.addEventListener) scheme.addEventListener("change", run);
      unwatch = () => {
        observer.disconnect();
        if (scheme.removeEventListener) scheme.removeEventListener("change", run);
      };
    }
    return () => {
      repaints.delete(repaint);
      if (repaints.size) return;
      if (unwatch) unwatch();
      unwatch = undefined;
    };
  }

  function whenIdle(callback) {
    if ("requestIdleCallback" in window) {
      const handle = requestIdleCallback(callback, { timeout: 500 });
      return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(callback, 50);
    return () => clearTimeout(handle);
  }

  // Fits the glass once the page is idle, and again whenever it changes size.
  function refitting(element, fitNow, properties) {
    let cancel;
    let fitted = false;
    const observer = new ResizeObserver(() => {
      if (cancel) cancel();
      cancel = whenIdle(() => {
        fitted = true;
        fitNow();
      });
    });
    observer.observe(element);
    return {
      refit: () => {
        if (fitted) fitNow();
      },
      stop: () => {
        if (cancel) cancel();
        observer.disconnect();
        for (const name of properties) element.style.removeProperty(name);
      },
    };
  }

  /** Only Chromium applies SVG filters to the live backdrop. */
  const refractsBackdrop = () => /Chrom(?:e|ium)\//.test(navigator.userAgent);

  const MARK = "data-glass-backdrop";

  // The part of an element that can be seen, cut down by every ancestor that
  // clips its overflow.
  function visibleBox(element) {
    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (!/hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) continue;
      const clip = node.getBoundingClientRect();
      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  /** The marked content behind the glass: the closest one whose visible part it overlaps. */
  function findBackdrop(element) {
    const box = element.getBoundingClientRect();
    const behind = (candidate) => {
      if (candidate.contains(element) || element.contains(candidate)) return false;
      const other = visibleBox(candidate);
      return other.left < box.right && other.right > box.left && other.top < box.bottom && other.bottom > box.top;
    };
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const found = [...node.querySelectorAll(`[${MARK}]`)].find(behind);
      if (found) return found;
    }
    return null;
  }

  // The lenses over marked content, by the content. Each frame, one lens over
  // each piece of content places them all, so the bend stays under every glass
  // however it or the content moves. render() bails out early when nothing moved.
  const followed = new Map();
  let following = 0;

  function follow() {
    for (const lenses of followed.values()) {
      const first = lenses.values().next().value;
      if (first) first.update();
    }
    following = followed.size ? requestAnimationFrame(follow) : 0;
  }

  // Makes the glass a lens over the marked content behind it.
  function bend(element, source) {
    const lens = createLens(element, source);
    let started = false;
    const fitting = refitting(
      element,
      () => {
        paintRim(element);
        if (started) return lens.refit();
        started = true;
        lens.setActive(true);
        let lenses = followed.get(source);
        if (!lenses) followed.set(source, (lenses = new Set()));
        lenses.add(lens);
        following = following || requestAnimationFrame(follow);
      },
      ["--lg-rim"],
    );
    return {
      refit: fitting.refit,
      stop: () => {
        fitting.stop();
        const lenses = followed.get(source);
        if (lenses) {
          lenses.delete(lens);
          if (!lenses.size) followed.delete(source);
        }
        lens.destroy();
      },
    };
  }

  const attached = new WeakMap();

  /**
   * Bends what's behind the element. Settings (--lg-glass-bend,
   * --lg-glass-dispersion, --lg-rim-shine) are read when it fits; call
   * refit() after changing them without a resize.
   */
  function attach(element) {
    if (attached.has(element)) return attached.get(element);
    const source = findBackdrop(element);
    const fitting = source
      ? bend(element, source)
      : refitting(
          element,
          () => {
            paintRim(element);
            if (refractsBackdrop()) fitBackdropLens(element);
          },
          ["--lg-filter", "--lg-rim"],
        );
    const stopWatching = onThemeChange(() => paintRim(element));
    const handle = {
      refit: fitting.refit,
      destroy() {
        stopWatching();
        fitting.stop();
        element.removeAttribute("data-rim");
        attached.delete(element);
      },
    };
    attached.set(element, handle);
    return handle;
  }

  function attachAll() {
    document.querySelectorAll("[data-glass]").forEach(attach);
  }

  window.Glass = { attach, refractsBackdrop };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attachAll);
  else attachAll();
})();
