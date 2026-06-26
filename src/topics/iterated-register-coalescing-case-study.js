// Iterated register coalescing: remove copy moves by merging non-interfering
// values without destroying the allocator's ability to color the graph.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'iterated-register-coalescing-case-study',
  title: 'Iterated Register Coalescing',
  category: 'Concepts',
  summary: 'Eliminate register-to-register moves by safely merging copy-related live ranges while simplify, freeze, spill, and select phases preserve colorability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['move coalescing', 'iterated allocator'], defaultValue: 'move coalescing' },
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

function coalesceGraph(title, merged = false) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.0, y: 2.3, note: 'R1' },
      { id: 'b', label: 'B', x: 1.0, y: 5.7, note: 'R2' },
      { id: 'x', label: merged ? 'XY' : 'X', x: 3.3, y: 4.0, note: merged ? 'merged' : 'copy src' },
      { id: 'y', label: 'Y', x: 5.6, y: 4.0, note: 'copy dst' },
      { id: 'c', label: 'C', x: 7.6, y: 2.6, note: 'R1' },
      { id: 'd', label: 'D', x: 7.6, y: 5.4, note: 'R2' },
    ],
    edges: merged ? [
      { id: 'i-a-x', from: 'a', to: 'x' },
      { id: 'i-b-x', from: 'b', to: 'x' },
      { id: 'i-x-c', from: 'x', to: 'c' },
      { id: 'i-x-d', from: 'x', to: 'd' },
      { id: 'i-c-d', from: 'c', to: 'd' },
    ] : [
      { id: 'i-a-x', from: 'a', to: 'x' },
      { id: 'i-b-x', from: 'b', to: 'x' },
      { id: 'm-x-y', from: 'x', to: 'y', weight: 'move' },
      { id: 'i-y-c', from: 'y', to: 'c' },
      { id: 'i-y-d', from: 'y', to: 'd' },
      { id: 'i-c-d', from: 'c', to: 'd' },
    ],
  }, { title });
}

function allocatorGraph(title) {
  return graphState({
    nodes: [
      { id: 'moves', label: 'moves', x: 0.8, y: 4.0, note: 'copies' },
      { id: 'simp', label: 'simplify', x: 2.6, y: 2.2, note: 'low deg' },
      { id: 'coal', label: 'coalesce', x: 2.6, y: 5.8, note: 'safe merge' },
      { id: 'freeze', label: 'freeze', x: 4.8, y: 5.8, note: 'give up' },
      { id: 'spill', label: 'spill', x: 4.8, y: 2.2, note: 'high deg' },
      { id: 'select', label: 'select', x: 7.0, y: 4.0, note: 'color' },
      { id: 'rewrite', label: 'rewrite', x: 8.8, y: 4.0, note: 'if spill' },
    ],
    edges: [
      { id: 'e-moves-simp', from: 'moves', to: 'simp' },
      { id: 'e-moves-coal', from: 'moves', to: 'coal' },
      { id: 'e-coal-simp', from: 'coal', to: 'simp' },
      { id: 'e-coal-freeze', from: 'coal', to: 'freeze' },
      { id: 'e-freeze-simp', from: 'freeze', to: 'simp' },
      { id: 'e-simp-select', from: 'simp', to: 'select' },
      { id: 'e-spill-select', from: 'spill', to: 'select' },
      { id: 'e-select-rewrite', from: 'select', to: 'rewrite' },
      { id: 'e-rewrite-spill', from: 'rewrite', to: 'spill' },
    ],
  }, { title });
}

function* moveCoalescing() {
  yield {
    state: coalesceGraph('A copy creates a move-related pair'),
    highlight: { active: ['x', 'y', 'm-x-y'], compare: ['a', 'b', 'c', 'd'] },
    explanation: 'If machine code contains Y = X, the allocator would like X and Y to use the same physical register. Then the move can disappear.',
  };

  yield {
    state: labelMatrix(
      'Coalescing checks',
      [
        { id: 'same', label: 'same node' },
        { id: 'edge', label: 'interfere' },
        { id: 'briggs', label: 'Briggs' },
        { id: 'george', label: 'George' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'result', label: 'result' },
      ],
      [
        ['already one', 'done'],
        ['has edge', 'cannot'],
        ['few hi deg', 'safe'],
        ['ok neigh', 'safe'],
      ],
    ),
    highlight: { active: ['briggs:test', 'george:test'], compare: ['edge:result'] },
    explanation: 'Coalescing is safe only when merging the pair will not make the graph harder than the register budget can color. Briggs and George give conservative tests for that decision.',
    invariant: 'A move pair can merge only if the merged live range can still receive one legal color.',
  };

  yield {
    state: coalesceGraph('After a safe merge, one node replaces the copy pair', true),
    highlight: { active: ['x', 'i-a-x', 'i-b-x', 'i-x-c', 'i-x-d'], removed: ['y'], found: ['c', 'd'] },
    explanation: 'The merged node inherits neighbors from both old nodes. If it can still be colored, X and Y share a register and the copy instruction is removed.',
  };

  yield {
    state: labelMatrix(
      'When not to merge',
      [
        { id: 'degree', label: 'high deg' },
        { id: 'pre', label: 'precolor' },
        { id: 'class', label: 'reg class' },
        { id: 'debug', label: 'debug val' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'action', label: 'action' },
      ],
      [
        ['uncolorable', 'freeze'],
        ['fixed reg', 'George'],
        ['bad class', 'split'],
        ['lost loc', 'track'],
      ],
    ),
    highlight: { active: ['degree:action', 'pre:action'], compare: ['class:action'] },
    explanation: 'A copy can be real for target reasons. Precolored nodes, register classes, calling conventions, and debug-value tracking can all block or limit coalescing.',
  };

  yield {
    state: allocatorGraph('Coalescing is part of allocation, not a cleanup pass'),
    highlight: { active: ['moves', 'coal', 'simp', 'select', 'e-moves-coal', 'e-coal-simp', 'e-simp-select'], compare: ['freeze', 'spill'] },
    explanation: 'If coalescing happens too aggressively before coloring, it can introduce spills. Iterated coalescing interleaves safe merges with simplification so the allocator keeps making progress.',
  };
}

function* iteratedAllocator() {
  yield {
    state: allocatorGraph('Iterated coalescing cycles through worklists'),
    highlight: { active: ['moves', 'simp', 'coal', 'freeze'], compare: ['spill', 'rewrite'] },
    explanation: 'The allocator keeps separate worklists: simplifiable nodes, move-related nodes, freeze candidates, spill candidates, and selected stack entries. Moving a node can unlock another phase.',
  };

  yield {
    state: labelMatrix(
      'Worklist moves',
      [
        { id: 'low', label: 'low deg' },
        { id: 'move', label: 'move rel' },
        { id: 'freeze', label: 'freeze' },
        { id: 'spill', label: 'spill cand' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'why', label: 'why' },
      ],
      [
        ['simplify', 'easy color'],
        ['coalesce', 'maybe merge'],
        ['simplify', 'drop move'],
        ['spill', 'too dense'],
      ],
    ),
    highlight: { active: ['low:where', 'move:where', 'freeze:where'], compare: ['spill:where'] },
    explanation: 'Freeze is the compromise between preserving a possible copy elimination and making progress. If a move cannot safely coalesce, freezing lets the node simplify later.',
  };

  yield {
    state: labelMatrix(
      'Briggs vs George',
      [
        { id: 'briggs', label: 'Briggs' },
        { id: 'george', label: 'George' },
        { id: 'pre', label: 'precolor' },
        { id: 'iter', label: 'iterated' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'good', label: 'good for' },
      ],
      [
        ['merged deg', 'plain pair'],
        ['neighbors', 'precolor'],
        ['fixed color', 'ABI regs'],
        ['repeat', 'more moves'],
      ],
    ),
    highlight: { active: ['briggs:checks', 'george:checks'], found: ['iter:good'] },
    explanation: 'George and Appel interleave simplification with conservative coalescing. The interleaving matters because simplifying the graph can make more coalesces safe later.',
  };

  yield {
    state: coalesceGraph('A colored result removes the move if colors match', true),
    highlight: { active: ['x', 'a', 'b', 'c', 'd'], found: ['i-a-x', 'i-x-c'], removed: ['y'] },
    explanation: 'Successful coalescing reduces move count and can reduce register pressure around the copy. Failed coalescing still leaves a colorable graph if the conservative tests did their job.',
  };

  yield {
    state: labelMatrix(
      'Production lesson',
      [
        { id: 'moves', label: 'moves' },
        { id: 'spills', label: 'spills' },
        { id: 'abi', label: 'ABI' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['remove', 'color risk'],
        ['avoid', 'memory ops'],
        ['obey', 'fixed regs'],
        ['preserve', 'location'],
      ],
    ),
    highlight: { active: ['moves:goal', 'spills:goal', 'abi:goal'], compare: ['debug:cost'] },
    explanation: 'Coalescing sits at a real backend tradeoff: fewer moves can be faster, but a bad merge can cause spills, violate target constraints, or make generated debug locations harder to preserve.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'move coalescing') yield* moveCoalescing();
  else if (view === 'iterated allocator') yield* iteratedAllocator();
  else throw new InputError('Pick a coalescing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation extends graph-coloring register allocation with move elimination. A move is a copy instruction such as Y = X. Coalescing means assigning X and Y to the same physical register so the copy can be removed. Interference means two values are live together and must not share a register.',
        'Active nodes show the allocator simplifying, coalescing, freezing, spilling, or selecting colors. A move edge is a preference for sameness. An interference edge is a hard rule for difference. When two nodes merge, the merged node inherits all neighbors, which is where spill risk enters.',
        {type:'callout', text:'Coalescing is safe only when copy removal is negotiated with interference and register pressure, not bolted on after allocation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/90/Petersen_graph_3-coloring.svg', alt:'A Petersen graph whose adjacent vertices have different colors.', caption:'Petersen graph 3-coloring, Chris-martin, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compilers introduce copies during SSA phi elimination, calling-convention lowering, two-address instruction selection, and register-class repair. Some copies are necessary before allocation but become removable if both operands receive the same register.',
        'A separate cleanup pass can delete only accidental identity moves. Iterated register coalescing exists because the allocator can choose registers with those moves in mind while still seeing interference, register pressure, fixed registers, and spill costs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safe approach is allocate first and delete moves where source and destination happened to get the same register. It never breaks correctness, but it misses many copies because allocation did not try to align related values.',
        'The obvious aggressive approach is merge every non-interfering move pair before coloring. That removes many move edges on paper. It can also create larger live ranges with too many neighbors, forcing spills that cost more than the copy saved.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is colorability under k registers. A move edge says two nodes would like the same color. An interference edge says two nodes must have different colors. Merging a move pair combines their neighbor sets, and the combined node may become impossible to color.',
        'Real machines raise the pressure. Some nodes are precolored to fixed registers, some values need a register class, some calls clobber registers, and debug or garbage-collector metadata may need precise value locations. A coalescer cannot treat copy removal as a local string rewrite.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Coalesce conservatively and iteratively. Simplification can lower degrees, which can make a later merge safe. Freezing a move can stop it from blocking progress. Spill selection remains available when neither simplification nor safe coalescing can proceed.',
        'The allocator is a worklist process, not a one-shot merge pass. Nodes move between simplifiable, move-related, freeze, spill, coalesced, colored, and stack states as degrees and move sets change.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The allocator starts with an interference graph and a set of move-related pairs. Simplify removes a low-degree node that is not currently tied to important moves. Coalesce tries to merge a move pair only if a conservative test predicts that coloring remains safe. Freeze gives up on selected move edges so the node can simplify.',
        'When no safer action exists, select-spill chooses a high-pressure node. After reduction, select pops nodes from the stack and assigns legal colors. If a node cannot be colored, the compiler inserts spill code, recomputes liveness, rebuilds the graph, and runs the loop again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness still comes from the interference graph. A coalesced node represents two values assigned to one register, and that is legal only if the original values did not interfere and the merged node can still receive a color different from its neighbors.',
        'Conservative tests protect a path to coloring. Briggs-style tests limit dangerous high-degree neighbors of the merged node. George-style tests protect merges involving precolored nodes. The tests are not perfect, but they reject merges likely to turn a cheap copy into expensive spills.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The algorithm maintains adjacency sets, degree counts, move sets, aliases for merged nodes, spill costs, worklists, and a select stack. Cost grows with graph density and move count. A small function with many overlapping live ranges can be harder than a larger function with short lifetimes.',
        'Runtime code quality is the real target. Removing a register-to-register move might save one cheap instruction. Causing one spilled value in a loop can add a load and store on every iteration. Coalescing is profitable only when the saved moves outweigh the pressure it creates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Iterated coalescing fits optimizing compilers and high-tier JIT compilers that already pay for graph-coloring allocation. It is especially useful after SSA destruction, where phi nodes become parallel copies and many values are move-related.',
        'It also helps targets with tight register files, fixed registers, or expensive moves. Integrated coalescing can respect the target register model while reducing copy traffic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It can be too expensive for a fast compile tier. Linear scan allocation often gives lower compile latency with acceptable code quality for short-lived JIT code. Peak code quality is not the only engineering constraint.',
        'It also fails through over-coalescing, under-coalescing, and target-rule mistakes. Merging incompatible register classes is illegal. Ignoring precolored constraints can violate the ABI. Losing value-location information can break debugging, stack maps, deoptimization, or garbage collection.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose there are k = 3 registers. Move Y = X is present. X interferes with A and B. Y interferes with C and D. X and Y do not interfere with each other, so the copy could be removed if they merge.',
        'Before merging, X has degree 2 and Y has degree 2, both easy to color. After merging, XY has neighbors A, B, C, and D, so degree 4. If A, B, and C already require all 3 colors, XY may spill, adding memory traffic. A conservative coalescer delays the merge until simplification proves that fewer dangerous neighbors remain, or it freezes the move and keeps the graph colorable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: George and Appel, Iterated Register Coalescing, 1996; Briggs, Cooper, and Torczon, Improvements to Graph Coloring Register Allocation, 1994; and Chaitin et al., Register Allocation and Spilling via Graph Coloring, 1982.',
        'Study interference graphs, liveness analysis, graph coloring register allocation, SSA phi elimination, parallel copy resolution, linear scan allocation, spill code insertion, and target calling conventions next. The useful exercise is to try one unsafe merge and count the spills it creates.',
      ],
    },
  ],
};