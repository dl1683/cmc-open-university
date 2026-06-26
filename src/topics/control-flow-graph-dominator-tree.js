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
  const cfgNodes = ['entry', 'test', 'then', 'else', 'join', 'loop', 'exit'];
  const cfgEdges = ['e-entry-test', 'e-test-then', 'e-test-else', 'e-then-join', 'e-else-join', 'e-join-loop', 'e-loop-join', 'e-join-exit'];
  yield {
    state: cfgGraph('A CFG makes control flow explicit'),
    highlight: { active: ['entry', 'test', 'then', 'else', 'join'], compare: ['loop'] },
    explanation: `A control-flow graph turns code into ${cfgNodes.length} basic blocks connected by ${cfgEdges.length} directed edges. Branches, joins, loops, exits, and exceptional paths become graph structure rather than hidden syntax.`,
  };
  const domRules = [
    { id: 'entry', label: 'entry dominates all' },
    { id: 'test', label: 'test dominates join' },
    { id: 'then', label: 'then not dominate join' },
    { id: 'join', label: 'join dominates exit' },
  ];
  yield {
    state: labelMatrix(
      'Dominator rule',
      domRules,
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
    explanation: `${domRules.length} dominator rules show: node A dominates node B if every path from entry to B passes through A. Immediate dominators compress that relation from ${cfgNodes.length} blocks into a tree.`,
    invariant: `Dominance is about all ${cfgEdges.length} possible paths, not most paths.`,
  };
  const domTreeEdges = ['d-entry-test', 'd-test-then', 'd-test-else', 'd-test-join', 'd-join-loop', 'd-join-exit'];
  yield {
    state: domGraph('The dominator tree is a compact analysis result'),
    highlight: { found: ['entry', 'test', 'join', 'exit'], active: ['d-entry-test', 'd-test-join', 'd-join-exit'] },
    explanation: `The dominator tree reduces ${cfgEdges.length} CFG edges to ${domTreeEdges.length} immediate-dominator parent links. Many compiler passes ask dominance questions constantly, so caching this tree is a big deal.`,
  };
}

function* frontiersAndLoops() {
  const loopHeader = 'join';
  const loopBody = 'loop';
  yield {
    state: cfgGraph('Backedges reveal natural loops'),
    highlight: { active: ['join', 'loop', 'e-join-loop', 'e-loop-join'], compare: ['exit'] },
    explanation: `A backedge from "${loopBody}" to its dominator "${loopHeader}" marks a natural loop. Loop optimizations need the header, body, exits, and values carried around the backedge.`,
  };
  const frontierRows = [
    { id: 'then', label: 'then assigns x' },
    { id: 'else', label: 'else assigns x' },
    { id: 'join', label: 'join block' },
    { id: 'loop', label: 'loop header' },
  ];
  yield {
    state: labelMatrix(
      'Dominance frontier intuition',
      frontierRows,
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
    explanation: `${frontierRows.length} blocks illustrate dominance frontiers: where a definition stops dominating all incoming paths. That is exactly where SSA phi nodes are needed, including at the "${loopHeader}" header.`,
  };
  yield {
    state: domGraph('CFG facts feed later compiler passes'),
    highlight: { active: ['test', 'join', 'loop'], found: ['entry'], compare: ['then', 'else'] },
    explanation: `Static Single Assignment & Phi Nodes uses dominance frontiers from all ${frontierRows.length} frontier candidates. Register allocation uses liveness over CFG edges. Optimization passes use dominance to prove that a value is available before a use.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The first, "cfg to dominators," builds a control-flow graph with 7 blocks and 8 edges, labels the dominator rules, then draws the dominator tree with 6 tree edges. The second, "frontiers and loops," highlights backedges that reveal natural loops, shows dominance frontier intuition, and demonstrates how CFG facts feed later compiler passes.',
        'Each step pauses long enough to read the explanation text above the animation. Use the slider or play button to control pacing. Watch how the dominator tree strips away optional paths and keeps only the unavoidable ancestry from the entry block.',
        {type: 'image', src: './assets/gifs/control-flow-graph-dominator-tree.gif', alt: 'Animated walkthrough of the control flow graph dominator tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A compiler cannot optimize real code from a flat list of instructions. Branches, loops, early returns, exceptions, switches, and short-circuit expressions mean textual order is not the same as possible execution order. Before the compiler can move code, merge values, remove dead work, or reason about loops, it needs a graph that captures every possible control transfer.',
        {type: 'callout', text: 'A CFG records where execution may go, while dominance records which blocks every path must pass before a use is safe.'},
        'The control-flow graph (CFG) answers the "may-flow" question: given block A, which blocks could execute next? The dominator tree answers the "must-pass" question: which block is unavoidable on every path from the program entry to a given block? Together these two structures are the skeleton for SSA construction, loop detection, code motion, dead-code elimination, register allocation, and dozens of other compiler passes.',
        'A bug in CFG construction or dominance maintenance can make an optimizer move code above a safety check, place a phi node in the wrong block, or prove a fact along a path where it does not hold. Getting these structures right is not optional -- it is the foundation everything else stands on.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A first attempt is to scan the source code or intermediate representation (IR) in order, remembering the last assignment, last branch, or last condition seen. This works for straight-line code because program order equals execution order: instruction 5 always runs after instruction 4.',
        'You might also try reasoning directly from the abstract syntax tree (AST). The AST preserves branch structure, so you could walk it and track which variables are live at each node. This works for simple programs but fails after lowering: once the compiler has split blocks, inserted explicit jumps, added exception edges, and lowered switches into jump tables, the original syntax tree no longer exists. The CFG is the representation that survives those transformations.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The linear scan breaks at joins and loops. Consider `if (c) x = a; else x = b; return x`. Neither assignment dominates the return -- execution reaches the return through either branch, so neither definition is guaranteed on all paths. A linear scan cannot express the fact that x has two possible sources at the return point.',
        'Loops create a second problem. The value entering a loop header may come from the block before the loop (the preheader) or from the end of the loop body (the backedge). A forward scan sees the preheader value first, but the backedge value is equally valid. Without a graph that records both incoming edges, the compiler cannot correctly place the merge (phi node) that reconciles these two sources.',
        'Both problems share the same root cause: when control flow merges, a single linear position cannot represent the multiple paths that arrive there. You need a structure that records every edge, not just the textual order.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Break the program into basic blocks -- maximal sequences of instructions with one entry point and one exit point, no internal branch targets. Make every control transfer (conditional branch, unconditional jump, fall-through, exception edge) an explicit directed edge between blocks. The result is the control-flow graph.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Four example control flow graphs showing branches loops reducible control flow and irreducible control flow', caption: 'Different CFG shapes expose the cases a compiler analysis must distinguish: branch, loop, natural loop, and irreducible flow. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
        'Now define dominance: block A dominates block B if every path from the entry block to B passes through A. The entry block dominates everything (every path starts there). The immediate dominator (idom) of B is the closest strict dominator -- the last block you must pass through before reaching B. Connect each block to its idom and you get the dominator tree, a tree rooted at the entry block where parent-child means "must pass through."',
        'Dominance is a proof about availability. If a definition lives in block A and A dominates block B, then every execution that reaches B has already executed A -- the definition is guaranteed to be available. If A does not dominate B, some path to B skips A, and the compiler must treat the value as potentially undefined on that path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'CFG construction starts by scanning the IR and cutting it into basic blocks. Every instruction that is a branch target starts a new block. Every branch, jump, or return ends a block. The terminator instruction at the end of each block creates outgoing edges to its successors. Predecessor lists are just the inverse: for each block, collect all blocks that have an edge into it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with labeled nodes connected by arrows', caption: 'CFG analysis starts from a directed graph: every edge is a possible control transfer that later facts must respect. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Dominators can be computed with a simple iterative algorithm. Initialize: the entry block\'s dominator set is just itself; every other block\'s dominator set is all blocks. Then iterate: for each block B (in reverse postorder), set Dom(B) = intersection of Dom(p) for every predecessor p of B, then add B itself. Repeat until no set changes. This converges because intersection can only shrink sets, and the smallest valid dominator sets are the fixed point.',
        'Immediate dominators are extracted from the converged sets: idom(B) is the element of Dom(B) - {B} that is dominated by all other elements. In practice, production compilers use the Lengauer-Tarjan algorithm, which computes idoms directly in nearly-linear time using depth-first search and path compression. But the fixed-point approach gives the right intuition: a dominator is what survives intersection across all incoming paths.',
        'Dominance frontiers add one more layer. The dominance frontier of block A is the set of blocks where A\'s dominance stops -- blocks that A does not strictly dominate but that have a predecessor dominated by A. Formally, DF(A) = {B : B has a predecessor dominated by A, but A does not strictly dominate B}. This is exactly where SSA phi nodes are needed: if a variable is defined in A, any block in DF(A) might receive the value from A on one path and a different value on another.',
        'Loop detection uses backedges. A backedge is an edge from block B to block H where H dominates B. H is the loop header. The natural loop body is the set of blocks that can reach B without going through H, plus H itself. Collect these by walking predecessors backward from B, stopping at H.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The iterative dominator algorithm converges because the lattice of dominator sets forms a finite semilattice under intersection. Each iteration can only shrink a block\'s dominator set (or leave it unchanged), and the sets are bounded below by the true dominator sets. Since the lattice is finite and the operation is monotonically decreasing, a fixed point is reached in at most N iterations, where N is the number of blocks. In practice, processing blocks in reverse postorder makes convergence happen in 2-3 passes for most programs.',
        'The dominator tree is unique because dominance is a partial order with a unique least element (the entry block) and every block has a unique immediate dominator. This follows from the intersection property: if A and B both dominate C, then one must dominate the other (otherwise there would be a path to C avoiding one of them, which contradicts dominance of C by both). So the dominators of any block form a total order, and the maximal non-self element is the unique idom.',
        'Dominance frontiers correctly locate phi nodes because they capture exactly the points where a definition\'s guaranteed availability ends. If block D defines a variable and block J is in DF(D), then J has at least one predecessor dominated by D (so the value from D reaches J on that path) and at least one predecessor not dominated by D (so a different value might arrive on that path). This is precisely the condition under which a phi node is needed at J to merge the two values.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CFG construction is linear in the number of instructions: one pass to find block boundaries, one pass to wire edges. Storage per block is a block ID, instruction range, predecessor list, successor list, and terminator kind. For a function with B blocks and E edges, the CFG uses O(B + E) space.',
        'The naive iterative dominator algorithm runs in O(B^2) time per iteration and converges in at most B iterations, giving O(B^3) worst case. With reverse-postorder traversal and bit-vector intersection, practical performance is much better -- typically O(B * E) total. The Lengauer-Tarjan algorithm achieves O(E * alpha(E, B)) time, where alpha is the inverse Ackermann function -- effectively linear for all practical inputs.',
        'Dominance frontier computation after the dominator tree is built takes O(E) time. Loop detection from backedges takes O(E) per loop. The total cost of building CFG + dominator tree + frontiers + loop nests is effectively linear in the size of the function, which is cheap compared to the optimization passes that consume these structures.',
        'The real cost is maintenance. A pass that deletes a block, splits a critical edge, folds a branch to a constant, or rotates a loop must update the CFG, dominator tree, and frontier sets -- or mark them invalid and force recomputation. Many compilers choose lazy recomputation: run the analysis once, let passes invalidate it, and rebuild only when the next consumer needs it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SSA construction is the primary consumer. To convert a program to Static Single Assignment form, the compiler needs to know where to place phi nodes. The algorithm by Cytron et al. uses dominance frontiers: for each variable definition in block D, insert phi nodes at every block in the iterated dominance frontier of D. Without the dominator tree and frontier sets, SSA construction cannot decide where merges belong.',
        'Loop-invariant code motion (LICM) uses the loop nest structure derived from backedges and dominators. An instruction is loop-invariant if its operands are defined outside the loop or are themselves loop-invariant. LICM hoists such instructions to the loop preheader, but only if the preheader dominates the loop header -- a fact verified directly from the dominator tree.',
        'Dead code elimination uses dominance to prove that a definition has no reachable uses. If a block is unreachable from the entry (no path in the CFG), all its instructions are dead. If a definition\'s uses are all in blocks that the definition does not dominate, the compiler investigates further to see if liveness still holds.',
        'Static analysis tools, coverage analyzers, profilers, and security scanners all build CFGs. A taint-analysis tool traces data flow through the CFG to find paths from untrusted input to sensitive operations. A coverage tool marks which blocks were executed and uses the CFG to report which branches were never taken.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CFG and dominance analysis fail when the edge set is wrong. Exceptions, short-circuit boolean evaluation, switch lowering, early returns, break/continue, indirect branches (function pointers, virtual calls), and abnormal exits (longjmp, signal handlers) all produce edges that a naive CFG builder might miss. A correct dominator algorithm over an incorrect CFG gives confidently wrong answers -- the optimizer trusts proofs built on a lie.',
        'Incremental invalidation is a persistent source of compiler bugs. If a pass rewrites edges but forgets to invalidate the dominator tree, later passes use stale data. LLVM\'s pass manager tracks analysis validity explicitly, but getting the invalidation annotations right for every transformation is a manual, error-prone process.',
        'Dominance is not probability. A block dominates another only if every single path passes through it. A branch taken 99.9% of the time does not create dominance -- the 0.1% path still exists. Profile-guided optimization uses frequencies and probabilities; dominance uses universal quantification. Mixing the two is a category error that leads to miscompilation.',
        'Irreducible control flow is a stress case. Gotos, lowered switches, and certain loop transformations can create regions with multiple entry points. Dominance still exists and is well-defined, but the clean "single header dominates the loop body" assumption of natural loops breaks down. Production compilers handle this with node splitting (duplicating blocks to restore reducibility) or by falling back to conservative analysis that does not assume loop structure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a function with 5 blocks: Entry, A, B, C, Exit. Edges: Entry->A, Entry->B, A->C, B->C, C->Exit. This is a simple diamond: Entry branches to A or B, both merge at C, which falls through to Exit.',
        'Start with dominator sets. Dom(Entry) = {Entry}. Initialize Dom(A) = Dom(B) = Dom(C) = Dom(Exit) = {Entry, A, B, C, Exit} (all blocks). First iteration in reverse postorder (say A, B, C, Exit): Dom(A) = Dom(Entry) intersect {A} union {A} = {Entry} union {A} = {Entry, A}. Dom(B) = Dom(Entry) intersect {B} union {B} = {Entry, B}. Dom(C) = Dom(A) intersect Dom(B) union {C} = {Entry} union {C} = {Entry, C}. Dom(Exit) = Dom(C) union {Exit} = {Entry, C, Exit}. Second iteration produces no changes -- fixed point reached.',
        'Read off immediate dominators: idom(A) = Entry, idom(B) = Entry, idom(C) = Entry (not A or B, since neither dominates C -- there is a path through the other), idom(Exit) = C. The dominator tree is: Entry is the root with children A, B, C; C has child Exit.',
        'Dominance frontiers: DF(A) = {C} because C has predecessor A (dominated by A) but Entry, not A, is idom(C). DF(B) = {C} for the same reason. DF(Entry) = empty (Entry dominates everything on all paths). DF(C) = empty (C\'s only successor is Exit, which C dominates). If a variable is defined in A, a phi node is needed at C. If defined in B, a phi is also needed at C. This matches intuition: C is the join point where values from both branches meet.',
        'For loops, suppose we add an edge C->Entry (a backedge). Since Entry dominates C, this is a valid backedge and Entry is the loop header. The natural loop body is found by walking predecessors of C backward without crossing Entry: C, A, B are all in the loop body. The full loop is {Entry, A, B, C}. Exit is outside the loop because the only way to reach Exit is through C->Exit, which leaves the loop.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Cytron et al., "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph" (1991), available at https://www.cs.utexas.edu/~pingali/CS380C/2010/papers/ssaCytron.pdf. It defines the iterated dominance frontier algorithm for phi placement. The Lengauer-Tarjan dominator algorithm is in "A Fast Algorithm for Finding Dominators in a Flowgraph" (1979). LLVM\'s dominator implementation and pass infrastructure are documented at https://llvm.org/docs/WritingAnLLVMPass.html and https://github.com/llvm/llvm-project/blob/main/llvm/docs/Passes.rst.',
        'Study these related topics next: Static Single Assignment and Phi Nodes (where dominance frontiers directly drive phi placement), Dominance Frontier SSA Construction (the specific algorithm), Data-Flow Worklist Analysis (uses CFG edges as the worklist structure), Interference Graph Register Allocation (builds on liveness, which builds on CFG reachability), Symbolic Execution Path Constraints (explores CFG paths systematically), and Graph BFS / Topological Sort (the graph algorithms underlying CFG traversal orders).',
      ],
    },
  ],
};
