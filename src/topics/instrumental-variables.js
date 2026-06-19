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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation builds a synthetic world where every equation is visible. Ability (unobserved by the analyst) drives both schooling and wages. The true causal effect of one extra year of schooling is exactly 3, written into the data generator. Active cells mark the current estimator being computed. Removed cells flag biased results. Found cells mark the recovered causal effect.',
        'The first view shows the confounding trap: naive OLS returns roughly 5.92 instead of 3, because ability inflates the slope. The second view walks through famous instruments, the weak-instrument amplification, and the LATE interpretation. At each frame, check: which comparison is being made, what assumption licenses it, and what would break if that assumption failed.',
        {
          type: 'diagram',
          text: 'Z (instrument)  --->  S (treatment)  --->  W (outcome)\n                          ^                       ^\n                          |                       |\n                          +---  A (confounder) ---+\n                               (UNOBSERVED)\n\nZ = near college,  S = years of schooling,  W = wage\nA = ability (never in the dataset)\n\nValid instrument: Z -> S -> W exists,  Z -> W directly does NOT exist,\nZ is independent of A.',
          label: 'The IV causal DAG',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Philip Wright needed the supply elasticity of flaxseed in 1928. Price and quantity move together in the data, but supply shifts and demand shifts both cause that movement. Regressing quantity on price confounds the two curves. Wright found a variable -- a weather shock -- that shifted supply without independently shifting demand. That variable let him trace one curve while the other held still. The technique he invented is instrumental variables.',
        'The problem generalizes far beyond economics. You want the causal effect of schooling on wages, but ability confounds both. You want the effect of incarceration on reoffending, but judges, defendants, and crime severity tangle together. You want the effect of military service on earnings, but volunteers differ from conscripts. In each case, the confounder is unmeasured or unmeasurable, randomization is impossible, and the backdoor path cannot be blocked by adjustment. IV exists because some causal questions cannot be answered by any amount of careful regression on the available columns.',
        {
          type: 'quote',
          text: 'God has given us two instruments with which to do his work on earth, the natural experiment and the randomized controlled trial.',
          attribution: 'Attributed to various econometricians, paraphrasing the IV philosophy',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Regress the outcome on the treatment. In the schooling example: fit wage = a + b * schooling, read off the slope b, and call it the return to education. The method is simple, uses all available rows, and produces a confident-looking standard error. In this page\'s synthetic data, OLS gives a slope of about 5.92.',
        'The slope is wrong by nearly double. Ability raises both schooling and wages. Kids with higher ability study longer AND earn more regardless of how long they study. OLS cannot separate the causal pathway (schooling causes higher wages) from the confounding pathway (ability causes both). The backdoor fix from causal graphs -- condition on the confounder -- requires the confounder to appear as a column in the dataset. Ability lives in people\'s heads. No dataset records it. Adding more rows, more covariates, or more flexible functional forms cannot fix a variable that was never measured.',
        {
          type: 'note',
          text: 'OLS bias direction depends on the confounder structure. Here ability has positive effects on both schooling and wages, so OLS overshoots. If the confounder pushed treatment and outcome in opposite directions, OLS would undershoot. The sign of the bias is not guaranteed without knowing the DAG.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the unmeasured confounder. Standard causal inference says: identify every path from treatment to outcome that runs through a common cause, then block those paths by conditioning. This requires the common cause to be observable. When the confounder is unobserved, no amount of statistical adjustment can block the backdoor path. The bias is structural, not statistical.',
        'Concretely: ability enters the schooling equation (smarter kids study more) and the wage equation (smarter people earn more independently of schooling). Any regression of wage on schooling picks up both the direct effect of schooling and the spurious correlation through ability. The bias does not shrink with more data. It does not disappear with nonlinear models. It is baked into the joint distribution of the observed variables. You need a fundamentally different identification strategy -- one that does not require observing or adjusting for the confounder at all.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Find a variable Z (the instrument) that nudges the treatment but has no private path to the outcome. In the schooling example, Z = "grew up near a college." Proximity to a college makes higher education more accessible (relevance) but, the argument goes, does not directly raise wages through any other channel (exclusion). The instrument partitions the population into groups that differ in treatment intensity for reasons unrelated to the confounder.',
        'The Wald estimator is one division. Compute two differences: the reduced-form difference (mean wage of near-college minus mean wage of far-college) and the first-stage difference (mean schooling of near-college minus mean schooling of far-college). Divide the first by the second. In this page\'s data: reduced form = 6.0 wage units, first stage = 2.0 years, ratio = 3.00 -- the true causal effect, recovered exactly, with ability still unobserved.',
        'Two-stage least squares (2SLS) generalizes this to continuous instruments and multiple covariates. Stage 1: regress the treatment on the instrument (and controls) to get predicted treatment values. Stage 2: regress the outcome on the predicted treatment values. The predicted values contain only the variation in treatment caused by the instrument, so the confounding variation is purged.',
        {
          type: 'code',
          language: 'python',
          text: '# Two-stage least squares in NumPy\nimport numpy as np\n\ndef tsls(Y, D, Z, X=None):\n    """IV estimate via 2SLS.\n    Y: outcome (n,)   D: treatment (n,)   Z: instrument(s) (n,k)\n    X: controls (n,p) or None\n    Returns: IV coefficient on D.\n    """\n    n = len(Y)\n    # Build first-stage regressors: [Z, X, intercept]\n    W = np.column_stack([Z, X, np.ones(n)]) if X is not None \\\n        else np.column_stack([Z, np.ones(n)])\n\n    # Stage 1: regress D on instruments + controls\n    beta1 = np.linalg.lstsq(W, D, rcond=None)[0]\n    D_hat = W @ beta1   # predicted treatment\n\n    # Stage 2: regress Y on predicted treatment + controls\n    R = np.column_stack([D_hat, X, np.ones(n)]) if X is not None \\\n        else np.column_stack([D_hat, np.ones(n)])\n    beta2 = np.linalg.lstsq(R, Y, rcond=None)[0]\n    return beta2[0]      # coefficient on D_hat = IV estimate',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The instrument creates two groups that are balanced on the unobserved confounder (independence) and differ in treatment exposure for exogenous reasons. Any outcome difference between these groups must therefore flow through the treatment, because the instrument has no other route to the outcome (exclusion). The reduced form captures the instrument\'s total downstream effect on the outcome. The first stage captures how hard the instrument pushed the treatment. Dividing rescales the lottery\'s effect into a per-unit-of-treatment effect.',
        'Algebraically, the Wald ratio equals Cov(Y, Z) / Cov(D, Z). The instrument Z is uncorrelated with the confounder A (independence), so the numerator contains only the causal component of Y that runs through D. The denominator normalizes by how much Z moved D. The confounder cancels from both quantities because it is orthogonal to Z by assumption. This is why IV does not need to estimate, measure, or model the confounder -- it constructs a comparison where the confounder is irrelevant.',
        {
          type: 'note',
          text: 'The exclusion restriction (no direct Z -> Y path) cannot be tested from data. It is a domain argument, not a statistical test. Every IV debate is ultimately a debate about whether the instrument has a private channel to the outcome. The math is the easy part.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computationally, 2SLS is two OLS regressions: O(nk^2) for the first stage and O(np^2) for the second, where k is the number of instruments and p is the number of second-stage regressors. This is trivial for any dataset that fits in memory. The real cost is not computational but epistemic.',
        'Finding a valid instrument requires domain expertise, institutional knowledge, and creative observation. The exclusion argument must be defended qualitatively. Standard errors are larger than OLS because IV uses only the instrument-driven variation in treatment, discarding the rest. Weak instruments (small first-stage F-statistic) inflate variance and bias. The folk rule is F > 10 for a single endogenous regressor (Stock & Yogo 2005), but modern practice uses effective F-statistics and weak-instrument-robust confidence intervals.',
        {
          type: 'table',
          headers: ['Method', 'Handles unmeasured confounders?', 'Key assumption', 'What it estimates', 'Main weakness'],
          rows: [
            ['OLS', 'No -- biased when confounders are omitted', 'No omitted variables (all confounders measured)', 'Conditional mean association (not causal if confounded)', 'Cannot separate causal from spurious correlation'],
            ['IV / 2SLS', 'Yes -- the core use case', 'Exclusion restriction + relevance + independence', 'LATE (Local Average Treatment Effect for compliers)', 'Weak instruments amplify bias; exclusion is untestable'],
            ['Control function', 'Yes -- models the confounder\'s residual', 'Correct first-stage specification + joint normality or known error distribution', 'ATE under distributional assumptions', 'Sensitive to functional-form misspecification'],
            ['Regression discontinuity', 'Yes -- near the cutoff', 'Continuity of potential outcomes at the threshold', 'LATE at the cutoff', 'Identifies effect only at one point; requires sharp threshold'],
          ],
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'IV wins when three conditions align: randomization is impossible, the confounder is unmeasured, and nature or institutions have already produced a lottery. The Vietnam draft lottery (Angrist 1990) is the textbook case: draft numbers were drawn from a literal urn, creating random variation in military service that is independent of ability, ambition, or health. Distance to college (Card 1995) exploits geographic variation in access to higher education. Judge leniency (Kling 2006, many successors) exploits random case assignment across judges who differ in sentencing harshness.',
        'The method extends beyond economics. In epidemiology, Mendelian randomization uses genetic variants as instruments for exposures (e.g., a gene variant that affects alcohol metabolism instruments for drinking behavior). In political science, rainfall instruments for economic shocks when studying the effect of income on conflict. In each domain, the creativity is in finding the lottery; the estimator is the same ratio.',
        {
          type: 'bullets',
          items: [
            'Vietnam draft lottery: effect of military service on lifetime earnings (Angrist 1990)',
            'Quarter of birth: returns to education via compulsory schooling laws (Angrist & Krueger 1991)',
            'Distance to college: returns to education via geographic access (Card 1995)',
            'Judge leniency: effect of incarceration on reoffending and employment (Kling 2006)',
            'Rainfall shocks: income\'s effect on civil conflict (Miguel, Satyanath & Sergenti 2004)',
            'Mendelian randomization: genetic variants as instruments for health exposures',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Weak instruments are the first failure mode. The Wald ratio divides by the first stage. If the instrument barely moves treatment, the denominator is near zero. A small exclusion violation of 0.5 wage units creates 0.25 bias when the first stage is 2.0 years (0.5 / 2.0), but 5.0 bias when the first stage is 0.1 years (0.5 / 0.1) -- larger than the true effect of 3. Weakness does not just add noise; it amplifies every imperfection in the exclusion argument. Quarter-of-birth was famously challenged (Bound, Jaeger & Baker 1995) on exactly these grounds.',
        'Exclusion violations are the second. Distance to college may correlate with family wealth, local labor markets, or neighborhood quality -- all of which affect wages independently of schooling. Judge leniency may not be truly random if experienced lawyers steer cases. These are domain arguments, not statistical tests. No diagnostic can prove exclusion from the outcome data alone.',
        'The LATE interpretation (Imbens & Angrist 1994, Angrist & Imbens 1996) is the third. IV identifies the effect only for compliers: people whose treatment status was actually changed by the instrument. Always-takers (who would take treatment regardless) and never-takers (who would not regardless) contribute no identifying variation. If compliers differ from the population -- and they usually do -- the IV estimate is exactly right about a subgroup you cannot directly identify and silent about everyone else. This is not a flaw; it is a price tag. The estimate answers: "what was the effect for people the lottery actually moved?" A careful paper names that population explicitly.',
        {
          type: 'note',
          text: 'The monotonicity assumption (no defiers -- nobody does the opposite of what the instrument pushes) is required for the LATE interpretation. If some people are nudged toward treatment by the instrument while others are nudged away, the Wald ratio conflates positive and negative complier effects and may not correspond to any well-defined causal parameter.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Wright, P.G. (1928). The Tariff on Animal and Vegetable Oils -- Appendix B. The founding IV derivation, using supply-demand identification.',
            'Angrist, J.D. (1990). "Lifetime Earnings and the Vietnam Era Draft Lottery." The modern IV template: a literal lottery as the instrument.',
            'Angrist, J.D. & Krueger, A.B. (1991). "Does Compulsory School Attendance Affect Schooling and Earnings?" Quarter-of-birth as instrument; later challenged for weak-instrument problems.',
            'Card, D. (1995). "Using Geographic Variation in College Proximity to Estimate the Return to Schooling." The running example on this page.',
            'Imbens, G.W. & Angrist, J.D. (1994). "Identification and Estimation of Local Average Treatment Effects." The LATE theorem: IV identifies the complier effect under monotonicity.',
            'Angrist, J.D. & Imbens, G.W. (1996). Two-Stage Least Squares Estimation of Average Causal Effects in Models with Variable Treatment Intensity. Extension to multi-valued treatments and general 2SLS.',
            'Stock, J.H. & Yogo, M. (2005). "Testing for Weak Instruments in Linear IV Regression." The F > 10 rule and formal weak-instrument tests.',
            'Bound, J., Jaeger, D.A. & Baker, R.M. (1995). "Problems with Instrumental Variables Estimation When the Correlation Between the Instruments and the Endogenous Explanatory Variable Is Weak." The weak-instrument critique.',
            'Angrist, J.D. & Pischke, J.-S. (2009). Mostly Harmless Econometrics. The standard graduate reference for IV, 2SLS, and LATE.',
          ],
        },
        {
          type: 'table',
          headers: ['Direction', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Causal Graphs, Confounding & Simpson\'s Paradox', 'The backdoor criterion explains why adjustment works when confounders are measured -- and why IV is needed when they are not'],
            ['Prerequisite', 'A/B Testing & p-values', 'Randomized experiments sever confounding by design; IV recovers a similar comparison from observational data'],
            ['Extension', 'Regression Discontinuity', 'Another natural-experiment design that exploits a threshold instead of an instrument'],
            ['Extension', 'Difference-in-Differences', 'Panel-data identification using time variation; often combined with IV'],
            ['Extension', 'Doubly Robust Estimation', 'When confounders ARE measured, doubly robust methods combine regression and weighting for added protection'],
          ],
        },
      ],
    },
  ],
};

