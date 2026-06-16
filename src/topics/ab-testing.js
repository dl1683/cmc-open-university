// A/B testing: variant B "wins by 30%"… or does it? The p-value question —
// could dumb luck alone produce a gap this big? — and why the same result
// is noise at one sample size and proof at another.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ab-testing',
  title: 'A/B Testing & p-values',
  category: 'Concepts',
  summary: 'Same conversion rates, two sample sizes — watch "obviously better" turn into noise, and back into signal.',
  controls: [
    { id: 'n', label: 'Visitors per variant', type: 'select', options: ['1,000', '10,000'], defaultValue: '1,000' },
  ],
  run,
};

const RATE_A = 0.05;
const RATE_B = 0.065;

// standard normal CDF via the Abramowitz–Stegun erf approximation
function phi(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.47047 * x);
  const erf = 1 - (0.3480242 * t - 0.0958798 * t * t + 0.7478556 * t ** 3) * Math.exp(-x * x);
  const p = 0.5 * (1 + erf);
  return z >= 0 ? p : 1 - p;
}

export function* run(input) {
  const n = String(input.n) === '1,000' ? 1000 : String(input.n) === '10,000' ? 10000 : null;
  if (n === null) throw new InputError('Pick a sample size.');

  const convA = Math.round(RATE_A * n);
  const convB = Math.round(RATE_B * n);
  const diff = RATE_B - RATE_A;
  const pooled = (convA + convB) / (2 * n);
  const sd = Math.sqrt(pooled * (1 - pooled) * (2 / n));
  const z = diff / sd;
  const pValue = 2 * (1 - phi(Math.abs(z)));
  const significant = pValue < 0.05;

  const axes = { x: { label: 'difference in conversion rate (B − A)' }, y: { label: 'how often pure chance produces it' } };
  const curve = {
    id: 'null',
    label: 'chance alone',
    points: Array.from({ length: 81 }, (_, i) => {
      const x = -4 * sd + (i / 80) * (4 * sd + diff * 1.4 + sd);
      return { x, y: Math.exp(-(x * x) / (2 * sd * sd)) };
    }),
  };
  const observed = { id: 'obs', x: diff, y: Math.exp(-(diff * diff) / (2 * sd * sd)), label: `observed +${(diff * 100).toFixed(1)}%` };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: {},
    explanation: `The experiment: ${n.toLocaleString()} visitors see button A (${convA} buy — ${(RATE_A * 100).toFixed(1)}%), another ${n.toLocaleString()} see button B (${convB} buy — ${(RATE_B * 100).toFixed(1)}%). The naive read: "B converts 30% better, ship it!" The statistician's read: two groups of real humans NEVER convert identically, even shown the same button. Some gap was guaranteed. The only question that matters: is THIS gap bigger than luck can explain?`,
  };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: { active: ['null'] },
    explanation: `The bell curve is the NULL HYPOTHESIS made visible: assume the buttons are truly identical, and this is how the measured difference would scatter across thousands of imaginary reruns — usually near zero, sometimes drifting to ±${(2 * sd * 100).toFixed(1)}% by pure accident. Its width is the key: it shrinks as sqrt(n) grows. At ${n.toLocaleString()} per variant, chance alone routinely produces gaps of ±${(sd * 100).toFixed(2)}%.`,
    invariant: 'The null distribution answers one question: what does luck look like at this sample size?',
  };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: { active: ['obs'] },
    explanation: `Now place the observed +${(diff * 100).toFixed(1)}% on that curve. It sits ${z.toFixed(1)} standard deviations from zero (the z-score). The P-VALUE is the probability of luck producing a gap at least this extreme: p ≈ ${pValue < 0.001 ? pValue.toExponential(1) : pValue.toFixed(2)}. In plain terms: ${pValue < 0.001 ? 'essentially no' : `about ${Math.round(pValue * 100)} in 100`} A/A tests — identical buttons! — would show a difference this large.`,
  };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: { active: ['obs'] },
    explanation: significant
      ? `VERDICT at the usual 0.05 bar: SIGNIFICANT. Luck producing this gap is too rare to take seriously — B's advantage is real (with the usual 5% false-alarm budget). Note what changed from the small test: the SAME conversion rates, but ten times the data narrowed the null curve by √10, pushing the observed gap from "plausible" to "wildly improbable". Sample size is the microscope.`
      : `VERDICT at the usual 0.05 bar: NOT significant. A 15-in-100 chance of luck faking this is far too plausible to bet the product on — "B wins by 30%" was a mirage of small numbers. Before declaring victory, switch the control to 10,000 visitors: the SAME rates become overwhelming evidence, because the null curve narrows by √10. The data didn't change; your ability to see through noise did.`,
  };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: {},
    explanation: 'The traps every experimenter falls into once: PEEKING (checking daily and stopping at the first p < 0.05 — that alone pushes your false-positive rate toward 30%; decide the sample size up front), MULTIPLE TESTING (run 20 variants and one "wins" by luck), and confusing statistical with PRACTICAL significance (at n = 10 million, a meaningless +0.01% is "significant"). This machinery runs behind every feature flag at every product company — randomized by a fair sampler (see Reservoir Sampling), sized before launch, read once. And when waiting is too expensive, multi-armed bandits shift traffic adaptively — the explore/exploit trade from Value Iteration (Reinforcement Learning), pointed at buttons.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A/B testing is a randomized experiment for product decisions. Half the visitors see A, half see B, and you compare one prechosen metric, such as conversion. The visualization fixes the true rates at 5.0% for A and 6.5% for B, then lets you switch only the sample size: 1,000 or 10,000 visitors per variant. The observed lift is the same 1.5 percentage points both times, but the evidence changes because noise shrinks with sample size.`,
        `The p-value asks a narrow question: if A and B were really identical, how often would random assignment create a gap at least this large? At 1,000 per arm, the answer is about 15%, so the apparent 30% relative lift is plausible luck. At 10,000 per arm, the same lift lands far into the null tail, below 0.001. That contrast is why A/B Testing & p-values belongs beside Statistical Power & Sample Size rather than after it.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Randomization is the engine. The code counts conversions, pools the two rates, computes the standard error of a two-proportion difference, and divides the observed gap by that error to get a z-score. The bell curve on screen is the null distribution: the differences you would see from chance alone if both buttons had the same true rate.`,
        `Reading the plot means comparing a marker to that curve. A marker near the fat middle says "noise can do this." A marker in the tail says "chance rarely does this." Confidence Intervals & the Bootstrap tells the same story as a range around the effect; Multiple Testing & False Discoveries explains why the range or p-value is only valid for the question you promised to ask before looking.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The arithmetic is cheap: one pass over counts and a normal CDF. The cost is traffic and delay. Because standard error shrinks like 1/sqrt(n), halving the noise needs four times as many visitors. Small, polished changes can require weeks of traffic; large changes can be tested quickly. Reservoir Sampling is not the exact mechanism here, but it teaches the fairness principle: every eligible visitor must have the right chance of assignment.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Product teams use A/B tests for checkout flows, onboarding, ranking changes, notifications, and pricing pages. Randomized tests are the cleanest causal tool because assignment breaks most confounding. When randomization is impossible, Causal Graphs, Confounding & Simpson's Paradox and Instrumental Variables & Natural Experiments show what extra assumptions are needed. For logged policies, Importance Sampling & Off-Policy Estimation estimates "what if we had shown B?" without serving B to everyone, and Contextual Bandit Logged Policy Evaluation Case Study shows the logging contract needed before that estimate deserves trust.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A p-value is not the probability B is better. It is the probability of data this extreme under no effect. Peeking is another trap: checking daily and stopping at the first p < 0.05 spends the false-alarm budget many times. So does slicing by device, country, and cohort after the fact. A statistically significant lift can also be too small to matter; a practical decision needs the effect size, uncertainty, and cost, not just a threshold crossing.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Statistical Power & Sample Size before launching an experiment, Confidence Intervals & the Bootstrap after estimating the effect, and Multiple Testing & False Discoveries before reading a dashboard with many metrics. Multi-Armed Bandits and Thompson Sampling trade clean fixed-sample inference for live optimization when losing traffic is expensive. Contextual Bandit Logged Policy Evaluation Case Study, Doubly Robust Estimation, Propensity Score Overlap Diagnostics, and Causal Forest Uplift Policy help when you must reason from imperfect logs instead of a fresh randomized test.`,
      ],
    },
  ],
};
