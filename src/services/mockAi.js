// Mock "AI" question writer. It creates fresh numeric-variant questions from templates
// so the generator works without a backend. When the real AI API is connected
// (VITE_USE_MOCK=false) this file is not used.
import { pick, randInt, shuffle, uid } from "../utils/helpers";

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const fraction = (num, den) => {
  const g = gcd(num, den);
  return den / g === 1 ? `${num / g}` : `${num / g}/${den / g}`;
};
const nCr = (n, r) => {
  let result = 1;
  for (let i = 1; i <= r; i += 1) result = (result * (n - r + i)) / i;
  return result;
};

// Builds 4 unique options from a correct value + candidate distractors.
function optionsFrom(correct, distractors, format = (v) => `${v}`) {
  const values = [correct];
  for (const d of distractors) {
    if (values.length === 4) break;
    const valid = typeof d === "number" ? Number.isFinite(d) : Boolean(d);
    if (valid && !values.includes(d)) values.push(d);
  }
  let bump = 1;
  while (values.length < 4) {
    const candidate = typeof correct === "number" ? correct + bump * (correct > 10 ? 5 : 1) : `${correct}${bump}`;
    if (!values.includes(candidate)) values.push(candidate);
    bump += 1;
  }
  const options = shuffle(values);
  return { options: options.map(format), answer: options.indexOf(correct) };
}

// Each template returns { text, correct, distractors, unit?, solution, integer? }
const TEMPLATES = {
  physics: [
    { chapter: "Kinematics", difficulty: "easy", concept: "Equations of Uniformly Accelerated Motion", make() {
      const v = randInt(2, 8) * 5, t = randInt(1, 5) * 2, s = (v * t) / 2;
      return { text: `A body starts from rest and reaches a speed of ${v} m/s in ${t} s with uniform acceleration. The distance travelled (in m) is:`, correct: s, distractors: [v * t, s / 2, s * 1.5, s + v], solution: `a = ${v}/${t}; s = ½at² = (v × t)/2 = ${s} m.`, integer: true };
    } },
    { chapter: "Kinematics", difficulty: "medium", concept: "Motion Under Gravity", make() {
      const u = randInt(1, 5) * 10, h = (u * u) / 20;
      return { text: `A stone is projected vertically upward with ${u} m/s (g = 10 m/s²). The maximum height reached (in m) is:`, correct: h, distractors: [h * 2, h / 2, u, h + 10], solution: `H = u²/2g = ${u * u}/20 = ${h} m.`, integer: true };
    } },
    { chapter: "Laws of Motion", difficulty: "easy", concept: "Newton's Second Law", make() {
      const m = randInt(2, 12), a = randInt(2, 6);
      return { text: `The net force (in N) required to give a body of mass ${m} kg an acceleration of ${a} m/s² is:`, correct: m * a, distractors: [m + a, m * a * 2, Math.max(1, m * a - a), m * a + m], solution: `F = ma = ${m} × ${a} = ${m * a} N.`, integer: true };
    } },
    { chapter: "Work, Energy and Power", difficulty: "easy", concept: "Kinetic Energy and Work-Energy Theorem", make() {
      const m = randInt(1, 5) * 2, v = randInt(2, 10), ke = (m * v * v) / 2;
      return { text: `The kinetic energy (in J) of a body of mass ${m} kg moving with ${v} m/s is:`, correct: ke, distractors: [ke * 2, ke / 2, m * v, ke + m], solution: `KE = ½mv² = ½ × ${m} × ${v * v} = ${ke} J.`, integer: true };
    } },
    { chapter: "Work, Energy and Power", difficulty: "medium", concept: "Power", make() {
      const m = randInt(2, 10), h = randInt(2, 10), t = pick([2, 4, 5, 10]), p = (m * 10 * h) / t;
      return { text: `A pump lifts ${m} kg of water to a height of ${h} m in ${t} s (g = 10 m/s²). The power (in W) is:`, correct: p, distractors: [p * 2, m * h, p / 2, p + 10], solution: `P = mgh/t = ${m} × 10 × ${h}/${t} = ${p} W.`, integer: Number.isInteger(p) };
    } },
    { chapter: "Current Electricity", difficulty: "easy", concept: "Ohm's Law and Resistivity", make() {
      const i = randInt(2, 5), r = randInt(3, 12);
      return { text: `A current of ${i} A flows through a resistor of ${r} Ω. The potential difference (in V) across it is:`, correct: i * r, distractors: [i + r, r / i, i * r * 2, i * r - i], solution: `V = IR = ${i} × ${r} = ${i * r} V.`, integer: true };
    } },
    { chapter: "Current Electricity", difficulty: "medium", concept: "Combination of Resistors", make() {
      const n = randInt(2, 5), each = n * randInt(2, 6), eq = each / n;
      return { text: `${n} identical resistors of ${each} Ω each are connected in parallel. The equivalent resistance (in Ω) is:`, correct: eq, distractors: [each * n, each, eq * 2, each / 2], solution: `R = ${each}/${n} = ${eq} Ω.`, integer: true };
    } },
    { chapter: "Optics", difficulty: "easy", concept: "Power of a Lens", make() {
      const p = pick([1, 2, 4, 5, 10]), f = 100 / p;
      return { text: `The focal length (in cm) of a convex lens of power +${p} D is:`, correct: f, distractors: [p * 10, f * 2, f / 2, 100 * p], solution: `f = 1/P m = 100/${p} cm = ${f} cm.`, integer: true };
    } },
    { chapter: "Oscillations and Waves", difficulty: "easy", concept: "Wave Motion and Wave Speed", make() {
      const f = pick([2, 4, 5, 10, 20, 25, 50]), t = 1000 / f;
      return { text: `A wave has a frequency of ${f} Hz. Its time period (in ms) is:`, correct: t, distractors: [f * 10, t * 2, t / 2, 1000 * f], solution: `T = 1/f = 1/${f} s = ${t} ms.`, integer: true };
    } },
    { chapter: "Thermodynamics", difficulty: "medium", concept: "Carnot Engine and Efficiency", make() {
      const [t1, t2] = pick([[500, 300], [400, 300], [600, 300], [800, 400], [1000, 600], [500, 400]]), eta = (1 - t2 / t1) * 100;
      return { text: `A Carnot engine operates between ${t1} K and ${t2} K. Its efficiency (in %) is:`, correct: eta, distractors: [100 - eta, eta / 2, Math.min(95, eta * 2), (t2 / t1) * 100 + 5], solution: `η = 1 − T₂/T₁ = 1 − ${t2}/${t1} = ${eta}%.`, integer: Number.isInteger(eta) };
    } },
  ],
  chemistry: [
    { chapter: "Some Basic Concepts of Chemistry", difficulty: "easy", concept: "Mole Concept", make() {
      const [formula, molar] = pick([["H₂O", 18], ["CO₂", 44], ["CH₄", 16], ["O₂", 32], ["NH₃", 17], ["NaOH", 40]]), k = randInt(1, 6);
      return { text: `The number of moles in ${k * molar} g of ${formula} is:`, correct: k, distractors: [k * 2, k + 1, k * 3, k + 2], solution: `Molar mass of ${formula} = ${molar} g/mol ⇒ ${k * molar}/${molar} = ${k} mol.`, integer: true };
    } },
    { chapter: "Equilibrium", difficulty: "easy", concept: "Ionisation of Water and pH", make() {
      const n = randInt(1, 5), base = Math.random() > 0.5;
      return base
        ? { text: `The pH of a 10⁻${n} M NaOH solution at 25 °C is:`, correct: 14 - n, distractors: [n, 14 - n + 1, 14 - n - 1, 7], solution: `pOH = ${n} ⇒ pH = 14 − ${n} = ${14 - n}.`, integer: true }
        : { text: `The pH of a 10⁻${n} M HCl solution is:`, correct: n, distractors: [14 - n, n + 1, n + 2, 7], solution: `[H⁺] = 10⁻${n} M ⇒ pH = ${n}.`, integer: true };
    } },
    { chapter: "Chemical Kinetics", difficulty: "medium", concept: "First Order Reactions and Half-life", make() {
      const half = randInt(2, 9) * 5, [pct, k] = pick([["75%", 2], ["87.5%", 3], ["93.75%", 4]]);
      return { text: `A first-order reaction has a half-life of ${half} min. The time (in min) required for ${pct} completion is:`, correct: half * k, distractors: [half, half * (k + 1), half * (k - 1) || half * 5, half * k * 2], solution: `${pct} completion = ${k} half-lives = ${k} × ${half} = ${half * k} min.`, integer: true };
    } },
    { chapter: "Solutions", difficulty: "medium", concept: "Concentration of Solutions", make() {
      const [volume, molarity] = pick([[250, 0.4], [500, 0.2], [500, 0.5], [1000, 0.1], [1000, 0.25], [250, 0.2]]), mass = Math.round(molarity * (volume / 1000) * 40 * 100) / 100;
      return { text: `The mass of NaOH (in g) needed to prepare ${volume} mL of a ${molarity} M solution is:`, correct: mass, distractors: [mass * 2, mass / 2, mass * 10, mass + 4], solution: `n = ${molarity} × ${volume / 1000} mol; mass = n × 40 = ${mass} g.`, integer: Number.isInteger(mass) };
    } },
    { chapter: "Atomic Structure", difficulty: "easy", concept: "Electronic Configuration", make() {
      const n = randInt(2, 4);
      return { text: `The maximum number of electrons that can be present in the shell with principal quantum number n = ${n} is:`, correct: 2 * n * n, distractors: [n * n, 2 * n, 8, 2 * n * n + 2], solution: `Maximum electrons = 2n² = ${2 * n * n}.`, integer: true };
    } },
    { chapter: "Atomic Structure", difficulty: "medium", concept: "Shapes of Orbitals and Nodes", make() {
      const [label, n, l] = pick([["3s", 3, 0], ["4s", 4, 0], ["3p", 3, 1], ["4p", 4, 1], ["4d", 4, 2], ["5s", 5, 0], ["5p", 5, 1]]), nodes = n - l - 1;
      return { text: `The number of radial nodes in a ${label} orbital is:`, correct: nodes, distractors: [l, n - 1, nodes + 1, n], solution: `Radial nodes = n − l − 1 = ${n} − ${l} − 1 = ${nodes}.`, integer: true };
    } },
  ],
  mathematics: [
    { chapter: "Complex Numbers", difficulty: "easy", concept: "Powers of i", make() {
      const n = randInt(20, 3000), values = ["1", "i", "−1", "−i"], correct = values[n % 4];
      return { text: `The value of i^${n} is:`, correct, distractors: values.filter((v) => v !== correct), solution: `${n} mod 4 = ${n % 4} ⇒ i^${n} = ${correct}.` };
    } },
    { chapter: "Matrices and Determinants", difficulty: "easy", concept: "Determinants and their Properties", make() {
      const [a, b, c, d] = [randInt(2, 9), randInt(1, 9), randInt(1, 9), randInt(2, 9)], det = a * d - b * c;
      return { text: `The value of the determinant |${a} ${b}; ${c} ${d}| is:`, correct: det, distractors: [a * d + b * c, a * b - c * d, det + 2, -det], solution: `${a}·${d} − ${b}·${c} = ${det}.`, integer: true, allowNegative: true };
    } },
    { chapter: "Sequences and Series", difficulty: "easy", concept: "Sum of Special Series", make() {
      const n = randInt(10, 50), s = (n * (n + 1)) / 2;
      return { text: `The sum of the first ${n} natural numbers is:`, correct: s, distractors: [n * n, s + n, s - n, (n * (n - 1)) / 2 + 1], solution: `n(n + 1)/2 = ${n} × ${n + 1}/2 = ${s}.`, integer: true };
    } },
    { chapter: "Sequences and Series", difficulty: "medium", concept: "Arithmetic Progression", make() {
      const a = randInt(1, 9), d = randInt(2, 6), n = randInt(8, 20), s = (n / 2) * (2 * a + (n - 1) * d);
      return { text: `The sum of the first ${n} terms of the AP ${a}, ${a + d}, ${a + 2 * d}, … is:`, correct: s, distractors: [s + d * n, s - a * 2, n * (a + n * d), s + n], solution: `Sₙ = n/2 [2a + (n − 1)d] = ${n}/2 × [${2 * a} + ${(n - 1) * d}] = ${s}.`, integer: Number.isInteger(s) };
    } },
    { chapter: "Binomial Theorem", difficulty: "easy", concept: "General Term", make() {
      const n = randInt(4, 9), r = randInt(2, 3), c = nCr(n, r);
      return { text: `The coefficient of x^${r} in the expansion of (1 + x)^${n} is:`, correct: c, distractors: [n * r, nCr(n, r - 1), c + n, nCr(n + 1, r)], solution: `ⁿCᵣ = ${n}C${r} = ${c}.`, integer: true };
    } },
    { chapter: "Straight Lines and Conic Sections", difficulty: "easy", concept: "Distance and Section Formula", make() {
      const [dx, dy, dist] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]]), x = randInt(-3, 4), y = randInt(-3, 4);
      return { text: `The distance between the points (${x}, ${y}) and (${x + dx}, ${y + dy}) is:`, correct: dist, distractors: [dx + dy, dist + 1, dist * 2, Math.abs(dy - dx) + 1], solution: `√(${dx}² + ${dy}²) = ${dist}.`, integer: true };
    } },
    { chapter: "Probability", difficulty: "medium", concept: "Classical Probability", make() {
      const sum = randInt(3, 11), ways = 6 - Math.abs(7 - sum), correct = fraction(ways, 36);
      return { text: `Two fair dice are thrown. The probability that the sum of the numbers is ${sum} is:`, correct, distractors: [fraction(ways + 1, 36), fraction(Math.max(1, ways - 1), 36), "1/6", "1/12", "1/9"].filter((v) => v !== correct), solution: `Favourable outcomes = ${ways}; P = ${ways}/36 = ${correct}.` };
    } },
    { chapter: "Integral Calculus", difficulty: "medium", concept: "Definite Integrals", make() {
      const a = randInt(1, 6) * 2, area = (a * a) / 2;
      return { text: `The value of ∫₀^${a} x dx is:`, correct: area, distractors: [a * a, a, area / 2, area + a], solution: `[x²/2]₀^${a} = ${a * a}/2 = ${area}.`, integer: true };
    } },
  ],
};

export function canGenerate(subjectId, chapter) {
  return (TEMPLATES[subjectId] ?? []).some((t) => t.chapter === chapter);
}

// Returns a new question for one of the given chapters, or null if no template fits.
// `concepts` ({ [chapter]: { selected } }) limits concept-restricted chapters to the chosen concepts.
export function generateQuestion({ subjectId, chapters, type = "mcq", examId, concepts }) {
  const pool = (TEMPLATES[subjectId] ?? []).filter(
    (t) => (!chapters?.length || chapters.includes(t.chapter)) && (!concepts?.[t.chapter] || concepts[t.chapter].selected.includes(t.concept))
  );
  if (!pool.length) return null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const template = pick(pool);
    const made = template.make();
    if (type === "numerical" && !made.integer) continue;
    const base = {
      id: uid("AI").toUpperCase(),
      subjectId,
      chapter: template.chapter,
      concept: template.concept,
      difficulty: template.difficulty,
      type,
      solution: made.solution,
      examIds: [examId],
      source: "ai",
      createdAt: new Date().toISOString(),
    };
    if (type === "numerical") {
      return { ...base, text: made.text.replace(/ is:$/, " is ____."), options: [], answer: String(made.correct) };
    }
    const distractors = made.allowNegative ? made.distractors : made.distractors.filter((d) => typeof d !== "number" || d > 0);
    const { options, answer } = optionsFrom(made.correct, distractors);
    return { ...base, text: made.text, options, answer };
  }
  return null;
}

// Last resort when neither the bank nor a template can supply a question.
// With a `slot` number, drafts rotate through the chapters and then through each
// chapter's chosen concepts, so they are spread out instead of repeating.
export function placeholderQuestion({ subjectId, chapters, type = "mcq", difficulty = "medium", examId, concepts, slot }) {
  const hasSlot = Number.isInteger(slot);
  const chapter = chapters?.length ? (hasSlot ? chapters[slot % chapters.length] : pick(chapters)) : "General";
  const chosen = concepts?.[chapter]?.selected ?? [];
  const concept = chosen.length ? (hasSlot ? chosen[Math.floor(slot / (chapters?.length || 1)) % chosen.length] : pick(chosen)) : undefined;
  const topic = concept ? `${concept} (${chapter})` : chapter;
  return {
    id: uid("DRAFT").toUpperCase(),
    subjectId,
    chapter,
    ...(concept ? { concept } : {}),
    difficulty,
    type,
    text: `[AI draft] ${difficulty[0].toUpperCase()}${difficulty.slice(1)} question on “${topic}”. Edit this question or connect the AI backend to auto-generate it.`,
    options: type === "mcq" ? ["Option A", "Option B", "Option C", "Option D"] : [],
    answer: type === "mcq" ? 0 : "0",
    solution: "Placeholder generated in mock mode.",
    examIds: [examId],
    source: "draft",
    needsReview: true,
    createdAt: new Date().toISOString(),
  };
}
