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
      heading: 'What it is',
      paragraphs: [
        'A particle filter, also called sequential Monte Carlo, tracks a hidden state with a cloud of weighted samples. Each particle is one possible world. The motion model propagates particles forward. The sensor model scores how well each particle explains the observation. The weights are normalized into an approximate posterior.',
        'This is the non-Gaussian companion to Kalman filtering. A Kalman filter keeps one mean and covariance. A particle filter can represent multiple separated hypotheses, sharp edges, nonlinear dynamics, and sensor likelihoods that are not bell curves.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core data structure is an array of particles. Each row stores state, log weight or normalized weight, sensor likelihood, and sometimes lineage or random seed for debugging. The algorithm repeatedly runs propagate, weight, normalize, estimate, and resample-if-needed.',
        'Effective sample size is the diversity receipt: ESS = 1 / sum(w_i^2) for normalized weights. If ESS is low, the cloud has many rows but only a few statistically meaningful hypotheses. Resampling copies high-weight particles and deletes low-weight particles, then resets weights to 1/N.',
      ],
    },
    {
      heading: 'Complete case study: robot localization',
      paragraphs: [
        'A warehouse robot starts uncertain about which aisle it occupies. Odometry moves each pose particle with noise. A lidar or camera observation scores each pose against the map. Particles in the wrong aisle receive tiny weights; particles near a plausible scan match keep weight. When ESS collapses, systematic resampling focuses compute on plausible poses while preserving enough diversity for future ambiguity.',
        'The method handles cases that break a single Gaussian: two identical-looking corridors, a kidnapped robot, nonlinear bearing-only measurements, and non-Gaussian sensor glitches. The price is Monte Carlo cost: more particles give better approximation but spend more CPU and memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Resampling is not free. It reduces weight degeneracy but can cause particle impoverishment by copying the same few states repeatedly. Resampling every frame may delete minority hypotheses too early. Most systems resample only when ESS falls below a threshold, then add motion noise or roughening if the model justifies it.',
        'Another trap is underflow. Multiplying many small likelihoods can turn most weights into zero. Use log weights and log-sum-exp normalization. Also make the random stream replayable; otherwise a localization bug can disappear when you rerun the same scenario.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Gordon, Salmond, and Smith, Novel approach to nonlinear/non-Gaussian Bayesian state estimation at https://digital-library.theiet.org/doi/10.1049/ip-f-2.1993.0015; Doucet sequential Monte Carlo resources at https://www.stats.ox.ac.uk/~doucet/smc_resources.html; Doucet, de Freitas, and Gordon book introduction at https://www.stats.ox.ac.uk/~doucet/doucet_defreitas_gordon_smcbookintro.pdf; Arulampalam et al., A tutorial on particle filters for online nonlinear/non-Gaussian Bayesian tracking at https://www.semanticscholar.org/paper/A-tutorial-on-particle-filters-for-online-nonlinear-Arulampalam-Maskell/7f0bbe9dd4aa3bfb8a355a2444f81848b020b7a4; and Stone Soup particle-filter tutorial at https://stonesoup.readthedocs.io/en/latest/auto_tutorials/04_ParticleFilter.html.',
        'Study next: Importance Sampling & Off-Policy Estimation, Kalman Filter Sensor Fusion Case Study, Markov Chains & Steady States, Confidence Intervals & the Bootstrap, Reservoir Sampling, and Contextual Bandit Logged Policy Evaluation Case Study.',
      ],
    },
  ],
};
