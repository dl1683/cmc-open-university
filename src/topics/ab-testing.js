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
        'The animation runs one A/B test with fixed conversion rates (A = 5.0%, B = 6.5%) and lets you toggle between 1,000 and 10,000 visitors per variant. The bell curve is the null distribution: a picture of what measured differences would look like if the two buttons were identical and only random assignment produced the gap.',
        'The marker on the curve is the single observed result. Watch where it sits relative to the tails. At 1,000 visitors the curve is wide, and the marker lands in a region luck reaches routinely. At 10,000 the curve tightens, and the same marker moves deep into the tail. The conversion rates did not change; the evidence did.',
        'Each frame states the z-score (how many standard-error widths the observed gap is from zero) and the p-value (how often chance alone would produce a gap at least that extreme). Follow those two numbers across frames to see evidence accumulate.',
        {type: "callout", text: "A/B testing turns a product choice into a noise model: the observed lift only matters after you ask how often chance can fake it."},
        {type: 'image', src: './assets/gifs/ab-testing.gif', alt: 'Animated walkthrough of the ab testing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Product intuition is a poor measuring instrument. A new checkout button can look better because of day-of-week traffic, a lucky cohort, a marketing campaign that sent unusual users, or one large customer arriving at the right time. Without a controlled comparison, \"B helped\" is an opinion dressed as a metric.',
        'A/B testing (Fisher 1935, formalized in clinical trials) solves this by randomly assigning users to variant A (control) or B (treatment) and measuring the outcome. Because assignment is random, the only systematic difference between groups is the treatment itself. Everything else -- device mix, time of day, user patience -- is balanced in expectation.',
        'The p-value answers one narrow question inside that comparison: if A and B had the same true conversion rate, how often would random assignment produce a measured gap at least this large? It is not the probability that B is better. It is not a launch decision. It is a noise check.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Divide conversions by visitors and ship the variant with the larger rate. In this module, A converts at 5.0% and B converts at 6.5%. That is a 1.5 percentage-point absolute lift and a 30% relative lift. A dashboard headline makes B look obviously superior.',
        'This is the approach most product teams reach for instinctively, and it works when the gap is enormous and the sample is huge. The trouble is that \"enormous\" and \"huge\" are doing all the load-bearing work in that sentence, and most real experiments have neither.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Two random groups of people almost never behave identically, even when both groups see the same experience. With 1,000 visitors per variant, a few dozen extra or missing conversions can happen by luck. A 30% relative lift sounds large, but the experimenter still needs to ask whether this many conversions could have landed in B\'s bucket by accident. Small denominators make ordinary randomness look dramatic.',
        'A before/after comparison is worse: seasonality, marketing campaigns, and a hundred other factors change between periods, so the product change is confounded with everything else that moved. Asking experts is also unreliable -- experts have biases and cannot predict user behavior at the margin. The wall is that no naive comparison comes with a model of what luck looks like.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Evidence is effect size divided by noise. The observed effect here is fixed: B is 1.5 percentage points above A. The uncertainty around that effect depends on sample size and on how variable conversion outcomes are. A purchase is a Bernoulli outcome (0 or 1), so each user\'s result has variance p(1-p). The standard error of the difference between two independent group means shrinks as 1/sqrt(n).',
        'The test formalizes this into a two-proportion z-test. Under the null hypothesis H0 (both variants share one true rate), pool all conversions from both arms to estimate that shared rate. Compute the standard error for the difference in proportions. Divide the observed gap by that standard error. The result is a z-score: how many noise-widths away from zero the observed gap sits. A z-score of 1.96 or larger corresponds to p < 0.05.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: pool the conversion rate. Under H0, A and B are two samples from the same process, so pooled_rate = (conversions_A + conversions_B) / (n_A + n_B). Step 2: compute the standard error of the difference. SE = sqrt(pooled_rate * (1 - pooled_rate) * (1/n_A + 1/n_B)). Step 3: compute z = (rate_B - rate_A) / SE. Step 4: look up the p-value from the standard normal distribution. The module uses a normal CDF approximation (Abramowitz-Stegun erf) to avoid dragging in a statistics library.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg`, alt: `Normal distribution probability density functions`, caption: `The null curve shows where measured lift would fall if the variants were equal. Source: Wikimedia Commons, Inductiveload, public domain.`},
        'The bell curve in the animation is that null distribution made visible. It shows where measured differences would land across many imaginary reruns if the product change had no effect. The marker is the one experiment you actually observed. Toggle the sample-size control: A stays 5.0%, B stays 6.5%, the lift stays 1.5 points, but the curve narrows by sqrt(10), pushing the marker from \"plausible under luck\" to \"wildly improbable under luck.\" Same lift, different evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Random assignment makes the two groups comparable before the product experience differs. If assignment is fair and stable, confounders are balanced in expectation: mobile users, desktop users, impatient users, loyal users, and random arrival patterns all land in both buckets. The remaining difference is a signal-plus-noise problem, not an uncontrolled observational comparison.',
        'The normal approximation works because each arm has many independent Bernoulli trials. By the central limit theorem, the sampling distribution of the mean converges to a normal distribution as n grows. For conversion rates above a few percent and samples above a few hundred, the approximation is tight. This is the same reason polling margins shrink slowly: to cut uncertainty in half, you need roughly four times as much data.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg`, alt: `Standard deviation regions under a normal distribution`, caption: `Standard deviation makes sampling noise visible: more traffic narrows uncertainty slowly, by square root n. Source: Wikimedia Commons, M. W. Toews, public domain.`},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computation is negligible: count conversions, compute one square root, evaluate one CDF, compare with a threshold. The real costs are traffic, time, engineering effort, and exposing users to a variant that might be worse.',
        'Because uncertainty shrinks like 1/sqrt(n), traffic has diminishing returns. Detecting a 1 percentage-point lift in a 10% conversion rate at 80% power requires roughly 15,000 users per group. Detecting a 0.1-point lift requires roughly 1.5 million per group. Halving the detectable effect quadruples the required sample. Polished products with small marginal improvements need long, expensive experiments.',
        'Fixed-sample testing gives a clean decision rule when sample size, metric, and analysis plan are chosen before launch. Adaptive methods like multi-armed bandits can waste fewer users on losing variants, but they change the statistical interpretation. Sequential testing (Wald 1947) lets you check results continuously and stop early, but naive peeking inflates false positives -- you must use alpha-spending functions or always-valid p-values to compensate.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A/B testing wins when the change is user-facing, randomization is ethical, the outcome can be measured soon enough, and interference between users is limited. Checkout flows, onboarding steps, email subject lines, recommendation layouts, ranking changes, notification timing, and pricing-page copy all fit when the metric is chosen carefully.',
        'It is especially valuable when intuition is divided. Designers, engineers, executives, and sales teams can all have plausible stories about which variant is better. A randomized experiment replaces argument with a shared measurement protocol. The result may still be uncertain, but the uncertainty is explicit instead of hidden inside opinion.',
        'At scale, companies like Microsoft, Netflix, and Booking.com run thousands of concurrent experiments. User assignment is typically done via a deterministic hash of user ID and experiment ID (see Hash Function), ensuring consistent assignment across sessions without storing per-user state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Peeking is the classic failure. If you check every day and stop when p < 0.05, the advertised 5% false-alarm rate no longer applies -- the true rate can approach 30%. Multiple metrics create the same problem: inspect twenty unrelated outcomes and one may look significant by accident. Bonferroni correction (use alpha/k per test) is conservative but safe; the Benjamini-Hochberg procedure controls the false discovery rate less aggressively.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg`, alt: `Normal distribution cumulative distribution functions`, caption: `The CDF view shows why tail probability depends on the whole distribution, not just the observed difference. Source: Wikimedia Commons, Inductiveload, public domain.`},
        'Network effects break the independence assumption. In social networks, user A\'s experience affects user B\'s behavior (viral features, marketplace effects). The fix is cluster randomization -- randomize by geographic region or social cluster, not by individual user. Interference between groups is the biggest threat to A/B test validity at companies like Meta and Uber.',
        'Instrumentation mistakes can be worse than statistical mistakes. Users must be assigned consistently, conversions must be attributed to the correct exposure, bots and internal traffic may need filtering, and the metric should match the product decision. A perfectly computed p-value on a broken event stream is still broken evidence. A non-significant result is also not proof of no effect -- it may mean the test was underpowered (see Statistical Power & Sample Size).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Control: 1,000 users, 100 conversions (10.0%). Treatment: 1,000 users, 120 conversions (12.0%). Absolute difference: 2 percentage points. Relative lift: 20%. The dashboard says ship it.',
        'Pooled proportion p_hat = (100 + 120) / (1000 + 1000) = 220 / 2000 = 0.11. Standard error SE = sqrt(0.11 * 0.89 * (1/1000 + 1/1000)) = sqrt(0.000196) = 0.014. z = (0.12 - 0.10) / 0.014 = 1.43. Two-tailed p-value = 2 * (1 - Phi(1.43)) = 2 * 0.0764 = 0.153.',
        'p = 0.153 > 0.05, so the result is NOT significant. About 15 out of 100 A/A tests (identical buttons) would produce a gap this large by chance alone. Despite a 20% relative lift, 1,000 users per group is too few to separate signal from noise for a 2-point effect.',
        'To reach significance for this effect size, you need roughly 4,000 users per group. At 10,000 per group, z rises to about 4.5 and p drops below 0.0001. The lesson: decide sample size BEFORE launching, not during. The formula is n = (z_alpha/2 + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (p2 - p1)^2, where z_alpha/2 = 1.96 for 5% significance and z_beta = 0.84 for 80% power.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Fisher 1935, The Design of Experiments -- formalized randomized controlled experiments. Neyman & Pearson 1933 -- the hypothesis testing framework (null vs. alternative, Type I and Type II errors). Wald 1947 -- sequential analysis. Kohavi, Longbotham, Sommerfield & Henne 2009, \"Controlled Experiments on the Web: Survey and Practical Guide\" -- the standard practical reference from Microsoft.',
        'Study Statistical Power & Sample Size before launching any experiment -- it determines how much traffic you need. Study Confidence Intervals & the Bootstrap after estimating the lift to understand the range of plausible effects. Multiple Testing & False Discoveries covers dashboards with many simultaneous outcomes. Multi-Armed Bandits and Thompson Sampling show the optimization version of the problem, where traffic is shifted toward winners while learning.',
        'For causal work beyond randomized experiments: Causal Graphs and Confounding & Simpson\'s Paradox explain the structure that A/B tests bypass through randomization. Instrumental Variables & Natural Experiments, Doubly Robust Estimation, and Propensity Score Overlap Diagnostics handle settings where clean random assignment is not available. Hash Function covers consistent user-to-variant assignment.',
      ],
    },
  ],
};

