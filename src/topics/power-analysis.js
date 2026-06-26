// Power analysis: before you run the experiment, compute whether it can
// even SEE the effect you're hunting. Underpowered tests are coin flips
// with dashboards — and this module does the arithmetic live.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'power-analysis',
  title: 'Statistical Power & Sample Size',
  category: 'Concepts',
  summary: 'Can your experiment even SEE the effect it hunts? Power computed live — and the n it demands will surprise you.',
  controls: [
    { id: 'view', label: 'Plan', type: 'select', options: ['the coin-flip experiment', 'sizing the experiment, live'], defaultValue: 'the coin-flip experiment' },
  ],
  run,
};

// Normal CDF via the Abramowitz–Stegun erf approximation.
const erf = (x) => {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
// Two-proportion test, alpha = 0.05 two-sided: P(detect | true lift exists).
const power = (p1, p2, n) => {
  const se = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / n);
  return Phi(Math.abs(p2 - p1) / se - 1.96);
};
const nFor = (p1, p2) => Math.ceil(((1.96 + 0.8416) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2);

function* coinFlip() {
  yield {
    state: matrixState({
      title: 'The plan: test a REAL 10% improvement with 2,000 users per arm',
      rows: [
        { id: 'base', label: 'control conversion' },
        { id: 'treat', label: 'treatment (truly better!)' },
        { id: 'n', label: 'users per arm' },
      ],
      columns: [{ id: 'val', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '5.0%', '5.5% — a genuine 10% relative lift', '2,000 (about a week of traffic)'][v],
    }),
    highlight: { active: ['treat:val'] },
    explanation: 'Set the stage with a luxury real experiments never get: WE know the truth. The new checkout flow genuinely converts 5.5% against the old 5.0% — a real 10% relative improvement, worth millions at scale. The team runs the standard playbook from A/B Testing & p-values: 2,000 users per arm, significance at p < 0.05. The question this page exists to ask — BEFORE any data arrives: what is the probability this experiment actually DETECTS the improvement that is truly there? That probability has a name: STATISTICAL POWER.',
  };

  yield {
    state: matrixState({
      title: 'Power at n = 2,000 — computed live',
      rows: [
        { id: 'detect', label: 'experiment finds the real win' },
        { id: 'miss', label: 'experiment shrugs: "not significant"' },
      ],
      columns: [{ id: 'p', label: 'probability' }],
      values: [[power(0.05, 0.055, 2000) * 100], [(1 - power(0.05, 0.055, 2000)) * 100]],
      format: (v) => `${v.toFixed(1)}%`,
    }),
    highlight: { removed: ['miss:p'], compare: ['detect:p'] },
    explanation: `The module just ran the arithmetic (two-proportion test, α = 0.05): power = ${(power(0.05, 0.055, 2000) * 100).toFixed(1)}%. Read it and wince: a GENUINELY better feature survives this experiment one time in ten. The other ${((1 - power(0.05, 0.055, 2000)) * 100).toFixed(0)}% of the time, the dashboard says "no significant difference," the feature is shelved, and a real improvement dies — killed not by the data but by an experiment too small to see it. Why so weak? The signal (Î” = 0.5 points) is tiny against the noise (conversion is a rare event; its sampling wobble at n = 2,000 swamps half-point differences). An underpowered experiment is not cautious — it is a ritual that discards true discoveries.`,
    invariant: 'Power = P(p < α | the effect is real): below ~50%, the experiment is a coin flip biased toward "no".',
  };

  yield {
    state: matrixState({
      title: 'The winner\'s curse: what an underpowered "win" looks like',
      rows: [
        { id: 'truth', label: 'the true lift' },
        { id: 'needed', label: 'lift needed to reach p < 0.05 at n = 2,000' },
        { id: 'reported', label: 'so the wins you DO see report…' },
      ],
      columns: [{ id: 'val', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '+0.5 points (the honest 10%)', 'â‰¥ +1.4 points — nearly 3Ã— the truth', 'wildly exaggerated effects, by selection'][v],
    }),
    highlight: { removed: ['reported:val'] },
    explanation: 'And the rare times an underpowered test DOES flash significant, a subtler trap springs: at n = 2,000, crossing the p < 0.05 line requires an OBSERVED gap of about 1.4 points — almost triple the true 0.5. So the only runs that "win" are the ones where sampling luck inflated the effect; the published estimate is guaranteed exaggerated. This is the WINNER\'S CURSE (the significance filter), and it is why small-study effects melt on replication — in product experiments and in science\'s replication crisis alike. Low power doesn\'t just miss truths; it systematically distorts the ones it catches.',
    invariant: 'Underpowered + significant â‡’ overestimated: only lucky draws clear the bar, and luck inflates.',
  };
}

function* sizingLive() {
  const NS = [500, 1000, 2000, 5000, 10000, 20000, 31000, 50000];
  yield {
    state: plotState({
      axes: { x: { label: 'users per arm' }, y: { label: 'power (%)' } },
      series: [{ id: 'curve', label: 'power to detect 5.0% â†’ 5.5%', points: NS.map((n) => ({ x: n, y: power(0.05, 0.055, n) * 100 })) }],
      markers: [
        { id: 'weak', x: 2000, y: power(0.05, 0.055, 2000) * 100, label: 'the coin flip' },
        { id: 'standard', x: 31000, y: 80, label: '80% — the convention' },
      ],
    }),
    highlight: { removed: ['weak'], found: ['standard'] },
    explanation: `The power curve, computed live across sample sizes: ${(power(0.05, 0.055, 2000) * 100).toFixed(0)}% at 2,000 per arm, ${(power(0.05, 0.055, 10000) * 100).toFixed(0)}% at 10,000, crossing the conventional 80% target near 31,000 PER ARM — sixty-two thousand users to reliably detect a 10% relative lift on a 5% baseline. That number shocks every team the first time: detecting small effects on rare events is brutally expensive, and the cost was knowable before a single user was enrolled. That is the entire pitch for power analysis: it converts "let\'s run it for two weeks and see" into an engineering calculation.`,
    invariant: 'Standard target: 80% power at α = 0.05 — an explicit, chosen trade between missed wins and false alarms.',
  };

  const LIFTS = [[0.0525, '5%'], [0.055, '10%'], [0.06, '20%'], [0.075, '50%']];
  yield {
    state: matrixState({
      title: 'The inverse-square law of experiments (5% baseline, 80% power)',
      rows: LIFTS.map(([p2, label]) => ({ id: `l${label}`, label: `detect a ${label} relative lift` })),
      columns: [{ id: 'n', label: 'users per arm' }],
      values: LIFTS.map(([p2]) => [nFor(0.05, p2)]),
      format: (v) => v.toLocaleString('en-US'),
    }),
    highlight: { removed: ['l5%:n'], found: ['l50%:n'] },
    explanation: 'Sweep the effect size and the law reveals itself: halve the lift you hunt, and the required n roughly QUADRUPLES — sample size scales with 1/Î”² (the standard error shrinks only as âˆšn, so the signal-to-noise battle is quadratically unfair). A 50% lift needs 1,500 users; a 5% lift needs 122,000. The practical consequences run both directions: big bold changes can be tested cheaply and fast, while polishing-grade improvements (the 2% tweaks) are detectable only at traffic scales most products never have — which is why mature experimentation platforms at large companies obsess over variance reduction (CUPED, stratification) to claw back effective sample size.',
    invariant: 'n âˆ 1/Î”²: halving the detectable effect quadruples the experiment.',
  };

  yield {
    state: matrixState({
      title: 'The four-way trade — pick three, the fourth is determined',
      rows: [
        { id: 'alpha', label: 'α (false-alarm rate)' },
        { id: 'powerRow', label: 'power (1 âˆ’ miss rate)' },
        { id: 'delta', label: 'effect size Î”' },
        { id: 'nRow', label: 'sample size n' },
      ],
      columns: [{ id: 'role', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'how often "no effect" gets called a win — convention 5%', 'how often a real win gets found — convention 80%', 'the smallest lift you CARE about (a business choice!)', 'falls out of the other three — the budget'][v],
    }),
    highlight: { active: ['delta:role'], found: ['nRow:role'] },
    explanation: 'The planning ritual, distilled: four quantities, one equation, choose three. The deepest of the four is Î” — the MINIMUM DETECTABLE EFFECT — because it is not statistics, it is strategy: "what is the smallest improvement worth shipping?" Answer that, fix the two conventions, and n is arithmetic. Run the ritual before launch and you also inoculate against the peeking disease from A/B Testing & p-values — the pre-registered n defines when the experiment ENDS, removing the temptation to stop on a lucky day (and when you genuinely must monitor continuously, sequential tests spend an explicit α budget per look). Confidence Intervals & the Bootstrap closes the loop after the data arrives: power decides if you can see; intervals report what you saw, with honest width.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the coin-flip experiment') yield* coinFlip();
  else if (view === 'sizing the experiment, live') yield* sizingLive();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "The coin-flip experiment" sets up a scenario where the treatment genuinely works -- a 10% relative lift on a 5% baseline -- then computes the probability that a standard A/B test at n = 2,000 per arm actually detects it. Active cells mark the current calculation. Removed cells mark outcomes the experiment throws away. Compare cells highlight the probability you should be watching.',
        {type: 'callout', text: 'Power is a design-time probability: it says how often this experiment would detect the effect size you claim to care about.'},
        'The sizing view draws the power curve as sample size changes. The safe reading rule is that power describes a design before data arrives, not a confidence score after one run. A found marker at 80% means this design still misses the target effect one time in five.',
        {type: 'image', src: './assets/gifs/power-analysis.gif', alt: 'Animated walkthrough of the power analysis visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An experiment can fail to find a real effect because the effect is absent or because the experiment is too small. A p-value after the fact cannot separate those two stories. Power analysis asks before launch how often a planned design will detect the effect size that matters.',
        'This matters because traffic, patients, survey respondents, and benchmark runs are scarce. A team that runs an experiment with 12% power is mostly buying null results. Power analysis turns "run it for two weeks" into a traffic budget tied to a detectable effect.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is calendar sizing. Pick two weeks, split traffic evenly, and check whether p is below 0.05. This feels practical because it matches planning cycles and requires no statistical design work.',
        'Another common approach is gut sizing. A team chooses 2,000 users per arm because that sounds large. If the effect is huge, the test may work, which hides the problem until the team tries to detect a small but valuable lift.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is sampling noise. A 5% baseline conversion rate means 95 out of 100 users do not convert, so a 0.5 percentage-point lift is a small signal inside many zeros. At n = 2,000 per arm, ordinary binomial wobble is large compared with the effect.',
        'The square-root law makes the wall expensive. Standard error shrinks like 1 / sqrt(n), so detecting half the effect needs about four times the sample. Most teams discover this only after the confidence interval is too wide to support a decision.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Power is the area of the alternative distribution that crosses the rejection threshold. The null distribution describes what the test statistic looks like when the treatment has no effect. The alternative distribution describes what it looks like when the chosen effect size is real.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation bands marked around the mean', caption: 'Power analysis is a signal-to-noise calculation over sampling distributions; more sample size narrows uncertainty slowly. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'Increasing n narrows the sampling distributions and moves the alternative statistic away from zero in standard-error units. Raising the target effect does the same thing. Lowering alpha makes the rejection threshold stricter and reduces power unless n increases.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose alpha, power, baseline variance, and the minimum detectable effect. Alpha is the false-positive rate, often 0.05 for a two-sided test. Power is 1 minus beta, where beta is the false-negative rate for the effect size you care about.',
        'For two proportions, the required n per arm is approximately ((z_alpha + z_beta)^2 * (p1(1-p1) + p2(1-p2))) / (p2 - p1)^2. The formula says the same thing the animation shows: more variance raises n, and a smaller effect raises n sharply. The computation is cheap; the traffic demand is not.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument comes from precomputing both worlds. Under the null hypothesis, the statistic is centered at zero. Under the alternative, it is shifted by the effect size divided by its standard error.',
        'A test rejects when the statistic lands beyond the alpha threshold. Power is the probability that the alternative-world statistic lands beyond that same threshold. This is a long-run property of the design, so an 80% powered experiment still misses the chosen effect 20% of the time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The calculation takes milliseconds, but the sample size can be enormous. A 10% relative lift on a 5% baseline means p1 = 0.050 and p2 = 0.055. At 80% power and two-sided alpha 0.05, the design needs roughly 31,000 users per arm.',
        'The cost behaves quadratically with effect size. If the detectable lift falls from 0.5 percentage points to 0.25 percentage points, n rises by about four times. Power analysis also costs discipline: the metric, effect size, alpha, power, and stopping rule must be declared before launch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Product A/B testing uses power analysis to decide whether a traffic budget can answer a launch question. Clinical trials use it to avoid exposing participants to studies too small to produce evidence. Surveys use it to size comparisons between groups before respondents are recruited.',
        'Machine-learning evaluation uses the same idea when benchmark metrics are noisy. If model A beats model B by 0.2 percentage points on one random split, power analysis asks how many examples or repeated runs are needed before that gap is distinguishable from noise. Variance reduction methods such as CUPED are valuable because reducing variance behaves like increasing n.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Power analysis assumes the design is unbiased. More sample size does not fix confounding, data leakage, nonrandom assignment, or a metric that measures the wrong behavior. A huge biased experiment has high power to find the wrong answer.',
        'It also fails when the inputs are fictional. If the baseline rate shifts, users are clustered, attrition is higher than expected, or the minimum detectable effect was chosen only to make n affordable, the result is false precision. Post-hoc power is another trap because it mostly restates the p-value after the data are already known.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the baseline conversion rate is 5% and the team cares about a 10% relative lift, so treatment conversion is 5.5%. The absolute effect is 0.005. For alpha 0.05 two-sided, z_alpha is 1.96; for 80% power, z_beta is 0.84.',
        'The variance term is 0.05 * 0.95 + 0.055 * 0.945 = 0.0995. The z sum is 2.80, and 2.80 squared is 7.84. The numerator is about 0.780, and dividing by 0.005 squared gives about 31,200 users per arm.',
        'At 2,000 users per arm, the standard error is far larger, so the real lift is usually hidden inside noise. A non-significant result from that design should not be read as evidence that the feature has no 0.5 percentage-point lift. It mostly says the experiment was not built to see one.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Jacob Cohen, Statistical Power Analysis for the Behavioral Sciences, 1988; John P.A. Ioannidis, Why Most Published Research Findings Are False, 2005; and Georgi Georgiev, Statistical Methods in Online A/B Testing, 2019. These sources connect formula design to the practical failure of underpowered studies.',
        'Study next: A/B Testing and p-values for the single-test rule, Confidence Intervals and Bootstrap for reporting uncertainty after the run, Multiple Testing and False Discoveries for dashboards with many endpoints, and Causal Graphs for why identification and precision are separate problems.',
      ],
    },
  ],
};
