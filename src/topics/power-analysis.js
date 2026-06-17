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
      heading: `Why Power Analysis Exists`,
      paragraphs: [
        `Power analysis exists because an experiment can fail in two very different ways. It can look quiet because the treatment truly has no useful effect. It can also look quiet because the design was too small to detect the effect it was built to find. A p-value after the fact cannot separate those stories by itself. If the study had little chance of seeing a meaningful change, "not significant" is not strong evidence of no effect; it is often evidence of weak instrumentation.`,
        `Power is the probability that a test rejects the null hypothesis when a particular real effect exists. In product language, it is the chance that the experiment catches the improvement you care about. In the module's setup, the treatment really improves conversion from 5.0 percent to 5.5 percent. That is a 10 percent relative lift and may be worth serious money. With only 2,000 users per arm at alpha = 0.05, the computed power is about 10.5 percent. The feature is genuinely better, yet the experiment misses it roughly nine times out of ten.`,
        `That is why power analysis belongs before launch. It converts an argument about hope, patience, and dashboard watching into a design calculation. You choose the false-positive rate, the desired detection probability, and the smallest effect worth acting on. The required sample size is then not a vibe or a calendar habit; it is the cost of answering the question you claimed to ask.`,
      ],
    },
    {
      heading: `The Naive Wall`,
      paragraphs: [
        `The naive approach is to run an A/B test for a convenient amount of time, stop when the calendar or roadmap says to stop, and read the p-value. That puts the design decision at the end of the experiment, after the traffic has already been spent. It also encourages peeking: if the p-value looks close, run a little longer; if it crosses 0.05, stop and celebrate. That behavior changes the error rate unless the test was designed for sequential monitoring.`,
        `The wall is sampling noise. Conversion is a Bernoulli outcome: each user converts or does not. When baseline conversion is 5 percent, most observations are zeros. A treatment that raises conversion to 5.5 percent creates a half-point absolute change. That can be valuable at scale, but it is small compared with the natural wobble in finite samples. With 2,000 users per arm, the standard error is large enough that the honest effect is usually hidden inside noise.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `The core insight is that hypothesis testing has two error types. Alpha controls false alarms: how often a test calls noise a win when no effect exists. Beta controls misses: how often a test fails to detect a real effect. Power is 1 minus beta. Teams talk constantly about alpha because p < 0.05 is culturally familiar, but low power can be just as damaging. It turns real improvements into false negatives and makes the rare significant estimate too large.`,
        `The minimum detectable effect is the strategic input. It asks what smallest change is worth detecting. A 0.5 percentage point lift on checkout conversion may be worth shipping. A 0.02 percentage point lift may not justify weeks of traffic. Statistics cannot choose that threshold for you. Once alpha, target power, baseline variance, and minimum effect are chosen, the sample size follows.`,
        `The memorable scaling law is inverse-square. The standard error shrinks like one over the square root of n, so detecting half the effect needs roughly four times the sample. That is why tiny optimizations are expensive to validate and why high-traffic companies build variance reduction techniques such as CUPED, stratification, blocking, and covariate adjustment. They are trying to reduce noise so the same traffic has more resolving power.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `For a two-proportion experiment, the baseline conversion p1 and treatment conversion p2 determine the expected variance in each arm. The difference p2 minus p1 is the signal. The standard error describes the sampling wobble around that difference for a given n per arm. A two-sided alpha = 0.05 test requires the observed signal-to-noise ratio to clear about 1.96 standard errors before it is called significant.`,
        `Power asks a forward-looking question: if the true difference is the one we care about, how often will the noisy observed difference clear that threshold? As n grows, the standard error shrinks and the true effect stands out more often. As the target effect shrinks, the signal-to-noise ratio collapses unless n grows sharply. The module computes this directly for the 5.0 percent to 5.5 percent example and then inverts the equation to find n for different lifts.`,
      ],
    },
    {
      heading: `What The Visual Proves`,
      paragraphs: [
        `The first view proves that an experiment can be structurally biased toward disappointment even when the treatment works. The setup grants knowledge that production never grants: the treatment really is better. The result is still grim. At 2,000 users per arm, the test detects the win only about one time in ten. The miss row is the central lesson. A null result from that design would not be strong evidence against the feature.`,
        `The winner's-curse view proves the second harm of low power. When an underpowered test does produce a significant result, it usually did so because random noise inflated the observed effect. In the example, the true lift is 0.5 percentage points, but the observed lift needs to be much larger to cross p < 0.05 with n = 2,000. The significant winners are selected from lucky overestimates. That is why small studies often show exciting effects that shrink on replication.`,
        `The sizing view proves that power is a planning curve, not a postmortem adjective. As users per arm increase, the probability of catching the real effect rises. The lift table turns product ambition into traffic cost: large changes are cheap to detect; small refinements are brutally expensive. The four-way trade table then names the levers: alpha, power, effect size, and sample size. Choose three with intent, and the fourth is determined by the model.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `Power analysis works because it uses the sampling distribution before data arrives. If the null threshold is known and the alternative effect is specified, the probability of clearing the threshold can be computed or simulated. This does not predict the exact result of one future experiment. It predicts the long-run behavior of a design if the chosen effect is real.`,
        `That distinction is practical. A single underpowered test can still get lucky, and a well-powered test can still miss a true effect 20 percent of the time if it was designed for 80 percent power. Power analysis is not a guarantee. It is a way to make the miss rate explicit before the result becomes emotionally loaded. It also makes tradeoffs visible: lower alpha reduces false alarms but usually requires more sample; higher power reduces misses but costs traffic; smaller minimum effects require much larger n.`,
        `It also disciplines interpretation. After a low-power null result, the honest conclusion is often "we did not learn much." After a low-power significant result, the honest conclusion is "the estimate is likely inflated." That is a stronger practice than treating p < 0.05 as a magic border between truth and falsehood.`,
      ],
    },
    {
      heading: `Costs And Tradeoffs`,
      paragraphs: [
        `The visible cost is sample size. More users per arm means more calendar time, more opportunity cost, and sometimes more exposure to a treatment that may be inferior. In clinical or policy settings, that cost can be ethical. In product settings, it can mean delaying other experiments or shipping decisions. The calculation is instant; the data is expensive.`,
        `The second cost is commitment. A useful power calculation requires a primary metric, a minimum effect, and a stopping plan. That can feel restrictive to teams used to exploring dashboards after launch. The restriction is the point. If many metrics, segments, and stopping times are inspected without correction, the stated alpha no longer means what the team thinks it means. Multiple Testing and False Discoveries is the natural next topic because it explains how a dashboard of tests manufactures false wins.`,
        `The third tradeoff is convention versus stakes. Eighty percent power and five percent alpha are common defaults, not laws. A cheap reversible UI tweak may tolerate lower certainty. A medical trial, infrastructure migration, or high-risk policy decision may need higher power, lower alpha, or a Bayesian decision framework. Power analysis makes those choices explicit instead of hiding them under a single p-value.`,
      ],
    },
    {
      heading: `Uses And Failure Modes`,
      paragraphs: [
        `Power analysis is strongest when the decision has a clear primary endpoint, a credible variance estimate, and a minimum effect that maps to action. Product A/B tests, clinical trials, survey sampling, education interventions, policy evaluations, and benchmark design all use the same basic idea. In machine learning, the analogy appears in noisy training curves and reinforcement learning: if the reward signal has high variance, more trajectories or variance reduction are needed to see a real improvement.`,
        `It fails when the design is biased. A huge confounded experiment is still confounded. Causal Graphs, Confounding and Simpson's Paradox explain why more data does not fix bad identification. It also fails when inputs are fictional. If the baseline rate, variance, attrition, clustering, or minimum effect is wrong, the resulting n is wrong. Clustered users, repeated exposure, network effects, seasonality, and noncompliance can all reduce effective sample size.`,
        `Another failure mode is using power to rationalize a test that should not be run. If the required sample is impossible, the answer may be to redesign the product change, choose a higher-signal metric, use variance reduction, combine evidence across experiments, or make a decision without pretending that a tiny test will settle it. Power analysis is useful because it sometimes says no.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study A/B Testing and p-values for the single-test decision rule, Confidence Intervals and the Bootstrap for post-study uncertainty, and Multiple Testing and False Discoveries for many endpoints. Then study Causal Graphs, Confounding and Simpson's Paradox to separate precision from identification. Multi-Armed Bandits and Thompson Sampling show what changes when traffic is allocated adaptively, while Policy Gradients: REINFORCE to PPO shows the same sample-efficiency pain in reinforcement learning. The durable lesson is simple: before asking what the data says, ask whether the design can hear the answer.`,
      ],
    },
  ],
};
