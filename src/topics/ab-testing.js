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

  const axes = { x: { label: 'difference in conversion rate (B âˆ’ A)' }, y: { label: 'how often pure chance produces it' } };
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
    explanation: `Now place the observed +${(diff * 100).toFixed(1)}% on that curve. It sits ${z.toFixed(1)} standard deviations from zero (the z-score). The P-VALUE is the probability of luck producing a gap at least this extreme: p â‰ˆ ${pValue < 0.001 ? pValue.toExponential(1) : pValue.toFixed(2)}. In plain terms: ${pValue < 0.001 ? 'essentially no' : `about ${Math.round(pValue * 100)} in 100`} A/A tests — identical buttons! — would show a difference this large.`,
  };

  yield {
    state: plotState({ axes, series: [curve], markers: [observed] }),
    highlight: { active: ['obs'] },
    explanation: significant
      ? `VERDICT at the usual 0.05 bar: SIGNIFICANT. Luck producing this gap is too rare to take seriously — B's advantage is real (with the usual 5% false-alarm budget). Note what changed from the small test: the SAME conversion rates, but ten times the data narrowed the null curve by âˆš10, pushing the observed gap from "plausible" to "wildly improbable". Sample size is the microscope.`
      : `VERDICT at the usual 0.05 bar: NOT significant. A 15-in-100 chance of luck faking this is far too plausible to bet the product on — "B wins by 30%" was a mirage of small numbers. Before declaring victory, switch the control to 10,000 visitors: the SAME rates become overwhelming evidence, because the null curve narrows by âˆš10. The data didn't change; your ability to see through noise did.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for A/B Testing & p-values. Same conversion rates, two sample sizes — watch \"obviously better\" turn into noise, and back into signal..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "A/B testing turns a product choice into a noise model: the observed lift only matters after you ask how often chance can fake it."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A/B testing exists because product intuition is a poor measuring instrument. A new button, ranking rule, checkout step, or price page can look better because of day-of-week traffic, a lucky cohort, a campaign that sent unusual users, or one large customer arriving at the right time. Random assignment is the tool that turns "I think B helped" into a cleaner comparison between users who were eligible for the same product at the same time.`,
        `The p-value exists to answer one narrow question inside that comparison: if A and B had the same true conversion rate, how often would random assignment produce a measured gap at least this large? That question is smaller than people want it to be. It is not the probability that B is better. It is not a launch decision. It is a noise check.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious approach is to divide conversions by visitors and ship the variant with the larger rate. In this module, A converts at 5.0% and B converts at 6.5%. That is a 1.5 percentage-point absolute lift and a 30% relative lift, so a dashboard headline can make B look obviously superior.`,
        `The wall is random variation. Two random groups of people almost never behave identically, even when both groups see the same experience. With 1,000 visitors per variant, a few dozen extra or missing conversions can happen by luck. With 10,000 per variant, the same rate gap is much harder to explain away because the sampling noise is smaller.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The naive comparison fails because it has no model of what luck looks like. A 30% relative lift sounds large, but the experimenter still needs to ask whether this many conversions could have landed in B's bucket by accident. Small denominators make ordinary randomness look dramatic.`,
        `It also fails because product teams rarely run one pure comparison and stop. They peek at results, slice by country and device, watch many metrics, and rerun tests when the first result is boring. Each extra look creates more chances for noise to masquerade as a win. The p-value is useful only when it is interpreted within a real testing plan.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that evidence is effect size divided by noise. The observed effect here is fixed: B is 1.5 percentage points above A. The uncertainty around that effect depends on sample size and on how variable conversion outcomes are. A click or purchase is a Bernoulli outcome, so the standard error of the difference shrinks as traffic grows.`,
        `The code turns that idea into a two-proportion z-test. It counts conversions for A and B, pools the estimated conversion rate under the "no real difference" assumption, computes the standard error for the difference between two independent groups, and divides the observed gap by that standard error. The result is a z-score: how many noise-widths away from zero the observed gap sits.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Under the null hypothesis, both variants share one true conversion rate. The pooled estimate uses all conversions from both arms because, under that hypothesis, A and B are two samples from the same process. That pooled rate feeds the standard-error formula for a difference in proportions.`,
        `The z-score is then compared against the standard normal curve. A large positive or negative z-score lands far from zero. The p-value is the probability, under the null, of seeing a difference at least that extreme in either direction. The module uses a normal CDF approximation to make that probability visible without dragging in a statistics library.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `The curve is the "chance alone" world. It shows where measured differences would land across many imaginary reruns if the product change had no effect. The marker is the one experiment you actually observed. At low traffic, the curve is wide, so the marker can sit inside a region that luck reaches often. At higher traffic, the curve tightens around zero, so the same marker can move into the tail.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg`, alt: `Normal distribution probability density functions`, caption: `The null curve shows where measured lift would fall if the variants were equal. Source: Wikimedia Commons, Inductiveload, public domain.`},
        `That is the point of the sample-size control. Nothing about the displayed conversion rates changes. A is still 5.0%, B is still 6.5%, and the lift is still 1.5 percentage points. What changes is the amount of data behind those rates. The visual proves that "same lift" is not the same as "same evidence."`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Random assignment makes the two groups comparable before the product experience differs. If assignment is fair and stable, outside causes should be balanced in expectation: mobile users, desktop users, impatient users, loyal users, and random arrival patterns all land in both buckets. That is why the remaining difference can be treated as a signal-plus-noise problem instead of an uncontrolled observational comparison.`,
        `The normal approximation works here because each arm has many independent conversion trials. Individual users still vary, but the aggregate difference has a predictable sampling distribution. This is the same reason polling margins and confidence intervals shrink slowly with sample size: to cut uncertainty in half, you need roughly four times as much data.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg`, alt: `Standard deviation regions under a normal distribution`, caption: `Standard deviation makes sampling noise visible: more traffic narrows uncertainty slowly, by square root n. Source: Wikimedia Commons, M. W. Toews, public domain.`},
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The computation is cheap: count conversions, compute a standard error, call a normal CDF, and compare with a threshold. The real costs are traffic, time, engineering effort, and exposing users to a variant that might be worse. Because uncertainty shrinks like 1/sqrt(n), traffic has diminishing returns. Polished changes with tiny effects can require long experiments.`,
        `The inference tradeoff is also real. Fixed-sample A/B testing gives a clean decision rule if the sample size, metric, and analysis plan are chosen up front. Adaptive methods such as multi-armed bandits may waste fewer users on losing variants, but they make the statistical interpretation different. Optimization and clean measurement are related goals, not the same goal.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `A/B testing wins when the change is user-facing, randomization is ethical, the outcome can be measured soon enough, and interference between users is limited. Checkout flows, onboarding steps, email subject lines, recommendation layouts, ranking changes, notification timing, and pricing-page copy all fit this pattern when the metric is chosen carefully.`,
        `It is especially valuable when intuition is divided. Designers, engineers, executives, and sales teams can all have plausible stories. A randomized experiment replaces argument with a shared measurement protocol. The result may still be uncertain, but the uncertainty is explicit instead of hidden inside opinion.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `Peeking is the classic failure. If you check every day and stop when p < 0.05, the advertised false-alarm rate no longer applies. Multiple metrics create the same problem. If twenty unrelated outcomes are inspected, one may look significant by accident. Multiple Testing & False Discoveries is the next topic for that dashboard trap.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg`, alt: `Normal distribution cumulative distribution functions`, caption: `The CDF view shows why tail probability depends on the whole distribution, not just the observed difference. Source: Wikimedia Commons, Inductiveload, public domain.`},
        `Instrumentation mistakes can be worse than statistical mistakes. Users must be assigned consistently, conversions must be attributed to the right exposure, bots and internal traffic may need filtering, and the metric should match the product decision. A perfectly computed p-value on a broken event stream is still broken evidence.`,
      ],
    },
    {
      heading: 'Decision discipline',
      paragraphs: [
        `A practical launch decision needs more than p < 0.05. Ask whether the effect is large enough to matter, whether the confidence interval excludes harmful outcomes, whether the result holds on guardrail metrics, and whether the implementation cost is justified. Statistical significance can detect a tiny improvement that is not worth shipping.`,
        `The reverse is also true: a non-significant result is not proof of no effect. It may mean the test was underpowered. Statistical Power & Sample Size explains how to decide traffic before launch so a meaningful lift has a real chance of being detected.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Statistical Power & Sample Size before launching an experiment, then Confidence Intervals & the Bootstrap after estimating the lift. Multiple Testing & False Discoveries covers dashboards with many outcomes. Multi-Armed Bandits and Thompson Sampling show the optimization version of the problem, where traffic is shifted while learning.`,
        `For causal work beyond experiments, study Causal Graphs, Confounding & Simpson's Paradox, Instrumental Variables & Natural Experiments, Doubly Robust Estimation, Propensity Score Overlap Diagnostics, Causal Forest Uplift Policy, and Contextual Bandit Logged Policy Evaluation Case Study. Those topics explain what extra structure is needed when clean random assignment is not available.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Decide between two product variants. Ask experts? Experts have biases and cannot predict user behavior. Launch the change and compare before/after? Confounded — seasonality, marketing campaigns, and a hundred other factors changed between periods.`,
        `A/B test (Fisher 1935, formalized in clinical trials): randomly assign users to variant A (control) or B (treatment). Measure the outcome (conversion rate, revenue, engagement). Because assignment is random, the only systematic difference between groups is the treatment itself.`,
        `Null hypothesis H₀: variants are equal (any observed difference is random noise). p-value: probability of observing a difference this large if H₀ is true. If p < 0.05: reject H₀ — statistically significant.`,
        `Sample size: need enough observations. For detecting a 1% lift in a 10% conversion rate at 80% power: ~15,000 users per group. For 0.1% lift: ~1.5 million per group.`,
        `Sequential testing (Wald 1947): check results continuously, stop early if significance reached. But naive peeking inflates false positives — must use correction (alpha spending, always-valid p-values).`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Control: 1,000 users, 100 conversions (10.0%). Treatment: 1,000 users, 120 conversions (12.0%). Difference: 2 percentage points, relative lift 20%. Is this significant?`,
        `Pooled proportion p = 220/2000 = 0.11. SE = √(0.11 · 0.89 · (1/1000 + 1/1000)) = √(0.000196) = 0.014. z = (0.12 − 0.10) / 0.014 = 1.43. p-value = 0.153 > 0.05. NOT significant.`,
        `Despite a 20% relative lift, 1,000 users per group is too few to distinguish signal from noise. Need ~4,000 per group for this effect size. Lesson: do not stop the test early because the lift "looks good." The sample size calculation must happen BEFORE the test, not during.`,
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Multiple comparisons problem: test 20 button colors simultaneously. At α = 0.05, expect 1 false positive (20 × 0.05 = 1) even if all colors perform identically.',
            'Bonferroni correction: use α/20 = 0.0025 per test. Conservative but safe. False Discovery Rate (Benjamini–Hochberg): less conservative, controls the fraction of false positives among discoveries.',
            'Network effects: A/B testing assumes independence between users. In social networks, user A’s experience affects user B’s (viral features, marketplace effects).',
            'Solution: cluster randomization — randomize by geographic region or social cluster, not by individual user. Interference between groups is the biggest threat to A/B test validity at companies like Meta and Uber.',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        `Multiple comparisons problem: test 20 button colors simultaneously. At α = 0.05, expect 1 false positive (20 × 0.05 = 1) even if all colors perform identically. Bonferroni correction: use α/20 = 0.0025 per test. Conservative but safe. False Discovery Rate (Benjamini–Hochberg): less conservative, controls the fraction of false positives among discoveries.`,
        `Network effects: A/B testing assumes independence between users. In social networks, user A’s experience affects user B’s (viral features, marketplace effects). Solution: cluster randomization — randomize by geographic region or social cluster, not by individual user. Interference between groups is the biggest threat to A/B test validity at companies like Meta and Uber.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Fisher 1935 (The Design of Experiments — randomized controlled experiments). Neyman & Pearson 1933 (hypothesis testing framework). Kohavi et al. 2009 (Controlled Experiments on the Web — practical guide from Microsoft).`,
        `Study next: Bayesian Statistics (alternative to frequentist testing), Multi-Armed Bandit (adaptive allocation instead of fixed split), Regression Discontinuity (when randomization is impossible), Causal Inference (broader framework for causation), Hash Function (used for consistent user assignment to variants).`,
      ],
    },
],
};

