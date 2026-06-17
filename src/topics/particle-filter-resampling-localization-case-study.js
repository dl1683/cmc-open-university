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
      heading: 'Why particle filters exist',
      paragraphs: [
        `Localization is a state-estimation problem under uncertainty. A robot wants to know its pose, but it never receives the pose directly. It receives wheel ticks, inertial readings, camera features, lidar scans, map constraints, and sensor noise. Each observation is partial. Odometry drifts. Walls repeat. Doorways look alike. A single confident coordinate can be worse than ignorance if the evidence still supports several places at once.`,
        `A particle filter, also called sequential Monte Carlo, represents belief as a population of weighted hypotheses. Each particle is one possible state of the world: the robot might be here, facing this way, with this much accumulated uncertainty. The weight says how well that hypothesis explains the observations so far. Instead of forcing belief into one mean and covariance, the filter keeps a sampled approximation of the whole posterior distribution.`,
        `Particles are a practical data structure for beliefs with awkward shapes. A warehouse robot may be equally likely to be in two identical aisles. A target may have gone left or right around an obstacle. A bearing-only sensor may constrain the target to a curve rather than a point. A weighted sample cloud can represent those shapes directly, as long as enough particles cover the important regions.`,
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive approach is to keep one best state estimate. Move it with odometry, correct it with sensors, and report that coordinate. This is attractive because it is cheap and easy to reason about. The problem is that the best single estimate can be an average of incompatible possibilities. If the robot could be in aisle A or aisle B, the average might lie inside a shelf between them. The number is precise, but the belief is false.`,
        `A stronger classical approach is the Kalman filter family. A Kalman filter keeps a mean and covariance, propagates them through a motion model, and updates them with measurement information. That is excellent when the posterior is roughly Gaussian, dynamics are close to linear, and measurement noise is well behaved.`,
        `The wall appears when the posterior is not one blob. Repeated corridors create multiple peaks. Nonlinear dynamics bend probability mass. A kidnapped robot must recover from being moved to a completely different region. A range-bearing sensor can create curved likelihood bands. A Gaussian summary erases this structure. Keeping every possible state is impossible, but keeping only one smooth summary can erase the answer.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A particle filter uses samples as the representation of belief. At time t, the filter stores particles x_i and weights w_i. The particles say where probability mass currently lives. The weights say how much each sampled state should matter. This trades a closed-form distribution for a finite table that can be updated with ordinary simulation and likelihood scoring.`,
        `The loop has four steps. First, sample a new state for each particle from the motion model. If the robot moved forward one meter with noisy wheels, every particle is pushed forward with a plausible amount of noise. Second, compare each predicted particle with the new sensor observation. A particle whose simulated lidar scan matches the real scan gets a high likelihood. A particle in the wrong room gets a low likelihood. Third, normalize the weights so they sum to one. Fourth, decide whether to resample.`,
        `The important invariant is recursive Bayesian filtering: prediction uses the transition model, correction uses the observation likelihood, and the resulting weighted cloud approximates the posterior. The filter never needs to enumerate all states. It only needs enough particles in the regions that matter and a likelihood model that rewards the right hypotheses.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `The core data structure is an array of particle records. A minimal row stores state and weight. A production row often stores log weight, likelihood components, timestamp, map version, proposal id, random seed, and lineage information. That extra metadata is not decorative. Localization failures are hard to debug if you cannot replay which observation reweighted which hypotheses and which resampling step deleted an alternative.`,
        `Weights are usually handled in log space because likelihoods multiply across time and can underflow quickly. The implementation computes log likelihoods, subtracts the log-sum-exp normalization constant, and converts to normalized weights only when needed. The weighted mean can estimate a unimodal pose, but for a multimodal belief the better output may be the highest-weight particle, a cluster summary, or a set of candidate modes with probabilities.`,
        `Effective sample size is the main diversity diagnostic. For normalized weights, ESS = 1 / sum(w_i^2). If all N particles have equal weight, ESS is N. If one particle has almost all the weight, ESS approaches 1. That matters because a table with 10,000 particles can statistically behave like a handful of useful hypotheses after a sharp sensor update. ESS tells the filter whether the apparent population is still meaningful.`,
      ],
    },
    {
      heading: 'How resampling works',
      paragraphs: [
        `Resampling converts a weighted population into an equally weighted one by copying high-weight particles and deleting low-weight particles. Imagine laying every particle on a cumulative weight line from 0 to 1. A particle with weight 0.40 owns 40 percent of the line; a particle with weight 0.01 owns only 1 percent. Sampling N positions on that line produces the next population. High-weight particles receive multiple descendants. Low-weight particles may disappear.`,
        `Systematic resampling uses one random offset and then N evenly spaced pointers. Stratified resampling uses one random pointer inside each of N equal bins. Residual resampling deterministically keeps the integer part of each particle's expected copy count and samples the remainder. Multinomial resampling is simplest but has higher variance. These methods all approximate the same goal, but their variance differs, which affects how quickly minority hypotheses vanish.`,
        `Resampling is useful because it spends future computation where the posterior mass is. Without it, most particles may carry nearly zero weight and waste later updates. Resampling is dangerous because copying is not exploration. If the filter resamples after every observation, it can turn a rich posterior into many identical descendants of a few lucky samples. Serious implementations usually resample only when ESS falls below a threshold.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Particle filters work because importance sampling can approximate an expectation under a difficult distribution using weighted samples from a distribution we can generate. The transition model gives a proposal: where might each state move next? The observation likelihood reweights those proposals according to the evidence. The weighted particle cloud then approximates the posterior well enough to estimate state, uncertainty, or downstream decisions.`,
        `The approximation improves when particles cover the high-probability regions and the likelihood is calibrated. More particles reduce Monte Carlo error, but they cannot rescue a proposal that never samples the true state or a sensor model that assigns high likelihood to the wrong places. This is why particle filters are often paired with better proposals, map-aware sampling, or recovery particles that deliberately explore globally after the system appears lost.`,
        `The method also works because it keeps the computation bounded. Each time step is roughly proportional to particle count times motion and sensor cost. You can double the number of particles to improve coverage, or you can improve the proposal so the same number of particles lands in better places. The algorithm exposes that tradeoff directly.`,
      ],
    },
    {
      heading: 'Where it is used',
      paragraphs: [
        `Robot localization is the standard example. A mobile robot samples pose hypotheses, moves them with odometry, scores them against a map using lidar or vision, and resamples when evidence concentrates. The same structure appears in target tracking, where a radar or camera observes partial information about an object that moves under uncertain dynamics. It also appears in fault diagnosis, where particles represent possible hidden machine states, and in probabilistic simulation, where the system must maintain a belief over latent variables over time.`,
        `Particle filters are especially helpful in global localization and recovery. If a robot starts with no idea where it is, particles can be spread across the map. As observations arrive, inconsistent regions lose weight and plausible regions survive. If the robot is kidnapped and moved, some systems inject random particles or use adaptive resampling so the filter can recover instead of staying confidently wrong.`,
        `They are also valuable as an engineering diagnostic. A particle cloud is inspectable. You can see whether the filter is split between two corridors, whether all particles collapsed to one pose, whether the likelihood function prefers the wrong wall, or whether the proposal fails after fast turns. That visibility makes the algorithm easier to debug than a black-box state estimate.`,
      ],
    },
    {
      heading: 'Failure modes and tradeoffs',
      paragraphs: [
        `The biggest failure is sample impoverishment in a high-dimensional or poorly proposed state space. Particles are finite. If the true state lies in a region the proposal rarely visits, the filter may never recover. This is the curse of dimensionality in practical form: as state dimension grows, a fixed number of samples covers less of the relevant volume. Particle filters are natural for low-to-moderate dimensional states such as robot pose; they become harder for large latent states unless the model has strong structure.`,
        `The second failure is a bad likelihood model. If the map is stale, the sensor calibration is wrong, or the likelihood function is too sharp, the filter may delete correct hypotheses. If the likelihood is too flat, the filter may never concentrate. Sensor timing errors can produce the same symptoms. A lidar scan matched to the wrong pose timestamp punishes particles for the system's synchronization bug rather than for their state.`,
        `The main tradeoff is particle count versus latency. More particles improve coverage and reduce Monte Carlo variance, but every particle must be propagated and scored. A rich scan-matching likelihood can dominate CPU time. A cheap landmark model allows many particles but may not distinguish enough states. Production tuning measures localization error, ESS, distinct particle count, update latency, recovery time, and the rate of confident wrong estimates.`,
      ],
    },
    {
      heading: 'Case study: warehouse localization',
      paragraphs: [
        `Consider a warehouse robot starting after power loss. It knows the map, but not its aisle. The initialization spreads particles across navigable space. The robot drives forward; the motion model moves every particle forward with noise. A lidar scan arrives. For each particle, the system predicts what the scan should look like from that pose and compares it with the real scan. Particles in impossible places, such as inside racks, get near-zero likelihood. Particles in aisles with matching wall distances gain weight.`,
        `At first, several aisles may remain plausible because they have similar geometry. A good filter keeps those modes alive. After the robot turns past a distinctive intersection, one cluster starts matching better. The ESS falls as its weights dominate. Resampling duplicates that cluster, deletes weak alternatives, and resets weights so future computation focuses on the likely aisle. If evidence later contradicts the belief, recovery particles or a broader proposal help the robot avoid permanent overconfidence.`,
        `The correct behavior is not always to collapse quickly. When two places are genuinely ambiguous, the filter should preserve uncertainty until the sensors distinguish them. The output belief should tell the planner that localization is uncertain, not hide ambiguity behind one polished coordinate.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study importance sampling first, because particle weights are importance weights reused over time. Then study Kalman filtering to understand the Gaussian alternative and why it is so efficient when its assumptions fit. Markov chains and hidden Markov models provide the sequential-probability background. The bootstrap helps build intuition for finite sample approximations and resampling variance.`,
        `Primary sources worth reading are Gordon, Salmond, and Smith on nonlinear and non-Gaussian Bayesian state estimation; Doucet's sequential Monte Carlo resources; Doucet, de Freitas, and Gordon's particle filtering introduction; Arulampalam et al.'s tutorial on particle filters for online tracking; and the Stone Soup particle-filter tutorial. After that, compare practical robotics implementations: look for how they initialize global particles, compute scan likelihoods, gate resampling, inject recovery particles, and log replay data for failure analysis.`,
      ],
    },
  ],
};
