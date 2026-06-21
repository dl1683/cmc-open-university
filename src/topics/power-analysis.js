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
        '"Sizing the experiment, live" sweeps sample size and draws the power curve. The removed marker is the underpowered starting point; the found marker is the 80% convention. The lift table shows how required n scales with effect size. At each frame, read the number first, then the explanation -- the number is the claim, the explanation is the proof.',
        {
          type: 'note',
          text: 'Every number in both views is computed live from the two-proportion power formula, not hard-coded. Change the baseline or the lift in the code and every cell updates.',
        },
      
        {type: 'image', src: './assets/gifs/power-analysis.gif', alt: 'Animated walkthrough of the power analysis visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The power of a statistical test is the probability that it will yield statistically significant results. Since statistical tests are done in order to yield results, a test\'s power is obviously an important characteristic of it.',
          attribution: 'Jacob Cohen, Statistical Power Analysis for the Behavioral Sciences (1988)',
        },
        'An experiment can return "no significant difference" for two completely different reasons: the treatment genuinely does nothing, or the experiment was too small to see what the treatment does. A p-value after the fact cannot separate those stories. Power analysis exists to answer the question before any data arrives: given the effect size you care about, what is the probability that this design will detect it?',
        'Without that calculation, teams routinely run experiments that have a 10-15% chance of catching real improvements. They interpret null results as evidence against the feature, shelve genuine wins, and waste weeks of traffic on rituals that were structurally doomed before the first user was enrolled. Power analysis converts "let\'s run it for two weeks and see" into an engineering specification.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to pick a sample size by calendar -- "run for two weeks" -- or by gut -- "2,000 per arm should be enough." Teams reach for this because it is fast, requires no math, and fits neatly into sprint planning. If the effect is large, the test works fine, and the team concludes that planning is unnecessary.',
        'The approach breaks on small effects. Conversion is a Bernoulli outcome: each user either converts or does not. When baseline conversion is 5%, most observations are zeros, and the sampling wobble in a difference of proportions is large relative to a 0.5 percentage-point true lift. At n = 2,000 per arm, the standard error swamps the signal. The experiment is not cautious; it is a coin flip biased toward "no effect found."',
        'Calendar-based stopping also invites peeking. If the p-value looks close, the team runs a bit longer; if it crosses 0.05, they stop and celebrate. Unless the test was designed for sequential monitoring, each peek inflates the false-positive rate. The design decision lands at the end of the experiment, after the traffic budget is already spent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the inverse-square law of experiments. The standard error of a difference shrinks as 1/sqrt(n), so to detect half the effect you need roughly four times the sample. A 50% relative lift on a 5% baseline needs about 1,500 users per arm; a 5% relative lift needs about 122,000. Most teams discover this only after collecting data, when the confidence interval is embarrassingly wide.',
        {
          type: 'bullets',
          items: [
            'Significant when the effect is real: true positive, counted by power = 1 - beta.',
            'Significant when the effect is absent: false positive, controlled by alpha.',
            'Not significant when the effect is real: false negative, counted by beta.',
            'Not significant when the effect is absent: true negative, a correct non-rejection.',
          ],
        },
        'Alpha (the false-positive rate) gets all the cultural attention because p < 0.05 is the threshold everyone memorizes. Beta (the false-negative rate) is equally dangerous but invisible: when power is 10%, the experiment discards 90% of real improvements. Worse, the rare significant results from underpowered tests are systematically inflated -- the winner\'s curse -- because only lucky overestimates clear the significance bar. This is a primary driver of the replication crisis in science and the "exciting result that melts on relaunch" pattern in product experimentation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Power analysis connects four quantities: alpha (false-alarm rate), power (1 - beta, the detection rate), effect size (the smallest difference worth finding), and sample size n. Fix any three and the fourth is determined. The standard workflow is: set alpha = 0.05 by convention, set power = 0.80 by convention, choose the minimum detectable effect as a business decision, and solve for n.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation bands marked around the mean', caption: 'Power analysis is a signal-to-noise calculation over sampling distributions; more sample size narrows uncertainty slowly. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'For a two-sample test of proportions with baseline p1 and treatment p2, the required n per arm is approximately ((z_alpha + z_beta)^2 * (p1(1-p1) + p2(1-p2))) / (p2 - p1)^2, where z_alpha = 1.96 for two-sided 5% and z_beta = 0.8416 for 80% power. The module computes this live.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Required sample size per arm for a two-sample t-test\n// alpha: significance level (two-sided)\n// power: target power (e.g. 0.80)\n// d: Cohen\'s d = (mu1 - mu2) / sigma_pooled\nfunction requiredN(alpha, power, d) {\n  // z-quantiles from normal CDF inverse\n  const zAlpha = 1.96;   // for alpha = 0.05 two-sided\n  const zBeta  = 0.8416; // for power = 0.80\n  // Each arm needs this many observations:\n  const nPerArm = Math.ceil(\n    2 * ((zAlpha + zBeta) / d) ** 2\n  );\n  return nPerArm;\n}\n// Example: detect d = 0.2 (small effect)\nrequiredN(0.05, 0.80, 0.2);  // => 394 per arm\n// Example: detect d = 0.5 (medium effect)\nrequiredN(0.05, 0.80, 0.5);  // => 64 per arm\n// Example: detect d = 0.8 (large effect)\nrequiredN(0.05, 0.80, 0.8);  // => 26 per arm',
        },
        'Cohen classified effect sizes into small (d = 0.2), medium (d = 0.5), and large (d = 0.8) for the two-sample t-test. Analogous conventions exist for other test families: Cohen\'s f for ANOVA, Cohen\'s w for chi-squared, and r for correlation. These benchmarks are starting points, not substitutes for thinking about what effect size matters in your domain. A d = 0.2 difference in drug efficacy might save thousands of lives; a d = 0.8 difference in button color preference might be worthless.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {
          type: 'diagram',
          label: 'Overlapping distributions: null vs. alternative hypothesis',
          text: '           Null (H0)              Alternative (H1)\n           mu = 0                  mu = delta\n\n      |         |                  |         |\n      |  .--.   |   alpha/2        |   .--.  |\n      | /    \\  |   ------->       |  /    \\ |\n     /  |    | \\|  |         beta  | /  |   \\|\n   /    |    |  \\  |  <----------- |/   |    \\\n  /     |    |   \\ |               /    |     \\\n /      |    |    \\|              /|    |      \\\n--------+----+-----+---->  ------+-----+-------+---->\n        0   z_crit  |             0   z_crit\n                    |             |<-- power -->|\n             rejection            beta is the\n              region              shaded area\n                                  under H1 left\n                                  of z_crit',
        },
        'Power analysis works because both the null and alternative distributions are known before data arrives. Under H0, the test statistic is centered at zero; under H1, it is shifted by an amount proportional to the effect size times sqrt(n). The critical value z_crit carves the null distribution into rejection and non-rejection regions. Power is the area of the alternative distribution that falls in the rejection region.',
        'As n increases, the alternative distribution shifts further right (the signal-to-noise ratio improves), and more of its area lands past z_crit. As the effect size shrinks, the shift shrinks, and the two distributions overlap more. The entire calculation reduces to computing areas under normal curves at known locations -- which is why the formula is simple algebra rather than simulation.',
        'This does not predict the result of any single experiment. It predicts the long-run detection rate of a design. An 80%-powered test still misses 20% of the time. But making the miss rate explicit before launch prevents the dangerous post-hoc excuse: "we did not find anything, so the effect must not exist."',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computation itself is trivial -- a closed-form expression evaluated in microseconds. The real cost is the sample size it demands. Detecting a 10% relative lift on a 5% conversion baseline at 80% power requires roughly 31,000 users per arm -- 62,000 total. For a site with 1,000 daily visitors, that is two months of traffic on a single binary experiment.',
        {
          type: 'bullets',
          items: [
            '50 percent relative lift: about 2.5 percentage points, roughly 1,500 users per arm and 3,000 total.',
            '20 percent relative lift: about 1.0 percentage point, roughly 8,000 users per arm and 16,000 total.',
            '10 percent relative lift: about 0.5 percentage points, roughly 31,000 users per arm and 62,000 total.',
            '5 percent relative lift: about 0.25 percentage points, roughly 122,000 users per arm and 244,000 total.',
          ],
        },
        'The second cost is commitment. A power calculation forces you to declare a primary metric, a minimum effect, and a stopping rule before launch. That discipline feels restrictive but is the cure for peeking and p-hacking. The pre-registered n defines when the experiment ends, removing the temptation to stop on a lucky day.',
        'The third cost is convention versus stakes. Eighty percent power and 5% alpha are defaults, not laws. A cheap, reversible UI tweak may tolerate 60% power. A clinical trial or infrastructure migration may need 90% power and 1% alpha. Power analysis makes those choices explicit rather than hiding them under a single p-value.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Product A/B testing: converts "run it for two weeks" into a calculated traffic budget. Prevents shipping decisions based on underpowered null results.',
            'Clinical trials: regulatory agencies (FDA, EMA) require power calculations in trial protocols. Underpowered trials are both scientifically wasteful and ethically problematic -- they expose patients to risk without generating actionable evidence.',
            'Survey design and polling: determines how many respondents are needed to detect a difference of a given size between groups, preventing expensive data collection that cannot answer the question.',
            'ML benchmark evaluation: when comparing model A to model B on a noisy metric, power analysis tells you how many evaluation runs or test examples are needed before a 0.5% accuracy difference is reliably distinguishable from noise.',
            'Variance reduction justification: techniques like CUPED, stratification, and covariate adjustment reduce the effective variance, which is equivalent to increasing n. Power analysis quantifies exactly how much traffic each technique saves.',
          ],
        },
        'The common thread is any setting where data is expensive, decisions are binary (ship or do not ship, approve or reject), and the effect of interest is small relative to noise. Power analysis is most valuable precisely when intuition about "enough data" is worst: rare events, small lifts, high-variance outcomes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Power analysis assumes the design is unbiased. A huge confounded experiment is still confounded; more data does not fix bad identification. If treatment assignment correlates with an unmeasured variable, the test has power to detect a spurious effect, not the causal one. Causal Graphs, Confounding and Simpson\'s Paradox explains why sample size and causal validity are separate problems.',
        'It fails when inputs are fictional. The formula needs a baseline rate, a variance estimate, and a minimum detectable effect. If any of these are wrong -- because the baseline shifted, attrition was higher than expected, users are clustered, or the team inflated the expected effect to get an affordable n -- the resulting sample size is wrong. "Garbage in, garbage out" is the most common failure mode in practice.',
        'It fails for exploratory analysis. Power analysis is designed for a single pre-specified test. When teams run dozens of metrics, segments, and subgroup analyses on the same data, the per-test alpha no longer controls the family-wise error rate. Multiple Testing and False Discoveries covers the corrections needed when the dashboard has many endpoints.',
        {
          type: 'note',
          text: 'A subtle misuse is computing power after the experiment (post-hoc power). Observed power is a deterministic function of the p-value and adds no information. If p = 0.25, post-hoc power will be low by construction. The calculation is only useful as a planning tool before data collection.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Jacob Cohen, Statistical Power Analysis for the Behavioral Sciences, 2nd edition (1988) -- the foundational reference. Defines effect-size conventions (d, f, r, w), derives power formulas for t-tests, ANOVA, chi-squared, and correlation, and argues that power deserves equal billing with alpha.',
            'John P.A. Ioannidis, "Why Most Published Research Findings Are False" (2005) -- demonstrates how low power, combined with researcher degrees of freedom, generates a literature dominated by false positives and inflated estimates.',
            'Georgi Georgiev, Statistical Methods in Online A/B Testing (2019) -- practical treatment of power analysis for product experimentation, covering CUPED, sequential testing, and minimum detectable effects in the conversion-rate setting.',
          ],
        },
        'Study A/B Testing and p-values for the single-test decision rule that power analysis calibrates. Study Confidence Intervals and the Bootstrap for what to report after the experiment concludes -- power determines if you can see; intervals report what you saw, with honest width. Study Multiple Testing and False Discoveries for the corrections needed when a dashboard runs many tests simultaneously. Study Causal Graphs, Confounding and Simpson\'s Paradox to understand why precision (which power controls) and identification (which design controls) are separate problems. For adaptive alternatives, study Multi-Armed Bandits and Thompson Sampling, where traffic allocation responds to incoming data rather than committing to a fixed n.',
      ],
    },
  ],
};
