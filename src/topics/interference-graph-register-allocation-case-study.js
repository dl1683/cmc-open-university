// Interference graph register allocation: liveness creates conflicts between
// simultaneously live values, and coloring maps those values to registers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'interference-graph-register-allocation-case-study',
  title: 'Interference Graph Register Allocation',
  category: 'Concepts',
  summary: 'Turn liveness facts into an interference graph, color non-conflicting live ranges with physical registers, and spill when the graph cannot be colored cheaply.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['liveness to graph', 'color and spill'], defaultValue: 'liveness to graph' },
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

function flowGraph(title) {
  return graphState({
    nodes: [
      { id: 'b1', label: 'B1', x: 1.0, y: 4.0, note: 'a,b' },
      { id: 'b2', label: 'B2', x: 3.0, y: 2.7, note: 'c=a+b' },
      { id: 'b3', label: 'B3', x: 3.0, y: 5.3, note: 'd=a-b' },
      { id: 'b4', label: 'B4', x: 5.4, y: 4.0, note: 'e=phi' },
      { id: 'b5', label: 'B5', x: 7.6, y: 4.0, note: 'ret e' },
    ],
    edges: [
      { id: 'e-b1-b2', from: 'b1', to: 'b2' },
      { id: 'e-b1-b3', from: 'b1', to: 'b3' },
      { id: 'e-b2-b4', from: 'b2', to: 'b4' },
      { id: 'e-b3-b4', from: 'b3', to: 'b4' },
      { id: 'e-b4-b5', from: 'b4', to: 'b5' },
    ],
  }, { title });
}

function interferenceGraph(title, colored = false) {
  return graphState({
    nodes: [
      { id: 'a', label: 'a', x: 1.3, y: 2.2, note: colored ? 'R1' : 'live' },
      { id: 'b', label: 'b', x: 1.3, y: 5.8, note: colored ? 'R2' : 'live' },
      { id: 'c', label: 'c', x: 3.4, y: 1.5, note: colored ? 'R2' : 'range' },
      { id: 'd', label: 'd', x: 3.4, y: 6.5, note: colored ? 'R2' : 'range' },
      { id: 'e', label: 'e', x: 5.8, y: 4.0, note: colored ? 'R1' : 'phi' },
      { id: 'f', label: 'f', x: 7.8, y: 4.0, note: colored ? 'spill' : 'wide' },
    ],
    edges: [
      { id: 'i-a-b', from: 'a', to: 'b' },
      { id: 'i-a-c', from: 'a', to: 'c' },
      { id: 'i-a-d', from: 'a', to: 'd' },
      { id: 'i-b-c', from: 'b', to: 'c' },
      { id: 'i-b-d', from: 'b', to: 'd' },
      { id: 'i-c-e', from: 'c', to: 'e' },
      { id: 'i-d-e', from: 'd', to: 'e' },
      { id: 'i-e-f', from: 'e', to: 'f' },
      { id: 'i-a-f', from: 'a', to: 'f' },
      { id: 'i-b-f', from: 'b', to: 'f' },
    ],
  }, { title });
}

function* livenessToGraph() {
  yield {
    state: flowGraph('Liveness facts come from the CFG'),
    highlight: { active: ['b1', 'b2', 'b3', 'b4'], found: ['b5'] },
    explanation: 'Before building an interference graph, the compiler runs liveness over the CFG. A value is live at a point if a future use may still need that value.',
  };

  yield {
    state: labelMatrix(
      'Live sets',
      [
        { id: 'b1', label: 'B1 out' },
        { id: 'b2', label: 'B2 out' },
        { id: 'b3', label: 'B3 out' },
        { id: 'b4', label: 'B4 out' },
      ],
      [
        { id: 'live', label: 'live' },
        { id: 'defs', label: 'defs' },
      ],
      [
        ['a,b', 'a,b'],
        ['c,e', 'c'],
        ['d,e', 'd'],
        ['e', 'e'],
      ],
    ),
    highlight: { active: ['b1:live', 'b2:live', 'b3:live'], found: ['b4:live'] },
    explanation: 'If two values are live at the same program point, they cannot occupy the same physical register. The live sets become edges in the interference graph.',
    invariant: 'Interference means simultaneous liveness, not source-level variable similarity.',
  };

  yield {
    state: interferenceGraph('Each interference edge forbids sharing a register'),
    highlight: { active: ['a', 'b', 'i-a-b', 'i-a-c', 'i-b-c'], compare: ['e', 'f'] },
    explanation: 'Nodes are virtual registers or live ranges. An edge means the two values must have different colors, because they may both be needed at the same point.',
  };

  yield {
    state: labelMatrix(
      'Building edges',
      [
        { id: 'def', label: 'new def' },
        { id: 'live', label: 'live-out' },
        { id: 'move', label: 'move' },
        { id: 'call', label: 'call' },
      ],
      [
        { id: 'edge', label: 'edge rule' },
        { id: 'note', label: 'note' },
      ],
      [
        ['def vs live', 'add edges'],
        ['same point', 'conflict'],
        ['copy pair', 'maybe skip'],
        ['clobbers', 'precolored'],
      ],
    ),
    highlight: { active: ['def:edge', 'live:edge'], compare: ['move:note', 'call:note'] },
    explanation: 'A common construction rule adds edges from each definition to values live after it. Move instructions need special care because coalescing may try to assign source and destination the same register.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'program point', min: 0, max: 10 }, y: { label: 'pressure', min: 0, max: 6 } },
      series: [
        { id: 'p', label: 'live', points: [{ x: 0, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 5 }, { x: 6, y: 3 }, { x: 8, y: 2 }, { x: 10, y: 1 }] },
        { id: 'k', label: 'regs', points: [{ x: 0, y: 3 }, { x: 10, y: 3 }] },
      ],
    }),
    highlight: { active: ['p'], compare: ['k'] },
    explanation: 'Register pressure is the size of the live set. When pressure rises above the number of available registers, the allocator must split ranges, spill, or find target-specific savings.',
  };
}

function* colorAndSpill() {
  yield {
    state: interferenceGraph('Coloring assigns physical registers'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e'], compare: ['f'] },
    explanation: 'Graph-coloring allocation turns registers into colors. Adjacent nodes cannot share a color. With two registers, this graph already has tight spots where choices matter.',
  };

  yield {
    state: labelMatrix(
      'Simplify stack',
      [
        { id: 'c', label: 'c' },
        { id: 'd', label: 'd' },
        { id: 'e', label: 'e' },
        { id: 'f', label: 'f' },
      ],
      [
        { id: 'degree', label: 'degree' },
        { id: 'action', label: 'action' },
      ],
      [
        ['low', 'push'],
        ['low', 'push'],
        ['low now', 'push'],
        ['high', 'spill cand'],
      ],
    ),
    highlight: { active: ['c:action', 'd:action', 'e:action'], compare: ['f:action'] },
    explanation: 'A coloring allocator repeatedly removes low-degree nodes and pushes them on a stack. High-degree nodes are potential spills, but optimistic allocators may defer that decision.',
  };

  yield {
    state: interferenceGraph('Select phase colors popped nodes', true),
    highlight: { active: ['a', 'b', 'c', 'd', 'e'], removed: ['f'], found: ['i-a-b', 'i-c-e'] },
    explanation: 'The select phase pops nodes and chooses a color not used by already colored neighbors. If no color is available, the value becomes a real spill and later code is rewritten.',
  };

  yield {
    state: labelMatrix(
      'Spill rewrite',
      [
        { id: 'choose', label: 'choose f' },
        { id: 'store', label: 'store' },
        { id: 'reload', label: 'reload' },
        { id: 'rerun', label: 'rerun' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['free color', 'memory cost'],
        ['after def', 'extra inst'],
        ['before use', 'latency'],
        ['new ranges', 'more edges'],
      ],
    ),
    highlight: { active: ['choose:effect', 'store:effect', 'reload:effect'], compare: ['rerun:risk'] },
    explanation: 'Spilling is a rewrite, not just a label. The compiler inserts stores and reloads, creates smaller live ranges, rebuilds liveness, and usually runs allocation again.',
  };

  yield {
    state: labelMatrix(
      'Allocator families',
      [
        { id: 'color', label: 'coloring' },
        { id: 'linear', label: 'linear scan' },
        { id: 'greedy', label: 'greedy' },
        { id: 'ssa', label: 'SSA alloc' },
      ],
      [
        { id: 'model', label: 'model' },
        { id: 'best', label: 'best at' },
      ],
      [
        ['graph', 'quality'],
        ['intervals', 'speed'],
        ['priority', 'splitting'],
        ['chordal', 'theory'],
      ],
    ),
    highlight: { active: ['color:model', 'linear:model', 'greedy:model'], found: ['ssa:model'] },
    explanation: 'Interference graphs explain the core constraint even when the production allocator is linear scan, greedy live-interval allocation, PBQP, or SSA-specific coloring.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'liveness to graph') yield* livenessToGraph();
  else if (view === 'color and spill') yield* colorAndSpill();
  else throw new InputError('Pick an interference-graph view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Machine code wants operands in physical registers, but an optimizing compiler creates many more temporary values than the hardware can hold at once. Register allocation is the pass that decides which virtual values get real registers, which values can reuse the same register at different times, and which values must be stored in memory.',
        'The hard constraint is not variable names or source order. It is liveness. If two values may both be needed in the future at the same program point, assigning them to the same register would overwrite one live value with another. The allocator needs a global view of those conflicts before it can make local instruction choices.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'A tempting allocator walks instructions forward, hands each new temporary the first available register, and spills when the set is full. That can work for tiny straight-line fragments where lifetimes start and end in a simple stack-like order.',
        'Real programs have branches, joins, loops, calls, and values whose live ranges overlap in nonlocal ways. A greedy choice can waste a scarce register on a cold value while forcing a hot loop value into memory. It can also miss move coalescing opportunities that would remove copies entirely.',
        'The wall is that register pressure is global. A choice that looks cheap at one instruction can make a later loop, join block, or call boundary more expensive. The allocator needs a conflict model before it can make local assignments responsibly.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'An interference graph converts the register allocation problem into a graph coloring problem. Nodes are virtual registers or live ranges. An edge means the two nodes are simultaneously live somewhere, so they cannot share a physical register.',
        'Colors are physical registers. A legal coloring assigns colors so every interference edge connects different colors. When the graph cannot be colored with the available register set, the compiler changes the program by spilling, splitting live ranges, rematerializing values, or choosing a different allocation strategy.',
        'The invariant is direct: any two simultaneously live values must either occupy different registers or one of them must be moved somewhere else before the conflict matters.',
      ],
    },
    {
      heading: 'Animation and readouts',
      paragraphs: [
        'In the liveness view, treat each basic block and live-set row as evidence for edges. When the animation highlights a definition and the values live after it, it is showing the moment a storage conflict becomes a graph edge.',
        'In the coloring view, the important motion is remove, stack, select, and possibly spill. Low-degree nodes are easy because there will be a color left when they return. High-pressure nodes are where heuristics enter: the allocator is betting that spilling or splitting one range will make the rest of the graph cheaper.',
        'The pressure plot is a warning readout, not a complete allocator. It says how many values are live, but it does not show register classes, call clobbers, rematerialization cost, two-address instructions, or whether two move-related ranges should be coalesced.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler first computes live-in and live-out sets over the control-flow graph. It then walks machine instructions, usually backward within blocks. When an instruction defines value v, every different value live after that instruction interferes with v, so the graph gets edges from v to those live values.',
        'Move instructions receive special handling. If x is copied to y and x and y do not otherwise interfere, assigning them the same register can remove the copy. Coalescing tries to merge such nodes without making the graph too hard to color.',
        'A Chaitin-style coloring allocator repeatedly simplifies the graph by removing nodes with degree lower than the number of available registers. It pushes removed nodes on a stack, picks spill candidates when pressure is too high, then pops nodes and selects colors. A node that cannot receive a legal color becomes a real spill, and the compiler inserts loads and stores, rebuilds liveness, and allocates again.',
      ],
    },
    {
      heading: 'Why coloring is sound',
      paragraphs: [
        'The graph is sound when every real simultaneous-liveness conflict has an edge. Then a legal coloring is enough to protect program values: adjacent nodes have different registers, so no live value is overwritten by another live value.',
        'The simplification rule is the useful trick. If a node has fewer neighbors than there are registers, then after its neighbors are colored there must be at least one register left for it. Removing that node postpones the choice without losing a future legal color.',
        'The hard cases are high-degree regions and machine constraints. Graph coloring is not magically solved by the model; the model gives the allocator a structure where spill cost, loop depth, register classes, and coalescing can be reasoned about explicitly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bad liveness produces either wrong code or slow code. Missing an interference edge can assign two live values to the same register, which is a correctness bug. Adding false edges can block legal sharing and create unnecessary spills.',
        'Poor spill choices are a performance bug. Spilling a value used on every loop iteration can add loads and stores to the hottest path. Spilling a value that is cheap to recompute may be worse than rematerializing it. Spilling around calls must respect caller-saved registers, callee-saved registers, stack layout, and target ABI rules.',
        'Coalescing can also backfire. Merging move-related nodes removes a copy, but it can raise degree and turn a colorable graph into one that spills. Production allocators constantly trade fewer moves against higher pressure.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The analysis cost starts with a data-flow fixed point for liveness. Graph construction can be heavy when many values are live together, because dense live sets create many interference edges. Coloring itself is heuristic because optimal coloring and optimal spilling are too expensive for normal compilation.',
        'Compile-time cost is only half the story. Runtime cost comes from the generated code: spills, reloads, extra moves, missed coalescing, and register pressure around calls. A slower allocator can be worth it in an ahead-of-time compiler if it saves instructions in hot loops, while a JIT may choose a faster interval-based allocator.',
      ],
    },
    {
      heading: 'Where it wins and where it fits',
      paragraphs: [
        'Interference graphs are the cleanest teaching model for global register allocation. They explain why two live ranges can share a register, why two others cannot, why register pressure matters, and why spilling is a program rewrite rather than a bookkeeping note.',
        'The model is less attractive when compile time dominates. Linear scan and greedy live-interval allocators are common in JITs and large production compilers because they are fast, incremental, and easier to adapt to engineering constraints. Even there, interference remains the underlying safety concept.',
        'The graph model is also incomplete by itself. Real backends handle precolored registers, register classes, paired registers, subregister lanes, two-address instructions, calling conventions, inline assembly constraints, and late code changes. LLVM, for example, keeps machine code close to SSA until allocation, then lowers virtual registers into physical registers and stack slots.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose values a and b are live across a branch. The left path computes c, the right path computes d, and a later join computes e. Liveness says a and b overlap with both branch temporaries, so the interference graph adds edges that prevent destructive sharing.',
        'With only two registers, a wide value f that overlaps a and b may not color cheaply. The allocator can choose f as a spill candidate, insert a store after its definition and reloads before its uses, then run liveness again. The rewrite shortens live ranges so the new graph may fit the register budget.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'When debugging allocator output, start with liveness. Check whether a suspicious spill is caused by true pressure, an overlong live range, a missed copy coalescing opportunity, or a target constraint such as a call-clobbered register.',
        'When designing an allocator, keep the teaching model but do not stop there. Add spill weights based on use frequency and loop depth, split ranges around hot and cold regions, account for register classes, and rerun liveness after rewrite because the program changed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Chaitin et al., Register Allocation & Spilling via Graph Coloring, at https://web.eecs.umich.edu/~mahlke/courses/583f12/reading/chaitin82.pdf and ACM DOI https://dl.acm.org/doi/10.1145/872726.806984; LLVM code generator documentation at https://llvm.org/docs/CodeGenerator.html; and UCLA register allocation reference at https://compilers.cs.ucla.edu/fernando/projects/soc/llvm_doc/regAlloc.html.',
        'Study Data-Flow Worklist Analysis for liveness, Linear Scan Register Allocation for the interval model, Dominance Frontier SSA Construction for SSA inputs, SSA Destruction Phi Elimination & Parallel Copy for lowering phis, Iterated Register Coalescing for move removal, and Calling Convention & Stack Frame Layout for ABI constraints.',
      ],
    },
  ],
};
