// Dominance-frontier SSA construction: place phi nodes with iterated
// frontiers, then rename definitions with stacks over the dominator tree.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dominance-frontier-ssa-construction-case-study',
  title: 'Dominance Frontier SSA Construction',
  category: 'Concepts',
  summary: 'Build SSA with the classic two-phase algorithm: use iterated dominance frontiers to place phi nodes, then walk the dominator tree with version stacks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['phi placement', 'rename stacks'], defaultValue: 'phi placement' },
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
      { id: 'entry', label: 'entry', x: 0.7, y: 4.0, note: 'start' },
      { id: 'test', label: 'test', x: 2.0, y: 4.0, note: 'branch' },
      { id: 'left', label: 'left', x: 3.5, y: 2.4, note: 'x=1' },
      { id: 'right', label: 'right', x: 3.5, y: 5.6, note: 'x=2' },
      { id: 'join', label: 'join', x: 5.2, y: 4.0, note: 'merge' },
      { id: 'body', label: 'body', x: 6.8, y: 2.4, note: 'x=x+1' },
      { id: 'exit', label: 'exit', x: 8.6, y: 4.0, note: 'use x' },
    ],
    edges: [
      { id: 'e-entry-test', from: 'entry', to: 'test' },
      { id: 'e-test-left', from: 'test', to: 'left' },
      { id: 'e-test-right', from: 'test', to: 'right' },
      { id: 'e-left-join', from: 'left', to: 'join' },
      { id: 'e-right-join', from: 'right', to: 'join' },
      { id: 'e-join-body', from: 'join', to: 'body' },
      { id: 'e-body-join', from: 'body', to: 'join' },
      { id: 'e-join-exit', from: 'join', to: 'exit' },
    ],
  }, { title });
}

function domTree(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 4.6, y: 1.0, note: 'root' },
      { id: 'test', label: 'test', x: 4.6, y: 2.4, note: 'idom' },
      { id: 'left', label: 'left', x: 2.7, y: 4.1, note: 'child' },
      { id: 'right', label: 'right', x: 4.6, y: 4.1, note: 'child' },
      { id: 'join', label: 'join', x: 6.5, y: 4.1, note: 'child' },
      { id: 'body', label: 'body', x: 5.7, y: 5.9, note: 'child' },
      { id: 'exit', label: 'exit', x: 7.4, y: 5.9, note: 'child' },
    ],
    edges: [
      { id: 'd-entry-test', from: 'entry', to: 'test' },
      { id: 'd-test-left', from: 'test', to: 'left' },
      { id: 'd-test-right', from: 'test', to: 'right' },
      { id: 'd-test-join', from: 'test', to: 'join' },
      { id: 'd-join-body', from: 'join', to: 'body' },
      { id: 'd-join-exit', from: 'join', to: 'exit' },
    ],
  }, { title });
}

function constructionGraph(title) {
  return graphState({
    nodes: [
      { id: 'defs', label: 'defs', x: 0.9, y: 4.0, note: 'x blocks' },
      { id: 'df', label: 'DF+', x: 2.8, y: 4.0, note: 'joins' },
      { id: 'phi', label: 'phi', x: 4.7, y: 4.0, note: 'insert' },
      { id: 'work', label: 'work', x: 4.7, y: 2.0, note: 'new def' },
      { id: 'rename', label: 'rename', x: 6.7, y: 4.0, note: 'stacks' },
      { id: 'uses', label: 'uses', x: 8.7, y: 4.0, note: 'one def' },
    ],
    edges: [
      { id: 'e-defs-df', from: 'defs', to: 'df' },
      { id: 'e-df-phi', from: 'df', to: 'phi' },
      { id: 'e-phi-work', from: 'phi', to: 'work' },
      { id: 'e-work-df', from: 'work', to: 'df' },
      { id: 'e-phi-rename', from: 'phi', to: 'rename' },
      { id: 'e-rename-uses', from: 'rename', to: 'uses' },
    ],
  }, { title });
}

function useDefGraph(title) {
  return graphState({
    nodes: [
      { id: 'x0', label: 'x0', x: 1.0, y: 2.2, note: 'left' },
      { id: 'x1', label: 'x1', x: 1.0, y: 5.8, note: 'right' },
      { id: 'x2', label: 'x2', x: 3.2, y: 4.0, note: 'phi' },
      { id: 'x3', label: 'x3', x: 5.2, y: 2.4, note: 'inc' },
      { id: 'x4', label: 'x4', x: 5.2, y: 5.6, note: 'loop phi' },
      { id: 'ret', label: 'ret', x: 7.8, y: 4.0, note: 'use' },
    ],
    edges: [
      { id: 'e-x0-x2', from: 'x0', to: 'x2' },
      { id: 'e-x1-x2', from: 'x1', to: 'x2' },
      { id: 'e-x2-x3', from: 'x2', to: 'x3' },
      { id: 'e-x3-x4', from: 'x3', to: 'x4' },
      { id: 'e-x4-x3', from: 'x4', to: 'x3' },
      { id: 'e-x4-ret', from: 'x4', to: 'ret' },
    ],
  }, { title });
}

function* phiPlacement() {
  yield {
    state: cfgGraph('Definitions of x meet at joins and loop headers'),
    highlight: { active: ['left', 'right', 'body'], compare: ['join'], found: ['exit'] },
    explanation: 'SSA construction starts with the blocks that assign a source variable. For x, both branches assign it, and the loop body assigns it again on the backedge.',
  };

  yield {
    state: domTree('Dominance tells where a definition stops being universal'),
    highlight: { active: ['test', 'join', 'body'], found: ['entry'], compare: ['left', 'right'] },
    explanation: 'A definition can be used without a phi only where it dominates all paths to the use. At a merge, neither branch definition dominates the join, so the algorithm needs a frontier rule.',
    invariant: 'A phi is needed where distinct reaching definitions can arrive along different CFG predecessors.',
  };

  yield {
    state: labelMatrix(
      'Dominance frontier work',
      [
        { id: 'left', label: 'left def' },
        { id: 'right', label: 'right def' },
        { id: 'body', label: 'body def' },
        { id: 'join', label: 'join phi' },
      ],
      [
        { id: 'frontier', label: 'DF' },
        { id: 'why', label: 'why' },
        { id: 'action', label: 'action' },
      ],
      [
        ['join', 'paths meet', 'phi x'],
        ['join', 'paths meet', 'phi x'],
        ['join', 'backedge', 'phi x'],
        ['join', 'iterated', 'seen'],
      ],
    ),
    highlight: { active: ['left:action', 'right:action', 'body:action'], found: ['join:action'] },
    explanation: 'Cytron-style construction uses iterated dominance frontiers. If inserting a phi creates a new definition of x, that block is also considered when continuing the frontier worklist.',
  };

  yield {
    state: constructionGraph('The phi-placement loop is a worklist algorithm'),
    highlight: { active: ['defs', 'df', 'phi', 'work', 'e-defs-df', 'e-df-phi', 'e-phi-work', 'e-work-df'], compare: ['rename'] },
    explanation: 'For each variable, start from assignment blocks, add phis at frontier blocks, and put newly inserted phi blocks back on the worklist until no new phi site appears.',
  };

  yield {
    state: labelMatrix(
      'Why minimal placement matters',
      [
        { id: 'naive', label: 'naive' },
        { id: 'semi', label: 'semi-pruned' },
        { id: 'pruned', label: 'pruned' },
        { id: 'bad', label: 'bad CFG' },
      ],
      [
        { id: 'phis', label: 'phis' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['every join', 'bloated IR'],
        ['live vars', 'less noise'],
        ['needed only', 'clean graph'],
        ['wrong edges', 'wrong phis'],
      ],
    ),
    highlight: { active: ['pruned:phis', 'pruned:cost'], compare: ['naive:cost', 'bad:cost'] },
    explanation: 'The goal is not to sprinkle phis everywhere. Good construction places enough phis for correctness while avoiding useless merge values that slow later optimization passes.',
  };
}

function* renameStacks() {
  yield {
    state: constructionGraph('After phis exist, renaming makes definitions unique'),
    highlight: { active: ['phi', 'rename', 'uses', 'e-phi-rename', 'e-rename-uses'], compare: ['defs'] },
    explanation: 'Phi placement decides where merge definitions live. The rename pass then walks the dominator tree and gives each assignment, phi, and use the right SSA version.',
  };

  yield {
    state: labelMatrix(
      'Rename stacks',
      [
        { id: 'entry', label: 'entry' },
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'top', label: 'top' },
        { id: 'new', label: 'new' },
        { id: 'pop', label: 'pop' },
      ],
      [
        ['x in', 'x0', 'after kid'],
        ['x0', 'x1', 'leave'],
        ['x0', 'x2', 'leave'],
        ['x0', 'x3 phi', 'later'],
      ],
    ),
    highlight: { active: ['left:new', 'right:new', 'join:new'], found: ['entry:new'] },
    explanation: 'The renamer keeps one stack per source variable. A definition pushes a fresh name; a use reads the current stack top; leaving a dominator-tree subtree pops names created inside it.',
    invariant: 'Dominated uses see the most recent name on the stack.',
  };

  yield {
    state: cfgGraph('Phi operands are filled by predecessor edge'),
    highlight: { active: ['left', 'right', 'body', 'join', 'e-left-join', 'e-right-join', 'e-body-join'], found: ['exit'] },
    explanation: 'When visiting a block, the renamer also updates phi operands in each successor. The incoming value is the current version at the end of that predecessor, not a value recomputed in the join block.',
  };

  yield {
    state: labelMatrix(
      'Loop header rename',
      [
        { id: 'pre', label: 'preheader' },
        { id: 'head', label: 'header' },
        { id: 'body', label: 'body' },
        { id: 'exit', label: 'exit' },
      ],
      [
        { id: 'incoming', label: 'incoming' },
        { id: 'out', label: 'out' },
      ],
      [
        ['x0', 'phi input'],
        ['x3 phi', 'x3 live'],
        ['x3', 'x4 inc'],
        ['x3', 'return'],
      ],
    ),
    highlight: { active: ['head:incoming', 'body:out'], found: ['exit:out'] },
    explanation: 'Loops are the reason phis are not just branch merges. A loop-header phi combines the value from before the loop with the value produced by the previous iteration.',
  };

  yield {
    state: useDefGraph('The result is a sparse use-def graph'),
    highlight: { active: ['x2', 'x3', 'x4', 'e-x2-x3', 'e-x3-x4'], found: ['ret', 'e-x4-ret'], compare: ['x0', 'x1'] },
    explanation: 'After construction, each use names exactly one SSA definition. Later passes can follow edges in the value graph instead of re-solving ambiguous reaching-definition questions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'phi placement') yield* phiPlacement();
  else if (view === 'rename stacks') yield* renameStacks();
  else throw new InputError('Pick an SSA-construction view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        `Compiler optimizers want direct answers to value questions. When an instruction uses x, which assignment of x does it mean? In ordinary mutable code, the answer depends on control flow. One branch may assign x = 1, another branch may assign x = 2, and a loop may assign x = x + 1 on every backedge. The same source name hides several possible reaching definitions.`,
        `Static Single Assignment form repairs that ambiguity by giving every definition a unique name. Each use should refer to exactly one SSA definition. That makes later analyses sparse: constant propagation, dead-code elimination, global value numbering, and many loop optimizations can follow use-def edges instead of repeatedly solving the full reaching-definitions problem over the raw control-flow graph.`,
        {type: 'callout', text: `SSA construction turns ambiguous mutable names into a sparse value graph by placing phis where dominance stops and then renaming along the dominator tree.`},
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        `The simple plan is to insert a phi for every variable at every join block, then clean up the useless ones. A phi is a merge definition: x3 = phi(x1 from the left predecessor, x2 from the right predecessor). This plan is easy to explain because every control-flow merge receives an explicit merge operator for every variable that might be in scope.`,
        `The wall is intermediate-representation bloat. Real functions have many variables, many joins, loops, exceptional edges, short-circuit branches, unreachable blocks, and compiler-introduced temporaries. A phi that is not needed still consumes memory, confuses dumps, increases analysis work, creates register-pressure noise, and forces later passes to remove it. Correct SSA construction should place enough phis for correctness without flooding the IR with dead merge nodes.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Dominance is the key graph fact. A block A dominates block B if every path from the function entry to B must pass through A. A definition in A is safe to use without a phi only in regions where that definition dominates the use and no competing reaching definition can arrive along another path. At joins and loop headers, dominance often stops being enough.`,
        `The dominance frontier of a block is the boundary where that block's dominance stops: the block can reach the frontier, but it does not strictly dominate it because another path can enter too. That is exactly where definitions may need to be merged. SSA construction is therefore a graph algorithm. For each source variable, start from its assignment blocks, place phis in the iterated dominance frontier, and remember that every inserted phi becomes a new definition whose frontier may also matter.`,
      ],
    },
    {
      heading: 'Phase 1',
      paragraphs: [
        `Phi placement is the first phase. For one variable, collect all blocks that assign it. Put those blocks in a worklist. Pop a definition block, inspect each block in its dominance frontier, and insert a phi for the variable if one is not already present. If a new phi is inserted, add that frontier block to the worklist because the phi is itself a definition that may need to be merged farther downstream.`,
        `This loop continues until no new phi sites appear. The word "iterated" matters because one merge can create a value that reaches another merge. Loops make this especially important: a loop-header phi may merge the value entering the loop with the value produced by a previous iteration. Without iteration, construction can miss phis that are not in the immediate frontier of an original assignment.`,
      ],
    },
    {
      heading: 'Phase 2',
      paragraphs: [
        `Renaming is the second phase. After the phi nodes exist, the compiler walks the dominator tree, not the raw CFG. It keeps one stack per source variable. When it sees a definition, including a phi, it creates a fresh SSA name and pushes it. When it sees a use, it rewrites the use to the current stack top. When the walk leaves a dominator-tree subtree, it pops the names created inside that subtree.`,
        `Phi operands need special handling because they belong to predecessor edges. When the renamer finishes a block, it looks at each CFG successor and fills the successor's phi operand for the edge from the current block using the current stack top. The incoming value for a phi is therefore the version live at the end of the predecessor, not a value computed inside the join block itself.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Phi placement is correct because every conflict between reaching definitions appears at a boundary where dominance no longer gives one definition exclusive authority. If two definitions can reach a block through different predecessors and neither one dominates the other incoming path, the frontier rule creates a merge definition. Iteration propagates this reasoning through chains of joins and loop backedges.`,
        `Renaming is correct because dominance is the scope rule for SSA values. While the walk is inside a dominated region, the stack top is the nearest active definition that dominates the current instruction. A nested assignment shadows the older name by pushing a new version. Leaving the subtree pops that version, restoring the name that is visible outside. This gives every use one explicit definition while preserving the original control-flow meaning.`,
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        `Take the CFG in the animation. The left block assigns x = 1. The right block assigns x = 2. Both flow into join. Since neither branch definition dominates join, join is in the dominance frontier of both definitions, so phi placement inserts a phi for x there. The body block also assigns x = x + 1 and jumps back to join, making the same join act as a loop header that combines the pre-loop value with the value from the previous iteration.`,
        `After placement, the rename walk might create x1 for the left assignment, x2 for the right assignment, x3 for the join phi, and x4 for the body increment. The phi at join receives x1 on the left edge, x2 on the right edge, and x4 on the backedge. The exit block's return uses the current version flowing from join. The original source variable x has become a small value graph where each edge states exactly which definition reaches which use.`,
      ],
    },
    {
      heading: 'Animation focus',
      paragraphs: [
        `The phi-placement view shows why SSA construction starts from definition blocks rather than from text order. The CFG highlights the blocks that assign x and the join where paths meet. The dominator tree view shows the region where a definition is guaranteed to be seen before a use. The dominance-frontier table then turns that graph fact into worklist actions: left, right, and body all force a phi at join, and the inserted phi is treated as an already-seen definition.`,
        `The rename-stacks view shows why placement alone is not enough. A phi says that a merge value exists, but it does not yet assign unique names to every use. The stack table shows definitions being pushed and popped as the dominator-tree walk enters and leaves regions. The successor-edge frame shows the detail that often causes implementation bugs: phi operands are filled from predecessors, so each incoming value must be captured at the end of the correct CFG edge.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost starts with dominator computation. Efficient algorithms build the dominator tree for the CFG, then compute dominance frontiers or answer frontier queries. Phi placement is worklist-driven per variable, so its practical cost depends heavily on how many variables are assigned and how many frontier blocks they touch. The rename pass is usually close to linear in the number of instructions, operands, phi nodes, and phi operands.`,
        `Phi count controls downstream cost. Minimal construction places phis required by dominance-frontier reasoning. Semi-pruned and pruned construction add liveness information so variables that are not live at a join do not receive phis. That matters because every unnecessary phi can feed more copies, more analysis facts, more register pressure, and more cleanup work during SSA destruction.`,
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        `Dominance-frontier construction is classic, well understood, and produces a clean SSA graph for scalar variables. The tradeoff is that it requires a reasonably complete CFG and dominator infrastructure before SSA exists. Some compilers instead build SSA incrementally, use sealed blocks, or construct SSA while parsing for simpler front ends. Those approaches can be easier in a just-in-time compiler or single-pass builder, but the same merge-value problem still has to be solved.`,
        `There is also a tradeoff between exact minimality and engineering simplicity. Inserting too many phis is correct but expensive. Inserting too few is wrong. Pruned construction needs liveness analysis, which adds another dependency but reduces noise. Production compilers choose based on IR size, pass pipeline, debugging needs, and how expensive later cleanup is compared with earlier analysis.`,
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        `Dominance-frontier SSA construction wins when an optimizer wants sparse value reasoning. Sparse conditional constant propagation can jump from definitions to uses. Dead-code elimination can see whether a value is used. Copy propagation and global value numbering can reason about one SSA value at a time. Loop optimizations can distinguish the value entering a loop from the value carried by the backedge.`,
        `It fails as a complete story for memory. Loads and stores do not become unambiguous just because scalar temporaries are renamed. Aliasing means two syntactically different memory operations can refer to the same location. Compilers use additional structures such as MemorySSA, alias analysis, and effect modeling for memory. SSA also has to be destroyed or lowered later, usually by translating phis into parallel copies on predecessor edges.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Wrong CFGs create wrong SSA. Missing exceptional edges, stale predecessor lists, un-split critical edges, unreachable blocks, and malformed loop backedges can all produce missing phi operands or phis in the wrong block. If the dominator tree is computed over a CFG that later changes, SSA construction may silently use stale dominance facts. Compiler passes that mutate control flow must update or rebuild the relevant analyses.`,
        `Rename bugs are equally common. Forgetting to pop a name when leaving a dominator-tree subtree lets a definition leak into a region it does not dominate. Filling phi operands while visiting the join instead of the predecessor edge assigns the wrong incoming version. Treating all variables as live everywhere bloats the IR. Treating undefined incoming values casually can hide front-end errors. A good test suite includes branches, loops, nested conditionals, critical edges, unreachable blocks, and variables live across only some joins.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Study Control Flow Graph & Dominator Tree before this topic, because dominance and predecessor edges are the foundation. Study Data-Flow Worklist Analysis for the fixed-point pattern behind iterated frontier processing. Then study Sparse Conditional Constant Propagation, Global Value Numbering, Dead Code Elimination, and Loop-Invariant Code Motion to see why SSA is useful. Study MemorySSA Alias Graph for memory effects and SSA Destruction Phi Elimination & Parallel Copy for the lowering step after optimization.`,
        `Primary sources include Cytron et al., An Efficient Method of Computing Static Single Assignment Form, at https://c9x.me/compile/bib/ssa.pdf and the ACM DOI page at https://dl.acm.org/doi/10.1145/75277.75280. LLVM's phi instruction reference at https://llvm.org/docs/LangRef.html#phi-instruction and the Kaleidoscope SSA notes at https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl07.html are useful implementation-oriented companions. When reading a compiler, identify where it computes dominators, where it inserts phis, where it fills phi operands, and how it verifies SSA after CFG changes.`,
      ],
    },
  ],
};
