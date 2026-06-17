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
      heading: 'Why state estimation exists',
      paragraphs: [
        `A power-control center needs a live picture of the electrical state of the grid, but the state is not directly visible. Operators care about bus voltage magnitudes, phase angles, line flows, injections, transformer taps, breaker status, and whether the current model is trustworthy enough for contingency analysis or restoration. What arrives in the control room is messier: SCADA scans every few seconds, PMUs stream synchronized phasors at much higher rates, topology processors report switch positions, and some measurements are stale, biased, missing, or delayed.`,
        `State estimation is the reconciliation layer between raw telemetry and operational decisions. It turns a mixed measurement set into the best estimate of the network state, then attaches quality evidence to that estimate. The quality evidence matters as much as the voltage vector. A dispatch tool, outage-restoration assistant, or alarm processor should know whether the estimate was observable, which measurements were rejected, which topology version was used, and which residual tests failed.`,
      ],
    },
    {
      heading: 'Why direct readings fail',
      paragraphs: [
        `The tempting approach is to trust the newest reading or average nearby values. That fails because grid measurements are not interchangeable samples of one number. A voltage magnitude, a real-power flow, a reactive-power injection, and a PMU phasor each relate to the hidden state through a different equation. Some measurements are redundant, some are weakly informative, and some become misleading when the topology model is wrong.`,
        `The other obvious approach is to solve a power-flow case using the latest load and generation assumptions. That also misses the point. Power flow asks what state follows from a specified operating condition. State estimation asks which state best explains noisy evidence from the field. The measurement system and the network model must be solved together, with uncertainty carried explicitly instead of hidden inside operator intuition.`,
      ],
    },
    {
      heading: 'Measurement model',
      paragraphs: [
        `The standard model writes the measurement vector as z = h(x) + e. The hidden state x is usually the set of bus voltage angles and magnitudes, with one reference angle fixed. The function h(x) predicts what each meter would report if x were the true state. The error term e captures measurement noise, time skew, device bias, and modeling mismatch. For an AC estimator, h(x) is nonlinear because real and reactive power flows depend on products of voltages and trigonometric angle differences.`,
        `The covariance matrix R describes how much the estimator should trust each measurement. A high-quality PMU phasor usually receives a tighter variance than a noisy SCADA pseudo-measurement. A stale or suspicious meter may be down-weighted or removed. The inverse covariance becomes the weight matrix, so the estimator is not saying all evidence is equal. It is saying every measurement gets a contract: this value, from this source, at this time, with this expected error.`,
      ],
    },
    {
      heading: 'Weighted least squares',
      paragraphs: [
        `Weighted least squares chooses the state x that minimizes the weighted residual objective (z - h(x))^T R^-1 (z - h(x)). Because the AC equations are nonlinear, the solve is normally iterative. At each iteration the estimator linearizes h around the current guess, builds the Jacobian H, solves a normal equation involving H^T R^-1 H, updates the state, and repeats until the step or objective is small enough.`,
        `The data-structure lesson is that the estimator is a sparse graph problem wearing an optimization interface. The network admittance matrix determines which buses and branches can influence a measurement. The Jacobian is sparse because a line-flow measurement only touches the buses at the line ends. The measurement table needs stable ids, source types, variances, timestamps, topology references, and mapping rows into the sparse system. If those ledgers are sloppy, the numerical solve can look clean while answering the wrong question.`,
      ],
    },
    {
      heading: 'Observability first',
      paragraphs: [
        `Before trusting an estimate, the system must know whether the available measurements can determine the state. Observability is a rank and coverage question: do the active meters, PMUs, pseudo-measurements, and topology model constrain every islanded part of the network enough to estimate it? A full-rank Jacobian in the relevant subnetwork is the mathematical sign; a practical observability report also identifies islands, weak areas, missing measurements, and measurements that are critical because removing one would break observability.`,
        `This is where many dashboards mislead. A solver can return numbers even when the measurement set is fragile. The right output is not only state = V, angle. It is state plus observability status, topology version, covariance policy, residual summary, and a list of assumptions. The article animation shows this as a pipeline, but the operational point is stricter: an estimate without its quality ledger is not a complete product.`,
      ],
    },
    {
      heading: 'Residual tests',
      paragraphs: [
        `After the solve, the residual vector r = z - h(x_hat) says where measured values disagree with values predicted from the estimated state. A small residual does not prove every meter is healthy, but large or patterned residuals show that some part of the evidence does not fit the model. The global bad-data test computes a weighted residual statistic and compares it with a chi-square threshold based on measurement redundancy. If the statistic is too high, the measurement set is globally inconsistent.`,
        `A global alarm is not enough. Normalized residual tests divide each residual by its expected residual standard deviation, producing a score that is more comparable across measurement types. The largest normalized residual is a common candidate for bad-data location. The workflow is detect, locate, remove or flag one candidate, rerun the estimator, and verify that the residual pattern improves. That loop is simple, but the run record must preserve every removal and rerun so the control room can explain how the final state was produced.`,
      ],
    },
    {
      heading: 'Bad-data triage',
      paragraphs: [
        `A residual is not a diagnosis. The same high residual can mean a failed meter, a stale breaker status, a wrong transformer tap, a bad current-transformer ratio, a communication delay, a PMU clock issue, or a coordinated data-quality event. Treating all of those as "bad data" loses the most useful information. The triage queue should keep hypotheses separate: meter investigation, topology correction, time-synchronization check, model-parameter review, or security escalation.`,
        `The case-study view separates those routes because the fix depends on the cause. A single isolated flow outlier with normal surrounding measurements often points to a sensor or scaling problem. A cluster of flow residuals around a breaker can point to topology. PMU phase-angle inconsistencies across otherwise healthy channels can point to timing. A carefully shaped set of biased measurements may be harder: if an attacker changes measurements in a way that lies close to the measurement model, ordinary residual tests may not flag it. That is why residuals are part of defense, not the whole defense.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `State estimation works because the grid has strong physical constraints. Power cannot flow arbitrarily through a branch; voltages, angles, admittances, and injections must satisfy Kirchhoff-style relationships. Redundant measurements give the estimator several ways to infer the same hidden state. When one reading is noisy, the rest of the network can often pull the estimate toward a physically consistent answer.`,
        `The residual machinery works because wrong evidence usually has to fight the model. A biased measurement can be fitted only by moving the state, but moving the state tends to make other predicted measurements worse. The normalized residual identifies which measurement is least compatible with the fitted state after accounting for measurement influence and variance. This is the same general idea behind robust regression: use redundancy and a model of uncertainty to separate noise from structure.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The estimator can fail quietly when its assumptions are wrong. Bad covariance values can make a noisy meter too influential or make a precise PMU too weak. Multiple interacting bad measurements can mask each other. Critical measurements have little redundancy, so their residuals may not stand out even when wrong. Topology errors can produce residual patterns that look like sensor failures. A converged nonlinear solve can still be a bad operational answer if it converged against a stale topology snapshot.`,
        `Time alignment is another common failure. SCADA values may come from one scan boundary, PMU values from another, and topology from a third. If a breaker changes state during that window, the estimator may be asked to reconcile evidence from two different networks. Implementation teams should treat timestamps, scan windows, topology hashes, and data freshness as first-class fields rather than comments in a log message.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a substation breaker opens after a fault, but the topology processor reports the change late. One line-flow meter now appears impossible under the old topology. The estimator runs, the global residual statistic crosses the chi-square gate, and the largest normalized residual points at that flow. A naive workflow would delete the meter and declare victory. A better workflow asks why the residual sits near a recent switching event.`,
        `The rerun compares two hypotheses. Under the old topology, several nearby flows and injections remain strained after removing the largest residual. Under the updated topology, the residuals collapse and the state becomes observable with a clean quality flag. The disposition is topology-latency correction, not field-meter replacement. The run ledger stores measurement ids, values, variances, timestamps, topology hash, estimator iterations, residual scores, removed candidates, rerun outcomes, and the operator's final disposition.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Build the estimator as a pipeline with explicit ledgers. The input ledger should contain measurement id, device id, source system, electrical location, measurement type, value, unit, variance, timestamp, freshness, and topology version. The model ledger should contain network parameters, breaker and switch status, bus-branch mapping, islanding status, and the Y-bus build version. The output ledger should contain state values, confidence and quality flags, residual vectors, normalized residuals, observability status, and every bad-data action taken.`,
        `Operationally, prefer small, explainable gates over one magic confidence score. Use global residual tests to detect inconsistency, normalized residuals to propose candidates, topology and timing checks to classify causes, and human review or policy gates for high-impact changes. In software terms, the residual vector is observability data for the estimator itself. Do not throw it away after producing a voltage display.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `State estimation feeds contingency analysis, optimal power flow, outage restoration, alarm suppression, situational awareness, operator training simulators, and post-event analysis. Restoration tools need a trusted picture before recommending switching actions. Contingency tools need a current state before asking what happens if another line trips. Alarm systems need residual and topology context to avoid flooding operators with symptoms of one stale model event.`,
        `The topic is also a useful bridge across this curriculum. It combines sparse matrices, graph topology, nonlinear optimization, statistical residuals, sensor fusion, time synchronization, and incident triage. That is why it is more than a utility-industry niche. It is a compact example of how real systems turn imperfect observations into controlled decisions.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: pandapower state estimation docs at https://pandapower.readthedocs.io/en/latest/estimation.html, pandapower overview at https://www.pandapower.org/about/, NASPI synchrophasor starter kit at https://www.naspi.org/sites/default/files/reference_documents/4.pdf, and NASPI distribution synchrophasor applications at https://www.naspi.org/sites/default/files/reference_documents/naspi_distt_synchro_measure_apps_20200716.pdf.`,
        `Study Power Grid Bus Admittance Sparse Matrix first for the network model, then AC Power Flow Newton-Raphson Jacobian Case Study for the nonlinear equations and sparse Jacobian. Study Kalman Filter Sensor Fusion Case Study for the time-updating contrast, Distribution Feeder Outage Restoration for downstream switching decisions, Sparse Matrix formats for implementation, and Distributed Tracing for the idea that every operational estimate needs enough evidence to be replayed and audited.`,
      ],
    },
  ],
};
