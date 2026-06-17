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
      heading: 'Why this exists',
      paragraphs: [
        `Sparse conditional constant propagation, usually called SCCP, exists because constant propagation and reachability are not independent compiler problems. A constant condition can prove that a branch will not run. A dead branch can prove that a phi node has only one live incoming value. Those facts feed each other.`,
        `A compiler that separates the two problems often needs several cleanup rounds. First it discovers constants, then it simplifies branches, then it removes dead blocks, then it may discover more constants. SCCP puts value facts and executable control-flow edges into one sparse fixed point so the compiler can find the combined result directly.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is ordinary constant propagation over the control-flow graph. Start with known constants, evaluate operations whose inputs are known, and repeat until no value changes. Then another pass can simplify branches whose conditions became constant.`,
        `The wall appears at joins. If the analysis assumes every syntactic edge may execute, a phi node must merge values from branches that are actually unreachable. A value that is constant on every real path may be marked overdefined because a dead predecessor contributed a conflicting value.`,
        `This is not only a missed optimization. Once a value becomes overdefined, its users may also become overdefined, and branch conditions that should have simplified may stay unknown. Treating dead paths as live can spread pessimism through the SSA graph.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to make executable edges first-class facts. An edge is not considered live just because it appears in the CFG. It becomes executable only after SCCP has evidence that control can reach it.`,
        `That one extra fact changes phi handling. A phi node merges only operands whose predecessor edges are executable. Dead code cannot poison live values. Constants decide branches, decided branches remove incoming phi operands, simpler phis create more constants, and those constants may decide more branches.`,
      ],
    },
    {
      heading: 'The invariant',
      paragraphs: [
        `The main invariant is simple: a value fact is based only on executable evidence. A phi with two written operands is not forced to merge both operands unless both predecessor edges can run. This is what lets SCCP be more precise than ordinary constant propagation.`,
        `The second invariant is monotonicity. Value states move from unknown to a constant and, if later executable evidence conflicts, to overdefined. Edges move from not executable to executable. The algorithm never needs to make a fact more optimistic, so the fixed point is stable.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The lattice view shows why SCCP is cautious. Unknown means the compiler does not yet have executable evidence. A constant means all executable evidence agrees on one value. Overdefined means the value varies, is not modeled, or has conflicting executable inputs.`,
        `The graph view shows the part ordinary constant propagation usually hides: the edge worklist. The branch can mark only the true successor executable when the condition is known. The dead-branch case then shows the payoff at the phi: the else value exists in the program text, but it does not enter the merge because its edge was never proven executable.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `SCCP maintains two worklists. The value worklist contains SSA users of values whose lattice state changed. The edge worklist contains CFG edges that just became executable and may expose a block that was previously ignored.`,
        `For ordinary operations, SCCP evaluates a transfer function under the current operand facts. Adding two constants can produce a constant. Adding an overdefined value usually produces overdefined. Operations with unsupported or unsafe semantics may also force overdefined.`,
        `For branches, a constant condition marks only the feasible successor. An overdefined condition marks every possible successor. For phis, the merge looks only at operands from executable predecessor edges. The algorithm stops when both worklists are empty.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument comes from the two invariants. If an edge has not been proven executable, no real execution discovered by the analysis can reach the block through that edge. Ignoring that edge at a phi is the same reachability fact applied before value merging.`,
        `Monotonic updates guarantee termination. There are only a few states per SSA value and one executability bit per CFG edge. Each fact can change only a small number of times. When the worklists drain, all consequences expressible by this lattice have already been propagated through the reachable part of the program.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Take this program: a = 2; b = 3; if (a < b) c = 4; else c = 5; return c. The entry edge is executable, so a and b become constants. The branch condition evaluates to true, so SCCP marks the then edge executable and leaves the else edge not executable.`,
        `At the join, the phi for c has two written operands: 4 from then and 5 from else. Only the then predecessor is executable, so the phi becomes constant 4 rather than overdefined between 4 and 5. The return becomes return 4, and later cleanup can replace the branch with a jump and delete the unreachable else block.`,
        `This is the exact case that ordinary constant propagation can miss if it merges both phi operands before reachability is known. SCCP does not need a later pass to tell it that the false edge should not affect the live value.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `SCCP is strongest after other passes expose constants. Inlining, template expansion, specialization, interprocedural constant propagation, and partial evaluation can leave behind branches whose outcomes are now fixed. SCCP converts those fixed outcomes into both simpler values and simpler control flow.`,
        `It also wins in SSA middle ends because SSA already gives the sparse graph SCCP wants. Use-def links identify which operations to revisit after a value changes, and phi nodes make join behavior explicit. The pass can avoid scanning the entire CFG on every iteration.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `SCCP loses precision when the needed facts do not fit the lattice. Alias-heavy memory, unknown calls, floating-point corner cases, exception edges, input-dependent loops, volatile operations, poison or undef semantics, and target-specific behavior can force overdefined even when a richer analysis could prove more.`,
        `It also does not do every cleanup by itself. SCCP can mark constants and unreachable edges, but later passes usually rewrite branches, delete blocks, simplify phis, and remove instructions whose results are no longer used. Treat it as a discovery pass plus rewrite support, not the whole optimizer.`,
        `A bad implementation can become unsound if it folds operations without respecting language rules. Integer overflow, floating-point NaNs, traps, memory ordering, and undefined behavior must be handled according to the compiler's IR semantics, not according to what seems algebraically convenient.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Implement SCCP around a small explicit lattice type. Avoid encoding unknown, constant, and overdefined as ad hoc nullable values. The transfer functions should make it clear when an operation can be folded, when it must stay unknown, and when it must become overdefined.`,
        `Keep executable edges separate from visited blocks. A block may have several incoming edges, and a phi needs edge-level information. Marking only the block as reachable loses the reason SCCP is precise at joins.`,
        `Add tests that cover dead predecessors, loops, overdefined branch conditions, calls, memory loads, and IR edge cases. The most useful tests are small programs where ordinary constant propagation would merge too early but SCCP should keep the live value constant.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Read Wegman and Zadeck's paper PDF at https://www.cs.utexas.edu/~lin/cs380c/wegman.pdf, the ACM DOI page at https://dl.acm.org/doi/10.1145/103135.103136, and the Cornell CS6120 SCCP implementation note at https://www.cs.cornell.edu/courses/cs6120/2019fa/blog/sccp/.`,
        `Inside this curriculum, study Static Single Assignment Phi Nodes, Data-Flow Worklist Analysis, Control Flow Graph and Dominator Tree, Dominance Frontier SSA Construction, MemorySSA Alias Graph, Dead-Code Elimination, Sparse Set Entity Index, and compiler register-allocation topics that consume simplified IR.`,
      ],
    },
  ],
};
