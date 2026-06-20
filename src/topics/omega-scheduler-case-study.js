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
        'The animation shows a cluster cell with three specialized schedulers -- batch, service, and ML -- connected to a shared cell-state node, which in turn connects to physical machines. Active (highlighted) nodes mark the scheduler or machine currently involved in a placement decision. Found edges mark successful commits. Compare edges mark competing schedulers whose transactions may conflict.',
        'In the "shared-state scheduling" view, watch how all three schedulers read from the same cell state simultaneously and propose placements independently. In the "conflicts and retries" view, follow a single conflict through the optimistic transaction lifecycle: two schedulers read the same snapshot, both target machine A, one commits first, and the loser refreshes and retries.',
        {
          type: 'note',
          text: 'The key visual inference: if two schedulers both show active edges to the same machine, one transaction will fail at commit. The cell state node is the single source of truth that detects and rejects the conflict.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Google circa 2011 ran clusters of 10,000+ machines serving hundreds of distinct workloads: latency-sensitive web services, multi-hour batch analytics, ML training jobs needing GPU locality, and short-lived MapReduce tasks. Each workload type needed different scheduling logic -- services cared about anti-affinity and tail latency, batch cared about throughput and bin-packing, ML cared about accelerator topology. A single scheduler binary had to absorb every policy, and adding a new scheduling feature meant modifying, testing, and redeploying that monolith without destabilizing a production cluster.',
        {
          type: 'quote',
          text: 'The Omega paper grew from practical frustrations: adding new scheduling policies to a monolithic scheduler required changes to the scheduler itself, which increased complexity and reduced agility.',
          attribution: 'Schwarzkopf, Konwinski, Abd-El-Malek & Wilkes, "Omega: flexible, scalable schedulers for large compute clusters" (EuroSys 2013), Section 1',
        },
        'The constraint is not raw performance. A monolithic scheduler can make good placement decisions. The constraint is development velocity: when every scheduling policy lives in one binary, teams queue behind each other, testing is combinatorial, and the scheduler becomes the most dangerous deploy in the fleet.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable answer is a monolithic scheduler. One process sees all machines, all running tasks, and all pending requests. It serializes every placement decision, so conflicts are impossible by construction. Borg, Google\'s production cluster manager, used this architecture successfully for years.',
        {
          type: 'table',
          headers: ['Architecture', 'Who decides placement', 'Strength', 'Bottleneck'],
          rows: [
            ['Monolithic (Borg-style)', 'Single scheduler process', 'Global view, no conflicts', 'Feature velocity -- every policy in one binary'],
            ['Two-level (Mesos-style)', 'Resource manager offers to frameworks', 'Framework autonomy', 'Offer mismatch -- frameworks see only offered resources'],
            ['Static partitioning', 'Separate clusters per workload', 'Full isolation', 'Fragmentation -- idle capacity in one partition, starvation in another'],
          ],
        },
        'A monolithic scheduler works until the organization outgrows it. When dozens of teams want custom scheduling logic -- gang scheduling for MPI jobs, topology-aware placement for ML, preemption policies for latency-critical services -- the monolith becomes a coordination bottleneck among humans, not machines. Every feature request becomes a merge conflict in the scheduler codebase.',
        'The second reasonable answer is two-level scheduling, as in Mesos. A central resource manager partitions resources into offers and hands them to framework-specific schedulers. This gives frameworks independence, but frameworks can only see what they are offered, not the full cluster. A framework that needs machines with specific attributes may reject offers repeatedly, creating inefficiency that the resource manager cannot easily fix because it does not understand the framework\'s constraints.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The monolithic scheduler hits a wall that is organizational, not computational. Consider this sequence:',
        {
          type: 'diagram',
          text: 'Week 1:  Team A wants gang scheduling for MPI jobs\n         -> Modify monolithic scheduler, test against all policies, deploy\nWeek 3:  Team B wants GPU-topology-aware placement\n         -> Modify same scheduler, retest everything, deploy\nWeek 5:  Team C wants preemption tiers for latency services\n         -> Same scheduler, regression risk grows combinatorially\nWeek 8:  Teams A, B, C all have pending changes that conflict\n         -> Scheduling deploys freeze; teams blocked on each other',
          label: 'The monolithic scheduler becomes a human coordination bottleneck',
        },
        'The invariant that must hold is: no two tasks can be placed on the same resource simultaneously if their combined requirements exceed that resource\'s capacity. A monolithic scheduler enforces this trivially through serialization. But serialization of decisions forces serialization of development. The wall is not that the scheduler makes bad decisions -- it is that improving the scheduler requires everyone to stop and wait.',
        'Two-level scheduling hits a different wall. Because each framework only sees its offered subset, it cannot reason about global properties. If framework A needs four machines on the same rack and framework B holds three of those machines idle, the resource manager may never construct the right offer. The information hiding that provides isolation also prevents optimization.',
        {
          type: 'note',
          text: 'Mesos addressed this partially with "optimistic offers" and "revocation," but the fundamental issue remained: a framework making placement decisions with a partial view of the cluster cannot match the quality of decisions made with the full view.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give every scheduler the full cluster state, let them all plan in parallel, and use optimistic concurrency control to detect conflicts at commit time.',
        {
          type: 'quote',
          text: 'In Omega, there is no central resource allocator; instead, all resource-allocation decisions take place in the schedulers themselves. They use optimistic concurrency control to mediate clashes when they access the shared state.',
          attribution: 'Schwarzkopf et al. (2013), Section 3.2',
        },
        'This is the database idea of multi-version concurrency control (MVCC) applied to cluster machines instead of database rows. Each scheduler reads a consistent snapshot of the cell state -- every machine, every running task, every resource counter, every constraint, each tagged with a version number. The scheduler computes placements locally, taking as long as it needs, using whatever policy logic it wants. When it is ready, it submits a transaction: "place task T on machine M, assuming M still has version V." If the version matches, the transaction commits atomically. If another scheduler changed M in the meantime, the transaction aborts, and the scheduler retries with a fresh snapshot.',
        'The contract: a committed placement reflects a consistent view of reality at commit time. A rejected placement never touches the real cluster. Conflicts are performance costs, not correctness failures.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism has four phases, repeating in a loop for each scheduler:',
        {
          type: 'code',
          language: 'text',
          text: 'PHASE 1 -- SNAPSHOT\n  Scheduler S reads a full copy of cell state.\n  Each machine record has: {id, cpu_free, mem_free, gpu_free, tasks[], version}.\n  The snapshot is a consistent point-in-time view.\n\nPHASE 2 -- PLAN\n  S applies its own policy to choose placements.\n  Service scheduler: anti-affinity, latency zones, spread.\n  Batch scheduler: bin-packing, throughput, deadline.\n  ML scheduler: GPU topology, gang placement, locality.\n  Planning runs in parallel across all schedulers.\n\nPHASE 3 -- COMMIT\n  S submits a transaction: "place task T on machine M,\n  decrement M.cpu_free by X, contingent on M.version == V."\n  The cell state atomically checks the version.\n  If V matches: commit, increment version, update resources.\n  If V mismatched: abort, return conflict details.\n\nPHASE 4 -- RETRY (on conflict)\n  S reads a fresh snapshot and replans.\n  Retry may choose a different machine or the same one\n  if it is still feasible under the new state.',
        },
        'The key property: phases 2 and 3 happen independently for each scheduler. While the batch scheduler is planning a 1,000-task job, the service scheduler can commit a latency-critical placement without waiting. The only serialization point is the atomic compare-and-swap at commit, which is a single fast operation on the cell state store.',
        {
          type: 'diagram',
          text: 'Time --->  t0         t1         t2         t3         t4\n\nBatch:     [read]     [---plan 1000 tasks---]     [commit]\nService:   [read]  [plan] [commit]                         \nML:           [read]    [--plan--]  [commit]               \n                                                           \nCell state: v0    v0     v1(svc)    v2(ml)     v3(batch)?  \n                        committed  committed  may conflict',
          label: 'Parallel scheduling timelines -- each scheduler reads and plans independently',
        },
        'If the batch scheduler\'s commit at t4 targets a machine that the service or ML schedulers already changed, its transaction aborts only for the conflicting machines. The paper distinguishes between "all-or-nothing" transactions (the whole job fails if any machine conflicts) and "incremental" transactions (only conflicting placements retry). Incremental is more practical for large batch jobs where a few machine conflicts should not force replanning thousands of placements.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Optimistic concurrency works when conflicts are rare relative to total decisions. The Omega paper tested this with a simulator driven by real Google cluster traces and found that conflict rates stayed low under realistic workloads.',
        {
          type: 'table',
          headers: ['Workload mix', 'Scheduler count', 'Conflict rate', 'Why conflicts are rare'],
          rows: [
            ['Batch-heavy (common case)', '2-3', '< 2%', 'Large cluster, many machines, batch is flexible about placement'],
            ['Service-heavy (latency work)', '2-3', '< 5%', 'Service jobs are small, claim few resources per commit'],
            ['Mixed with ML', '3+', '5-12%', 'ML jobs want specific GPUs, creating hotspots on accelerator machines'],
            ['Adversarial (all want same resources)', 'many', '20-40%+', 'Optimistic control degrades; need coordination or partitioning'],
          ],
        },
        'The correctness argument rests on two properties. First, atomicity: a transaction either commits entirely (resources are decremented, task is recorded) or has no effect. There is no state where a machine shows a task that was never fully committed. Second, version monotonicity: versions only increase, so a stale snapshot can never accidentally match a newer version. A scheduler that reads version 5 and commits against version 7 will always fail, never accidentally succeed.',
        {
          type: 'note',
          text: 'This is the same correctness guarantee as compare-and-swap (CAS) in lock-free data structures. The cell state version plays the role of the CAS expected value. The analogy is exact: Omega applies lock-free programming to cluster management.',
        },
        'The design also preserves a clean authority boundary. Individual schedulers own policy (which machine is best for this job). The cell state store owns truth (which resources are actually available). No scheduler can override reality. A scheduler can be buggy, greedy, or slow, and the worst it can do is waste its own compute on failed transactions -- it cannot corrupt the cluster state.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The costs divide into compute cost and conflict cost.',
        {
          type: 'table',
          headers: ['Cost dimension', 'What it depends on', 'Scaling behavior'],
          rows: [
            ['Snapshot read', 'Cell size (machines * attributes)', 'O(M) per read; ~10K machines = ~10 MB snapshot'],
            ['Planning compute', 'Scheduler policy complexity', 'Varies: bin-packing is NP-hard in general, heuristics are O(T * M) for T tasks'],
            ['Commit latency', 'Cell state store throughput', 'Single CAS operation, microseconds if in-memory'],
            ['Conflict retry', 'Contention level', 'O(1) per retry cycle, but total retries can grow under contention'],
            ['Wasted planning work', 'Conflict rate * planning time', 'Low when conflicts are rare; dominates under hotspots'],
          ],
        },
        'When the cluster doubles from 5,000 to 10,000 machines, the snapshot size doubles, but conflict probability may actually decrease because there are more placement options. The cost that grows dangerously is not cluster size but contention: if 10 schedulers all want the same 50 GPU machines, retry loops dominate even in a million-machine cluster.',
        'Compared to a monolithic scheduler, Omega trades zero-conflict guarantees for parallelism. A monolith processes requests sequentially -- if planning one batch job takes 500ms, the service scheduler waits 500ms even for a trivial one-task placement. With Omega, the service scheduler commits in microseconds while the batch scheduler is still planning. For latency-sensitive workloads, this latency decoupling is the primary practical benefit.',
        {
          type: 'note',
          text: 'The paper reports that scheduling latency for service jobs dropped by an order of magnitude compared to a monolithic approach, because service placements no longer queued behind long-running batch scheduling decisions.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cell has three machines, each with 8 CPU cores free. Two schedulers -- service and batch -- read the same snapshot at time t0:',
        {
          type: 'code',
          language: 'text',
          text: 'Cell state at t0 (version 1 for all machines):\n  Machine A: cpu_free=8, version=1\n  Machine B: cpu_free=8, version=1\n  Machine C: cpu_free=8, version=1\n\nService scheduler reads snapshot, needs to place a 6-core web server.\n  Policy: pick the machine with lowest latency to the user-facing network.\n  Decision: Machine A (closest to network edge).\n  Transaction: {machine: A, cpu_decrement: 6, expected_version: 1}\n\nBatch scheduler reads same snapshot, needs to place a 4-core analytics job.\n  Policy: bin-pack -- pick the machine with most free cores.\n  All machines tied at 8 cores. Picks Machine A (first in sorted order).\n  Transaction: {machine: A, cpu_decrement: 4, expected_version: 1}',
        },
        'The service scheduler commits first. Machine A\'s state updates: cpu_free drops to 2, version advances to 2. Now the batch scheduler tries to commit with expected_version=1, but Machine A is already at version 2. The transaction aborts.',
        {
          type: 'diagram',
          text: 'Before conflict:     After service commits:    After batch retries:\n\n  A: 8 cpu (v1)        A: 2 cpu (v2)              A: 2 cpu (v2)\n  B: 8 cpu (v1)        B: 8 cpu (v1)              B: 4 cpu (v2)\n  C: 8 cpu (v1)        C: 8 cpu (v1)              C: 8 cpu (v1)\n                       Service task on A           Batch task on B',
          label: 'The batch scheduler retries on a fresh snapshot and picks Machine B',
        },
        'The batch scheduler refreshes its snapshot, sees Machine A now has only 2 cores free (not enough for 4), and picks Machine B instead. This time the commit succeeds. Total wasted work: one planning cycle for the batch scheduler. The cluster ends up with the service task on A and the batch task on B -- both well-placed according to their respective policies.',
        {
          type: 'note',
          text: 'If the batch scheduler had used an incremental transaction for a multi-task job, only the placement targeting Machine A would have failed. Placements on other machines in the same transaction could still commit, reducing the retry cost for large jobs.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Omega was a research prototype built at Google to explore the design space around Borg. The paper\'s contribution is architectural: it proved through simulation that shared-state scheduling with optimistic concurrency is viable at Google\'s scale, and it mapped the tradeoff space between monolithic, two-level, and shared-state designs.',
        {
          type: 'table',
          headers: ['System', 'Scheduling model', 'Omega\'s influence'],
          rows: [
            ['Borg (Google)', 'Monolithic with multi-path', 'Omega findings informed Borg\'s evolution; Borg adopted some parallel scheduling ideas'],
            ['Kubernetes', 'Default scheduler + custom schedulers sharing API server state', 'Shared etcd state with optimistic concurrency (resource versions) mirrors Omega\'s core mechanism'],
            ['Nomad (HashiCorp)', 'Multiple schedulers against shared state', 'Explicitly inspired by Omega; uses plan-queue with CAS-style conflict resolution'],
            ['Apollo (Microsoft)', 'Distributed per-job scheduling with shared cluster view', 'Similar shared-state philosophy but with opportunistic conflict resolution'],
          ],
        },
        'Kubernetes is the most widely deployed system that embodies Omega\'s core idea. The API server backed by etcd provides a shared state store. Every resource object has a resourceVersion field. When a controller or scheduler updates an object, the API server rejects the write if the resourceVersion has changed since the controller last read it. Controllers retry with a fresh read. This is exactly the Omega transaction model applied to arbitrary Kubernetes resources, not just machine placements.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Kubernetes optimistic concurrency -- same idea as Omega\n// 1. Read the current state of a pod\nconst pod = await k8s.readNamespacedPod("my-pod", "default");\n// pod.metadata.resourceVersion == "12345"\n\n// 2. Modify locally\npod.spec.containers[0].resources.limits.cpu = "4";\n\n// 3. Write back -- server checks resourceVersion\ntry {\n  await k8s.replaceNamespacedPod("my-pod", "default", pod);\n  // Succeeds only if resourceVersion is still "12345"\n} catch (e) {\n  if (e.statusCode === 409) {\n    // Conflict -- someone else modified the pod\n    // Re-read and retry (Phase 4: RETRY)\n  }\n}',
        },
        'The pattern also appears outside cluster scheduling. Database systems use MVCC for concurrent transactions. Git uses optimistic concurrency for pushes (your push fails if the remote ref advanced since you fetched). Distributed configuration systems like etcd and ZooKeeper use version-conditional writes. Any system where multiple writers share state and conflicts are expected to be rare benefits from the Omega pattern.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Optimistic concurrency degrades under contention. When many schedulers want the same scarce resources, the system enters a retry storm: each scheduler reads, plans, attempts to commit, fails, and replans, only to conflict again.',
        {
          type: 'table',
          headers: ['Failure mode', 'Trigger', 'Symptom', 'Mitigation'],
          rows: [
            ['Retry storm', 'Many schedulers target the same scarce resource (e.g., 50 GPU machines)', 'Scheduling latency spikes; most transactions abort', 'Partition scarce resources to a dedicated scheduler; add backoff'],
            ['Policy fragmentation', 'Independent schedulers optimize locally', 'Global fairness violations; starvation of low-priority work', 'Central admission control and quota enforcement outside the schedulers'],
            ['Snapshot staleness', 'Scheduler plans for seconds against an old snapshot', 'Consistently doomed transactions that waste compute', 'Watch-based incremental updates; shorter planning cycles'],
            ['Livelock', 'Two schedulers repeatedly conflict and both retry onto the same alternative', 'Neither scheduler makes progress', 'Randomized backoff or priority-based commit ordering'],
          ],
        },
        'The deeper limitation is that optimistic concurrency only detects conflicts -- it does not prevent them. A monolithic scheduler can guarantee that no two schedulers ever target the same resource. Omega discovers the conflict after planning work is done. When planning is expensive (large gang-scheduled jobs that require co-placement of hundreds of tasks), a single wasted planning cycle can cost hundreds of milliseconds. Under high contention, the total wasted compute exceeds what a pessimistic lock would have cost.',
        {
          type: 'note',
          text: 'The Omega paper acknowledges this tradeoff explicitly. Their recommendation is a hybrid: use shared-state optimistic scheduling for the common case (many machines, flexible placement), but add coordination mechanisms (reservations, priority partitions) for known hotspots. Pure optimism is a tool, not a religion.',
        },
        'Fairness is also outside Omega\'s scope. The cell state store can reject conflicting resource claims, but it cannot decide which scheduler deserves the resource. If a batch scheduler and a service scheduler both want the last free machine, the winner is whichever commits first -- essentially a race. Production systems need quota, priority tiers, preemption, and admission control layered on top of the optimistic commit mechanism.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The implementation complexity of Omega is moderate compared to a monolithic scheduler but shifts where the complexity lives.',
        {
          type: 'table',
          headers: ['Component', 'Monolithic scheduler', 'Omega shared-state'],
          rows: [
            ['Scheduling logic', 'All policies in one binary', 'Each scheduler is a separate binary with its own policy'],
            ['State management', 'In-process data structures', 'External cell state store with versioned records'],
            ['Conflict handling', 'Impossible (serialized)', 'Transaction abort + retry logic in every scheduler'],
            ['Testing', 'Combinatorial (all policies interact)', 'Per-scheduler (policies are independent)'],
            ['Deployment risk', 'High (one binary serves all workloads)', 'Low per scheduler (only its workload is affected)'],
            ['Global optimization', 'Easy (full view, full control)', 'Hard (no scheduler sees all pending decisions)'],
          ],
        },
        'The cell state store must support high-throughput versioned reads and atomic compare-and-swap writes. In the paper\'s simulation, the store handled tens of thousands of transactions per second across a 10,000-machine cell. The snapshot size scales linearly with cell size -- roughly 1-2 KB per machine for resource counters, attributes, and running task lists. A 10,000-machine cell produces ~10-20 MB snapshots.',
        'The practical complexity lives in retry policy. A naive "retry immediately on conflict" can create thundering-herd effects. Production implementations need exponential backoff, jitter, conflict-aware replanning (avoid the machine that caused the conflict), and circuit-breaker logic that escalates to a coordinator when conflict rates exceed a threshold.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Schwarzkopf, Konwinski, Abd-El-Malek & Wilkes, "Omega: flexible, scalable schedulers for large compute clusters," EuroSys 2013. ACM DOI: https://dl.acm.org/doi/10.1145/2465351.2465386',
            'Google Research page: https://research.google/pubs/omega-flexible-scalable-schedulers-for-large-compute-clusters/',
            'Companion paper: Verma et al., "Large-scale cluster management at Google with Borg," EuroSys 2015 -- the production system that Omega\'s research informed.',
            'Hindman et al., "Mesos: A Platform for Fine-Grained Resource Sharing in the Data Center," NSDI 2011 -- the two-level scheduling model that Omega contrasts against.',
            'Boutin et al., "Apollo: Scalable and Coordinated Scheduling for Cloud-Scale Computing," OSDI 2014 -- Microsoft\'s take on distributed scheduling with shared state.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Lock-Free Queue', 'CAS and optimistic concurrency are the same mechanism at data-structure scale'],
            ['Prerequisite', 'MVCC Internals & VACUUM', 'Snapshot isolation and version-based conflict detection are Omega\'s core mechanism borrowed from databases'],
            ['Companion', 'Borg Cluster Scheduler Case Study', 'The monolithic scheduler that Omega\'s research aimed to evolve'],
            ['Companion', 'Mesos Resource Manager Case Study', 'The two-level scheduling model in Omega\'s design-space comparison'],
            ['Extension', 'Kubernetes Admission Policy Gate', 'How Omega\'s shared-state model evolved into Kubernetes\' API server with resourceVersion'],
            ['Contrast', 'Bulkheads & Resource Isolation', 'Static partitioning -- the approach Omega argues against for flexibility'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain why a scheduler that reads version 5 and commits against version 7 will always fail?',
            'Can you trace a conflict through all four phases: snapshot, plan, commit-reject, retry?',
            'Can you name two conditions under which optimistic scheduling degrades to worse-than-monolithic performance?',
            'Can you describe how Kubernetes resourceVersion implements the same pattern as Omega cell-state versions?',
          ],
        },
      ],
    },
  ],
};

