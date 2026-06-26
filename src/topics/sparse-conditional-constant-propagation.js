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
  const latticeNodes = [
    { id: 'unknown', label: 'unknown', x: 1.6, y: 4.0, note: 'not reached' },
    { id: 'const', label: 'const k', x: 5.0, y: 2.5, note: 'all live paths' },
    { id: 'over', label: 'overdef', x: 8.4, y: 4.0, note: 'varies' },
  ];
  const latticeEdges = [
    { id: 'e-unknown-const', from: 'unknown', to: 'const', weight: 'learn k' },
    { id: 'e-unknown-over', from: 'unknown', to: 'over', weight: 'unknown op' },
    { id: 'e-const-over', from: 'const', to: 'over', weight: 'conflict' },
  ];
  yield {
    state: graphState({ nodes: latticeNodes, edges: latticeEdges }, { title: 'SCCP value lattice' }),
    highlight: { active: ['unknown', 'const', 'e-unknown-const'], compare: ['over', 'e-const-over'] },
    explanation: `SCCP tracks each SSA value in a ${latticeNodes.length}-state lattice. ${latticeNodes[0].label} means not enough executable evidence yet. ${latticeNodes[1].label} means every executable path agrees. ${latticeNodes[2].label} means the value varies or is not computable as a constant.`,
  };

  const cfgTitle = 'SCCP also tracks which CFG edges are executable';
  const cfgState = sccpGraph(cfgTitle);
  const cfgNodeCount = cfgState.nodes.length;
  const cfgEdgeCount = cfgState.edges.length;
  yield {
    state: cfgState,
    highlight: { active: ['entry', 'branch', 'e-entry-branch', 'vwork', 'ework'], compare: ['then', 'else'] },
    explanation: `Ordinary constant propagation usually assumes all CFG paths may execute. SCCP carries a second fact across ${cfgNodeCount} nodes and ${cfgEdgeCount} edges: which edges are executable. That makes branch pruning and value propagation reinforce each other.`,
    invariant: `A phi only considers incoming values from executable predecessor edges, ignoring the remaining ${cfgEdgeCount - 1} edges when they are dead.`,
  };

  const branchNote = '2<3 true';
  const thenNote = 'exec';
  const elseNote = 'dead';
  yield {
    state: sccpGraph('A constant branch marks only one successor executable', { branch: branchNote, then: thenNote, else: elseNote, ework: 'then only' }),
    highlight: { active: ['branch', 'then', 'e-branch-then', 'ework', 'e-ework-then'], removed: ['else', 'e-branch-else'] },
    explanation: `If the branch condition becomes constant (${branchNote}), SCCP marks the true edge ${thenNote} and leaves the false edge ${elseNote}. Instructions reachable only through the dead edge do not pollute phi results.`,
  };

  const worklistRows = [
    { id: 'value', label: 'value worklist' },
    { id: 'edge', label: 'edge worklist' },
    { id: 'phi', label: 'phi visit' },
    { id: 'branch', label: 'branch visit' },
  ];
  const worklistCols = [
    { id: 'contains', label: 'contains' },
    { id: 'effect', label: 'effect' },
  ];
  yield {
    state: labelMatrix(
      'Two worklists, one fixpoint',
      worklistRows,
      worklistCols,
      [
        ['SSA users of changed values', 'recompute operations'],
        ['new executable CFG edges', 'visit blocks'],
        ['executable inputs only', 'may become constant'],
        ['constant condition', 'may kill edge'],
      ],
    ),
    highlight: { active: ['value:effect', 'edge:effect'], found: ['phi:effect', 'branch:effect'] },
    explanation: `The algorithm is sparse because it uses ${worklistRows.length} worklist categories (${worklistRows[0].label}, ${worklistRows[1].label}, ${worklistRows[2].label}, ${worklistRows[3].label}) to follow SSA use-def edges and newly executable CFG edges instead of repeatedly scanning every block until nothing changes.`,
  };
}

function* deadBranchCaseStudy() {
  const entryNote = 'a=2 b=3';
  const thenConst = 'c1=4';
  const elseConst = 'c2=5';
  yield {
    state: sccpGraph('Start from constants a=2 and b=3', { entry: entryNote, branch: 'unknown', then: thenConst, else: elseConst, phi: 'c3=?' }),
    highlight: { active: ['entry', 'vwork', 'e-entry-branch'], compare: ['then', 'else'] },
    explanation: `The program initializes ${entryNote} as constants, then branches on a < b. SCCP puts users of a and b on the value worklist and starts from the entry edge, with then computing ${thenConst} and else computing ${elseConst}.`,
  };

  const evalBranch = 'true';
  const evalThen = 'exec';
  const evalElse = 'not exec';
  yield {
    state: sccpGraph('Evaluate the branch under current lattice facts', { branch: evalBranch, then: evalThen, else: evalElse, phi: 'c3=?' }),
    highlight: { active: ['branch', 'e-branch-then', 'then'], removed: ['else', 'e-branch-else'], found: ['ework'] },
    explanation: `Because 2 < 3 is ${evalBranch}, only the then edge becomes ${evalThen}. The else block is ${evalElse}, so ${elseConst} does not contribute to the phi.`,
  };

  const phiResult = 'c3=4';
  const retResult = 'return 4';
  yield {
    state: sccpGraph('The phi sees only executable incoming values', { then: thenConst, else: 'dead c2=5', phi: phiResult, ret: retResult }),
    highlight: { active: ['then', 'phi', 'ret', 'e-then-phi', 'e-phi-ret'], removed: ['else', 'e-else-phi'] },
    explanation: `The phi has 2 syntactic inputs, but only the then predecessor (${thenConst}) is executable. That lets ${phiResult} become constant instead of overdefined between 4 and 5.`,
    invariant: `Dead edges do not make live values less precise — the final result is ${retResult}.`,
  };

  const payoffRows = [
    { id: 'branch', label: 'branch' },
    { id: 'else', label: 'else block' },
    { id: 'phi', label: 'phi c3' },
    { id: 'return', label: 'return' },
  ];
  const payoffCols = [
    { id: 'before', label: 'before SCCP' },
    { id: 'after', label: 'after SCCP' },
  ];
  yield {
    state: labelMatrix(
      'Optimization payoff',
      payoffRows,
      payoffCols,
      [
        ['if a<b', 'goto then'],
        ['c2=5', 'unreachable'],
        ['phi(4,5)', '4'],
        ['return c3', 'return 4'],
      ],
    ),
    highlight: { active: ['branch:after', 'phi:after', 'return:after'], removed: ['else:after'] },
    explanation: `SCCP simplifies ${payoffRows.length} constructs (${payoffRows.map(r => r.label).join(', ')}), comparing ${payoffCols[0].label} vs ${payoffCols[1].label}. Removing a dead edge can expose constants, and exposing constants can remove more dead edges.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as compiler intermediate representation in SSA form. SSA means each variable name is assigned once, and phi nodes at joins choose a value based on which incoming control-flow edge ran.',
        {type: 'image', src: './assets/gifs/sparse-conditional-constant-propagation.gif', alt: 'Animated walkthrough of the sparse conditional constant propagation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active values move through the lattice unknown, constant, and overdefined. Active edges are control-flow edges proven executable. The safe rule is that a phi may merge only operands from executable predecessors.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sparse conditional constant propagation, or SCCP, exists because constant values and reachability feed each other. A constant branch condition can kill an edge, and a dead edge can stop a phi from merging a conflicting value.',
        {type: 'callout', text: 'SCCP is precise because reachability is a value fact: dead edges are excluded before phi nodes merge operands.'},
        'Separate compiler passes often need several rounds: propagate constants, simplify branches, remove dead blocks, and propagate again. SCCP finds that combined fixed point directly over SSA values and executable edges.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is ordinary constant propagation. If x = 2 and y = 3, replace x + y with 5, and repeat until no expression changes.',
        'That works for straight-line code and for joins where every predecessor can really execute. It becomes pessimistic when program text contains branches that constants already prove unreachable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is premature merging. A phi that merges every written operand can combine a live constant with a value from a dead branch and mark the result overdefined.',
        'That pessimism spreads. Once one value becomes overdefined, its users can become overdefined, branch conditions stay unknown, and more dead edges appear live to the analysis.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make edge executability a first-class fact. An edge is not live just because it appears in the control-flow graph; SCCP marks it executable only when known control can take it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Examples of control flow graph shapes with branches and loops', caption: 'SCCP needs edge-level reachability because constants flow through branches, joins, and loops. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
        'That changes phi handling. Constants decide branches, decided branches remove impossible phi operands, simpler phis create more constants, and those constants may decide more branches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SCCP stores a lattice state for each SSA value and an executable bit for each control-flow edge. Unknown means no executable evidence yet, constant means all executable evidence agrees, and overdefined means the value varies or is not modeled as one constant.',
        'The algorithm uses worklists. Value changes revisit SSA users. Newly executable edges revisit the destination block and the phi operands exposed by that edge. A branch with a constant condition marks only the feasible successor executable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the executable-evidence invariant. A value fact is based only on operations reachable through executable edges. Ignoring a non-executable phi operand is sound because no discovered execution can arrive on that edge.',
        'Termination follows from monotonicity. A value can move from unknown to constant to overdefined, but not backward. An edge can become executable only once, so finite values and edges give a finite fixed point.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sparse processing avoids rescanning the whole program after every change. Work follows SSA use-def links and newly executable edges, so practical cost is close to the relevant instructions, edges, and lattice transitions.',
        'Each value changes state only a small number of times, and each edge becomes executable at most once. Calls, memory operations, floating-point corner cases, poison values, and undefined behavior often force overdefined and reduce precision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SCCP is useful after inlining, specialization, template expansion, and interprocedural propagation expose constants. It turns fixed branch outcomes into simpler values and unreachable blocks.',
        'It fits SSA compiler middle ends because phi nodes and use-def chains are already explicit. Optimizers use SCCP-like reasoning before dead-code elimination, register allocation, and code generation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the needed fact does not fit the lattice. Alias-heavy memory, unknown calls, volatile operations, exceptions, NaNs, poison, overflow rules, and target-specific semantics can force overdefined.',
        'It also fails if folding ignores language or IR rules. A compiler must respect traps, undefined behavior, memory ordering, and floating-point semantics rather than applying informal algebra.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a = 2; b = 3; if (a < b) c = 4; else c = 5; return c. The entry edge is executable, so a and b become constants. The comparison a < b becomes true.',
        'SCCP marks the then edge executable and leaves the else edge not executable. At the join, the phi for c has operands 4 and 5, but only the then predecessor is executable, so c becomes constant 4.',
        'The return becomes return 4. A later cleanup pass can replace the branch with a jump and delete the else block. Ordinary propagation that merges both phi operands too early would lose this result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Wegman and Zadeck on SCCP and the Cornell CS6120 implementation note. Compare SCCP with dense data-flow analysis to see what SSA sparsity changes.',
        'Next study Static Single Assignment, Phi Nodes, Data-Flow Worklist Analysis, Control-Flow Graphs, Dominator Trees, Dominance Frontiers, Dead-Code Elimination, MemorySSA, and Abstract Interpretation.',
      ],
    },
  ],
};
