// V8 garbage collection: trace reachable object graphs, collect young objects
// frequently, and spread old-generation work with incremental/concurrent phases.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'v8-generational-garbage-collection',
  title: 'V8 Generational Garbage Collection',
  category: 'Data Structures',
  summary: 'How V8 reclaims JavaScript heap memory with roots, tri-color marking, young-generation scavenges, write barriers, and major compaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mark and sweep', 'generational heap'], defaultValue: 'mark and sweep' },
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

function heapGraph(title) {
  return graphState({
    nodes: [
      { id: 'roots', label: 'roots', x: 0.8, y: 3.8, note: 'stack/global' },
      { id: 'a', label: 'A', x: 2.5, y: 5.1, note: 'gray' },
      { id: 'b', label: 'B', x: 4.2, y: 5.1, note: 'white' },
      { id: 'c', label: 'C', x: 4.2, y: 2.6, note: 'white' },
      { id: 'd', label: 'D', x: 6.0, y: 5.1, note: 'white' },
      { id: 'e', label: 'E', x: 6.0, y: 2.6, note: 'garbage' },
      { id: 'work', label: 'worklist', x: 7.9, y: 3.8, note: 'queue' },
      { id: 'free', label: 'free list', x: 9.4, y: 2.4, note: 'reclaim' },
    ],
    edges: [
      { id: 'e-roots-a', from: 'roots', to: 'a' },
      { id: 'e-a-b', from: 'a', to: 'b' },
      { id: 'e-a-c', from: 'a', to: 'c' },
      { id: 'e-b-d', from: 'b', to: 'd' },
      { id: 'e-c-d', from: 'c', to: 'd' },
      { id: 'e-work-free', from: 'work', to: 'free' },
    ],
  }, { title });
}

function generationGraph(title) {
  return graphState({
    nodes: [
      { id: 'alloc', label: 'allocate', x: 0.7, y: 3.7, note: 'bump ptr' },
      { id: 'young', label: 'young', x: 2.4, y: 3.7, note: 'new objs' },
      { id: 'minor', label: 'minor GC', x: 4.2, y: 2.3, note: 'scavenge' },
      { id: 'promote', label: 'promote', x: 5.9, y: 3.7, note: 'survivors' },
      { id: 'old', label: 'old', x: 7.5, y: 3.7, note: 'long lived' },
      { id: 'major', label: 'major GC', x: 9.1, y: 2.3, note: 'mark compact' },
      { id: 'barrier', label: 'barrier', x: 7.5, y: 5.4, note: 'old -> young' },
    ],
    edges: [
      { id: 'e-alloc-young', from: 'alloc', to: 'young' },
      { id: 'e-young-minor', from: 'young', to: 'minor' },
      { id: 'e-minor-promote', from: 'minor', to: 'promote' },
      { id: 'e-promote-old', from: 'promote', to: 'old' },
      { id: 'e-old-major', from: 'old', to: 'major' },
      { id: 'e-old-barrier', from: 'old', to: 'barrier' },
      { id: 'e-barrier-young', from: 'barrier', to: 'young' },
    ],
  }, { title });
}

function* markAndSweep() {
  yield {
    state: heapGraph('Reachability starts from roots'),
    highlight: { active: ['roots', 'a', 'e-roots-a'], compare: ['e'] },
    explanation: 'Tracing garbage collection starts from roots: stack references, globals, handles, and engine roots. Objects reachable from roots are live. Unreachable objects are garbage even if they point to each other.',
    invariant: 'Reachability, not reference count, decides liveness.',
  };

  yield {
    state: heapGraph('Tri-color marking uses a worklist'),
    highlight: { active: ['a', 'b', 'c', 'work', 'e-a-b', 'e-a-c'], found: ['d'], compare: ['e'] },
    explanation: 'A tri-color collector can be taught as white, gray, black. White means unseen, gray means seen but children not fully scanned, and black means scanned. The gray worklist is the frontier that keeps graph traversal complete.',
  };

  yield {
    state: labelMatrix(
      'Tri-color invariant',
      [
        { id: 'white', label: 'white' },
        { id: 'gray', label: 'gray' },
        { id: 'black', label: 'black' },
        { id: 'barrier', label: 'barrier' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['unseen', 'may be garbage'],
        ['seen', 'children pending'],
        ['scanned', 'must not hide white'],
        ['records writes', 'keeps invariant'],
      ],
    ),
    highlight: { active: ['gray:meaning', 'black:risk', 'barrier:risk'], compare: ['white:risk'] },
    explanation: 'Incremental or concurrent marking needs barriers because JavaScript keeps mutating the graph while marking is in progress. Barriers prevent a black object from hiding a new white child from the collector.',
  };

  yield {
    state: heapGraph('Sweep reclaims objects never reached'),
    highlight: { active: ['free', 'e-work-free'], removed: ['e'], found: ['a', 'b', 'c', 'd'] },
    explanation: 'After marking, live objects survive and unreachable white objects are reclaimed. A compacting collector can also move live objects together to reduce fragmentation.',
  };
}

function* generationalHeap() {
  yield {
    state: generationGraph('New objects start in the young generation'),
    highlight: { active: ['alloc', 'young', 'e-alloc-young'], found: ['minor'] },
    explanation: 'V8 exploits the generational hypothesis: most newly allocated objects die young. Allocating into a young space can be cheap, and collecting that young space often reclaims many objects quickly.',
  };

  yield {
    state: generationGraph('Minor GC copies survivors and promotes long-lived objects'),
    highlight: { active: ['young', 'minor', 'promote', 'old', 'e-young-minor', 'e-minor-promote', 'e-promote-old'] },
    explanation: 'A minor collection, often called scavenging, focuses on the young generation. Objects that survive enough collections may be promoted to old space, where major GC handles them less frequently.',
    invariant: 'Young GC is frequent and cheap because most young objects are dead.',
  };

  yield {
    state: generationGraph('Write barriers remember old-to-young pointers'),
    highlight: { active: ['old', 'barrier', 'young', 'e-old-barrier', 'e-barrier-young'], compare: ['major'] },
    explanation: 'If an old object points to a young object, a young-only collection must still know about that pointer. Write barriers record those cross-generation slots so minor GC can stay small without missing live objects.',
  };

  yield {
    state: labelMatrix(
      'V8 GC phases',
      [
        { id: 'minor', label: 'minor' },
        { id: 'major', label: 'major' },
        { id: 'incr', label: 'incremental' },
        { id: 'conc', label: 'concurrent' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['young', 'quick reclaim'],
        ['whole heap', 'mark compact'],
        ['sliced work', 'short pauses'],
        ['background', 'less main work'],
      ],
    ),
    highlight: { active: ['minor:goal', 'incr:goal', 'conc:goal'], compare: ['major:scope'] },
    explanation: 'Orinoco is the V8 project that added parallel, incremental, and concurrent techniques around the collector. The aim is not just throughput; it is lower pause time for interactive JavaScript.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'timeline', min: 0, max: 100 }, y: { label: 'main-thread pause', min: 0, max: 100 } },
      series: [
        { id: 'stw', label: 'one big pause', points: [
          { x: 0, y: 0 }, { x: 35, y: 0 }, { x: 45, y: 95 }, { x: 55, y: 95 }, { x: 65, y: 0 }, { x: 100, y: 0 },
        ] },
        { id: 'sliced', label: 'incremental slices', points: [
          { x: 0, y: 0 }, { x: 15, y: 20 }, { x: 20, y: 0 }, { x: 40, y: 18 }, { x: 45, y: 0 }, { x: 65, y: 16 }, { x: 70, y: 0 }, { x: 90, y: 14 }, { x: 95, y: 0 },
        ] },
      ],
      markers: [
        { id: 'jank', x: 50, y: 95, label: 'jank' },
        { id: 'smooth', x: 70, y: 16, label: 'slice' },
      ],
    }),
    highlight: { active: ['sliced', 'smooth'], compare: ['stw', 'jank'] },
    explanation: 'Incremental and concurrent work reduce user-visible pauses by spreading collection work across time or background threads. They do not remove GC cost; they trade simpler stop-the-world work for barriers, scheduling, and synchronization.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mark and sweep') yield* markAndSweep();
  else if (view === 'generational heap') yield* generationalHeap();
  else throw new InputError('Pick a V8 GC view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `V8 garbage collection exists because JavaScript programs allocate constantly while programmers do not manually free most objects. Closures, arrays, strings, promises, DOM wrappers, request records, and engine-internal objects appear and disappear as code runs.`,
        `The runtime must reclaim memory without changing program behavior. If running code can still reach an object, the object must survive. If no root can reach it, the object can be reclaimed even if it points to other unreachable objects.`,
        `The runtime must also protect responsiveness. A browser tab can allocate while a user scrolls or types. A Node service can allocate many short-lived request objects per second. V8 needs a collector that is correct as a graph algorithm and practical as a scheduler for cleanup work.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is manual memory management, but JavaScript does not ask ordinary application code to call free. That choice makes the language easier to use, but it moves lifetime decisions into the engine.`,
        `A second obvious approach is reference counting. Count incoming references and reclaim an object when the count reaches zero. The wall is cycles: two unreachable objects can point to each other and keep nonzero counts. JavaScript object graphs create cycles easily through closures, DOM references, Maps, and application data structures.`,
        `A third obvious approach is one large stop-the-world heap collection. Pause JavaScript, trace everything, reclaim garbage, and resume. That is simple to explain, but it can cause long pauses. V8 therefore uses tracing plus generations, barriers, incremental work, concurrent work, and compaction policies.`,
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        `The core insight is reachability. The heap is a directed graph. Roots come from stacks, globals, handles, registers, and engine internals. An object is live if some root can reach it by following references. Unreachable objects are garbage, even if they form cycles.`,
        `The tracing invariant is: after marking finishes, every reachable object is marked and every unmarked object is unreachable. Tri-color marking maintains that search with white, gray, and black states. Gray objects are known live but not fully scanned. Black objects are scanned. White objects have not been reached yet.`,
        `The generational invariant is: a young-only collection must still see every old-to-young pointer. V8 uses write barriers and remembered sets so minor GC can trace young objects without scanning the whole old generation every time.`,
        `These invariants let the collector be both correct and fast in the common case. Reachability gives correctness. Generations exploit the fact that many new objects die quickly.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A major tracing collection starts from roots and pushes reached objects onto a worklist. The collector repeatedly pops a gray object, scans its fields, marks newly reached children gray, and then marks the scanned object black. When the worklist is empty, every reachable object has been discovered.`,
        `After marking, sweeping reclaims memory occupied by unmarked objects. Some memory can go into free lists. Some regions can be reused wholesale. A compacting collector can also move live objects together to reduce fragmentation, but then all references to moved objects must be updated safely.`,
        `A minor collection focuses on the young generation. New objects are allocated cheaply, often by bumping a pointer in young space. During a scavenge, live young objects are copied to a survivor area or promoted to old space after surviving enough collections. Dead young objects are left behind.`,
        `Write barriers connect the two worlds. When old code stores a pointer to a young object inside an old object, the barrier records that slot in a remembered set. The next minor GC treats those remembered slots as extra roots into young space.`,
        `V8's modern work, often discussed under the Orinoco project, adds parallel, incremental, and concurrent phases. The aim is not merely total throughput. It is shorter user-visible pauses while preserving the same reachability semantics.`,
      ],
    },
    {
      heading: 'What the visuals show',
      paragraphs: [
        `The mark-and-sweep view is a graph search. Roots reach A, A reaches B and C, and B or C reaches D. E is the contrast case: it may contain fields, but no root reaches it, so the sweep phase can reclaim it.`,
        `The tri-color table names the invariant. White is not yet reached, gray is the frontier, black is fully scanned. During incremental or concurrent marking, JavaScript keeps mutating the graph, so barriers are needed to keep a black object from hiding a white child.`,
        `The generational view is a lifecycle. Allocation enters young space, minor GC copies survivors, repeated survivors promote to old space, and major GC handles older debt less often. The barrier node is the remembered-set path that keeps young-only collection correct.`,
        `The pause plot teaches a scheduling limit. Slicing and background work can reduce a single long pause, but the work still exists. The runtime pays with barriers, coordination, and bookkeeping.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `In the mark-and-sweep view, roots point to object A. A points to B and C. B and C point to D. Object E is not reachable from any root. The collector marks A gray, scans A, discovers B and C, then scans them and reaches D. E stays white, so sweeping can reclaim it.`,
        `In the generational view, new allocations enter young space through a fast allocation path. A minor GC copies survivors and promotes long-lived objects into old space. If old space later stores a pointer back into young space, the barrier node in the animation represents the remembered set entry that keeps that young object visible to minor GC.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Tracing works because reachability from roots is a precise operational definition of "may still be used." If no running code can reach an object through any reference path, reclaiming it cannot change program behavior. Cycles do not matter because the question is not "does someone point to me?" but "can a root reach me?"`,
        `Tri-color marking is correct because it turns graph traversal into a maintained frontier. When the frontier is empty, there are no more reachable children to discover. Barriers protect that statement while the program mutates references during incremental or concurrent marking.`,
        `Generational GC works because object lifetimes are highly skewed in many JavaScript workloads. Temporary objects die after a function call, render pass, request, or promise chain. Collecting young space frequently gets large memory returns for small scans.`,
        `Remembered sets preserve correctness by adding back the old-to-young edges that a young-only scan would otherwise miss. Without them, a young object reachable only from old space could be reclaimed incorrectly.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Garbage collection makes allocation and ownership easier for programmers, but it moves complexity into the runtime. Allocation can be close to a bump-pointer increment, yet the program later pays with CPU time, memory overhead, barriers, metadata, and occasional pauses.`,
        `Generational collection is a bet on short object lifetimes. When the bet is right, minor GC is cheap and productive. When many objects survive, promotion can fill old space and move cost into major GC.`,
        `Compaction reduces fragmentation and can improve allocation locality, but moving objects requires relocation metadata and reference updates. Incremental and concurrent work reduce long pauses, but they add synchronization, scheduling, and write-barrier complexity.`,
        `Memory overhead is also real. The collector needs spaces, mark bits, remembered sets, free lists, worklists, allocation metadata, and sometimes evacuation or relocation state. The runtime is trading programmer simplicity for engine machinery.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `V8's generational collector wins on ordinary JavaScript allocation patterns: many short-lived objects, a smaller set of long-lived objects, and interactive workloads where pause time matters. Browser UI code, request handlers, parsers, and promise-heavy code often create many objects that die quickly.`,
        `It also wins as a language design trade. Most JavaScript developers can write normal object code without manually proving ownership. The runtime carries the memory-management burden and offers tools such as heap snapshots when behavior goes wrong.`,
        `The data-structure lesson carries beyond V8. Tracing is graph reachability. Young GC is a hot-region optimization. Remembered sets are an index of cross-region edges. Incremental marking is graph traversal scheduled in slices.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `Garbage collection cannot reclaim objects that are still reachable. A forgotten event listener, global cache, Map, closure, timer, or DOM reference can keep a large object graph alive. From the collector's point of view, that is not garbage. It is reachable memory that the program forgot how to stop using.`,
        `Large heaps take longer to trace, compact, and manage. Short-lived allocation bursts can pressure young space. Long-lived object churn can promote too much data into old space. Moving collectors must also coordinate with optimized code, stack maps, handles, and native references.`,
        `A common failure mode is accidental retention. For example, a request cache stores response objects forever, a closure captures a large array, or a UI component removes a DOM node but leaves a listener reachable. Heap snapshots usually show a retaining path from a root to the object; that path is the bug.`,
        `Another failure mode is pause sensitivity. A workload can have acceptable average throughput but still suffer visible jank when major GC, compaction, or promotion debt lines up with user work. That is why GC tuning and allocation reduction often focus on tail latency, not just total memory.`,
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        `For day-to-day JavaScript, the useful habit is to think in reachability paths. When memory grows, ask what root still reaches the data. Browser and Node heap snapshots expose dominators and retainers because those structures match the collector's view of liveness.`,
        `For performance, reduce needless allocation in hot paths, clear caches by policy, remove event listeners, avoid unbounded queues, and be cautious with long-lived objects that point to many young objects. Those choices help the collector by shrinking the live graph and reducing barrier traffic.`,
        `Debug memory growth by finding retaining paths, not by guessing which objects "should" be dead. Debug pause problems by looking at allocation rate, old-space size, promotion, compaction, and long tasks. GC is often the messenger for an allocation pattern created elsewhere.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: V8 Orinoco overview at https://v8.dev/blog/trash-talk, V8 Concurrent Marking at https://v8.dev/blog/concurrent-marking, V8 Pointer Compression at https://v8.dev/blog/pointer-compression, and MDN JavaScript memory-management guide at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management. Study V8 Hidden Classes and Inline Caches, WeakRef and FinalizationRegistry, Escape Analysis and Scalar Replacement, Graph BFS, Queue, Tree Traversals, Buddy Allocator Free Lists, Slab Allocator and Size Classes, and Web Workers next.`,
      ],
    },
  ],
};
