// Data-flow analysis: propagate facts over a control-flow graph until the
// worklist reaches a fixpoint.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-flow-worklist-analysis',
  title: 'Data-Flow Worklist Analysis',
  category: 'Concepts',
  summary: 'A static-analysis engine: keep facts per CFG block, push changed facts through transfer functions, and stop when the worklist reaches a fixpoint.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reaching definitions', 'liveness fixpoint'], defaultValue: 'reaching definitions' },
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

function worklistGraph(title) {
  return graphState({
    nodes: [
      { id: 'cfg', label: 'CFG', x: 1.0, y: 3.8, note: 'blocks' },
      { id: 'facts', label: 'facts', x: 2.7, y: 2.2, note: 'in/out' },
      { id: 'worklist', label: 'queue', x: 2.9, y: 5.4, note: 'changed' },
      { id: 'transfer', label: 'transfer', x: 4.8, y: 3.8, note: 'gen/kill' },
      { id: 'join', label: 'join', x: 6.8, y: 2.4, note: 'meet' },
      { id: 'loop', label: 'loop', x: 6.8, y: 5.3, note: 'repeat' },
      { id: 'fixpoint', label: 'fixed', x: 8.8, y: 3.8, note: 'stable' },
    ],
    edges: [
      { id: 'e-cfg-facts', from: 'cfg', to: 'facts' },
      { id: 'e-cfg-worklist', from: 'cfg', to: 'worklist' },
      { id: 'e-facts-transfer', from: 'facts', to: 'transfer' },
      { id: 'e-worklist-transfer', from: 'worklist', to: 'transfer' },
      { id: 'e-transfer-join', from: 'transfer', to: 'join' },
      { id: 'e-join-loop', from: 'join', to: 'loop' },
      { id: 'e-loop-worklist', from: 'loop', to: 'worklist' },
      { id: 'e-join-fixpoint', from: 'join', to: 'fixpoint' },
    ],
  }, { title });
}

function* reachingDefinitions() {
  yield {
    state: worklistGraph('A worklist propagates facts through the CFG'),
    highlight: { active: ['cfg', 'facts', 'worklist', 'e-cfg-facts', 'e-cfg-worklist'], compare: ['fixpoint'] },
    explanation: 'Data-flow analysis starts with a control-flow graph and a fact set for each block. The worklist holds blocks whose input facts changed and therefore need their output recomputed.',
  };
  yield {
    state: labelMatrix(
      'Reaching definitions',
      [
        { id: 'entry', label: 'entry' },
        { id: 'then', label: 'then x=G' },
        { id: 'else', label: 'else x=H' },
        { id: 'join', label: 'join use x' },
      ],
      [
        { id: 'in', label: 'in facts' },
        { id: 'gen', label: 'gen' },
        { id: 'out', label: 'out facts' },
      ],
      [
        ['{}', '{}', '{}'],
        ['{}', 'x0', 'x0'],
        ['{}', 'x1', 'x1'],
        ['x0,x1', '{}', 'x0,x1'],
      ],
    ),
    highlight: { active: ['then:gen', 'else:gen'], found: ['join:in'], compare: ['entry:out'] },
    explanation: 'A forward analysis pushes definitions from predecessors to successors. At a join, facts from both branches meet, so the use of x can be reached by both x0 and x1.',
    invariant: 'When a block output changes, every successor may need another visit.',
  };
  yield {
    state: worklistGraph('The fixpoint means no fact set changes anymore'),
    highlight: { active: ['transfer', 'join', 'fixpoint', 'e-transfer-join', 'e-join-fixpoint'], visited: ['loop', 'worklist'] },
    explanation: 'The algorithm stops at a fixpoint: running every transfer function again would produce the same in/out facts. That stable answer becomes input to optimizers, linters, and security scanners.',
  };
}

function* livenessFixpoint() {
  yield {
    state: worklistGraph('Liveness runs backward from uses to definitions'),
    highlight: { active: ['cfg', 'transfer', 'worklist'], compare: ['join'], found: ['loop'] },
    explanation: 'Some analyses flow backward. Liveness asks which values may be used in the future, so facts travel from successors back to predecessors.',
  };
  yield {
    state: labelMatrix(
      'Backward liveness',
      [
        { id: 'ret', label: 'return x' },
        { id: 'join', label: 'join' },
        { id: 'then', label: 'then x=G' },
        { id: 'else', label: 'else x=H' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'def', label: 'def' },
        { id: 'liveIn', label: 'live in' },
      ],
      [
        ['x', '{}', 'x'],
        ['{}', '{}', 'x'],
        ['{}', 'x', '{}'],
        ['{}', 'x', '{}'],
      ],
    ),
    highlight: { active: ['ret:use', 'join:liveIn'], found: ['then:def', 'else:def'] },
    explanation: 'A use makes a value live. A definition kills liveness for the old value on that path. This is the analysis that feeds Linear Scan Register Allocation.',
  };
  yield {
    state: worklistGraph('Static analysis is a reusable engine'),
    highlight: { active: ['cfg', 'facts', 'transfer', 'join'], found: ['fixpoint'], compare: ['worklist'] },
    explanation: 'Constant propagation, reaching definitions, nullness, liveness, taint tracking, and interval range analysis all reuse the same skeleton: facts, transfer functions, joins, and a worklist.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reaching definitions') yield* reachingDefinitions();
  else if (view === 'liveness fixpoint') yield* livenessFixpoint();
  else throw new InputError('Pick a data-flow view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Compilers and static-analysis tools need to know facts about a program without running that program on every possible input. Which definition of x can reach this use? Which variables are live before this instruction? Which pointer may be null? Which user input can reach a dangerous sink? These questions are about all possible paths through code, not just the path taken by one test.`,
        `Data-flow analysis gives those questions a reusable engine. It represents the program as a control-flow graph, stores facts at each block, applies local transfer rules, and propagates changed facts through edges until the graph stabilizes. The worklist is the practical scheduler that decides which blocks deserve another visit.`,
        `The reason this exists is loops. A single pass through the blocks can be wrong because information can travel around a cycle and change the facts at a block that was already processed. The analysis needs a disciplined repeat-until-stable process, not hope that one traversal order happened to see enough.`,
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        `The simplest baseline is a syntax walk. Look at statements in source order, update a table, and report what the table says. That can work for straight-line code, but branches immediately weaken it. At an if statement, one path may define x as G and the other may define x as H. A later use of x must account for both.`,
        `A second baseline is to run the transfer rule over every block again and again until nothing changes. That is correct for many finite monotone analyses, but it wastes work on blocks whose inputs did not change. The wall is scale: real programs have many blocks, loops, functions, and facts. A worklist keeps the fixpoint method but focuses the repeated work where new information could matter.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The central idea is to separate the meaning of an analysis from the machinery that reaches a stable answer. The machinery is always similar: each block has input facts and output facts, neighboring facts are joined, a transfer function models the block, and changed outputs schedule more propagation.`,
        `The analysis author supplies the domain and rules. Reaching definitions uses sets of definitions. Liveness uses sets of variables. Constant propagation uses values such as unknown, constant 7, or not-a-constant. Taint analysis uses labels that describe where data came from. The worklist engine does not need to know the business meaning of those facts as long as it can join them, compare them, and apply transfer functions.`,
      ],
    },
    {
      heading: 'Facts, joins, and direction',
      paragraphs: [
        `A forward analysis moves facts along the same direction as control flow. Reaching definitions and many constant-propagation variants are forward: facts entering a block are computed from predecessor outputs, and the block produces an output for successors. A backward analysis moves against control flow. Liveness is backward because a future use makes a value live before that use.`,
        `The join operation says how paths combine. For a may analysis, join often means union: a definition may reach this point if it can arrive from any predecessor. For a must analysis, join often means intersection: a property holds only if it holds on every incoming path. Choosing the wrong join changes the meaning of the analysis, not just its performance.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A typical forward worklist starts by initializing facts for every block and putting entry or all blocks on the queue. It removes a block, computes its input by joining predecessor outputs, applies the transfer function to produce a new output, and compares that output with the old one. If the output changed, it pushes successors because their inputs may now change.`,
        `A backward worklist flips the edge direction. It computes a block's output from successor inputs, applies the backward transfer rule, and pushes predecessors when the input changes. The same queue, changed check, and fixpoint idea remain. Only the neighbor relation and transfer direction change.`,
        `The changed check is not an optimization bolt-on; it is what makes the scheduler precise. If a block recomputes the same facts, its neighbors do not need another visit because no new information can reach them through that edge. If the facts change, the block has just learned something that could affect the rest of the graph.`,
      ],
    },
    {
      heading: 'Correctness invariant',
      paragraphs: [
        `The invariant is local consistency with the current neighbor facts. For a forward analysis, out[block] must equal transfer(block, join(out[pred] for pred in predecessors)) once the algorithm is finished. For a backward analysis, in[block] must equal transfer(block, join(in[succ] for succ in successors)) once finished.`,
        `The worklist is correct because every time a fact changes, all blocks that depend on that fact are scheduled. When the queue is empty, no dependency has an unprocessed change. Every block is locally consistent with the latest facts from its neighbors, so running the transfer equations again would reproduce the same in and out facts. That stable solution is the fixpoint the analysis is seeking.`,
      ],
    },
    {
      heading: 'Why it terminates',
      paragraphs: [
        `Termination depends on the fact domain and transfer rules. The standard textbook setting uses a finite-height lattice and monotone transfer functions. Monotone means that giving a transfer function more information cannot make its result move backward in the lattice. Finite height means there are only so many times a fact can strictly improve or degrade before it stops changing.`,
        `That is why analyses such as reaching definitions with finite definition sets converge naturally. A definition can be added to a may set only once. Once all possible additions have happened, no more changes are possible. More complex domains, such as numeric ranges, may need widening to force convergence when the exact chain of facts could keep growing.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider if (cond) x = G; else x = H; return x. Reaching definitions starts with no facts at entry. The then block generates definition x0. The else block generates definition x1. At the join, the incoming facts are joined, so the use of x can be reached by either x0 or x1. A one-branch answer would be unsound.`,
        `Now use liveness on the same shape. return x makes x live before the return. That liveness flows backward through the join to both branches. In each branch, the assignment to x satisfies the future use and kills liveness for the old value before the assignment. This is exactly the sort of information a register allocator needs when building live intervals and interference graphs.`,
      ],
    },
    {
      heading: 'Operational data structures',
      paragraphs: [
        `A practical implementation stores the CFG as successor and predecessor lists, plus per-block in and out fact sets. The worklist can be a queue, deque, stack, priority queue, or reverse-postorder scheduler depending on the analysis. The important requirement is that dependency blocks are requeued when a relevant fact changes.`,
        `Fact representation drives performance. Dense facts, such as definition ids or variable ids, are often best as bitsets because join becomes fast bitwise OR or AND. Sparse facts can be hash sets or maps. Expensive equality checks can dominate runtime, so production analyzers often intern facts, use version counters, or maintain delta sets. The abstract algorithm is simple, but the representation decides whether it scales.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Worklist data-flow wins when the analysis can be expressed as local transfer equations over a graph and those equations converge. It is the backbone of reaching definitions, available expressions, live variables, constant propagation, nullness analysis, taint tracking, definite assignment, and many security scanners.`,
        `It also wins organizationally because it separates concerns. The CFG says where information may move. The domain says what information means. The transfer function says how one block changes it. The join says how paths combine. The worklist says when to repeat work. That separation lets new analyses reuse the same engine instead of rebuilding graph scheduling from scratch.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The framework can be imprecise when joins merge too much information. If two branches produce different values and the domain can only say unknown after joining them, later optimizations lose useful facts. Aliasing, heap mutation, reflection, dynamic property access, exceptions, and calls through unknown targets can force broad summaries that are correct but weak.`,
        `It can also be too slow when the domain is huge, the CFG is large, or fact equality is expensive. Production analyzers use widening, summaries, sparse propagation, SSA form, demand-driven queries, incremental invalidation, and carefully chosen traversal order to keep the fixpoint affordable. The art is choosing enough precision to be useful without turning every query into whole-program theorem proving.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The reaching-definitions view shows facts moving forward from definitions toward later uses. The join cell matters because it shows why one branch is not enough evidence: after a conditional, both branch definitions may reach the later use. The changed output is what schedules successors.`,
        `The liveness view reverses the direction. A future use makes a value needed before that use, and a definition can stop the need from flowing farther backward on that path. Together the views show that direction changes, but the skeleton remains facts, transfer, join, changed check, queue, and fixpoint.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources worth reading are the Clang data-flow analysis introduction at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html, the CodeQL overview at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, the CodeQL JavaScript and TypeScript data-flow guide at https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/, and Harvard CS153 data-flow lecture notes at https://groups.seas.harvard.edu/courses/cs153/2019fa/lectures/Lec20-Dataflow-analysis.pdf.`,
        `Study Interference Graph Register Allocation to see liveness become register pressure. Study Dominance Frontier SSA Construction, Control Flow Graph and Dominator Tree, Static Single Assignment and Phi Nodes, MemorySSA Alias Graph, Sparse Conditional Constant Propagation, Abstract Interpretation and Interval Domain, eBPF Verifier Register State Case Study, Taint Analysis Source-to-Sink Case Study, and Symbolic Execution Path Constraints to see how the same fixpoint idea grows into production compiler and security systems.`,
      ],
    },
  ],
};
