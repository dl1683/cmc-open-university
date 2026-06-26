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
        'The animation connects compiler liveness to graph coloring. A virtual register is a compiler-created temporary value before it is assigned to a real machine register. A live value is one whose current contents may be used later. An interference edge means two values are live at the same time and cannot share one register.',
        'In the liveness view, active blocks are being analyzed and found edges show conflicts discovered from live sets. In the coloring view, active nodes are being assigned physical registers, compare nodes are spill candidates, and removed nodes show values that must move to memory. The pressure plot shows how many values are live at each point.',
        {type:'callout', text:'Register allocation becomes tractable when simultaneous liveness is encoded as graph edges and colors become physical registers.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b7/Graph_with_all_three-colourings_2.svg', alt:'Colored graph showing valid three-colorings', caption:'Graph showing valid three-colorings by Arbor and Booyabazooka, via Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A compiler creates many more temporary values than a CPU has registers. x86-64 has a limited set of general-purpose registers, and some are constrained by calling conventions or instructions. The compiler must decide which live values stay in registers and which values spill to stack memory.',
        'The hard rule is simultaneous liveness. If value a and value b are both needed after the same instruction, they cannot occupy the same register. Register allocation exists to enforce that rule while keeping hot values out of memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a forward scan. When a value appears, give it a free register. When the register file is full, spill something. This works for short straight-line code where lifetimes begin and end in a simple order.',
        'The approach is attractive because it is fast and easy to debug. A related production method, linear scan allocation, is still used in fast JIT tiers. The weakness is that local source order does not reveal all conflicts across branches, loops, and joins.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is global liveness. A value defined before an if statement may be used after the join, so it is live through both arms even if it is not mentioned in one arm. A loop value can stay live across a back edge. A forward allocator can assign a register that looks free locally but is needed on another path.',
        'The cost of a wrong decision is not a slow program. It is a wrong program. If two live values share a register, writing one destroys the other. The allocator needs a complete conflict model before it can assign registers safely.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Build an interference graph. Each node is a live range, meaning the span where one value must be preserved. Add an edge between two nodes when the values are live together at any program point. Physical registers become colors.',
        'A legal coloring assigns each node a color different from all neighboring nodes. If there are k usable registers and the graph can be colored with k colors, the function can run without spills for those values. If not, the compiler rewrites selected values to memory and tries again on shorter live ranges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler first runs liveness analysis backward over the control-flow graph. For every instruction, it computes live-in values and live-out values. When an instruction defines value v, every other value in the live-out set interferes with v, so the compiler adds graph edges from v to those values.',
        'The allocator then simplifies the graph. If a node has degree less than k, it can be removed and pushed on a stack because its neighbors can use at most k - 1 colors when it returns. When no easy node remains, the allocator chooses a spill candidate using cost estimates such as loop depth and use count. Finally it pops the stack and assigns each node an available register.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The graph is sound if every pair of simultaneously live values has an edge. Given that property, a legal coloring guarantees that no instruction point contains two live values in the same register. The local machine-code assignment is safe because the global conflicts were encoded before coloring.',
        'The simplify rule gives the proof step. A node with fewer than k neighbors can always be colored after the rest of the graph, because those neighbors can block at most k - 1 colors. Spilling is also sound because it changes the program by storing and reloading the value, which shortens or removes its live range in the next graph.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Liveness costs grow with the number of blocks, edges, and variables until the fixed point stabilizes. Graph construction costs grow with live-set size: if 30 values are live together, many edges are created at once. Dense live sets make allocation harder than long code with short lifetimes.',
        'Optimal graph coloring is expensive in the general case, so compilers use heuristics. The simplify and select passes are close to linear in graph nodes plus edges, but spill quality dominates program speed. One bad spill in a hot loop can add millions of loads and stores at runtime.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Graph-based register allocation is used in optimizing compilers where generated code quality matters. The same conflict model appears in GCC, LLVM-style allocators, and teaching compilers, even when the production allocator uses extra target-specific rules.',
        'The same abstraction appears outside compilers. Exam scheduling can model exams as nodes and shared students as edges. Radio channel assignment can model transmitters as nodes and interference as edges. The mechanism is useful whenever mutually incompatible items must receive a limited number of labels.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A missing edge is a correctness bug because two live values may share a register. A false edge is a performance bug because it can force unnecessary spills. Liveness precision is therefore part of code correctness and code quality.',
        'The simple graph also misses real machine constraints. Registers may have classes, fixed uses, subregisters, caller-saved rules, callee-saved rules, and paired-register requirements. Production allocators extend the graph model with these constraints rather than using pure textbook coloring.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose there are two physical registers, R1 and R2, and virtual values a, b, c, and d. Liveness finds edges a-b, a-c, b-c, and c-d. The triangle a, b, c already needs three colors, because each pair is live together. With only two registers, at least one of a, b, or c must spill.',
        'If c is used once outside a loop and a and b are used 100 times inside a loop, c is the likely spill. The compiler stores c after its definition and reloads it before its later use. The rewritten graph may leave a-b as the only hot conflict, so a gets R1, b gets R2, and c pays a small memory cost instead of forcing loop spills.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chaitin et al., Register Allocation and Spilling via Graph Coloring, 1982; Briggs, Cooper, and Torczon, Improvements to Graph Coloring Register Allocation, 1994; and George and Appel, Iterated Register Coalescing, 1996.',
        'Study data-flow analysis first, then liveness, graph coloring, linear scan allocation, spill code insertion, calling conventions, SSA destruction, and iterated register coalescing. The next useful exercise is to compute live sets for a small branch and build its interference graph by hand.',
      ],
    },
  ],
};