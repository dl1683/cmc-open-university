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
//   ability a (UNOBSERVED) âˆˆ uniform grid; instrument z âˆˆ {0, 1} (near a
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
      ['ability â†’ schooling AND ability â†’ wage (the fork), schooling â†’ wage with TRUE effect exactly 3 — every row generated from these equations, nothing hidden from US'],
      ['schooling and wage only: ability lives in people\'s heads — no dataset column, ever'],
      [`slope = ${fmt(NAIVE)}, computed live — nearly double the true 3, because able people both study longer AND earn more regardless`],
      ["Causal Graphs, Confounding & Simpson\'s Paradox said: block the fork by adjusting for the confounder. You cannot stratify on a column that does not exist"],
    ]),
    highlight: { removed: ['naive:detail'], active: ['blocked:detail'] },
    explanation: `The hardest version of the confounding problem. This page builds a world where one extra year of schooling causes EXACTLY ${TRUE_EFFECT} units of extra wage — we wrote the equations, so we know. But ability confounds: it raises schooling and wage both, and unlike stone size in the kidney study, it appears in no dataset. Regress wage on schooling and the slope comes out ${fmt(NAIVE)}, computed live — biased upward by two-thirds, crediting education for what ability did. Backdoor adjustment is not hard here; it is IMPOSSIBLE, because the back door runs through an unmeasured room. Randomization would fix it, but you cannot randomly assign childhoods. This is where most causal questions about people actually live.`,
    invariant: 'An unmeasured confounder defeats adjustment by definition: the bias is real, directional, and invisible in the data you have.',
  };

  yield {
    state: table('The escape: a variable with exactly one road into the outcome', [
      ['def', 'the instrument'],
      ['c1', '1 Â· RELEVANCE'],
      ['c2', '2 Â· EXCLUSION'],
      ['c3', '3 Â· INDEPENDENCE'],
    ], [['detail', '']], [
      ['z = "grew up near a college": z â†’ schooling â†’ wage, and CRUCIALLY no other arrow leaves z — a nudge on the treatment with no private path to the outcome'],
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
      [`mean wage(near) âˆ’ mean wage(far) = ${fmt(WALD.dW, 1)} — the lottery\'s total downstream effect`],
      [`mean schooling(near) âˆ’ mean schooling(far) = ${fmt(WALD.dS, 1)} years — how hard the lottery actually pushed the treatment`],
      [`${fmt(WALD.dW, 1)} / ${fmt(WALD.dS, 1)} = ${fmt(WALD.iv, 2)} — the true effect, recovered EXACTLY, with ability still unobserved`],
      ['both differences compare lottery groups, and the lottery is independent of ability — so ability cancels out of BOTH, and the ratio rescales the clean nudge into a per-year effect'],
    ]),
    highlight: { found: ['ratio:calc'] },
    explanation: `The estimator is one division, computed live: the instrument\'s effect on the outcome (${fmt(WALD.dW, 1)} wage units) divided by its effect on the treatment (${fmt(WALD.dS, 1)} years) = ${fmt(WALD.iv, 2)} — the true ${TRUE_EFFECT}, exactly, from a dataset whose naive regression said ${fmt(NAIVE)}. The intuition: comparing near-college to far-college kids is a fair comparison (the lottery balanced ability across groups), so the wage gap between groups is CAUSED by the lottery — and the only road from lottery to wage runs through schooling. The gap is therefore "the effect of ${fmt(WALD.dS, 1)} extra years," and dividing by ${fmt(WALD.dS, 1)} prices a single year. A natural experiment is exactly this: A/B Testing & p-values where nature, not you, flipped the coin — and the Wald ratio is how you read the result off.`,
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
      ['a direct z â†’ wage leak of 0.5 units biases the ratio by 0.5 / 2 = 0.25 — annoying, survivable'],
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
      ["randomize when you can (A/B Testing & p-values) Â· adjust when confounders are measured (Causal Graphs, Confounding & Simpson\'s Paradox + Doubly Robust Estimation) Â· find a lottery when they aren\'t (this page) — three tools, one question"],
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
    {heading: 'How to read the animation', paragraphs: [
      'The animation shows a causal graph, where arrows mean one variable can affect another. Ability is hidden, but it affects both schooling and wages, so the simple schooling-wage slope mixes treatment effect with selection.',
      {type: 'callout', text: 'IV works only when the instrument creates treatment variation that is independent of the hidden common cause.'},
      'Active cells are the estimator being computed, removed cells are biased answers, and found cells mark the recovered effect. The safe inference is narrow: use only treatment variation created by the instrument.',
      {type: 'image', src: './assets/gifs/instrumental-variables.gif', alt: 'Animated walkthrough of the instrumental variables visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    {heading: 'Why this exists', paragraphs: [
      'Instrumental variables exist because some causal questions have an unmeasured confounder. A confounder is a common cause of the treatment and the outcome, so ordinary regression cannot separate the real treatment effect from selection bias.',
    ]},
    {heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to regress the outcome on the treatment and read the slope. For wages and schooling, that means fitting wage = a + b * schooling and treating b as the return to education.',
    ]},
    {heading: 'The wall', paragraphs: [
      'The wall is that ability may raise both schooling and wages, while never appearing as a measured column. More rows reduce sampling noise, but they do not remove bias from a missing common cause.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A directed graph is the right mental model for IV: the instrument must push treatment while avoiding every private path to outcome. Source: Wikimedia Commons, David W., public domain.'},
    ]},
    {heading: 'The core insight', paragraphs: [
      'Find a variable that nudges treatment but is otherwise independent of the hidden confounder. That variable is an instrument: it creates a comparison where treatment changes for a reason unrelated to the omitted cause.',
    ]},
    {heading: 'How it works', paragraphs: [
      'With one binary instrument, compute the outcome difference between instrument groups and divide by the treatment difference between the same groups. Two-stage least squares generalizes this by first predicting treatment from the instrument, then regressing outcome on the predicted treatment.',
    ]},
    {heading: 'Why it works', paragraphs: [
      'If independence holds, the instrument groups are balanced on the hidden confounder. If exclusion holds, the instrument affects the outcome only through treatment, so the outcome difference divided by the treatment difference gives the per-unit causal effect for the people moved by the instrument.',
    ]},
    {heading: 'Cost and complexity', paragraphs: [
      'The computation is cheap because two-stage least squares is two regressions. The real cost is credibility: relevance, independence, exclusion, and monotonicity are assumptions about the world, not facts proven by the dataset.',
      'Weak instruments are dangerous because the estimator divides by the first stage. If the first stage is 0.1 and a small exclusion violation is 0.5, the bias is 0.5 / 0.1 = 5 outcome units.',
    ]},
    {heading: 'Real-world uses', paragraphs: [
      'Economists use draft lotteries, judge assignment, distance to schools, policy thresholds, and weather shocks as instruments. Epidemiology uses genetic variants as instruments in Mendelian randomization when the biological exclusion argument is credible.',
    ]},
    {heading: 'Where it fails', paragraphs: [
      'It fails when the instrument has a private path to the outcome, such as distance to college also capturing family wealth or local labor markets. It also fails when the instrument moves only a narrow subgroup, because the estimate then describes compliers rather than the whole population.',
    ]},
    {heading: 'Worked example', paragraphs: [
      'Suppose people near a college average 14 years of schooling and wages of 46, while people far away average 12 years and wages of 40. The first stage is 14 - 12 = 2 years, and the reduced form is 46 - 40 = 6 wage units.',
      'The IV estimate is 6 / 2 = 3 wage units per extra year of schooling. If ordinary regression gives 5.9, the difference is the selection bias that IV is trying to remove.',
    ]},
    {heading: 'Sources and study next', paragraphs: [
      'Read Philip Wright on supply-demand identification, Angrist and Krueger on quarter of birth, Card on distance to college, Imbens and Angrist on LATE, and Stock and Yogo on weak instruments. Then study Causal Graphs, Ordinary Least Squares, Difference-in-Differences, Regression Discontinuity, and Doubly Robust Estimation.',
    ]},
  ],
};
