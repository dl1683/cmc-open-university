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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A confidence interval is a range, not a point. You measured one thing once and got 187ms — that one number is called a point estimate. But if you ran the same experiment tomorrow, you would get a different number; the truth wobbles. A 95% confidence interval is a machine that takes your data and produces a range — say, 141–255ms — such that if you repeat the entire experiment-plus-interval-building process many times, 95% of your ranges will contain the truth. The procedure is a factory guarantee on its own accuracy over repetitions, not a probability sticker on any single number.`,
        `The classical route to intervals runs through formulas: assume the underlying measurement is normally distributed, memorize a table, plug in your sample mean and standard deviation, and out comes an interval. The bootstrap takes a different path: forget the formula, forget normality, and instead ask a bolder question: "What is the set of values my statistic could have taken if I re-ran the experiment?" Resample your own data — the one dataset you have — again and again with replacement (Efron, 1979), and watch the wobble draw itself. No assumptions; no textbook formulas; only brute-force honesty.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with one dataset. In our example: ten page-load measurements — [95, 120, 135, 142, 158, 165, 178, 190, 210, 480] — mean 187ms. The trick: pretend that dataset IS the entire population. Draw ten values from those ten, WITH REPLACEMENT (allowing repeats). Some of your original values will appear more than once, others not at all. Compute the statistic (mean, median, p99, whatever you chose) on that synthetic resample. Repeat this resample-and-compute step 200 times (or 10,000 times if you have patience), building up a distribution of resampled statistics. That distribution is the bootstrap distribution — the picture of wobble itself.`,
        `Why does this work? Because resampling with replacement creates alternate plausible datasets: each resample is a hypothetical day you could have collected data under the same conditions. Some resamples will catch the 480ms straggler twice and shoot upward (mean ~231ms); others will dodge it and drop lower (~174ms). The variation between those resamples mimics the variation between hypothetical repeat experiments — using only the data's own shape as a guide, no assumptions about normality or parametric form needed.`,
        `Read off the interval: sort your 200 resampled means and chop off the bottom and top 2.5% — what remains is the middle 95%. In our case, that is 141–255ms — the percentile confidence interval. Notice the asymmetry: the interval reaches −46ms below the point estimate but +68ms above. That skew came directly from the data's own skew (the 480 straggler pulls the right tail). A textbook formula assuming a symmetric bell curve would miss that entirely; the bootstrap inherits the actual shape for free. And the trick scales: swap "mean" for "median," "F1 score," "model accuracy on the test set," or any statistic with no formula in the textbook. Resample and build the interval the same way. That universality is why the bootstrap is everywhere.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computational cost: you need B resamples (typically 200–10,000 depending on how polished you want the CI). Each resample involves drawing n random indices and computing your statistic from n values. For n observations and B resamples, the cost is O(B × n × f), where f is the cost to compute your statistic once. For a mean, f = O(n), so total is O(B × n²) — slow if n is huge and B is large, but modern machines run 10,000 resamples on a million rows in seconds. Storage: you need the original data (unchanged), and optionally you can store the B resampled statistics for plotting; that is O(B) extra memory, easily a few MB.`,
        `Conceptual cost: practically zero. There are no assumptions to verify, no formulas to memorize, no asymptotic arguments to follow. The only rule is "your sample represents the population" — if that is false (you sampled only from one region, or your data is confounded), the bootstrap fails, but it fails honestly and symmetrically with the formula-based approach.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `A/B Testing & p-values: you run an A/B test, measure a 2-point improvement in click-through rate, and want to know: is it real, or just noise? Bootstrap your control and treatment samples separately, compute the difference in improvement for each resample pair, and build a CI on the difference. If the interval excludes zero, the improvement is real; if it straddles zero, the result is noise and you need more data.`,
        `Cross-Validation & Honest Evaluation: you report model accuracy but want error bars. Resample your test set (treating your measurements as the population) or, better, run cross-validation splits and bootstrap the accuracy across those splits. Now your paper says "87% accuracy (95% CI 84–90%)" — a deliverable, not a claim.`,
        `Machine learning hyperparameter tuning: your learning rate search finds that learning rate 0.001 beats 0.01 by 0.5%, but are you cherry-picking that split? Bootstrap your validation fold, compute the accuracy gap on each resample, and see if the interval excludes zero. If not, both rates are equivalent and you can pick the simpler one.`,
        `Production monitoring: your live system reports 99.5% uptime but what is the margin of error across sites, days, or user cohorts? Bootstrap the uptime samples you collected and publish the interval. If next month's samples bootstrap to a lower interval, something changed.`,
        `Survey and polling: you poll 1,000 voters and 52% say they will vote for candidate A. The margin of error is typically ±3 percentage points — where does that come from? Classical formula (Cochran). Bootstrap works too: resample from your 1,000 responses and recompute the fraction voting A in each resample; the middle 95% gives you the interval.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Misconception 1: "The true value has a 95% probability of being in this interval." Wrong. The interval either contains the truth or it does not; the 95% is about the procedure's repeated performance, not this particular pair of numbers. The correct reading is: "If I repeat the experiment and rebuild the interval, 95% of my intervals will trap the truth." That is a frequentist confidence interval. If you want the Bayesian reading — "95% probability the truth is here given my prior" — you need a Bayesian credible interval (like Thompson Sampling's posterior), which trades your assumption-free bootstrap for an assumption about the prior. Both are valid; they answer different questions.`,
        `Misconception 2: The posterior probability from the CI is the same as a significance test. It is not — but it is close. If the CI excludes zero (or your null hypothesis), you would reject it in a hypothesis test (p < 0.05). But the CI also shows you the magnitude and direction of the effect, which a p-value alone does not. A p-value says "reject" or "fail to reject"; a CI says "the effect is probably between here and here."`,
        `Misconception 3: A small sample is harmless. With n < 15, your sample is a poor stand-in for the whole world — the bootstrap's only real assumption crumbles. Tiny samples have high variance and the resampling cannot invent unseen data. Collect more. No resampling magic rescues n = 5.`,
        `Misconception 4: The bootstrap works on any statistic. False on the tails. The maximum, p99, p99.9 — resampling can never produce a value larger than the largest observation. Extreme-value theory (a different toolbox) is needed for those. The bootstrap works beautifully for means, medians, proportions, accuracy scores, and most robust summaries; it breaks on extremes.`,
        `Misconception 5: Block bootstrap is a variant. True, but critical. If your data is time-series or grouped (sessions, user cohorts), resampling individual points shatters correlation and the CI is garbage. Block bootstrap resamples entire contiguous windows, preserving the internal structure. This is the same "resample rows, not features" discipline that Data Leakage & Contamination preaches, applied here.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `A/B Testing & p-values runs the same logic: hypothesis testing and confidence intervals are two doors into the same room. The CI-excludes-zero test is equivalent to p < 0.05; understanding both frames makes you fluent in statistical decision-making.`,
        `Cross-Validation & Honest Evaluation teaches how to bootstrap test-set metrics to earn error bars you can publish. Your model accuracy is only credible if you show the interval.`,
        `Thompson Sampling pairs a prior with Bayesian updates to build credible intervals — the answer to "what is the probability the truth is in here?" It is not bootstrap, but it solves the same problem (uncertainty quantification) with a different philosophical foundation (Bayesian vs. frequentist).`,
        `Data Leakage & Contamination enforces the principle that resampling must respect the structure of your data: resample grouped units together to preserve dependency. Block bootstrap is the resampling version of the same rule.`,
        `Hot Rows & Append-and-Aggregate explains why real latency distributions have stragglers like our 480ms outlier — queue effects, cache misses, GC pauses. Understanding tail events shapes why error bars matter.`,
        `Reservoir Sampling: if your data is a stream (infinite, no second pass), how do you collect a random sample for bootstrapping? Reservoir sampling solves that.`,
      ],
    },
  ],
};

