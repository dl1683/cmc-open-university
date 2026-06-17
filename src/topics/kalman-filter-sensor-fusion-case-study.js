// Kalman filter sensor fusion: recursive state estimation with a mean vector,
// covariance matrix, prediction model, measurement residual, and gain.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kalman-filter-sensor-fusion-case-study',
  title: 'Kalman Filter Sensor Fusion Case Study',
  category: 'Concepts',
  summary: 'Track a moving object from noisy sensors: state vectors, covariance, prediction, residuals, Kalman gain, outlier gates, and fusion-system safeguards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['predict update', 'sensor fusion'], defaultValue: 'predict update' },
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

function filterGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'state', x: 0.7, y: 3.4, note: 'x,P' },
      { id: 'motion', label: 'motion', x: 2.2, y: 2.0, note: 'F,Q' },
      { id: 'pred', label: 'predict', x: 3.8, y: 3.4, note: 'prior' },
      { id: 'sensor', label: 'sensor', x: 3.8, y: 5.2, note: 'z,R' },
      { id: 'resid', label: 'resid', x: 5.4, y: 5.2, note: 'z-Hx' },
      { id: 'gain', label: 'gain', x: 6.9, y: 3.4, note: 'K' },
      { id: 'update', label: 'update', x: 8.3, y: 3.4, note: 'posterior' },
      { id: 'gate', label: 'gate', x: 6.9, y: 5.2, note: 'outlier' },
    ],
    edges: [
      { id: 'e-state-motion', from: 'state', to: 'motion' },
      { id: 'e-motion-pred', from: 'motion', to: 'pred' },
      { id: 'e-pred-resid', from: 'pred', to: 'resid' },
      { id: 'e-sensor-resid', from: 'sensor', to: 'resid' },
      { id: 'e-resid-gain', from: 'resid', to: 'gain' },
      { id: 'e-gain-update', from: 'gain', to: 'update' },
      { id: 'e-gate-update', from: 'gate', to: 'update' },
      { id: 'e-update-state', from: 'update', to: 'state' },
    ],
  }, { title });
}

function fusionGraph(title) {
  return graphState({
    nodes: [
      { id: 'imu', label: 'IMU', x: 0.7, y: 1.7, note: 'fast' },
      { id: 'gps', label: 'GPS', x: 0.7, y: 3.4, note: 'global' },
      { id: 'vision', label: 'vision', x: 0.7, y: 5.1, note: 'objects' },
      { id: 'sync', label: 'sync', x: 2.5, y: 3.4, note: 'time' },
      { id: 'filter', label: 'filter', x: 4.3, y: 3.4, note: 'x,P' },
      { id: 'gate', label: 'gate', x: 6.1, y: 2.0, note: 'reject' },
      { id: 'track', label: 'track', x: 7.8, y: 3.4, note: 'pose' },
      { id: 'log', label: 'log', x: 6.1, y: 5.0, note: 'replay' },
    ],
    edges: [
      { id: 'e-imu-sync', from: 'imu', to: 'sync' },
      { id: 'e-gps-sync', from: 'gps', to: 'sync' },
      { id: 'e-vision-sync', from: 'vision', to: 'sync' },
      { id: 'e-sync-filter', from: 'sync', to: 'filter' },
      { id: 'e-filter-gate', from: 'filter', to: 'gate' },
      { id: 'e-filter-track', from: 'filter', to: 'track' },
      { id: 'e-filter-log', from: 'filter', to: 'log' },
    ],
  }, { title });
}

function* predictUpdate() {
  yield {
    state: filterGraph('Predict, measure, update, repeat'),
    highlight: { active: ['state', 'motion', 'pred', 'sensor', 'resid', 'gain', 'update'], compare: ['gate'] },
    explanation: 'A Kalman filter carries two objects: the best state estimate x and its uncertainty covariance P. The motion model predicts where the system should go. A sensor measurement arrives. The residual says how surprising it is. The Kalman gain decides how much to trust the sensor versus the prediction.',
    invariant: 'The filter is recursive: the posterior from this step becomes the prior for the next step.',
  };

  yield {
    state: labelMatrix(
      'State and covariance before GPS arrives',
      [
        { id: 'pos', label: 'pos' },
        { id: 'vel', label: 'vel' },
        { id: 'p11', label: 'P pos' },
        { id: 'p22', label: 'P vel' },
        { id: 'p12', label: 'P cross' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['12.0 m', 'where'],
        ['2.0 m/s', 'speed'],
        ['4.0', 'pos var'],
        ['1.0', 'vel var'],
        ['0.5', 'coupling'],
      ],
    ),
    highlight: { active: ['pos:value', 'vel:value'], compare: ['p11:value', 'p22:value', 'p12:value'] },
    explanation: 'The state vector stores position and velocity. The covariance matrix stores uncertainty and coupling: position uncertainty, velocity uncertainty, and how errors in the two move together. A Kalman filter is not just a point estimate; it is an estimate with a shape around it.',
  };

  yield {
    state: labelMatrix(
      'Prediction step',
      [
        { id: 'motion', label: 'motion' },
        { id: 'mean', label: 'mean' },
        { id: 'cov', label: 'cov' },
        { id: 'noise', label: 'process' },
      ],
      [
        { id: 'formula', label: 'formula' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['F x', 'move ahead'],
        ['12 -> 14', 'drift'],
        ['F P FT', 'stretch'],
        ['+ Q', 'unc grows'],
      ],
    ),
    highlight: { active: ['mean:formula', 'cov:formula', 'noise:formula'] },
    explanation: 'Prediction moves the state forward through the motion model. Uncertainty usually grows because time passes and the world can surprise you. Process noise Q is the honest admission that the motion model is not perfect.',
  };

  yield {
    state: labelMatrix(
      'Measurement update',
      [
        { id: 'z', label: 'GPS z' },
        { id: 'resid', label: 'resid' },
        { id: 'S', label: 'S' },
        { id: 'K', label: 'gain K' },
        { id: 'post', label: 'posterior' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'role', label: 'role' },
      ],
      [
        ['13.0 m', 'sensor'],
        ['-1.0 m', 'surprise'],
        ['Pz + R', 'scale'],
        ['0.82,0.18', 'trust'],
        ['13.18,1.82', 'new x'],
      ],
    ),
    highlight: { active: ['resid:value', 'K:value', 'post:value'], compare: ['S:role'] },
    explanation: 'The measurement is one meter behind the prediction. The gain is high for position because GPS directly observes position and the predicted position was uncertain. Velocity shifts a little too because covariance says position and velocity errors are coupled.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'filter step', min: 0, max: 8 }, y: { label: 'position uncertainty', min: 0, max: 5 } },
      series: [
        { id: 'predict', label: 'after pred', points: [{ x: 0, y: 4.0 }, { x: 1, y: 4.8 }, { x: 2, y: 3.6 }, { x: 3, y: 4.2 }, { x: 4, y: 3.2 }, { x: 5, y: 3.8 }, { x: 6, y: 3.0 }, { x: 7, y: 3.5 }, { x: 8, y: 2.8 }] },
        { id: 'update', label: 'after meas', points: [{ x: 0, y: 2.0 }, { x: 1, y: 1.8 }, { x: 2, y: 1.5 }, { x: 3, y: 1.3 }, { x: 4, y: 1.15 }, { x: 5, y: 1.05 }, { x: 6, y: 0.98 }, { x: 7, y: 0.92 }, { x: 8, y: 0.88 }] },
      ],
      markers: [
        { id: 'saw', x: 4, y: 3.2, label: 'sawtooth' },
      ],
    }),
    highlight: { active: ['predict', 'update', 'saw'] },
    explanation: 'Uncertainty often has a sawtooth shape. Prediction grows it; measurement shrinks it. If sensors go missing, the prediction line keeps growing. If sensors are frequent and reliable, the update line stays tight.',
  };

  yield {
    state: labelMatrix(
      'What can go wrong',
      [
        { id: 'badQ', label: 'bad Q' },
        { id: 'badR', label: 'bad R' },
        { id: 'nonlin', label: 'nonlinear' },
        { id: 'outlier', label: 'outlier' },
        { id: 'time', label: 'time skew' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['overtrust', 'tune Q'],
        ['chase noise', 'tune R'],
        ['linear lie', 'EKF/UKF'],
        ['jump', 'gate'],
        ['lag', 'sync'],
      ],
    ),
    highlight: { active: ['badQ:guard', 'badR:guard', 'outlier:guard', 'time:guard'], compare: ['nonlin:guard'] },
    explanation: 'Most Kalman bugs are modeling bugs. Understate process noise and the filter refuses to move. Understate sensor noise and it chases every glitch. Use a linear model for nonlinear dynamics and the covariance becomes a polite fiction. Misalign timestamps and even perfect equations fuse the wrong facts.',
  };
}

function* sensorFusion() {
  yield {
    state: fusionGraph('Sensor fusion as a streaming data structure'),
    highlight: { active: ['imu', 'gps', 'vision', 'sync', 'filter', 'track'], compare: ['gate', 'log'] },
    explanation: 'A robot or vehicle sees the world through several partial sensors. IMU is fast but drifts. GPS is global but noisy and slow. Vision detects landmarks but can fail. The filter stores one coherent state with uncertainty and ingests each sensor at its own rate.',
    invariant: 'Fusion is not averaging sensors; it is weighting residuals by uncertainty.',
  };

  yield {
    state: labelMatrix(
      'Asynchronous sensor rows',
      [
        { id: 'imu', label: 'IMU' },
        { id: 'gps', label: 'GPS' },
        { id: 'wheel', label: 'wheel' },
        { id: 'vision', label: 'vision' },
      ],
      [
        { id: 'rate', label: 'rate' },
        { id: 'trust', label: 'trust' },
        { id: 'job', label: 'job' },
      ],
      [
        ['200 Hz', 'drifty', 'predict'],
        ['1 Hz', 'noisy', 'anchor'],
        ['50 Hz', 'slips', 'speed'],
        ['30 Hz', 'fragile', 'landmark'],
      ],
    ),
    highlight: { active: ['imu:job', 'gps:job', 'vision:job'], compare: ['wheel:trust'] },
    explanation: 'Each sensor contributes a different measurement model H and noise covariance R. High-rate IMU mostly drives prediction. GPS anchors global position. Wheel speed constrains velocity. Vision landmarks correct drift when visible.',
  };

  yield {
    state: labelMatrix(
      'Outlier gate',
      [
        { id: 'resid', label: 'resid' },
        { id: 'S', label: 'S' },
        { id: 'score', label: 'score' },
        { id: 'accept', label: 'accept' },
        { id: 'reject', label: 'reject' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['z-Hx', 'surprise'],
        ['H P HT + R', 'expected'],
        ['rT S^-1 r', 'distance'],
        ['small', 'update'],
        ['huge', 'ignore/log'],
      ],
    ),
    highlight: { active: ['score:value', 'accept:meaning'], removed: ['reject:meaning'] },
    explanation: 'A gating check compares the residual to its expected covariance. A GPS jump that is impossible under the current uncertainty should not yank the state; it should be rejected, logged, or routed to a recovery mode.',
  };

  yield {
    state: labelMatrix(
      'Covariance vs information form',
      [
        { id: 'cov', label: 'cov form' },
        { id: 'info', label: 'info form' },
        { id: 'many', label: 'many sens' },
        { id: 'link', label: 'SM/Wood' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'update', label: 'update' },
      ],
      [
        ['P', 'K residual'],
        ['Y=P^-1', 'add info'],
        ['sum terms', 'parallel'],
        ['inverse id', 'bridge'],
      ],
    ),
    highlight: { active: ['info:update', 'many:update', 'link:update'], compare: ['cov:update'] },
    explanation: 'The information filter stores inverse covariance. Measurements become additive information terms, which is useful when many independent sensors arrive. The bridge to Sherman-Morrison and Woodbury is direct: both are about moving between covariance and inverse-covariance updates cheaply.',
  };

  yield {
    state: labelMatrix(
      'Filter family',
      [
        { id: 'kf', label: 'KF' },
        { id: 'ekf', label: 'EKF' },
        { id: 'ukf', label: 'UKF' },
        { id: 'pf', label: 'PF' },
      ],
      [
        { id: 'assumes', label: 'assumes' },
        { id: 'use', label: 'use' },
      ],
      [
        ['linear', 'fast base'],
        ['local linear', 'robotics'],
        ['sigma pts', 'nonlinear'],
        ['particles', 'multi modal'],
      ],
    ),
    highlight: { active: ['kf:use', 'ekf:use', 'ukf:use'], compare: ['pf:use'] },
    explanation: 'The basic Kalman filter is linear and Gaussian. EKF linearizes nonlinear models around the current state. UKF pushes sigma points through nonlinear functions. Particle filters keep many weighted hypotheses, connecting this family back to Importance Sampling & Off-Policy Estimation.',
  };

  yield {
    state: fusionGraph('Production lesson: replayable state estimation'),
    highlight: { active: ['sync', 'filter', 'gate', 'log', 'track'], found: ['log'] },
    explanation: 'A production estimator needs replayable sensor logs, time synchronization, configured noise matrices, residual dashboards, outlier counters, and fallback modes. The math is recursive, so a bad measurement can poison many future states unless the system can rewind and replay.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'predict update') yield* predictUpdate();
  else if (view === 'sensor fusion') yield* sensorFusion();
  else throw new InputError('Pick a Kalman filter view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A moving system is never observed directly. A vehicle, drone, robot arm, satellite, or phone has noisy measurements and an imperfect motion model. The system needs one best estimate now, not a pile of contradictory sensor readings.',
        'A Kalman filter is a recursive estimator. It carries a state vector `x` and an uncertainty covariance `P`, predicts them forward with a model, then corrects them when a measurement arrives.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first attempt is to average sensors. If GPS says position 13 and the model says 14, split the difference. That works only when every source measures the same thing with the same noise at the same time.',
        'Another tempting approach is to trust the model between measurements and snap to each sensor update. That produces jumps, chases glitches, and throws away information about which variables are coupled.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty shape. Position error and velocity error are not independent in a moving system. If position was overestimated, velocity may also need to shift. A point estimate cannot represent that coupling.',
        'The second wall is time. Sensors arrive at different rates, with different delays, and with different failure modes. A GPS spike, wheel slip, camera false detection, or timestamp skew can poison many future states because every posterior becomes the next prior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Carry uncertainty as part of the state. The estimate is not just `x`; it is `x` plus covariance `P`. Prediction moves the mean and usually grows uncertainty. Measurement update compares the sensor to the prediction and shrinks uncertainty in the directions the sensor actually observes.',
        'The residual is the surprise: `y = z - Hx`. The innovation covariance `S = HPH^T + R` says how large that surprise should have been. The Kalman gain decides how much of the surprise should move the state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prediction step applies the motion model. In the linear form, `x_prior = F x` and `P_prior = F P F^T + Q`. `Q` is process noise: the model admits that acceleration, friction, commands, or the environment may not match the simple equation.',
        'The measurement step compares a sensor reading `z` with what the current state would predict through `H`. It computes residual `y`, innovation covariance `S`, gain `K = P H^T S^-1`, then updates the state with `x_posterior = x_prior + K y`.',
        'The covariance update is as important as the mean update. A trusted measurement reduces uncertainty in the observed direction. If covariance couples position and velocity, a position sensor can also shift velocity because the filter believes those errors move together.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the predict-update view, watch the loop. The posterior from one frame becomes the prior in the next. That is the recursive contract; a bad update does not stay local.',
        'The state matrix shows the hidden estimate and the uncertainty around it. Position and velocity are the values. `P pos`, `P vel`, and `P cross` explain how confident the filter is and how errors are coupled.',
        'The sawtooth plot shows the rhythm of the filter. Prediction grows uncertainty because time passes. Measurement shrinks it because a sensor adds information. In the fusion view, each sensor enters with its own timing, measurement model, and noise claim.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'In the linear-Gaussian case, a Gaussian belief is fully described by its mean and covariance. A linear motion model maps a Gaussian to another Gaussian. A linear Gaussian measurement update combines the prior and the likelihood into a new Gaussian.',
        'That is why the filter does not need the full history. The current `x` and `P` are a sufficient summary of past accepted measurements under the model assumptions. Each step preserves the same representation: mean plus covariance.',
        'In real systems, the guarantee becomes an engineering claim. The filter is trustworthy only when the model, noise matrices, timestamps, and outlier gates are honest enough for the operating regime.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation starts with position 12.0 m and velocity 2.0 m/s. A constant-velocity prediction moves the position near 14.0 m. Uncertainty grows because the model does not know the exact acceleration or disturbance during the step.',
        'A GPS measurement arrives at 13.0 m, so the residual is -1.0 m. If position uncertainty is high and GPS noise is moderate, the gain gives the measurement strong influence. The position moves toward GPS, and velocity shifts a little because the covariance says position and velocity errors are linked.',
        'The important lesson is not the exact numeric gain. The lesson is responsibility. The model says where the state should go. The measurement says how the world disagrees. The covariance decides whether that disagreement is normal noise, useful evidence, or an outlier.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'For a state dimension `d`, storing covariance costs O(d^2). Matrix products and inversions dominate the update; the innovation inversion is on the measurement dimension. Small tracking filters are fast, but high-dimensional filters need structure, sparsity, or approximations.',
        'Tuning changes behavior. If `Q` is too small, the filter overtrusts the motion model and lags real changes. If `R` is too small, it overtrusts the sensor and chases noise. If `R` is too large, it ignores useful measurements.',
        'The covariance matrix is a claim about uncertainty, not a bag of knobs. The gain, residual gate, dashboards, and failure alarms all depend on that claim being roughly true.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Kalman filtering wins when the state is compact, changes smoothly, and uncertainty is close enough to Gaussian: navigation, robotics, radar tracking, sensor fusion, control systems, IMU/GPS fusion, and financial latent-state estimates.',
        'It is especially useful for asynchronous sensors. IMU can predict at high rate, GPS can anchor global position at low rate, wheel speed can constrain velocity, and vision can correct drift when landmarks are visible.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A basic Kalman filter is the wrong tool when the system is strongly nonlinear, uncertainty is multimodal, the state has hard discrete alternatives, or the noise model is badly wrong. One Gaussian cannot represent "the object is probably in one of two different corridors."',
        'Extended and unscented Kalman filters help when the system is nonlinear but still roughly single-hypothesis. Particle filters, factor graphs, or smoothing methods are better when multiple hypotheses or delayed global consistency matter.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Most Kalman failures are modeling failures. Bad `Q` makes the filter either stiff or jittery. Bad `R` makes it chase noise or ignore data. Bad `H` means the sensor update is correcting the wrong state variables. Bad timestamps fuse facts from different times.',
        'Outliers need explicit gates. A residual can be scored against its expected covariance with a Mahalanobis distance. A measurement that is too surprising should be rejected, logged, or routed to a recovery mode instead of silently yanking the state.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A vehicle receives IMU, GPS, wheel-speed, and camera landmark events. IMU is frequent and smooth but drifts. GPS is slow and noisy but globally anchored. Wheel speed is useful until tires slip. Vision is rich but fragile.',
        'The estimator predicts on every time advance, then updates whenever a sensor event arrives with a timestamp, measurement model, and noise covariance. Each accepted measurement changes both `x` and `P`; each rejected measurement should leave evidence in logs.',
        'A production fusion system needs replayable raw sensor logs, synchronized clocks, versioned noise matrices, residual dashboards, outlier counters, and fallback modes. Without replay, engineers cannot tell whether a track jump came from the model, a sensor, a timestamp, or a gate.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kalman, A New Approach to Linear Filtering and Prediction Problems, linked from UNC at https://www.cs.unc.edu/~welch/kalman/kalmanPaper.html; Welch and Bishop, An Introduction to the Kalman Filter at https://www.cs.unc.edu/~welch/media/pdf/kalman_intro.pdf; Bardsley, A Matrix Theoretic Derivation of the Kalman Filter at https://www.matrix-inst.org.au/wp_Matrix2016/wp-content/uploads/2018/05/Bardsley.pdf; and Khan, Matrix Inversion Lemma and Information Filter at https://emtiyaz.github.io/Writings/MILandIF.pdf.',
        'Study Eigenvalues and Eigenvectors for covariance geometry, Sherman-Morrison Rank-One Update for inverse-update intuition, Particle Filter Resampling Localization for multimodal belief, PCA for covariance structure, Calibration Curves for honest uncertainty, and Markov Chains for state evolution.',
      ],
    },
  ],
};
