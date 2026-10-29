// Vernacular Anywhere: a culture check for any text box on any page.
// Shared by the browser extension (content script) and the /anywhere demo page.
// It never edits the page's own markup: its UI lives in a closed shadow root, and
// it only changes a field's text when you press "Use" on a suggestion.
(function () {
  if (window.__vernacularAnywhere) return;
  window.__vernacularAnywhere = true;

  const PRESETS = [
    ["genz-latin", "Gen Z Latin-pop fans"],
    ["hiphop-30s", "30–34 hip-hop heads"],
    ["indie-25", "25–29 indie & A24 fans"],
    ["country-45", "45–54 country fans"],
    ["classic-55", "55+ classic-rock fans"],
  ];
  const COLORS = { lands: "#1d7f47", mixed: "#a86a12", misses: "#c0391b", unmeasured: "#8a90a0" };
  const MIN_CHARS = 30;
  const IDLE_MS = 1800;

  const cfg = Object.assign(
    { api: "https://vernacular-lime.vercel.app", app: "https://vernacular-lime.vercel.app", audience: "genz-latin", saveAudience: null },
    window.VernacularAnywhereConfig || {},
  );

  // ---- UI shell (shadow DOM so page styles can't reach it, and ours can't leak) ----
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .pill { position: fixed; display: none; align-items: center; gap: 6px; padding: 5px 10px 5px 8px; border-radius: 999px;
        background: #10132a; color: #f3f4fb; font-size: 12px; border: 0; cursor: pointer; box-shadow: 0 4px 14px rgba(16,19,42,.25); }
      .pill .dot { width: 8px; height: 8px; border-radius: 50%; background: #8d9cff; }
      .pill.busy .dot { animation: pulse 1s ease-in-out infinite; }
      @keyframes pulse { 50% { opacity: .3 } }
      .panel { position: fixed; display: none; width: 340px; max-width: calc(100vw - 24px); max-height: 70vh; overflow: auto;
        background: #fff; color: #161a23; border: 1px solid #dfe2ea; border-radius: 14px; box-shadow: 0 12px 40px rgba(16,19,42,.18); }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #dfe2ea; }
      .brand { font: italic 600 16px Georgia, serif; }
      select { font-size: 12px; padding: 3px 6px; border: 1px solid #dfe2ea; border-radius: 6px; background: #fff; color: #161a23; }
      .items { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; }
      .item { display: flex; flex-direction: column; gap: 4px; }
      .row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .name { font: italic 15px Georgia, serif; }
      .badge { font: 11px ui-monospace, monospace; padding: 2px 7px; border-radius: 999px; color: #fff; white-space: nowrap; }
      .note { font-size: 12px; color: #5d6475; }
      .try { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; background: #e2f3e9; color: #14653a; border-radius: 8px; padding: 6px 8px; }
      .try button, .foot a { font-size: 12px; border: 0; border-radius: 6px; padding: 4px 8px; background: #10132a; color: #fff; cursor: pointer; text-decoration: none; }
      .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-top: 1px solid #dfe2ea; font-size: 11px; color: #5d6475; }
      .empty { font-size: 13px; color: #5d6475; }
    </style>
    <button class="pill" type="button" aria-label="Vernacular culture check"><span class="dot"></span><span class="label">Vernacular</span></button>
    <div class="panel" role="dialog" aria-label="Vernacular culture check">
      <div class="head"><span class="brand">Vernacular</span><select aria-label="Audience"></select></div>
      <div class="items"></div>
      <div class="foot"><span>Scores from Qloo's taste graph</span><a target="_blank" rel="noopener">Full check →</a></div>
    </div>`;
  const pill = root.querySelector(".pill");
  const dot = root.querySelector(".dot");
  const label = root.querySelector(".label");
  const panel = root.querySelector(".panel");
  const list = root.querySelector(".items");
  const select = root.querySelector("select");
  const full = root.querySelector(".foot a");
  for (const [id, name] of PRESETS) select.add(new Option(name, id, false, id === cfg.audience));
  (document.body || document.documentElement).appendChild(host);

  let field = null;
  let timer = 0;
  let lastKey = "";
  let result = null;
  let seq = 0;

  const textOf = (el) => (el.isContentEditable ? el.innerText : el.value) || "";
  const editable = (el) =>
    el && (el.tagName === "TEXTAREA" || (el.isContentEditable && el.getAttribute("contenteditable") !== "false"));

  function place() {
    if (!field || !document.contains(field)) return hide();
    const r = field.getBoundingClientRect();
    pill.style.left = `${Math.max(8, Math.min(window.innerWidth - 150, r.right - 140))}px`;
    // Sit on the field's bottom edge, like a badge, so it never covers the text.
    pill.style.top = `${Math.max(8, Math.min(window.innerHeight - 36, r.bottom - 13))}px`;
    const below = r.bottom + 8 + 320 < window.innerHeight;
    panel.style.left = `${Math.max(12, Math.min(window.innerWidth - 352, r.right - 340))}px`;
    panel.style.top = below ? `${r.bottom + 8}px` : "";
    panel.style.bottom = below ? "" : `${Math.max(12, window.innerHeight - r.top + 8)}px`;
  }
  function hide() {
    pill.style.display = "none";
    panel.style.display = "none";
  }
  function setPill(state, text, color) {
    pill.style.display = "flex";
    pill.classList.toggle("busy", state === "busy");
    dot.style.background = color || "#8d9cff";
    label.textContent = text;
    place();
  }

  async function check(force) {
    if (!field) return;
    const text = textOf(field).trim();
    if (text.length < MIN_CHARS) return setPill("idle", "Vernacular");
    const key = `${select.value}|${text}`;
    if (key === lastKey && !force) return;
    lastKey = key;
    const mine = ++seq;
    setPill("busy", "Checking culture…");
    try {
      const res = await fetch(`${cfg.api}/api/lint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 4000), audience: select.value }),
      });
      const body = await res.json();
      if (mine !== seq) return;
      if (!res.ok) throw new Error(body.error || "Check failed");
      result = { text, ...body };
      const weak = body.items.filter((i) => i.verdict === "misses" || i.verdict === "mixed");
      const misses = body.items.filter((i) => i.verdict === "misses").length;
      const lands = body.items.filter((i) => i.verdict === "lands").length;
      const unscored = body.items.length - lands - weak.length;
      if (!body.items.length) setPill("idle", "No references", COLORS.unmeasured);
      else if (!weak.length && !lands) setPill("idle", `${unscored} unscored`, COLORS.unmeasured);
      else if (!weak.length) setPill("idle", `✓ ${lands} land${unscored ? ` · ${unscored} unscored` : ""}`, COLORS.lands);
      else setPill("idle", `${weak.length} to fix`, misses ? COLORS.misses : COLORS.mixed);
      if (panel.style.display === "block") render();
    } catch {
      if (mine === seq) setPill("idle", "Vernacular · retry", COLORS.unmeasured);
      lastKey = "";
    }
  }

  function render() {
    list.textContent = "";
    if (!result || !result.items.length) {
      list.innerHTML = `<p class="empty">No named cultural references here yet.</p>`;
    } else {
      for (const it of result.items) {
        const el = document.createElement("div");
        el.className = "item";
        const pct = it.percentile === null ? "n/a" : `p${it.percentile}`;
        el.innerHTML = `<div class="row"><span class="name"></span><span class="badge"></span></div><span class="note"></span>`;
        el.querySelector(".name").textContent = it.span;
        const badge = el.querySelector(".badge");
        badge.textContent = `${it.verdict} · ${pct}`;
        badge.style.background = COLORS[it.verdict] || COLORS.unmeasured;
        el.querySelector(".note").textContent = it.note || "";
        if (!it.suggestion && it.type === "person" && (it.verdict === "misses" || it.verdict === "mixed")) {
          const t = document.createElement("span");
          t.className = "note";
          t.textContent = "People are rarely like-for-like; open the full check for a swap that fits the sentence.";
          el.appendChild(t);
        }
        if (it.suggestion) {
          const t = document.createElement("div");
          t.className = "try";
          t.innerHTML = `<span></span><button type="button">Use</button>`;
          t.querySelector("span").textContent = `Try ${it.suggestion.name} · p${it.suggestion.percentile}`;
          t.querySelector("button").addEventListener("click", () => use(it.span, it.suggestion.name));
          el.appendChild(t);
          if (it.suggestion.shared && it.suggestion.shared.length) {
            const why = document.createElement("span");
            why.className = "note";
            why.textContent = `Same kind of thing, per Qloo: ${it.suggestion.shared.slice(0, 3).join(", ")}`;
            el.appendChild(why);
          }
        }
        list.appendChild(el);
      }
    }
    const payload = encodeURIComponent(JSON.stringify({ text: result ? result.text : textOf(field), audience: select.value }));
    full.href = `${cfg.app}/#check=${payload}`;
  }

  function use(span, name) {
    if (!field) return;
    const text = textOf(field);
    const at = text.indexOf(span);
    if (at < 0) return;
    if (field.isContentEditable) {
      // Select the span inside the editor and let the editor apply the change itself.
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.data.indexOf(span);
        if (i >= 0) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + span.length);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("insertText", false, name);
          break;
        }
      }
    } else {
      field.focus();
      field.setSelectionRange(at, at + span.length);
      if (!document.execCommand("insertText", false, name)) {
        field.setRangeText(name, at, at + span.length, "end");
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    lastKey = "";
    check(true);
  }

  document.addEventListener(
    "focusin",
    (e) => {
      const el = e.composedPath()[0];
      if (!editable(el)) return;
      if (field !== el) {
        field = el;
        lastKey = "";
        result = null;
        panel.style.display = "none";
      }
      check();
    },
    true,
  );
  document.addEventListener(
    "input",
    (e) => {
      const el = e.composedPath()[0];
      if (el !== field) return;
      clearTimeout(timer);
      timer = setTimeout(check, IDLE_MS);
    },
    true,
  );
  pill.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the field
  pill.addEventListener("click", () => {
    const open = panel.style.display === "block";
    panel.style.display = open ? "none" : "block";
    if (!open) render();
    place();
  });
  select.addEventListener("change", () => {
    if (typeof cfg.saveAudience === "function") cfg.saveAudience(select.value);
    lastKey = "";
    check(true);
  });
  // The extension keeps the chosen audience in its own storage.
  if (typeof cfg.loadAudience === "function") {
    Promise.resolve(cfg.loadAudience()).then((id) => {
      if (id && PRESETS.some((p) => p[0] === id)) select.value = id;
    });
  }
  window.addEventListener("scroll", place, true);
  window.addEventListener("resize", place);
  document.addEventListener("keydown", (e) => e.key === "Escape" && (panel.style.display = "none"));
})();
