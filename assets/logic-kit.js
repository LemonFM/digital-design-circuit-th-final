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
    steps, pulses, isEdge, simulate, byQ, twoState, ffSymbol, exercises, ffSim,
  };
})(window);
