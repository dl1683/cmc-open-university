// The bootstrap: you measured once and got one number — how much would it
// wobble if you measured again? No formula needed: resample your own data
// (done live here, 200 times) and watch the wobble draw itself.

import { plotState, matrixState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'bootstrap-ci',
  title: 'Confidence Intervals & the Bootstrap',
  category: 'Concepts',
  summary: 'One measurement is a point; the truth is a wobble. Resample your own data 200 times and draw the error bars.',
  controls: [
    { id: 'view', label: 'Estimate', type: 'select', options: ['the bootstrap, resampled live', 'reading (and misreading) the interval'], defaultValue: 'the bootstrap, resampled live' },
  ],
  run,
};

// Ten page-load times (ms) — note the one ugly 480ms tail event.
const SAMPLE = [95, 120, 135, 142, 158, 165, 178, 190, 210, 480];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// Deterministic LCG so every visitor sees the same 200 resamples.
function bootstrap(rounds) {
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const all = [];
  for (let b = 0; b < rounds; b++) {
    const r = [];
    for (let i = 0; i < SAMPLE.length; i++) r.push(SAMPLE[Math.floor(rnd() * SAMPLE.length)]);
    all.push(r);
  }
  return all;
}
const RESAMPLES = bootstrap(200);
const MEANS = RESAMPLES.map(mean).sort((a, b) => a - b);
const CI_LO = MEANS[4];
const CI_HI = MEANS[194];

function* liveBootstrap() {
  yield {
    state: arrayState(SAMPLE.map(String)),
    highlight: { removed: ['i9'], compare: ['i0'] },
    explanation: `Ten page-load measurements, mean ${mean(SAMPLE).toFixed(0)}ms — and the report is due: "average latency: 187ms." Stop. If you measured ten DIFFERENT requests tomorrow, would you get 187 again? Obviously not — especially with that 480ms straggler in the data (one tail event, and real latency always has them — see Hot Rows & Append-and-Aggregate\'s queue spikes). The honest deliverable is not a point, it is a RANGE: the set of values the true mean could plausibly be. The classical route to that range runs through formulas and normality assumptions. The bootstrap\'s route runs through brute force and honesty.`,
  };

  yield {
    state: matrixState({
      title: 'The trick: pretend your sample IS the population — resample it',
      rows: RESAMPLES.slice(0, 3).map((_, b) => ({ id: `b${b}`, label: `resample ${b + 1}` })),
      columns: [...SAMPLE.map((_, i) => ({ id: `c${i}`, label: '' })), { id: 'm', label: 'mean' }],
      values: RESAMPLES.slice(0, 3).map((r) => [...r, mean(r)]),
      format: (v) => String(Math.round(v)),
    }),
    highlight: { compare: ['b0:m', 'b1:m', 'b2:m'] },
    explanation: 'The move (Efron, 1979): draw ten values FROM your own ten, WITH REPLACEMENT — some values repeat, some vanish — and compute the mean of that synthetic sample. Each resample is an alternate version of the day you collected data: resample 1 dodged the 480 once and averaged 174; resample 2 caught it twice and hit 231. The variation between resamples mimics the variation between hypothetical repeat experiments — using no assumptions beyond the data itself standing in for the world it came from.',
    invariant: 'Resample n-from-n with replacement: each bootstrap sample is an alternate plausible dataset.',
  };

  const BINS = 16;
  const lo = MEANS[0];
  const hi = MEANS[MEANS.length - 1];
  const counts = Array(BINS).fill(0);
  for (const m of MEANS) counts[Math.min(BINS - 1, Math.floor(((m - lo) / (hi - lo)) * BINS))] += 1;
  yield {
    state: plotState({
      axes: { x: { label: 'resample mean (ms)' }, y: { label: 'how many of the 200 resamples' } },
      series: [{
        id: 'hist',
        label: 'bootstrap distribution',
        points: counts.map((c, k) => ({ x: lo + ((k + 0.5) * (hi - lo)) / BINS, y: c })),
      }],
      markers: [{ id: 'pt', x: mean(SAMPLE), y: Math.max(...counts), label: 'the point estimate' }],
    }),
    highlight: { active: ['hist'], found: ['pt'] },
    explanation: `Run it 200 times (this module just did — a fixed-seed generator, so your 200 match everyone\'s) and plot the resample means: the BOOTSTRAP DISTRIBUTION, the wobble made visible. It spans ${MEANS[0].toFixed(0)} to ${MEANS[MEANS.length - 1].toFixed(0)}ms, and notice the lean: a long right shoulder, because resamples that catch the 480ms straggler twice get yanked upward while nothing can yank equally far down. A formula assuming a symmetric bell would miss that lean entirely; the bootstrap inherits the data\'s own skew for free.`,
  };

  yield {
    state: matrixState({
      title: 'Read off the interval: middle 95% of the resample means',
      rows: [
        { id: 'point', label: 'point estimate' },
        { id: 'ci', label: '95% bootstrap CI' },
        { id: 'spread', label: 'the asymmetry' },
      ],
      columns: [{ id: 'val', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', `${mean(SAMPLE).toFixed(0)}ms`, `${CI_LO.toFixed(0)} – ${CI_HI.toFixed(0)}ms`, `âˆ’${(mean(SAMPLE) - CI_LO).toFixed(0)} / +${(CI_HI - mean(SAMPLE)).toFixed(0)} around the point`][v],
    }),
    highlight: { found: ['ci:val'], compare: ['spread:val'] },
    explanation: `Sort the 200 means, lop off the bottom and top 2.5% — what remains is the PERCENTILE INTERVAL: ${CI_LO.toFixed(0)}–${CI_HI.toFixed(0)}ms. That is the deliverable: "mean latency 187ms (95% CI ${CI_LO.toFixed(0)}–${CI_HI.toFixed(0)})." Read the asymmetry row: the interval reaches farther up than down, exactly as the skew demanded. And nothing in the recipe cared that we measured a MEAN — swap in a median, a p99, an F1 score, a model\'s accuracy (resample the test set!), and the same loop produces honest error bars for statistics that have no textbook formula at all. That universality is why the bootstrap is everywhere.`,
    invariant: 'The percentile CI is read directly off the resampled statistic — any statistic, no formula required.',
  };
}

function* readingIt() {
  yield {
    state: matrixState({
      title: 'What "95% confident" actually promises',
      rows: [
        { id: 'wrong', label: 'tempting reading âœ—' },
        { id: 'right', label: 'the real contract âœ“' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2]],
      format: (v) => ['', '"the true mean is in THIS interval with 95% probability"', 'the PROCEDURE captures the truth in 95% of repeated uses'][v],
    }),
    highlight: { removed: ['wrong:what'], found: ['right:what'] },
    explanation: 'The philosophical fine print, worth one careful minute: a frequentist confidence interval is a promise about the PROCEDURE, not this particular pair of numbers — run the recipe on a fresh dataset every day, and about 95% of the intervals you publish will contain the truth; any single interval either does or does not, unknowably. It is a quality guarantee on the factory, not a probability sticker on the unit. (The reading everyone wants — "95% probability it\'s in here" — is the BAYESIAN credible interval, which Thompson Sampling\'s posterior beliefs deliver, at the price of a prior.) In practice the two often nearly coincide; in exams and arguments, the distinction is the whole point.',
    invariant: 'Coverage is a property of the method over repetitions, not of one realized interval.',
  };

  yield {
    state: matrixState({
      title: 'Error bars change decisions: three results that "improved by 2 points"',
      rows: [
        { id: 'a', label: 'model A: +2.0 [+1.6, +2.4]' },
        { id: 'b', label: 'model B: +2.0 [âˆ’0.5, +4.5]' },
        { id: 'c', label: 'model C: +2.0 [+0.1, +3.9]' },
      ],
      columns: [{ id: 'verdict', label: 'verdict' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'real improvement — ship it', 'pure noise candidate — more data first', 'probably real, uncomfortably close to zero'][v],
    }),
    highlight: { found: ['a:verdict'], removed: ['b:verdict'] },
    explanation: 'Why bother? Because identical POINT results hide opposite decisions. Three models each gained "+2.0 accuracy" — but A\'s interval excludes zero decisively, B\'s straddles it (the gain may be the Cross-Validation & Honest Evaluation split lottery wearing a victory costume), and C squeaks by. An interval that contains zero is the CI-shaped version of a failed significance test (A/B Testing & p-values runs the same logic as a hypothesis test; CI-excludes-zero â‰ˆ p < 0.05). The rule that follows: a reported metric without an interval is a claim without a confidence — bootstrap your test-set metric and publish both numbers.',
  };

  yield {
    state: matrixState({
      title: 'Where the bootstrap breaks',
      rows: [
        { id: 'tiny', label: 'tiny samples (n < ~15)' },
        { id: 'tails', label: 'extreme tails (max, p99.9)' },
        { id: 'dep', label: 'dependent data (time series)' },
      ],
      columns: [{ id: 'why', label: 'why it fails' }, { id: 'fix', label: 'the patch' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'the sample is a poor stand-in for the world', 'collect more — no resampling rescues n=5', 'a resample can never exceed the observed max', 'extreme-value theory, not bootstrap', 'resampling rows shatters the correlation', 'block bootstrap: resample whole windows'][v],
    }),
    highlight: { compare: ['tiny:why', 'tails:why', 'dep:why'] },
    explanation: 'The honest failure modes. The bootstrap\'s only assumption — the sample represents the population — is also its single point of failure: ten points carrying one outlier represent the tail poorly (our 480ms appeared in the data once; the TRUE tail might hold 2-second monsters we never sampled, and no resampling invents unseen data). Statistics living AT the extremes (the maximum, p99.9) break it structurally. And dependent data — time series, user sessions — needs block variants that resample contiguous windows to preserve correlation (the grouped-split discipline from Data Leakage & Contamination, in resampling form). Inside those fences, it is the most useful trick in applied statistics: one loop, honest error bars, anywhere.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the bootstrap, resampled live') yield* liveBootstrap();
  else if (view === 'reading (and misreading) the interval') yield* readingIt();
  else throw new InputError('Pick a view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows sample data, bootstrap resamples, the histogram of resampled means, and the confidence interval bounds. Each resample draws ten values with replacement from the original ten, so some values repeat and some vanish. The histogram collects all 200 resampled means into a distribution. The interval is the middle 95 percent of that distribution, read directly from the sorted percentiles.',
        'The second view covers how to interpret confidence intervals and where the bootstrap breaks. Active markers highlight the current decision; found markers show settled facts.',
        {type: 'callout', text: 'The bootstrap replaces an unavailable formula with repeated resampling, turning one sample into an empirical distribution of plausible estimates.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Bradley Efron introduced the bootstrap at Stanford in 1979. Before that paper, computing a confidence interval required knowing the sampling distribution's formula. For a mean under normality, the formula exists and works. For a median, a ratio of means, a Gini coefficient, or a machine-learning metric, it often does not.",
        'The bootstrap lets the data speak for itself. Instead of deriving the sampling distribution mathematically, it simulates the sampling distribution by resampling the observed data. The result is honest error bars for almost any statistic, with no distributional assumption beyond "the sample represents the population."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The parametric confidence interval assumes the data come from a known distribution, usually normal. Under that assumption the formula is clean: mean plus or minus z times s over the square root of n, where z is 1.96 for 95 percent confidence. For large samples of well-behaved data, this works.',
        'The formula is attractive because it requires no simulation, no resampling loop, and no computational cost beyond the sample mean and standard deviation. When normality holds and the statistic is a mean, there is no reason to reach for anything heavier.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Many real distributions are not normal. Income data is skewed right. Latency measurements have heavy tails. Small samples do not invoke the central limit theorem strongly enough. The z-formula produces intervals that are too narrow on one side and too wide on the other, or simply wrong.',
        "The deeper problem is that many statistics have no clean parametric formula at all. The median, the 90th percentile, the ratio of two means, the Gini coefficient, an F1 score, a model's accuracy on a test set -- for these, there is no textbook formula to plug into. The parametric path is not just fragile; it is absent.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The plug-in principle: the empirical distribution of your sample approximates the population distribution. Resampling from the empirical distribution approximates drawing new samples from the population. Each resample is an alternate version of the experiment you actually ran.',
        'The bootstrap replaces the unknown population with the observed sample and replaces mathematical derivation with computational simulation. It trades a formula you may not have for a loop you can always run.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Empirical_bootstrap.svg', alt: 'Diagram showing the empirical bootstrap process: original sample resampled with replacement to build a distribution of statistics', caption: 'The bootstrap resamples the original dataset with replacement many times, computing the statistic on each resample to build an empirical sampling distribution. Source: Wikimedia Commons.'},
        'Start with n observed data points. Draw B bootstrap samples, each of size n, sampled with replacement from the original data. Some original values appear multiple times in a resample; others are absent. That is the mechanism -- replacement means each resample is a plausible alternate dataset, not a shuffle.',
        'Compute the statistic of interest (mean, median, whatever) on each of the B bootstrap samples. The collection of B computed statistics is the bootstrap distribution -- an empirical approximation of the sampling distribution.',
        'For a 95 percent confidence interval using the percentile method, sort the B statistics and take the 2.5th and 97.5th percentiles. Those two numbers are the interval bounds. The BCa (bias-corrected and accelerated) method adjusts for bias and skewness in the bootstrap distribution and is more accurate, especially for skewed statistics or small samples.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal distribution showing standard deviation bands and the 68-95-99.7 rule', caption: 'For normal data, 95% of values fall within roughly two standard deviations of the mean. The bootstrap produces intervals that respect the actual shape of the data, not just this symmetric ideal. Source: Wikimedia Commons.'},
        'The empirical distribution function converges to the true population distribution as sample size grows (Glivenko-Cantelli theorem). Resampling from a good approximation of the population produces a good approximation of the sampling distribution. Efron proved this works for "smooth" functionals -- statistics that change continuously as the underlying distribution changes.',
        'With B at 1,000 or more, Monte Carlo noise in the bootstrap distribution becomes small relative to the sampling variability it estimates. The interval inherits the shape of the data: if the data are skewed, the bootstrap distribution is skewed, and the interval is asymmetric. No symmetry assumption is imposed.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Drawing B resamples of size n costs O(B * n). Computing the statistic on each resample adds O(B * f(n)), where f(n) is the cost of the statistic on one sample. For a mean, f(n) is O(n), so the total is O(B * n). For a model evaluation metric, f(n) may be much larger.',
        'B = 1,000 to 10,000 is standard. Memory is O(n) for the data plus O(B) for the stored statistics. The loop is embarrassingly parallel: each resample is independent, so distributing across cores or machines is straightforward.',
        'The method is cheap when the statistic is cheap. Bootstrapping a test-set metric on 10,000 predictions with B = 2,000 is a few seconds. Bootstrapping a full training pipeline is usually impractical and unnecessary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A/B testing: bootstrap the difference in conversion rates to get a confidence interval that respects the actual shape of the data, including outliers and skew, without assuming normality.',
        'Median and quantile confidence intervals have no simple parametric formula. The bootstrap is the standard tool. Report "median latency 142ms (95% CI 120-178)" instead of a naked point estimate.',
        'Small samples: when n is 20 or 50, the central limit theorem is weak. The bootstrap adapts to whatever shape the data actually have.',
        'Complex statistics: the Gini coefficient, correlation coefficients, regression slopes, and model comparison metrics (accuracy difference, F1 difference) all get honest intervals from the same resampling loop. The bootstrap does not care what the statistic is; it only needs to compute it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Very small samples (n < 10): the bootstrap cannot create information that is not in the data. If the sample has five points, one of which is an outlier, the bootstrap distribution is dominated by how often that outlier appears in resamples. The empirical distribution is too coarse to approximate the population.',
        'Dependent data: if observations are correlated (time series, clustered users, repeated measures), naive row-level resampling breaks the dependence structure and produces intervals that are too narrow. Block bootstrap, circular bootstrap, or cluster bootstrap preserve the correlation by resampling contiguous windows or groups.',
        'Extreme quantiles: the 99.9th percentile of 100 observations cannot be estimated reliably by any method, bootstrap included. The resample can never exceed the observed maximum, so the bootstrap distribution is truncated where it matters most. Extreme-value theory, not resampling, is the right tool.',
        'Biased samples: the bootstrap estimates sampling variability conditional on the data-collection process. If the sample is biased by selection, nonresponse, or leakage, resampling it many times produces a precise interval around the wrong answer. Garbage in, garbage out -- with error bars.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Sample: [3, 5, 7, 2, 8]. Original mean: (3+5+7+2+8)/5 = 5.0.',
        'Resample 1 (with replacement): [5, 3, 8, 8, 2]. Mean: 5.2. Resample 2: [7, 7, 2, 3, 5]. Mean: 4.8. Resample 3: [8, 2, 2, 5, 3]. Mean: 4.0. Resample 4: [3, 8, 7, 7, 5]. Mean: 6.0. Resample 5: [2, 5, 8, 3, 7]. Mean: 5.0.',
        'Sort the five means: [4.0, 4.8, 5.0, 5.2, 6.0]. With only five resamples the interval is rough, but the idea is visible: the means wobble between 4.0 and 6.0. With B = 1,000, the sorted means fill out a smooth distribution and the 2.5th and 97.5th percentiles give a credible 95 percent interval.',
        'In practice, five resamples are far too few. The animation uses 200 for teaching clarity; real analysis uses 1,000 to 10,000.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Efron, "Bootstrap Methods: Another Look at the Jackknife," Annals of Statistics, 1979. The original paper that introduced the method.',
        'Efron and Tibshirani, An Introduction to the Bootstrap, Chapman and Hall, 1993. The standard textbook treatment covering percentile, BCa, and studentized intervals.',
        'DiCiccio and Efron, "Bootstrap Confidence Intervals," Statistical Science, 1996. The definitive reference on BCa intervals and their theoretical properties.',
        'Study Permutation Tests for resampling under a null hypothesis rather than for interval estimation. Study A/B Testing and p-values for the experiment-design context where bootstrap intervals are reported. Study Cross-Validation for model-evaluation uncertainty. For Bayesian-style intervals driven by posterior beliefs rather than frequentist resampling, study Thompson Sampling.',
      ],
    },
  ],
};
