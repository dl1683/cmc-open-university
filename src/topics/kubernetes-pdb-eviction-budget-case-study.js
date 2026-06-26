// Kubernetes PodDisruptionBudget: voluntary evictions pass through the
// Eviction API and are allowed only while the selected workload stays healthy.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-pdb-eviction-budget-case-study',
  title: 'Kubernetes PodDisruptionBudget Eviction Budget Case Study',
  category: 'Systems',
  summary: 'How PodDisruptionBudget selectors, minAvailable or maxUnavailable, currentHealthy, desiredHealthy, and disruptionsAllowed guard voluntary evictions during drains and rollouts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['eviction gate', 'drain ledger'], defaultValue: 'eviction gate' },
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

function pdbGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'drain', label: 'drain', x: 0.7, y: 4.2, note: notes.drain ?? 'voluntary' },
      { id: 'evict', label: 'Evict', x: 2.2, y: 4.2, note: notes.evict ?? 'API' },
      { id: 'pdb', label: 'PDB', x: 3.8, y: 3.0, note: notes.pdb ?? 'selector' },
      { id: 'pods', label: 'pods', x: 3.8, y: 5.4, note: notes.pods ?? 'healthy?' },
      { id: 'status', label: 'status', x: 5.7, y: 4.2, note: notes.status ?? 'allowed' },
      { id: 'allow', label: 'allow', x: 7.3, y: 3.0, note: notes.allow ?? 'terminate' },
      { id: 'deny', label: 'deny', x: 7.3, y: 5.4, note: notes.deny ?? 'retry' },
      { id: 'node', label: 'node', x: 9.1, y: 4.2, note: notes.node ?? 'drained' },
    ],
    edges: [
      { id: 'e-drain-evict', from: 'drain', to: 'evict' },
      { id: 'e-evict-pdb', from: 'evict', to: 'pdb' },
      { id: 'e-pdb-pods', from: 'pdb', to: 'pods' },
      { id: 'e-pods-status', from: 'pods', to: 'status' },
      { id: 'e-pdb-status', from: 'pdb', to: 'status' },
      { id: 'e-status-allow', from: 'status', to: 'allow' },
      { id: 'e-status-deny', from: 'status', to: 'deny' },
      { id: 'e-allow-node', from: 'allow', to: 'node' },
    ],
  }, { title });
}

function budgetPlot() {
  return plotState({
    axes: { x: { label: 'eviction attempt', min: 0, max: 5 }, y: { label: 'healthy pods', min: 2, max: 8 } },
    series: [
      { id: 'healthy', label: 'healthy', points: [{ x: 0, y: 6 }, { x: 1, y: 5 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 5 }] },
      { id: 'floor', label: 'min', points: [{ x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }] },
    ],
    markers: [
      { id: 'stop', x: 2, y: 4, label: 'deny' },
      { id: 'recover', x: 4, y: 5, label: 'retry' },
    ],
  }, { title: 'Drain pauses when budget reaches zero' });
}

function* evictionGate() {
  yield {
    state: pdbGraph('Voluntary disruption enters through the Eviction API'),
    highlight: { active: ['drain', 'evict', 'pdb', 'e-drain-evict', 'e-evict-pdb'], compare: ['allow', 'deny'] },
    explanation: 'A PodDisruptionBudget protects against voluntary disruption such as node drain, cluster maintenance, or an API-initiated eviction. The actor should call the Eviction API so the API server can check the budget.',
    invariant: 'PDBs guard voluntary evictions; they cannot prevent every involuntary failure.',
  };

  yield {
    state: labelMatrix(
      'minAvailable budget',
      [
        { id: 'desired', label: 'desired' },
        { id: 'healthy', label: 'healthy' },
        { id: 'min', label: 'minAvail' },
        { id: 'allowed', label: 'allowed' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['6', 'replicas'],
        ['5', 'ready'],
        ['4', 'floor'],
        ['1', 'can evict'],
      ],
    ),
    highlight: { active: ['healthy:value', 'min:value', 'allowed:value'], found: ['desired:value'] },
    explanation: 'With minAvailable, disruptionsAllowed is roughly the slack between current healthy Pods and the minimum healthy Pods the workload must keep. Once that slack hits zero, new voluntary evictions should wait.',
  };

  yield {
    state: pdbGraph('Allowed eviction decrements the live disruption budget', { status: '1 left', allow: 'ok', deny: 'not used' }),
    highlight: { active: ['status', 'allow', 'node', 'e-status-allow', 'e-allow-node'], compare: ['deny'] },
    explanation: 'When the API server accepts an eviction, the Pod starts graceful termination. The budget remains tight until replacement Pods become healthy or the selected workload otherwise regains slack.',
  };

  yield {
    state: labelMatrix(
      'PDB fields to inspect',
      [
        { id: 'selector', label: 'selector' },
        { id: 'healthy', label: 'healthy' },
        { id: 'desired', label: 'desired' },
        { id: 'allowed', label: 'allowed' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'debug', label: 'debug' },
      ],
      [
        ['wrong pods', 'labels'],
        ['not ready', 'probes'],
        ['controller scale', 'owner refs'],
        ['zero', 'wait or fix'],
      ],
    ),
    highlight: { active: ['selector:debug', 'healthy:debug', 'allowed:debug'], compare: ['desired:debug'] },
    explanation: 'PDB debugging is mostly set math. Check which Pods the selector matches, which are healthy, what the owning controller wants, and whether disruptionsAllowed is already zero.',
  };
}

function* drainLedger() {
  yield {
    state: budgetPlot(),
    highlight: { active: ['healthy', 'floor', 'stop'], found: ['recover'] },
    explanation: 'Each accepted eviction spends one unit of availability slack. When healthy Pods reach the floor, the invariant says the drain must stop until replacement health restores budget.',
  };

  yield {
    state: pdbGraph('Drain loops must treat denial as backpressure', { deny: '429 style', node: 'not done' }),
    highlight: { active: ['deny', 'status', 'e-status-deny'], compare: ['allow', 'node'] },
    explanation: 'A denied eviction is not random failure. It is the workload declaring that availability budget is exhausted. A well-behaved drain controller waits, retries, or asks an operator to change rollout conditions.',
  };

  yield {
    state: labelMatrix(
      'Drain case ledger',
      [
        { id: 'podA', label: 'pod A' },
        { id: 'podB', label: 'pod B' },
        { id: 'podC', label: 'pod C' },
        { id: 'podD', label: 'pod D' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['ready', 'evict ok'],
        ['ready', 'evict ok'],
        ['ready', 'deny now'],
        ['new ready', 'retry ok'],
      ],
    ),
    highlight: { active: ['podC:decision', 'podD:decision'], found: ['podA:decision', 'podB:decision'] },
    explanation: 'The ledger should remember each eviction attempt, selected PDB, budget snapshot, grace period, replacement readiness, retry time, and final outcome. Without that record, drains look like mysterious stalls.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'delete', label: 'delete' },
        { id: 'selector', label: 'selector' },
        { id: 'percent', label: 'percent' },
        { id: 'unhealthy', label: 'unready' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['skip API', 'use Evict'],
        ['matches all', 'label audit'],
        ['rounding surprise', 'calc table'],
        ['blocks drain', 'policy review'],
      ],
    ),
    highlight: { active: ['delete:bad', 'selector:bad'], found: ['percent:fix', 'unhealthy:fix'] },
    explanation: 'Common failures are bypassing the Eviction API, writing selectors that match the wrong Pods, misunderstanding percentage rounding, or letting unhealthy Pods consume all drain progress.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'eviction gate') yield* evictionGate();
  else if (view === 'drain ledger') yield* drainLedger();
  else throw new InputError('Pick a Kubernetes PDB view.');
}

