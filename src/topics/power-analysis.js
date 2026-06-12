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
        `Statistical power is the probability that your experiment will *detect* an effect that is *truly there*. Before you run any A/B test, you can compute: "If we enroll n users and the true lift is Δ, what is the chance we will call it significant at p < 0.05?" That probability is power. If power is high (say, 80%), the experiment is trustworthy — a real effect will show up most of the time. If power is low (say, 10%), the experiment is a coin flip biased toward "no difference," and a real improvement will go undetected. Power analysis converts the question "how many users should we run this for?" from a gut guess into an engineering calculation. You choose three numbers — false-alarm rate (α, usually 5%), detection confidence (power, usually 80%), and the smallest effect you care about (Δ, a business choice) — and sample size falls out automatically. No more "let's run it for two weeks."`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a baseline conversion rate (say, 5%) and a hypothesized true lift (say, 5.5% — a genuine 10% relative improvement). If you enroll n users per arm and run the standard two-proportion test, you can compute the probability that a real difference shows up as significant. The math: the observed difference between two groups follows a normal distribution, with standard error $\\sqrt{(p_1(1-p_1) + p_2(1-p_2))/n}$. To reach the significance threshold (z ≥ 1.96 for two-tailed α = 0.05), your observed difference must be at least 1.96 × SE away from zero. If the truth is p₂ − p₁ = 0.005, the probability that random sampling pushes the observed gap past 1.96 × SE is your power. Visualize it: at n = 2,000 (as shown in the demo), power is only 10.5% — so a genuinely better treatment survives the experiment one time in ten. The other nine times, the dashboard reports "not significant," and the feature dies, killed not by reality but by noise.`,
        `When you sweep sample size upward, power grows toward 100%. The power curve shows the real cost: to hit 80% power on a 10% relative lift with a 5% baseline requires ~31,000 users per arm — 62,000 users total. That number is knowable before launch. The inverse-square law explains the curve: halve the effect you hunt, and the sample size needed quadruples. A 50% lift (5% → 7.5%) needs only 1,500 users per arm; a 5% lift (5% → 5.25%) needs 122,000. This is why mature experimentation teams obsess over variance reduction: CUPED, stratification, and other techniques reduce the effective noise, shrinking the required n without enrolling more users.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computation is trivial: the math uses the normal CDF (cumulative distribution function) and algebra, running instantly on any machine. The real cost is *sample size*. For a 10% relative lift on a 5% baseline with 80% power, you need 62,000 total users. At typical web traffic, that is a week or two of enrollment. For a 2% lift (5% → 5.1%), you need 614,000 users — months of traffic. This is the fundamental tension: small improvements are expensive to validate reliably, and the cost grows quadratically. The payoff: once you know the power curve, you can negotiate realistic timelines and ROI with the business. A feature with a projected 50% lift clears power thresholds in days; one with a 2% lift takes months. That is not a statistical artifact — it is a real statement about signal-to-noise and resource constraints. A/B Testing & p-values covers why significance matters; this module shows you the sample size price tag.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every major tech company (Amazon, Google, Meta, Netflix, …) runs thousands of A/B tests. Before launching each one, the experimentation team computes power to ensure the experiment is not a waste of time. Product managers use power curves to prioritize: a small UI tweak with 2% projected lift will not clear power for months, so do not start it; a checkout flow redesign with 20% lift power can be tested in a week. Pharmaceutical trials require pre-registered sample sizes based on power — the FDA expects power ≥ 80%. Academic research (biostatistics, psychology, economics) publishes power analyses before running studies to guard against the replication crisis: low power begets inflated effect estimates and irreproducible findings. Digital marketers computing return on ad spend use power to determine how long a campaign must run before declaring a winner. Medical diagnosis and triage use inverse reasoning: given your confidence in a diagnosis (power) and acceptable false-alarm rate (α), what sample of symptoms do you need to reach a decision? The framework is universal.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is confusing power with p-value. p < 0.05 means "the observed result is unlikely under the null hypothesis." Power means "the true effect will survive the test most of the time." The second trap is running an experiment underpowered and trusting the result. At n = 2,000 with 10% power, if you observe a "win," that win is almost certainly luck — sampling noise inflated the signal. This is the *winner's curse* (or significance filter): at n = 2,000, reaching p < 0.05 requires an observed lift of ~1.4 points (14% relative), nearly triple the true 0.5 points (5% relative). Only the lucky runs clear the bar, and their effect estimates are wildly exaggerated. This is why small-study effects fail to replicate — the replication crisis is not fraud, it is math. The third trap is ignoring α (false-alarm rate). If you run 100 independent tests at α = 0.05, you expect ~5 false positives by pure chance. When you monitor a live experiment continuously, peeking at the dashboard every hour, each look is a statistical test; naive peeking inflates the true α from 5% to much higher. Sequential tests (like Wald's test) spend an α budget per look to cure the peeking disease — pre-register your n and STOP when you reach it unless using a sequential design.`,
        `The fourth misconception: "Our experiment is powered, so the result is true." Power addresses one risk (missing a real effect), not others. Confounders, selection bias, and measurement error are separate problems. Power only works if the experiment design is sound. Finally, do not skip power analysis in the rush to launch. The five minutes to compute power saves weeks of wasted time on underpowered experiments. The real cost is design integrity and honest sample-size negotiation with stakeholders.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Power analysis is the pre-flight check for A/B Testing & p-values — go there to understand significance and why p < 0.05 became a convention (and where it breaks). Once your experiment finishes, Confidence Intervals & the Bootstrap teaches you how to report what you found, with honest interval width. If you are testing more than one hypothesis, each test burns a slice of your false-alarm budget; study Cross-Validation & Honest Evaluation to see how multiple comparisons inflate error and what corrections exist. Thompson Sampling shows the inverse problem: instead of choosing n upfront, use a sequential Bayesian update to decide which arm to play *as the experiment runs*, stopping automatically when you have enough evidence. Together, these four topics cover the full lifecycle of reliable decision-making under uncertainty.`,
      ],
    },
  ],
};

