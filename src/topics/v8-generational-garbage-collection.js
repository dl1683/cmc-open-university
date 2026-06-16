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
    explanation: 'A tri-color collector can be taught as white, gray, black. White means unseen, gray means seen but children not fully scanned, and black means scanned. The gray worklist is a queue or stack of objects still needing traversal.',
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
    explanation: 'If an old object points to a young object, a young-only collection must still know about that pointer. Write barriers and remembered sets record those cross-generation references.',
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
    explanation: 'Incremental and concurrent work reduce user-visible pauses by spreading collection work across time or background threads. They do not remove GC cost; they schedule it more carefully.',
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
      heading: 'What it is',
      paragraphs: [
        'Garbage collection is automatic memory reclamation. In JavaScript, the program allocates objects while the engine periodically finds heap objects that are no longer reachable from roots. V8\'s modern collector, Orinoco, combines tracing, generational collection, compaction, parallel work, incremental slices, and concurrent marking.',
        'V8\'s Orinoco article explains the two headline collectors: a major GC, Mark-Compact, for the whole heap, and a minor GC, Scavenger, for the young generation: https://v8.dev/blog/trash-talk. This topic turns that into a data-structure view: object graphs, mark worklists, remembered sets, free lists, and heap generations.',
      ],
    },
    {
      heading: 'How mark-sweep works',
      paragraphs: [
        'Tracing starts from roots: stack slots, globals, handles, and engine references. The collector marks every object reachable from those roots, then follows outgoing references until the reachable graph is exhausted. Anything never reached is garbage, even if it participates in a cycle. That is why tracing collectors do not suffer from simple reference-counting cycle leaks.',
        'Tri-color marking is the standard mental model. White objects are not yet seen. Gray objects are seen but their children still need scanning. Black objects are fully scanned. A worklist stores gray objects. Incremental and concurrent collectors need write barriers because the JavaScript program can mutate object references while marking is underway.',
      ],
    },
    {
      heading: 'Generational case study',
      paragraphs: [
        'Generational GC is based on the observation that most new objects die young. V8 allocates new objects into a young generation and runs frequent minor collections there. Survivors can be copied, aged, and eventually promoted into old space. Old space is collected less often with major GC because long-lived objects are expected to remain live.',
        'The tricky edge is an old object pointing to a young object. A young-only collection cannot scan the entire old generation every time, so the engine uses write barriers and remembered sets to track old-to-young references. That is the hidden data structure that makes generational collection correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GC trades programmer convenience for runtime work. Allocation can be extremely cheap, sometimes close to bumping a pointer, but collection adds latency, CPU, memory overhead, and bookkeeping. Major collections can compact live objects to fight fragmentation, but moving objects requires updating references and coordinating with optimized code.',
        'V8\'s concurrent-marking article describes moving marking work off the main thread as part of Orinoco: https://v8.dev/blog/concurrent-marking. Incremental and concurrent techniques reduce pauses, but they require barriers and synchronization. The collector is therefore both an algorithm and a scheduler.',
      ],
    },
    {
      heading: 'Memory layout connections',
      paragraphs: [
        'GC sits below V8 Hidden Classes & Inline Caches. Object Maps describe shapes; GC decides whether the object carrying that Map is still reachable. Pointer compression is another memory-layout optimization. V8 reports that pointer compression reduced V8 heap size by up to 43 percent in browsing tests: https://v8.dev/blog/pointer-compression. Smaller pointers can also reduce GC traffic because there are fewer bytes to move and scan.',
        'This also connects to Buddy Allocator Free Lists and Slab Allocator & Size Classes. Those topics manage raw memory blocks explicitly. GC manages object lifetime automatically, but it still needs allocation spaces, free lists, pages, compaction, and fragmentation policy underneath.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Garbage collection does not prevent all memory leaks. If a cache, listener list, global map, closure, or DOM reference still reaches an object, that object is live by definition. The collector cannot know that the program no longer semantically wants it. Another misconception is that GC is always pause-free. Modern collectors reduce pauses, but some work still requires coordination with the main thread.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Orinoco overview at https://v8.dev/blog/trash-talk, V8 Concurrent Marking at https://v8.dev/blog/concurrent-marking, V8 Pointer Compression at https://v8.dev/blog/pointer-compression, and MDN JavaScript memory-management guide at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management. Study V8 Hidden Classes & Inline Caches, WeakRef & FinalizationRegistry, JavaScript Lexical Environments & Closures, V8 Ignition Bytecode Pipeline Case Study, Graph BFS, Queue, Tree Traversals, Buddy Allocator Free Lists, Slab Allocator & Size Classes, Cache Invalidation & Versioning, Escape Analysis & Scalar Replacement, and Web Workers next.',
      ],
    },
  ],
};
