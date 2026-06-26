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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the shared-state view as optimistic concurrency control for a cluster. A scheduler reads the current cluster state, plans a placement, and tries to commit that placement back to a shared store. Active marks the scheduler currently attempting a commit. Visited marks resources already read or claimed in this round.',
        {type:'callout', text:'Omega turns cluster scheduling from one serialized policy engine into parallel planners guarded by a shared state store that rejects stale placements.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/71/Amazon_AWS_us-west-2_morrow_east_AZ_01.jpg', alt:'Aerial view of several large data center buildings.', caption:'AWS us-west-2 availability zone, used here as a generic large cluster setting; photo by Tedder, CC BY-SA 4.0, via Wikimedia Commons.'},
        'Optimistic means the scheduler proceeds as if no conflict will happen, then checks at commit time. A safe inference rule is this: a placement is valid only if the resource version it read is still current when it commits.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A large compute cluster runs many kinds of jobs: services, batch analytics, machine learning, storage tasks, and experiments. Each job has resource needs and policy constraints. A cluster scheduler decides which machine should run each task.',
        'One centralized scheduler is easy to reason about but becomes a policy and throughput bottleneck. Different workloads want different placement logic. Omega exists because Google wanted multiple specialized schedulers to operate in parallel while preserving one consistent view of cluster resources.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one master scheduler with a global queue. It sees all jobs, owns all machines, and decides one placement at a time. This gives a clear authority and avoids two schedulers accidentally assigning the same CPU or memory.',
        'That design is reasonable for smaller clusters or simpler workloads. The problem is that every policy change, specialized workload, and scheduling decision must pass through the same engine. A slow scheduling path for one workload can delay unrelated work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is serialized control. A monolithic scheduler must combine all policies into one code path or hand off to plugins under one lock-like authority. As cluster size and workload variety grow, scheduling latency and organizational coupling both grow.',
        'A naive multi-scheduler design hits a different wall: conflicting placements. If two independent schedulers read that machine M has 8 free CPUs and both place 6 CPU tasks there, the cluster is overcommitted. Parallel scheduling needs a correctness guard.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is shared state with conflict detection. Each scheduler can make decisions independently from a snapshot of cluster state. The shared store accepts a commit only if the resources touched by the placement have not changed since the scheduler read them.',
        'This is the scheduling version of optimistic concurrency control in databases. It assumes conflicts are not constant, lets common cases run in parallel, and forces a retry when two schedulers touch the same resources. The shared store, not a single policy engine, enforces resource consistency.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each scheduler watches the shared cluster state and maintains a local view. When a job arrives, the scheduler filters feasible machines, scores candidates according to its policy, and prepares a placement transaction. The transaction names the resources it will consume and the versions it read.',
        'At commit, the shared store checks whether those resource versions are still current. If yes, it applies the placement and publishes the new state. If no, it rejects the commit, and the scheduler rereads state, replans, or delays the task.',
        'The conflict-and-retry view shows why rejection is normal, not a crash. A scheduler can lose a race for one machine and still succeed on another. The system trades some wasted planning work for parallel policy execution.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the commit invariant. No placement becomes real unless the shared store verifies that the resources it consumes have not been changed by another committed placement. Therefore two successful commits cannot both consume the same version of the same free resource.',
        'Schedulers may make stale plans, but stale plans are rejected. This separates policy from safety. A buggy policy can choose a poor machine, but it cannot silently double-allocate resources if the commit validation is correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scheduling cost is split between local planning and shared commit. If ten schedulers each evaluate 1,000 machines for one job, the cluster spends 10,000 machine evaluations, even if some commits later fail. Rejected commits waste planning work but avoid serializing all policy decisions.',
        'Conflict rate drives behavior. If 1 percent of commits conflict, retries are cheap and parallelism wins. If 40 percent conflict because schedulers chase the same scarce GPUs, the system burns time replanning. The shared store must also handle watch traffic, version metadata, and commit latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Omega influenced designs where many controllers act over shared cluster state. Kubernetes uses a shared API server and controllers that reconcile desired and observed state, though its default scheduler is not simply Omega. The general pattern appears anywhere specialized planners need one authoritative resource record.',
        'The pattern fits clusters with mixed workloads. A service scheduler can optimize availability, a batch scheduler can optimize throughput, and a machine-learning scheduler can optimize accelerator topology. They can coexist if the shared state layer rejects stale claims.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Omega-style scheduling fails when conflicts are frequent or expensive. Scarce resources such as GPUs, huge memory machines, or special network domains can cause many schedulers to target the same machines. In that regime, pessimistic reservation or a specialized central policy may be cheaper.',
        'It also depends on a reliable shared state service. If watches lag, schedulers plan from stale data more often. If commit latency grows, placement latency grows. If policy code ignores fairness, parallelism can make starvation harder to see.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose machine M has version 41 and 8 free CPUs. Scheduler A reads version 41 and plans a 6 CPU service task. Scheduler B also reads version 41 and plans a 4 CPU batch task. Both plans are locally feasible from the snapshot.',
        'Scheduler A commits first. The store checks version 41, applies the 6 CPU placement, and updates M to version 42 with 2 free CPUs. Scheduler B then tries to commit against version 41. The store rejects the commit because the version is stale.',
        'Scheduler B rereads M at version 42 and sees only 2 free CPUs, so it picks another machine or waits. The cluster never accepted 10 CPUs of work on an 8 CPU machine. The price was one wasted planning attempt by B.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source is the Google Omega paper at https://research.google/pubs/omega-flexible-scalable-schedulers-for-large-compute-clusters/. Also study Borg, Kubernetes scheduling, etcd concurrency, and optimistic concurrency control in databases.',
        'Next, study priority queues, bin packing, resource quotas, preemption, Kubernetes reconciliation, versioned key-value stores, and transaction conflicts. The reusable lesson is that parallel planners need a shared commit rule that makes stale decisions harmless.',
      ],
    },
  ],
};

