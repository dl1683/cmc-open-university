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
      heading: 'What it is',
      paragraphs: [
        'Dominance-frontier SSA construction is the classic algorithm for turning mutable local variables into Static Single Assignment form. It has two separable phases: place phi nodes at merge points, then rename definitions and uses with stacks while walking the dominator tree.',
        'The data structure insight is that phi placement is not a text rewrite. It is a graph problem over the Control Flow Graph & Dominator Tree. Definitions flow until they hit a frontier where another path can enter without being dominated by the same definition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each variable, collect blocks that assign it. Put those blocks on a worklist. For every block on the worklist, visit its dominance frontier. If a frontier block does not already have a phi for that variable, insert one. Because the phi is itself a new definition, add the phi block back to the worklist. This computes an iterated dominance frontier.',
        'The rename phase walks the dominator tree. Each source variable has a stack of current SSA names. A new definition pushes a fresh version. A use reads the top of the stack. When the traversal leaves a block subtree, names defined inside that subtree are popped.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Take a branch where left assigns x = 1, right assigns x = 2, and both paths reach a join that later feeds a loop. The left and right definitions both have the join in their dominance frontier, so the join receives a phi for x. If the loop body assigns x and jumps back to the join, the backedge also makes the join a loop-header phi site.',
        'After placement, renaming might produce x1 in the left block, x2 in the right block, x3 as the join phi, and x4 as the loop-body increment. The return at the exit uses the current version from the path through the join. There is no longer a vague source variable x with several possible reaching definitions.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Production compilers often use pruned or semi-pruned variants that consult liveness so they do not insert phis for variables that are not live at a join. That keeps the IR smaller and avoids making later passes clean up avoidable merge nodes.',
        'The algorithm is fragile if the CFG is wrong. Missing exceptional edges, stale predecessor lists, unreachable blocks, or incorrect edge splitting can all produce missing phi operands or phis in the wrong place. Most compilers pair CFG edits with analysis invalidation or dedicated update utilities.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cytron et al., An Efficient Method of Computing Static Single Assignment Form, at https://c9x.me/compile/bib/ssa.pdf and ACM DOI https://dl.acm.org/doi/10.1145/75277.75280; LLVM phi instruction reference at https://llvm.org/docs/LangRef.html#phi-instruction; and LLVM Kaleidoscope SSA notes at https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl07.html. Study Control Flow Graph & Dominator Tree, Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, MemorySSA Alias Graph, Sparse Conditional Constant Propagation, Linear Scan Register Allocation, and SSA Destruction Phi Elimination & Parallel Copy next.',
      ],
    },
  ],
};
