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
      heading: 'What it is',
      paragraphs: [
        'Register coalescing removes copy instructions by assigning the copy source and destination to the same physical register. Iterated register coalescing does this during graph-coloring allocation rather than as a blind cleanup pass.',
        'The problem is that merging two non-interfering nodes changes the interference graph. A merge that removes one move can make the graph harder to color and introduce spills. The art is deciding which copy pairs are safe enough to merge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The allocator tracks move-related nodes in addition to interference edges. If a copy pair already interferes, it cannot merge. If the pair does not interfere, Briggs and George style tests estimate whether the merged node remains colorable under K registers.',
        'Iterated coalescing alternates simplification, conservative coalescing, freezing, spill selection, and coloring. Simplification can reduce degrees, which makes later coalescing safe. Freezing gives up on a move when preserving it would prevent progress.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose machine SSA lowering creates Y = X along an edge. X interferes with A and B, while Y interferes with C and D. If X and Y do not interfere with each other, coalescing them creates one node XY with neighbors A, B, C, and D. If that merged degree is still safe for the target register budget, the allocator colors XY once and deletes the move.',
        'If XY would be too constrained, the allocator freezes or leaves the move alone. That keeps the graph colorable. A single register-to-register move is usually cheaper than causing a spill load and store around several uses.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Coalescing interacts with phi elimination, two-address instruction constraints, register classes, fixed ABI registers, subregister lanes, rematerialization, and debug information. The clean graph story is only the allocator core.',
        'LLVM and similar backends do aggressive copy elimination, but production allocators also split live ranges, prioritize spill costs, and preserve target constraints. Coalescing is strongest when it is integrated into the allocator worklists rather than run as a separate final pass.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: George and Appel, Iterated Register Coalescing, at https://c9x.me/compile/bib/irc.pdf and ACM DOI https://dl.acm.org/doi/10.1145/229542.229546; Briggs optimistic coalescing DOI https://dl.acm.org/doi/10.1145/1011508.1011512; Carnegie Mellon coalescing lecture at https://www.cs.cmu.edu/afs/cs/academic/class/15745-s19/www/lectures/L23-Register-Coalescing.pdf; and LLVM code generator documentation at https://llvm.org/docs/CodeGenerator.html. Study Interference Graph Register Allocation, Linear Scan Register Allocation, SSA Destruction Phi Elimination & Parallel Copy, Calling Convention & Stack Frame Layout, Instruction Selection DAG & GlobalISel, and Deoptimization Stack Maps & Safepoints next.',
      ],
    },
  ],
};
