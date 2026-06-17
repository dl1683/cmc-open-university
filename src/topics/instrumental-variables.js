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
      heading: `Why this exists`,
      paragraphs: [
        `Instrumental variables exist for causal questions where the usual fixes are unavailable. You want to know whether schooling raises wages, jail time changes later employment, military service affects lifetime earnings, or income changes conflict. Random assignment may be unethical or impossible, and the important confounder may never appear in the data.`,
        `The page's synthetic world makes that problem visible. Ability affects both schooling and wages, but the analyst cannot observe ability. The true effect of one extra year of schooling is exactly 3, because the data generator says so. A naive regression of wage on schooling gives about 5.92, crediting schooling for part of ability's effect. Instrumental variables are a way to recover a causal effect from a natural nudge when direct adjustment cannot work.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The obvious approach is to regress the outcome on the treatment and interpret the slope. In the schooling example, regress wage on years of schooling and call the coefficient the return to education. This is simple, uses the available columns, and often looks precise.`,
        `It fails because schooling was not assigned randomly. People with higher unobserved ability may get more schooling and also earn more for reasons that are not caused by schooling. In a causal graph, ability is a common cause of treatment and outcome. If ability were measured, you could adjust for it. If it is unmeasured, adjustment cannot block the backdoor path. More rows do not fix a missing variable.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is to stop looking for a perfect treatment comparison and look for a clean nudge. An instrument is a variable that changes the treatment but has no other route to the outcome. Distance to college is the running example: growing up near a college may make schooling easier, but the IV argument says proximity should affect wages only through the extra schooling it causes.`,
        `The instrument acts like a small natural experiment. It does not force everyone to take the treatment. It nudges some people. If the nudge is independent of the hidden confounder and touches the outcome only through treatment, the outcome gap between instrument groups is caused by the treatment movement that the instrument produced. The estimator then divides the outcome movement by the treatment movement.`,
      ],
    },
    {
      heading: `Three assumptions`,
      paragraphs: [
        `A valid instrument needs relevance, independence, and exclusion. Relevance means the instrument actually moves the treatment. On this page, near-college status increases schooling by 2.0 years. That first-stage effect is measurable, and weak relevance is a warning sign.`,
        `Independence means the instrument is as-good-as-random with respect to the confounders. Near and far students must not differ in ability in a way that also affects wages. Exclusion means the instrument affects the outcome only through the treatment. Living near a college must not raise wages directly through richer neighborhoods, local labor markets, family background, or networks. Exclusion is usually the hardest assumption because it cannot be proven by the outcome data alone.`,
      ],
    },
    {
      heading: `Mechanism: the Wald ratio`,
      paragraphs: [
        `With one binary instrument and one treatment, the Wald estimator is one division. First measure the reduced form: how much the outcome differs between instrument groups. In the page's synthetic data, mean wage is 6.0 units higher for the near-college group. Then measure the first stage: how much the treatment differs between instrument groups. Schooling is 2.0 years higher for the near-college group.`,
        `The IV estimate is 6.0 divided by 2.0, which gives 3.00. The ratio asks: how much outcome changed per unit of treatment moved by the instrument? In this controlled world the answer equals the true schooling effect exactly, while the naive regression remains biased upward. The arithmetic is simple because the assumptions did the heavy work.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The first view proves why ordinary regression is trapped. The hidden ability variable raises schooling and wage at the same time. Because ability has no dataset column, the usual adjustment move is unavailable. The regression slope is not merely noisy; it is pointed at the wrong causal path.`,
        `The instrument view proves the escape route. The instrument moves schooling, the instrument is balanced with respect to ability, and the instrument has no direct route to wage. The Wald view then shows the two clean differences and their ratio. The fine-print view proves why the method can still fail: weak first stages amplify mistakes, and the answer is local to the people whose treatment changed because of the instrument.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The difference in outcomes between instrument groups is clean only if the instrument is independent of hidden confounders. In that case, the groups differ because of the instrument, not because one group had higher ability. The exclusion restriction then says the instrument's only way to change the outcome is by changing the treatment.`,
        `Those two claims convert the outcome difference into the effect of the treatment movement caused by the instrument. Dividing by the first stage changes the scale from effect of the nudge to effect per unit of treatment. This is why the unobserved confounder can remain unobserved. It is not estimated. It cancels because the comparison is built around the instrument rather than around the confounded treatment.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The statistical formula is cheap. The design argument is expensive. You need to discover a real source of variation, show that it strongly changes treatment, defend independence, and explain why exclusion is credible in the domain. The best IV papers are often remembered less for algebra than for the quality of the found lottery.`,
        `Precision can also be costly. An instrument may move only a small part of the population, so estimates can be noisy. Adding controls can improve credibility or precision, but controls do not rescue a broken exclusion argument. IV trades one kind of assumption for another: it avoids adjusting for an unmeasured confounder by requiring a valid source of exogenous treatment variation.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Instrumental variables win when randomization is unavailable, confounding is serious, and a plausible natural experiment exists. Famous examples include the Vietnam draft lottery for military service, quarter of birth for schooling under compulsory attendance laws, distance to college for education access, judge leniency for incarceration or treatment assignment, and rainfall as a shock to agricultural income.`,
        `Judge-leniency designs show the pattern well. Courts may randomly assign cases to judges, judges differ in harshness, and that harshness changes the chance of incarceration. If assignment is truly random and judge harshness affects later outcomes only through incarceration, the design can estimate the causal effect for defendants whose incarceration status depended on which judge they drew.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `Weak instruments are dangerous because the estimator divides by the first stage. If the instrument barely moves treatment, sampling noise and small exclusion violations become large in the ratio. A direct 0.5-unit leak from instrument to outcome creates only 0.25 bias when the first stage is 2.0, but it creates 5.0 bias when the first stage is 0.1.`,
        `Exclusion failures are more conceptual. Distance to college may correlate with family wealth or labor markets. Quarter of birth may correlate with seasonality or school-entry patterns beyond education. Judge assignment may not be random for every case type. The data can show a strong first stage, but it cannot automatically prove that no private path from instrument to outcome exists.`,
      ],
    },
    {
      heading: `LATE fine print`,
      paragraphs: [
        `IV usually estimates a Local Average Treatment Effect. The effect applies to compliers: people whose treatment changed because of the instrument. Near-college IV estimates the return for students whose schooling changed because they lived near a college. It does not directly estimate the effect for students who would attend college regardless or never attend regardless.`,
        `This is not a technical footnote. If compliers differ from everyone else, the IV answer can be true and still not be the population average. The method answers a precise question: what was the causal effect for the people moved by this nudge? A careful write-up names that population instead of pretending the estimate speaks for everyone.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study next: Causal Graphs, Confounding, and Simpson's Paradox for the backdoor problem; A/B Testing and p-values for true randomized assignment; Difference-in-Differences for policy shocks over time; Doubly Robust Estimation for measured-confounder adjustment; Regression Discontinuity for threshold-based natural experiments; and Importance Sampling and Off-Policy Estimation for related ideas in policy evaluation.`,
      ],
    },
  ],
};
