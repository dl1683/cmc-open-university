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
    { heading: 'How to read the animation', paragraphs: [
      'Read predict-update as one recursive estimate. The state vector x stores the current estimate, and covariance P stores uncertainty and coupling between errors. Active nodes show prediction, residual, gain, and update; the posterior from one step becomes the prior for the next.',
      {type:'callout', text:'Kalman filtering works because the estimate carries uncertainty, so each sensor residual is weighted by what the system already believes it does not know.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/a0/Kalman_filter_model_2.svg', alt:'Diagram of a Kalman filter model showing hidden state, observations, transition noise, and measurement noise across time steps.', caption:'Kalman filter state model, by Headlessplatter on Wikimedia Commons, public domain.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'A moving system is never observed directly. A vehicle, drone, robot, satellite, or phone has noisy measurements and an imperfect motion model. A Kalman filter exists to keep one current estimate plus uncertainty rather than a pile of conflicting sensor readings.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is averaging sensors or snapping to the newest reading. That works only when every source measures the same variable at the same time with the same reliability. Real fusion has different rates, delays, noise, and state variables.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is uncertainty shape. Position error and velocity error can be coupled, so a position measurement may also say something about velocity. A point estimate cannot express confidence, coupling, or whether a surprise is normal noise or an outlier.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Carry uncertainty as part of the state. Prediction moves the mean forward and usually grows uncertainty. Measurement computes residual y = z - Hx, scales it by expected uncertainty, and moves the state by the Kalman gain.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Prediction uses x_prior = F x and P_prior = F P F^T + Q. F is the motion model and Q is process noise. Update computes S = H P H^T + R, K = P H^T S^-1, then x_posterior = x_prior + K y and a new covariance.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'In the linear-Gaussian case, mean and covariance fully describe the belief. Linear prediction maps one Gaussian belief to another, and a Gaussian measurement update combines prior and likelihood into a new Gaussian. That gives the sufficient-summary invariant: current x and P contain the past information needed for the next step.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'For state dimension d, covariance storage costs O(d^2). Matrix products and the innovation inverse dominate update cost, with inversion driven by measurement dimension. If Q is too small the filter lags real motion; if R is too small it chases noise; cost shows up as behavior, not only CPU.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Kalman filtering wins in tracking and navigation with compact state and roughly single-peaked uncertainty: radar, IMU/GPS fusion, robot localization, control systems, satellites, and phone sensors. It is especially useful when IMU arrives fast, GPS arrives slowly, and vision appears only when landmarks are visible.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'A basic Kalman filter fails under strong nonlinearity, multimodal belief, bad timestamps, or dishonest noise matrices. One Gaussian cannot represent that a robot may be in one of two corridors. Production systems need outlier gates, residual dashboards, replayable logs, and fallback modes.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Start with position 12.0 m and velocity 2.0 m/s for a 1 second step, so prediction gives 14.0 m. Suppose predicted position variance is 4.0 and GPS noise variance is 1.0; GPS reads 13.0 m, so residual is -1.0 m. Gain is 4.0 / 5.0 = 0.8, so the updated position is 14.0 + 0.8 * -1.0 = 13.2 m.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Kalman paper at https://www.cs.unc.edu/~welch/kalman/kalmanPaper.html, Welch and Bishop at https://www.cs.unc.edu/~welch/media/pdf/kalman_intro.pdf, Maybeck at https://apps.dtic.mil/sti/citations/ADA021457, and Probabilistic Robotics at https://www.probabilistic-robotics.org/. Study covariance, matrix multiplication, eigenvectors, Sherman-Morrison Woodbury, particle filters, EKF, UKF, factor graphs, and time synchronization next.',
    ] },
  ],
};
