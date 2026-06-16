// Work-stealing deque scheduler: owners push/pop at the bottom, idle workers
// steal from the top, and parallel tasks spread without one central queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'work-stealing-deque-scheduler',
  title: 'Work-Stealing Deque Scheduler',
  category: 'Systems',
  summary: 'A fork-join runtime pattern: each worker owns a deque, works from the bottom, and idle workers steal older tasks from the top.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['owner bottom, thief top', 'fork-join case study'], defaultValue: 'owner bottom, thief top' },
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

function stealGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'w0', label: 'W0', x: 0.8, y: 4.0, note: notes.w0 ?? 'owner' },
      { id: 'top', label: 'top', x: 3.0, y: 1.8, note: notes.top ?? 'old' },
      { id: 't1', label: 'T1', x: 4.7, y: 1.8, note: notes.t1 ?? 'stealable' },
      { id: 't2', label: 'T2', x: 5.9, y: 3.2, note: notes.t2 ?? 'middle' },
      { id: 't3', label: 'T3', x: 7.1, y: 4.6, note: notes.t3 ?? 'fresh' },
      { id: 'bottom', label: 'bottom', x: 8.8, y: 4.6, note: notes.bottom ?? 'owner end' },
      { id: 'w1', label: 'W1', x: 3.0, y: 6.4, note: notes.w1 ?? 'thief' },
      { id: 'cas', label: 'CAS', x: 5.5, y: 6.4, note: notes.cas ?? 'top' },
      { id: 'run', label: 'run', x: 8.4, y: 6.4, note: notes.run ?? 'execute' },
    ],
    edges: [
      { id: 'e-w0-bottom', from: 'w0', to: 'bottom', weight: 'push/pop' },
      { id: 'e-top-t1', from: 'top', to: 't1', weight: '' },
      { id: 'e-t1-t2', from: 't1', to: 't2', weight: '' },
      { id: 'e-t2-t3', from: 't2', to: 't3', weight: '' },
      { id: 'e-t3-bottom', from: 't3', to: 'bottom', weight: '' },
      { id: 'e-w1-top', from: 'w1', to: 'top', weight: 'steal' },
      { id: 'e-w1-cas', from: 'w1', to: 'cas', weight: 'race' },
      { id: 'e-cas-t1', from: 'cas', to: 't1', weight: 'claim' },
      { id: 'e-cas-run', from: 'cas', to: 'run', weight: 'success' },
    ],
  }, { title });
}

function* ownerBottomThiefTop() {
  yield {
    state: stealGraph('A work-stealing deque has asymmetric ends'),
    highlight: { active: ['w0', 'bottom', 'top', 'w1'], found: ['t1', 't2', 't3'] },
    explanation: 'The owner worker treats its deque like a stack at the bottom: push new child tasks and pop recent tasks. Idle workers steal from the top, taking older tasks.',
    invariant: 'One owner writes the bottom; many thieves may race on the top.',
  };

  yield {
    state: stealGraph('The owner pushes fresh work at the bottom', { t3: 'new child', bottom: 'bottom+1', w0: 'spawn' }),
    highlight: { active: ['w0', 'bottom', 't3', 'e-w0-bottom'], compare: ['w1', 'top'] },
    explanation: 'Fresh child tasks stay near the owner. This tends to preserve cache locality because the spawning worker often has the parent data hot.',
  };

  yield {
    state: stealGraph('An idle worker steals the oldest task from the top', { t1: 'stolen', cas: 'top++', w1: 'idle', run: 'worker 1' }),
    highlight: { active: ['w1', 'top', 'cas', 't1', 'run', 'e-w1-top', 'e-cas-t1', 'e-cas-run'], compare: ['bottom'] },
    explanation: 'A thief uses an atomic compare-and-swap on the top index. If another thief wins first, this thief retries or chooses a different victim.',
  };

  yield {
    state: labelMatrix(
      'Why top and bottom are separated',
      [
        { id: 'local', label: 'owner pop' },
        { id: 'spawn', label: 'owner push' },
        { id: 'steal', label: 'thief steal' },
        { id: 'last', label: 'last item race' },
      ],
      [
        { id: 'end', label: 'end' },
        { id: 'sync', label: 'sync cost' },
      ],
      [
        ['bottom', 'cheap local path'],
        ['bottom', 'cheap local path'],
        ['top', 'CAS with thieves'],
        ['top/bottom meet', 'CAS decides owner vs thief'],
      ],
    ),
    highlight: { active: ['local:sync', 'steal:end'], found: ['last:sync'] },
    explanation: 'The design optimizes the common case: a worker mostly consumes its own tasks. Atomics concentrate at the stealing boundary and the rare one-element race.',
  };
}

function* forkJoinCaseStudy() {
  yield {
    state: labelMatrix(
      'Fork-join runtime behavior',
      [
        { id: 'split', label: 'split array' },
        { id: 'left', label: 'work left' },
        { id: 'right', label: 'spawn right' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'owner', label: 'owner action' },
        { id: 'thief', label: 'thief opportunity' },
      ],
      [
        ['divide range', 'none yet'],
        ['continue locally', 'old task exposed'],
        ['push child bottom', 'steal from top'],
        ['wait for child', 'help steal if idle'],
      ],
    ),
    highlight: { active: ['right:owner', 'right:thief'], found: ['join:thief'] },
    explanation: 'In divide-and-conquer work, the owner continues with one subproblem and publishes another. Work stealing spreads old exposed subtrees while preserving local depth-first execution.',
  };

  yield {
    state: stealGraph('Stealing older tasks gives coarse work to idle workers', { top: 'old subtree', t1: 'large', t2: 'medium', t3: 'small', run: 'parallel' }),
    highlight: { active: ['top', 't1', 'w1', 'cas', 'run'], compare: ['t3', 'bottom'] },
    explanation: 'Stealing from the top tends to take older, larger subtrees. That gives the thief enough work to amortize the steal and reduces chatter between workers.',
  };

  yield {
    state: labelMatrix(
      'Scheduler tradeoffs',
      [
        { id: 'central', label: 'central queue' },
        { id: 'worksteal', label: 'work stealing' },
        { id: 'affinity', label: 'affinity' },
        { id: 'blocking', label: 'blocking tasks' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple fairness', 'contention bottleneck'],
        ['scales locally', 'hard memory order'],
        ['cache locality', 'load imbalance'],
        ['easy to park', 'worker starvation'],
      ],
    ),
    highlight: { active: ['worksteal:strength', 'affinity:strength'], compare: ['central:risk', 'blocking:risk'] },
    explanation: 'Work stealing is a scheduling data structure, not only a policy. It trades one central queue for many owner-local deques and randomized stealing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'owner bottom, thief top') yield* ownerBottomThiefTop();
  else if (view === 'fork-join case study') yield* forkJoinCaseStudy();
  else throw new InputError('Pick a work-stealing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A work-stealing scheduler gives each worker a deque. The owner pushes and pops tasks at the bottom. Idle workers steal from the top of another worker deque. This makes local execution cheap while still balancing load when some workers run dry.',
        'The design is common in fork-join runtimes, parallel task schedulers, Java ForkJoinPool-style systems, Cilk-like schedulers, and many job systems in games and data processing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The owner side is optimized as a local stack. It pushes newly spawned tasks and pops recent tasks from the bottom. Thieves read the top and use CAS to claim the oldest available task. The race when only one task remains is the delicate case where owner pop and thief steal may collide.',
        'Chase-Lev-style deques use a circular array with top and bottom indices. The dynamic version can grow the circular array when it fills, preserving the owner-local fast path while supporting bursts of spawned work.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'For parallel quicksort, a worker partitions a range, continues with one side, and pushes the other side. If every worker has local tasks, no central queue is touched. If a worker becomes idle, it steals an older subrange from another worker and starts executing in parallel.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'A work-stealing deque is not a general concurrent deque. It depends on the one-owner, many-thieves contract. Weak memory models make the fence placement important, and blocking tasks can starve a worker pool unless the runtime compensates with parking, compensation threads, or async-aware scheduling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Dynamic Circular Work-Stealing Deque paper at https://www.dre.vanderbilt.edu/~schmidt/PDF/work-stealing-dequeue.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/1073970.1073974, and Correct and Efficient Work-Stealing for Weak Memory Models at https://fzn.fr/readings/ppopp13.pdf. Study Double-Ended Queue, Ring Buffer, Lock-Free Queue, Linux Fair Scheduler Run Queue, Web Workers, and Ray Distributed Execution Case Study next.',
      ],
    },
  ],
};
