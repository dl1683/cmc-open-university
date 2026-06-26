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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a control-center evidence pipeline. SCADA means supervisory control and data acquisition: meters, breakers, and remote terminal units report grid values every few seconds. Active nodes are the evidence being used now, compare nodes are competing explanations, and found nodes are state or quality facts that have survived the current check.',
        'The safe inference rule is local but important. If the residual node stays high after the weighted least-squares solve, the voltage estimate may be numerically converged but not operationally trusted. Follow which measurement, topology version, or timing assumption explains the residual before accepting the state.',
        {type:'callout', text:`State estimation is useful only when the voltage estimate travels with the residuals, topology version, and observability evidence that justify trust.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/10/Functional_levels_of_a_Distributed_Control_System.svg', alt:'Layered diagram of distributed control system levels from field devices to production scheduling.', caption:'Functional levels of a Distributed Control System by Daniele Pugliesi, CC BY-SA 3.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A power grid has a hidden state: bus voltage magnitudes and phase angles that explain flows and injections across the network. Operators cannot read that state directly. They receive noisy SCADA values, faster phasor measurement unit readings, topology reports, and stale data from field equipment.',
        'State estimation exists to turn those imperfect observations into one usable grid picture with an evidence trail. The estimator must say not only what the state probably is, but also whether the measurement set was observable, which readings disagreed, and which topology snapshot was used. Without that evidence, downstream restoration and contingency tools inherit a number with no trust boundary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the newest meter reading or average nearby readings. That works for a gauge on one device, but a grid measurement is not an isolated fact. A real-power flow, reactive-power injection, voltage magnitude, and phasor angle each constrain the hidden state through a different equation.',
        'Another reasonable approach is to run a power-flow solve from the latest load and generation estimate. Power flow answers a forward question: given this model and injections, what state follows? State estimation answers an inverse question: given noisy measurements and a model, which state best explains the evidence?',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that bad data can look plausible one row at a time. A failed meter can be close to its previous value, a stale breaker can preserve an old topology, and a timing mismatch can make two correct readings disagree. Simple averaging has no way to know which readings are redundant, which are critical, or which equations they should satisfy together.',
        'The estimator also needs observability. Observability means the active measurements constrain every state variable enough to solve for it. If a network island has too few independent measurements, the solver may still output numbers, but those numbers are not justified by the available evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to fit the whole physical model and then inspect what refuses to fit. Weighted least squares chooses the state that minimizes measurement residuals, where a residual is measured value minus predicted value. The weights come from expected measurement variance, so a precise PMU can count more than a noisy pseudo-measurement.',
        'Bad-data detection is not a separate afterthought. The residual vector is the estimator looking back at its own answer. If one measurement can only be fitted by making many other predicted measurements worse, the residual pattern becomes evidence for a sensor, topology, timing, or security problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The estimator stores a measurement vector z, a state vector x, and a model h(x) that predicts what each meter should report for a candidate state. For AC state estimation, h(x) is nonlinear because line flows depend on voltage products and angle differences. The solver linearizes h(x), builds a sparse Jacobian, updates x, and repeats until the update is small.',
        'After convergence, the system computes residuals and runs gates. A global residual test asks whether the whole measurement set is statistically inconsistent. A normalized residual test scales each residual by its expected uncertainty and influence, then proposes the largest outlier for triage.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on redundancy plus physics. If the topology and network parameters are right, every healthy measurement is a noisy view of the same state. Moving the state to satisfy one false measurement tends to increase disagreement with other measurements, so the weighted objective prefers the state supported by the most consistent evidence.',
        'The bad-data loop is safe only as a hypothesis test, not as an automatic truth machine. Removing the largest normalized residual is justified when the rerun improves the global fit and does not destroy observability. The invariant is that every accepted state must be tied to the measurement set, topology version, covariance policy, and removal history that produced it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is solving sparse linear systems during each nonlinear iteration. If the grid doubles in buses and the measurement density stays similar, the vectors and Jacobian roughly double, but factorization cost depends heavily on sparsity pattern and fill-in. Bad ordering or dense coupling can make the solve grow much faster than the raw row count.',
        'Operational cost also behaves through evidence storage. Keeping residuals, normalized residuals, observability reports, topology hashes, and rerun ledgers adds memory and write traffic, but it prevents blind trust in a voltage display. A cheap estimator that drops this metadata is expensive during incidents because nobody can replay why a state was trusted.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transmission and distribution control rooms use state estimation before contingency analysis, outage restoration, alarm filtering, and optimal power-flow studies. Those tools need a coherent grid state, not a pile of raw measurements. Residuals help decide whether the input picture is safe enough for switching or dispatch decisions.',
        'The same pattern appears outside power systems whenever sensors report an indirect physical state. Aircraft tracking, industrial process control, robotics localization, and water-network monitoring all combine noisy measurements with a model. The shared lesson is that a live estimate should travel with quality evidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the model is wrong in a way the residual test cannot separate. A stale breaker status, wrong transformer tap, or bad line parameter can produce residuals that look like failed sensors. Multiple coordinated bad measurements can also mask each other by staying close to a plausible state.',
        'It also fails when time alignment is sloppy. SCADA, PMU, and topology data may describe different moments during a switching event. If the estimator mixes them as one snapshot, it can solve a network that never existed, and the residual explanation will point at symptoms instead of the timing error.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a three-bus area has six measurements and two unknown voltage angles after fixing the reference bus. Five readings have variance 0.01, and one line-flow reading has variance 0.04 because that meter is noisier. The weighted solve estimates angles of 0.00, -0.04, and -0.07 radians, then predicts the suspicious flow as 92 MW while the meter reports 110 MW.',
        'The raw residual is 18 MW, but the normalized residual is 4.5 because the meter should not be that far away after accounting for its variance. Removing that one reading and rerunning drops the global residual statistic from 23 to 3.2 while observability remains intact. The disposition should still check topology around the line, because a recent breaker event could explain the same pattern.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include pandapower state-estimation documentation, NASPI synchrophasor materials, and standard power-system state-estimation texts. Read them for the measurement model, observability tests, weighted least-squares solve, and bad-data residual workflow. Treat implementation details as current only after checking the control-center software or library version being used.',
        'Study Power Grid Bus Admittance Sparse Matrix before this topic, then AC Power Flow Newton-Raphson Jacobian Case Study for the nonlinear equations. After this, study Kalman Filter Sensor Fusion, sparse matrix factorization, distributed tracing, and outage restoration. The through-line is evidence: every operational estimate needs enough provenance to be trusted and replayed.',
      ],
    },
  ],
};
