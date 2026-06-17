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
    explanation: 'Work stealing is a scheduling data structure, not only a policy. It removes the central queue from the common path and pays synchronization mainly when idle workers need help.',
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
      heading: 'Problem',
      paragraphs: [
        'A parallel runtime has two jobs that pull against each other. It must keep every worker busy, but it must not make every worker fight over the same scheduling structure. Recursive and fork-join workloads make this hard. One worker can split a large problem into many child tasks while another worker reaches the end of its local work and goes idle.',
        'A work-stealing deque scheduler solves that balancing problem with a deliberately asymmetric data structure. Each worker owns a double-ended queue of ready tasks. The owner pushes and pops at the bottom. Idle workers, called thieves, steal from the top of some other worker deque. The common local path stays cheap, and the uncommon balancing path still exists when work becomes uneven.',
      ],
    },
    {
      heading: 'Naive schedulers',
      paragraphs: [
        'The simplest scheduler is one global ready queue. Any worker that creates a task pushes it into the queue. Any worker that needs work pops from the queue. This is easy to explain and can be correct, but it puts every task creation and task acquisition on the same shared object.',
        'Another simple scheduler is static partitioning. Split the input into one chunk per worker and let each worker run its chunk. This can be excellent for uniform arrays and regular loops because there is almost no scheduling overhead after the initial split.',
        'Both designs are useful baselines. The shared queue gives flexible balancing but creates contention. Static partitioning gives almost no contention but assumes the future cost of each chunk is known. Irregular recursive work violates that assumption.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A global queue becomes a serialization point. Even a lock-free queue still concentrates cache-line traffic and atomic operations in one place. When tasks are small, the queue can consume enough time that adding cores mostly adds contention.',
        'Static partitioning fails for skewed work. Parallel quicksort can split into uneven partitions. Tree search can find a dense subtree on one side and an empty subtree on another. Graph traversal can expose bursts of work that were not visible at the beginning. One worker can sit on a huge subtree while the rest of the machine waits.',
        'The scheduler needs local efficiency and global rescue. If a worker has plenty of local tasks, it should not pay for global coordination. If a worker is idle, it should be able to find old exposed work somewhere else.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to split the common case from the balancing case. The owner uses the bottom of its deque like a stack: it pushes new child tasks and pops the most recent task to continue depth-first. Thieves use the top, where older tasks often represent larger exposed subtrees. This keeps local work close to the data that created it while still publishing enough work for other cores.',
        'The data-structure contract is one owner and many thieves. Only the owner writes the bottom index. Thieves race on the top index with an atomic claim. Most operations touch different ends. The rare hard case is a deque with one item, because the owner pop and a thief steal can both try to take the same task. That is where synchronization must decide the winner.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A worker deque is usually represented by an array, a top index, and a bottom index. The owner pushes by writing a task at bottom and advancing bottom. The owner pops by moving bottom back and reading the newest task. When the deque has more than one task, this owner path can be very cheap because no other worker writes bottom.',
        'A thief chooses a victim, reads top and bottom, and tries to claim the oldest task at top. The claim uses compare-and-swap or an equivalent atomic operation on top. If the claim succeeds, the thief owns that task and executes it. If another thief wins first, the loser retries or picks another victim.',
        'The empty and one-item cases are where correctness lives. If top is at or beyond bottom, the deque is empty. If top and bottom identify the same last task, the owner and thief must not both take it. Correct algorithms make that last-task race explicit instead of hoping timing works out.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider parallel sum over a large array. Worker W0 starts with the whole range. It splits the range into left and right. W0 pushes the right half as a task at the bottom of its deque and continues with the left half locally. It splits again, pushes another right half, and keeps descending. This local depth-first behavior keeps W0 near the same array region and avoids unnecessary global scheduling.',
        'Worker W1 finishes its own work and becomes idle. It selects W0 as a victim and steals from the top. The task at the top is older than W0s newest child task, so it is likely to be a coarser range. W1 gets enough work to justify the steal. W0 keeps its newest child tasks near the bottom and continues without coordinating on a central queue.',
        'At a join point, a worker that waits for a child result can help the computation instead of simply blocking. Many fork-join runtimes let waiting workers execute other ready tasks, which keeps the pool productive while preserving the logical dependencies of the program.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The owner-bottom view highlights the asymmetry. The owner node points to the bottom because local push and pop happen there. The thief node points to the top because stealing is a separate path. The compare-and-swap node represents the atomic claim on top, not a general lock around the whole deque.',
        'The fork-join view shows why stealing old work matters. Fresh tasks near the bottom are often small and cache-local to the owner. Older tasks near the top are usually larger subtrees that were exposed earlier. A thief that takes old work is more likely to get a useful chunk instead of repeatedly stealing tiny leftovers.',
        'The tradeoff table contrasts the scheduler with a central queue. Work stealing is not magic fairness. It is a way to remove the central queue from the common path while paying synchronization when imbalance appears.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an ownership invariant. Tasks between top and bottom are published. Slots outside that range are not available. The owner is the only writer of bottom, so owner push and normal owner pop do not contend with another bottom writer. Thieves can only take tasks by moving top through an atomic claim.',
        'Two thieves cannot both steal the same task because only one atomic operation can move top from a particular old value to the next value. The owner cannot silently collide with a thief on the last task because the algorithm detects the one-item case and resolves it with synchronization.',
        'The performance argument follows from the same structure. Most operations in fork-join programs are local pushes and pops. Steals happen only when a worker has no local work. The scheduler therefore spends the expensive synchronization budget where it is buying something valuable: turning idle cores into useful cores.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Owner push and pop are O(1) in the normal case. A successful steal is also O(1), but it pays atomic synchronization, cache-line movement, victim selection, memory-ordering constraints, and sometimes retries. A dynamic circular deque may also resize when bursts fill the array, although geometric growth keeps that amortized.',
        'The biggest cost is implementation difficulty. Weak memory models matter. The order in which a task write becomes visible relative to bottom movement matters. The order in which a thief reads top, reads bottom, and claims top matters. A scheduler that looks obvious in sequential pseudocode can be wrong on real multicore hardware.',
        'There is also a policy cost. Random victim selection is simple, but it may ignore NUMA topology, affinity, priority, or fairness. Adding those concerns can improve production behavior while reducing the elegant simplicity of the basic algorithm.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Work stealing wins for fork-join and divide-and-conquer workloads: parallel quicksort, recursive matrix multiplication, ray tracing, tree search, game job systems, Cilk-style runtimes, Java ForkJoinPool-style runtimes, and irregular data-processing tasks. It is strongest when tasks are large enough to amortize stealing but small enough that the runtime can rebalance frequently.',
        'It also wins when locality matters. The owner tends to continue with recently spawned work, so it may keep parent data, stack context, and nearby memory hot. Thieves take older exposed work, which reduces stealing frequency and gives them independent subtrees.',
        'The pattern is a good teaching bridge between Double-Ended Queue and real schedulers. The same two-ended interface becomes a concurrency primitive once the owner and thief roles are restricted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A work-stealing deque is not a general concurrent deque. The proof depends on one owner and many thieves, with each role touching a specific end. If arbitrary workers push and pop both ends, the cheap path and correctness argument disappear.',
        'Blocking tasks can starve the pool. If every worker blocks on I/O or waits on external resources, there may be no active worker left to steal and finish the dependencies. Production runtimes often need compensation threads, parking logic, async integration, or rules that prevent blocking work from occupying scarce compute workers.',
        'Strict priority and fairness can also conflict with stealing. A thief stealing an old subtree is good for throughput, but it may not respect deadline order or tenant fairness. Long non-splittable tasks are another failure mode: if one worker owns a single huge task that cannot be divided, no deque policy can create parallelism inside it.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Double-Ended Queue for the base abstraction, Ring Buffer for circular-array storage, Lock-Free Queue for atomic ownership patterns, Compare-and-Swap style synchronization through concurrent data-structure topics, Web Workers for browser-side worker execution, Linux Fair Scheduler Run Queue for OS scheduling contrast, Ray Distributed Execution Case Study for distributed task placement, and parallel divide-and-conquer topics for workloads where fork-join scheduling becomes visible.',
      ],
    },
  ],
};
