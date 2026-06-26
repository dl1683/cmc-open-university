// Zipper: a focused tree plus breadcrumbs that can rebuild the whole tree.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zipper-focused-tree',
  title: 'Zipper Focused Tree',
  category: 'Data Structures',
  summary: 'Represent a tree with a current focus and breadcrumbs so navigation and local immutable updates are cheap without parent pointers or whole-tree copying.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['focus and breadcrumbs', 'move and edit', 'editor case study'], defaultValue: 'focus and breadcrumbs' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function treeGraph(title, focus = 'b') {
  return graphState({
    nodes: [
      { id: 'root', label: '+', x: 4.4, y: 1.2, note: 'root' },
      { id: 'a', label: '*', x: 2.8, y: 3.0, note: 'left' },
      { id: 'd', label: 'call', x: 6.0, y: 3.0, note: 'right' },
      { id: 'b', label: 'x', x: 1.7, y: 5.0, note: focus === 'b' ? 'focus' : 'leaf' },
      { id: 'c', label: '2', x: 3.8, y: 5.0, note: 'sibling' },
      { id: 'e', label: 'f', x: 5.3, y: 5.0, note: 'fn' },
      { id: 'f', label: 'y', x: 6.9, y: 5.0, note: 'arg' },
      { id: 'crumb1', label: 'crumb *', x: 1.7, y: 7.0, note: 'right 2' },
      { id: 'crumb2', label: 'crumb +', x: 4.3, y: 7.0, note: 'right call' },
    ],
    edges: [
      { id: 'e-root-a', from: 'root', to: 'a', weight: 'L' },
      { id: 'e-root-d', from: 'root', to: 'd', weight: 'R' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'L' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: 'R' },
      { id: 'e-d-e', from: 'd', to: 'e', weight: 'fn' },
      { id: 'e-d-f', from: 'd', to: 'f', weight: 'arg' },
      { id: 'e-b-crumb1', from: 'b', to: 'crumb1' },
      { id: 'e-crumb1-crumb2', from: 'crumb1', to: 'crumb2', weight: 'up' },
    ],
  }, { title });
}

function* focusAndBreadcrumbs() {
  const focusLabel = 'x';
  const numCrumbs = 2;
  const treeNodes = 7;

  yield {
    state: treeGraph('A zipper is focus plus context'),
    highlight: { found: ['b'], active: ['crumb1', 'crumb2'], compare: ['c', 'd'] },
    explanation: `A zipper represents a tree at a current focus. Here the focus is leaf ${focusLabel}. The ${numCrumbs} breadcrumbs remember everything needed to rebuild the path back to the root: the parent operator and the siblings not currently in focus.`,
    invariant: `Zipper = focused subtree + enough context (${numCrumbs} crumbs for ${treeNodes} nodes) to reconstruct the original tree.`,
  };

  yield {
    state: labelMatrix(
      'Breadcrumb stack for focus x',
      [
        ['top', 'top crumb'],
        ['next', 'next crumb'],
        ['focus', 'focus'],
      ],
      [
        ['parent', 'parent'],
        ['lefts', 'left siblings'],
        ['rights', 'right siblings'],
      ],
      [
        ['*', 'none', '2'],
        ['+', 'none', 'call(f,y)'],
        ['x', '-', '-'],
      ],
    ),
    highlight: { active: ['top:parent', 'top:rights'], found: ['focus:parent'] },
    explanation: `The breadcrumb is not a parent pointer inside the tree. It is a context object outside the focused subtree of ${focusLabel}. Moving down pushes a crumb; moving up pops one of the ${numCrumbs} crumbs and rebuilds one parent node.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'whole', label: 'whole tree', x: 0.8, y: 4.0, note: 'immutable' },
        { id: 'left', label: 'left ctx', x: 2.7, y: 2.8, note: 'siblings' },
        { id: 'focus', label: 'focus', x: 4.7, y: 4.0, note: 'subtree' },
        { id: 'right', label: 'right ctx', x: 2.7, y: 5.2, note: 'siblings' },
        { id: 'edit', label: 'edit focus', x: 6.6, y: 4.0, note: 'local' },
        { id: 'rebuild', label: 'rebuild', x: 8.4, y: 4.0, note: 'zip up' },
      ],
      edges: [
        { id: 'e-whole-left', from: 'whole', to: 'left' },
        { id: 'e-left-focus', from: 'left', to: 'focus' },
        { id: 'e-right-focus', from: 'right', to: 'focus' },
        { id: 'e-focus-edit', from: 'focus', to: 'edit' },
        { id: 'e-edit-rebuild', from: 'edit', to: 'rebuild' },
      ],
    }, { title: 'Turn a tree inside out around the cursor' }),
    highlight: { found: ['focus', 'edit'], active: ['left', 'right'], compare: ['whole'] },
    explanation: `The mental move is to turn the ${treeNodes}-node tree inside out around the cursor. The focused subtree is easy to inspect or replace. The context (${numCrumbs} breadcrumbs) holds the hole that the focus fits back into.`,
  };
}

function* moveAndEdit() {
  const fromLabel = 'x';
  const toLabel = '2';
  const editedValue = '3';
  const navOps = 4;

  yield {
    state: treeGraph('Move right from x to 2', 'c'),
    highlight: { compare: ['b'], found: ['c'], active: ['crumb1', 'crumb2'] },
    explanation: `To move right, rebuild the current local sibling list: ${fromLabel} goes into the left-sibling side of the crumb, and ${toLabel} becomes the focus. This is O(1) for the local step when the sibling lists are already stored in the crumb.`,
  };

  yield {
    state: labelMatrix(
      'Edit the focused value',
      [
        ['before', 'before'],
        ['edit', 'local edit'],
        ['after', 'after zip up'],
      ],
      [
        ['focus', 'focus'],
        ['context', 'context'],
        ['whole', 'whole tree'],
      ],
      [
        ['2', 'crumbs remember * and +', 'x * 2 + call(f,y)'],
        ['3', 'unchanged crumbs', 'not rebuilt yet'],
        ['3', 'popped crumbs', 'x * 3 + call(f,y)'],
      ],
    ),
    highlight: { active: ['edit:focus'], found: ['after:whole'], compare: ['before:whole'] },
    explanation: `A local edit changes ${toLabel} to ${editedValue} at the focus. Zipping up rebuilds ancestors from breadcrumbs. In an immutable implementation, unchanged siblings are shared rather than copied wholesale.`,
    invariant: `Local replacement (${toLabel} -> ${editedValue}) plus breadcrumb replay yields a new whole tree.`,
  };

  yield {
    state: labelMatrix(
      'Navigation costs',
      [
        ['down', 'move down'],
        ['left', 'move left/right'],
        ['up', 'move up'],
        ['root', 'rebuild root'],
      ],
      [
        ['cost', 'cost'],
        ['action', 'action'],
      ],
      [
        ['O(1)', 'push crumb'],
        ['O(1)', 'rotate sibling focus'],
        ['O(1)', 'pop crumb'],
        ['O(depth)', 'zip all crumbs'],
      ],
    ),
    highlight: { found: ['down:cost', 'left:cost', 'up:cost'], compare: ['root:cost'] },
    explanation: `The zipper makes all ${navOps} navigation operations cheap. Reconstructing the whole tree costs the number of crumbs on the path. That is exactly what you want for cursors, structured editors, and localized transformations.`,
  };
}

function* editorCaseStudy() {
  const useCases = 4;
  const bufferTypes = 4;

  yield {
    state: labelMatrix(
      'Structured editor case study',
      [
        ['cursor', 'cursor'],
        ['rename', 'rename variable'],
        ['rewrite', 'rewrite subtree'],
        ['undo', 'undo'],
      ],
      [
        ['without', 'without zipper'],
        ['with', 'with zipper'],
      ],
      [
        ['path search from root', 'focus is current'],
        ['copy/search tree', 'edit focus, zip up'],
        ['manual parent links', 'breadcrumbs rebuild'],
        ['store whole snapshots', 'store old roots/crumbs'],
      ],
    ),
    highlight: { found: ['cursor:with', 'rename:with', 'rewrite:with'], compare: ['undo:without'] },
    explanation: `A structured editor manipulates syntax trees, not raw text. Across all ${useCases} use cases (cursor, rename, rewrite, undo), a zipper gives the focus a pure data-structure representation without mutating parent pointers.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'ast', label: 'AST root', x: 0.8, y: 4.0, note: 'program' },
        { id: 'focus', label: 'selected expr', x: 3.0, y: 4.0, note: 'zipper' },
        { id: 'rewrite', label: 'rewrite', x: 5.2, y: 4.0, note: 'local rule' },
        { id: 'newRoot', label: 'new root', x: 7.5, y: 3.0, note: 'version N+1' },
        { id: 'oldRoot', label: 'old root', x: 7.5, y: 5.0, note: 'undo' },
      ],
      edges: [
        { id: 'e-ast-focus', from: 'ast', to: 'focus' },
        { id: 'e-focus-rewrite', from: 'focus', to: 'rewrite' },
        { id: 'e-rewrite-new', from: 'rewrite', to: 'newRoot' },
        { id: 'e-ast-old', from: 'ast', to: 'oldRoot' },
      ],
    }, { title: 'Zipper plus structural sharing' }),
    highlight: { active: ['focus', 'rewrite'], found: ['newRoot'], compare: ['oldRoot'] },
    explanation: `This mirrors Persistent Segment Tree and RRB Tree Persistent Vector: old roots stay valid, while the new version copies only the path being rebuilt. The zipper is the cursor-shaped version of path copying across ${useCases} editor operations.`,
  };

  yield {
    state: labelMatrix(
      'Where zippers fit',
      [
        ['gap', 'Gap Buffer'],
        ['rope', 'Text Rope'],
        ['piece', 'Piece Table'],
        ['zipper', 'Zipper'],
      ],
      [
        ['focus', 'focus model'],
        ['best', 'best at'],
        ['weak', 'weak at'],
      ],
      [
        ['cursor gap', 'single local text edits', 'far cursor jumps'],
        ['tree path', 'large strings', 'metadata overhead'],
        ['piece descriptors', 'file edits and undo', 'span indexing'],
        ['subtree + crumbs', 'structured local edits', 'many cursors'],
      ],
    ),
    highlight: { found: ['zipper:focus', 'zipper:best'], compare: ['gap:focus', 'rope:focus', 'piece:focus'] },
    explanation: `A zipper is not a replacement for every editor buffer. Compared against ${bufferTypes} buffer types (gap, rope, piece table, zipper), it is strongest when the document has recursive structure and one focused location matters: AST editors, proof assistants, outline editors, filesystems, UI trees, or window focus stacks.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'focus and breadcrumbs') yield* focusAndBreadcrumbs();
  else if (view === 'move and edit') yield* moveAndEdit();
  else if (view === 'editor case study') yield* editorCaseStudy();
  else throw new InputError('Pick a zipper view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the highlighted node as the focus, which means the subtree the cursor is currently inside. The stack beside it is the context, also called breadcrumbs, and each breadcrumb remembers one parent plus the siblings that were not followed.',
        {type: 'image', src: './assets/gifs/zipper-focused-tree.gif', alt: 'Animated walkthrough of the zipper focused tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'A down move removes one child from its parent and records the missing parent shape. An up move plugs the current focus back into the most recent breadcrumb and rebuilds that parent.',
        'The safe inference rule is reconstruction: focus plus breadcrumbs equals one whole tree. If that equation stays true after every move, a local edit can later produce a complete new root.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A zipper exists because immutable trees still need cursor-like editing. Immutable means an existing tree node is not changed in place; an edit creates new nodes where needed and shares the untouched parts.',
        {type: 'callout', text: 'A zipper is a tree turned inside out around one focus: the current subtree plus the context needed to rebuild the root.'},
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg',
          alt: 'Binary tree diagram with a root and child nodes',
          caption: 'A zipper keeps ordinary tree structure, but moves the path to the current node out into breadcrumbs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.',
        },
        'A code editor, proof assistant, outline editor, or filesystem browser often has one current location. The program wants to move nearby, edit locally, and still recover the whole structure afterward.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store parent pointers in every node. Then a cursor can move from a child back to its parent without remembering anything outside the tree.',
        'That is natural for mutable structures because each node can point both down and up. It also makes the cursor feel cheap: moving up is one pointer hop, and moving down follows an existing child pointer.',
        'Another simple approach is to keep only the root and search from the root for every move. That keeps the tree plain, but it repeats the path work after each local edit or navigation step.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Parent pointers are a poor fit for persistent immutable trees. Persistent means old versions remain usable after an edit, so changing a parent pointer or child pointer in place can corrupt sharing between versions.',
        'Root search also wastes the locality of editing. If the cursor just moved from a node to its child, the path back to the parent is already known, but a root-only representation throws that path away.',
        'The wall is missing context. A focused subtree by itself cannot rebuild the root, and the root by itself does not remember where the current focus came from without another search.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store the path as data outside the tree. A breadcrumb is one suspended parent frame: it records which side the focus came from and stores the siblings needed to rebuild that parent.',
        'A zipper has two pieces: the focus and a stack of breadcrumbs. The focus is the current subtree; the breadcrumb stack is the rest of the tree with a hole where the focus belongs.',
        'This turns navigation into reversible local transformations. Moving down pushes context, moving up pops context, and editing replaces only the focus until the program asks for a full root again.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a binary tree, moving left from parent P pushes a breadcrumb that remembers P\'s value and P\'s right child. The new focus becomes the old left child, and the breadcrumb says how to rebuild P when the cursor comes back up.',
        'Moving right is symmetric: store the parent value and left sibling, then focus on the right child. Moving up pops the most recent breadcrumb and creates a new parent with the focus restored in the recorded side.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rust_MIR_CFG.svg/250px-Rust_MIR_CFG.svg.png',
          alt: 'Rust compiler control-flow graph with basic blocks and edges',
          caption: 'Compiler intermediate representations are structured graphs and trees; a focused editor or rewrite pass needs local context plus a way back to the whole program. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rust_MIR_CFG.svg.',
        },
        'Editing is just replacement of the focus. The old focused subtree can remain available to old versions, while zipping up allocates only the changed path back to the root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the reconstruction invariant: plugging the focus into the breadcrumb stack must produce the same whole tree represented by the zipper. The empty breadcrumb stack means the focus already is the whole tree.',
        'A down move preserves the invariant because it removes one child and records exactly the parent information needed to put that child back. No sibling is lost, because every sibling not followed is stored in the breadcrumb.',
        'An up move preserves the invariant because it performs the inverse operation. It takes the stored parent frame, places the current focus back into the recorded hole, and leaves the remaining breadcrumbs unchanged.',
        'An edit changes the focus, so the rebuilt root changes only along the breadcrumb path. Untouched siblings remain the same objects, which is why immutable sharing is preserved.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Local movement is constant time for ordinary binary-tree crumbs. Down pushes one breadcrumb, up pops one breadcrumb, and the amount of stored sibling data per move is fixed for a binary node.',
        'Rebuilding the full root costs time proportional to depth, not total tree size. If the focus is 20 edges below the root in a 1,000,000-node tree, zipping up rebuilds about 20 path nodes and shares the rest.',
        'The cost behaves badly when operations are global rather than local. Jumping to an arbitrary node by ID still needs a search or a separate index, because the zipper only knows the current focus and its path.',
        'Memory cost is the breadcrumb stack plus any rebuilt path nodes after edits. A single cursor at depth d stores O(d) context; many independent cursors store many independent paths.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Structured code editors use zipper-like state when the user edits one expression inside an abstract syntax tree. The cursor keeps the selected expression as focus and keeps enclosing syntax as breadcrumbs, so a rewrite can produce a new root while sharing unchanged branches.',
        'Proof assistants use the same shape for focused subterms. A proof step often rewrites one term inside a larger theorem, and the system needs both the local term and the context that explains where it belongs.',
        'Filesystem browsers and outline editors also fit when navigation is local. The current directory or outline item is the focus, while parents and siblings form the path needed to move back and rebuild a displayed tree.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A zipper is not a search index. If every operation starts from a global lookup such as node id 94813, a map from ids to paths or nodes must do that work first.',
        'It is also weak for many simultaneous cursors. One zipper represents one focus, so thousands of independent active positions may need a different structure such as an indexed tree, rope, piece table, or CRDT metadata.',
        'Concurrent edits can make breadcrumbs stale. In pure immutable code this is handled by treating the zipper as a view of one version, but collaborative systems need merge rules when two users edit related paths.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the expression tree (4 * 2) + (10 - 3), which has seven number/operator nodes. Focus on 4 by moving left from + into *, then left from * into 4.',
        'The breadcrumb stack now has two frames. The first frame says the focus came from the left side of + and stores the right sibling (10 - 3); the second says the focus came from the left side of * and stores the right sibling 2.',
        'Replace the focused 4 with 5. Zipping up first rebuilds 5 * 2, then rebuilds (5 * 2) + (10 - 3), so the new expression evaluates to 10 + 7 = 17 instead of 8 + 7 = 15.',
        'Only the two path nodes, * and +, must be rebuilt. The number 2 and the whole (10 - 3) subtree can be shared with the old tree, so the edit cost follows depth 2 instead of total size 7.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Gerard Huet, The Zipper, Journal of Functional Programming, with PDFs at https://gallium.inria.fr/~huet/PUBLIC/zip.pdf and https://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf. The Cambridge page is https://www.cambridge.org/core/journals/journal-of-functional-programming/article/zipper/0C058890B8A9B588F26E6D68CF0CE204.',
        'Study tree traversal, recursion, and persistent data structures before treating zippers as an editor technique. The prerequisite idea is that a tree can be rebuilt from a changed path while sharing untouched subtrees.',
        'Study finger trees, ropes, piece tables, gap buffers, and CRDTs next to compare cursor locality with indexing, text editing, and collaborative editing. For compiler context, study abstract syntax trees and static single assignment form.',
      ],
    },
  ],
};
