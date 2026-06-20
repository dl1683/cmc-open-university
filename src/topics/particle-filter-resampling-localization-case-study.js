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
        'The animation has two views. "Weighted particles" traces the full filtering loop: prior particles, motion prediction, sensor likelihood scoring, weight normalization, ESS check, and state estimation. "Resampling collapse" focuses on what happens when the filter decides to resample and what goes wrong when it resamples too aggressively.',
        {
          type: 'table',
          headers: ['Marker', 'Meaning in this animation'],
          rows: [
            ['Active (highlighted)', 'Current stage of the predict-update-resample cycle or the particle under inspection'],
            ['Found (green)', 'The estimated pose or a particle cluster confirmed by sensor evidence'],
            ['Compare (dimmed)', 'Low-weight particles about to be deleted, or resampling artifacts that reduce diversity'],
          ],
        },
        'In the weighted-particles view, watch the plot frame where sensor evidence splits particles into high-weight and low-weight groups. The separation is not arbitrary -- it reflects how well each hypothesis explains the lidar scan. In the resampling-collapse view, watch the ESS-gated curve stay higher than the always-resample curve. That gap is the diversity cost of unnecessary resampling.',
        {
          type: 'note',
          text: 'One safe inference rule: if ESS is above the threshold, the weighted cloud is still diverse enough to carry the posterior. Resampling at that point would delete minority hypotheses that might matter after the next observation.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A robot wants to know its pose -- position and heading -- but it never receives the pose directly. It receives wheel encoder ticks that drift, inertial readings that integrate noise, lidar scans that see walls but not labels, and camera frames that match features but not coordinates. Each observation is partial. Odometry accumulates error at roughly 2-5% of distance traveled. Walls repeat. Doorways look alike. Two identical aisles in a warehouse produce identical sensor returns.',
        {
          type: 'quote',
          text: 'The problem of determining the pose of a robot relative to a given map of the environment is called localization, and is often referred to as the most fundamental problem in mobile robotics.',
          attribution: 'Thrun, Burgard, and Fox, "Probabilistic Robotics" (2005), Chapter 7',
        },
        'A single confident coordinate can be worse than ignorance when the evidence still supports several places at once. The robot might be in aisle 3 or aisle 7 -- both have 4-meter walls spaced 2.5 meters apart. Reporting the average of those two locations places the robot inside a shelf rack between them. The number is precise but the belief is false.',
        'A particle filter represents belief as a population of weighted hypotheses. Each particle is one possible state: "the robot might be here, facing this way." The weight says how well that hypothesis explains the observations so far. Instead of forcing belief into one mean and one covariance, the filter keeps a sampled approximation of the whole posterior distribution -- lumpy, multimodal, and shaped by the actual evidence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a single state estimate. Keep one (x, y, theta) coordinate, move it forward with odometry, correct it when a sensor reading arrives, and report that coordinate to the path planner. This is cheap, easy to reason about, and correct when the robot always knows roughly where it is.',
        'The stronger classical approach is the Kalman filter family. A Kalman filter maintains a mean vector and covariance matrix, propagates them through a linear motion model, and updates them with a linear measurement model and Gaussian noise. The Extended Kalman Filter linearizes nonlinear models around the current estimate. The Unscented Kalman Filter uses sigma points to capture nonlinearity without explicit Jacobians.',
        {
          type: 'table',
          headers: ['Approach', 'What it stores', 'Assumption', 'Breaks when'],
          rows: [
            ['Single estimate', '(x, y, theta)', 'One best guess is enough', 'Two places are equally plausible'],
            ['Kalman filter', 'mean + covariance', 'Posterior is unimodal Gaussian', 'Corridors repeat; dynamics are nonlinear'],
            ['Extended Kalman', 'mean + linearized covariance', 'Linearization is close enough', 'Sensor model is sharply nonlinear or multimodal'],
            ['Grid filter', 'probability at every cell', 'State space is discretizable', 'Dimensions exceed 3; memory explodes'],
          ],
        },
        'Each approach works in its regime. The Kalman filter is optimal for linear-Gaussian problems and excellent when the posterior stays roughly bell-shaped. Grid-based filters can represent any shape but their memory grows exponentially with state dimension: a 3D grid at 5cm resolution over a 100m x 100m floor with 360 headings needs over 50 billion cells.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the posterior is not one blob. Four concrete situations break the unimodal assumption:',
        {
          type: 'bullets',
          items: [
            'Symmetric environments: a warehouse with 20 identical aisles produces 20 equally plausible location hypotheses. Averaging them produces a point inside a shelf.',
            'Kidnapped robot: someone picks the robot up and places it somewhere new. The old estimate is confident and wrong. A Kalman filter has no mechanism to teleport its mean to a distant region.',
            'Bearing-only tracking: a sensor that measures angle but not range constrains the target to a curve, not a point. The posterior is banana-shaped, not elliptical.',
            'Nonlinear dynamics with bifurcation: a mobile robot at a T-intersection may have turned left or right. The posterior splits into two separated clusters.',
          ],
        },
        'A Gaussian summary erases multimodal structure by construction. The mean and covariance matrix encode one ellipsoid. Two separated clusters, a curved band, or a ring of plausible poses cannot be represented faithfully. The Kalman filter does not fail loudly -- it reports a mean that happens to lie in impossible territory and a covariance that covers the wrong region.',
        {
          type: 'note',
          text: 'The failure is representational, not algorithmic. The Kalman update equations are correct for their model class. The problem is that real localization posteriors regularly leave that class.',
        },
        'Grid filters handle arbitrary shapes but pay exponential memory cost. A particle filter occupies the space between: it represents arbitrary posterior shapes using a finite, adaptive sample, and it concentrates computation where the posterior mass actually lives.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use samples as the representation of belief. At time t, the filter stores N particles {x_i, w_i} where x_i is a hypothesized state and w_i is its normalized importance weight. The particles say where probability mass currently lives. The weights say how much each hypothesis should matter. This trades a closed-form distribution for a finite weighted table that can be updated with ordinary simulation and likelihood scoring.',
        {
          type: 'diagram',
          label: 'The particle filter loop',
          text: 'For each time step:\n\n  1. PREDICT:  For each particle x_i, sample x_i\' ~ p(x_t | x_{t-1} = x_i, u_t)\n               (propagate through motion model with noise)\n\n  2. UPDATE:   For each particle x_i\', compute w_i = p(z_t | x_i\')\n               (score against sensor observation)\n\n  3. NORMALIZE: w_i = w_i / sum(w_j)\n               (weights sum to 1)\n\n  4. RESAMPLE?: If ESS = 1/sum(w_i^2) < threshold,\n               draw N new particles from the weighted set\n               and reset all weights to 1/N\n\n  5. ESTIMATE: Output weighted mean, MAP particle, or cluster summary',
        },
        'The important invariant is recursive Bayesian filtering: prediction uses the transition model, correction uses the observation likelihood, and the resulting weighted cloud approximates the posterior at every time step. The filter never enumerates all possible states. It only needs enough particles in the regions that matter and a likelihood model that rewards the right hypotheses.',
        {
          type: 'quote',
          text: 'A key advantage of particle filters over Kalman filters is their ability to represent arbitrary probability distributions, including multimodal and non-Gaussian posteriors.',
          attribution: 'Arulampalam, Maskell, Gordon, and Clapp, "A Tutorial on Particle Filters" (2002)',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The core data structure is an array of particle records. A minimal row stores state and weight. A production row adds log weight, likelihood components, timestamp, map version, proposal id, random seed, and lineage (which parent particle it was copied from during resampling). That metadata is not decorative -- localization failures are hard to debug without replay of which observation reweighted which hypotheses.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Minimal particle filter data structure\nconst particles = Array.from({ length: N }, () => ({\n  x: 0, y: 0, theta: 0,   // state: pose hypothesis\n  logWeight: -Math.log(N),  // log importance weight\n  likelihood: 0,            // latest sensor score\n  parentId: -1,             // lineage for debugging\n}));\n\n// Predict: propagate each particle through motion model\nfor (const p of particles) {\n  p.x += (v + noise()) * Math.cos(p.theta) * dt;\n  p.y += (v + noise()) * Math.sin(p.theta) * dt;\n  p.theta += (omega + noise()) * dt;\n}\n\n// Update: score each particle against sensor observation\nfor (const p of particles) {\n  const expected = simulateScan(map, p.x, p.y, p.theta);\n  p.likelihood = scanMatchScore(expected, actualScan);\n  p.logWeight += Math.log(p.likelihood + 1e-300);\n}\n\n// Normalize using log-sum-exp for numerical stability\nconst maxLogW = Math.max(...particles.map(p => p.logWeight));\nconst logSumExp = maxLogW + Math.log(\n  particles.reduce((s, p) => s + Math.exp(p.logWeight - maxLogW), 0)\n);\nfor (const p of particles) p.logWeight -= logSumExp;',
        },
        'Weights are handled in log space because likelihoods multiply across time and underflow quickly. A single observation might assign likelihood 0.001 to a particle. After 50 observations, that particle has accumulated likelihood 0.001^50, which is roughly 10^{-150} -- below the smallest representable double. Log-sum-exp normalization prevents this: subtract the maximum log weight before exponentiating, sum, take the log, and add the max back.',
        'Effective sample size (ESS) is the main diversity diagnostic. For normalized weights w_i, ESS = 1 / sum(w_i^2). If all N particles have equal weight 1/N, ESS equals N. If one particle carries weight 0.99 and the rest share 0.01, ESS is approximately 1.02. A cloud of 10,000 particles can statistically behave like two useful hypotheses after a sharp sensor update.',
        {
          type: 'table',
          headers: ['ESS value', 'Interpretation', 'Action'],
          rows: [
            ['ESS = N', 'All particles equally weighted; no evidence arrived or evidence is flat', 'No resampling needed'],
            ['ESS > N/2', 'Weights moderately spread; cloud is healthy', 'Continue without resampling'],
            ['ESS ~ N/3', 'Some particles dominate; threshold region', 'Resample if below configured gate'],
            ['ESS ~ 1', 'One particle carries nearly all weight; the rest are dead weight', 'Resample immediately; consider proposal improvement'],
          ],
        },
        'Resampling converts a weighted population into an equally weighted one. Systematic resampling lays one random offset plus N evenly spaced pointers across the cumulative weight line. A particle with weight 0.40 owns 40% of the line and receives roughly 0.40 * N copies. A particle with weight 0.001 almost certainly vanishes. After resampling, all weights reset to 1/N.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Systematic resampling\nfunction systematicResample(particles) {\n  const N = particles.length;\n  const weights = particles.map(p => Math.exp(p.logWeight));\n  const cumulative = [];\n  let sum = 0;\n  for (const w of weights) { sum += w; cumulative.push(sum); }\n\n  const u0 = Math.random() / N;  // one random offset\n  const newParticles = [];\n  let j = 0;\n  for (let i = 0; i < N; i++) {\n    const u = u0 + i / N;        // evenly spaced pointers\n    while (cumulative[j] < u) j++;\n    newParticles.push({\n      ...structuredClone(particles[j]),\n      logWeight: -Math.log(N),   // reset to uniform\n      parentId: j,               // track lineage\n    });\n  }\n  return newParticles;\n}',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Particle filters work because importance sampling can approximate an expectation under a difficult distribution using weighted samples from a distribution we can generate. The transition model serves as the proposal: it generates plausible next states. The observation likelihood serves as the importance weight correction: it reweights each proposed state according to how well it explains the actual sensor reading.',
        {
          type: 'diagram',
          label: 'Importance sampling identity',
          text: 'Goal: compute E_posterior[ f(x) ]\n\nDirect sampling from the posterior is intractable.\n\nInstead:\n  1. Sample x_i from a proposal q(x)       (here: the motion model)\n  2. Assign weight w_i = p(z|x_i) * p(x_i|x_{i-1}) / q(x_i)\n     When q = transition model, this simplifies to w_i = p(z|x_i)\n  3. Estimate = sum( w_i * f(x_i) ) / sum( w_j )\n\nThe weights correct for the mismatch between proposal and posterior.\nMore particles in high-posterior regions => lower variance.',
        },
        'The approximation improves when particles cover the high-probability regions and the likelihood model is calibrated. More particles reduce Monte Carlo error at rate 1/sqrt(N) -- doubling particles cuts the standard error by about 30%. But more particles cannot rescue a proposal that never samples the true state or a sensor model that assigns high likelihood to the wrong places.',
        'Resampling is justified by the same importance-sampling theory. When ESS collapses, most particles carry near-zero weight and contribute nothing to the estimate. Replacing them with copies of high-weight particles concentrates computation where the posterior mass is. The danger is that copying is not exploration: duplicating a particle does not create a new hypothesis, only a copy of an existing one. Without motion noise or roughening, repeated resampling reduces the particle set to clones of a few ancestors.',
        {
          type: 'note',
          text: 'The convergence guarantee is asymptotic: as N approaches infinity, the particle approximation converges to the true posterior. For finite N, the quality depends on proposal overlap with the posterior, likelihood model accuracy, and resampling frequency. Production systems validate with ground-truth comparisons, not with theory alone.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each time step costs O(N) for prediction and O(N * S) for sensor scoring, where N is the particle count and S is the cost of evaluating one particle against the sensor model. Resampling is O(N) with systematic or stratified methods. The total per-step cost is dominated by sensor scoring.',
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What doubles when N doubles', 'Practical bottleneck'],
          rows: [
            ['Motion prediction', 'O(N)', 'CPU time for noise sampling', 'Rarely the bottleneck'],
            ['Sensor scoring', 'O(N * S)', 'Number of scan-match evaluations', 'S can be 100-1000 ray casts per particle'],
            ['Normalization', 'O(N)', 'Sum and divide', 'Negligible'],
            ['ESS computation', 'O(N)', 'Sum of squared weights', 'Negligible'],
            ['Systematic resample', 'O(N)', 'Pointer walk + copy', 'Memory allocation for new set'],
            ['Estimate extraction', 'O(N) or O(N log N)', 'Weighted mean or clustering', 'Clustering for multimodal output'],
          ],
        },
        'For lidar-based localization, the scan-match cost S is the dominant term. Comparing a simulated 360-point lidar scan against the map for each of 5,000 particles means 1.8 million ray casts per update. At 10 Hz sensor rate, that is 18 million ray casts per second. Optimizations include KD-tree or grid-based ray casting, likelihood field models that precompute per-cell match scores, and GPU-parallel scan matching.',
        'Doubling the particle count halves the Monte Carlo standard error but doubles the compute budget. The alternative is a better proposal distribution -- one that samples where the sensor evidence is strong rather than blindly propagating from the motion model. The optimal proposal (using the current observation to guide sampling) can reduce variance enough that 500 well-placed particles outperform 10,000 blind ones.',
        {
          type: 'note',
          text: 'Memory is rarely the bottleneck. 10,000 particles at 64 bytes each (3 doubles for pose, 1 for weight, metadata) occupy about 640 KB. The cost is compute, not storage.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Robot localization (AMCL): the Adaptive Monte Carlo Localization algorithm in ROS spreads particles across the map at startup, scores them against a 2D lidar likelihood field, and adapts the particle count based on KLD-sampling to use more particles when uncertain and fewer when converged.',
            'Target tracking: radar or sonar observes bearing and range with noise. The target may maneuver unpredictably. Particles represent hypothesized target states and are reweighted by measurement likelihood. Multiple targets require multi-hypothesis extensions (particle-PHD filters).',
            'Simultaneous localization and mapping (FastSLAM): each particle carries its own map estimate. The particle represents the robot trajectory; conditioned on that trajectory, map features are updated with per-particle Kalman filters. This decomposes a joint high-dimensional problem into N low-dimensional ones.',
            'Financial volatility estimation: stochastic volatility models have nonlinear, non-Gaussian dynamics. Particle filters estimate the latent volatility path given observed returns. The state is low-dimensional (1-3 variables), making particles efficient.',
            'Fault diagnosis in industrial systems: particles represent possible fault modes and hidden degradation states. Sensor readings from vibration, temperature, or pressure score each hypothesis. The posterior over fault modes drives maintenance decisions.',
          ],
        },
        'Particle filters are especially powerful for global localization and recovery. If a robot starts with no prior knowledge, particles can be spread uniformly across the map. As observations arrive, inconsistent regions lose weight and plausible regions survive. If the robot is kidnapped, augmented MCL injects random particles proportional to the average sensor likelihood, letting the filter recover from confident-but-wrong states.',
        {
          type: 'quote',
          text: 'Monte Carlo localization can solve the global localization problem and can recover from robot kidnapping.',
          attribution: 'Thrun, Burgard, and Fox, "Probabilistic Robotics" (2005), Chapter 8',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The biggest failure is sample impoverishment in high-dimensional state spaces. Particles are finite. As state dimension grows, a fixed number of samples covers exponentially less of the relevant volume. A 3D robot pose (x, y, theta) needs perhaps 1,000-10,000 particles. A 6D pose (x, y, z, roll, pitch, yaw) might need 100,000. A 12D state (pose plus velocity plus accelerometer biases) starts requiring millions, which is impractical at real-time rates.',
        {
          type: 'table',
          headers: ['Failure mode', 'Cause', 'Symptom', 'Mitigation'],
          rows: [
            ['Sample impoverishment', 'Too few particles for state dimension', 'ESS stays near 1; filter locks onto wrong pose', 'Better proposal; Rao-Blackwellization; reduce effective dimension'],
            ['Bad likelihood model', 'Stale map, wrong calibration, timing error', 'Correct particles get low scores and die', 'Validate sensor model against ground truth; check time sync'],
            ['Overconfident collapse', 'Resample too often; no roughening or recovery', 'All particles are clones of one ancestor', 'ESS-gated resampling; inject random particles; add jitter'],
            ['Likelihood too flat', 'Sensor model does not discriminate poses', 'Weights stay near uniform; no convergence', 'Sharpen likelihood model; add more informative sensors'],
            ['Particle deprivation', 'True state was never sampled', 'Filter cannot recover even with good data', 'Global recovery injection; wider initial spread; mixture proposal'],
          ],
        },
        'The second common failure is a bad likelihood model. If the map is stale (a new wall was built, a door was opened), the sensor calibration is wrong (lidar range offset of 5cm), or the likelihood function is too sharp (Gaussian with sigma = 1cm when the true noise is 5cm), the filter deletes correct hypotheses. If the likelihood is too flat, the filter never concentrates. Sensor timing errors produce the same symptoms: a lidar scan matched to the wrong odometry timestamp punishes particles for a synchronization bug rather than for their state.',
        {
          type: 'note',
          text: 'The most dangerous failure is not divergence but false confidence. A collapsed particle cloud that reports low uncertainty at the wrong location will cause the planner to execute a trajectory that does not match reality. Monitoring distinct-particle count and ESS over time is essential.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A warehouse robot reboots after power loss. It has a map but does not know which aisle it occupies. The filter initializes with N = 5,000 particles spread uniformly across navigable space.',
        {
          type: 'table',
          headers: ['Step', 'Action', 'State after'],
          rows: [
            ['1. Initialize', 'Spread 5,000 particles uniformly on map; all weights = 1/5000', 'ESS = 5000. Particles cover all 20 aisles (~250 per aisle)'],
            ['2. Drive forward 1m', 'Motion model: each particle moves forward ~1m with Gaussian noise (sigma=0.05m, sigma_theta=0.02 rad)', 'Particles spread slightly within each aisle. ESS unchanged (no observation yet)'],
            ['3. Lidar scan arrives', 'For each particle, simulate expected scan from that pose; score against actual 360-point scan', 'Particles inside walls or in wrong-width aisles get likelihood ~0.001. Particles in matching aisles get likelihood ~0.8'],
            ['4. Normalize weights', 'Log-sum-exp normalization across all 5,000 particles', 'Weight concentrates on 4 aisles with matching geometry (~1,000 particles). ESS drops from 5,000 to ~900'],
            ['5. ESS check', 'ESS = 900 > threshold (2,500). Do not resample', 'Preserve all 4 plausible aisles. Minority hypotheses still alive'],
            ['6. Drive to intersection', 'Motion model propagates all particles forward another 3m', 'Particles approach a T-intersection visible in aisles 3, 7, 12, 18'],
            ['7. Second scan at intersection', 'Intersection geometry differs across the 4 remaining aisles. Aisle 7 has a unique column', 'Aisle 7 particles get likelihood ~0.9. Other aisles drop to ~0.1. ESS drops to ~380'],
            ['8. ESS check', 'ESS = 380 < threshold (2,500). Resample', 'Systematic resampling produces ~4,500 copies of aisle-7 particles, ~400 from aisle 3, ~100 others. Weights reset to 1/5000'],
            ['9. Continue', 'Subsequent scans confirm aisle 7. Cloud tightens around true pose', 'After 3 more updates, 95% of particles within 0.2m of true pose'],
          ],
        },
        'The critical moment is step 5: the filter correctly does not resample when four aisles are still plausible. Resampling at that point would have deleted aisles with 50-100 particles each, possibly including the true location. The filter waits until step 7, when distinctive geometry narrows the posterior to one dominant cluster.',
        {
          type: 'note',
          text: 'If the robot had been in aisle 3 instead, step 7 would have concentrated weight on aisle 3. The filter does not "choose" aisle 7 -- the sensor evidence does. The filter is a bookkeeping mechanism for tracking which hypotheses survive the evidence.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Gordon, Salmond, and Smith, "Novel approach to nonlinear/non-Gaussian Bayesian state estimation" (1993)', 'The bootstrap particle filter -- the foundational paper that introduced sampling-based recursive Bayesian estimation'],
            ['Arulampalam, Maskell, Gordon, and Clapp, "A Tutorial on Particle Filters" (2002), IEEE Trans. Signal Processing', 'Comprehensive tutorial covering SIS, SIR, regularized PF, auxiliary PF, and Rao-Blackwellized PF with convergence analysis'],
            ['Thrun, Burgard, and Fox, "Probabilistic Robotics" (2005), Chapters 4 and 8', 'Particle filter localization (MCL), augmented MCL for kidnap recovery, and KLD-sampling for adaptive particle counts'],
            ['Doucet, de Freitas, and Gordon (eds.), "Sequential Monte Carlo Methods in Practice" (2001)', 'The reference volume on SMC theory, convergence, resampling schemes, and applications across engineering domains'],
            ['ROS AMCL package documentation (wiki.ros.org/amcl)', 'Production implementation of adaptive Monte Carlo localization with likelihood field sensor model and KLD-sampling'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Importance Sampling and Off-Policy Estimation -- particle weights are importance weights reused recursively over time. Understand the weight correction before studying the sequential version.',
            'Prerequisite: Kalman Filter Sensor Fusion Case Study -- the Gaussian alternative. Understanding why Kalman is optimal for linear-Gaussian problems clarifies exactly what particle filters give up and what they gain.',
            'Extension: Rao-Blackwellized Particle Filters (FastSLAM) -- factor the state into a sampled part and an analytically tractable part. Particles carry the trajectory; conditioned on each trajectory, map features update with Kalman filters.',
            'Contrast: Hidden Markov Models -- discrete-state sequential Bayesian filtering with exact forward-backward inference. When the state space is small and discrete, HMMs are exact where particle filters are approximate.',
            'Production case: ROS Navigation Stack -- see how AMCL integrates with costmaps, path planning, and recovery behaviors in a real robot software stack.',
          ],
        },
      ],
    },
  ],
};
