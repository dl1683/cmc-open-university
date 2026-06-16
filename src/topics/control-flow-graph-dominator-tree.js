// Control-flow graph and dominator tree: basic blocks, branches, loops,
// dominance, dominance frontiers, and compiler analysis.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'control-flow-graph-dominator-tree',
  title: 'Control Flow Graph & Dominator Tree',
  category: 'Concepts',
  summary: 'Represent a program as basic blocks and edges, then derive dominance, immediate dominators, dominator trees, loops, and dominance frontiers for compiler analysis.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cfg to dominators', 'frontiers and loops'], defaultValue: 'cfg to dominators' },
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

function cfgGraph(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 1.0, y: 4.0, note: 'start' },
      { id: 'test', label: 'test', x: 2.8, y: 4.0, note: 'branch' },
      { id: 'then', label: 'then', x: 4.6, y: 2.6, note: 'x=G' },
      { id: 'else', label: 'else', x: 4.6, y: 5.4, note: 'x=H' },
      { id: 'join', label: 'join', x: 6.5, y: 4.0, note: 'merge' },
      { id: 'loop', label: 'loop', x: 8.2, y: 2.6, note: 'backedge' },
      { id: 'exit', label: 'exit', x: 8.2, y: 5.4, note: 'return' },
    ],
    edges: [
      { id: 'e-entry-test', from: 'entry', to: 'test' },
      { id: 'e-test-then', from: 'test', to: 'then' },
      { id: 'e-test-else', from: 'test', to: 'else' },
      { id: 'e-then-join', from: 'then', to: 'join' },
      { id: 'e-else-join', from: 'else', to: 'join' },
      { id: 'e-join-loop', from: 'join', to: 'loop' },
      { id: 'e-loop-join', from: 'loop', to: 'join' },
      { id: 'e-join-exit', from: 'join', to: 'exit' },
    ],
  }, { title });
}

function domGraph(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 4.8, y: 1.2, note: 'root' },
      { id: 'test', label: 'test', x: 4.8, y: 2.8, note: 'idom entry' },
      { id: 'then', label: 'then', x: 2.8, y: 4.6, note: 'idom test' },
      { id: 'else', label: 'else', x: 4.8, y: 4.6, note: 'idom test' },
      { id: 'join', label: 'join', x: 6.8, y: 4.6, note: 'idom test' },
      { id: 'loop', label: 'loop', x: 6.0, y: 6.3, note: 'idom join' },
      { id: 'exit', label: 'exit', x: 7.8, y: 6.3, note: 'idom join' },
    ],
    edges: [
      { id: 'd-entry-test', from: 'entry', to: 'test' },
      { id: 'd-test-then', from: 'test', to: 'then' },
      { id: 'd-test-else', from: 'test', to: 'else' },
      { id: 'd-test-join', from: 'test', to: 'join' },
      { id: 'd-join-loop', from: 'join', to: 'loop' },
      { id: 'd-join-exit', from: 'join', to: 'exit' },
    ],
  }, { title });
}

function* cfgToDominators() {
  yield {
    state: cfgGraph('A CFG makes control flow explicit'),
    highlight: { active: ['entry', 'test', 'then', 'else', 'join'], compare: ['loop'] },
    explanation: 'A control-flow graph turns code into basic blocks and directed edges. Branches, joins, loops, exits, and exceptional paths become graph structure rather than hidden syntax.',
  };
  yield {
    state: labelMatrix(
      'Dominator rule',
      [
        { id: 'entry', label: 'entry dominates all' },
        { id: 'test', label: 'test dominates join' },
        { id: 'then', label: 'then not dominate join' },
        { id: 'join', label: 'join dominates exit' },
      ],
      [
        { id: 'reason', label: 'reason' },
        { id: 'use', label: 'compiler use' },
      ],
      [
        ['every path starts there', 'root facts'],
        ['all paths pass test', 'branch scope'],
        ['else path skips it', 'needs phi later'],
        ['exit only after join', 'safe placement'],
      ],
    ),
    highlight: { active: ['test:reason', 'then:reason'], found: ['then:use'] },
    explanation: 'Node A dominates node B if every path from entry to B passes through A. Immediate dominators compress that relation into a tree.',
    invariant: 'Dominance is about all paths, not most paths.',
  };
  yield {
    state: domGraph('The dominator tree is a compact analysis result'),
    highlight: { found: ['entry', 'test', 'join', 'exit'], active: ['d-entry-test', 'd-test-join', 'd-join-exit'] },
    explanation: 'The dominator tree removes ordinary CFG edges and keeps immediate-dominator parent links. Many compiler passes ask dominance questions constantly, so caching this tree is a big deal.',
  };
}

function* frontiersAndLoops() {
  yield {
    state: cfgGraph('Backedges reveal natural loops'),
    highlight: { active: ['join', 'loop', 'e-join-loop', 'e-loop-join'], compare: ['exit'] },
    explanation: 'A backedge from a block to one of its dominators marks a natural loop. Loop optimizations need the header, body, exits, and values carried around the backedge.',
  };
  yield {
    state: labelMatrix(
      'Dominance frontier intuition',
      [
        { id: 'then', label: 'then assigns x' },
        { id: 'else', label: 'else assigns x' },
        { id: 'join', label: 'join block' },
        { id: 'loop', label: 'loop header' },
      ],
      [
        { id: 'frontier', label: 'frontier role' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['join is frontier', 'paths meet'],
        ['join is frontier', 'paths meet'],
        ['phi candidate', 'merge values'],
        ['loop phi candidate', 'carry value'],
      ],
    ),
    highlight: { active: ['then:frontier', 'else:frontier', 'join:why'], found: ['loop:why'] },
    explanation: 'A dominance frontier is where a definition stops dominating all incoming paths. That is exactly where SSA phi nodes are usually needed.',
  };
  yield {
    state: domGraph('CFG facts feed later compiler passes'),
    highlight: { active: ['test', 'join', 'loop'], found: ['entry'], compare: ['then', 'else'] },
    explanation: 'Static Single Assignment & Phi Nodes uses dominance frontiers. Register allocation uses liveness over CFG edges. Optimization passes use dominance to prove that a value is available before a use.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cfg to dominators') yield* cfgToDominators();
  else if (view === 'frontiers and loops') yield* frontiersAndLoops();
  else throw new InputError('Pick a CFG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A control-flow graph represents a program as basic blocks connected by possible transfers of control. A dominator tree summarizes which blocks must execute before other blocks. These two structures are the skeleton underneath compiler optimization.',
        'The CFG answers may-flow questions: where can execution go next? The dominator tree answers must-pass questions: which block is unavoidable before this point? Together they support SSA construction, loop detection, code motion, dead-code elimination, and register allocation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic block has one entry point and usually one terminator such as branch, jump, return, or throw. Edges represent possible next blocks. A block A dominates block B if every path from entry to B passes through A. The immediate dominator of B is the nearest strict dominator of B, and immediate-dominator links form the dominator tree.',
        'Dominance frontiers identify where definitions from different paths meet. That makes them the bridge from control flow into Static Single Assignment & Phi Nodes. Loops also appear naturally: a backedge to a dominator creates a loop header and loop body.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider if (cond) x = G; else x = H; return x. The CFG has entry, test, then, else, join, and exit blocks. test dominates then, else, and join. then does not dominate join because the else path reaches join without passing through then. Since two definitions of x meet at join, the join block is in the dominance frontier and needs a merge value in SSA.',
        'For a loop, the header often dominates the loop body, and a body-to-header edge is a backedge. Values updated each iteration need loop phis at the header, because the first iteration value and the backedge value meet there.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'The CFG is cheap to store but expensive to get subtly right. Exceptional control flow, short-circuit boolean operators, switch lowering, early returns, break and continue, and unreachable blocks can all change the edge set. A dominance result is only as correct as the CFG it was computed from.',
        'Practical compilers cache analysis results and invalidate them when passes rewrite blocks or edges. A pass that deletes a block, splits a critical edge, or rotates a loop must either preserve dominance information carefully or force it to be recomputed before the next pass asks dominance questions.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'A useful CFG record stores block id, instruction range, predecessor list, successor list, terminator kind, and optional source span. A useful dominator record stores immediate dominator, children in the dominator tree, dominance queries, and dominance-frontier sets when SSA placement needs them.',
        'These structures also support developer tooling. Coverage tools, profilers, static analyzers, code visualizers, and security scanners all benefit from knowing which paths can execute and which blocks control later blocks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cytron et al., Efficiently Computing Static Single Assignment Form and the Control Dependence Graph, at https://www.cs.utexas.edu/~pingali/CS380C/2010/papers/ssaCytron.pdf, LLVM dominator pass references in https://llvm.org/docs/WritingAnLLVMPass.html, and LLVM pass documentation at https://github.com/llvm/llvm-project/blob/main/llvm/docs/Passes.rst. Study Dominance Frontier SSA Construction, Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, Interference Graph Register Allocation, Symbolic Execution Path Constraints, PGO Edge Counters & Block Frequencies, Graph BFS, Tree Traversals, and Topological Sort next.',
      ],
    },
  ],
};
