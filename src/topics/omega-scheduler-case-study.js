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
      heading: 'The scheduling problem',
      paragraphs: [
        'Omega is a cluster-scheduling paper about a control-plane problem that appears whenever infrastructure grows faster than one policy can comfortably handle. A large compute cluster runs many kinds of work: latency-sensitive services, long batch jobs, data-processing pipelines, experiments, machine-learning training, and jobs with special hardware or locality needs. Each workload wants a scheduler that understands its own shape. At the same time, all of those schedulers are fighting over one physical cell of machines.',
        'The naive answer is one monolithic scheduler. It sees everything, so it can enforce global policy and avoid conflicting placements. But it becomes a feature bottleneck. Every workload-specific policy must be added to the same scheduler, tested against every other policy, and released without destabilizing the cluster. Another answer is two-level scheduling, where a resource manager offers resources to frameworks. That gives frameworks more control, but offers can mismatch what a framework actually needs and can hide useful global information.',
        'Omega explores a third point: many schedulers, one shared view of cluster state, and optimistic transactions to detect conflicts. The idea is simple enough to sound obvious after you see it. Let schedulers plan in parallel, but make their writes conditional on the state still being compatible with the assumptions they used.',
      ],
    },
    {
      heading: 'The database idea hiding inside the scheduler',
      paragraphs: [
        'The best mental model for Omega is optimistic concurrency control over machines. A scheduler reads a snapshot of the cell: which machines exist, what resources are free, what tasks are running, what constraints apply, and what versions those facts have. The scheduler then chooses placements according to its own policy. A service scheduler may care about latency and anti-affinity. A batch scheduler may care about throughput and packing. An accelerator scheduler may care about GPU topology or scarce device types.',
        'The chosen placement is not real yet. It is a proposed transaction. At commit time, the shared state checks whether the facts the scheduler depended on are still true. If another scheduler already claimed the machine, changed a relevant constraint, or otherwise invalidated the plan, the transaction aborts. The scheduler refreshes its snapshot and tries again. If validation succeeds, the placement becomes part of the authoritative cluster state and can be sent to the machines.',
        'This is why Omega belongs in a data-structures and systems curriculum. It shows that an idea from databases and lock-free programming can become a cluster-management architecture. Read a versioned state, compute locally, compare against reality, and commit only if reality has not moved in a conflicting way.',
      ],
    },
    {
      heading: 'What shared state buys',
      paragraphs: [
        'Shared state gives specialized schedulers more information than a narrow resource-offer interface. A scheduler can reason about the whole cell, not only about resources currently offered to it. It can inspect placement constraints, machine attributes, current load, and other jobs. That makes richer policies possible without forcing every policy into one monolithic binary.',
        'It also makes scheduler development more independent. Teams can build schedulers for their workloads, experiment with new placement logic, and evolve policy without waiting for a central scheduler to absorb every feature. The shared state remains the integration point. The optimistic transaction is the safety rail that prevents independent schedulers from both believing they own the same resource.',
        'The trade is that conflict becomes a normal cost. Omega does not prevent schedulers from making incompatible plans. It prevents incompatible plans from committing. That is an important distinction. Work may be wasted, latency may increase, and heavily contended resources may produce many retries. Optimism pays off only when the wasted work is cheaper than centralized coordination.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Omega works when most scheduler decisions do not collide. Large clusters have many machines and many independent placement opportunities. If two schedulers usually choose different resources, parallel planning increases throughput and reduces the need for one scheduler to understand every policy. The shared state still catches the cases where they collide.',
        'It also works because scheduling decisions can often be retried. If a proposed placement fails because machine A was claimed, the scheduler can choose machine B or recompute from a fresh snapshot. That is very different from a real-world action that cannot be undone. Optimistic control is strongest when speculative work is cheap, validation is precise, and failed attempts do not leak into the external world.',
        'The design preserves a useful authority boundary. Schedulers can be diverse, but the shared cell state is authoritative. The system is not a federation of independent truths. A placement that fails validation is not half-real. It is rejected before it changes the cluster. This is the same principle that makes compare-and-swap useful in concurrent data structures.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Omega is often discussed alongside Borg, Mesos, and Kubernetes because they expose different scheduler-control-plane choices. Borg represents an integrated production cluster manager with a strong central system. Mesos is associated with resource offers and framework schedulers. Kubernetes has a default scheduler but also permits custom schedulers, controllers, admission policies, and reconciliation loops around a shared API server. The details differ, but the pressure is the same: many actors want to change one cluster.',
        'The idea also travels outside cluster scheduling. Any control plane with multiple reconcilers faces an Omega-shaped problem. Cloud infrastructure controllers, deployment systems, CI runners, quota managers, and agent orchestration systems all need independent decision loops that write to shared state. If those loops act without validation, they conflict. If every loop waits for one global coordinator, feature velocity and throughput suffer. Optimistic shared-state commits are one tool between those extremes.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main failure mode is contention. If many schedulers want the same scarce resources, retries can turn into thrashing. GPUs, high-memory machines, special storage locality, or urgent low-latency capacity can become hot spots. Under those conditions, the system may need reservations, quota, priority, partitioning, or a more coordinated scheduler for that resource class.',
        'Another failure mode is policy fragmentation. Independent schedulers can optimize locally in ways that harm global fairness, efficiency, or reliability. A shared state store can reject direct conflicts, but it does not automatically decide what is fair. The system still needs admission control, quotas, priority rules, preemption policy, and a way to audit scheduler behavior.',
        'Snapshot staleness is also not free. A scheduler that plans against old information may keep producing doomed transactions. Good implementations need fresh-enough watches, useful conflict messages, and retry logic that backs off or changes strategy under contention. Without that, optimistic concurrency becomes a loop that repeatedly learns the same fact too late.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'Imagine a service scheduler and a batch scheduler both read a cell snapshot where machine A has enough CPU and memory. The service scheduler chooses A because it satisfies anti-affinity and latency constraints. The batch scheduler chooses A because it improves packing. Both choices are reasonable from their snapshots. The service scheduler commits first. The shared state records the service task on A and advances the relevant version. The batch scheduler then tries to commit and fails because the resource facts it depended on changed.',
        'The failed batch placement is not a correctness problem if it stays speculative. The batch scheduler refreshes the state and chooses another machine. The conflict is a performance cost, not a cluster-corrupting event. If this happens rarely, Omega wins. If it happens constantly, the design is telling you that the resource class needs more explicit coordination.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Omega is not just a scheduler paper. It is a general pattern for parallel control-plane decisions: share the state, let specialized actors compute independently, validate writes atomically, and retry when the world changed. The pattern is powerful because it separates policy diversity from state authority.',
        'The limit is just as important. Optimistic scheduling works when conflicts are uncommon, retries are cheap, and failed plans do not leak into real machines. When the cluster is dominated by scarce hot resources or strict latency promises, optimism needs help from admission control, quotas, reservations, or central coordination.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google paper PDF at https://research.google.com/pubs/archive/41684.pdf, Google Research page at https://research.google/pubs/omega-flexible-scalable-schedulers-for-large-compute-clusters/, and ACM DOI at https://dl.acm.org/doi/10.1145/2465351.2465386. Study Borg Cluster Scheduler Case Study, Mesos Resource Manager Case Study, Kubernetes Admission Policy Gate, Lock-Free Queue, MVCC Internals & VACUUM, Bulkheads & Resource Isolation, and Ray Distributed Execution Case Study next.',
      ],
    },
  ],
};
