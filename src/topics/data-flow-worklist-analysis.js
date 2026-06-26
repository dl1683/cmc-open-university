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
  const graphNodes = 7;
  const graphEdges = 8;
  const cfgBlocks = 4;     // rows in the reaching definitions matrix
  const factColumns = 3;   // columns: in, gen, out
  const definitions = 2;   // x0 and x1
  yield {
    state: worklistGraph('A worklist propagates facts through the CFG'),
    highlight: { active: ['cfg', 'facts', 'worklist', 'e-cfg-facts', 'e-cfg-worklist'], compare: ['fixpoint'] },
    explanation: `Data-flow analysis starts with a control-flow graph of ${graphNodes} nodes and a fact set for each block. The worklist holds blocks whose input facts changed and therefore need their output recomputed across ${graphEdges} edges.`,
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
    explanation: `A forward analysis pushes definitions from predecessors to successors across ${cfgBlocks} blocks and ${factColumns} fact columns. At a join, facts from both branches meet, so the use of x can be reached by both ${definitions} definitions (x0 and x1).`,
    invariant: `When a block output changes, every successor among the ${graphEdges} edges may need another visit.`,
  };
  yield {
    state: worklistGraph('The fixpoint means no fact set changes anymore'),
    highlight: { active: ['transfer', 'join', 'fixpoint', 'e-transfer-join', 'e-join-fixpoint'], visited: ['loop', 'worklist'] },
    explanation: `The algorithm stops at a fixpoint: running every transfer function across all ${graphNodes} nodes again would produce the same in/out facts. That stable answer becomes input to optimizers, linters, and security scanners.`,
  };
}

function* livenessFixpoint() {
  const graphNodes = 7;
  const graphEdges = 8;
  const livenessBlocks = 4;  // rows in backward liveness matrix
  const livenessColumns = 3; // columns: use, def, live in
  const analysisVariants = 6; // constant prop, reaching defs, nullness, liveness, taint, interval
  yield {
    state: worklistGraph('Liveness runs backward from uses to definitions'),
    highlight: { active: ['cfg', 'transfer', 'worklist'], compare: ['join'], found: ['loop'] },
    explanation: `Some analyses flow backward across ${graphEdges} edges. Liveness asks which values may be used in the future, so facts travel from successors back to predecessors through the ${graphNodes}-node CFG.`,
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
    explanation: `A use makes a value live. A definition kills liveness for the old value on that path. The ${livenessBlocks} blocks each track ${livenessColumns} columns (use, def, live in) to feed Linear Scan Register Allocation.`,
  };
  yield {
    state: worklistGraph('Static analysis is a reusable engine'),
    highlight: { active: ['cfg', 'facts', 'transfer', 'join'], found: ['fixpoint'], compare: ['worklist'] },
    explanation: `At least ${analysisVariants} major analyses — constant propagation, reaching definitions, nullness, liveness, taint tracking, and interval range analysis — all reuse the same skeleton: facts, transfer functions, joins, and a worklist over ${graphNodes} nodes.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation walks through two analyses on a small control-flow graph: reaching definitions (forward) and liveness (backward). Each frame shows which block the worklist is processing, what facts enter and leave that block, and whether the output changed enough to schedule neighbors. Watch for the moment the worklist empties and the fixpoint is declared stable.',
        {type: 'image', src: './assets/gifs/data-flow-worklist-analysis.gif', alt: 'Animated walkthrough of the data flow worklist analysis visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the matrix view, rows are basic blocks and columns are fact slots (in, gen/def, out/live-in). Highlighted cells are the ones that just changed. When no cell changes after a full worklist pass, the analysis is done.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A compiler needs to answer questions about every possible execution path, not just one test run. Which definitions of variable x could reach this print statement? Which variables still hold values that will be read later? Can user-controlled input reach this SQL query? These are all-paths questions, and testing cannot answer them because the number of paths grows exponentially with branches.',
        { type: 'callout', text: 'A worklist analysis is useful because it repeats only the CFG blocks whose facts can still change.' },
        'Data-flow analysis solves this class of problem with a single reusable engine. The program is represented as a control-flow graph (CFG) where each node is a basic block (a straight-line sequence of instructions with one entry and one exit) and each edge is a possible branch. The engine attaches a set of facts to every block, applies a local transfer function to compute new facts, and propagates changes through edges until nothing changes. That stable state is called the fixpoint.',
        'The worklist is the scheduler inside this engine. Without it, the algorithm would re-examine every block on every pass, even blocks whose inputs have not changed. With loops in the CFG, some blocks must be visited more than once because information circles back, but most blocks stabilize quickly. The worklist ensures only blocks with new incoming information get another turn.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest idea is a syntax walk: scan statements from top to bottom, keep a table of facts, and report the table at the end. For straight-line code this works. But the moment the program branches (if/else, switch, loop), a single top-to-bottom pass sees only one path and misses the other. If the then branch sets x = 5 and the else branch sets x = 9, a later use of x must know about both possibilities, not just whichever branch the walk happened to visit first.',
        'A slightly better idea is to repeat the walk over every block, around and around, until no fact changes. This is correct for many analyses, but it is wasteful. On each pass, most blocks produce the same output they produced last time. Only the blocks downstream of a recent change need recomputation. The wasted work is proportional to the number of unchanged blocks times the number of passes, which can be large in real programs with thousands of blocks.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is loops in the CFG. A loop back-edge carries information from the end of the loop body back to the loop header. That means processing blocks in any single order can leave the header with stale facts: it was computed before the back-edge brought new information. The analysis must revisit the header, which may change its output, which may change the body, which may change the back-edge again.',
        'Without a disciplined mechanism for deciding which blocks to revisit and when, you either miss the loop-carried facts (unsound) or you brute-force every block on every pass (correct but slow). A program with k loops and n blocks can require O(k * n) block visits in the brute-force approach, even though most of those visits produce no change. The worklist is the mechanism that breaks through this wall: it tracks exactly which blocks have pending changes and processes only those.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the meaning of an analysis from the machinery that reaches a stable answer. The machinery is always the same four parts: (1) a fact domain that describes what you are tracking (sets of definitions, sets of live variables, abstract values like "unknown" or "constant 7"), (2) a transfer function that says how one block transforms incoming facts into outgoing facts, (3) a join operator that combines facts from multiple incoming edges, and (4) a worklist that schedules blocks whose inputs just changed.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Examples of control-flow graph shapes with branches and loops', caption: 'Data-flow facts move over CFG edges; branches and loops are the reason the analysis needs joins and fixpoints. Source: https://en.wikipedia.org/wiki/Control-flow_graph.' },
        'The analysis author only supplies the domain and the rules. Reaching definitions uses sets of definition labels and union as the join. Liveness uses sets of variable names and union as the join. Constant propagation uses a lattice of values (bottom, concrete constants, top) and meet as the join. Taint analysis uses source labels. The worklist engine does not care what the facts mean. It only needs to join them, compare old versus new, and push neighbors when something changed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A forward worklist analysis (like reaching definitions) proceeds as follows. Initialize every block\'s in-facts and out-facts to the empty set (or bottom of the lattice). Put the entry block on the worklist. Then loop: pull a block off the worklist, compute its in-facts by joining the out-facts of all predecessors, apply the transfer function to get new out-facts, compare with the old out-facts. If they differ, store the new out-facts and push all successors onto the worklist. When the worklist is empty, every block is locally consistent and the fixpoint has been reached.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rust_MIR_CFG.svg/250px-Rust_MIR_CFG.svg.png', alt: 'Rust compiler MIR control-flow graph with basic blocks and branch edges', caption: 'Real compiler IR exposes the same graph skeleton: basic blocks, branch edges, and join points for facts. Source: https://en.wikipedia.org/wiki/Control-flow_graph.' },
        'A backward worklist analysis (like liveness) flips the edge direction. A block\'s out-facts come from joining the in-facts of all successors. The transfer function computes new in-facts from those out-facts. If in-facts changed, push predecessors. The queue, the changed-check, and the fixpoint logic are identical; only the neighbor direction and transfer direction reverse.',
        'The changed-check is not an optimization. It is the correctness mechanism. If a block\'s output did not change, its neighbors\' inputs are still valid, so re-examining them would produce the same result. If the output did change, the neighbors have stale inputs and must be reprocessed. The worklist tracks exactly this: which blocks have unprocessed upstream changes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: when the worklist is empty, for every block B in the graph, out[B] equals transfer(B, join(out[pred] for each predecessor pred of B)). In words: every block\'s stored output is exactly what you would get if you recomputed it from the latest neighbor facts right now. The worklist maintains this by scheduling a block whenever any of its input edges carries new information. When the queue drains, no edge has unprocessed new information, so every block is locally consistent.',
        'Termination depends on the fact domain having finite height. Height means the longest chain of strictly increasing (or decreasing) values in the lattice. For reaching definitions, the lattice is the power set of definition labels. Each label can be added to a set at most once and is never removed (monotonicity). With d definitions, the set can grow at most d times per block before it stops changing. With n blocks, the total number of fact-changes is bounded by O(n * d), so the algorithm terminates. More complex domains like numeric intervals may have infinite height; those require a widening operator that forces convergence by jumping to a safe over-approximation after a bounded number of iterations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let n be the number of blocks, e the number of edges, and h the height of the lattice. Each block can change its output at most h times, and each change pushes at most (number of successors) entries onto the worklist. The total number of worklist iterations is at most O(n * h). Each iteration costs the time to join predecessor facts and apply the transfer function. For bitset domains (reaching definitions, liveness), join is a bitwise OR over predecessor bitsets, which takes O(d/w) time where d is the number of bits and w is the machine word size. Total time for a bitset-based analysis: O(n * h * e * d/w). In practice h is small (often 1-3 passes suffice), and the bitset operations are very fast.',
        'Space is O(n * d) for storing in-facts and out-facts per block, plus O(n) for the worklist. The worklist itself can be a FIFO queue, a stack, or a priority queue ordered by reverse postorder. Reverse-postorder traversal minimizes redundant visits for acyclic regions of the graph because it processes a block only after all its non-back-edge predecessors, reducing the number of passes through loops to roughly the loop nesting depth.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Reaching definitions powers "find all assignments that could affect this variable" in IDEs and lint tools. Liveness analysis feeds register allocators in every production compiler (GCC, LLVM, HotSpot JIT): a variable that is not live after an instruction does not need a register, so the allocator can reuse that register immediately. Constant propagation discovers compile-time constants and eliminates dead branches. Nullness analysis in Java (NullAway, the Checker Framework, IntelliJ inspections) uses the same engine to track which references are guaranteed non-null at each point.',
        'Security scanners use taint analysis, which is a data-flow analysis where the facts are taint labels. CodeQL, Semgrep, and the Clang Static Analyzer all run worklist-based data-flow to find SQL injection, XSS, and command injection by tracing user input from sources to sinks. The Rust borrow checker uses a related fixpoint over MIR to enforce lifetime constraints. These are all the same skeleton: CFG, facts, transfer functions, joins, worklist, fixpoint.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The framework loses precision at joins. If one branch says x = 5 and another says x = 9, constant propagation must join them to "not a constant." That fact is safe but useless for later optimization. More precision (path-sensitive analysis, which tracks facts per path rather than per block) multiplies state exponentially. Heap aliasing is another precision killer: if two pointers might refer to the same memory, a write through one must conservatively affect the facts for the other, often forcing the analysis to say "unknown."',
        'Scale is the other failure mode. A whole-program analysis of a million-line codebase with an expensive domain (e.g., numeric intervals with widening) can take minutes or hours. Production systems fight this with demand-driven analysis (only compute facts for blocks reachable from the query), sparse propagation (skip blocks that do not mention the relevant variables), function summaries (precompute the effect of a function call once instead of inlining it), and incremental invalidation (recompute only the blocks affected by a code change). The abstract algorithm is simple, but scaling it to real programs is an engineering discipline of its own.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider this four-block CFG for reaching definitions. Entry block: empty. Then block: x = G (generates definition d1). Else block: x = H (generates definition d2). Join block: use x. Initialize all facts to {}. Put Entry on the worklist.',
        'Iteration 1: pull Entry. in[Entry] = {} (no predecessors). out[Entry] = transfer({}) = {} (no definitions generated). out unchanged from initial {}, so no successors pushed. But Then and Else are reachable from Entry, so they start on the worklist too. Pull Then. in[Then] = join(out[Entry]) = {}. out[Then] = {} union {d1} = {d1}. Changed from {}, so push Join. Pull Else. in[Else] = join(out[Entry]) = {}. out[Else] = {} union {d2} = {d2}. Changed, push Join (already there).',
        'Iteration 2: pull Join. in[Join] = join(out[Then], out[Else]) = {d1} union {d2} = {d1, d2}. out[Join] = {d1, d2} (no new definitions). Changed from {}, but Join has no successors, so nothing pushed. Worklist is empty. Fixpoint reached. Result: the use of x at the join can be reached by both d1 and d2. A one-branch answer would be unsound because it would miss a definition the program can actually execute.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Clang DataFlowAnalysis introduction at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html, the CodeQL data-flow overview at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, and the Harvard CS153 lecture notes at https://groups.seas.harvard.edu/courses/cs153/2019fa/lectures/Lec20-Dataflow-analysis.pdf. For the lattice-theoretic foundation, see Chapter 9 of the Dragon Book (Compilers: Principles, Techniques, and Tools by Aho, Lam, Sethi, Ullman).',
        'Study next: Control Flow Graph and Dominator Tree to understand the graph the analysis runs on. Static Single Assignment and Phi Nodes to see how SSA form simplifies many data-flow problems. Interference Graph Register Allocation to see liveness facts become register pressure. Taint Analysis Source-to-Sink Case Study to see the same engine applied to security. Sparse Conditional Constant Propagation for a more precise variant that combines control-flow and data-flow reasoning. Abstract Interpretation and Interval Domain for the theoretical framework that generalizes all of these analyses.',
      ],
    },
  ],
};
