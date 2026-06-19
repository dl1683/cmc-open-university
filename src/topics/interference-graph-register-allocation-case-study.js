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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. In "liveness to graph," active nodes are basic blocks whose live sets are being examined. Found markers show where a live-set entry becomes an interference edge. The matrix rows map definitions to the values live alongside them -- each overlap is a conflict that forbids register sharing.',
        'In "color and spill," each graph node is a virtual register. An edge means two values are simultaneously live somewhere. Active nodes are being colored (assigned a physical register). Compare markers highlight spill candidates -- values the allocator may evict to memory. When a node is removed and labeled "spill," the compiler must rewrite the program to store and reload that value.',
        'The pressure plot shows how many values are live at each program point. When the curve rises above the horizontal register-count line, some value must spill. Watch for the moment pressure exceeds capacity -- that is where the allocator earns its keep.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An optimizing compiler generates far more temporary values than a machine has physical registers. x86-64 has 16 general-purpose registers. A single function with loops, branches, and inlined calls can easily produce 50 or 100 virtual values. The compiler must decide which values live in registers, which share a register at different times, and which get evicted to memory.',
        'The constraint is simultaneous liveness. If values a and b might both be needed at the same instruction, they cannot occupy the same register -- writing one would destroy the other. Register allocation is the pass that maps virtual values to physical registers without breaking this rule.',
        'Chaitin observed in 1981 that this is exactly graph coloring. Build a graph where nodes are values and edges connect simultaneously live pairs. Colors are registers. A legal coloring assigns every node a color different from its neighbors. If the graph needs more colors than the machine has registers, some values must be spilled to memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Walk instructions forward, hand each new temporary the first available register, and spill when the set is full. This works for short straight-line code where lifetimes nest cleanly -- value a starts, value b starts inside a, b ends, a ends. A stack discipline is enough.',
        'The approach is not stupid. It is fast, simple, and matches how a human might think about a whiteboard trace. Early compilers used variants of it. For JIT compilers under tight time budgets, a polished version of this idea (linear scan, Poletto and Sarkar 1999) is still standard.',
        'The trouble starts with branches. When a value is defined before a branch and used after a join, its live range crosses control flow. Two values that look independent in source order can be simultaneously live across a loop back-edge or a phi node. A forward walk cannot see these conflicts without a global liveness analysis, and without seeing them it makes assignments that silently corrupt values.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Register pressure is a global property. Assigning register R3 to a cold value in block B1 can force a hot loop value in block B4 to spill, because R3 is still occupied when the loop runs. The forward allocator cannot see this: it commits to R3 at B1 and discovers the damage four blocks later.',
        'Branches make it worse. After an if-else, the join block inherits live values from both sides. A register that was free on the left path may be occupied on the right. Without a conflict model, the allocator either inserts shuffle code at every join or accepts wrong answers.',
        'The wall is that local decisions need global information. The allocator cannot assign a register responsibly without knowing every other value that is alive at the same time, across every path through the function. That is a graph problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Build an interference graph. Each node is a virtual register or live range. Add an edge between two nodes whenever they are simultaneously live at any program point. Now register allocation is graph coloring: assign each node a color (physical register) so that no edge connects two nodes of the same color.',
        'If the graph is k-colorable and the machine has k registers, every value fits. If not, the compiler must change the program -- spill a value to memory, split a live range into shorter pieces, or rematerialize a value by recomputing it instead of storing it.',
        'The invariant is clean: adjacent nodes have different colors, so no two simultaneously live values share a register. Every local assignment decision is safe because the global conflict structure is encoded in the edges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Liveness analysis. The compiler runs a backward data-flow fixed point over the control-flow graph. At each instruction, it computes which values are live-in (needed before this point) and live-out (needed after). The result is a live set per program point.',
        'Step 2: Build the interference graph. Walk instructions (usually backward within each block). When instruction I defines value v, add an edge from v to every other value in the live-out set of I. Those values coexist with v, so they cannot share a register. Move instructions get special treatment: if "x = copy y" and x and y do not otherwise interfere, the allocator may try to assign them the same register to eliminate the copy.',
        'Step 3: Simplify. Chaitin\'s key trick (1981): if a node has degree less than k (number of available registers), remove it and push it on a stack. Its neighbors will use at most k-1 colors, so at least one color will remain for it when it returns. Repeat until no low-degree nodes remain.',
        'Step 4: Spill. If every remaining node has degree >= k, choose a spill candidate. Heuristics consider use frequency, loop depth, and rematerialization cost. Mark the candidate for spilling and continue simplifying. Briggs et al. (1994) improved this with optimistic coloring: push high-degree nodes too and hope a color is available during the select phase.',
        'Step 5: Select. Pop nodes from the stack and assign each one the smallest color not used by its already-colored neighbors. If a color is available, the node gets a register. If not (this can happen with optimistic spill candidates), the node becomes a real spill.',
        'Step 6: Rewrite. For every spilled value, the compiler inserts a store after each definition and a reload before each use. This creates shorter live ranges. Rebuild liveness, rebuild the interference graph, and run allocation again. The process terminates because each round shortens at least one live range.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The interference graph is correct when every pair of simultaneously live values has an edge. Given that, a legal k-coloring guarantees safety: at every instruction, each live value occupies a distinct register, so no write can destroy a live value.',
        'The simplify rule is the engine. A node with degree < k can always be colored after its neighbors, because k neighbors use at most k-1 distinct colors (they share among themselves), leaving at least one for the removed node. This is not a heuristic -- it is a theorem. Removing a low-degree node cannot make the remaining graph harder to color.',
        'Spilling is sound because it changes the program, not the coloring. After rewriting, the spilled value has shorter live ranges with fewer interferences. The new graph is a different, sparser graph. If the allocator keeps shortening ranges, it eventually reaches a graph that is k-colorable. In the worst case, every value gets its own stack slot and the graph has no edges.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Liveness analysis runs a backward data-flow fixed point: O(V * E) in the worst case for the CFG, but converges fast in practice (2-3 passes over most functions). Graph construction is proportional to the sum of live-set sizes across all instructions -- dense live sets produce many edges.',
        'Optimal graph coloring is NP-complete for k >= 3 (Karp 1972). But the Chaitin simplify-select heuristic runs in O(V + E) on the interference graph. It does not guarantee the minimum number of colors, but it finds a legal coloring or identifies spill candidates quickly. For most functions, one or two rounds of simplify-spill-rewrite suffice.',
        'The real cost is often spill quality, not allocator runtime. A bad spill choice adds loads and stores to hot loops. The runtime cost of a spilled inner loop dwarfs any compile-time savings from a faster allocator. Ahead-of-time compilers (GCC, LLVM) spend more time on allocation because the generated code runs millions of times. JIT compilers (V8, HotSpot) use faster but weaker allocators because compile time is part of execution time.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Compiler register allocation is the original and most important application. Chaitin built the first graph-coloring allocator at IBM for the PL.8 compiler (1981). GCC\'s IRA allocator and LLVM\'s greedy allocator both use interference graphs as their conflict model, even though the outer algorithm varies.',
        'The same structure appears in other scheduling problems. Exam timetabling is graph coloring: courses with shared students cannot run in the same slot. Radio frequency assignment is graph coloring: nearby transmitters with the same frequency cause interference. VLSI channel routing assigns wires to tracks so that crossing signals do not short.',
        'Sudoku is a graph coloring instance on 81 nodes with edges connecting cells in the same row, column, or 3x3 box. The puzzle asks for a 9-coloring of a partially colored graph. Any Sudoku solver is implicitly a graph-coloring solver.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Missing an interference edge is a correctness bug. If two values are live together but the graph has no edge between them, the allocator may assign them the same register. One write silently destroys a live value. These bugs are hard to reproduce because they depend on register assignment, which changes with optimization level, instruction scheduling, and target.',
        'Adding false edges is a performance bug. Over-conservative liveness (treating a value as live longer than it truly is) creates unnecessary interferences, raises degree, and forces spills that waste memory bandwidth.',
        'Coalescing is a double-edged optimization. Merging two move-related nodes removes a copy instruction but raises the merged node\'s degree. If the merged node becomes high-degree, it may force spills elsewhere. George and Appel (1996) introduced conservative coalescing rules (the Briggs and George tests) to prevent this, but aggressive coalescing in hot code remains a source of regressions.',
        'The graph model also cannot express every machine constraint cleanly. Register classes (integer vs. float vs. vector), paired registers (ARM\'s 64-bit pairs), subregister lanes (x86 AH/AL within AX), and calling conventions (caller-saved vs. callee-saved) all require extensions beyond the basic coloring model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a function with values a, b, c, d, e, f and two physical registers (R1, R2). Liveness analysis shows: a and b are live together (edge a-b). a interferes with c and d (branch paths). b interferes with c and d. c and d each interfere with e (at the join). e and f interfere. a and b also interfere with f.',
        'Simplify with k=2. Scan for nodes with degree < 2. Node c has edges to a, b, e -- degree 3, too high. Node d also has degree 3. Node e has edges to c, d, f -- degree 3. Node f has edges to e, a, b -- degree 3. Nodes a and b have degree 4 and 4. No node has degree < 2. Every node is a potential spill candidate.',
        'Optimistic approach (Briggs): push f anyway (highest spill cost heuristic says f is cold). After removing f, e drops to degree 2 -- still >= k. Push e. Now c has degree 2 (edges to a, b). Push c. Then d (degree 2). Then b (degree 1). Then a (degree 0).',
        'Select phase: pop a, no neighbors colored, assign R1. Pop b, neighbor a has R1, assign R2. Pop d, neighbors a(R1) and b(R2) -- no color available if we only count true remaining neighbors, but d only interferes with a and b after e and f are removed. Recheck: d\'s current neighbors are a(R1) and b(R2) -- both colors used. d must spill? No: d also lost its edge to e (e is not yet colored). The simplify order matters. With Briggs\'s optimistic approach, d\'s remaining colored neighbors when popped are a(R1) and b(R2), so d spills. Pop c -- same situation, c spills. Pop e, neighbors c and d are spilled, f not yet colored -- assign R1. Pop f, neighbor e has R1, neighbors a(R1) and b(R2) are present -- no color left, f spills.',
        'Result: a=R1, b=R2, e=R1. Values c, d, f are spilled to memory. The compiler inserts stores after their definitions and reloads before their uses, rebuilds liveness, and tries again. The new graph has shorter live ranges and fewer edges, so the second round typically succeeds with fewer or no spills.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Chaitin et al., "Register Allocation & Spilling via Graph Coloring" (ACM SIGPLAN 1982). The paper that introduced interference graphs for register allocation. It defined the simplify-select-spill framework that every later allocator builds on.',
        'Briggs, Cooper, and Torczon, "Improvements to Graph Coloring Register Allocation" (ACM TOPLAS 1994). Added optimistic coloring (push high-degree nodes and hope) and conservative coalescing. The optimistic strategy often avoids spills that Chaitin\'s pessimistic approach would trigger.',
        'George and Appel, "Iterated Register Coalescing" (ACM TOPLAS 1996). Combined simplify, coalesce, freeze, and spill into a single loop. The Briggs test and George test give safe conditions for merging move-related nodes without increasing spills.',
        'Prerequisite: Data-Flow Worklist Analysis -- the backward fixed point that computes liveness. Without live sets, there is no interference graph. Next: Linear Scan Register Allocation -- the interval-based alternative used in JIT compilers when graph coloring is too slow. Extension: Iterated Register Coalescing -- the production-grade algorithm that adds move elimination to the coloring framework. Architecture context: Calling Convention & Stack Frame Layout -- the ABI rules that constrain which registers the allocator can use across calls.',
      ],
    },
  ],
};
