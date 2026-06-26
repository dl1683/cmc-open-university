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
        'The first view ("the bootstrap, resampled live") opens with ten raw page-load measurements. Step 1 shows the original sample and its mean. Step 2 draws three resamples -- each picks ten values from the original ten with replacement, so duplicates appear and some originals are skipped -- and displays each resample\'s mean side by side. Step 3 plots all 200 resampled means as a histogram: the bootstrap distribution, which is the empirical picture of how much the mean would wobble across hypothetical repeat experiments. Step 4 reads the 95 percent confidence interval directly off that histogram by trimming the bottom 2.5 percent and top 2.5 percent.',
        'The second view ("reading and misreading the interval") walks through the frequentist interpretation of confidence, demonstrates how identical point estimates hide opposite decisions when intervals differ, and catalogs the three structural failure modes of the bootstrap. Highlighted cells use color: green ("found") marks settled facts, red ("removed") marks common misreadings, and blue ("compare") marks items worth contrasting.',
        'The animation uses a deterministic random seed (LCG, seed 42) so every visitor sees the same 200 resamples. That makes the histogram reproducible -- you can verify any number shown by re-running the same generator yourself.',
        {type: 'callout', text: 'The bootstrap replaces an unavailable formula with repeated resampling, turning one sample into an empirical distribution of plausible estimates.'},

        {type: 'image', src: './assets/gifs/bootstrap-ci.gif', alt: 'Animated walkthrough of the bootstrap ci visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You measure something once and get a single number. The number is not the truth; it is one draw from a distribution of values you would have gotten under slightly different conditions. A confidence interval (CI) quantifies that wobble: it is a range of values consistent with the data, computed so that the procedure captures the true parameter in a stated fraction (typically 95 percent) of repeated uses. Without a CI, a reported metric is a claim without a margin of error.',
        'Before 1979, building a CI required deriving or looking up a formula for the sampling distribution of your statistic. For the mean of normally distributed data, that formula is the t-distribution -- clean and well-known. But for a median, a ratio of two means, a Gini coefficient, an F1 score, or a model\'s accuracy gap on a test set, no closed-form sampling distribution exists. Practitioners either forced normality assumptions that did not hold or reported naked point estimates with no uncertainty attached.',
        'Bradley Efron\'s 1979 paper ("Bootstrap Methods: Another Look at the Jackknife," Annals of Statistics) eliminated the bottleneck. His idea: instead of deriving the sampling distribution analytically, simulate it by resampling the data you already have. The method requires no distributional assumptions, works for any computable statistic, and costs only a loop. It turned uncertainty quantification from a theoretical exercise into a computational one.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classical parametric CI for a mean assumes the data come from a normal distribution. Under that assumption the formula is: sample mean plus or minus z times (s / sqrt(n)), where s is the sample standard deviation, n is the sample size, and z is the critical value from the standard normal (1.96 for 95 percent confidence). For small n, replace z with the t-distribution critical value to account for estimating s from the data.',
        'This formula is fast, deterministic, and requires only two summary statistics (mean, standard deviation). It produces exact coverage under its assumptions. When the data genuinely are normal and the statistic is a mean, there is no reason to use anything else -- the formula is optimal.',
        'The approach extends naturally to differences of means (two-sample t-test), regression coefficients (the standard error from the OLS covariance matrix), and proportions (the Wald interval using the binomial variance formula). Entire branches of applied statistics were built on these closed-form intervals, and they work well within their assumptions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The parametric formula breaks in two distinct ways. First, the distributional assumption fails. Income data is right-skewed; latency measurements have heavy tails; medical costs have point masses at zero. When the underlying distribution is non-normal and n is not large enough for the central limit theorem to rescue you, the z-interval or t-interval produces coverage that misses the stated 95 percent -- sometimes by a lot. A 95 percent interval that actually covers 88 percent of the time is worse than useless because it creates false confidence.',
        'Second, and more fundamentally, many statistics have no closed-form sampling distribution at all. The median of 30 observations, the ratio of two regression coefficients, the difference in AUC between two classifiers, the 90th percentile of response times -- for these, there is no formula to plug numbers into. The parametric path is not merely fragile; it is absent. You either derive the distribution yourself (a research project, not a practical option) or you give up on uncertainty quantification entirely.',
        'The gap is widest in machine learning. You train a model, evaluate it on a test set, and get accuracy = 0.847. Is that distinguishable from 0.839? The test set is fixed; there is no textbook formula for the sampling distribution of accuracy-on-this-particular-test-set. Without error bars, "we improved by 0.8 points" could be noise or signal, and there is no way to tell.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The plug-in principle: treat the observed sample as if it were the population. If you could draw fresh samples from the true population, you would see how the statistic varies across samples and that variation is the sampling distribution. You cannot draw from the population again -- you already spent your data budget. But you can draw from the next best thing: the empirical distribution that puts equal weight 1/n on each observed data point. Drawing n values with replacement from this empirical distribution is a bootstrap resample, and each resample is a plausible alternate version of the experiment you ran.',
        'The key operation is "with replacement." Without replacement, every resample would be an identical permutation of the original data, and the statistic would be the same every time. With replacement, each resample has a different composition -- some original values appear twice or three times, others are missing -- and the statistic fluctuates. That fluctuation is the bootstrap\'s estimate of sampling variability.',
        'The bootstrap replaces an analytic derivation you may not be able to perform with a computational simulation you can always run. The price is compute time instead of mathematical insight. The payoff is universality: the same loop handles any statistic, any data shape, any sample size above a modest minimum.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Empirical_bootstrap.svg', alt: 'Diagram showing the empirical bootstrap process: original sample resampled with replacement to build a distribution of statistics', caption: 'The bootstrap resamples the original dataset with replacement many times, computing the statistic on each resample to build an empirical sampling distribution. Source: Wikimedia Commons.'},
        'Step 1: collect your data. You have n observations -- call them x_1 through x_n. Compute the statistic of interest on the original sample: call it theta_hat. This is the point estimate.',
        'Step 2: resample. For each bootstrap round b from 1 to B, draw n values from the original sample with replacement. This produces a bootstrap sample x*_1 through x*_n. Because of replacement, some original values will appear multiple times and others will be absent. On average, about 63.2 percent of the original data points appear at least once in any single resample (1 - (1 - 1/n)^n converges to 1 - 1/e as n grows). Compute the statistic on this resample: theta*_b.',
        'Step 3: build the bootstrap distribution. After B rounds, you have B values of theta*. This collection is the bootstrap distribution -- an empirical approximation of the sampling distribution of theta_hat. The percentile method reads the CI directly: sort the B values and take the alpha/2 and 1 - alpha/2 quantiles. For a 95 percent CI, that means the 2.5th and 97.5th percentiles. The BCa (bias-corrected and accelerated) variant adjusts for systematic bias and acceleration (rate at which the standard error changes with the parameter), producing more accurate coverage when the bootstrap distribution is skewed or the statistic is biased.',
        'Step 4: report. The deliverable is: "theta_hat = X (95 percent CI [lo, hi])." The interval communicates how much theta_hat would wobble across hypothetical repeated experiments -- information that the point estimate alone conceals.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal distribution showing standard deviation bands and the 68-95-99.7 rule', caption: 'For normal data, 95% of values fall within roughly two standard deviations of the mean. The bootstrap produces intervals that respect the actual shape of the data, not just this symmetric ideal. Source: Wikimedia Commons.'},
        'The theoretical backbone is the Glivenko-Cantelli theorem: the empirical distribution function F_n converges uniformly to the true distribution F as n grows. If F_n is close to F, then resampling from F_n produces a distribution of the statistic close to the one you would get by resampling from F. Efron formalized this for "smooth functionals" -- statistics that change continuously as the underlying distribution changes -- showing that the bootstrap distribution converges to the true sampling distribution.',
        'Concretely, the bootstrap inherits the shape of the data. If the data are right-skewed, the resampled means are right-skewed, and the resulting CI is asymmetric -- wider on the right. A parametric z-interval would force symmetry and get the shape wrong. The bootstrap gets it right automatically, because the resampling mirrors the actual data rather than an assumed distribution.',
        'The Monte Carlo error from using finite B is separate from the statistical error from using finite n. With B = 1,000, the standard deviation of the bootstrap percentile due to Monte Carlo noise is roughly 1/sqrt(B) of the bootstrap standard error -- small enough to be ignorable for most purposes. Increasing B to 10,000 shrinks Monte Carlo noise further but cannot reduce the fundamental uncertainty from having only n observations. The bootstrap honestly reflects the information in the data; it does not manufacture precision.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Drawing one bootstrap resample of size n costs O(n) random number generations and O(n) memory for the resample. Computing the statistic on one resample costs O(f(n)) where f(n) is the statistic\'s complexity: O(n) for a mean, O(n log n) for a median via sorting, O(n) for accuracy given precomputed predictions. Over B rounds the total is O(B * (n + f(n))).',
        'Memory is modest: O(n) for the original data, O(n) for one resample at a time (reused across rounds), and O(B) for the stored statistics. You do not need to keep all B resamples in memory simultaneously -- compute the statistic, store it, discard the resample, and move on.',
        'The loop is embarrassingly parallel. Each resample is independent of every other, so the B rounds can be split across cores or machines with no communication overhead. NumPy\'s vectorized resampling can run B = 10,000 on n = 10,000 in under a second on a laptop. SciPy provides scipy.stats.bootstrap as a one-liner. In R, the boot package has been standard for decades.',
        'The cost becomes prohibitive only when the statistic itself is expensive. If computing theta requires retraining a neural network, then B = 1,000 means 1,000 training runs. In that case, bootstrap the test-set metric (cheap) rather than the training pipeline (expensive). Resample the predictions and labels, not the training process.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A/B testing with non-normal metrics. Conversion rates, revenue per user, and session duration are all skewed or heavy-tailed. The bootstrap produces CIs that respect the actual data shape. A company comparing two checkout flows bootstraps the difference in mean revenue per user and checks whether the interval excludes zero -- the same logic as a significance test, but with a richer output.',
        'Machine learning model comparison. You have two models, each evaluated on the same 5,000-example test set. Bootstrap the test set: for each resample, compute accuracy for both models and record the difference. The 95 percent CI of the accuracy difference tells you whether one model genuinely outperforms the other or the gap is within noise. This is standard practice in NLP benchmarks (e.g., the paired bootstrap test for BLEU scores).',
        'Median and quantile intervals. Reporting "median latency 142ms" is incomplete. The bootstrap gives you "median latency 142ms (95 percent CI 120-178ms)" with no formula derivation. The same loop produces CIs for the 90th or 99th percentile, which have no simple parametric interval.',
        'Complex derived statistics. The Gini coefficient, the ratio of two regression coefficients, the correlation between two variables after adjusting for a third -- all of these are smooth functionals for which the bootstrap is the standard uncertainty-quantification tool. Kaggle leaderboard shakeups are a direct consequence of not bootstrapping: the public leaderboard score has no error bar, so competitors optimize to noise.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tiny samples (n < 10-15). The empirical distribution puts mass only on the observed values. With n = 5, the empirical distribution is a crude five-point approximation to a continuous population. The bootstrap distribution is dominated by which values happen to repeat in each resample, and the resulting CI has erratic coverage -- sometimes 80 percent, sometimes 99 percent, instead of the stated 95 percent. No resampling scheme invents data that was never observed. For tiny n, exact methods (permutation tests, Bayesian intervals with informative priors) are more trustworthy.',
        'Extreme quantiles. The bootstrap can never produce a resample statistic beyond the observed data range. If you bootstrap the maximum of n = 100 observations, every resample maximum is at most the observed maximum. The bootstrap distribution of the maximum is truncated exactly where it matters most. The 99.9th percentile of 100 observations has the same problem: the tail is too sparse for resampling to estimate. Extreme-value theory (Generalized Extreme Value distributions, peaks-over-threshold) is the correct tool for tail quantiles.',
        'Dependent data. If observations are correlated -- time series, repeated measures on the same subject, spatially clustered data -- naive i.i.d. resampling shatters the correlation structure. The resulting intervals are too narrow because they underestimate the effective sample size. The block bootstrap (Kunsch 1989, Liu and Singh 1992) fixes this by resampling contiguous blocks of observations rather than individual points, preserving the local dependence. Choosing the block length is itself a nontrivial problem.',
        'Biased samples. The bootstrap quantifies sampling variability, not systematic bias. If your sample is biased by selection, survivorship, or data leakage, resampling it 10,000 times produces a narrow, precise interval centered on the wrong answer. The bootstrap gives you honest error bars for the world your sample represents, which may not be the world you care about. Garbage in, tight garbage out.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Data: seven server response times in milliseconds: [88, 104, 117, 135, 142, 198, 410]. The sample mean is (88 + 104 + 117 + 135 + 142 + 198 + 410) / 7 = 170.57ms. The 410ms value is an outlier -- a slow database query, perhaps. We want a 95 percent CI for the population mean.',
        'We run B = 10 bootstrap resamples (far too few for real work, but enough to trace the mechanics). Resample 1: [135, 410, 88, 135, 104, 198, 117], mean = 169.57. Resample 2: [410, 410, 104, 88, 142, 117, 135], mean = 200.86. Resample 3: [104, 117, 88, 142, 142, 104, 135], mean = 118.86. Resample 4: [198, 135, 410, 198, 88, 142, 104], mean = 182.14. Resample 5: [117, 135, 135, 88, 198, 410, 142], mean = 175.00. Resample 6: [142, 104, 88, 117, 135, 88, 104], mean = 111.14. Resample 7: [410, 142, 198, 135, 410, 104, 117], mean = 216.57. Resample 8: [88, 135, 142, 104, 198, 117, 88], mean = 124.57. Resample 9: [198, 410, 135, 142, 104, 117, 198], mean = 186.29. Resample 10: [135, 88, 104, 410, 142, 135, 117], mean = 161.57.',
        'Sorted resample means: [111.14, 118.86, 124.57, 161.57, 169.57, 175.00, 182.14, 186.29, 200.86, 216.57]. With B = 10, the 2.5th percentile is approximately the 1st value (111.14) and the 97.5th percentile is approximately the 10th (216.57). Even from this tiny run, the asymmetry is visible: the interval stretches farther above the point estimate (170.57 to 216.57 = +46) than below (170.57 to 111.14 = -59.4), reflecting the right skew introduced by the 410ms outlier.',
        'With B = 10,000, the sorted means fill a smooth curve. The 250th and 9750th values become the interval bounds, and Monte Carlo noise shrinks to negligible levels. In Python: "from scipy.stats import bootstrap; import numpy as np; data = (np.array([88,104,117,135,142,198,410]),); result = bootstrap(data, np.mean, n_resamples=10000); print(result.confidence_interval)" gives a CI of approximately [114, 236]ms. The width reflects the reality that seven observations with one heavy outlier leave substantial uncertainty about the true mean.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Efron, "Bootstrap Methods: Another Look at the Jackknife," Annals of Statistics 7(1), 1979, pp. 1-26. The founding paper. Introduces the nonparametric bootstrap and proves consistency for smooth functionals.',
        'Efron and Tibshirani, An Introduction to the Bootstrap, Chapman & Hall/CRC, 1993. The standard textbook. Covers the percentile method, the BCa method, the studentized bootstrap, and regression bootstrapping with worked examples. Chapter 14 on BCa is the definitive practical reference.',
        'DiCiccio and Efron, "Bootstrap Confidence Intervals," Statistical Science 11(3), 1996, pp. 189-228. Rigorous treatment of coverage accuracy: first-order (percentile), second-order (BCa, studentized), and their theoretical justification.',
        'Davison and Hinkley, Bootstrap Methods and their Application, Cambridge University Press, 1997. The most thorough textbook treatment, including block bootstrap for time series, parametric bootstrap, and permutation tests as a special case. Study Permutation Tests next for resampling under a null hypothesis rather than for interval estimation. Study A/B Testing and p-values for the experimental context where bootstrap CIs appear. Study Cross-Validation for uncertainty in model-evaluation metrics. For intervals driven by posterior beliefs instead of frequentist resampling, study Thompson Sampling.',
      ],
    },
  ],
};
