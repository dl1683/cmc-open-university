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
    explanation: `The classic Completely Fair Scheduler model keeps runnable schedulable entities ordered by virtual runtime. The leftmost entity (${topic.title} node B at vr=18) has received the least weighted CPU service, so it is the next natural pick.`,
    invariant: `In the ${topic.title}, the run queue is ordered by fairness debt, not by arrival time.`,
  };

  yield {
    state: runqueueGraph('The leftmost task runs, then moves right', { left: 'B running', min: 'B', clock: '+slice', insert: 'vr=36', latency: 'others wait' }),
    highlight: { active: ['left', 'min', 'clock', 'insert', 'e-left-min', 'e-min-clock', 'e-clock-insert'], compare: ['mid', 'right'] },
    explanation: `After task B runs in this ${topic.title} view, its virtual runtime increases and it is reinserted at ${'vr=36'} — farther to the right — which lets another task become the leftmost candidate.`,
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
    explanation: `Virtual runtime is weighted service accounting. A ${'nice +5'} task accumulates virtual runtime faster than a ${'nice 0'} task for the same real CPU time, so priority changes fairness debt without abandoning the ordered run queue.`,
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
    explanation: `The ${topic.title} is not only a policy. It is a hot data-structure path: ${'enqueue'}, ${'dequeue'}, ${'pick next'}, migrate, and update clocks must be predictable under interrupt and wakeup pressure.`,
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
    explanation: `EEVDF first filters for tasks with nonnegative lag: tasks still owed service. Among eligible tasks, it chooses the earliest virtual deadline (A at ${'100.3'}, not C at ${'99.4'} which is ineligible), letting latency-sensitive shorter slices win without ignoring fairness.`,
    invariant: `In ${topic.title}, earliest deadline matters only after eligibility (${'lag>=0'}) is checked.`,
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
    explanation: `A task like C (${'vd=99.4'}) can have an early deadline but be ineligible because it has already received more than its fair share. EEVDF chooses A (${'vd=100.3'}) — the earliest virtual deadline among eligible tasks, not simply the smallest vruntime.`,
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
    explanation: `CFS picks by ${'smallest vruntime'} for approximate fair share. EEVDF keeps that ledger but adds eligibility and deadline choice (${'eligible + earliest VD'}), so latency-sensitive work can run sooner only when fairness debt allows it.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each row is a runnable task, meaning a task that can run on a CPU if selected. The run queue is the scheduler data structure holding those runnable tasks for one CPU. Highlights show which task is eligible, which task is selected, and how its accounting changes after it runs.',
        'Read vruntime as a service ledger and deadline as a scheduling target. A task with less service or an earlier eligible deadline has stronger claim to the CPU. The animation is about choosing from accounting state, not about simple arrival order.',
        {type: 'image', src: './assets/gifs/linux-fair-scheduler-runqueue-cfs-eevdf.gif', alt: 'Animated walkthrough of the linux fair scheduler runqueue cfs eevdf visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An operating system must share CPUs among runnable tasks. If one task runs forever, interactive work stalls. If every task gets equal wall-clock time regardless of weight, background and foreground policy cannot be expressed.',
        'Linux fair scheduling exists to approximate proportional sharing. A task with higher weight should receive more CPU over time, while sleeping and waking tasks should still get responsive treatment. The run queue stores the evidence needed to make that choice quickly.',
        {type: 'callout', text: 'A fair run queue is a service ledger: the next task is chosen from debt and deadline state, not from arrival order.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious scheduler is round robin. Put runnable tasks in a queue, run the front task for a time slice, then move it to the back. This is simple and prevents one task from owning the CPU forever.',
        'Round robin is reasonable when tasks are similar and policy is minimal. It fails when tasks have different weights, wakeup behavior, and latency needs. Equal turns do not mean fair service when some tasks should receive larger shares.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is accounting. The scheduler needs to know how much service each task has received relative to its weight. It also needs to choose quickly because scheduling happens often and on real CPUs with cache and interrupt costs.',
        'A simple FIFO queue cannot answer which task has the greatest service debt. A full scan can answer it but costs O(n) per scheduling decision. Linux needs ordered access to the next eligible task while tasks are inserted, removed, blocked, and woken.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CFS models fairness with virtual runtime, often called vruntime. Runtime charged to a task is scaled by weight, so a lower-priority task accumulates vruntime faster and loses claim sooner. The task with the smallest fair-service position has the strongest claim under CFS.',
        'EEVDF adds eligible virtual deadlines. A task becomes eligible based on lag, which is how far behind or ahead it is relative to fair service. Among eligible tasks, the scheduler can prefer the earlier virtual deadline, which improves latency control while preserving the service ledger.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Red-black_tree_example_with_sockets.svg/330px-Red-black_tree_example_with_sockets.svg.png', alt: 'Example red-black tree with red and black nodes', caption: 'A red-black tree keeps ordered lookup and update cost bounded, which is why it is a useful mental model for CFS run-queue ordering. Source: Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },    {
      heading: 'How it works',
      paragraphs: [
        'A task enters the fair run queue when it is runnable. The scheduler stores it in ordered structures keyed by scheduling accounting, historically vruntime for CFS and now also eligibility and deadline concepts for EEVDF. Blocking removes the task until it wakes again.',
        'When the CPU needs a task, the scheduler chooses a runnable entity that is eligible and has the best fair-deadline claim. After the task runs, its runtime is charged, its vruntime and related fields advance, and it is reinserted if it remains runnable.',
        'The red-black tree is the bounded-cost ordered storage. The policy is the accounting that decides which key matters. Keeping those separate prevents the common mistake of treating the tree as the scheduler.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with runnable and blocked transitions', caption: 'Runnable state is only one part of a process life cycle; the fair scheduler owns runnable entities, while blocking and wakeup paths decide when they reenter the run queue. Source: Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The fairness invariant is that a task that has received less weighted service gains stronger claim to run. Charging runtime after execution moves that task forward in the ledger, so it cannot stay the best choice forever. Other tasks become more competitive as service balances out.',
        'The ordered run queue makes the best candidate findable without scanning every runnable task. Insertions and removals preserve the ordering invariant. Eligibility and deadline checks add latency policy while still being grounded in measured service.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Run-queue insertion and removal are O(log n) for n runnable tasks in the ordered tree. Picking the leftmost or best tracked candidate is effectively O(1) when the structure caches the needed pointer, plus the policy checks around eligibility. Accounting updates are constant-time arithmetic per scheduling event.',
        'When runnable tasks double, tree update depth grows by about one level, not by a full scan. Memory is O(n) for task scheduling entities and tree links. The hidden cost is cache locality, locking, migration between CPUs, and the overhead of making decisions very frequently.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die with many compute regions', caption: 'Scheduler decisions are made on real cores with caches, interrupts, and locality costs; the ordered tree is only the policy data structure inside that hardware path. Source: Wikimedia Commons, KL and Intel, public domain.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design is used in Linux to schedule normal fair-class tasks on general-purpose machines. It fits workloads where many tasks compete for CPUs and the kernel needs proportional sharing, responsiveness, and bounded update cost. The access pattern is constant churn: wakeups, sleeps, preemption, and timer events.',
        'The same ideas appear outside kernels. Any service that shares a scarce resource can track service debt and choose the next eligible job from ordered state. CPU scheduling is the concrete system where the accounting is tied to hardware time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fair scheduling is not the right policy for every class of work. Real-time tasks need deadline or priority guarantees that normal fair sharing cannot provide. Batch jobs may prefer throughput over interactivity, and latency-sensitive tasks can still suffer when CPU, I/O, and lock contention interact.',
        'The accounting model is also only part of the system. CPU affinity, load balancing, NUMA placement, cgroup weights, interrupts, and cache warmth can dominate observed behavior. A neat run-queue choice can still be slow if it moves work to the wrong core.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose two runnable tasks A and B have equal weight. A has vruntime 30 and B has vruntime 45. Under the simple CFS view, A has received less weighted service, so A runs next.',
        'A runs for 6 milliseconds, so its vruntime advances to 36 in this equal-weight example. B remains at 45. A may still run again because it is still behind, but the gap shrank from 15 to 9.',
        'Now add task C with higher weight so that 6 milliseconds of real runtime charges only 3 units of vruntime. If C starts at 36 and runs for 6 milliseconds, it advances to 39. Weight changes behavior by changing how quickly service debt is repaid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Linux kernel scheduler documentation for CFS and EEVDF, plus the kernel source around fair scheduling for the implementation details. Study Molnar CFS design notes for the vruntime model and EEVDF papers or kernel notes for eligible virtual deadlines.',
        'Study next by layer. Red-black trees explain the ordered run queue. Priority queues explain selection structures. Operating-system process states explain runnable versus blocked tasks. Real-time scheduling explains why fair sharing is not enough for deadline-bound work.',
      ],
    },
  ],
};
