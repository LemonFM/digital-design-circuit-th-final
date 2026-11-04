/* Logic kit — helpers shared by topic pages:
   three-valued gates (1 / 0 / null = unknown), gate symbols, schematics, timing diagrams. */
(function (global) {
  "use strict";

  const NOT = (a) => (a === null ? null : a ? 0 : 1);
  const AND = (a, b) => (a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : null);
  const OR = (a, b) => (a === 1 || b === 1 ? 1 : a === 0 && b === 0 ? 0 : null);
  const NAND = (a, b) => NOT(AND(a, b));
  const NOR = (a, b) => NOT(OR(a, b));

  // Settle a cross-coupled pair. If it never stabilises it is a race, so the result is unknown.
  function settle(q, qn, step) {
    for (let i = 0; i < 8; i++) {
      const [nq, nqn] = step(q, qn);
      if (nq === q && nqn === qn) return [q, qn];
      q = nq;
      qn = nqn;
    }
    return [null, null];
  }

  const level = (v) => (v === 1 ? "hi" : v === 0 ? "lo" : "x");

  // "~Q" renders as Q′ — the complement notation used in the course slides.
  const label = (name) => (name.startsWith("~") ? `${name.slice(1)}′` : name);

  const BODY = {
    and: "M0 0 H26 A20 20 0 0 1 26 40 H0 Z",
    or: "M0 0 C10 10 10 30 0 40 C22 40 38 34 46 20 C38 6 22 0 0 0 Z",
    not: "M6 2 L42 20 L6 38 Z",
  };

  // A gate is 40 tall: inputs at (x+6, y+10) and (x+6, y+30), output at (x+56, y+20).
  // "not" has a single input at (x+6, y+20) and its output at (x+52, y+20).
  function gate(kind, x, y) {
    const body = kind === "not" ? BODY.not : kind.endsWith("and") ? BODY.and : BODY.or;
    const bubble = kind.startsWith("n") ? `<circle cx="${kind === "not" ? 47 : 51}" cy="20" r="5"/>` : "";
    return `<g class="gate" transform="translate(${x} ${y})"><path d="${body}"/>${bubble}</g>`;
  }

  // spec: { viewBox, nets: { id: { d, dots } }, gates: [[kind, x, y]], labels: [[text, x, y, anchor, net]] }
  function schematic(svg, spec) {
    svg.setAttribute("viewBox", spec.viewBox);
    svg.classList.add("schem");
    let html = "";
    for (const [id, net] of Object.entries(spec.nets)) {
      html += `<path class="wire" data-net="${id}" d="${net.d}"/>`;
      for (const [x, y] of net.dots || []) {
        html += `<circle class="dot" data-net="${id}" cx="${x}" cy="${y}" r="3.5"/>`;
      }
    }
    html += spec.gates.map((g) => gate(...g)).join("");
    for (const [text, x, y, anchor = "start", net] of spec.labels) {
      html += `<text x="${x}" y="${y}" text-anchor="${anchor}">${label(text)}</text>`;
      if (net) html += `<text class="val" data-val="${net}" x="${x}" y="${y + 18}" text-anchor="${anchor}"></text>`;
    }
    svg.innerHTML = html;
  }

  // Colour every wire by its logic level and print the value next to labelled nets.
  function setLevels(svg, levels) {
    svg.querySelectorAll("[data-net]").forEach((el) => {
      el.classList.remove("hi", "lo", "x");
      const v = levels[el.dataset.net];
      if (v !== undefined) el.classList.add(level(v));
    });
    svg.querySelectorAll("[data-val]").forEach((el) => {
      const v = levels[el.dataset.val];
      if (v === undefined) return;
      el.textContent = v === null ? "?" : v;
      el.setAttribute("class", "val " + level(v));
    });
  }

  // signals: [{ key, name, out }], rows: [{ key: 0 | 1 | null }]
  // hide: keys drawn as "?" (or, with hideAs: "guides", as faint 1/0 guide lines to draw on);
  // ticks: label every row t0, t1…; marks: [{ at, text }] dashed lines at row boundaries, e.g. clock edges.
  function wave(svg, signals, rows, { hide = [], hideAs = "box", step = 44, ticks = true, marks = [] } = {}) {
    const longest = Math.max(...signals.map((s) => label(s.name).length));
    const padL = Math.max(52, 24 + 10 * longest); // room for the widest signal name
    const rowH = 42, amp = 22, top = 8;
    const n = Math.max(rows.length, 1);
    const W = padL + n * step + 8;
    const H = top + signals.length * rowH + 22;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.classList.add("wave");

    const vline = (x, cls) => `<line class="${cls}" x1="${x}" y1="${top}" x2="${x}" y2="${H - 20}"/>`;
    let g = "";
    if (ticks) {
      for (let j = 0; j <= n; j++) {
        const x = padL + j * step;
        g += vline(x, "grid");
        if (j < n) g += `<text x="${x + step / 2}" y="${H - 5}" text-anchor="middle">t${j}</text>`;
      }
    }
    for (const m of marks) {
      const x = padL + m.at * step;
      g += vline(x, "mark") + `<text x="${x}" y="${H - 5}" text-anchor="middle">${m.text}</text>`;
    }

    signals.forEach((s, i) => {
      const yL = top + i * rowH + rowH - 8;
      const yH = yL - amp;
      const yMid = yL - amp / 2 + 5;
      g += `<text class="name" x="${padL - 14}" y="${yMid}" text-anchor="end">${label(s.name)}</text>`;

      if (hide.includes(s.key) && hideAs === "guides") {
        const x1 = padL + n * step;
        g += `<line class="guide" x1="${padL}" y1="${yH}" x2="${x1}" y2="${yH}"/><line class="guide" x1="${padL}" y1="${yL}" x2="${x1}" y2="${yL}"/>`;
        return;
      }
      if (hide.includes(s.key)) {
        g += `<rect class="hidden-box" x="${padL}" y="${yH}" width="${n * step}" height="${amp}" rx="4"/>`;
        g += `<text class="q" x="${padL + (n * step) / 2}" y="${yMid}" text-anchor="middle">?</text>`;
        return;
      }

      // A run of unknown values is one box, labelled like the slides when there is room.
      const unknown = (x0, x1) =>
        `<rect class="unk" x="${x0}" y="${yH}" width="${x1 - x0}" height="${amp}"/>` +
        `<text class="unk-t" x="${(x0 + x1) / 2}" y="${yMid - 1}" text-anchor="middle">${x1 - x0 >= 80 ? "Undefined" : "?"}</text>`;
      let d = "";
      let prev;
      let unkFrom = null;
      rows.forEach((r, j) => {
        const v = r[s.key];
        const x0 = padL + j * step;
        if (v === null) {
          if (unkFrom === null) unkFrom = x0;
          prev = undefined;
          return;
        }
        if (unkFrom !== null) {
          g += unknown(unkFrom, x0);
          unkFrom = null;
        }
        const y = v ? yH : yL;
        if (prev === undefined) d += `M${x0} ${y}`;
        else if (prev !== v) d += `V${y}`;
        d += `H${x0 + step}`;
        prev = v;
      });
      if (unkFrom !== null) g += unknown(unkFrom, padL + n * step);
      g += `<path class="sig${s.out ? " out" : ""}" d="${d}"/>`;
    });

    svg.innerHTML = g;
  }

  // Widest step (min–44px) that lets a timing diagram of n steps fit inside its scroll box.
  function fitStep(box, n, min = 26) {
    const cs = getComputedStyle(box);
    const inner = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.max(min, Math.min(44, Math.floor((inner - 60) / n)));
  }

  // Highlight the table-of-contents link for the section in view.
  // On narrow screens the TOC is a collapsible bar: start closed, close after a jump.
  function tocSpy(toc) {
    const narrow = matchMedia("(max-width: 900px)");
    if (narrow.matches) toc.open = false;
    toc.addEventListener("click", (e) => {
      if (narrow.matches && e.target.closest("a")) toc.open = false;
    });

    const links = [...toc.querySelectorAll("a[href^='#']")];
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.classList.remove("active"));
          byId.get(e.target.id)?.classList.add("active");
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    byId.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  // ---------- Sequences ----------

  // { key: "0101…" } → one input object per time step.
  function steps(seq) {
    const keys = Object.keys(seq);
    return [...seq[keys[0]]].map((_, t) => Object.fromEntries(keys.map((k) => [k, +seq[k][t]])));
  }

  // n-step waveform string that is 1 inside the given [from, to) ranges.
  const pulses = (n, ranges) =>
    Array.from({ length: n }, (_, t) => (ranges.some(([a, b]) => t >= a && t < b) ? "1" : "0")).join("");

  // True when `key` has its active edge between the previous and current inputs.
  const isEdge = (prev, cur, key, edge) =>
    edge === "rise" ? prev[key] === 0 && cur[key] === 1 : prev[key] === 1 && cur[key] === 0;

  // Run a sequence through step(prevInputs, inputs, state) → state; rows carry inputs, state and Qn
  // (Qn is the complement of Q unless the state tracks it separately, as an SR latch must).
  function simulate(seq, step, init) {
    const rows = steps(seq);
    let s = { ...init };
    return rows.map((i, t) => {
      s = step(rows[t - 1] || i, i, s);
      return { ...i, ...s, Qn: "Qn" in s ? s.Qn : NOT(s.Q) };
    });
  }

  // ---------- Diagrams ----------

  let markerSeq = 0;

  // Row index for a pair of rows that differ only in the current Q (Q = 0 first); -1 when Q is unknown.
  const byQ = (base, q) => (q === null || q === undefined ? -1 : base + q);

  // Two-state diagram Q=0 ⇄ Q=1. t: { up, down, loop0, loop1 } transition labels.
  function twoState(svg, t) {
    const id = `arr${++markerSeq}`;
    svg.setAttribute("viewBox", "0 0 440 184");
    svg.classList.add("fsm");
    svg.innerHTML = `
      <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>
      <path d="M136 70 Q220 12 304 70" marker-end="url(#${id})"/>
      <path d="M304 110 Q220 168 136 110" marker-end="url(#${id})"/>
      <path d="M78 78 C26 46 26 134 78 102" marker-end="url(#${id})"/>
      <path d="M362 78 C414 46 414 134 362 102" marker-end="url(#${id})"/>
      <circle cx="110" cy="90" r="34"/><circle cx="330" cy="90" r="34"/>
      <text class="st" x="110" y="96" text-anchor="middle">Q=0</text>
      <text class="st" x="330" y="96" text-anchor="middle">Q=1</text>
      <text x="220" y="30" text-anchor="middle">${t.up}</text>
      <text x="220" y="164" text-anchor="middle">${t.down}</text>
      <text x="52" y="50" text-anchor="middle">${t.loop0}</text>
      <text x="388" y="50" text-anchor="middle">${t.loop1}</text>`;
  }

  // Block symbol of a flip-flop as an <svg> string.
  // Pins are names ("D", "~Q") or { name, clk: "rise" | "fall", bubble: true }; top/bottom are active-low pins.
  function ffSymbol({ left = [], right = ["Q", "~Q"], top, bottom, cap }) {
    const rows = Math.max(left.length, right.length, 2);
    const y0 = top ? 40 : 16;
    const h = rows * 30 + 14;
    const yEnd = y0 + h;
    const pinY = (k, n) => y0 + 7 + ((h - 14) * (k + 0.5)) / n;
    let s = `<rect x="40" y="${y0}" width="80" height="${h}" rx="4"/>`;
    left.forEach((p, k) => {
      const pin = typeof p === "string" ? { name: p } : p;
      const y = pinY(k, left.length);
      s += pin.bubble || pin.clk === "fall"
        ? `<line x1="12" y1="${y}" x2="30" y2="${y}"/><circle cx="35" cy="${y}" r="5"/>`
        : `<line x1="12" y1="${y}" x2="40" y2="${y}"/>`;
      if (pin.clk) s += `<path d="M40 ${y - 8} L52 ${y} L40 ${y + 8}"/>`;
      s += `<text x="${pin.clk ? 56 : 48}" y="${y + 5}">${label(pin.name)}</text>`;
    });
    right.forEach((p, k) => {
      const y = pinY(k, right.length);
      s += `<line x1="120" y1="${y}" x2="148" y2="${y}"/><text x="112" y="${y + 5}" text-anchor="end">${label(p)}</text>`;
    });
    if (top) s += `<line x1="80" y1="${y0 - 28}" x2="80" y2="${y0 - 10}"/><circle cx="80" cy="${y0 - 5}" r="5"/><text x="90" y="${y0 - 18}">${label(top)}</text>`;
    if (bottom) s += `<line x1="80" y1="${yEnd + 10}" x2="80" y2="${yEnd + 28}"/><circle cx="80" cy="${yEnd + 5}" r="5"/><text x="90" y="${yEnd + 26}">${label(bottom)}</text>`;
    const capY = yEnd + (bottom ? 52 : 26);
    if (cap) s += `<text class="cap" x="80" y="${capY}" text-anchor="middle">${cap}</text>`;
    return `<svg class="sym" viewBox="0 0 160 ${capY + 8}" role="img" aria-label="สัญลักษณ์ ${cap || ""}">${s}</svg>`;
  }

  // Fully wired 4-bit register as an <svg> string: D flip-flops Q3…Q0, each fed by a 4-to-1 MUX. `wiring` gives what each
  // channel does, one letter per channel 0–3: H hold (own Q), L load (D), S shift right (bit to the left or Serial_in),
  // R rotate right (bit to the left or Q0). Every signal is a real wire with an arrow at its input end. Wires carry their
  // net for setLevels; `live` also adds a [data-mux] line per MUX for the caller to aim at the selected channel.
  function shiftRegister(wiring = "HLSR", { live = false } = {}) {
    const INK = 'stroke="#16191d" stroke-width="2"';
    const W = (net, d) => `<path class="wire" data-net="${net}" d="${d}"/>`;
    const DOT = (net, x, y) => `<circle class="dot" data-net="${net}" cx="${x}" cy="${y}" r="3.5"/>`;
    const TX = (str, x, y, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}">${str}</text>`;
    const ARROW = { r: (x, y) => `M${x} ${y} l-9 -5 v10 z`, u: (x, y) => `M${x} ${y} l-5 9 h10 z` };
    const TIP = (net, dir, x, y) => `<path class="dot" data-net="${net}" d="${ARROW[dir](x, y)}"/>`;
    const xs = [150, 375, 600, 825], last = xs[3], busS1 = 275, busS0 = 290, busClk = 305, wrap = 330;
    const chY = (op) => 125 + 30 * wiring.indexOf(op), yH = chY("H"), yL = chY("L"), yS = chY("S"), yR = chY("R");
    let s = W("Q0", `M${last + 185} 170 V${wrap} H${xs[0] - 50} V${yR} H${xs[0]}`) + TIP("Q0", "r", xs[0], yR);
    s += W("SI", `M${xs[0] - 90} ${yS} H${xs[0]}`) + TIP("SI", "r", xs[0], yS) + TX("Serial_in", xs[0] - 94, yS + 5, "end");
    s += DOT("Q0", last + 185, 170) + W("Q0", `M${last + 185} 170 H${last + 225}`) + TIP("Q0", "r", last + 225, 170) + TX("Serial_out", last + 192, 160);
    xs.forEach((x, i) => {
      const b = 3 - i, left = x - 40, q = `Q${b}`, d = `D${b}`, prev = `Q${b + 1}`, m = `M${i}`;
      s += W("CLK", `M${x + 62} ${busClk} V215 H${x + 80}`) + W("S1", `M${x + 14} ${busS1} V235`) + W("S0", `M${x + 30} ${busS0} V229`);
      s += `<path d="M${x} 100 L${x + 45} 118 V222 L${x} 240 Z" fill="#fff" ${INK}/>`;
      if (live) s += `<path class="wire" data-net="${m}" data-mux="${x}"/>`;
      [0, 1, 2, 3].forEach((k) => (s += TX(k, x + 10, 130 + k * 30)));
      s += TIP("S1", "u", x + 14, 235) + TIP("S0", "u", x + 30, 229);
      s += W(q, `M${x + 165} 170 H${x + 185} V30`) + W(m, `M${x + 45} 170 H${x + 80}`);
      s += `<rect x="${x + 80}" y="145" width="85" height="100" rx="4" fill="#fff" ${INK}/>` + TX("D", x + 88, 175) + TX(q, x + 157, 175, "end");
      s += `<path d="M${x + 80} 207 L${x + 92} 215 L${x + 80} 223" fill="none" ${INK}/>` + TX("Ck", x + 96, 220);
      s += TIP(m, "r", x + 80, 170) + TIP("CLK", "r", x + 80, 215) + TIP(q, "u", x + 185, 30) + TX(q, x + 178, 20, "middle");
      s += DOT(q, x + 185, 70) + W(q, `M${x + 185} 70 H${x - 12} V${yH} H${x}`) + TIP(q, "r", x, yH);
      s += W(d, `M${x - 26} 28 V${yL} H${x}`) + TIP(d, "r", x, yL) + TX(d, x - 18, 20, "middle");
      if (i) {
        s += W(prev, `M${left} 170 V${yS} H${x}`) + W(prev, `M${left} 170 V${yR} H${x}`) + DOT(prev, left, 170) + TIP(prev, "r", x, yS) + TIP(prev, "r", x, yR);
        // Junctions: anything above the Q tap branches off the Q line; below it, only the nearer of two branches.
        [yS, yR].filter((y) => y < 170).forEach((y) => (s += DOT(prev, left, y)));
        if (yS > 170 && yR > 170) s += DOT(prev, left, Math.min(yS, yR));
      }
      if (i < 3) s += DOT("S1", x + 14, busS1) + DOT("S0", x + 30, busS0) + DOT("CLK", x + 62, busClk);
    });
    s += W("S1", `M92 ${busS1} H${last + 14}`) + W("S0", `M92 ${busS0} H${last + 30}`) + W("CLK", `M92 ${busClk} H${last + 62}`);
    s += TX("SHSel₁", 88, busS1 + 5, "end") + TX("SHSel₀", 88, busS0 + 5, "end") + TX("Clock", 88, busClk + 5, "end");
    return `<svg class="schem" viewBox="-40 0 1160 ${wrap + 14}" role="img" aria-label="วงจร shift register 4 บิต D flip-flop และ MUX 4 ต่อ 1">${s}</svg>`;
  }

  // Combinational 4-bit shifter/rotator as an <svg> string. Each output has a 4-to-1 MUX (select s1 s0); `ch` gives what each
  // channel does, one letter per channel 0–3: P pass (own d), R right (bit to the left), L left (bit to the right).
  // The end bits take the small 2-to-1 MUXes (select s2): left feeds y3 on R, right feeds y0 on L. Each small MUX has a
  // constant `fill` on one input and the rotated bit on the other; `swap` moves the rotated bit to input 0.
  function shifterCircuit({ ch = "RPLP", left = { fill: 1 }, right = { fill: 0 } } = {}) {
    const INK = 'stroke="#16191d" stroke-width="2"';
    const W = (d) => `<path class="wire" d="${d}"/>`;
    const DOT = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="3.5"/>`;
    const TX = (str, x, y, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}">${str}</text>`;
    const ARROW = { r: (x, y) => `M${x} ${y} l-9 -5 v10 z`, d: (x, y) => `M${x} ${y} l-5 -9 h10 z` };
    const TIP = (dir, x, y) => `<path class="dot" d="${ARROW[dir](x, y)}"/>`;
    const xs = [200, 420, 640, 860], rail = [70, 100, 130, 160], muxTop = 290, feed = 276, busS2 = 258, busS1 = 386, busS0 = 402;
    const pin = (x, k) => x + [110, 80, 50, 20][k];
    const lx = 60, rx = 1040, smallTop = 190, smallBot = 232;
    const leftD0 = left.swap ? lx + 68 : lx + 22, leftFill = left.swap ? lx + 22 : lx + 68;
    const rightD3 = right.swap ? rx + 68 : rx + 22, rightFill = right.swap ? rx + 22 : rx + 68;
    let s = "";
    // Parallel inputs and their rails; d3 runs on to the right MUX, d0 back to the left MUX.
    s += W(`M170 ${rail[0]} H${rightD3} V${smallTop}`) + TIP("d", rightD3, smallTop);
    s += W(`M170 ${rail[1]} H${xs[3] + 125}`) + W(`M170 ${rail[2]} H${xs[3] + 125}`);
    s += W(`M${leftD0} ${smallTop} V${rail[3]} H${xs[3] + 125}`) + TIP("d", leftD0, smallTop);
    xs.forEach((x, i) => {
      const b = 3 - i;
      s += W(`M${x + 65} 28 V${rail[i]}`) + DOT(x + 65, rail[i]) + TX(`d${b}`, x + 65, 20, "middle");
      [...ch].forEach((op, k) => {
        const px = pin(x, k), from = op === "P" ? i : op === "R" ? i - 1 : i + 1;
        if (from >= 0 && from <= 3) s += W(`M${px} ${rail[from]} V${muxTop}`) + DOT(px, rail[from]);
        else if (from < 0) s += W(`M${lx + 45} ${smallBot} V${feed} H${px} V${muxTop}`);
        else s += W(`M${rx + 45} ${smallBot} V${feed} H${px} V${muxTop}`);
        s += TIP("d", px, muxTop);
      });
      s += `<path d="M${x} ${muxTop} H${x + 130} L${x + 112} ${muxTop + 60} H${x + 18} Z" fill="#fff" ${INK}/>`;
      [0, 1, 2, 3].forEach((k) => (s += TX(k, pin(x, k), muxTop + 20, "middle")));
      s += W(`M${x - 34} ${busS1} V${muxTop + 26} H${x + 8}`) + TIP("r", x + 8, muxTop + 26) + TX("s1", x + 16, muxTop + 40);
      s += W(`M${x - 16} ${busS0} V${muxTop + 44} H${x + 14}`) + TIP("r", x + 14, muxTop + 44) + TX("s0", x + 34, muxTop + 54);
      s += W(`M${x + 65} ${muxTop + 60} V436`) + TIP("d", x + 65, 436) + TX(`y${b}`, x + 65, 456, "middle");
      if (i < 3) s += DOT(x - 34, busS1) + DOT(x - 16, busS0);
    });
    // Small MUXes with their fill constants.
    [[lx, leftFill, left.fill], [rx, rightFill, right.fill]].forEach(([x, px, fill]) => {
      s += W(`M${px} 128 V${smallTop}`) + TX(fill, px, 120, "middle") + TIP("d", px, smallTop);
      s += `<path d="M${x} ${smallTop} H${x + 90} L${x + 76} ${smallBot} H${x + 14} Z" fill="#fff" ${INK}/>`;
      s += TX(1, x + 22, smallTop + 18, "middle") + TX(0, x + 68, smallTop + 18, "middle");
    });
    s += W(`M28 ${busS2} H${rx - 26} V211 H${rx + 7}`) + TIP("r", rx + 7, 211) + W(`M${lx - 22} ${busS2} V211 H${lx + 7}`) + TIP("r", lx + 7, 211) + DOT(lx - 22, busS2);
    s += W(`M28 ${busS1} H${xs[3] - 34}`) + W(`M28 ${busS0} H${xs[3] - 16}`);
    s += TX("s2", 22, busS2 + 5, "end") + TX("s1", 22, busS1 + 5, "end") + TX("s0", 22, busS0 + 5, "end");
    return `<svg class="schem" viewBox="-14 0 1170 470" role="img" aria-label="วงจร shifter 4 บิต MUX 4 ต่อ 1 สี่ตัว และ MUX 2 ต่อ 1 สองตัว">${s}</svg>`;
  }

  // Four 4-to-1 MUXes side by side. wiring[i] lists what channels 0–3 of the MUX for out(3 − i) connect to: "in3"…"in0", "0" or "1".
  function muxArray(wiring) {
    const INK = 'stroke="#16191d" stroke-width="2"';
    const W = (d, tap = "") => `<path class="wire"${tap ? ` data-tap="${tap}"` : ""} d="${d}"/>`;
    const DOT = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="3.5"/>`;
    const TX = (str, x, y, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}">${str}</text>`;
    const ARROW = { r: (x, y) => `M${x} ${y} l-9 -5 v10 z`, d: (x, y) => `M${x} ${y} l-5 -9 h10 z` };
    const TIP = (dir, x, y) => `<path class="dot" d="${ARROW[dir](x, y)}"/>`;
    const xs = [60, 300, 540, 780], rail = [52, 78, 104, 130], muxTop = 214, busS1 = 326, busS0 = 342;
    const pin = (x, c) => x + [110, 80, 50, 20][c];
    const reach = rail.map((_, i) => [xs[i] + 65, xs[i] + 65]);
    let taps = "";
    wiring.forEach((chs, i) => chs.forEach((src, c) => {
      const px = pin(xs[i], c), from = src.startsWith("in") ? 3 - +src[2] : -1;
      if (from >= 0) {
        taps += W(`M${px} ${rail[from]} V${muxTop}`, `out${3 - i}.${c}=${src}`) + DOT(px, rail[from]) + TIP("d", px, muxTop);
        reach[from] = [Math.min(reach[from][0], px), Math.max(reach[from][1], px)];
      } else taps += W(`M${px} ${muxTop - 44} V${muxTop}`, `out${3 - i}.${c}=${src}`) + TX(src, px, muxTop - 50, "middle") + TIP("d", px, muxTop);
    }));
    let s = "";
    xs.forEach((x, i) => {
      s += W(`M${x + 65} 28 V${rail[i]}`) + TX(`in${3 - i}`, x + 65, 20, "middle");
      s += W(`M${reach[i][0]} ${rail[i]} H${reach[i][1]}`);
    });
    s += taps;
    xs.forEach((x, i) => {
      s += DOT(x + 65, rail[i]);
      s += `<path d="M${x} ${muxTop} H${x + 130} L${x + 112} ${muxTop + 60} H${x + 18} Z" fill="#fff" ${INK}/>`;
      [0, 1, 2, 3].forEach((c) => (s += TX(c, pin(x, c), muxTop + 20, "middle")));
      s += W(`M${x - 34} ${busS1} V${muxTop + 26} H${x + 8}`) + TIP("r", x + 8, muxTop + 26) + TX("s1", x + 16, muxTop + 40);
      s += W(`M${x - 16} ${busS0} V${muxTop + 44} H${x + 14}`) + TIP("r", x + 14, muxTop + 44) + TX("s0", x + 34, muxTop + 54);
      s += W(`M${x + 65} ${muxTop + 60} V366`) + TIP("d", x + 65, 366) + TX(`out${3 - i}`, x + 65, 386, "middle");
      if (i < 3) s += DOT(x - 34, busS1) + DOT(x - 16, busS0);
    });
    s += W(`M2 ${busS1} H${xs[3] - 34}`) + W(`M2 ${busS0} H${xs[3] - 16}`) + TX("s1", -4, busS1 + 5, "end") + TX("s0", -4, busS0 + 5, "end");
    return `<svg class="schem" viewBox="-34 0 960 398" role="img" aria-label="วงจร MUX 4 ต่อ 1 สี่ตัว">${s}</svg>`;
  }

  // A tree of 2-to-1 MUXes. sel[L] drives every MUX of level L (0 is next to the data); data lists the inputs, top to bottom.
  function muxTree({ sel, data, out = "y" }) {
    const INK = 'stroke="#16191d" stroke-width="2"';
    const W = (d) => `<path class="wire" d="${d}"/>`;
    const DOT = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="3.5"/>`;
    const TX = (str, x, y, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}">${str}</text>`;
    const TIPR = (x, y) => `<path class="dot" d="M${x} ${y} l-9 -5 v10 z"/>`, TIPU = (x, y) => `<path class="dot" d="M${x} ${y} l-5 9 h10 z"/>`;
    const n = sel.length, gap = 88, colX = (L) => 120 + 170 * L, count = (L) => 1 << (n - 1 - L);
    const ys = [Array.from({ length: count(0) }, (_, i) => 46 + i * gap)];
    for (let L = 1; L < n; L++) ys.push(Array.from({ length: count(L) }, (_, i) => (ys[L - 1][2 * i] + ys[L - 1][2 * i + 1]) / 2));
    const bottom = ys[0].at(-1) + 56, railY = sel.map((_, L) => bottom + 22 * (n - 1 - L));
    let wires = "", bodies = "";
    ys.forEach((col, L) => {
      const x = colX(L), xb = x - 20;
      wires += W(`M34 ${railY[L]} H${xb} V${col[0] + 42}`) + TX(sel[L], 28, railY[L] + 5, "end");
      col.forEach((y, i) => {
        [0, 1].forEach((b) => {
          const py = y + (b ? 15 : -15);
          if (L === 0) wires += W(`M${x - 58} ${py} H${x}`) + TX(data[2 * i + b], x - 64, py + 5, "end");
          else { const cy = ys[L - 1][2 * i + b], cx = colX(L - 1) + 44; wires += W(`M${cx} ${cy} H${x - 44} V${py} H${x}`); }
          wires += TIPR(x, py);
        });
        wires += W(`M${xb} ${y + 42} H${x + 22} V${y + 24}`) + DOT(xb, y + 42) + TIPU(x + 22, y + 24);
        bodies += `<path d="M${x} ${y - 30} L${x + 44} ${y - 14} V${y + 14} L${x} ${y + 30} Z" fill="#fff" ${INK}/>` + TX(0, x + 5, y - 10) + TX(1, x + 5, y + 20);
      });
    });
    const last = colX(n - 1) + 44, end = ys[n - 1][0];
    wires += W(`M${last} ${end} H${last + 44}`) + TIPR(last + 44, end) + TX(out, last + 52, end + 5);
    return `<svg class="schem" viewBox="-6 0 ${last + 90} ${railY[0] + 16}" role="img" aria-label="วงจร MUX 2 ต่อ 1 ซ้อนกัน">${wires}${bodies}</svg>`;
  }

  // ---------- Karnaugh maps (variables D C B A, rows BA, columns DC) ----------

  const KMAP_VARS = ["D", "C", "B", "A"];
  const GRAY = { 0: [0], 1: [0, 1], 2: [0, 1, 3, 2] };
  // Rows take the low bits, columns the high bits.
  // n = 4: rows BA, columns DC · n = 3: rows BA, columns C · n = 2: rows A, columns B.
  const kmapBits = (n) => ({ rowBits: n === 2 ? 1 : 2, colBits: n === 4 ? 2 : 1 });
  const kmapNames = (n) => KMAP_VARS.slice(4 - n);

  // A cube is { v, m }: the bits in m are free, the others equal v.
  const inCube = (cube, i) => (i & ~cube.m) === cube.v;

  const kmapLits = (n, c) => n - c.m.toString(2).replace(/0/g, "").length;

  // Prime implicants: cubes of 1s and ×s that cover at least one 1 and cannot grow. Largest first.
  function kmapPrimes(n, ones, dcs = []) {
    const size = 1 << n, ok = new Set([...ones, ...dcs]);
    const valid = (c) => { for (let i = 0; i < size; i++) if (inCube(c, i) && !ok.has(i)) return false; return true; };
    const primes = [];
    for (let m = 0; m < size; m++) {
      for (let v = 0; v < size; v++) {
        if (v & m) continue;
        const c = { v, m };
        if (!valid(c) || !ones.some((i) => inCube(c, i))) continue;
        let prime = true;
        for (let b = 1; b < size; b <<= 1) if (!(m & b) && valid({ v: v & ~b, m: m | b })) prime = false;
        if (prime) primes.push(c);
      }
    }
    return primes.sort((a, b) => kmapLits(n, a) - kmapLits(n, b) || a.v - b.v);
  }

  // Exact minimum cover: fewest terms, then fewest literals. Returns the terms largest first.
  function kmapCover(n, ones, dcs = []) {
    const primes = kmapPrimes(n, ones, dcs);
    const lits = (c) => kmapLits(n, c);
    let best = null;
    const walk = (chosen, left) => {
      const cost = chosen.reduce((a, c) => a + lits(c), 0);
      if (best && (chosen.length > best.terms.length || (chosen.length === best.terms.length && cost >= best.cost))) return;
      if (!left.length) { best = { terms: [...chosen], cost }; return; }
      // Branch on the 1 with the fewest primes covering it.
      let pick = null;
      left.forEach((i) => { const c = primes.filter((p) => inCube(p, i)); if (!pick || c.length < pick.length) pick = c; });
      [...pick].sort((a, b) => lits(a) - lits(b)).forEach((p) => walk([...chosen, p], left.filter((i) => !inCube(p, i))));
    };
    walk([], [...ones]);
    return best.terms.sort((a, b) => lits(a) - lits(b) || a.v - b.v);
  }

  // Prime implicant analysis. essential: PIs that are the only cover of some 1 (alone maps PI index → those 1s).
  // left: 1s the essentials miss. choices: every minimum way to cover them (one list of PIs each).
  function kmapPrimeInfo(n, ones, dcs = []) {
    const primes = kmapPrimes(n, ones, dcs), alone = new Map();
    ones.forEach((i) => { const c = primes.filter((p) => inCube(p, i)); if (c.length === 1) alone.set(c[0], [...(alone.get(c[0]) || []), i]); });
    const essential = primes.filter((p) => alone.has(p)), rest = primes.filter((p) => !alone.has(p));
    const left = ones.filter((i) => !essential.some((p) => inCube(p, i)));
    let choices = [];
    if (rest.length <= 16) {
      let best = Infinity;
      for (let mask = 0; mask < 1 << rest.length; mask++) {
        const pick = rest.filter((_, k) => mask & (1 << k));
        if (!left.every((i) => pick.some((p) => inCube(p, i)))) continue;
        const cost = pick.length * 100 + pick.reduce((a, c) => a + kmapLits(n, c), 0);
        if (cost < best) { best = cost; choices = []; }
        if (cost === best) choices.push(pick);
      }
    }
    return { primes, essential, alone, left, choices };
  }

  // Power set of the PIs, smallest subsets first. `locked` PIs (normally the essentials) join every subset, so only
  // the others are enumerated. Each row: { pick, covered, full, best }. Empty when there are too many PIs to list.
  function kmapPowerSet(n, ones, dcs = [], locked = []) {
    const pool = kmapPrimes(n, ones, dcs).filter((p) => !locked.includes(p) && !locked.some((q) => q.v === p.v && q.m === p.m));
    if (pool.length > 16) return [];
    const rows = [];
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const pick = [...locked, ...pool.filter((_, k) => mask & (1 << k))], covered = ones.filter((i) => pick.some((p) => inCube(p, i)));
      rows.push({ pick, covered, full: covered.length === ones.length, cost: pick.length * 100 + pick.reduce((a, c) => a + kmapLits(n, c), 0) });
    }
    const least = Math.min(...rows.filter((r) => r.full).map((r) => r.cost));
    rows.forEach((r) => (r.best = r.full && r.cost === least));
    return rows.sort((a, b) => a.pick.length - b.pick.length);
  }

  const kmapTerm = (n, c) => {
    const names = kmapNames(n), t = names.flatMap((x, k) => { const b = 1 << (n - 1 - k); return c.m & b ? [] : [c.v & b ? x : `${x}′`]; });
    return t.join("") || "1";
  };
  const kmapSum = (n, c) => {
    const names = kmapNames(n), t = names.flatMap((x, k) => { const b = 1 << (n - 1 - k); return c.m & b ? [] : [c.v & b ? `${x}′` : x]; });
    return t.length > 1 ? `(${t.join(" + ")})` : t[0] || "0";
  };
  const kmapSOP = (n, terms) => (terms.length ? terms.map((c) => kmapTerm(n, c)).join(" + ") : "0");
  const kmapPOS = (n, terms) => (terms.length ? terms.map((c) => kmapSum(n, c)).join("") : "1");

  const KMAP_COLORS = ["#d9480f", "#2f4fd8", "#1b8a4b", "#a8329e", "#a87b00", "#0e8a9a", "#b3263a", "#5b5bd6"];
  // cells: array of "0" | "1" | "×" by minterm number. groups: cubes to outline. live: cells are focusable buttons.
  function kmapSvg(n, cells, { groups = [], live = false, numbers = true, scale = 1.05 } = {}) {
    const { rowBits, colBits } = kmapBits(n), rows = GRAY[rowBits], cols = GRAY[colBits], names = kmapNames(n);
    const code = (v, bits) => v.toString(2).padStart(bits, "0");
    const size = 58, x0 = 74, y0 = 62, width = x0 + cols.length * size + 8, height = y0 + rows.length * size + 8;
    let s = `<text class="km-axis" x="${x0 + (cols.length * size) / 2}" y="16" text-anchor="middle">${names.slice(0, colBits).join("")}</text>`;
    s += `<text class="km-axis" x="14" y="${y0 + (rows.length * size) / 2 + 5}" text-anchor="middle">${names.slice(colBits).join("")}</text>`;
    cols.forEach((c, j) => (s += `<text class="km-head" x="${x0 + j * size + size / 2}" y="${y0 - 12}" text-anchor="middle">${code(c, colBits)}</text>`));
    rows.forEach((r, i) => (s += `<text class="km-head" x="${x0 - 12}" y="${y0 + i * size + size / 2 + 5}" text-anchor="end">${code(r, rowBits)}</text>`));
    let marks = ""; // cell text goes last so group outlines never cover it
    rows.forEach((r, i) => cols.forEach((c, j) => {
      const id = (c << rowBits) | r, x = x0 + j * size, y = y0 + i * size, val = cells[id];
      s += `<rect class="km-cell" x="${x}" y="${y}" width="${size}" height="${size}"${live ? ` data-cell="${id}" tabindex="0" role="button" aria-label="ช่อง ${id} ค่า ${val}"` : ""}/>`;
      if (numbers) marks += `<text class="km-num" x="${x + size - 5}" y="${y + 13}" text-anchor="end">${id}</text>`;
      marks += `<text class="km-val${val === "0" ? " zero" : ""}" x="${x + size / 2}" y="${y + size / 2 + 8}" text-anchor="middle">${val}</text>`;
    }));
    // A group that wraps around an edge is one rectangle per contiguous run of rows and columns.
    const runs = (idx) => { const out = []; idx.forEach((v) => { const last = out.at(-1); if (last && last[1] === v - 1) last[1] = v; else out.push([v, v]); }); return out; };
    groups.forEach((c, g) => {
      const on = (i, j) => inCube(c, (cols[j] << rowBits) | rows[i]);
      const useRows = rows.map((_, i) => i).filter((i) => cols.some((_, j) => on(i, j)));
      const useCols = cols.map((_, j) => j).filter((j) => rows.some((_, i) => on(i, j)));
      const inset = 5 + (g % 4) * 3, color = KMAP_COLORS[g % KMAP_COLORS.length];
      runs(useRows).forEach(([r0, r1]) => runs(useCols).forEach(([c0, c1]) => {
        s += `<rect class="km-group" x="${x0 + c0 * size + inset}" y="${y0 + r0 * size + inset}" width="${(c1 - c0 + 1) * size - 2 * inset}" height="${(r1 - r0 + 1) * size - 2 * inset}" rx="14" style="stroke:${color};fill:${color}"/>`;
      }));
    });
    return `<svg class="kmap" viewBox="0 0 ${width} ${height}" style="max-width:${Math.round(width * scale)}px" role="img" aria-label="K-map ${names.join("")}">${s}${marks}</svg>`;
  }

  // ---------- Seven-segment display and rail-style gate circuits ----------

  // Values 0–F as "abcdefg" (1 = lit). 6 keeps its top bar so it differs from b; 9 lights d.
  const SEG7_HEX = ["1111110", "0110000", "1101101", "1111001", "0110011", "1011011", "1011111", "1110000", "1111111", "1111011", "1110111", "0011111", "1001110", "0111101", "1001111", "1000111"];
  const SEG7_GLYPH = "0123456789AbCdEF";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const hbar = (y) => `12,${y} 17,${y - 5} 43,${y - 5} 48,${y} 43,${y + 5} 17,${y + 5}`;
  const vbar = (x, y1, y2) => `${x},${y1} ${x + 5},${y1 + 5} ${x + 5},${y2 - 5} ${x},${y2} ${x - 5},${y2 - 5} ${x - 5},${y1 + 5}`;
  const BARS = [hbar(10), vbar(50, 12, 48), vbar(50, 52, 88), hbar(90), vbar(10, 52, 88), vbar(10, 12, 48), hbar(50)];
  const NAME_AT = [[30, 14], [50, 35], [50, 75], [30, 94], [10, 75], [10, 35], [30, 54]];
  // bits: "abcdefg" as a string of 0 and 1.
  function seg7(bits, { size = 30, names = false } = {}) {
    const bars = BARS.map((p, k) => `<polygon class="${bits[k] === "1" ? "on" : ""}" points="${p}"/>`).join("");
    const text = names ? NAME_AT.map(([x, y], k) => `<text x="${x}" y="${y}" text-anchor="middle">${"abcdefg"[k]}</text>`).join("") : "";
    return `<svg class="seg7" viewBox="0 0 60 100" style="width:${size}px" role="img" aria-label="จอ 7-segment">${bars}${text}</svg>`;
  }

  // A circuit is { inputs, outputs: [{ name, terms | constant }], pitch?, compact? }.
  // A term is a literal ("C′") or a gate (["and" | "xor" | "xnor", ...literals]).
  const litsOf = (term) => (Array.isArray(term) ? term.slice(1) : [term]);

  // Every wire of a circuit: input literals, gate outputs ("a.2") and outputs ("a").
  function circuitLevels(cfg, inp) {
    const lv = {};
    cfg.inputs.forEach((n) => { lv[n] = inp[n]; lv[`${n}′`] = 1 - inp[n]; });
    cfg.outputs.forEach((o) => {
      if (o.constant !== undefined) { lv[o.name] = o.constant; return; }
      const vals = o.terms.map((t, i) => {
        if (!Array.isArray(t)) return lv[t];
        const [op, ...xs] = t, v = xs.map((x) => lv[x]);
        const out = op === "and" ? (v.every(Boolean) ? 1 : 0) : op === "xor" ? v[0] ^ v[1] : 1 - (v[0] ^ v[1]);
        lv[`${o.name}.${i}`] = out;
        return out;
      });
      lv[o.name] = vals.some(Boolean) ? 1 : 0;
    });
    return lv;
  }

  // Vertical rails (each input and its complement), first-level gates, then an OR per output.
  function railCircuit(cfg) {
    const { inputs, outputs, pitch = 22, compact = false } = cfg, used = new Set(outputs.flatMap((o) => (o.terms || []).flatMap(litsOf)));
    const rail = {}, wires = [], gates = [], labels = [], dots = [], reach = {};
    let x = 20;
    inputs.forEach((n) => { rail[n] = x; x += pitch; if (used.has(`${n}′`)) { rail[`${n}′`] = x; x += pitch; } x += 6; });
    const hasNot = inputs.some((n) => used.has(`${n}′`)), gx = x + 4, most = Math.max(1, ...outputs.map((o) => (o.terms || []).length));
    const gateW = compact ? 34 : 46, gateH = compact ? 24 : 40, slot = compact ? 28 : 44;
    const ox = gx + gateW + 14 + 12 * Math.ceil(most / 2), outX = (most > 1 ? ox + 46 : gx + 56) + 26;
    const W = (net, d) => wires.push(`<path class="wire" data-net="${esc(net)}" d="${d}"/>`);
    const tap = (lit, y) => { dots.push(`<circle class="dot" data-net="${esc(lit)}" cx="${rail[lit]}" cy="${y}" r="3.5"/>`); reach[lit] = Math.max(reach[lit] || 0, y); };
    const PINS = compact ? { 2: [6, 18], 3: [4, 12, 20], 4: [3, 9, 15, 21] } : { 2: [10, 30], 3: [8, 20, 32], 4: [5, 15, 25, 35] };
    let y = hasNot ? 92 : 40;

    outputs.forEach((o) => {
      if (o.constant !== undefined) { // tied to 0 or 1: no gates, just the fixed level
        const cy = y + 14;
        labels.push(`<text x="${gx}" y="${cy + 5}">${o.constant}</text>`);
        W(o.name, `M${gx + 14} ${cy} H${outX - 6}`);
        dots.push(`<path class="dot" data-net="${esc(o.name)}" d="M${outX - 8} ${cy - 5} L${outX} ${cy} L${outX - 8} ${cy + 5} Z"/>`);
        labels.push(`<text x="${outX + 6}" y="${cy + 5}">${esc(o.name)}</text>`);
        y += 42;
        return;
      }
      const slots = o.terms.map((t) => (Array.isArray(t) ? slot : 18)), height = Math.max(44, slots.reduce((a, b) => a + b, 0));
      const cy = y + height / 2, n = o.terms.length, gapPin = n <= 2 ? 20 : n === 3 ? 12 : n === 4 ? 10 : n <= 6 ? 7 : 5;
      let top = y + (height - slots.reduce((a, b) => a + b, 0)) / 2;
      const routes = o.terms.map((t, i) => {
        const pin = cy + (i - (n - 1) / 2) * gapPin;
        if (!Array.isArray(t)) { const wy = top + 9; top += 18; tap(t, wy); return { net: t, sx: rail[t], wy, pin }; }
        const [op, ...xs] = t, gy = top + (slot - gateH) / 2, wy = gy + gateH / 2, xor = op !== "and", net = n > 1 ? `${o.name}.${i}` : o.name;
        top += slot;
        xs.forEach((lit, k) => { const py = gy + PINS[xs.length][k]; tap(lit, py); W(lit, `M${rail[lit]} ${py} H${gx + 2}`); });
        if (xor) {
          const bubble = op === "xnor" ? `<circle cx="51" cy="20" r="5"/>` : "";
          gates.push(`<g class="gate"><path d="M${gx - 5} ${gy} C${gx + 5} ${gy + 10} ${gx + 5} ${gy + 30} ${gx - 5} ${gy + 40}" style="fill:none"/></g>`);
          gates.push(gate("or", gx + 6, gy).replace("</g>", `${bubble}</g>`));
        } else if (compact) gates.push(`<g class="gate"><path d="M${gx} ${gy} H${gx + 22} A12 12 0 0 1 ${gx + 22} ${gy + 24} H${gx} Z"/></g>`);
        else gates.push(gate("and", gx, gy));
        return { net, sx: gx + (op === "and" ? gateW : op === "xor" ? 52 : 56), wy, pin };
      });
      if (n === 1) {
        const r = routes[0];
        W(o.name, `M${r.sx} ${r.wy} H${outX - 6}`);
      } else {
        const above = routes.filter((r) => r.wy < r.pin), below = routes.filter((r) => r.wy > r.pin).reverse();
        [above, below].forEach((side) => side.forEach((r, rank) => (r.bx = ox - 8 - 12 * rank)));
        routes.forEach((r) => W(r.net, r.wy === r.pin ? `M${r.sx} ${r.wy} H${ox + 8}` : `M${r.sx} ${r.wy} H${r.bx} V${r.pin} H${ox + 8}`));
        gates.push(gate("or", ox, cy - 20));
        W(o.name, `M${ox + 46} ${cy} H${outX - 6}`);
      }
      dots.push(`<path class="dot" data-net="${esc(o.name)}" d="M${outX - 8} ${cy - 5} L${outX} ${cy} L${outX - 8} ${cy + 5} Z"/>`);
      labels.push(`<text x="${outX + 6}" y="${cy + 5}">${esc(o.name)}</text>`);
      y += height + 14;
    });

    inputs.forEach((n) => {
      const px = rail[n], rn = rail[`${n}′`];
      labels.push(`<text x="${px}" y="16" text-anchor="middle">${esc(n)}</text>`);
      W(n, `M${px} 24 V${Math.max(reach[n] || 0, 34)}`);
      if (rn === undefined) return;
      if (reach[n] > 34) dots.push(`<circle class="dot" data-net="${esc(n)}" cx="${px}" cy="34" r="3.5"/>`);
      W(n, `M${px} 34 H${rn} V42`);
      gates.push(`<g class="gate"><path d="M${rn - 9} 42 L${rn + 9} 42 L${rn} 60 Z"/><circle cx="${rn}" cy="64" r="4"/></g>`);
      W(`${n}′`, `M${rn} 68 V${reach[`${n}′`]}`);
      labels.push(`<text class="cc-not" x="${rn + 4}" y="82">${esc(n)}′</text>`);
    });
    const wide = Math.max(...outputs.map((o) => o.name.length));
    return `<svg class="schem rail sim-schem" viewBox="0 0 ${outX + 14 + wide * 10} ${y - 4}" role="img" aria-label="วงจรเกต">${wires.join("")}${dots.join("")}${gates.join("")}${labels.join("")}</svg>`;
  }

  // One output of a circuit from K-map cubes: a single literal stays a wire, an empty cover or a full cube is a constant.
  function kmapRailOutput(n, name, cubes) {
    if (!cubes.length) return { name, constant: 0 };
    const names = kmapNames(n), lits = (c) => names.flatMap((x, k) => { const b = 1 << (n - 1 - k); return c.m & b ? [] : [c.v & b ? x : `${x}′`]; });
    if (cubes.some((c) => !lits(c).length)) return { name, constant: 1 };
    return { name, terms: cubes.map((c) => (lits(c).length === 1 ? lits(c)[0] : ["and", ...lits(c)])) };
  }

  // ---------- Exercises ----------

  // Timing-diagram drills: <svg data-exercise=id>, <button data-reveal=id>, <div data-answer=id hidden>.
  // defs: { id: { rows, signals, hide, opts, minStep } }
  function exercises(defs) {
    Object.entries(defs).forEach(([id, ex]) => {
      const svg = document.querySelector(`[data-exercise="${id}"]`);
      const btn = document.querySelector(`[data-reveal="${id}"]`);
      const answer = document.querySelector(`[data-answer="${id}"]`);
      let revealed = false;
      const draw = () =>
        wave(svg, ex.signals, ex.rows, {
          ...ex.opts,
          hide: revealed ? [] : ex.hide,
          step: fitStep(svg.parentElement, ex.rows.length, ex.minStep),
        });
      window.addEventListener("resize", draw);
      btn.addEventListener("click", () => {
        revealed = !revealed;
        btn.textContent = revealed ? "ซ่อนเฉลย" : "ดูเฉลย";
        answer.hidden = !revealed;
        draw();
      });
      draw();
    });
  }

  // ---------- Flip-flop simulator ----------

  // Interactive clocked element. modes: { key: {
  //   tab, symbol (svg string), inputs: [[key, name]], start, init (state), step(prev, inputs, state) → state,
  //   outs: [[key, name]] (default Q, Q′), pulse: clock key, head, rows,
  //   row(prevInputs, inputs, state, prevState) → index of the table row to highlight (-1 for none),
  //   describe(prev, inputs, state) → [text, "set" | "bad" | ""] } }
  function ffSim(root, modes) {
    const keys = Object.keys(modes);
    root.classList.add("sim");
    root.innerHTML = `
      ${keys.length > 1 ? `<div class="tabs" role="tablist" aria-label="ชนิดวงจร">${keys.map((k) => `<button role="tab" type="button" data-mode="${k}">${modes[k].tab}</button>`).join("")}</div>` : ""}
      <div class="sim-grid">
        <div>
          <div class="sim-symbol"></div>
          <div class="sim-inputs"></div>
        </div>
        <div>
          <div class="outs">
            <div class="out"><span>Q</span><b data-out="Q"></b></div>
            <div class="out"><span>Q′</span><b data-out="Qn"></b></div>
          </div>
          <p class="sim-status" aria-live="polite"></p>
          <div class="table-scroll"><table class="tt sim-table"></table></div>
        </div>
      </div>
      <div class="sim-wave-head"><h4>Timing diagram ของการกดล่าสุด</h4><button class="btn" type="button" data-reset>เริ่มใหม่</button></div>
      <div class="wave-scroll"><svg class="sim-wave" role="img" aria-label="timing diagram ของการกดล่าสุด"></svg></div>`;

    const $ = (sel) => root.querySelector(sel);
    const MAX_STEPS = 16;
    let M, inp, st, hist, msg, hl;

    const shown = (v) => (v === null ? "?" : String(v));
    const cls = (v) => (v === 1 ? "hi" : v === null ? "x" : "");
    const row = () => ({ ...inp, ...st, Qn: NOT(st.Q) });

    function setMode(k) {
      M = modes[k];
      root.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === k));
      root.dataset.mode = k;
      $(".sim-symbol").innerHTML = M.symbol || "";
      inp = { ...M.start };
      st = { ...M.init };
      hist = [row()];
      msg = ["กดปุ่ม input เพื่อเริ่ม", ""];
      hl = M.row(inp, inp, st, st);
      $(".sim-inputs").innerHTML =
        M.inputs.map(([key, name]) => `<button class="sw" type="button" data-in="${key}"><span class="sw-name">${label(name)}</span><span class="sw-val"></span></button>`).join("") +
        (M.pulse ? `<button class="btn" type="button" data-pulse>ส่ง clock 1 ลูก (0→1→0)</button>` : "");
      $(".sim-table").innerHTML =
        `<thead><tr>${M.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
        M.rows.map((r) => `<tr>${r.map((c, j) => `<td${j === r.length - 1 ? ' class="txt"' : ""}>${c}</td>`).join("")}</tr>`).join("") +
        "</tbody>";
      render();
    }

    function toggle(key) {
      const prev = { ...inp };
      const before = st;
      inp[key] ^= 1;
      st = M.step(prev, inp, st);
      hist.push(row());
      if (hist.length > MAX_STEPS) hist.shift();
      msg = M.describe(prev, inp, st);
      hl = M.row(prev, inp, st, before);
    }

    function render() {
      $(".sim-inputs").querySelectorAll(".sw").forEach((b) => {
        const v = inp[b.dataset.in];
        b.setAttribute("aria-pressed", v === 1);
        b.querySelector(".sw-val").textContent = v;
      });
      const q = st.Q, qn = NOT(st.Q);
      $('[data-out="Q"]').textContent = shown(q);
      $('[data-out="Q"]').className = cls(q);
      $('[data-out="Qn"]').textContent = shown(qn);
      $('[data-out="Qn"]').className = cls(qn);
      $(".sim-status").textContent = msg[0];
      $(".sim-status").className = "sim-status" + (msg[1] ? " " + msg[1] : "");
      $(".sim-table").querySelectorAll("tbody tr").forEach((tr, j) => tr.classList.toggle("on", j === hl));
      const signals = M.inputs.map(([key, name]) => ({ key, name }));
      (M.outs || [["Q", "Q"], ["Qn", "~Q"]]).forEach(([key, name]) => signals.push({ key, name, out: true }));
      const svg = $(".sim-wave");
      wave(svg, signals, hist, { step: 32 });
      svg.parentElement.scrollLeft = svg.parentElement.scrollWidth;
    }

    root.addEventListener("click", (e) => {
      const tab = e.target.closest("[role=tab]");
      if (tab) return setMode(tab.dataset.mode);
      const sw = e.target.closest("[data-in]");
      if (sw) {
        toggle(sw.dataset.in);
        return render();
      }
      if (e.target.closest("[data-pulse]")) {
        toggle(M.pulse);
        const first = [msg, hl];
        toggle(M.pulse);
        // Report whichever half of the pulse was the active edge.
        if (first[0][1] === "set" || msg[1] !== "set") [msg, hl] = first;
        return render();
      }
      if (e.target.closest("[data-reset]")) setMode(root.dataset.mode);
    });

    setMode(keys[0]);
  }

  global.LK = {
    NOT, AND, OR, NAND, NOR, settle, label, gate, schematic, setLevels, wave, fitStep, tocSpy,
    steps, pulses, isEdge, simulate, byQ, twoState, ffSymbol, shiftRegister, shifterCircuit, muxArray, muxTree, kmapPrimes, kmapPrimeInfo, kmapPowerSet, kmapCover, kmapTerm, kmapSOP, kmapPOS, kmapSvg, kmapNames, inCube, KMAP_COLORS, SEG7_HEX, SEG7_GLYPH, seg7, circuitLevels, railCircuit, kmapRailOutput, exercises, ffSim,
  };
})(window);
