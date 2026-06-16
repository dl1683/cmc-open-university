// SCADA state estimation: reconcile noisy measurements into a grid state using
// weighted least squares, residual checks, and bad-data triage.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'scada-state-estimation-bad-data-residual-case-study',
  title: 'SCADA State Estimation Bad Data Residual Case Study',
  category: 'Systems',
  summary: 'A control-center case study: SCADA and PMU measurements, weighted least squares, measurement covariance, residual vectors, chi-square gates, normalized residual bad-data tests, and observability ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wls estimator', 'bad data triage'], defaultValue: 'wls estimator' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function seGraph(title) {
  return graphState({
    nodes: [
      { id: 'scada', label: 'SCADA', x: 0.8, y: 2.0, note: 'P/Q/V' },
      { id: 'pmu', label: 'PMU', x: 0.8, y: 5.0, note: 'phasor' },
      { id: 'model', label: 'model', x: 2.8, y: 3.5, note: 'Ybus' },
      { id: 'wls', label: 'WLS', x: 4.9, y: 3.5, note: 'solve' },
      { id: 'resid', label: 'resid', x: 6.8, y: 2.0, note: 'check' },
      { id: 'state', label: 'state', x: 8.5, y: 3.5, note: 'V,ang' },
      { id: 'bad', label: 'bad', x: 6.8, y: 5.0, note: 'triage' },
    ],
    edges: [
      { id: 'e-scada-wls', from: 'scada', to: 'wls' },
      { id: 'e-pmu-wls', from: 'pmu', to: 'wls' },
      { id: 'e-model-wls', from: 'model', to: 'wls' },
      { id: 'e-wls-resid', from: 'wls', to: 'resid' },
      { id: 'e-resid-bad', from: 'resid', to: 'bad' },
      { id: 'e-wls-state', from: 'wls', to: 'state' },
    ],
  }, { title });
}

function* wlsEstimator() {
  yield {
    state: seGraph('State estimation reconciles noisy measurements'),
    highlight: { active: ['scada', 'pmu', 'model', 'wls', 'e-scada-wls', 'e-pmu-wls', 'e-model-wls'], found: ['state'] },
    explanation: 'A control center receives imperfect measurements. Weighted least squares estimates the bus voltage state most consistent with the measurements, weights, and network model.',
    invariant: 'The estimator needs measurement values, variances, topology, and measurement-to-state mappings from the same time window.',
  };

  yield {
    state: labelMatrix(
      'Measurement table',
      [
        { id: 'v', label: 'Vmag' },
        { id: 'p', label: 'Pflow' },
        { id: 'q', label: 'Qinj' },
        { id: 'pmu', label: 'phasor' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'weight', label: 'weight' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['SCADA', 'med', 'noise'],
        ['SCADA', 'med', 'topo'],
        ['SCADA', 'low', 'bias'],
        ['PMU', 'high', 'time'],
      ],
    ),
    highlight: { active: ['v:weight', 'pmu:weight'], compare: ['q:risk'] },
    explanation: 'Different measurement types carry different noise and failure modes. The weight matrix is the data structure that encodes trust.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'iteration', min: 0, max: 6 }, y: { label: 'resid', min: 0, max: 1 } },
      series: [
        { id: 'fit', label: 'fit', points: [{ x: 0, y: 0.85 }, { x: 1, y: 0.42 }, { x: 2, y: 0.18 }, { x: 3, y: 0.08 }, { x: 4, y: 0.04 }] },
        { id: 'bad', label: 'bad', points: [{ x: 0, y: 0.88 }, { x: 1, y: 0.60 }, { x: 2, y: 0.55 }, { x: 3, y: 0.58 }, { x: 4, y: 0.60 }] },
      ],
      markers: [
        { id: 'gate', label: 'gate', x: 4, y: 0.12 },
        { id: 'alarm', label: 'alarm', x: 4, y: 0.60 },
      ],
    }, { title: 'Residuals expose inconsistent evidence' }),
    highlight: { active: ['fit'], compare: ['bad'], found: ['gate', 'alarm'] },
    explanation: 'Residual traces make bad data visible. A converged numerical solve can still be operationally suspect if residual tests fail.',
  };

  yield {
    state: labelMatrix(
      'Estimator output',
      [
        { id: 'state', label: 'state' },
        { id: 'resid', label: 'resid' },
        { id: 'obs', label: 'observ' },
        { id: 'qual', label: 'quality' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'use', label: 'use' },
      ],
      [
        ['V,ang', 'ops'],
        ['z-h(x)', 'bad data'],
        ['rank', 'coverage'],
        ['flags', 'dispatch'],
      ],
    ),
    highlight: { active: ['state:stores', 'resid:stores'], found: ['qual:use'] },
    explanation: 'The estimator should output more than voltage state. Residuals, observability, topology version, and quality flags decide whether downstream tools should trust the result.',
  };
}

function* badDataTriage() {
  yield {
    state: labelMatrix(
      'Bad-data gates',
      [
        { id: 'global', label: 'global' },
        { id: 'norm', label: 'norm' },
        { id: 'remove', label: 'remove' },
        { id: 'rerun', label: 'rerun' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'action', label: 'action' },
      ],
      [
        ['chi2', 'suspect'],
        ['max rN', 'locate'],
        ['one meas', 'mask'],
        ['WLS', 'verify'],
      ],
    ),
    highlight: { active: ['global:action', 'norm:action'], found: ['rerun:action'] },
    explanation: 'A common workflow detects that the measurement set is globally inconsistent, identifies the largest normalized residual, removes or flags it, and reruns.',
  };

  yield {
    state: seGraph('Residual triage separates sensors from topology'),
    highlight: { active: ['resid', 'bad', 'e-resid-bad'], compare: ['model'], found: ['state'] },
    explanation: 'Bad residuals can come from a failed meter, wrong transformer tap, stale breaker status, timing mismatch, or cyber/data quality issue. The triage queue should keep those hypotheses separate.',
  };

  yield {
    state: labelMatrix(
      'Triage queue',
      [
        { id: 'meter', label: 'meter' },
        { id: 'topo', label: 'topo' },
        { id: 'time', label: 'time' },
        { id: 'attack', label: 'attack' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['single outlier', 'field'],
        ['many flows', 'model'],
        ['PMU skew', 'clock'],
        ['pattern', 'security'],
      ],
    ),
    highlight: { active: ['meter:route', 'topo:route'], compare: ['attack:route'] },
    explanation: 'A residual is an explanation candidate, not a final diagnosis. Routing matters because the fix could be a sensor ticket, topology correction, clock investigation, or security escalation.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'pf', label: 'flow' },
        { id: 'se', label: 'state' },
        { id: 'pmu', label: 'PMU' },
        { id: 'restore', label: 'restore' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'next', label: 'next' },
      ],
      [
        ['Ybus', 'WLS'],
        ['meas', 'bad data'],
        ['phasor', 'time'],
        ['switch', 'crew'],
      ],
    ),
    highlight: { active: ['pf:next', 'se:next'], found: ['restore:input'] },
    explanation: 'State estimation is the visibility layer that restoration and contingency tools rely on before they propose switching actions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wls estimator') yield* wlsEstimator();
  else if (view === 'bad data triage') yield* badDataTriage();
  else throw new InputError('Pick a SCADA state-estimation view.');
}

export const article = {
  references: [
    { title: 'pandapower State Estimation', url: 'https://pandapower.readthedocs.io/en/latest/estimation.html' },
    { title: 'NASPI Synchrophasor Technology Fact Sheet', url: 'https://www.naspi.org/sites/default/files/reference_documents/4.pdf' },
    { title: 'NASPI Distribution Synchrophasor Applications', url: 'https://www.naspi.org/sites/default/files/reference_documents/naspi_distt_synchro_measure_apps_20200716.pdf' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Power-system state estimation reconciles noisy SCADA and PMU measurements into an estimated electrical state, usually bus voltage magnitudes and angles. It is a visibility layer for operations.', 'The core data structures are measurement tables, measurement-to-state functions, covariance or weight matrices, topology snapshots, residual vectors, bad-data flags, and observability reports.'] },
    { heading: 'How it works', paragraphs: ['Weighted least squares minimizes measurement residuals scaled by measurement uncertainty. After solving, residual tests check whether the measurement set is statistically consistent. Large normalized residuals can point to bad data candidates.', 'PMUs add time-synchronized phasor measurements, while SCADA provides broader but slower and noisier values. The estimator must respect timestamps and topology.'] },
    { heading: 'Cost and complexity', paragraphs: ['State estimation is harder than smoothing values. Observability, topology errors, gross measurement errors, covariance tuning, and time skew can all produce plausible-looking but wrong estimates. Residual diagnostics and provenance are operational requirements.'] },
    { heading: 'Complete case study', paragraphs: ['A substation meter reports an impossible flow after a breaker operation. The estimator sees a global residual alarm, the normalized residual test points to one flow measurement, and topology comparison shows the breaker event arrived late. The system routes a topology-data issue instead of dispatching a field crew to a healthy sensor.', 'The run record stores measurement ids, values, variances, timestamps, topology hash, residuals, removed measurements, estimator status, and operator disposition.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not assume convergence means truth. Do not mix measurements and topology from different time windows. Do not collapse bad data into one generic alarm; sensor, topology, timing, and security issues need different remediation.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: pandapower state estimation docs at https://pandapower.readthedocs.io/en/latest/estimation.html, pandapower overview at https://www.pandapower.org/about/, NASPI synchrophasor starter kit at https://www.naspi.org/sites/default/files/reference_documents/4.pdf, and NASPI distribution synchrophasor applications at https://www.naspi.org/sites/default/files/reference_documents/naspi_distt_synchro_measure_apps_20200716.pdf. Study AC Power Flow Newton-Raphson Jacobian Case Study, Kalman Filter Sensor Fusion Case Study, and Distribution Feeder Outage Restoration Switching Case Study next.'] },
  ],
};
