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

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'Cluster maintenance becomes dangerous when it sees Pods but not the service behind them. A node drain, upgrade, descheduler action, or operator script can evict several replicas before replacements become ready. The ReplicaSet or StatefulSet may eventually heal the object count, but the user-facing service can still fall below its availability target during the gap.',
        'A PodDisruptionBudget is Kubernetes saying that planned disruption needs an application-level budget. It gives the workload owner a way to state how much voluntary disruption the workload can tolerate while maintenance proceeds.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'The key distinction is voluntary versus involuntary disruption. PDBs are checked for voluntary evictions such as node drains and API-initiated evictions. They do not stop a node from dying, a kernel from panicking, a machine from losing power, or every kubelet pressure eviction. They are a coordination mechanism for planned loss, not an availability shield against all failure.',
        'The obvious approach is to drain nodes and trust controllers to replace anything deleted. That works only when startup is fast, spare capacity exists, readiness is accurate, and no other disruption is happening. The wall is concurrent loss: a drain, a rollout, and a slow readiness probe can combine into an outage even if every individual controller is behaving normally.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'A PDB is a selector plus a health budget. The selector decides which Pods belong to the budget. The spec expresses the budget with minAvailable or maxUnavailable. The status ledger reports expectedPods, currentHealthy, desiredHealthy, disruptedPods, and disruptionsAllowed. An eviction is accepted only while the selected workload has enough health slack.',
        'A drain tool should call the Eviction API instead of directly deleting Pods. The API server checks matching PDBs and either accepts the eviction or denies it. A denial is backpressure from the workload: voluntary disruption has spent the available slack and maintenance should wait, retry, or be deliberately overridden by an operator who understands the risk.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments service runs six replicas and sets minAvailable to 4. All six are healthy before maintenance starts. The first eviction is accepted because five healthy replicas remain. The second eviction is accepted because four healthy replicas remain. A third eviction would leave only three healthy replicas, so the API denies it until a replacement becomes ready.',
        'The important point is timing. Creating a replacement Pod is not enough. The budget is restored when the replacement is counted healthy. If image pull, scheduling, startup, readiness, or capacity is slow, the drain pauses even though the controller is trying to converge.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the eviction-gate view, follow the request path: drain, Eviction API, PDB selector, selected Pod health, status, allow or deny. The PDB is not attached to a node; it is attached to a set of Pods through labels. The decision is about whether the workload can afford one more voluntary loss right now.',
        'In the drain-ledger view, the plot shows health slack being spent and restored. The healthy line can touch the floor, and at that point the next voluntary eviction must wait. The ledger table is the operator view: each attempted eviction should have a selected PDB, budget snapshot, grace period, replacement readiness state, retry time, and final outcome.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is health slack. After an accepted voluntary eviction, the selected workload should still satisfy its desired healthy count. Readiness matters because Kubernetes is trying to protect available service, not just object existence.',
        'The mechanism works because it puts the check at the shared API boundary. Drains, maintenance tools, and other polite actors do not each need to invent their own availability math. They submit eviction requests, and the API server enforces the workload budget consistently.',
        'That shared boundary is also why direct deletion is dangerous during maintenance. It removes the workload owner from the decision and turns an explicit availability budget into an informal hope that replacement Pods appear quickly enough.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The computation is small: selector membership, health counts, desired health, and disruption slack. The operational cost is delay. A strict PDB can block node drains, upgrades, autoscaler scale-down, and other voluntary maintenance until the workload becomes healthy again.',
        'There is a real product tradeoff. A loose budget makes maintenance easy but may permit more concurrent loss than the service can tolerate. A strict budget protects availability but can freeze operations, especially for single-replica services, slow-starting workloads, or clusters with limited spare capacity.',
      ],
    },
    {
      heading: 'Choosing budget values',
      paragraphs: [
        'Choose a budget from serving capacity, not from a desire to make Kubernetes happy. If six replicas can handle peak traffic with one replica gone, minAvailable 5 may be appropriate. If the service needs only four healthy replicas for its SLO, minAvailable 4 gives maintenance more room. The number should come from load, redundancy, startup time, and blast-radius policy.',
        'Single-replica workloads need special care. A PDB that requires the only replica to remain available can block voluntary maintenance forever, but allowing eviction means the service can go down during a drain. That is not a Kubernetes trick question; it is an architecture decision about whether the workload is actually redundant.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Review each PDB beside the controller that owns the selected Pods. Confirm selector labels, replica count, minAvailable or maxUnavailable, readiness probe meaning, startup time, and rollout strategy. A budget that looks safe on paper can block every drain if the service runs too few replicas or has slow readiness.',
        'Drain runbooks should record every denied eviction with the matching PDB, disruptionsAllowed, currentHealthy, desiredHealthy, selected Pods, and replacement Pod status. That evidence turns a stuck node drain into an availability decision instead of a vague Kubernetes failure.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'PDBs fail silently when the selector is wrong. A selector that matches too many Pods makes unrelated replicas share one budget. A selector that matches too few Pods gives false confidence. In policy/v1, an empty selector has different consequences than many people expect, so selector review should be treated as production safety work.',
        'They also fail when tooling bypasses the Eviction API with direct deletion, when unhealthy Pods consume all slack, when percentage rounding surprises operators, or when minAvailable is set in a way that blocks all voluntary progress. A PDB cannot rescue a workload whose readiness probes do not reflect real serving health.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use PDBs for replicated services that can survive some planned loss but not unlimited planned loss: APIs, ingress controllers, quorum-backed systems with carefully chosen settings, and stateful workloads during controlled maintenance. Inspect disruptionsAllowed before drains and rollouts, not after the drain is already stuck.',
        'When a drain stalls, debug it as set math and health math. Which PDB matched the Pod? Which Pods does the selector include? How many are expected? How many are ready? What is desiredHealthy? Is a replacement pending for capacity, image pull, readiness, or scheduling reasons? The answer is usually in labels, readiness, controller scale, or an overly strict budget.',
        'For important services, rehearse the drain path before an emergency upgrade. A small staging drill can reveal slow image pulls, missing capacity, broken readiness probes, or selectors that match the wrong Pods. The best time to learn that a budget blocks maintenance is before a security patch window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes PDB task guide at https://kubernetes.io/docs/tasks/run-application/configure-pdb/, policy/v1 PodDisruptionBudget API reference at https://kubernetes.io/docs/reference/kubernetes-api/policy-resources/pod-disruption-budget-v1/, and API-initiated eviction at https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/.',
        'Study Kubernetes Scheduler Priority Queue & Preemption for eviction and priority interactions, Kubernetes Deployment Rolling Update State Machine for rollout math, Kubernetes Reconciliation for controller status, and SLO Error Budget Burn Rate Alert for service-level availability budgets.',
      ],
    },
  ],
};
