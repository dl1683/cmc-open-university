// Instrumental variables: when the confounder is unobservable and you can't
// randomize, find a lottery hiding in the world — something that nudges the
// treatment and touches the outcome no other way — and divide two differences.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'instrumental-variables',
  title: 'Instrumental Variables & Natural Experiments',
  category: 'Concepts',
  summary: 'A synthetic world with a hidden confounder and a known true effect: naive regression overshoots, the Wald ratio recovers the truth exactly — live.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the lottery in the data', 'famous instruments & fine print'], defaultValue: 'the lottery in the data' },
  ],
  run,
};

// The synthetic world, fully known so estimators can be audited:
//   ability a (UNOBSERVED) ∈ uniform grid; instrument z ∈ {0, 1} (near a
//   college); schooling s = 10 + 2z + a; wage w = 20 + 3s + 5a.
// TRUE causal effect of one year of schooling on wage: exactly 3.
const TRUE_EFFECT = 3;
function world(zEffect) {
  const rows = [];
  for (let i = 0; i <= 40; i++) {
    const a = -2 + (4 * i) / 40;
    for (const z of [0, 1]) {
      const s = 10 + zEffect * z + a;
      const w = 20 + TRUE_EFFECT * s + 5 * a;
      rows.push({ a, z, s, w });
    }
  }
  return rows;
}
const ROWS = world(2);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
function olsSlope(rows) {
  const ms = mean(rows.map((r) => r.s));
  const mw = mean(rows.map((r) => r.w));
  let cov = 0;
  let varS = 0;
  for (const r of rows) {
    cov += (r.s - ms) * (r.w - mw);
    varS += (r.s - ms) ** 2;
  }
  return cov / varS;
}
function wald(rows) {
  const z1 = rows.filter((r) => r.z === 1);
  const z0 = rows.filter((r) => r.z === 0);
  const dW = mean(z1.map((r) => r.w)) - mean(z0.map((r) => r.w));
  const dS = mean(z1.map((r) => r.s)) - mean(z0.map((r) => r.s));
  return { dW, dS, iv: dW / dS };
}
const NAIVE = olsSlope(ROWS);
const WALD = wald(ROWS);
const fmt = (v, d = 2) => v.toFixed(d);

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* lottery() {
  yield {
    state: table(`The trap: the confounder exists but was never measured (truth = ${TRUE_EFFECT})`, [
      ['worldRow', 'the synthetic world'],
      ['hidden', 'what the analyst sees'],
      ['naive', 'naive regression of wage on schooling'],
      ['blocked', 'why the usual fix is unavailable'],
    ], [['detail', '']], [
      ['ability → schooling AND ability → wage (the fork), schooling → wage with TRUE effect exactly 3 — every row generated from these equations, nothing hidden from US'],
      ['schooling and wage only: ability lives in people\'s heads — no dataset column, ever'],
      [`slope = ${fmt(NAIVE)}, computed live — nearly double the true 3, because able people both study longer AND earn more regardless`],
      ["Causal Graphs, Confounding & Simpson's Paradox said: block the fork by adjusting for the confounder. You cannot stratify on a column that does not exist"],
    ]),
    highlight: { removed: ['naive:detail'], active: ['blocked:detail'] },
    explanation: `The hardest version of the confounding problem. This page builds a world where one extra year of schooling causes EXACTLY ${TRUE_EFFECT} units of extra wage — we wrote the equations, so we know. But ability confounds: it raises schooling and wage both, and unlike stone size in the kidney study, it appears in no dataset. Regress wage on schooling and the slope comes out ${fmt(NAIVE)}, computed live — biased upward by two-thirds, crediting education for what ability did. Backdoor adjustment is not hard here; it is IMPOSSIBLE, because the back door runs through an unmeasured room. Randomization would fix it, but you cannot randomly assign childhoods. This is where most causal questions about people actually live.`,
    invariant: 'An unmeasured confounder defeats adjustment by definition: the bias is real, directional, and invisible in the data you have.',
  };

  yield {
    state: table('The escape: a variable with exactly one road into the outcome', [
      ['def', 'the instrument'],
      ['c1', '1 · RELEVANCE'],
      ['c2', '2 · EXCLUSION'],
      ['c3', '3 · INDEPENDENCE'],
    ], [['detail', '']], [
      ['z = "grew up near a college": z → schooling → wage, and CRUCIALLY no other arrow leaves z — a nudge on the treatment with no private path to the outcome'],
      [`the instrument actually moves the treatment: here, growing up near a college adds ${fmt(WALD.dS, 1)} years of schooling (computed live from the z = 1 vs z = 0 groups)`],
      ['z affects wage ONLY through schooling — proximity must not pay wages directly, attract richer families, or correlate with local labor markets (the assumption that does the heavy lifting, and the one critics attack)'],
      ['z is as-good-as-random with respect to ability: in this world, near and far kids have identical ability distributions by construction — nature ran a lottery'],
    ]),
    highlight: { active: ['c2:detail'] },
    explanation: 'The trick is to stop staring at the confounded treatment and find a LOTTERY that nudges it. "Distance to college" (David Card\'s famous instrument): kids who grow up near a college get a little more schooling for reasons that have nothing to do with their ability — geography nudged them. Three conditions make a valid instrument, and they\'re not symmetric in checkability: relevance is verifiable in data (does z move s? — yes, by 2 years, computed). Independence is plausible-by-design when nature randomizes. EXCLUSION is the leap of faith: no path from z to wage except through schooling. It cannot be tested from data — only argued from domain knowledge, which is why every instrument\'s validity is a debate about arrows, not statistics.',
    invariant: 'Instrument = relevance (testable) + exclusion (argued) + independence (designed): one road in, no private exits.',
  };

  yield {
    state: table('The Wald estimator: divide the two differences (live)', [
      ['num', 'reduced form: effect of z on WAGE'],
      ['den', 'first stage: effect of z on SCHOOLING'],
      ['ratio', 'the ratio'],
      ['why', 'why this isolates causation'],
    ], [['calc', '']], [
      [`mean wage(near) − mean wage(far) = ${fmt(WALD.dW, 1)} — the lottery's total downstream effect`],
      [`mean schooling(near) − mean schooling(far) = ${fmt(WALD.dS, 1)} years — how hard the lottery actually pushed the treatment`],
      [`${fmt(WALD.dW, 1)} / ${fmt(WALD.dS, 1)} = ${fmt(WALD.iv, 2)} — the true effect, recovered EXACTLY, with ability still unobserved`],
      ['both differences compare lottery groups, and the lottery is independent of ability — so ability cancels out of BOTH, and the ratio rescales the clean nudge into a per-year effect'],
    ]),
    highlight: { found: ['ratio:calc'] },
    explanation: `The estimator is one division, computed live: the instrument's effect on the outcome (${fmt(WALD.dW, 1)} wage units) divided by its effect on the treatment (${fmt(WALD.dS, 1)} years) = ${fmt(WALD.iv, 2)} — the true ${TRUE_EFFECT}, exactly, from a dataset whose naive regression said ${fmt(NAIVE)}. The intuition: comparing near-college to far-college kids is a fair comparison (the lottery balanced ability across groups), so the wage gap between groups is CAUSED by the lottery — and the only road from lottery to wage runs through schooling. The gap is therefore "the effect of ${fmt(WALD.dS, 1)} extra years," and dividing by ${fmt(WALD.dS, 1)} prices a single year. A natural experiment is exactly this: A/B Testing & p-values where nature, not you, flipped the coin — and the Wald ratio is how you read the result off.`,
    invariant: 'IV = (effect of z on outcome) / (effect of z on treatment): the confounder cancels from both, the division sets the scale.',
  };
}

function* finePrint() {
  yield {
    state: table('The hall of fame: lotteries found in the wild', [
      ['draft', 'Vietnam draft lottery'],
      ['qob', 'quarter of birth'],
      ['card', 'distance to college'],
      ['judge', 'judge leniency'],
      ['rain', 'rainfall'],
    ], [['nudges', 'nudges'], ['question', 'answered']], [
      ['military service (literal lottery numbers)', 'effect of service on lifetime earnings — Angrist 1990, the field\'s founding example'],
      ['schooling (compulsory-age laws bind differently by birth month)', 'returns to education — Angrist & Krueger 1991'],
      ['years of schooling', 'returns to education again, different lottery — Card 1995, this page\'s running example'],
      ['incarceration (cases randomly assigned to harsher/softer judges)', 'effect of jail time on reoffending and employment — the modern workhorse, used in dozens of studies'],
      ['agricultural income in poor regions', 'income\'s effect on conflict — weather as nature\'s randomizer'],
    ]),
    highlight: { active: ['judge:question'] },
    explanation: 'What makes the famous instruments famous is the quality of their lotteries. Draft numbers were drawn from a literal urn — independence by construction. Judge assignment is random by court rule, and judges measurably differ in harshness — relevance and independence both strong, which is why "judge leniency" designs now anchor entire literatures. Notice what unites the gallery: each is an argument that NATURE ALREADY RAN the experiment you were forbidden to run, and the statistician\'s job is forensic — find the lottery, verify it pushed the treatment, argue it touched the outcome no other way. The creativity is in the finding; the math afterward is the same one division this page computed.',
    invariant: 'A natural experiment is a found lottery: the discovery is domain work, the estimator is the same Wald ratio every time.',
  };

  yield {
    state: table('The weak-instrument trap, with arithmetic', [
      ['strong', 'strong instrument (first stage = 2 years)'],
      ['weak', 'weak instrument (first stage = 0.1 years)'],
      ['both', 'same tiny exclusion violation in both worlds'],
      ['rule', 'the working rule'],
    ], [['math', '']], [
      ['a direct z → wage leak of 0.5 units biases the ratio by 0.5 / 2 = 0.25 — annoying, survivable'],
      ['the SAME 0.5 leak biases the ratio by 0.5 / 0.1 = 5.0 — bigger than the true effect of 3: the answer is now mostly artifact'],
      ['the leak didn\'t grow; the DENOMINATOR shrank — a weak first stage is a lever that amplifies every imperfection, and sampling noise in the denominator adds instability on top'],
      ['report the first-stage strength always (the F > 10 folk threshold); a weak instrument is not a weak answer — it is a megaphone for your mistakes'],
    ]),
    highlight: { removed: ['weak:math'], active: ['rule:math'] },
    explanation: 'The failure mode that humbles IV in practice, in two divisions you can check by hand. The Wald ratio divides by the first stage — how hard the lottery pushed the treatment. A strong push (2 years) dilutes any small violation of the exclusion assumption: a 0.5-unit direct leak from instrument to outcome distorts the answer by only 0.25. A feeble push (0.1 years) AMPLIFIES the identical leak twenty-fold, to 5.0 — now larger than the entire true effect. Weak instruments also make the estimate statistically unstable (a noisy denominator near zero), but the deeper danger is this amplification: the weaker the lottery, the more the answer consists of whatever tiny sins the exclusion argument committed. Quarter-of-birth was famously relitigated on exactly these grounds.',
    invariant: 'IV bias from an exclusion leak = leak / first stage: weakness doesn\'t shrink the answer, it amplifies every flaw in it.',
  };

  yield {
    state: table('What you actually estimated: the LATE fine print', [
      ['groups', 'four kinds of people'],
      ['late', 'who the ratio describes'],
      ['ext', 'what it does NOT claim'],
      ['ladder', 'the toolkit, completed'],
    ], [['detail', '']], [
      ['always-takers (study regardless), never-takers (won\'t regardless), COMPLIERS (nudged by the lottery), defiers (assumed away) — the instrument only moves the compliers'],
      ['the Local Average Treatment Effect: the causal effect FOR COMPLIERS — kids whose schooling actually depended on living near a college'],
      ['nothing about always-takers or never-takers: if compliers benefit differently from schooling than everyone else, the IV answer is true AND not the population average'],
      ["randomize when you can (A/B Testing & p-values) · adjust when confounders are measured (Causal Graphs, Confounding & Simpson's Paradox + Doubly Robust Estimation) · find a lottery when they aren't (this page) — three tools, one question"],
    ]),
    highlight: { active: ['late:detail'], removed: ['ext:detail'] },
    explanation: 'The honest closing: WHOSE causal effect did the division compute? Only the compliers\' — the people the lottery actually moved. In this page\'s synthetic world everyone responds identically, so it doesn\'t matter; in reality, the kids whose schooling hinges on college proximity may gain more (or less) from extra years than kids who\'d study anywhere. The IV answer is exactly right about a subpopulation you didn\'t choose and can\'t directly identify — true and local, hence LATE. That isn\'t a flaw so much as a price tag, and knowing it completes the causal toolkit: experiment severs the arrows, adjustment blocks the measured back doors, and instruments exploit found lotteries — each rung trading assumptions for reach, each honest only when its fine print is read aloud.',
    invariant: 'IV identifies the compliers\' effect (LATE): exactly right about the people the lottery moved, silent about everyone it didn\'t.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the lottery in the data') yield* lottery();
  else if (view === 'famous instruments & fine print') yield* finePrint();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Instrumental variables solve the hardest causal problem: when a confounder is unobservable, you cannot randomly assign the treatment, and regressing the outcome on the treatment gives a biased answer. An instrument is a variable that nudges the treatment but touches the outcome no other way. The Wald estimator divides two differences — the outcome gap between instrument groups, divided by the treatment gap between instrument groups — and recovers the true causal effect. On this page, that division yields exactly 3.00, the true wage effect of one year of schooling, from a dataset whose naive regression said 5.92.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A valid instrument must satisfy three conditions. First, RELEVANCE: it must actually move the treatment. On this page, "grew up near a college" increases schooling by 2.0 years (computed live, the first-stage effect). Second, INDEPENDENCE: the instrument is as-good-as-random with respect to the confounder — nature distributed near and far kids with identical ability by design. Third, EXCLUSION: the instrument affects the outcome ONLY through the treatment; there is no private back door. Exclusion cannot be tested from data; it rests on domain knowledge. You argue that living near a college changes wage only by changing schooling, not by raising wages directly or attracting richer families.`,
        `The Wald estimator then divides the reduced form (instrument's effect on the outcome: 6.0 wage units) by the first stage (instrument's effect on the treatment: 2.0 years), yielding 3.00. Both differences compare near-college to far-college groups. Because the instrument is independent of ability, ability cancels out of both differences. The division rescales the lottery's total nudge into a per-year effect. Ability remains unobserved, yet its confounding vanishes from the ratio.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The estimator is one division. Finding the instrument is hard: David Card discovered distance to college; Angrist found the draft lottery; Angrist & Krueger noticed quarter-of-birth effects. Judge leniency instruments now dominate because courts assign judges at random by rule. Finding the lottery is the intellectual work; the arithmetic is trivial.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Instrumental variables dominate fields where randomization is unethical or impossible. Labor economists use instruments to measure the return to education; policy makers use judge leniency instruments to estimate reoffending effects of incarceration; development economists use rainfall as an instrument to study conflict. The hall of fame on this page lists the workhorses: draft lottery, quarter of birth, distance to college, judge leniency (the modern anchor), and rainfall. Judge designs are especially powerful because courts assign judges at random by rule, making independence explicit, and judges measurably differ in severity, ensuring a strong first stage. This is why IV designs now proliferate in fields with access to natural courts or administrative randomization.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The weak-instrument trap: if the instrument barely moves the treatment, tiny violations of the exclusion assumption get amplified. A 0.5-unit direct leak with a strong first stage of 2.0 years yields bias 0.25; the same leak with a weak first stage of 0.1 years yields bias 5.0, larger than the true effect of 3. Always report the first-stage F-statistic; use F > 10 as a floor. Weak instruments amplify every exclusion assumption flaw.`,
        `Second misconception: IV estimates the Local Average Treatment Effect (LATE) — the effect FOR COMPLIERS, not the population average. Kids whose schooling depends on college proximity may gain differently from extra years than kids who would study anywhere. The IV answer is true and local simultaneously.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Master the causal toolkit: start with "Causal Graphs, Confounding & Simpson's Paradox" to understand why confounding blocks adjustment; then "A/B Testing & p-values" for the experimental gold standard; then "Doubly Robust Estimation" to see how to combine adjustment with weighting; finally "Importance Sampling & Off-Policy Estimation" to learn how instrumental variables generalize to reinforcement learning and online settings. A natural experiment is exactly what this page builds: nature runs the A/B test, and the Wald ratio is how you read off the causal effect.`,
      ],
    },
  ],
};

