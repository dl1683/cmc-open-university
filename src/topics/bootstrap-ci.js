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
        `A confidence interval is an error bar for an estimate. This page starts with ten page-load measurements, including one 480ms tail event, whose mean is 187ms. The bootstrap asks a practical question: if this small dataset is the best picture of the world we have, how much would the mean wobble if we sampled again? The visualization answers by resampling the ten values 200 times with replacement.`,
        `The resulting interval is not "a 95% probability that this one interval contains truth." It is a repeated-use guarantee: the procedure captures the true value in about 95% of repeated experiments. Thompson Sampling gives the Bayesian style of uncertainty; Confidence Intervals & the Bootstrap stays frequentist and lets the data draw the wobble.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each bootstrap sample draws ten values from the original ten, with replacement. Some values repeat, some disappear, and the 480ms straggler sometimes appears twice. The code computes the mean of each synthetic sample, sorts the 200 means, and reads the middle 95% as a percentile interval. In the visualization, the interval is asymmetric because the observed data are asymmetric; a formula that forces a bell shape would hide that right tail.`,
        `This is the same resampling family as A/B Testing & p-values and Permutation Tests, but the question is different. Bootstrapping estimates spread; permutation shuffling tests whether labels matter. Cross-Validation & Honest Evaluation uses the same habit for model metrics: publish accuracy with an interval, not as a naked point estimate.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For B bootstrap rounds and n observations, drawing the samples costs O(Bn). Computing the statistic adds O(B f(n)), where f(n) is the statistic's cost on one resample; for a mean, the whole loop is linear in Bn, not quadratic. Memory is O(n) for the data plus O(B) if you store the resampled statistics for a histogram.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Bootstraps put honest error bars on latency, conversion lift, F1 score, revenue per user, and recommender metrics. Hot Rows & Append-and-Aggregate explains why latency has ugly tails like the 480ms point here. Reservoir Sampling can collect a representative stream sample before bootstrapping. Importance Sampling & Off-Policy Estimation and Doubly Robust Estimation often report uncertainty with bootstrap-style resampling when closed-form variance is fragile.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The bootstrap cannot invent data you never observed. With n = 5, or when estimating a maximum or p99.9, the sample is too thin to represent the tail. Dependent data also needs care: user sessions, time series, and grouped observations should be resampled as blocks or groups. Data Leakage & Contamination teaches the same boundary rule for ML splits: keep dependent units together or your interval will look tighter than reality.`,
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
