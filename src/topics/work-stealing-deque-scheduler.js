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
        'The owner-bottom view shows a single worker deque with asymmetric ends. Active highlights mark the current operation: owner push, owner pop, or thief steal. Found highlights mark tasks sitting in the deque between top and bottom. Compare highlights mark the idle thief and the atomic CAS node that guards the steal path.',
        {type: 'callout', text: 'Work stealing makes imbalance lazy: local work stays cheap, and only idle workers pay the synchronization cost to steal older exposed tasks.'},
        'Watch the two indices. Bottom moves when the owner pushes or pops. Top moves when a thief successfully steals. The gap between top and bottom is the number of stealable tasks. When the gap reaches one, the owner and thief race for the last item -- that is where the synchronization cost concentrates.',
        'The fork-join view shows how recursive divide-and-conquer exposes work. The owner continues locally with one subproblem and publishes the other at the bottom. Older tasks drift toward the top and become steal targets. The tradeoff matrix at the end contrasts work stealing against a central queue, static affinity, and blocking-task schedulers.',
      
        {type: 'image', src: './assets/gifs/work-stealing-deque-scheduler.gif', alt: 'Animated walkthrough of the work stealing deque scheduler visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A parallel runtime must keep every core busy without making every core fight over a single shared structure. Fork-join programs make this hard: one worker can split a problem into dozens of children while another worker sits idle with nothing to do. The scheduler must balance load, but the common case -- a worker consuming its own children -- should cost almost nothing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die showing compute regions', caption: 'Work stealing exists because many cores need enough ready work without turning scheduling into one shared bottleneck. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        {
          type: 'quote',
          text: 'The space used by the Cilk scheduler is at most S1 * P, where S1 is the stack space used by a one-processor execution and P is the number of processors. Work stealing achieves space efficiency because each processor executes a depth-first computation, using stack space proportional to the serial execution.',
          attribution: 'Blumofe & Leiserson, "Scheduling Multithreaded Computations by Work Stealing," 1999',
        },
        'Blumofe and Leiserson designed the Cilk scheduler around this insight: if each worker runs depth-first locally, the total memory across all workers stays bounded by the serial stack times the number of processors. Work stealing is not just a load-balancing trick. It is a space-efficient scheduling discipline.',
        'The idea has become the default for fork-join runtimes. Java ForkJoinPool (Doug Lea, 2000-present), Intel TBB, Cilk Plus, Rust Tokio, and Go goroutine scheduling all use variants of the work-stealing deque. The deque is the data structure that makes the policy possible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest scheduler is one global ready queue. Any worker that spawns a task pushes it into the queue. Any worker that needs work pops from the queue. Correctness is straightforward: the queue serializes all scheduling decisions, so no task is lost or duplicated.',
        'A second obvious approach is static partitioning. Split the input into P chunks, one per worker, and let each worker run its chunk. This eliminates scheduling overhead almost entirely and works well when every chunk takes roughly the same time.',
        {
          type: 'table',
          headers: ['Strategy', 'Balancing', 'Contention', 'Locality', 'Irregular work'],
          rows: [
            ['Centralized queue', 'Automatic', 'High -- every spawn and acquire hits one lock', 'Poor -- tasks migrate freely', 'Handles it, but bottlenecks'],
            ['Work sharing (push to others)', 'Eager', 'Moderate -- migrations on every spawn', 'Poor -- tasks leave before running', 'Handles it, but wastes bandwidth'],
            ['Static partitioning', 'None after split', 'None', 'Excellent', 'Fails on skew'],
            ['Random assignment', 'Probabilistic', 'Low', 'None', 'Depends on luck'],
            ['Work stealing (pull when idle)', 'Lazy -- only on imbalance', 'Low -- steals are rare', 'Good -- owner keeps recent work', 'Handles it efficiently'],
          ],
        },
        'Both the global queue and static partitioning are useful baselines. The global queue gives flexible balancing but forces every operation through a shared bottleneck. Static partitioning gives zero contention but assumes the cost of each chunk is known in advance. Irregular recursive work violates that assumption.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A global queue becomes a serialization point. Even a lock-free queue concentrates cache-line traffic and atomic operations in one place. When tasks are fine-grained -- microseconds each -- the queue overhead can dominate. Adding cores mostly adds contention, and throughput plateaus or drops.',
        'Static partitioning fails for skewed work. Parallel quicksort can split 90/10. Tree search can find a dense subtree on one side and nothing on the other. Graph traversal can expose bursts of work that were invisible at the start. One worker sits on a huge subtree while the rest of the machine idles.',
        'Work sharing (pushing tasks to other workers at spawn time) avoids the global queue but introduces the opposite problem: tasks migrate before they run, destroying locality, and every spawn pays migration cost even when the spawning worker could have executed the task locally. The common case -- a worker consuming its own children -- should not pay for the uncommon case of imbalance.',
        'The scheduler needs local efficiency and global rescue. When a worker has local tasks, it should run them without coordination. When a worker is idle, it should be able to find exposed work somewhere else. The challenge is building a data structure where the common path is cheap and the rescue path is correct.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each worker owns a double-ended queue (deque) of ready tasks, represented by a circular array, a top index, and a bottom index. The owner treats the bottom like a stack: push new child tasks there, pop the most recent task to continue depth-first. Thieves (idle workers) steal from the top, where older and typically larger tasks sit.',
        {
          type: 'diagram',
          label: 'Deque operations: owner at bottom, thieves at top',
          text: [
            '                  top                          bottom',
            '                   |                              |',
            '                   v                              v',
            '  +------+------+------+------+------+------+------+',
            '  |      |      |  T1  |  T2  |  T3  |  T4  |      |',
            '  +------+------+------+------+------+------+------+',
            '                   ^                         ^',
            '                   |                         |',
            '              thief steals            owner pushes',
            '              (CAS on top)            and pops here',
            '                                     (no CAS needed',
            '                                      when size > 1)',
          ].join('\n'),
        },
        'The owner pushes by writing a task at array[bottom] and incrementing bottom. The owner pops by decrementing bottom and reading the task. When the deque has more than one item, this path requires no atomic operations on the fast side -- no other worker writes bottom. The Chase-Lev deque (2005) refined this into a practical lock-free algorithm with a growable circular array.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Chase-Lev work-stealing deque (simplified)',
            '// Owner operations -- only one thread calls these',
            'function push(deque, task) {',
            '  let b = deque.bottom;',
            '  deque.array[b % deque.array.length] = task;',
            '  // Store fence: task write must be visible before bottom moves',
            '  storeFence();',
            '  deque.bottom = b + 1;',
            '}',
            '',
            'function pop(deque) {',
            '  let b = deque.bottom - 1;',
            '  deque.bottom = b;',
            '  // Full fence: bottom write must be visible before reading top',
            '  fullFence();',
            '  let t = deque.top;',
            '  if (t <= b) {',
            '    let task = deque.array[b % deque.array.length];',
            '    if (t === b) {',
            '      // Last item -- race with thieves',
            '      if (!CAS(deque, "top", t, t + 1)) {',
            '        deque.bottom = t + 1; // thief won, deque is empty',
            '        return null;',
            '      }',
            '      deque.bottom = t + 1;',
            '    }',
            '    return task;',
            '  }',
            '  deque.bottom = t; // deque was empty',
            '  return null;',
            '}',
            '',
            '// Thief operation -- any idle worker calls this',
            'function steal(deque) {',
            '  let t = deque.top;',
            '  // Load fence: read top before reading bottom',
            '  loadFence();',
            '  let b = deque.bottom;',
            '  if (t < b) {',
            '    let task = deque.array[t % deque.array.length];',
            '    if (!CAS(deque, "top", t, t + 1)) {',
            '      return null; // another thief won; retry or pick new victim',
            '    }',
            '    return task;',
            '  }',
            '  return null; // deque is empty',
            '}',
          ].join('\n'),
        },
        'A thief picks a random victim, reads top and bottom, and tries to claim the oldest task by advancing top with compare-and-swap (CAS). If another thief wins, the loser retries or picks a different victim. The CAS ensures exactly one thief takes each task.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on an ownership invariant. Tasks between top and bottom are published and available. The owner is the sole writer of bottom, so owner push and owner pop (in the common multi-item case) do not contend with any other writer. Thieves can only take tasks by atomically advancing top via CAS.',
        'Two thieves cannot both steal the same task. CAS on top is linearizable: exactly one CAS from value t to t+1 succeeds, and the loser sees the updated value. The owner cannot silently collide with a thief on the last item because pop detects the one-item case (t == b) and uses its own CAS on top to resolve the race. If the thief wins, the owner sees the CAS fail and treats the deque as empty.',
        {
          type: 'note',
          text: 'Memory ordering is where implementations break. The owner must ensure the task write at array[b] is visible before bottom advances (store fence in push). In pop, the bottom write must be visible before reading top (full fence). In steal, top must be read before bottom (load fence). On x86, the strong memory model provides some of these for free. On ARM or RISC-V, every fence must be explicit. The THE protocol (Test, Halt, Execute) -- named by Frigo, Leiserson, and Randall in the 1998 Cilk-5 paper -- codifies these ordering requirements into a formal handshake between owner and thief.',
        },
        'The performance argument follows from the asymmetry. In fork-join programs, most operations are local pushes and pops -- the owner consuming its own children. Steals happen only when a worker exhausts its local work. The scheduler spends expensive synchronization only where it buys something valuable: turning an idle core into a productive one. Blumofe and Leiserson proved that a work-stealing scheduler using P processors achieves expected time T1/P + O(T_inf), where T1 is the serial work and T_inf is the critical-path length. The O(T_inf) term covers the total stealing overhead.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Owner push and pop are O(1) and, in the common case (deque size > 1), require no atomic operations. A successful steal is O(1) but pays CAS, cache-line transfer from the victim, and victim-selection cost. A failed steal (empty victim or lost CAS race) costs a retry. The circular array may resize when bursts fill it, but geometric growth keeps resizing amortized O(1).',
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Sync cost', 'When it happens'],
          rows: [
            ['push (owner)', 'O(1)', 'Store fence only', 'Every spawn'],
            ['pop (owner, size > 1)', 'O(1)', 'Full fence, no CAS', 'Every local task resume'],
            ['pop (owner, last item)', 'O(1)', 'Full fence + CAS', 'Rare -- deque nearly empty'],
            ['steal (success)', 'O(1)', 'Load fence + CAS + cache-line transfer', 'When thief is idle'],
            ['steal (fail)', 'O(1)', 'Load fence + failed CAS', 'Contention or empty victim'],
            ['resize', 'O(n) amortized O(1)', 'Owner only, no CAS', 'Rare -- burst fills array'],
          ],
        },
        'The hidden cost is implementation difficulty. Weak memory models (ARM, RISC-V) require explicit fences at every ordering point. The fence placement is non-obvious: the original Arora-Blumofe-Plaxton (1998) algorithm had a subtle bug discovered years later. The Chase-Lev refinement (2005) and the Le-Pop-Cohen-Nardelli correctness proof (2013) are the modern references. Getting this right without formal verification is genuinely hard.',
        'There is also a policy cost. Random victim selection is simple and provably efficient in expectation, but it ignores NUMA topology, cache affinity, and priority. Production schedulers layer heuristics on top: Java ForkJoinPool uses a mix of random stealing and signal-based wakeup; Go uses a combination of local run queues, global queue fallback, and network-poller integration; Tokio uses a notify-based protocol to avoid unnecessary spinning.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Work stealing dominates for fork-join and divide-and-conquer workloads: parallel mergesort, recursive matrix multiply, ray tracing, game-engine job graphs, tree search, and irregular data-parallel pipelines. It is strongest when tasks are large enough to amortize the steal cost but small enough that the runtime can rebalance frequently.',
        'It wins on locality. The owner continues depth-first with its newest child, keeping parent data, stack context, and nearby memory hot. Thieves take older tasks -- typically coarser subtrees -- which gives them independent work and reduces stealing frequency. This depth-first-owner, breadth-first-thief duality is the key insight that separates work stealing from work sharing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'CPU cache hierarchy diagram', caption: 'The local-owner path matters because hot stack frames and task data tend to stay near the worker that produced them. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        {
          type: 'bullets',
          items: [
            'Cilk/Cilk Plus: the original research runtime; proved the space and time bounds.',
            'Java ForkJoinPool (Doug Lea): powers parallel streams, CompletableFuture, and structured concurrency in the JVM. Each ForkJoinWorkerThread owns a work-stealing deque.',
            'Go runtime: each P (processor) has a local run queue (a bounded ring buffer). When empty, a P steals half the tasks from another P. The global run queue is a fallback, not the primary path.',
            'Intel TBB / oneTBB: work-stealing task scheduler for C++ parallel algorithms.',
            'Rust Tokio: async task scheduler uses work-stealing across a fixed thread pool.',
            'Apple GCD (Grand Central Dispatch): uses work-stealing internally for concurrent dispatch queues.',
          ],
        },
        'The pattern is also a teaching bridge. The same double-ended queue abstraction that appears in BFS and sliding-window problems becomes a concurrency primitive once the owner and thief roles restrict access to opposite ends.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A work-stealing deque is not a general concurrent deque. The correctness proof depends on one owner and many thieves, each touching a specific end. If arbitrary threads push and pop from both ends, the cheap owner path and the safety argument both disappear.',
        'Blocking tasks can starve the pool. If every worker blocks on I/O or external resources, no active worker remains to steal and complete dependencies. Java ForkJoinPool mitigates this with ManagedBlocker, which spawns compensation threads when a worker blocks. Go mitigates it by growing the thread count when goroutines block in system calls. Neither solution is free.',
        'Strict priority and fairness conflict with stealing. A thief stealing an old subtree optimizes throughput but may violate deadline order or tenant fairness. Long non-splittable tasks are another failure mode: if one worker owns a single huge task that cannot be subdivided, no deque policy can create parallelism inside it. The scheduler can only balance work that has been decomposed.',
        'NUMA-unaware stealing can hurt. Stealing from a remote NUMA node pulls the task and its data across an interconnect. On large multi-socket machines, random victim selection can cause enough remote memory traffic to negate the parallelism benefit. Production schedulers add NUMA-aware victim selection, but this complicates the elegant simplicity of the basic algorithm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Blumofe & Leiserson, "Scheduling Multithreaded Computations by Work Stealing," Journal of the ACM 46(5), 1999. The foundational paper proving space and time bounds for Cilk-style work stealing.',
            'Arora, Blumofe & Plaxton, "Thread Scheduling for Multiprogrammed Multiprocessors," Theory of Computing Systems 34(2), 2001. The ABP deque -- the first lock-free work-stealing deque algorithm.',
            'Chase & Lev, "Dynamic Circular Work-Stealing Deque," SPAA 2005. The practical refinement with a growable circular array, widely implemented.',
            'Le, Pop, Cohen & Nardelli, "Correct and Efficient Work-Stealing for Weak Memory Models," PPoPP 2013. Formal proof of the Chase-Lev deque under C11 memory model.',
            'Frigo, Leiserson & Randall, "The Implementation of the Cilk-5 Multithreaded Language," PLDI 1998. Describes the THE protocol for owner-thief synchronization.',
            'Doug Lea, "A Java Fork/Join Framework," ACM Java Grande 2000. Design of ForkJoinPool for the JVM.',
          ],
        },
        'Study next: Double-Ended Queue for the base abstraction and interface contract. Compare-and-Swap for the atomic primitive that makes lock-free stealing possible. Ring Buffer for the circular-array storage underneath the deque. Lock-Free Queue for contrasting concurrent queue designs. Fork-join divide-and-conquer topics for the workloads where this scheduler earns its keep.',
      ],
    },
  ],
};
