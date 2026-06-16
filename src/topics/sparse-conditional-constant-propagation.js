// Sparse conditional constant propagation: combine SSA value facts with CFG edge
// executability so constants and dead branches reinforce each other.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-conditional-constant-propagation',
  title: 'Sparse Conditional Constant Propagation',
  category: 'Concepts',
  summary: 'SCCP runs on SSA values and executable CFG edges at once: constants make branches dead, and dead branches make more phi values constant.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lattice and executable edges', 'dead branch case study'], defaultValue: 'lattice and executable edges' },
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

function sccpGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 0.8, y: 4.0, note: notes.entry ?? 'a=2,b=3' },
      { id: 'branch', label: 'branch', x: 2.8, y: 4.0, note: notes.branch ?? 'a<b?' },
      { id: 'then', label: 'then', x: 4.9, y: 2.2, note: notes.then ?? 'c1=4' },
      { id: 'else', label: 'else', x: 4.9, y: 5.8, note: notes.else ?? 'c2=5' },
      { id: 'phi', label: 'phi c3', x: 7.0, y: 4.0, note: notes.phi ?? 'merge' },
      { id: 'ret', label: 'return', x: 9.0, y: 4.0, note: notes.ret ?? 'c3' },
      { id: 'vwork', label: 'value worklist', x: 2.8, y: 1.2, note: notes.vwork ?? 'SSA uses' },
      { id: 'ework', label: 'edge worklist', x: 2.8, y: 6.8, note: notes.ework ?? 'CFG edges' },
    ],
    edges: [
      { id: 'e-entry-branch', from: 'entry', to: 'branch', weight: 'exec' },
      { id: 'e-branch-then', from: 'branch', to: 'then', weight: 'T' },
      { id: 'e-branch-else', from: 'branch', to: 'else', weight: 'F' },
      { id: 'e-then-phi', from: 'then', to: 'phi', weight: 'c1' },
      { id: 'e-else-phi', from: 'else', to: 'phi', weight: 'c2' },
      { id: 'e-phi-ret', from: 'phi', to: 'ret', weight: 'use' },
      { id: 'e-vwork-branch', from: 'vwork', to: 'branch', weight: 'fact' },
      { id: 'e-ework-then', from: 'ework', to: 'then', weight: 'mark' },
      { id: 'e-ework-else', from: 'ework', to: 'else', weight: 'mark' },
    ],
  }, { title });
}

function* latticeAndEdges() {
  yield {
    state: graphState({
      nodes: [
        { id: 'unknown', label: 'unknown', x: 1.6, y: 4.0, note: 'not reached' },
        { id: 'const', label: 'const k', x: 5.0, y: 2.5, note: 'all live paths' },
        { id: 'over', label: 'overdef', x: 8.4, y: 4.0, note: 'varies' },
      ],
      edges: [
        { id: 'e-unknown-const', from: 'unknown', to: 'const', weight: 'learn k' },
        { id: 'e-unknown-over', from: 'unknown', to: 'over', weight: 'unknown op' },
        { id: 'e-const-over', from: 'const', to: 'over', weight: 'conflict' },
      ],
    }, { title: 'SCCP value lattice' }),
    highlight: { active: ['unknown', 'const', 'e-unknown-const'], compare: ['over', 'e-const-over'] },
    explanation: 'SCCP tracks each SSA value in a small lattice. Unknown means not enough executable evidence yet. Constant means every executable path agrees. Overdefined means the value varies or is not computable as a constant.',
  };

  yield {
    state: sccpGraph('SCCP also tracks which CFG edges are executable'),
    highlight: { active: ['entry', 'branch', 'e-entry-branch', 'vwork', 'ework'], compare: ['then', 'else'] },
    explanation: 'Ordinary constant propagation usually assumes all CFG paths may execute. SCCP carries a second fact: which edges are executable. That makes branch pruning and value propagation reinforce each other.',
    invariant: 'A phi only considers incoming values from executable predecessor edges.',
  };

  yield {
    state: sccpGraph('A constant branch marks only one successor executable', { branch: '2<3 true', then: 'exec', else: 'dead', ework: 'then only' }),
    highlight: { active: ['branch', 'then', 'e-branch-then', 'ework', 'e-ework-then'], removed: ['else', 'e-branch-else'] },
    explanation: 'If the branch condition becomes constant true, SCCP marks the true edge executable and leaves the false edge dead. Instructions reachable only through the dead edge do not pollute phi results.',
  };

  yield {
    state: labelMatrix(
      'Two worklists, one fixpoint',
      [
        { id: 'value', label: 'value worklist' },
        { id: 'edge', label: 'edge worklist' },
        { id: 'phi', label: 'phi visit' },
        { id: 'branch', label: 'branch visit' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['SSA users of changed values', 'recompute operations'],
        ['new executable CFG edges', 'visit blocks'],
        ['executable inputs only', 'may become constant'],
        ['constant condition', 'may kill edge'],
      ],
    ),
    highlight: { active: ['value:effect', 'edge:effect'], found: ['phi:effect', 'branch:effect'] },
    explanation: 'The algorithm is sparse because it follows SSA use-def edges and newly executable CFG edges instead of repeatedly scanning every block until nothing changes.',
  };
}

function* deadBranchCaseStudy() {
  yield {
    state: sccpGraph('Start from constants a=2 and b=3', { entry: 'a=2 b=3', branch: 'unknown', then: 'c1=4', else: 'c2=5', phi: 'c3=?' }),
    highlight: { active: ['entry', 'vwork', 'e-entry-branch'], compare: ['then', 'else'] },
    explanation: 'The program initializes a and b with constants, then branches on a < b. SCCP puts users of a and b on the value worklist and starts from the entry edge.',
  };

  yield {
    state: sccpGraph('Evaluate the branch under current lattice facts', { branch: 'true', then: 'exec', else: 'not exec', phi: 'c3=?' }),
    highlight: { active: ['branch', 'e-branch-then', 'then'], removed: ['else', 'e-branch-else'], found: ['ework'] },
    explanation: 'Because 2 < 3 is true, only the then edge becomes executable. The else block is not visited yet, so c2 = 5 does not contribute to the phi.',
  };

  yield {
    state: sccpGraph('The phi sees only executable incoming values', { then: 'c1=4', else: 'dead c2=5', phi: 'c3=4', ret: 'return 4' }),
    highlight: { active: ['then', 'phi', 'ret', 'e-then-phi', 'e-phi-ret'], removed: ['else', 'e-else-phi'] },
    explanation: 'The phi has two syntactic inputs, but only the then predecessor is executable. That lets c3 become constant 4 instead of overdefined between 4 and 5.',
    invariant: 'Dead edges do not make live values less precise.',
  };

  yield {
    state: labelMatrix(
      'Optimization payoff',
      [
        { id: 'branch', label: 'branch' },
        { id: 'else', label: 'else block' },
        { id: 'phi', label: 'phi c3' },
        { id: 'return', label: 'return' },
      ],
      [
        { id: 'before', label: 'before SCCP' },
        { id: 'after', label: 'after SCCP' },
      ],
      [
        ['if a<b', 'goto then'],
        ['c2=5', 'unreachable'],
        ['phi(4,5)', '4'],
        ['return c3', 'return 4'],
      ],
    ),
    highlight: { active: ['branch:after', 'phi:after', 'return:after'], removed: ['else:after'] },
    explanation: 'SCCP is useful because it simplifies control flow and data flow together. Removing a dead edge can expose constants, and exposing constants can remove more dead edges.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lattice and executable edges') yield* latticeAndEdges();
  else if (view === 'dead branch case study') yield* deadBranchCaseStudy();
  else throw new InputError('Pick an SCCP view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Sparse conditional constant propagation, or SCCP, is a compiler analysis that discovers constants while also discovering unreachable CFG edges. It is sparse because it runs over SSA use-def edges and executable control-flow edges rather than dense per-block fact tables.',
        'The core insight is feedback: a constant branch can make one edge dead, and a dead edge can make a phi node constant because fewer incoming values matter.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each SSA value lives in a lattice: unknown, constant k, or overdefined. The algorithm also tracks whether each CFG edge is executable. It maintains a value worklist for changed SSA values and an edge worklist for newly executable edges.',
        'When an instruction result changes, SCCP revisits its users. When a branch condition becomes constant, SCCP marks only the feasible successor edge executable. Phi nodes merge only the values from executable incoming edges.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For a=2; b=3; if (a<b) c=4; else c=5; return c, SCCP proves the condition true. The false edge is never executable, so the phi at the join sees only c=4. The return becomes return 4, and the else block becomes dead.',
        'A dense analysis that merges both branches too early would see c as either 4 or 5 and mark it overdefined. SCCP stays precise by delaying the merge until an edge is actually executable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The algorithm is efficient on SSA because value uses are explicit and phi inputs are already tied to predecessor edges. The implementation still needs careful handling for calls, memory, undefined values, poison or undef semantics, loops, and interaction with CFG simplification passes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Wegman and Zadeck paper PDF at https://www.cs.utexas.edu/~lin/cs380c/wegman.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/103135.103136, and Cornell CS6120 SCCP implementation note at https://www.cs.cornell.edu/courses/cs6120/2019fa/blog/sccp/. Study Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, MemorySSA Alias Graph, Control Flow Graph & Dominator Tree, and Dead-Code Elimination through Linear Scan Register Allocation next.',
      ],
    },
  ],
};
