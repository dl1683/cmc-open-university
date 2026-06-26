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
  const numTasks = 3;
  const ownerEnd = 'bottom';
  const thiefEnd = 'top';
  const graphNodeCount = 9;

  yield {
    state: stealGraph('A work-stealing deque has asymmetric ends'),
    highlight: { active: ['w0', 'bottom', 'top', 'w1'], found: ['t1', 't2', 't3'] },
    explanation: `The owner worker treats its deque like a stack at the ${ownerEnd}: push new child tasks and pop recent tasks. Idle workers steal from the ${thiefEnd}, taking older tasks. ${numTasks} tasks sit between top and bottom in this snapshot.`,
    invariant: `One owner writes the ${ownerEnd}; many thieves may race on the ${thiefEnd}.`,
  };

  yield {
    state: stealGraph('The owner pushes fresh work at the bottom', { t3: 'new child', bottom: 'bottom+1', w0: 'spawn' }),
    highlight: { active: ['w0', 'bottom', 't3', 'e-w0-bottom'], compare: ['w1', 'top'] },
    explanation: `Fresh child tasks stay near the owner at the ${ownerEnd}. This tends to preserve cache locality because the spawning worker often has the parent data hot.`,
  };

  yield {
    state: stealGraph('An idle worker steals the oldest task from the top', { t1: 'stolen', cas: 'top++', w1: 'idle', run: 'worker 1' }),
    highlight: { active: ['w1', 'top', 'cas', 't1', 'run', 'e-w1-top', 'e-cas-t1', 'e-cas-run'], compare: ['bottom'] },
    explanation: `A thief uses an atomic compare-and-swap on the ${thiefEnd} index. If another thief wins first, this thief retries or chooses a different victim. The graph has ${graphNodeCount} nodes tracking the full steal path.`,
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
    explanation: `The design optimizes the common case: a worker mostly consumes its own tasks at the ${ownerEnd}. Atomics concentrate at the stealing boundary (the ${thiefEnd}) and the rare one-element race.`,
  };
}

function* forkJoinCaseStudy() {
  const strategies = 4;
  const forkJoinPhases = 4;

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
    explanation: `In divide-and-conquer work, the owner continues with one subproblem and publishes another. The ${forkJoinPhases}-phase fork-join cycle (split, work left, spawn right, join) spreads old exposed subtrees while preserving local depth-first execution.`,
  };

  yield {
    state: stealGraph('Stealing older tasks gives coarse work to idle workers', { top: 'old subtree', t1: 'large', t2: 'medium', t3: 'small', run: 'parallel' }),
    highlight: { active: ['top', 't1', 'w1', 'cas', 'run'], compare: ['t3', 'bottom'] },
    explanation: `Stealing from the top tends to take older, larger subtrees -- the graph labels them from 'large' to 'small' across ${strategies - 1} task nodes. That gives the thief enough work to amortize the steal and reduces chatter between workers.`,
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
    explanation: `Work stealing is a scheduling data structure, not only a policy. The matrix compares ${strategies} scheduler strategies: it removes the central queue from the common path and pays synchronization mainly when idle workers need help.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each worker as owning a double-ended queue, or deque. The owner pushes and pops at the bottom, while idle workers steal from the top. Active highlights show the operation in progress, and found highlights show tasks currently available.',
        {type: 'callout', text: 'Work stealing makes imbalance lazy: local work stays cheap, and only idle workers pay the synchronization cost to steal older exposed tasks.'},
        {type: 'image', src: './assets/gifs/work-stealing-deque-scheduler.gif', alt: 'Animated walkthrough of the work stealing deque scheduler visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is end ownership. Bottom is cheap because only the owner normally mutates it. Top is contested because thieves race there, so synchronization is concentrated on stealing and on the last remaining task.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A parallel runtime must keep cores busy without turning the scheduler itself into the bottleneck. Fork-join programs create uneven work: one worker may split a problem into many children while another worker becomes idle.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die showing compute regions', caption: 'Work stealing exists because many cores need enough ready work without turning scheduling into one shared bottleneck. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'Work stealing exists so busy workers run locally and idle workers repair imbalance only when needed. That keeps the common path cheap and makes load balancing a demand-driven operation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one global work queue. Every worker pushes new tasks into it and pops tasks from it. This is simple and balances load at small scale.',
        'Another obvious approach is static partitioning. Give each worker a fixed part of the problem and avoid scheduling overhead. That works only when every part takes about the same time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The global queue wall is contention. If 16 cores push and pop through one lock or one hot atomic variable, the queue becomes the serialized center of the program. More cores can make throughput worse.',
        'The static partition wall is imbalance. Recursive or irregular tasks do not divide evenly. One worker can finish early while another still owns a large subtree, wasting available cores.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give each worker a local deque and make stealing rare. The owner works depth-first on its newest tasks at the bottom, which tends to preserve stack and cache locality. Thieves take older tasks from the top, which are usually larger independent subtrees.',
        'This asymmetry is the core design. Local push and pop are optimized for the owner. Cross-worker synchronization appears only when a worker has no local work and must steal.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a task forks, the worker usually continues with one child and pushes another child onto its deque. If the worker later needs more local work, it pops from the bottom. If another worker becomes idle, it picks a victim and tries to steal from the victim top using an atomic compare-and-swap.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'CPU cache hierarchy diagram', caption: 'The local-owner path matters because hot stack frames and task data tend to stay near the worker that produced them. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'The tricky case is a deque with one task. The owner may pop it from the bottom while a thief steals it from the top. The atomic operation decides who owns that last task so it cannot run twice.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on exclusive task ownership. A task is either private to the owner while being executed, present in exactly one deque, or successfully removed by exactly one pop or steal. The compare-and-swap on contested top movement preserves that invariant.',
        'Progress comes from the fact that idle workers search for exposed work instead of waiting for a central dispatcher. For fork-join computations, stealing older tasks gives thieves large chunks, so the number of steals stays small relative to local work.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Local push and pop are O(1) and usually touch owner-local memory. A successful steal is also O(1), but it pays atomics, cache-coherence traffic, and possible victim-selection retries. Doubling worker count helps only while enough parallel work exists to amortize those steals.',
        'The space cost is one deque per worker plus queued task frames. The behavioral cost is granularity: tasks that are too small spend more time scheduling than computing, while tasks that are too large expose too little stealable work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Work stealing powers fork-join runtimes such as Cilk, Java ForkJoinPool, Intel oneTBB, task systems in game engines, and many async runtimes. It fits recursive divide-and-conquer, tree search, parallel graph exploration, ray tracing, and irregular pipelines.',
        'The access pattern is local work with occasional imbalance. If every worker usually has enough local work, the runtime avoids central contention. If one worker gets a large subtree, idle workers can steal enough to keep the machine occupied.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Work stealing fails when tasks block on I/O or locks while occupying worker slots. A blocked worker looks busy even though it is not making CPU progress, so specialized runtimes need compensation mechanisms or separate blocking pools.',
        'It also fails with poor task granularity, strict priorities, or strong locality constraints. Random stealing can cross NUMA boundaries, break cache affinity, or ignore priority unless the production scheduler adds policy layers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume four workers and eight recursive tasks, each taking 10 ms, but worker 0 initially owns all tasks. Without stealing, worker 0 runs for 80 ms while the other three workers are idle. With stealing, workers 1, 2, and 3 each steal an older task and begin running in parallel.',
        'If each steal costs 0.1 ms, three steals cost 0.3 ms and save roughly 60 ms of idle core time. If the tasks took only 0.05 ms each, the same steal cost would dominate, which is why task size matters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Blumofe and Leiserson, Scheduling Multithreaded Computations by Work Stealing, at https://supertech.csail.mit.edu/papers/steal.pdf. For engineering context, read Java ForkJoinPool documentation and Cilk runtime papers.',
        'Study Deque, Compare-and-Swap, Fork-Join Parallelism, Thread Pools, Async Runtime Scheduling, and NUMA Locality next. The key idea is that load balance should not make local work expensive.',
      ],
    },
  ],
};
