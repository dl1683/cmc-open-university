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
    explanation: 'Virtual runtime is weighted. Lower-priority tasks accumulate virtual runtime faster for the same real CPU time, so they become less eligible for immediate service.',
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
    explanation: 'The modern kernel documentation frames EEVDF as the fair scheduling path with lag and virtual deadlines. The classic CFS rb-tree remains the simpler data-structure gateway to understand virtual service accounting.',
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
      heading: 'What it is',
      paragraphs: [
        'A fair CPU scheduler maintains runnable work, accounts for service already received, and picks a next task quickly. Classic Linux CFS taught the central data-structure idea with per-CPU run queues ordered by virtual runtime. Modern Linux fair scheduling uses EEVDF, adding eligibility and virtual deadlines to improve latency behavior while preserving fair service accounting.',
        'This page focuses on the run-queue mechanics: ordered runnable entities, weighted virtual time, eligibility, deadlines, and reinsertion after a task consumes CPU.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the CFS mental model, each runnable entity has a vruntime. Running increases vruntime according to task weight. The run queue can be represented as a time-ordered red-black tree, and the next task is the leftmost entity with the smallest vruntime.',
        'EEVDF adds lag and virtual deadlines. A task with nonnegative lag is owed service. Among eligible tasks, the scheduler picks the earliest virtual deadline. Shorter requested slices can improve latency, but ineligible tasks do not bypass fairness.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Suppose task C has the smallest vruntime but negative lag, while task A has positive lag and the earliest virtual deadline among eligible tasks. Classic CFS intuition might expect C to run next; EEVDF chooses A because C has already exceeded its fair share and A is both eligible and latency-urgent.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not describe CFS as the full current Linux scheduler behavior without qualification. The CFS rb-tree model is still the right historical and conceptual primer for vruntime accounting, but EEVDF is the modern fair-scheduler selection model documented by the kernel.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux CFS scheduler design at https://docs.kernel.org/scheduler/sched-design-CFS.html and Linux EEVDF scheduler docs at https://docs.kernel.org/scheduler/sched-eevdf.html. Study Red-Black Tree, Binary Heap, Queue, Work-Stealing Deque Scheduler, Backpressure & Flow Control, Borg Cluster Scheduler Case Study, and Omega Scheduler Case Study next.',
      ],
    },
  ],
};
