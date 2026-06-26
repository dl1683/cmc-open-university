// Particle filter localization: represent uncertainty as weighted hypotheses,
// move them, reweight by sensor likelihood, and resample when ESS collapses.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'particle-filter-resampling-localization-case-study',
  title: 'Particle Filter Resampling Localization Case Study',
  category: 'AI & ML',
  summary: 'Sequential Monte Carlo for robot localization: weighted particles, sensor likelihoods, effective sample size, systematic resampling, and particle impoverishment.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['weighted particles', 'resampling collapse'], defaultValue: 'weighted particles' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function pfGraph(title) {
  return graphState({
    nodes: [
      { id: 'prior', label: 'prior', x: 0.7, y: 3.4, note: 'particles' },
      { id: 'motion', label: 'motion', x: 2.2, y: 2.0, note: 'sample' },
      { id: 'predict', label: 'predict', x: 3.8, y: 3.4, note: 'spread' },
      { id: 'sensor', label: 'sensor', x: 3.8, y: 5.2, note: 'likelihood' },
      { id: 'weight', label: 'weight', x: 5.4, y: 3.4, note: 'Bayes' },
      { id: 'ess', label: 'ESS', x: 6.9, y: 3.4, note: 'diversity' },
      { id: 'resamp', label: 'resample', x: 8.4, y: 2.0, note: 'copies' },
      { id: 'estimate', label: 'estimate', x: 8.4, y: 4.8, note: 'mean/map' },
    ],
    edges: [
      { id: 'e-prior-motion', from: 'prior', to: 'motion' },
      { id: 'e-motion-predict', from: 'motion', to: 'predict' },
      { id: 'e-predict-weight', from: 'predict', to: 'weight' },
      { id: 'e-sensor-weight', from: 'sensor', to: 'weight' },
      { id: 'e-weight-ess', from: 'weight', to: 'ess' },
      { id: 'e-ess-resamp', from: 'ess', to: 'resamp' },
      { id: 'e-weight-estimate', from: 'weight', to: 'estimate' },
      { id: 'e-resamp-prior', from: 'resamp', to: 'prior' },
    ],
  }, { title });
}

const PARTICLES = [
  { id: 'p1', label: 'p1', x: 1.0, y: 1.2, w: 0.05, like: 0.10 },
  { id: 'p2', label: 'p2', x: 2.0, y: 1.6, w: 0.08, like: 0.18 },
  { id: 'p3', label: 'p3', x: 4.6, y: 3.2, w: 0.46, like: 0.92 },
  { id: 'p4', label: 'p4', x: 5.1, y: 3.6, w: 0.33, like: 0.70 },
  { id: 'p5', label: 'p5', x: 8.2, y: 1.0, w: 0.08, like: 0.16 },
];

const ess = 1 / PARTICLES.reduce((sum, p) => sum + p.w * p.w, 0);
const fmt = (v, d = 2) => v.toFixed(d);

function* weightedParticles() {
  yield {
    state: pfGraph('A belief distribution as samples'),
    highlight: { active: ['prior', 'motion', 'predict', 'sensor', 'weight', 'estimate'], compare: ['ess', 'resamp'] },
    explanation: 'A particle filter represents uncertainty with many weighted hypotheses instead of one Gaussian blob. Each particle is a possible state. Motion propagates every particle. The sensor likelihood reweights them. The weighted cloud is the posterior belief.',
    invariant: 'Belief = particles plus weights: {x_i, w_i}, normalized after every measurement.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'map x', min: 0, max: 10 }, y: { label: 'map y', min: 0, max: 6 } },
      series: [
        { id: 'low', label: 'low w', points: PARTICLES.filter((p) => p.w < 0.1).map((p) => ({ x: p.x, y: p.y })) },
        { id: 'mid', label: 'mid w', points: PARTICLES.filter((p) => p.w >= 0.1 && p.w < 0.4).map((p) => ({ x: p.x, y: p.y })) },
        { id: 'high', label: 'high w', points: PARTICLES.filter((p) => p.w >= 0.4).map((p) => ({ x: p.x, y: p.y })) },
      ],
      markers: [
        { id: 'sensor', x: 4.8, y: 3.4, label: 'sensor fit' },
      ],
    }),
    highlight: { active: ['high', 'mid', 'sensor'], removed: ['low'] },
    explanation: 'The sensor reading fits particles near the true corridor and downweights particles in the wrong rooms. Unlike a Kalman filter, the belief can be lumpy or multimodal: several separated clusters can survive until evidence rules them out.',
  };

  yield {
    state: labelMatrix(
      'Particle table after sensor weighting',
      PARTICLES.map(({ id, label }) => ({ id, label })),
      [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'like', label: 'like' },
        { id: 'w', label: 'w' },
      ],
      PARTICLES.map((p) => [fmt(p.x, 1), fmt(p.y, 1), fmt(p.like), fmt(p.w)]),
    ),
    highlight: { active: ['p3:like', 'p3:w', 'p4:like', 'p4:w'], compare: ['p1:w', 'p5:w'] },
    explanation: 'The particle array is the data structure. Each row stores state, likelihood, and normalized weight. The estimate can be a weighted mean, a highest-weight particle, or a cluster summary when the posterior has multiple modes.',
  };

  yield {
    state: labelMatrix(
      'Effective sample size',
      [
        { id: 'formula', label: 'formula' },
        { id: 'now', label: 'this cloud' },
        { id: 'threshold', label: 'threshold' },
        { id: 'decision', label: 'decision' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['1/sum w^2', 'diversity'],
        [fmt(ess, 1), 'of 5'],
        ['< 2.5', 'resample'],
        ['wait', 'keep cloud'],
      ],
    ),
    highlight: { active: ['formula:value', 'now:value'], compare: ['threshold:value', 'decision:value'] },
    explanation: 'ESS is the same diagnostic you saw in Importance Sampling & Off-Policy Estimation. If one particle has almost all the weight, the cloud is pretending to have many hypotheses while statistically acting like one or two. Resampling is triggered when ESS falls too low.',
  };

  yield {
    state: labelMatrix(
      'When particles beat one Gaussian',
      [
        { id: 'door', label: 'two doors' },
        { id: 'bearing', label: 'bearing' },
        { id: 'kidnap', label: 'kidnap' },
        { id: 'nonlin', label: 'nonlinear' },
      ],
      [
        { id: 'kalman', label: 'Kalman' },
        { id: 'pf', label: 'PF' },
      ],
      [
        ['averages', 'two peaks'],
        ['curves', 'samples'],
        ['lost', 'global'],
        ['linearize', 'simulate'],
      ],
    ),
    highlight: { active: ['door:pf', 'kidnap:pf', 'nonlin:pf'], compare: ['door:kalman'] },
    explanation: 'A Kalman filter is excellent when the posterior is roughly Gaussian. Particle filters are built for cases where that shape is wrong: ambiguous hallways, bearing-only tracking, kidnapped robots, nonlinear dynamics, and non-Gaussian sensor noise.',
  };

  yield {
    state: pfGraph('Complete case: robot localization'),
    highlight: { active: ['prior', 'predict', 'sensor', 'weight', 'ess', 'estimate'], found: ['estimate'] },
    explanation: 'A warehouse robot starts unsure which aisle it is in. Odometry moves particles forward with noise. A lidar scan scores each particle against the map. Wrong aisles lose weight. Once ESS collapses, resampling duplicates plausible poses and deletes bad ones, keeping compute focused where the robot probably is.',
  };
}

function* resamplingCollapse() {
  yield {
    state: labelMatrix(
      'Systematic resampling wheel',
      [
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
        { id: 'p4', label: 'p4' },
        { id: 'p5', label: 'p5' },
      ],
      [
        { id: 'weight', label: 'weight' },
        { id: 'range', label: 'cum range' },
        { id: 'copies', label: 'copies' },
      ],
      [
        ['0.05', '0-.05', '0'],
        ['0.08', '.05-.13', '1'],
        ['0.46', '.13-.59', '2'],
        ['0.33', '.59-.92', '2'],
        ['0.08', '.92-1', '0'],
      ],
    ),
    highlight: { active: ['p3:copies', 'p4:copies'], compare: ['p1:copies', 'p5:copies'] },
    explanation: 'Systematic resampling lays evenly spaced pointers across the cumulative weight line. High-weight particles are copied multiple times; low-weight particles vanish. The output has equal weights again, which improves diversity accounting but can reduce actual state diversity.',
    invariant: 'After resampling, weights reset to 1/N and particle identity carries the posterior mass.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'resampling cycles', min: 0, max: 8 }, y: { label: 'distinct particles', min: 0, max: 5 } },
      series: [
        { id: 'always', label: 'always', points: [{ x: 0, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2.4 }, { x: 5, y: 1.8 }, { x: 8, y: 1.2 }] },
        { id: 'ess', label: 'ESS gate', points: [{ x: 0, y: 5 }, { x: 1, y: 4.8 }, { x: 2, y: 4.2 }, { x: 3, y: 3.9 }, { x: 5, y: 3.5 }, { x: 8, y: 3.0 }] },
      ],
      markers: [
        { id: 'collapse', x: 5, y: 1.8, label: 'collapse' },
      ],
    }),
    highlight: { active: ['ess'], removed: ['always', 'collapse'] },
    explanation: 'Resampling every step can impoverish the particle set: repeated copying deletes minority hypotheses before evidence has had time to decide. ESS-gated resampling waits until weights are genuinely concentrated, preserving more diversity.',
  };

  yield {
    state: labelMatrix(
      'Resampling methods',
      [
        { id: 'multi', label: 'multinomial' },
        { id: 'system', label: 'systematic' },
        { id: 'strat', label: 'stratified' },
        { id: 'resid', label: 'residual' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['draw N times', 'noisy'],
        ['one offset', 'low var'],
        ['N bins', 'balanced'],
        ['floor+draw', 'hybrid'],
      ],
    ),
    highlight: { active: ['system:idea', 'strat:idea'], compare: ['multi:risk'] },
    explanation: 'The resampler is a data-structure choice. Multinomial resampling is simple but noisy. Systematic and stratified resampling spread samples more evenly across the weight line. Residual resampling deterministically keeps the integer part of each expected copy count.',
  };

  yield {
    state: labelMatrix(
      'Numerical safeguards',
      [
        { id: 'logw', label: 'log w' },
        { id: 'norm', label: 'normalize' },
        { id: 'jitter', label: 'jitter' },
        { id: 'rough', label: 'roughen' },
        { id: 'replay', label: 'replay' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['underflow', 'log-sum-exp'],
        ['sum drift', 'renorm'],
        ['copies', 'noise'],
        ['collapse', 'spread'],
        ['bugs', 'seeded log'],
      ],
    ),
    highlight: { active: ['logw:guard', 'norm:guard', 'replay:guard'], compare: ['jitter:guard', 'rough:guard'] },
    explanation: 'Particle filters are easy to write and easy to make subtly wrong. Use log weights, normalize carefully, preserve random seeds for replay, and add controlled jitter or roughening only when the model justifies it.',
  };

  yield {
    state: labelMatrix(
      'Production decisions',
      [
        { id: 'N', label: 'N particles' },
        { id: 'model', label: 'proposal' },
        { id: 'rate', label: 'rate' },
        { id: 'map', label: 'map' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'sets', label: 'sets' },
        { id: 'trade', label: 'trade' },
      ],
      [
        ['accuracy', 'CPU'],
        ['where sample', 'variance'],
        ['sensor sync', 'latency'],
        ['likelihood', 'bias'],
        ['ESS/RMSE', 'alerts'],
      ],
    ),
    highlight: { active: ['N:trade', 'model:trade', 'metric:sets'], compare: ['map:trade'] },
    explanation: 'A real localization stack tunes particle count, proposal distribution, sensor timing, map likelihood model, and alert metrics. More particles reduce Monte Carlo error but cost CPU. Better proposals reduce variance by sampling where the sensor is likely to believe.',
  };

  yield {
    state: pfGraph('From Kalman to particles'),
    highlight: { active: ['prior', 'motion', 'sensor', 'weight', 'ess', 'resamp'], compare: ['estimate'] },
    explanation: 'Kalman Filter Sensor Fusion Case Study keeps one Gaussian state. Particle filters keep a sampled approximation to the whole posterior. Both are recursive Bayesian filters; they differ in the shape of belief they are willing to represent.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'weighted particles') yield* weightedParticles();
  else if (view === 'resampling collapse') yield* resamplingCollapse();
  else throw new InputError('Pick a particle-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each particle as one possible robot pose. Active particles are being predicted, weighted, or copied; found particles are the high-likelihood region; compare or removed particles are hypotheses that current evidence makes less useful.',
        'ESS means effective sample size, a number that estimates how many useful weighted particles remain. The safe inference rule is that resampling should wait until weights collapse enough that many particles are statistically dead.',
        {type:'callout', text:'A particle filter represents belief as weighted hypotheses, then resamples only when weight collapse threatens the diversity needed for future evidence.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/bb/Particle2dmotion.svg', alt:'Particle cloud spreading around a robot motion path.', caption:'Particle motion belief distribution, by Daniel Lu, CC BY-SA 3.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A robot does not observe its pose directly. Wheel motion drifts, lidar sees walls without labels, and two warehouse aisles can produce nearly identical sensor readings.',
        'A single coordinate is dangerous when two places are plausible. A particle filter represents uncertainty as many weighted hypotheses, so the belief can have several separated clusters until evidence rules them out.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one best estimate: keep x, y, and heading, move it with odometry, and correct it with sensors. That is cheap and works when the robot is already near the truth.',
        'A stronger approach is a Kalman filter, which stores a mean and covariance. It is excellent for linear systems with Gaussian noise and for beliefs shaped like one blob.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multimodal belief. If a robot might be in aisle 3 or aisle 7, the average position can land inside a shelf, which is precise but false.',
        'The second wall is nonlinear evidence. Bearing-only sensors, repeated corridors, and map ambiguities can create curved or separated posterior shapes that one Gaussian cannot represent.',
      ],
    },    {
      heading: 'The core insight',
      paragraphs: [
        'Approximate the posterior distribution with samples. Each particle stores a state and a weight; the state says where the robot might be, and the weight says how well that state explains the latest observations.',
        'Prediction moves every particle through the motion model. Correction multiplies weights by sensor likelihood, normalization makes weights sum to 1, and resampling copies high-weight particles when the cloud becomes statistically concentrated.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At time t, the filter samples a new state for each particle from the motion model. A lidar or camera likelihood then scores how well that state predicts the actual sensor reading.',
        'The filter normalizes weights and computes ESS = 1 / sum(w_i squared). If ESS falls below a threshold such as N / 2, systematic resampling lays evenly spaced pointers across the cumulative weight line and copies particles in proportion to weight.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument comes from importance sampling. The motion model proposes possible next states, and the observation likelihood corrects their weights so weighted averages approximate expectations under the posterior.',
        'Resampling is safe as a variance-control step when weights collapse. It does not create new information; it reallocates future computation toward hypotheses that current evidence supports, while motion noise or recovery injection restores exploration.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per time step, prediction is O(N), normalization and ESS are O(N), and systematic resampling is O(N), where N is particle count. Sensor scoring usually dominates because each particle may need ray casts, map lookups, or feature matching.',
        'If 5,000 particles each compare a 360-beam lidar scan, one update evaluates 1,800,000 beam scores. At 10 Hz, that is 18,000,000 beam scores per second, so better likelihood fields or GPU work often matter more than saving a few bytes per particle.',
      ],
    },    {
      heading: 'Real-world uses',
      paragraphs: [
        'Particle filters fit mobile-robot localization, target tracking, fault diagnosis, stochastic volatility models, and nonlinear sensor fusion. The access pattern is recursive Bayesian filtering where the state distribution cannot be trusted to stay Gaussian.',
        'They are especially useful for global localization. A robot can start with particles spread across the map, then let sensor evidence delete impossible regions while preserving several plausible clusters.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails in high-dimensional spaces because finite samples cover less of the relevant volume as dimensions grow. A 3D pose may work with 5,000 particles, while a 12D state can need so many particles that real-time scoring becomes impossible.',
        'It also fails with a bad likelihood model. A stale map, wrong lidar calibration, timing error, or overconfident noise setting can kill the true particles and leave the filter confidently wrong.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A warehouse robot initializes 5,000 particles over 20 aisles, so each aisle starts with about 250 particles and weight 1/5000. After moving 1 meter, no sensor has arrived, so ESS remains 5,000.',
        'A lidar scan matches 4 aisles and rejects 16. After normalization, the surviving 4 aisles hold most of the weight and ESS drops to about 900. Because the global-localization gate is set to 500, the filter does not resample yet and keeps all 4 plausible aisles alive.',
        'At a distinctive intersection, the second scan drives ESS to 380. The filter now resamples, copies the particles in the best aisle many times, keeps a small number from weaker aisles, and resets all weights to 1/5000 for the next motion step.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Gordon, Salmond, and Smith on the bootstrap particle filter, Arulampalam et al. on particle-filter tutorials, and Thrun, Burgard, and Fox in Probabilistic Robotics. Read them for sequential importance sampling, resampling, Monte Carlo localization, and recovery from a wrong pose estimate.',
        'Next, study Importance Sampling and Off-Policy Estimation, Kalman Filter Sensor Fusion Case Study, Hidden Markov Models, Rao-Blackwellized Particle Filters, FastSLAM, and Robot Navigation Stack. These topics show the exact, Gaussian, and sampled versions of recursive belief tracking.',
      ],
    },
  ],
};