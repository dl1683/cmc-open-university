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
  const heapNodes = 8;
  const heapEdges = 6;
  const garbageNode = 'E';
  yield {
    state: heapGraph('Reachability starts from roots'),
    highlight: { active: ['roots', 'a', 'e-roots-a'], compare: ['e'] },
    explanation: `Tracing garbage collection starts from roots: stack references, globals, handles, and engine roots. In this ${heapNodes}-node heap with ${heapEdges} edges, objects reachable from roots are live. Unreachable objects like ${garbageNode} are garbage even if they point to each other.`,
    invariant: `Reachability, not reference count, decides liveness across all ${heapNodes} heap objects.`,
  };

  const colorCount = 3;
  const frontierNodes = ['A', 'B', 'C'];
  yield {
    state: heapGraph('Tri-color marking uses a worklist'),
    highlight: { active: ['a', 'b', 'c', 'work', 'e-a-b', 'e-a-c'], found: ['d'], compare: ['e'] },
    explanation: `A tri-color collector uses ${colorCount} states: white, gray, black. White means unseen, gray means seen but children not fully scanned, and black means scanned. Here ${frontierNodes.join(', ')} form the active frontier that keeps graph traversal complete.`,
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
    explanation: `Incremental or concurrent marking needs barriers because JavaScript keeps mutating the graph while marking is in progress. This ${colorCount + 1}-row table shows that barriers prevent a black object from hiding a new white child from the collector.`,
  };

  const survivorCount = 4;
  const reclaimedCount = 1;
  yield {
    state: heapGraph('Sweep reclaims objects never reached'),
    highlight: { active: ['free', 'e-work-free'], removed: ['e'], found: ['a', 'b', 'c', 'd'] },
    explanation: `After marking, ${survivorCount} live objects survive and ${reclaimedCount} unreachable white object is reclaimed. A compacting collector can also move live objects together to reduce fragmentation.`,
  };
}

function* generationalHeap() {
  const genNodes = 7;
  const genEdges = 7;
  yield {
    state: generationGraph('New objects start in the young generation'),
    highlight: { active: ['alloc', 'young', 'e-alloc-young'], found: ['minor'] },
    explanation: `V8 exploits the generational hypothesis: most newly allocated objects die young. This ${genNodes}-node lifecycle graph with ${genEdges} edges shows how allocating into a young space is cheap, and collecting that young space often reclaims many objects quickly.`,
  };

  const activeSteps = 7;
  const promotionPath = 'young -> minor -> promote -> old';
  yield {
    state: generationGraph('Minor GC copies survivors and promotes long-lived objects'),
    highlight: { active: ['young', 'minor', 'promote', 'old', 'e-young-minor', 'e-minor-promote', 'e-promote-old'] },
    explanation: `A minor collection, often called scavenging, activates ${activeSteps} nodes and edges along the path ${promotionPath}. Objects that survive enough collections are promoted to old space, where major GC handles them less frequently.`,
    invariant: `Young GC is frequent and cheap because most of the ${genNodes} tracked objects die before promotion.`,
  };

  const barrierActiveCount = 5;
  const barrierEdgePath = 'old -> barrier -> young';
  yield {
    state: generationGraph('Write barriers remember old-to-young pointers'),
    highlight: { active: ['old', 'barrier', 'young', 'e-old-barrier', 'e-barrier-young'], compare: ['major'] },
    explanation: `If an old object points to a young object, the ${barrierEdgePath} path shows how barriers record that pointer. With ${barrierActiveCount} active elements, minor GC can stay small without missing live objects.`,
  };

  const gcPhases = ['minor', 'major', 'incremental', 'concurrent'];
  const phaseColumns = ['scope', 'goal'];
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
    explanation: `Orinoco is the V8 project that added parallel, incremental, and concurrent techniques. This ${gcPhases.length}-phase table with ${phaseColumns.length} columns per phase shows the aim is lower pause time for interactive JavaScript.`,
  };

  const stwPeak = 95;
  const slicePeaks = [20, 18, 16, 14];
  const seriesCount = 2;
  const markerCount = 2;
  yield {
    state: plotState({
      axes: { x: { label: 'timeline', min: 0, max: 100 }, y: { label: 'main-thread pause', min: 0, max: 100 } },
      series: [
        { id: 'stw', label: 'one big pause', points: [
          { x: 0, y: 0 }, { x: 35, y: 0 }, { x: 45, y: stwPeak }, { x: 55, y: stwPeak }, { x: 65, y: 0 }, { x: 100, y: 0 },
        ] },
        { id: 'sliced', label: 'incremental slices', points: [
          { x: 0, y: 0 }, { x: 15, y: slicePeaks[0] }, { x: 20, y: 0 }, { x: 40, y: slicePeaks[1] }, { x: 45, y: 0 }, { x: 65, y: slicePeaks[2] }, { x: 70, y: 0 }, { x: 90, y: slicePeaks[3] }, { x: 95, y: 0 },
        ] },
      ],
      markers: [
        { id: 'jank', x: 50, y: stwPeak, label: 'jank' },
        { id: 'smooth', x: 70, y: slicePeaks[2], label: 'slice' },
      ],
    }),
    highlight: { active: ['sliced', 'smooth'], compare: ['stw', 'jank'] },
    explanation: `The ${seriesCount} series and ${markerCount} markers contrast a stop-the-world pause peaking at ${stwPeak}% against incremental slices peaking at only ${Math.max(...slicePeaks)}%. Incremental work does not remove GC cost; it trades one big pause for barriers, scheduling, and synchronization.`,
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
        'The mark-and-sweep view treats the heap as a directed graph. Roots are references held by stacks, globals, registers, and engine handles; active nodes are the current marking frontier; found nodes are proven live; removed nodes are reclaimed.',
        {
          type: 'callout',
          text: 'Garbage collection is a reachability proof plus a scheduling problem: the collector must be right and it must avoid long pauses.',
        },
        'The safe inference is reachability. If a root can reach an object by following references, the collector must keep it; if the frontier empties while an object is still white, sweeping it cannot change program behavior.',
        'The generational view adds age. New objects begin in young space, survivors may be promoted, and old-to-young pointers are recorded by write barriers so a minor collection does not miss a young object reachable from old space.',
      
        {type: 'image', src: './assets/gifs/v8-generational-garbage-collection.gif', alt: 'Animated walkthrough of the v8 generational garbage collection visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript allocates constantly: closures, arrays, promises, strings, DOM wrappers, and request objects appear during ordinary execution. The language does not ask programmers to free most of them manually, so the runtime must decide when memory is safe to reuse.',
        'The collector has two jobs that pull against each other. It must be correct as a graph algorithm, and it must schedule that graph work without freezing a browser tab or stalling a Node server.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Manual memory management is the oldest answer: allocate an object, then free it when the program is done. That gives the programmer control, but the cost is lifetime proof on every path through the code.',
        'Reference counting is the next obvious answer. It frees an object when its incoming reference count reaches zero, which gives prompt reclamation but leaks cycles such as A pointing to B while B points back to A.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A simple full-heap mark-and-sweep collector is correct, but it can pause the program while it walks every live object and sweeps memory. A 100 ms pause drops about six frames at 60 frames per second, which users experience as a visible hitch.',
        'The wall is latency, not reachability. If the live heap doubles, tracing work roughly doubles, so a collector that only runs as one stop-the-world pass becomes less acceptable as applications grow.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate the proof from the schedule. Reachability decides correctness, while generational collection, incremental marking, concurrent marking, and write barriers decide when and how much work runs at once.',
        {type: 'image', src: 'https://v8.dev/_img/trash-talk/02.svg', alt: 'V8 heap generations showing objects moving through nursery, intermediate, and old generation spaces', caption: 'V8s generational heap makes object age visible: survivors move from nursery to intermediate space and then to old space. Source: V8 blog, Trash talk: the Orinoco garbage collector, CC BY 3.0.'},
        'The generational hypothesis says most objects die young. If a collector checks the young generation often and the old generation less often, it reclaims common garbage cheaply while saving full-heap tracing for rarer cases.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Marking starts by pushing roots onto a gray worklist. The collector pops an object, scans its fields, marks newly discovered children gray, and turns the scanned object black.',
        'Sweeping or compaction reclaims memory that remained white. A compacting pass may move live objects together to reduce fragmentation, but then every pointer to a moved object must be updated.',
        'A minor collection scans young space and the remembered set of old-to-young references. Incremental and concurrent marking split old-generation tracing into pieces, while write barriers record mutations that could otherwise break the reachability proof.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is the tri-color invariant. Black objects have been fully scanned, gray objects are known live but not fully scanned, and white objects are not yet proven live.',
        'The dangerous case is a black object pointing to a white object, because the collector would not revisit the black object and might free the white child. Write barriers prevent or repair that case, so when the gray set empties every reachable object has been discovered.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tracing cost is proportional to live objects visited, while sweeping cost is proportional to memory regions inspected. If a live heap grows from 50 MB to 100 MB, a naive full trace has about twice the graph work.',
        'Generational collection changes the behavior. If 90 percent of new objects die before the next minor collection, a small young-space scan reclaims most allocation churn without touching most old objects.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'V8 uses these ideas in Chrome, Node.js, and other JavaScript runtimes that need high allocation rates with bounded pauses. The same pattern appears in many managed runtimes, including JVM and .NET collectors, though the exact barriers and heap layouts differ.',
        'This matters in UI code, servers, and compilers. A frontend framework may allocate many short-lived virtual nodes, while a server may allocate request-scoped objects that die together after a response.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Garbage collection cannot fix object retention bugs. If a cache, listener, closure, or global map still references an object, the object is reachable and must be kept even when the programmer thinks it is dead.',
        'The scheduler also has limits. Very large live heaps, allocation bursts, finalizers, weak references, and native resources can still produce latency cliffs or memory pressure that the collector cannot hide.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose roots point to A and D. A points to B, B points to C, D points to B, and E points to F, but no root points to E or F.',
        'Marking starts with A and D gray. Scanning A discovers B, scanning D sees B already discovered, scanning B discovers C, and scanning C ends that chain.',
        'The live set is A, B, C, and D. E and F may point to each other forever, but they are white when marking ends, so sweeping them is correct because no root path reaches either object.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are McCarthy, Recursive Functions of Symbolic Expressions and Their Computation by Machine (1960), the V8 blog post Trash talk: the Orinoco garbage collector, and V8 design material on concurrent and incremental marking. Read them for the original reachability idea and the modern scheduling machinery.',
        'Study graph traversal, reference counting, weak references, memory fragmentation, write barriers, and JVM generational collectors next. Those topics separate the proof of liveness from the practical cost of running it inside a live program.',
      ],
    },
  ],
};
