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
    explanation: `Ten page-load measurements, mean ${mean(SAMPLE).toFixed(0)}ms — and the report is due: "average latency: 187ms." Stop. If you measured ten DIFFERENT requests tomorrow, would you get 187 again? Obviously not — especially with that 480ms straggler in the data (one tail event, and real latency always has them — see Hot Rows & Append-and-Aggregate's queue spikes). The honest deliverable is not a point, it is a RANGE: the set of values the true mean could plausibly be. The classical route to that range runs through formulas and normality assumptions. The bootstrap's route runs through brute force and honesty.`,
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
    explanation: `Run it 200 times (this module just did — a fixed-seed generator, so your 200 match everyone's) and plot the resample means: the BOOTSTRAP DISTRIBUTION, the wobble made visible. It spans ${MEANS[0].toFixed(0)} to ${MEANS[MEANS.length - 1].toFixed(0)}ms, and notice the lean: a long right shoulder, because resamples that catch the 480ms straggler twice get yanked upward while nothing can yank equally far down. A formula assuming a symmetric bell would miss that lean entirely; the bootstrap inherits the data's own skew for free.`,
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
      format: (v) => ['', `${mean(SAMPLE).toFixed(0)}ms`, `${CI_LO.toFixed(0)} – ${CI_HI.toFixed(0)}ms`, `−${(mean(SAMPLE) - CI_LO).toFixed(0)} / +${(CI_HI - mean(SAMPLE)).toFixed(0)} around the point`][v],
    }),
    highlight: { found: ['ci:val'], compare: ['spread:val'] },
    explanation: `Sort the 200 means, lop off the bottom and top 2.5% — what remains is the PERCENTILE INTERVAL: ${CI_LO.toFixed(0)}–${CI_HI.toFixed(0)}ms. That is the deliverable: "mean latency 187ms (95% CI ${CI_LO.toFixed(0)}–${CI_HI.toFixed(0)})." Read the asymmetry row: the interval reaches farther up than down, exactly as the skew demanded. And nothing in the recipe cared that we measured a MEAN — swap in a median, a p99, an F1 score, a model's accuracy (resample the test set!), and the same loop produces honest error bars for statistics that have no textbook formula at all. That universality is why the bootstrap is everywhere.`,
    invariant: 'The percentile CI is read directly off the resampled statistic — any statistic, no formula required.',
  };
}

function* readingIt() {
  yield {
    state: matrixState({
      title: 'What "95% confident" actually promises',
      rows: [
        { id: 'wrong', label: 'tempting reading ✗' },
        { id: 'right', label: 'the real contract ✓' },
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
        { id: 'b', label: 'model B: +2.0 [−0.5, +4.5]' },
        { id: 'c', label: 'model C: +2.0 [+0.1, +3.9]' },
      ],
      columns: [{ id: 'verdict', label: 'verdict' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'real improvement — ship it', 'pure noise candidate — more data first', 'probably real, uncomfortably close to zero'][v],
    }),
    highlight: { found: ['a:verdict'], removed: ['b:verdict'] },
    explanation: 'Why bother? Because identical POINT results hide opposite decisions. Three models each gained "+2.0 accuracy" — but A\'s interval excludes zero decisively, B\'s straddles it (the gain may be the Cross-Validation & Honest Evaluation split lottery wearing a victory costume), and C squeaks by. An interval that contains zero is the CI-shaped version of a failed significance test (A/B Testing & p-values runs the same logic as a hypothesis test; CI-excludes-zero ≈ p < 0.05). The rule that follows: a reported metric without an interval is a claim without a confidence — bootstrap your test-set metric and publish both numbers.',
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

const legacyArticle = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `A point estimate is too confident by itself. "Mean latency is 187ms" hides the fact that ten different requests tomorrow might give a different mean, especially when one observed request took 480ms. A confidence interval is the error bar around the estimate.`,
        `The bootstrap exists for the cases where you want that error bar without trusting a neat textbook formula. If this sample is the best picture of the world you have, resample it and watch how much the statistic wobbles.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious approach is to report the average and move on. The wall is that the average is a random object: it depends on which observations landed in your sample. Another approach is to use a closed-form standard error, but that can be brittle for skewed data, medians, p99s, F1 scores, or metrics whose sampling distribution is awkward.`,
        `The bootstrap's bet is simple and imperfect: treat the observed sample as a stand-in for the population, then simulate many alternate samples from it. That is not magic, but it is often more honest than pretending the data are symmetric and formula-friendly.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Each bootstrap sample draws n values from the original n, with replacement. Some values repeat, some disappear, and the 480ms straggler sometimes appears twice. Compute the statistic on each synthetic sample, sort the resulting statistics, and read the middle 95% as a percentile interval.`,
        `The resulting interval is not "a 95% probability that this one interval contains truth." It is a repeated-use guarantee: the procedure captures the true value in about 95% of repeated experiments. Thompson Sampling gives the Bayesian style of uncertainty; the bootstrap stays frequentist and lets the data draw the wobble.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `The first view shows resamples as alternate versions of the day you measured. Read repeated values and missing values literally: with replacement means the 480ms tail can appear twice or not at all. The histogram is the wobble of the mean made visible.`,
        `The interval row is deliberately asymmetric. That is the point. The data have a right tail, so the bootstrap distribution has a right shoulder. A symmetric formula would smooth away the very behavior you need to see.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `For B bootstrap rounds and n observations, drawing the samples costs O(Bn). Computing the statistic adds O(B f(n)), where f(n) is the statistic's cost on one resample; for a mean, the whole loop is linear in Bn, not quadratic. Memory is O(n) for the data plus O(B) if you store the resampled statistics for a histogram.`,
        `The method is computationally cheap for tables and model metrics, but it is not free if the statistic itself is expensive. Bootstrapping a full training pipeline is usually overkill; bootstrapping a fixed test-set metric is often reasonable.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Bootstraps put useful error bars on latency, conversion lift, F1 score, revenue per user, recommender metrics, and model scores. Hot Rows & Append-and-Aggregate explains why latency has ugly tails like the 480ms point here. Reservoir Sampling can collect a representative stream sample before bootstrapping.`,
        `Importance Sampling & Off-Policy Estimation and Doubly Robust Estimation often report uncertainty with bootstrap-style resampling when closed-form variance is fragile. Cross-Validation & Honest Evaluation uses the same habit for model metrics: publish accuracy with an interval, not as a naked point estimate.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The bootstrap cannot invent data you never observed. With n = 5, or when estimating a maximum or p99.9, the sample is too thin to represent the tail. Dependent data also needs care: user sessions, time series, and grouped observations should be resampled as blocks or groups.`,
        `Data Leakage & Contamination teaches the same boundary rule for ML splits: keep dependent units together or your interval will look tighter than reality. The bootstrap is dangerous when its easy loop gives a precise-looking interval from a non-representative sample.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Pair this with Permutation Tests to separate "how large is the effect?" from "could labels alone explain it?" Then use Statistical Power & Sample Size to decide whether a future study can make the interval narrow enough to act. For decision-making under posterior beliefs, read Thompson Sampling; for causal log analysis with error bars, read Doubly Robust Estimation.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A point estimate is not enough. If a sample mean is 42, the next question is how uncertain that number is. Classical formulas answer this for some estimators under some assumptions, but real analysis often uses medians, percentiles, model metrics, skewed data, or statistics with awkward formulas.',
        'The bootstrap estimates uncertainty by resampling from the observed data. It treats the sample as a stand-in for the population, repeatedly draws new samples with replacement, recomputes the statistic, and uses the variation across those recomputations to build an interval.',
        'This is why bootstrap is so useful in applied work. It lets the analyst ask for uncertainty around the statistic they actually care about, instead of replacing the question with a statistic that happens to have a convenient textbook formula.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use a normal approximation: estimate a standard error and report estimate plus or minus 1.96 standard errors. That works well for many means in large samples, but it can be poor for small samples, skewed data, bounded metrics, medians, and complicated estimators.',
        'Another tempting approach is to report only the observed statistic. That hides sampling uncertainty. A dashboard that shows conversion rate without an interval invites overreaction to noise, especially when sample sizes differ across groups.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that sampling variability can be simulated from the sample itself. A bootstrap resample has the same size as the original sample and is drawn with replacement. Some original observations appear multiple times; some are absent. Each resample is a plausible alternate sample from the same source.',
        'By recomputing the statistic many times, the analyst gets an empirical distribution of the estimator. The spread of that distribution estimates how much the statistic would vary if the study were repeated.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with n observed data points. Draw n points with replacement from those observations. Compute the statistic on that resample. Repeat hundreds or thousands of times. Sort the bootstrap statistics and take percentiles, such as the 2.5th and 97.5th percentiles for a rough 95 percent interval.',
        'The percentile interval is easy to explain, but it is not the only method. Basic, studentized, and BCa intervals adjust for bias, skew, or varying standard error. The right method depends on the statistic, sample size, and how accurate the interval needs to be.',
        'Bootstrap can also compare groups by resampling within each group and recomputing a difference. That gives an uncertainty interval for the difference, which is often more useful than two separate intervals that readers compare by eye.',
        'The resample size usually matches the original sample size. That detail matters. The bootstrap is trying to approximate how the estimator varies for studies of this size, not how it would behave if the analyst had collected ten times more data.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The resampling view proves why replacement matters. A bootstrap sample is not a shuffle. It is a new sample drawn from the empirical distribution, so repeated observations and omitted observations are expected.',
        'The histogram view proves that the interval comes from estimator variation. Each bar is one recomputed statistic. A narrow histogram means the statistic is stable under resampling. A wide or skewed histogram means the estimate is fragile or asymmetric.',
        'If the original statistic sits far from the center of the bootstrap histogram, that is a bias warning. The interval may still be useful, but the analyst should ask whether the estimator, sample size, or resampling method is behaving poorly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Bootstrap works when the observed sample is a reasonable approximation of the population and the statistic behaves smoothly enough under resampling. The empirical distribution substitutes for the unknown population distribution, and repeated resamples approximate repeated studies.',
        'It is not magic. It cannot reveal variation that the sample never captured. If the sample is biased, too small, dependent, or missing rare cases, the bootstrap may confidently resample the wrong evidence. The quality of the interval depends on the quality of the data-generating design.',
        'The method is strongest when the sample contains the kinds of variation future samples will contain. That is why representative sampling, correct units, and enough observations matter more than the number of bootstrap loops. Resampling bad evidence many times still gives bad evidence.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is repeated computation. For a simple mean, thousands of resamples are cheap. For a model fit, causal estimator, or cross-validation metric, each bootstrap replicate can be expensive. Parallelism helps because replicates are independent.',
        'The tradeoff is flexibility versus assumptions. Bootstrap handles many statistics without deriving a custom formula, but it still assumes the resampling scheme matches the data. Independent rows can be resampled row-wise; clustered, paired, or time-series data need block, cluster, or paired bootstrap designs.',
        'The number of replicates controls Monte Carlo noise in the interval itself. A quick exploratory chart may use a few hundred resamples. A reported result may need several thousand or more, especially for tail percentiles.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bootstrap intervals are useful for medians, percentiles, model metrics, lift estimates, regression summaries, A/B test effect sizes, and exploratory analysis where a formula is unavailable or hard to trust. They make uncertainty tangible because the analyst can inspect the whole resampled distribution.',
        'They are also useful for teaching. Students can see that a statistic is a random variable produced by sampling, not a fixed truth. The interval is not decoration; it is a statement about how much the estimate moves under plausible repeated samples.',
        'They are useful in reporting because they keep the analysis close to the product question. If the metric is p95 latency or median revenue per user, the bootstrap can put an interval around that metric directly instead of translating the question into a mean for convenience.',
        'They also help compare metrics that live on different scales. A lift estimate, a latency percentile, and an F1 score can each get an interval from the same resampling habit, letting a report show uncertainty consistently across very different quantities.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is resampling the wrong unit. If data are users with many events, resampling events treats dependent rows as independent and makes intervals too narrow. Resample users or clusters when the unit of independence is the user or cluster.',
        'The second failure is trusting bootstrap with tiny or unrepresentative samples. If a rare failure mode is absent from the observed data, no amount of resampling will invent it. The bootstrap repeats the evidence you have; it does not repair the evidence you failed to collect.',
        'A third failure is using bootstrap to hide design problems. Selection bias, leakage, peeking, nonresponse, and bad measurement do not become valid because the rows were resampled many times. Resampling estimates uncertainty conditional on the data pipeline; it does not certify the pipeline.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Permutation Tests for resampling under a null hypothesis, A/B Testing and p-values for experiment framing, Cross-Validation for model evaluation uncertainty, Jackknife for leave-one-out influence, and Causal Inference topics for designs where naive row resampling breaks the treatment assignment logic.',
        'A useful exercise is to bootstrap the mean, median, and 90th percentile of the same skewed sample. The different interval widths will show why estimator choice and distribution shape matter as much as sample size.',
        'Then repeat with 30 observations and 3,000 observations. The method is the same, but the stability of the bootstrap distribution will make sample size visible in a way a single formula often hides.',
      ],
    },
  ],
};
