// Question distribution shared by the browser (mock mode) and the Node backend.
// Kinds: mcq (single correct), assertion_reason, numerical.

// Largest-remainder split of `total` over weights, each capped by `caps[i]`.
export function splitByWeight(total, weights, caps) {
  const out = weights.map(() => 0);
  let left = total;
  while (left > 0) {
    const open = weights.map((w, i) => i).filter((i) => out[i] < caps[i] && weights[i] > 0);
    if (!open.length) break;
    const wSum = open.reduce((s, i) => s + weights[i], 0);
    let gave = 0;
    const shares = open.map((i) => ({ i, exact: (left * weights[i]) / wSum }));
    for (const s of shares) {
      const n = Math.min(Math.floor(s.exact), caps[s.i] - out[s.i]);
      out[s.i] += n;
      gave += n;
    }
    left -= gave;
    if (left > 0) {
      shares.sort((a, b) => (b.exact % 1) - (a.exact % 1));
      for (const s of shares) {
        if (left === 0) break;
        if (out[s.i] < caps[s.i]) { out[s.i] += 1; left -= 1; gave += 1; }
      }
    }
    if (!gave) break;
  }
  return { counts: out, missing: left };
}

// Chapter × type allocation. Scarce types are placed first; each question of a type goes
// to the chapter that still needs the most questions and has that type available.
export function allocate(needs, kindTotals, available) {
  const alloc = needs.map(() => ({ mcq: 0, assertion_reason: 0, numerical: 0 }));
  const remaining = [...needs];
  const shortages = {};
  for (const kind of ["numerical", "assertion_reason", "mcq"]) {
    let left = kindTotals[kind] || 0;
    while (left > 0) {
      let best = -1;
      for (let i = 0; i < needs.length; i += 1) {
        if (remaining[i] <= 0 || available[i][kind] - alloc[i][kind] <= 0) continue;
        if (best < 0 || remaining[i] > remaining[best] || (remaining[i] === remaining[best] && available[i][kind] > available[best][kind])) best = i;
      }
      if (best < 0) break;
      alloc[best][kind] += 1;
      remaining[best] -= 1;
      left -= 1;
    }
    if (left > 0) shortages[kind] = left;
  }
  return { alloc, shortages, unfilled: remaining.map((r, i) => ({ i, r })).filter((x) => x.r > 0) };
}
