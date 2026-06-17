// Linux fair scheduler run queues: classic CFS vruntime trees and modern
// EEVDF virtual-deadline selection as data-structure lessons.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'linux-fair-scheduler-runqueue-cfs-eevdf',
  title: 'Linux Fair Scheduler Run Queue',
  category: 'Systems',
  summary: 'A CPU scheduler run-queue lesson: CFS orders runnable entities by virtual runtime, while EEVDF adds eligibility and virtual deadlines.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['vruntime tree', 'EEVDF deadline case study'], defaultValue: 'vruntime tree' },
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

function runqueueGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cpu', label: 'CPU0', x: 0.8, y: 4.0, note: notes.cpu ?? 'pick next' },
      { id: 'root', label: 'tree', x: 3.0, y: 4.0, note: notes.root ?? 'runq' },
      { id: 'left', label: 'B', x: 5.0, y: 2.1, note: notes.left ?? 'vr=18' },
      { id: 'mid', label: 'A', x: 5.0, y: 4.0, note: notes.mid ?? 'vr=30' },
      { id: 'right', label: 'C', x: 5.0, y: 5.9, note: notes.right ?? 'vr=44' },
      { id: 'min', label: 'pick', x: 7.4, y: 2.1, note: notes.min ?? 'next' },
      { id: 'clock', label: 'vtime', x: 7.4, y: 4.0, note: notes.clock ?? 'weighted' },
      { id: 'insert', label: 'insert', x: 7.4, y: 5.9, note: notes.insert ?? 'after slice' },
      { id: 'latency', label: 'wait', x: 9.2, y: 4.0, note: notes.latency ?? 'bounded' },
    ],
    edges: [
      { id: 'e-cpu-root', from: 'cpu', to: 'root', weight: '' },
      { id: 'e-root-left', from: 'root', to: 'left', weight: '<' },
      { id: 'e-root-mid', from: 'root', to: 'mid', weight: '=' },
      { id: 'e-root-right', from: 'root', to: 'right', weight: '>' },
      { id: 'e-left-min', from: 'left', to: 'min', weight: 'pick' },
      { id: 'e-min-clock', from: 'min', to: 'clock', weight: 'run' },
      { id: 'e-clock-insert', from: 'clock', to: 'insert', weight: '+vr' },
      { id: 'e-insert-root', from: 'insert', to: 'root', weight: 'logn' },
      { id: 'e-clock-latency', from: 'clock', to: 'latency', weight: '' },
    ],
  }, { title });
}

function* vruntimeTree() {
  yield {
    state: runqueueGraph('Classic CFS uses an ordered run queue by vruntime'),
    highlight: { active: ['root', 'left', 'mid', 'right'], found: ['min'] },
    explanation: 'The classic Completely Fair Scheduler model keeps runnable schedulable entities ordered by virtual runtime. The leftmost entity has received the least weighted CPU service, so it is the next natural pick.',
    invariant: 'The run queue is ordered by fairness debt, not by arrival time.',
  };

  yield {
    state: runqueueGraph('The leftmost task runs, then moves right', { left: 'B running', min: 'B', clock: '+slice', insert: 'vr=36', latency: 'others wait' }),
    highlight: { active: ['left', 'min', 'clock', 'insert', 'e-left-min', 'e-min-clock', 'e-clock-insert'], compare: ['mid', 'right'] },
    explanation: 'After task B runs, its virtual runtime increases. It is reinserted farther to the right, which lets another task become the leftmost candidate.',
  };

  yield {
    state: labelMatrix(
      'Weight changes virtual time',
      [
        { id: 'nice0', label: 'nice 0' },
        { id: 'nice5', label: 'nice +5' },
        { id: 'group', label: 'cgroup' },
      ],
      [
        { id: 'real', label: 'real CPU' },
        { id: 'vr', label: 'vruntime' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['1 ms', '+1 unit', 'baseline'],
        ['1 ms', '+more', 'falls behind sooner'],
        ['shared', 'weighted', 'group fairness'],
      ],
    ),
    highlight: { active: ['nice5:vr', 'group:effect'], compare: ['nice0:vr'] },
    explanation: 'Virtual runtime is weighted service accounting. Lower-priority tasks accumulate virtual runtime faster for the same real CPU time, so priority changes fairness debt without abandoning the ordered run queue.',
  };

  yield {
    state: labelMatrix(
      'Run-queue data structure duties',
      [
        { id: 'insert', label: 'enqueue' },
        { id: 'pick', label: 'pick next' },
        { id: 'remove', label: 'dequeue' },
        { id: 'rebalance', label: 'rebalance CPU' },
      ],
      [
        { id: 'data', label: 'data structure' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['ordered tree', 'O(log n) placement'],
        ['leftmost cache', 'fast scheduling tick'],
        ['tree delete', 'sleep/block exits'],
        ['per-CPU queues', 'load balance'],
      ],
    ),
    highlight: { active: ['pick:data', 'insert:why'], found: ['rebalance:data'] },
    explanation: 'The scheduler is not only a policy. It is a hot data-structure path: enqueue, dequeue, pick next, migrate, and update clocks must be predictable under interrupt and wakeup pressure.',
  };
}

function* eevdfDeadlineCaseStudy() {
  yield {
    state: labelMatrix(
      'EEVDF adds eligibility and virtual deadline',
      [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
        { id: 'D', label: 'D' },
      ],
      [
        { id: 'lag', label: 'lag' },
        { id: 'slice', label: 'slice' },
        { id: 'vd', label: 'vdeadline' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['positive', 'short', '100.3', 'eligible'],
        ['positive', 'normal', '101.9', 'eligible'],
        ['negative', 'short', '99.4', 'not eligible'],
        ['positive', 'long', '108.9', 'eligible'],
      ],
    ),
    highlight: { active: ['A:lag', 'A:vd', 'A:choice'], compare: ['C:choice', 'D:vd'] },
    explanation: 'EEVDF first filters for tasks with nonnegative lag: tasks still owed service. Among eligible tasks, it chooses the earliest virtual deadline, letting latency-sensitive shorter slices win without ignoring fairness.',
    invariant: 'Earliest deadline matters only after eligibility is checked.',
  };

  yield {
    state: runqueueGraph('EEVDF still carries fair-service state, but picks by deadline among eligible tasks', {
      left: 'C vd=99.4',
      mid: 'A vd=100.3',
      right: 'B vd=101.9',
      min: 'A wins',
      clock: 'lag>=0',
      insert: 'new VD',
      latency: 'short slice',
    }),
    highlight: { active: ['mid', 'min', 'clock', 'latency'], removed: ['left'], compare: ['right'] },
    explanation: 'A task can have an early deadline but be ineligible because it has already received more than its fair share. EEVDF chooses the earliest virtual deadline among eligible tasks, not simply the smallest vruntime.',
  };

  yield {
    state: labelMatrix(
      'CFS versus EEVDF mental model',
      [
        { id: 'cfs', label: 'classic CFS' },
        { id: 'eevdf', label: 'EEVDF' },
        { id: 'both', label: 'both' },
      ],
      [
        { id: 'key', label: 'selection key' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['smallest vruntime', 'approx fair share'],
        ['eligible + earliest VD', 'fairness plus latency'],
        ['virtual service accounting', 'bounded unfairness'],
      ],
    ),
    highlight: { active: ['eevdf:key', 'eevdf:goal'], compare: ['cfs:key'] },
    explanation: 'CFS teaches the ordered-service ledger. EEVDF keeps that ledger but adds eligibility and deadline choice, so latency-sensitive work can run sooner only when fairness debt allows it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'vruntime tree') yield* vruntimeTree();
  else if (view === 'EEVDF deadline case study') yield* eevdfDeadlineCaseStudy();
  else throw new InputError('Pick a scheduler view.');
}

export const article = {
  sections: [
    {
      heading: 'What a fair run queue solves',
      paragraphs: [
        'A CPU core can run one ordinary task at a time, but a general-purpose Linux system may have many runnable tasks. Some are CPU-bound builds. Some are interactive shells. Some are browser tabs, database workers, audio threads, background indexers, and container processes. The scheduler must decide who runs next, update accounting, handle wakeups, respect weights, avoid starvation, and do all of it on a path that runs constantly.',
        'The fair scheduler turns that policy problem into a data-structure problem. Classic CFS stores runnable scheduling entities in an ordered tree keyed by virtual runtime. The task that has received the least weighted CPU service is the natural next candidate. Modern EEVDF keeps fair-service accounting but adds eligibility and virtual deadlines. It can favor latency-sensitive work without allowing a task that already received too much CPU to jump the line.',
      ],
    },
    {
      heading: 'The simple schedulers',
      paragraphs: [
        'The first scheduler most people imagine is FIFO. Put runnable tasks in a queue, run the front task, then move to the next. That is easy, but it is not fair under mixed workloads. A CPU-bound task that arrived early can create bad latency for a task that just woke up to handle input. A task that blocks often may not get useful service at the right moment.',
        'Round-robin improves the picture. Give each task a time slice and rotate. When all tasks are equal, this avoids permanent starvation and is easy to reason about. Priorities add another layer: higher-priority tasks receive more service or shorter waits. But these simple queues still do not maintain a precise ledger of weighted CPU service already received. They know order and priority. They do not know fair debt well enough.',
      ],
    },
    {
      heading: 'The fairness ledger',
      paragraphs: [
        'Fairness is not arrival order. It is service relative to weight. A task with a larger weight should receive a larger share of CPU over time. A task with a smaller weight should still make progress, but its virtual service accounting should move faster for the same real CPU time. That is the purpose of virtual runtime: it converts real execution time into weighted service time.',
        'In the classic CFS model, a task that runs accumulates vruntime. A lower-weight task accumulates vruntime faster than a normal task for the same real milliseconds, so it moves away from the left side of the ordered tree sooner. A task that waits while others run does not accumulate service, so it becomes relatively more deserving. Repeatedly picking the smallest vruntime pulls tasks toward their fair share.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core CFS insight is to store runnable work in virtual time. The run queue is not a plain FIFO list. It is an ordered set where the left side represents entities that have received less weighted service. Picking from the left gives a local rule that approximates a global fair-sharing goal. After the task runs, its vruntime advances and it is reinserted at a new position.',
        'EEVDF adds a second insight: latency preference should be guarded by eligibility. Each entity has lag, meaning how far it is ahead or behind its fair service. An entity with nonnegative lag is owed service and is eligible. Among eligible entities, EEVDF chooses the earliest virtual deadline. A short slice can therefore help an interactive task run sooner, but only if the fairness ledger says the task is eligible.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The vruntime-tree view shows why a balanced ordered structure is useful. The leftmost task is not first by arrival time. It is first by the fair-service ledger. When that task runs, its virtual runtime increases and it moves right. The next pick changes because the accounting changed. This is the scheduler as a constantly updated ordered map.',
        'The EEVDF view adds the part that a plain tree diagram can hide. The earliest virtual deadline is not enough by itself. A task with an early deadline but negative lag has already received too much service, so it is not eligible. The highlighted choice is the eligible entity with the earliest deadline. That distinction prevents deadline policy from breaking fairness.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Linux scheduling is per-CPU at the hot path. Each CPU has run queues for scheduling classes. This topic focuses on the fair class, which schedules normal tasks and groups. In the classic CFS explanation, runnable entities are stored in a red-black tree ordered by vruntime. The scheduler keeps quick access to the leftmost node so picking the next entity is cheap. Enqueue, dequeue, and reinsertion update the tree in O(log n).',
        'When a task runs, the scheduler updates execution time and converts it into vruntime using weight. nice values and cgroup weights change the slope. A higher-weight task advances more slowly in virtual time for the same real CPU, which lets it receive a larger share. A lower-weight task advances faster, which lowers its share without banning it from the CPU.',
        'EEVDF keeps the idea that fair service is the governing ledger. It adds lag and virtual deadline. Eligibility comes from lag: an entity that is owed service can compete. The virtual deadline includes the requested or assigned slice in virtual time, so shorter slices can express latency sensitivity. The pick is earliest deadline among eligible entities. After execution, accounting changes, deadlines are updated, and the entity may be requeued or blocked.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The CFS invariant is local but powerful: running consumes fair-service credit. If a task has run less than its peers after weights are considered, it tends to sit left. If it runs now, it moves right. This creates a feedback loop. The more service a task receives, the less urgent it becomes relative to tasks that waited. The tree is simply the data structure that makes this comparison fast.',
        'EEVDF works because it separates two questions. First, is this entity owed service? That is eligibility through lag. Second, among entities owed service, which one has the most urgent virtual deadline? That is the latency choice. The split matters because deadline scheduling without a fairness gate can let short-deadline work dominate. Fairness without deadline choice can be less responsive than necessary for short interactive bursts.',
        'The model also composes with groups. A scheduling entity can represent a task or a group, and group scheduling applies weighted service at multiple levels. This is how cgroups can divide CPU among containers or services while still scheduling individual runnable tasks inside those groups.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose three equal-weight tasks are runnable. A has vruntime 30, B has 18, and C has 44. Classic CFS picks B because B has the smallest vruntime. B runs for a slice and its vruntime rises to 36. When B is reinserted, A at 30 may become the leftmost task. Nobody had to remember arrival order. The tree order is the service ledger.',
        'Now add weights. If B has lower priority, the same real 1 ms of CPU might add more than 1 unit of virtual runtime. B moves right faster and receives a smaller long-term share. If A belongs to a cgroup with a larger weight, its virtual time advances more slowly through the group accounting path, and the group receives more share across time.',
        'For EEVDF, suppose C has the earliest virtual deadline but negative lag. It is ahead of fair service, so it is not eligible. A and B both have positive lag, and A has the earlier virtual deadline. A runs. This is the key example: earliest deadline is not the whole rule. Eligibility filters out work that would violate the fair-service ledger.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The obvious data-structure cost is O(log n) for ordered-tree updates. In scheduler code, that is only the start. The hot path also pays for time accounting, wakeup placement, preemption decisions, cgroup hierarchy updates, load tracking, and sometimes migration. The scheduler runs under tight latency constraints, so constants and cache locality matter.',
        'Per-CPU run queues avoid a single global lock and preserve locality. They also create a balancing problem. One CPU may be overloaded while another is idle. Moving a task can improve load balance but lose cache warmth or cross NUMA boundaries. A simple global fair queue would be easier to explain but too expensive and locality-blind for real machines.',
        'EEVDF adds more policy state. Lag and virtual deadlines give better latency control, but they also require careful accounting and tuning. The model has to handle sleepers, wakeups, slice requests, task groups, and preemption without letting clever behavior turn into unfair advantage. Scheduler design is always a trade between a clean fairness model and messy workload behavior.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The fair scheduler is built for normal multi-user, multi-process systems. It works well when unrelated tasks share cores and the operating system must provide decent latency without giving up long-term fairness. It explains why an interactive task that slept can get service quickly after waking, why a CPU-bound task does not permanently dominate, and why weights can shape CPU share without a separate queue for every priority.',
        'It is also the right mental gateway to many other schedulers. A JavaScript event loop, a work-stealing runtime, a GPU serving queue, and a cluster scheduler all need state that proves what should run next. Linux fair scheduling teaches the central move: do not pick only by arrival. Pick by a ledger that encodes the resource contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fair scheduling is not hard real-time scheduling. It improves responsiveness for normal tasks, but it does not promise an exact deadline. Interrupts, kernel locks, disabled preemption regions, CPU isolation, thermal throttling, higher-priority scheduling classes, and hardware behavior can all affect when code actually runs. For hard timing guarantees, study real-time classes and admission control.',
        'The model also hides locality. A task can be most deserving by fairness accounting and still be expensive to move to another CPU. It may have hot cache lines, NUMA-local memory, or lock relationships with other tasks. The scheduler must balance fair service against locality and load balance. A pure tree model does not show that full decision.',
        'Another failure is priority inversion or blocking outside the CPU. A task can be eligible to run but blocked on a lock held by a lower-priority task, waiting on I/O, or stuck behind memory pressure. The CPU scheduler controls runnable entities. It cannot by itself fix every wait in the system.',
      ],
    },
    {
      heading: 'Misconceptions',
      paragraphs: [
        'Do not say CFS is just round-robin with a tree. The tree key is weighted service, not queue position. Do not say EEVDF is only earliest-deadline-first. Eligibility is the gate that keeps deadlines inside fairness. Do not say a lower nice value means a task always runs first. Weight changes long-term share and virtual time slope; it does not erase every other scheduler rule.',
        'Do not treat O(log n) as the whole scheduler cost. The scheduler is a hot systems path where wakeups, accounting, preemption, migrations, cgroups, cache locality, and hardware topology matter. Big-O explains the ordered set, not the whole kernel behavior.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux CFS scheduler design at https://docs.kernel.org/scheduler/sched-design-CFS.html and Linux EEVDF scheduler docs at https://docs.kernel.org/scheduler/sched-eevdf.html.',
        'Study Red-Black Tree for the ordered run queue, Binary Heap for an alternative priority structure, Queue for round-robin intuition, Work-Stealing Deque Scheduler for runtime-local scheduling, Futex Wait Queue Case Study for sleep and wake mechanics, Backpressure & Flow Control for capacity gates, Borg Cluster Scheduler Case Study and Omega Scheduler Case Study for distributed scheduling, and Kubernetes Scheduler PriorityQueue Preemption for a cluster-level priority queue with policy.',
      ],
    },
  ],
};
