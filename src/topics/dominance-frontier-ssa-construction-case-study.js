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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a compiler turning mutable variable names into explicit value definitions. A control-flow graph is a graph of basic blocks, dominance means every path from entry to a block must pass through another block, and Static Single Assignment form gives each definition a unique name. Active state is the block or variable being processed, visited state is dominance or frontier information already computed, and found state is a phi placement or renamed use.',
        'The safe inference is dominance-based. If a definition dominates a use and no competing definition can reach that use, the use can name that definition directly. If paths carrying different definitions meet where dominance no longer gives one definition authority, a phi node is needed to merge incoming values.',
        {type: 'callout', text: `SSA construction turns ambiguous mutable names into a sparse value graph by placing phis where dominance stops and then renaming along the dominator tree.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Optimizing compilers ask value questions. When an instruction uses x, the optimizer needs to know which assignment of x reaches that use. In ordinary mutable code, the same source name can mean different values on different paths.',
        'SSA form exists to make those value relationships explicit. Each assignment receives a unique name, and each use points to one definition. Later passes such as constant propagation, dead-code elimination, and global value numbering can follow use-def edges instead of repeatedly solving broad data-flow problems.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious SSA construction inserts a phi for every variable at every join block. A phi is a merge definition, such as x3 = phi(x1 from left, x2 from right). This is correct-looking because every control-flow merge gets a place to combine incoming values.',
        'Another simple approach is to rename assignments in text order. That fails as soon as branches and loops exist because text order does not describe which definition reaches which path. The control-flow graph, not the source line order, decides value reachability.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Phi-everywhere construction bloats the intermediate representation. A real function can have many variables, joins, loop headers, exceptional edges, and compiler temporaries. Unneeded phis consume memory and create extra work for every later pass.',
        'Text-order renaming is worse because it can be wrong. A definition inside one branch does not dominate code after the other branch. If the compiler lets that name leak, later optimizations may treat a value as available on paths where it was never assigned.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The dominance frontier identifies where a definition can reach but no longer strictly dominates. That boundary is where another path can enter with a competing definition. For each variable, phi nodes are needed in the iterated dominance frontier of the blocks that define that variable.',
        'The construction has two phases. Phi placement creates merge definitions at the right graph boundaries. Renaming then walks the dominator tree with one stack per source variable so each use receives the nearest currently active SSA name that dominates it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phi placement starts by collecting assignment blocks for one variable. Those blocks enter a worklist. When the algorithm pops a definition block, it inserts a phi for that variable in each block in the definition block dominance frontier if one is not already present.',
        'Every inserted phi is itself a new definition, so its block can go back into the worklist. This iteration matters for loops and chains of joins. After placement, the renamer walks the dominator tree, pushes a fresh name on each definition, rewrites uses to the stack top, fills successor phi operands from predecessor edges, and pops names when leaving a subtree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Phi placement is correct because a competing reaching definition can matter only where dominance stops giving one definition exclusive control. The dominance frontier is exactly that boundary. Iterating the frontier accounts for phis that create new merged definitions which can reach later boundaries.',
        'Renaming is correct because dominance is the scope rule for SSA values. While walking a dominator-tree subtree, the stack top for a variable is the nearest active definition that dominates the current instruction. Popping on exit prevents a definition from being used outside the region it dominates.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The first cost is dominator computation over the control-flow graph. Phi placement then depends on the number of variables with definitions and the size of their iterated dominance frontiers. Renaming is close to linear in instructions, operands, phis, and phi operands.',
        'Phi count is the behavioral cost. Too many phis increase memory, register-pressure noise, analysis facts, and cleanup work. Pruned SSA uses liveness information to avoid phis for variables that are not live at a join, trading earlier analysis cost for a smaller value graph.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SSA is useful in optimizing compilers because it turns many value analyses into sparse graph problems. Constant propagation can move from a definition to its uses. Dead-code elimination can delete definitions with no live uses. Global value numbering can reason about one SSA value at a time.',
        'It is also useful in just-in-time compilers and static analyzers because it makes data dependence inspectable. A loop-header phi separates the value entering a loop from the value carried by the backedge. That distinction is exactly what many loop optimizations need.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SSA for scalar variables does not solve memory aliasing. Two loads or stores through different pointers may refer to the same location even if scalar temporaries have unique names. Compilers need MemorySSA, alias analysis, and effect models for that part of the program.',
        'Construction also fails if the control-flow graph is wrong. Missing exceptional edges, stale predecessor lists, unsplit critical edges, and unreachable blocks can create missing phi operands or invalid dominance facts. Any pass that mutates control flow must update or rebuild the analyses that SSA depends on.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose entry branches to left and right. left assigns x = 1, right assigns x = 2, and both flow to join. Neither left nor right dominates join because the other path can reach join without passing through it, so join is in the dominance frontier for both definitions.',
        'Phi placement inserts x3 = phi(x1, x2) at join. If a loop body later assigns x4 = x3 + 1 and jumps back to join, the backedge becomes another incoming operand, so the phi is x3 = phi(x1, x2, x4). The renamed graph now states exactly which value reaches each path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Cytron et al., An Efficient Method of Computing Static Single Assignment Form, at https://c9x.me/compile/bib/ssa.pdf and the ACM DOI page at https://dl.acm.org/doi/10.1145/75277.75280. Study control-flow graphs and dominator trees before this topic, then data-flow worklists, sparse conditional constant propagation, global value numbering, MemorySSA, and SSA destruction.',
      ],
    },
  ],
};
