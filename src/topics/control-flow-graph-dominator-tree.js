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
      heading: 'Why this exists',
      paragraphs: [
        'A compiler cannot optimize real code safely from a flat list of instructions. Branches, loops, early returns, exceptions, switches, and short-circuit expressions mean textual order is not the same as possible execution order. Before the compiler can move code, merge values, remove dead work, or reason about loops, it needs a graph of control.',
        {type: 'callout', text: 'A CFG records where execution may go, while dominance records which blocks every path must pass before a use is safe.'},
        'The control-flow graph answers the may-flow question: where can execution go next? The dominator tree answers the must-pass question: which block is unavoidable before another block? Together they are the skeleton for SSA construction, loop detection, code motion, dead-code elimination, profiling, symbolic execution, and register allocation.',
        'This is one of the places where graph theory becomes ordinary engineering. A bug in CFG construction or dominance maintenance can make an optimizer move code above a required check, place a phi node in the wrong block, or prove a fact on a path where it is not true.',
        'The idea also explains why compilers keep rebuilding facts that seem redundant to a human reader. Humans see an if statement, a loop, and an early return. The optimizer sees blocks, edges, reachability, dominance, and invalidation boundaries. That lower-level view is what lets many independent passes share the same proof language.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A first attempt is to scan the source or IR in order and remember the last assignment, last branch, or last condition. That works for straight-line code because program order is execution order.',
        'The wall appears at joins and loops. In `if (c) x = a; else x = b; return x`, neither assignment dominates the return. In a loop, the value entering the header may come from the preheader or from the backedge. A linear scan loses the path structure needed to answer those questions.',
        'Another tempting shortcut is to keep branch syntax around and reason from the abstract syntax tree. That fails after lowering. Optimizers work on intermediate representations with explicit jumps, split blocks, critical edges, exception paths, and machine-level control transfers. The CFG is the representation that survives those transformations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Break the program into basic blocks and make control transfers explicit edges. A block A dominates block B if every path from entry to B passes through A. The immediate dominator is the nearest strict dominator, and those links form a tree.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Four example control flow graphs showing branches loops reducible control flow and irreducible control flow', caption: 'Different CFG shapes expose the cases a compiler analysis must distinguish: branch, loop, natural loop, and irreducible flow. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
        'Dominance is a proof about availability. If a definition is in a block that dominates a use, every execution reaching the use has passed the definition. If it does not dominate the use, the compiler must treat the value as path-dependent.',
        'Dominance frontiers add the complementary idea: where does a definition stop dominating all incoming paths? That boundary is where SSA phi nodes are usually needed. Loops add another key pattern: a backedge to a dominator marks a natural loop header, giving optimizers a structured region to analyze.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'Read CFG edges as possible transfers, not as the order the blocks are drawn. The join block is interesting precisely because multiple paths arrive there. The dominator tree removes optional paths and keeps only unavoidable ancestry.',
        'When the animation marks a dominance frontier, it is showing where a definition stops being guaranteed on every incoming path. That is the bridge into Static Single Assignment & Phi Nodes: values that meet there need an explicit merge.',
        'The loop view proves why a backedge is more than an ordinary cycle. A natural loop has a header that dominates the loop body. That dominance fact lets later passes identify preheaders, loop-invariant code, induction variables, and exits without guessing from syntax.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A compiler first cuts instructions into basic blocks. A basic block has one entry, one exit, and no internal branch target. The terminator instruction at the end of each block creates outgoing CFG edges to successors. Predecessor lists are the inverse edges.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with labeled nodes connected by arrows', caption: 'CFG analysis starts from a directed graph: every edge is a possible control transfer that later facts must respect. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Dominators can be computed iteratively as sets: entry dominates itself, and every other block initially has all blocks as possible dominators. Repeatedly intersect predecessor dominator sets and add the block itself until the sets stop changing. Production compilers use faster algorithms, but the fixed-point idea is the same: a dominator is what survives all incoming paths.',
        'Immediate dominators compress the relation into a tree. Dominance frontiers are computed from join points and dominator relationships. Loop analysis looks for backedges from a block to a dominator and collects the natural loop by walking predecessors back to the header.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'A useful CFG record stores block id, instruction range, predecessor list, successor list, terminator kind, and optional source span. A useful dominator record stores immediate dominator, tree children, dominance-query support, and frontier sets when SSA placement needs them.',
        'The structure is cheap compared with later optimization, but it is easy to invalidate. A pass that deletes a block, splits a critical edge, folds a branch, or rotates a loop must update CFG and dominance data or force recomputation before the next pass trusts it.',
        'The tradeoff is precision versus maintenance. More exact CFGs include exceptional edges, indirect branches, deoptimization exits, and abnormal control flow. That precision makes analyses safer but increases graph size and invalidation complexity. A simplified CFG may be faster to compute but unsafe for transformations that depend on all paths.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CFGs and dominators win anywhere program behavior depends on paths: compiler optimization, coverage, profilers, static analyzers, symbolic execution, visualizers, and security scans. They prevent bugs where a pass moves code above a check, assumes a value exists on every path, or places a merge in the wrong block.',
        'They are especially important for SSA construction. A value defined in two branches needs a phi at the join where the definitions meet. A value carried around a loop needs a phi at the loop header. Dominance frontiers tell the compiler where those merges belong.',
        'They also make optimizations explainable. Loop-invariant code motion needs to know a block is inside a loop and whether moving an instruction is safe. Common-subexpression elimination needs to know a value is available before a use. Dead-code elimination needs reachability and use facts. The CFG is the shared map those passes use.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'CFG and dominance analysis fail when the edge set is wrong. Exceptions, short-circuit booleans, switch lowering, early returns, break and continue, indirect branches, abnormal exits, and unreachable blocks all matter. A perfect dominator algorithm over a bad CFG gives confidently wrong answers.',
        'Incremental invalidation is another failure mode. If a pass rewrites edges but leaves stale dominator data behind, later passes can miscompile. Many compiler bugs come from trusting analysis results after the IR shape changed.',
        'A third failure is treating dominance as probability. A block dominates another only if every path passes through it. Hot paths, likely branches, and profile weights do not make a block dominate. Profile-guided optimization uses probabilities; dominance uses certainty.',
        'Irreducible control flow is another stress case. Gotos, lowered switches, or transformed loops can create regions with multiple entries. Dominance still exists, but natural-loop assumptions become less clean, so production compilers need conservative fallbacks.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Cytron et al., Efficiently Computing Static Single Assignment Form and the Control Dependence Graph, at https://www.cs.utexas.edu/~pingali/CS380C/2010/papers/ssaCytron.pdf, LLVM dominator pass references in https://llvm.org/docs/WritingAnLLVMPass.html, and LLVM pass documentation at https://github.com/llvm/llvm-project/blob/main/llvm/docs/Passes.rst. Study Dominance Frontier SSA Construction, Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, Interference Graph Register Allocation, Symbolic Execution Path Constraints, PGO Edge Counters & Block Frequencies, Graph BFS, Tree Traversals, and Topological Sort next.',
      ],
    },
  ],
};
