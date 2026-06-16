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
    explanation: `The module just ran the arithmetic (two-proportion test, α = 0.05): power = ${(power(0.05, 0.055, 2000) * 100).toFixed(1)}%. Read it and wince: a GENUINELY better feature survives this experiment one time in ten. The other ${((1 - power(0.05, 0.055, 2000)) * 100).toFixed(0)}% of the time, the dashboard says "no significant difference," the feature is shelved, and a real improvement dies — killed not by the data but by an experiment too small to see it. Why so weak? The signal (Δ = 0.5 points) is tiny against the noise (conversion is a rare event; its sampling wobble at n = 2,000 swamps half-point differences). An underpowered experiment is not cautious — it is a ritual that discards true discoveries.`,
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
      format: (v) => ['', '+0.5 points (the honest 10%)', '≥ +1.4 points — nearly 3× the truth', 'wildly exaggerated effects, by selection'][v],
    }),
    highlight: { removed: ['reported:val'] },
    explanation: 'And the rare times an underpowered test DOES flash significant, a subtler trap springs: at n = 2,000, crossing the p < 0.05 line requires an OBSERVED gap of about 1.4 points — almost triple the true 0.5. So the only runs that "win" are the ones where sampling luck inflated the effect; the published estimate is guaranteed exaggerated. This is the WINNER\'S CURSE (the significance filter), and it is why small-study effects melt on replication — in product experiments and in science\'s replication crisis alike. Low power doesn\'t just miss truths; it systematically distorts the ones it catches.',
    invariant: 'Underpowered + significant ⇒ overestimated: only lucky draws clear the bar, and luck inflates.',
  };
}

function* sizingLive() {
  const NS = [500, 1000, 2000, 5000, 10000, 20000, 31000, 50000];
  yield {
    state: plotState({
      axes: { x: { label: 'users per arm' }, y: { label: 'power (%)' } },
      series: [{ id: 'curve', label: 'power to detect 5.0% → 5.5%', points: NS.map((n) => ({ x: n, y: power(0.05, 0.055, n) * 100 })) }],
      markers: [
        { id: 'weak', x: 2000, y: power(0.05, 0.055, 2000) * 100, label: 'the coin flip' },
        { id: 'standard', x: 31000, y: 80, label: '80% — the convention' },
      ],
    }),
    highlight: { removed: ['weak'], found: ['standard'] },
    explanation: `The power curve, computed live across sample sizes: ${(power(0.05, 0.055, 2000) * 100).toFixed(0)}% at 2,000 per arm, ${(power(0.05, 0.055, 10000) * 100).toFixed(0)}% at 10,000, crossing the conventional 80% target near 31,000 PER ARM — sixty-two thousand users to reliably detect a 10% relative lift on a 5% baseline. That number shocks every team the first time: detecting small effects on rare events is brutally expensive, and the cost was knowable before a single user was enrolled. That is the entire pitch for power analysis: it converts "let's run it for two weeks and see" into an engineering calculation.`,
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
    explanation: 'Sweep the effect size and the law reveals itself: halve the lift you hunt, and the required n roughly QUADRUPLES — sample size scales with 1/Δ² (the standard error shrinks only as √n, so the signal-to-noise battle is quadratically unfair). A 50% lift needs 1,500 users; a 5% lift needs 122,000. The practical consequences run both directions: big bold changes can be tested cheaply and fast, while polishing-grade improvements (the 2% tweaks) are detectable only at traffic scales most products never have — which is why mature experimentation platforms at large companies obsess over variance reduction (CUPED, stratification) to claw back effective sample size.',
    invariant: 'n ∝ 1/Δ²: halving the detectable effect quadruples the experiment.',
  };

  yield {
    state: matrixState({
      title: 'The four-way trade — pick three, the fourth is determined',
      rows: [
        { id: 'alpha', label: 'α (false-alarm rate)' },
        { id: 'powerRow', label: 'power (1 − miss rate)' },
        { id: 'delta', label: 'effect size Δ' },
        { id: 'nRow', label: 'sample size n' },
      ],
      columns: [{ id: 'role', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'how often "no effect" gets called a win — convention 5%', 'how often a real win gets found — convention 80%', 'the smallest lift you CARE about (a business choice!)', 'falls out of the other three — the budget'][v],
    }),
    highlight: { active: ['delta:role'], found: ['nRow:role'] },
    explanation: 'The planning ritual, distilled: four quantities, one equation, choose three. The deepest of the four is Δ — the MINIMUM DETECTABLE EFFECT — because it is not statistics, it is strategy: "what is the smallest improvement worth shipping?" Answer that, fix the two conventions, and n is arithmetic. Run the ritual before launch and you also inoculate against the peeking disease from A/B Testing & p-values — the pre-registered n defines when the experiment ENDS, removing the temptation to stop on a lucky day (and when you genuinely must monitor continuously, sequential tests spend an explicit α budget per look). Confidence Intervals & the Bootstrap closes the loop after the data arrives: power decides if you can see; intervals report what you saw, with honest width.',
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
      heading: `What it is`,
      paragraphs: [
        `Statistical power is the chance that an experiment detects a real effect. The visualization gives you a privileged setup: the treatment truly improves conversion from 5.0% to 5.5%, a 10% relative lift. With 2,000 users per arm and a two-sided alpha of 0.05, the computed power is only about 10.5%. In plain English, the real win dies nine times out of ten.`,
        `Power analysis happens before A/B Testing & p-values. You choose alpha, desired power, and the minimum effect worth caring about; the required sample size falls out. This prevents the common ritual of running for two weeks, seeing "not significant," and mistaking an underpowered design for evidence of no effect.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The code uses the standard two-proportion normal approximation. The standard error combines p1(1-p1) and p2(1-p2), then asks how often the observed difference would cross the 1.96 z cutoff if the true gap were 0.5 percentage points. As n grows, the distribution tightens and power climbs. The second view plots that climb: roughly 31,000 users per arm are needed for the conventional 80% power target.`,
        `The inverse-square law is the memorable part. Halve the effect you want to detect and you need about four times the sample. Multiple Testing & False Discoveries makes this harsher because stricter alpha thresholds raise the bar; Confidence Intervals & the Bootstrap shows the same fact after the study as a wide or narrow interval.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computation is instant. The cost is traffic, time, and opportunity. A rare event like 5% conversion has high sampling wobble, so small absolute changes are expensive to see. If your minimum useful lift is 0.1 percentage points, the sample size may be commercially impossible; if a redesign plausibly moves conversion by 20%, the test can be practical.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Product experiments, clinical trials, survey design, and policy evaluations all use power to justify sample sizes before data arrives. Causal Graphs, Confounding & Simpson's Paradox still matters because power cannot rescue a biased design. Instrumental Variables & Natural Experiments may need even larger samples because instruments are often weak. Policy Gradients: REINFORCE to PPO faces an analogous variance problem: if the learning signal is noisy, you need many trajectories or a variance-reducing baseline.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Low power does not merely miss effects; it exaggerates the rare significant ones. In the demo, an n = 2,000 study must observe about a 1.4 point lift to clear p < 0.05, nearly triple the true 0.5 point lift. That is the winner's curse. Another trap is treating 80% as a law. It is a convention, not a guarantee; higher-stakes decisions may need more power or a lower alpha.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read A/B Testing & p-values for the single-test verdict, Confidence Intervals & the Bootstrap for post-study uncertainty, and Multiple Testing & False Discoveries for dashboards with many endpoints. Multi-Armed Bandits and Thompson Sampling shift traffic adaptively, while Policy Gradients: REINFORCE to PPO shows the same sample-efficiency pain in reinforcement learning.`,
      ],
    },
  ],
};
