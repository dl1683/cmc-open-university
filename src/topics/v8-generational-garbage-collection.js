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
      heading: 'How to read the animation',
      paragraphs: [
        'The mark-and-sweep view shows a heap graph with roots, live objects (A through D), and one unreachable object (E). Active nodes are the current marking frontier. Found nodes are confirmed live. Removed nodes are reclaimed garbage.',
        {
          type: 'callout',
          text: 'Garbage collection is a reachability proof plus a scheduling problem: the collector must be right and it must avoid long pauses.',
        },
        'Gray in the tri-color table is the worklist frontier. When a node turns black, all its children have been discovered. Any node still white when the worklist empties is unreachable and will be swept.',
        'The generational view shows the object lifecycle: allocation into young space, minor GC scavenging, promotion to old space, and the write barrier that records old-to-young pointers. The pause plot contrasts stop-the-world collection against incremental slicing.',
        'At each frame, ask: which objects are proven live, which are still unvisited, and what invariant lets the collector skip work safely.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript programs allocate constantly. Closures, arrays, strings, promises, DOM wrappers, request records, and engine-internal objects appear and disappear as code runs. Programmers do not call free.',
        'The runtime must reclaim memory without changing program behavior. If running code can still reach an object, the object must survive. If no root can reach it, the object is reclaimable even if it points to other unreachable objects.',
        'The runtime must also protect responsiveness. A browser tab allocates while a user scrolls or types. A Node service allocates many short-lived request objects per second. The collector must be correct as a graph algorithm and practical as a scheduler that avoids freezing the application.',
        'John McCarthy invented the first garbage collector in 1960 for Lisp. His mark-and-sweep algorithm traced reachable cells from a root set, then swept unmarked cells into a free list. Every modern tracing collector descends from that idea.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is manual memory management. C and C++ programmers call malloc and free (or new and delete). This works, but it demands that the programmer prove every object lifetime. Use-after-free, double-free, and memory leaks are the cost of getting that proof wrong. JavaScript chose not to impose that burden.',
        'The second obvious approach is reference counting. Each object tracks how many incoming references it has. When the count drops to zero, the object is freed immediately. Reference counting has real strengths: reclamation is prompt, pauses are small and predictable, and the mechanism is easy to understand. CPython, Objective-C (with ARC), and Swift use reference counting as a primary strategy.',
        'Reference counting works well for trees and acyclic graphs. It fails on cycles. If object A points to B and B points back to A, both counts stay at 1 even after every external reference is gone. JavaScript object graphs create cycles easily through closures, DOM parent-child links, Map entries, and mutual references in application data structures. A pure reference counter leaks every cycle.',
        'Cycle collectors (like the one Firefox pairs with its reference counter for DOM objects) can detect and break cycles, but they add a secondary tracing pass, which partly negates the simplicity advantage. V8 chose full tracing from the start.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single stop-the-world tracing pass is correct but brutal. The original collector from McCarthy paused the entire program, traced every reachable cell, swept everything else, and then resumed. For a small Lisp environment that was fine. For a modern JavaScript heap that can be hundreds of megabytes, a full pause can take tens or hundreds of milliseconds.',
        'A 100ms pause drops six animation frames. A 200ms pause is perceptible as a stutter in scrolling, typing, or audio playback. Server-side, a long GC pause stalls every in-flight request. The wall is not correctness; mark-and-sweep is correct. The wall is latency.',
        'The problem compounds with heap size. Tracing visits every live object. Sweeping inspects every dead region. Doubling the heap roughly doubles the pause. Applications that need large heaps and low latency cannot afford a naive stop-the-world collector.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is reachability, not reference counting. The heap is a directed graph. Roots come from stacks, globals, handles, registers, and engine internals. An object is live if and only if some root can reach it by following references. Unreachable objects are garbage, even if they form cycles among themselves.',
        'The tracing invariant: after marking finishes, every reachable object is marked and every unmarked object is unreachable. Tri-color marking maintains that invariant with three states. White means unseen. Gray means seen but children not fully scanned. Black means fully scanned. The gray set is the frontier of a graph traversal. When it empties, every reachable object is black.',
        {type: 'image', src: 'https://v8.dev/_img/trash-talk/02.svg', alt: 'V8 heap generations showing objects moving through nursery, intermediate, and old generation spaces', caption: 'V8s generational heap makes object age visible: survivors move from nursery to intermediate space and then to old space. Source: V8 blog, Trash talk: the Orinoco garbage collector, CC BY 3.0.'},
        'The strong tri-color invariant states: no black object may point directly to a white object. If a black object could hide a white child, the collector would never discover that child and would incorrectly reclaim it. Write barriers enforce this invariant when the mutator (running JavaScript) modifies references during concurrent or incremental marking.',
        'The generational insight is a scheduling optimization built on the generational hypothesis: most objects die young. Empirically, in languages like Java, JavaScript, ML, and Haskell, 80-95% of newly allocated objects become unreachable before the next collection. If the collector partitions the heap by age and collects the young partition frequently, it reclaims most garbage cheaply without scanning long-lived objects every time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Mark phase: the collector pushes every root onto a gray worklist. It repeatedly pops a gray object, scans its fields, marks newly discovered children gray, and marks the scanned object black. When the worklist empties, every reachable object is black and every white object is garbage.',
        'Sweep phase: the collector walks memory and reclaims every white (unmarked) region. In V8, some pages go onto free lists for reuse; others are returned to the OS. A compacting collector can also relocate live objects to eliminate fragmentation, but relocation requires updating every pointer to every moved object.',
        'Minor (young-generation) collection: new objects are allocated by bumping a pointer in a small young space (typically 1-8 MB in V8). When young space fills, a scavenge copies live young objects to a survivor area. Objects that survive enough scavenges are promoted to old space. Dead young objects, which are the majority, cost nothing to reclaim because the young space is simply reused.',
        'Write barriers: when old-generation code stores a reference to a young object inside an old object, the write barrier records that slot in a remembered set. The next minor GC treats remembered-set entries as additional roots into young space. Without this, a young object reachable only through old space would be incorrectly collected.',
        'Incremental marking: instead of one long pause, V8 breaks the mark phase into small time slices interleaved with JavaScript execution. Each slice processes a bounded amount of the gray worklist. Write barriers record any mutations that happen between slices so the collector does not miss newly created references.',
        'Concurrent marking: V8 runs marking work on background threads while JavaScript continues on the main thread. The background threads traverse the object graph and mark objects. Write barriers on the main thread ensure that mutations during concurrent marking do not violate the tri-color invariant. The final short pause at the end handles any remaining work and sweeps.',
      ],
    }
  ],
};
