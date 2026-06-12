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
      heading: 'What it is',
      paragraphs: [
        `A/B testing answers the question every product team faces: does this new design actually work better, or is the difference just luck? You show version A to half your users, version B to the other half, measure some outcome (clicks, conversions, time-on-page), and ask: is the gap real or noise? The p-value is the statistician's answer — it quantifies the probability that random chance alone could produce the gap you saw, assuming both versions are actually identical. If that probability is small (usually less than 5%), you declare the winner. If it's large, you admit defeat: you got unlucky, and the versions are statistically indistinguishable. This distinction saves companies from chasing mirages.`,
        `The scale matters ferociously. A 30% improvement in conversion rate — say from 5.0% to 6.5% — looks like a slam dunk at first glance. But at 1,000 visitors per variant, the same jump produces p ≈ 0.15, far too plausible for random variation alone. Jump to 10,000 visitors and p plunges below 0.001: now those identical rates are overwhelming proof. The null distribution (what pure luck produces at your sample size) is the microscope. As your sample grows by a factor of 10, the null curve narrows by sqrt(10), and weak signals become unmistakable. Understanding why teaches you why sample size is destiny and why every experiment must decide its size before the first user is enrolled.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with two groups drawn randomly from the same population. Calculate the observed difference in your metric (version B's conversion rate minus A's). This measured gap lives somewhere on a bell curve — the null distribution — which assumes the versions are truly identical and shows you where random variation alone can drift. The wider the curve, the more variance luck permits; the narrower it is, the tighter the constraint. Width is set by the pooled rate and sample size: sd = sqrt(pooled × (1 − pooled) × (2/n)), where n is visitors per variant. This is the standard error of the difference. Divide your observed gap by this standard error to get the z-score: how many standard deviations away from zero does your observation land?`,
        `Convert the z-score to a p-value using the normal CDF. For a two-sided test (you care whether B beats A or loses), the p-value is the probability of observing a gap at least this extreme in either direction, under the null hypothesis of no difference. If your test statistic lands in the far tail of the null distribution (z > 1.96 for the 0.05 threshold), the p-value drops below 0.05 and you reject the null: your evidence tilts toward B being genuinely better or worse. The machinery runs automatically in tools like Optimizely, LaunchDarkly, and Statsig, where you set the sample size math upfront and the platform computes p-values on a fixed schedule — no peeking, no hunting, no surprises after the fact.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The cost is time: every extra visitor costs you the opportunity to deploy the winning version sooner. A well-powered experiment at n = 10,000 per variant might run for weeks in low-traffic products, months if baseline metrics are tiny. You pay for the delay in forfeited revenue — if version B is genuinely better, you ship it late. Design the sample size using a power calculator before you start (usually targeting 80% power to detect a "practically meaningful" effect size). The complexity is statistical: the p-value answers "is the gap real?" but not "is it big enough to matter?" That is a business question — a 0.1% lift in conversion might be statistically significant but economically noise. Confuse the two and you ship a feature that wins on charts but loses in the real world. Also, the p-value framework assumes you decide the sample size before the test, analyze it once, and move on. Sequential testing (peeking at results and re-deciding sample size) explodes the false-positive rate toward 30% — the multiple-testing trap.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every major product company runs hundreds of A/B tests monthly. Netflix tests thumbnail images for movies, Amazon tests checkout flows, and DuckDuckGo tests search result layouts. Optimizely, LaunchDarkly, Statsig, and Amplitude house the infrastructure: they randomize traffic (using Reservoir Sampling or similar fair allocation), lock the sample size upfront, log the counts, and report p-values on a predefined schedule. Your decision is deterministic: if p < 0.05, ship B; otherwise, keep A. The stakes are high — wrongly promoting a version burns user trust — so the discipline is strict. In high-traffic domains (social media, search), you can test in days; in low-traffic domains (B2B SaaS), you wait weeks. The bigger the practical effect you expect, the smaller the sample size you need. A 10% improvement needs far fewer visitors than a 1% improvement, so your business vision feeds the math.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Peeking is poison. Check results daily and stop at the first p < 0.05? That false-positive rate soars toward 30% — far higher than the intended 5%. The cure: precommit the sample size using a power calculator, run the experiment to completion, and read the results exactly once. Multiple testing compounds the problem: run 20 variants (or check 20 metrics), and one inevitably "wins" by pure luck. The 5% significance threshold assumes you ran one test, not a fishing expedition. Multiple testing correction (Bonferroni or false-discovery rate control) adjusts the bar upward to account for hunting. Statistical significance != practical significance. At 10 million users per variant, even a 0.01% improvement becomes "statistically significant" (p < 0.05) — but if your goal is a 1% lift, that data point is useless noise. And confounding: if you change the checkout button AND the color of the text, and version B wins, you cannot tell which change mattered. Always randomize at the subject level (not the day or browser version), control everything except the one thing you are testing, and be honest about causation: randomization (not correlation) proves it.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dig into Reservoir Sampling to understand how product platforms fairly allocate visitors to each variant without pre-listing all users. Explore Value Iteration (Reinforcement Learning) to see how multi-armed bandits adaptively allocate traffic, tilting toward winners as evidence accrues — the modern alternative when waiting is too expensive. Study Big-O Growth Rates to internalize why the null distribution narrows by sqrt(n): you need 4× the sample to halve your noise, a scaling law that shapes every large experiment. Finally, Sliding Window techniques apply when testing repeatedly over time (sequential analysis), a more advanced variation that requires care to avoid the peeking trap.`,
      ],
    },
  ],
};
