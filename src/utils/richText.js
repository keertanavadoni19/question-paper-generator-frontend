// Question text from the bank contains LaTeX ($…$, $$…$$, \(…\), \[…\]) and images
// written as {{IMG::https://…}}. These helpers turn it into safe HTML (KaTeX) for the
// preview / print, and into plain segments for the Word export.
import katex from "katex";

const IMG = /\{\{IMG::(https?:\/\/[^}\s]+)\}\}/g;
const TOKEN = /(\{\{IMG::https?:\/\/[^}\s]+\}\})|(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\\\([\s\S]+?\\\))|((?<![\\$])\$(?!\s)(?:\\\$|[^$\n])+?(?<!\s)\$)/g;

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Splits text into { type: "text" | "math" | "image", value, display? }
export function segments(text) {
  const out = [];
  const source = String(text ?? "");
  let last = 0;
  for (const m of source.matchAll(TOKEN)) {
    if (m.index > last) out.push({ type: "text", value: source.slice(last, m.index) });
    const raw = m[0];
    if (m[1]) out.push({ type: "image", value: raw.slice(7, -2) });
    else if (m[2]) out.push({ type: "math", value: raw.slice(2, -2), display: true });
    else if (m[3]) out.push({ type: "math", value: raw.slice(2, -2), display: true });
    else if (m[4]) out.push({ type: "math", value: raw.slice(2, -2), display: false });
    else out.push({ type: "math", value: raw.slice(1, -1), display: false });
    last = m.index + raw.length;
  }
  if (last < source.length) out.push({ type: "text", value: source.slice(last) });
  return out;
}

export const hasRichContent = (text) => /\{\{IMG::|\$|\\\(|\\\[/.test(String(text ?? ""));
export const imageUrls = (text) => [...String(text ?? "").matchAll(IMG)].map((m) => m[1]);

const cache = new Map();
function mathHtml(tex, display) {
  const key = `${display ? "D" : "I"}${tex}`;
  if (!cache.has(key)) {
    if (cache.size > 5000) cache.clear();
    cache.set(key, katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "html", trust: false }));
  }
  return cache.get(key);
}

// Safe HTML: text is escaped, math rendered by KaTeX, images only from http(s) URLs.
export function richHtml(text) {
  return segments(text)
    .map((s) => {
      if (s.type === "image") return `<img class="qp-qimg" src="${escapeHtml(s.value)}" alt="" loading="eager" referrerpolicy="no-referrer">`;
      if (s.type === "math") return mathHtml(s.value, s.display);
      return escapeHtml(s.value).replace(/\n/g, "<br>");
    })
    .join("");
}

// ── LaTeX → readable Unicode text (Word export) ────────────────
const SYMBOLS = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "·", pm: "±", mp: "∓", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", sim: "∼", equiv: "≡", propto: "∝",
  infty: "∞", partial: "∂", nabla: "∇", int: "∫", oint: "∮", sum: "∑", prod: "∏", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔",
  leftrightarrow: "↔", rightleftharpoons: "⇌", uparrow: "↑", downarrow: "↓", circ: "°", degree: "°", angle: "∠", perp: "⊥", parallel: "∥", in: "∈", notin: "∉",
  subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", therefore: "∴", because: "∵", hbar: "ħ", ell: "ℓ", prime: "′", ldots: "…", cdots: "⋯", dots: "…",
  quad: " ", qquad: "  ", ",": " ", ";": " ", "!": "", " ": " ", lbrace: "{", rbrace: "}", "{": "{", "}": "}", "%": "%", "$": "$", "&": "&", "#": "#", "_": "_",
  sin: "sin", cos: "cos", tan: "tan", cot: "cot", sec: "sec", csc: "cosec", log: "log", ln: "ln", exp: "exp", lim: "lim", min: "min", max: "max", det: "det",
};
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", T: "ᵀ" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", i: "ᵢ", r: "ᵣ", n: "ₙ", m: "ₘ", k: "ₖ", p: "ₚ", s: "ₛ", t: "ₜ" };
const script = (s, map, mark) => ([...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join("") : [...s].length === 1 ? `${mark}${s}` : `${mark}(${s})`);

export function latexToText(tex) {
  let s = String(tex);
  let pos = 0;
  const group = () => {
    while (s[pos] === " ") pos += 1;
    if (s[pos] === "{") {
      let depth = 0;
      const start = pos + 1;
      for (; pos < s.length; pos += 1) {
        if (s[pos] === "{") depth += 1;
        else if (s[pos] === "}" && --depth === 0) { pos += 1; return s.slice(start, pos - 1); }
      }
      return s.slice(start);
    }
    if (s[pos] === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(pos));
      pos += m[0].length;
      return m[0];
    }
    return s[pos++] ?? "";
  };
  const parse = (input) => {
    const saved = [s, pos];
    s = input;
    pos = 0;
    let out = "";
    while (pos < s.length) {
      const c = s[pos];
      if (c === "\\") {
        const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(pos));
        pos += m[0].length;
        const name = m[1];
        if (["frac", "dfrac", "tfrac", "cfrac"].includes(name)) {
          const num = parse(group()), den = parse(group());
          const wrap = (x) => (/^[\w.′⁰-⁹]+$/.test(x) ? x : `(${x})`);
          out += `${wrap(num)}/${wrap(den)}`;
        } else if (name === "sqrt") {
          let index = "";
          if (s[pos] === "[") { const end = s.indexOf("]", pos); index = s.slice(pos + 1, end); pos = end + 1; }
          const body = parse(group());
          out += `${index ? script(index, SUP, "^") : ""}√${/^\w+$/.test(body) ? body : `(${body})`}`;
        } else if (["text", "mathrm", "mathbf", "mathit", "mathsf", "textbf", "textit", "operatorname", "boldsymbol", "mathcal", "rm", "bf"].includes(name)) {
          out += ["rm", "bf"].includes(name) ? "" : parse(group());
        } else if (name === "vec" || name === "overrightarrow") out += `${parse(group())}⃗`;
        else if (name === "hat") out += `${parse(group())}̂`;
        else if (name === "bar" || name === "overline") out += `${parse(group())}̅`;
        else if (name === "dot") out += `${parse(group())}̇`;
        else if (["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "limits", "nolimits"].includes(name)) out += "";
        else if (name === "begin" || name === "end") group();
        else if (name === "\\") out += "; ";
        else out += SYMBOLS[name] ?? name;
      } else if (c === "^" || c === "_") {
        pos += 1;
        const body = parse(group());
        out += c === "^" ? (body === "∘" || body === "°" ? "°" : script(body, SUP, "^")) : script(body, SUB, "_");
      } else if (c === "{" || c === "}") pos += 1;
      else if (c === "&") { out += " "; pos += 1; }
      else if (c === "~") { out += " "; pos += 1; }
      else { out += c; pos += 1; }
    }
    [s, pos] = saved;
    return out;
  };
  return parse(s).replace(/\s+/g, " ").trim();
}
