// Omega case study: Google's shared-state cluster scheduling design, where
// many schedulers optimistically write against a common cell-state view.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'omega-scheduler-case-study',
  title: 'Omega Scheduler Case Study',
  category: 'Papers',
  summary: 'Omega as the scheduler-concurrency lesson: shared cluster state, parallel schedulers, optimistic transactions, and conflict retries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared-state scheduling', 'conflicts and retries'], defaultValue: 'shared-state scheduling' },
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

function omegaGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'cell state', x: 4.8, y: 4.0, note: 'shared snapshot' },
      { id: 'batch', label: 'batch scheduler', x: 1.2, y: 1.6, note: 'throughput' },
      { id: 'service', label: 'service scheduler', x: 4.8, y: 1.0, note: 'latency' },
      { id: 'ml', label: 'ML scheduler', x: 8.4, y: 1.6, note: 'accelerators' },
      { id: 'm1', label: 'machine A', x: 2.0, y: 6.8, note: 'free' },
      { id: 'm2', label: 'machine B', x: 4.8, y: 7.2, note: 'busy' },
      { id: 'm3', label: 'machine C', x: 7.6, y: 6.8, note: 'free' },
    ],
    edges: [
      { id: 'e-batch-state', from: 'batch', to: 'state', weight: 'read/write' },
      { id: 'e-service-state', from: 'service', to: 'state', weight: 'read/write' },
      { id: 'e-ml-state', from: 'ml', to: 'state', weight: 'read/write' },
      { id: 'e-state-m1', from: 'state', to: 'm1', weight: 'placement' },
      { id: 'e-state-m2', from: 'state', to: 'm2', weight: 'placement' },
      { id: 'e-state-m3', from: 'state', to: 'm3', weight: 'placement' },
    ],
  }, { title });
}

function* sharedStateScheduling() {
  yield {
    state: omegaGraph('Omega lets many schedulers share one cluster-state view'),
    highlight: { active: ['batch', 'service', 'ml', 'state'], found: ['e-batch-state', 'e-service-state', 'e-ml-state'] },
    explanation: 'Omega explores a shared-state design: multiple specialized schedulers run in parallel over a common view of cluster state, then commit placements optimistically.',
  };

  yield {
    state: labelMatrix(
      'Scheduler architecture choices',
      [
        { id: 'monolithic', label: 'monolithic' },
        { id: 'two_level', label: 'two-level' },
        { id: 'shared', label: 'shared-state' },
        { id: 'manual', label: 'manual partition' },
      ],
      [
        { id: 'who_decides', label: 'who decides' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['one scheduler', 'feature bottleneck'],
        ['resource manager + frameworks', 'offer mismatch'],
        ['parallel schedulers', 'conflict retries'],
        ['separate clusters', 'poor utilization'],
      ],
    ),
    highlight: { found: ['shared:who_decides'], compare: ['monolithic:pressure', 'two_level:pressure'] },
    explanation: 'Omega is a third point in the scheduler design space. It keeps a common cluster view like a monolith but allows specialized schedulers to evolve independently.',
    invariant: 'Parallel scheduling is useful only if conflicting placements are detected before becoming real.',
  };

  yield {
    state: omegaGraph('Each scheduler reads a snapshot and proposes placements'),
    highlight: { active: ['service', 'state', 'm1', 'e-service-state', 'e-state-m1'], compare: ['batch', 'ml'] },
    explanation: 'A scheduler can optimize for its workload: services may care about latency and anti-affinity; batch may care about throughput; ML may care about accelerator locality.',
  };

  yield {
    state: labelMatrix(
      'Why shared state helps experimentation',
      [
        { id: 'feature', label: 'new policy' },
        { id: 'scale', label: 'scale' },
        { id: 'fairness', label: 'fairness' },
        { id: 'visibility', label: 'visibility' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['add scheduler-specific logic', 'policy fragmentation'],
        ['parallel scheduling loops', 'commit conflicts'],
        ['central state can enforce', 'contention hot spots'],
        ['all schedulers see cluster', 'stale snapshots'],
      ],
    ),
    highlight: { active: ['feature:benefit', 'scale:benefit'], compare: ['scale:risk', 'visibility:risk'] },
    explanation: 'The paper is less about one final production API and more about a control-plane idea: optimistic concurrency can let schedulers run in parallel without fully centralizing their logic.',
  };
}

function* conflictsAndRetries() {
  yield {
    state: omegaGraph('Two schedulers choose the same free machine'),
    highlight: { active: ['batch', 'service', 'm1', 'state'], compare: ['e-batch-state', 'e-service-state'] },
    explanation: 'Optimistic scheduling creates races. Two schedulers can read the same snapshot and both choose machine A. The system must reject one transaction at commit time.',
  };

  yield {
    state: labelMatrix(
      'Optimistic placement transaction',
      [
        { id: 'read', label: 'read snapshot' },
        { id: 'choose', label: 'choose placement' },
        { id: 'commit', label: 'commit transaction' },
        { id: 'retry', label: 'retry on conflict' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['machine A free', 'candidate'],
        ['task -> A', 'proposal'],
        ['version changed?', 'accept or reject'],
        ['refresh snapshot', 'new proposal'],
      ],
    ),
    highlight: { found: ['commit:outcome'], active: ['retry:outcome'] },
    explanation: 'This is database optimistic concurrency applied to scheduling. Read a version, write a proposed placement, and abort if someone changed the facts you depended on.',
    invariant: 'A rejected placement must not leak into real machine state.',
  };

  yield {
    state: labelMatrix(
      'When conflicts are acceptable',
      [
        { id: 'rare', label: 'rare conflicts' },
        { id: 'cheap', label: 'cheap retries' },
        { id: 'hot', label: 'hot resources' },
        { id: 'urgent', label: 'urgent workloads' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'action', label: 'action' },
      ],
      [
        ['high throughput', 'use optimistic commits'],
        ['small wasted work', 'retry'],
        ['thrashing', 'partition or coordinate'],
        ['latency sensitive', 'reserve or prioritize'],
      ],
    ),
    highlight: { found: ['rare:result', 'cheap:action'], compare: ['hot:result', 'urgent:action'] },
    explanation: 'Optimism works when conflicts are low or retries are cheap. Under hot contention, a more coordinated policy may beat pure optimism.',
  };

  yield {
    state: labelMatrix(
      'Concept links',
      [
        { id: 'lockfree', label: 'lock-free queue' },
        { id: 'mvcc', label: 'MVCC' },
        { id: 'mesos', label: 'Mesos' },
        { id: 'borg', label: 'Borg' },
      ],
      [
        { id: 'shared_idea', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['optimistic CAS', 'data-structure scale'],
        ['snapshot + conflict check', 'database rows'],
        ['many framework schedulers', 'resource offers'],
        ['integrated scheduler', 'central policy'],
      ],
    ),
    highlight: { active: ['lockfree:shared_idea', 'mvcc:shared_idea'], compare: ['mesos:difference', 'borg:difference'] },
    explanation: 'Omega is a scheduler page, but the core move is familiar: read a shared state, propose a change, atomically validate it, and retry if reality moved.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared-state scheduling') yield* sharedStateScheduling();
  else if (view === 'conflicts and retries') yield* conflictsAndRetries();
  else throw new InputError('Pick an Omega view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Omega is Google\'s shared-state cluster scheduling design. It lets multiple specialized schedulers run in parallel against a shared cell-state view, using optimistic concurrency to detect conflicting placements.',
        'The case study matters because it connects cluster scheduling to database-style concurrency control and lock-free thinking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Schedulers read a snapshot of cluster state, choose placements according to their own policy, and try to commit those placements. If the state changed in a conflicting way, the transaction aborts and the scheduler retries.',
        'This design allows workload-specific scheduling logic without forcing every policy into one monolithic scheduler or relying solely on resource offers.',
        'The design is easiest to understand as MVCC for machines. A scheduler plans against a versioned view of the cell, then asks the shared state to validate that the resources and constraints it relied on are still true. If validation fails, the plan was only speculative.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Omega pays for snapshot staleness, conflict detection, retries, scheduler coordination, and policy fragmentation. It works best when conflicts are not too frequent or retries are cheap enough compared with the benefit of parallel specialized schedulers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Omega influenced scheduler design discussions around Borg, Mesos, Kubernetes, and modern cluster control planes. Its core idea also echoes MVCC databases and lock-free data structures: optimistic writes over shared state.',
        'The lesson travels beyond clusters. Any control plane with multiple specialized reconcilers faces the same problem: independent controllers need freedom to make local decisions, but their writes must be validated against a shared source of truth before they affect real infrastructure.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Optimistic concurrency is not magic. If many schedulers fight over the same scarce machines, retries can waste work and increase latency. The design still needs fairness, quota, admission control, and failure handling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google paper PDF at https://research.google.com/pubs/archive/41684.pdf, Google Research page at https://research.google/pubs/omega-flexible-scalable-schedulers-for-large-compute-clusters/, and ACM DOI at https://dl.acm.org/doi/10.1145/2465351.2465386. Study Borg Cluster Scheduler Case Study, Mesos Resource Manager Case Study, Lock-Free Queue, MVCC Internals & VACUUM, Bulkheads & Resource Isolation, and Ray Distributed Execution Case Study next.',
      ],
    },
  ],
};
