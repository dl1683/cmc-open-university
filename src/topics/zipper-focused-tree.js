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
  yield {
    state: treeGraph('A zipper is focus plus context'),
    highlight: { found: ['b'], active: ['crumb1', 'crumb2'], compare: ['c', 'd'] },
    explanation: 'A zipper represents a tree at a current focus. Here the focus is leaf x. The breadcrumbs remember everything needed to rebuild the path back to the root: the parent operator and the siblings not currently in focus.',
    invariant: 'Zipper = focused subtree + enough context to reconstruct the original tree.',
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
    explanation: 'The breadcrumb is not a parent pointer inside the tree. It is a context object outside the focused subtree. Moving down pushes a crumb; moving up pops a crumb and rebuilds one parent node.',
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
    explanation: 'The mental move is to turn the tree inside out around the cursor. The focused subtree is easy to inspect or replace. The context holds the hole that the focus fits back into.',
  };
}

function* moveAndEdit() {
  yield {
    state: treeGraph('Move right from x to 2', 'c'),
    highlight: { compare: ['b'], found: ['c'], active: ['crumb1', 'crumb2'] },
    explanation: 'To move right, rebuild the current local sibling list: x goes into the left-sibling side of the crumb, and 2 becomes the focus. This is O(1) for the local step when the sibling lists are already stored in the crumb.',
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
    explanation: 'A local edit changes only the focus. Zipping up rebuilds ancestors from breadcrumbs. In an immutable implementation, unchanged siblings are shared rather than copied wholesale.',
    invariant: 'Local replacement plus breadcrumb replay yields a new whole tree.',
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
    explanation: 'The zipper makes local movement cheap. Reconstructing the whole tree costs the number of crumbs on the path. That is exactly what you want for cursors, structured editors, and localized transformations.',
  };
}

function* editorCaseStudy() {
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
    explanation: 'A structured editor manipulates syntax trees, not raw text. The user has a current expression, field, paragraph, or DOM node. A zipper gives that focus a pure data-structure representation without mutating parent pointers.',
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
    explanation: 'This mirrors Persistent Segment Tree and RRB Tree Persistent Vector: old roots stay valid, while the new version copies only the path being rebuilt. The zipper is the cursor-shaped version of path copying.',
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
    explanation: 'A zipper is not a replacement for every editor buffer. It is strongest when the document has recursive structure and one focused location matters: AST editors, proof assistants, outline editors, filesystems, UI trees, or window focus stacks.',
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
      heading: 'What it is',
      paragraphs: [
        'A zipper is a way to represent a recursive data structure together with a current focus. Instead of storing parent pointers inside every node, the zipper stores the focused subtree plus a stack of breadcrumbs. Each breadcrumb records the parent shape and the siblings that were not followed. Together, focus and breadcrumbs contain enough information to rebuild the whole structure.',
        {type: 'callout', text: 'A zipper is a tree turned inside out around one focus: the current subtree plus the context needed to rebuild the root.'},
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg',
          alt: 'Binary tree diagram with a root and child nodes',
          caption: 'A zipper keeps ordinary tree structure, but moves the path to the current node out into breadcrumbs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.',
        },
        'The obvious way to edit a tree at a cursor is to keep parent pointers or to start again from the root after each move. Parent pointers complicate immutable data and sharing; root searches repeat path work. A zipper exists because the path to the focus is exactly the information needed for the next local move and for rebuilding the tree after an edit.',
        'Gerard Huet introduced the zipper as a functional programming pearl for navigating and updating trees. The idea generalizes to lists, trees, syntax trees, filesystems, editor outlines, and other recursive structures. It is especially useful when data is immutable but the program still needs cursor-like movement and local edits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To move down into a child, push a breadcrumb describing the parent and the other children. To move sideways, rotate the focus through sibling lists in the current breadcrumb. To move up, pop one breadcrumb and rebuild the parent by placing the focus back into the remembered hole. To edit, replace the focus locally, then zip up when a full root is needed.',
        'The key invariant is reconstruction. A zipper is not merely a pointer; it is a context with a hole. The focused subtree fills that hole. If the focus is changed, replaying the breadcrumbs creates a new whole tree that shares unchanged siblings with the old tree. That makes the zipper a cursor-shaped cousin of Persistent Segment Tree path copying and RRB Tree structural sharing.',
        'Correctness is structural: every move preserves the equation whole tree = context with focus plugged into its hole. Moving down takes one child out of the whole and records the missing parent context. Moving up plugs the focus back into that context. Editing changes the focus, not the promise that the context can rebuild a whole tree.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Read the highlighted focus as the current subtree and the breadcrumb stack as everything needed to rebuild the path back to the root. When the focus moves down, the parent is not lost; it is turned into a context with a hole.',
        'The practical lesson is local editing on immutable data. The animation is showing why an editor, proof assistant, or AST tool can change one focused region while sharing untouched siblings. The zipper is useful when movement is local and the current focus matters more than global random access.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Local movement is often O(1): down pushes one crumb, up pops one crumb, and left/right moves within stored sibling lists. Rebuilding the root is O(depth) because every breadcrumb on the path must be replayed. A local edit allocates the new focus plus the rebuilt path, while untouched subtrees can be shared. The memory overhead is the breadcrumb stack for the current focus.',
        'The behavior is excellent for a single active cursor and poor for random global indexing. If every operation jumps to an arbitrary node by ID, the zipper needs another index to find that path. If the user moves locally through the structure, the breadcrumb stack turns recent navigation into constant-time context.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A structured code editor stores a program as an AST. The user selects an expression such as x * 2 inside a larger function. The zipper focus is that expression; breadcrumbs remember the enclosing multiply, addition, call, block, and file nodes. A refactor changes 2 to 3 or replaces x * 2 with scale(x). The editor zips up to create a new AST root while sharing every untouched subtree.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rust_MIR_CFG.svg/250px-Rust_MIR_CFG.svg.png',
          alt: 'Rust compiler control-flow graph with basic blocks and edges',
          caption: 'Compiler intermediate representations are structured graphs and trees; a focused editor or rewrite pass needs local context plus a way back to the whole program. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rust_MIR_CFG.svg.',
        },
        'Undo can keep the old root or old zipper state. A proof assistant or theorem editor uses the same pattern for focused subterms. A filesystem browser can treat the current directory as focus and parent directories as breadcrumbs. A window manager can store focused windows in zipper-like layouts. The common shape is one current location plus enough context to move and rebuild.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A zipper is not the same as a mutable parent pointer. Parent pointers live inside the structure and can create cycles or aliasing concerns. Breadcrumbs live outside the focused subtree and are usually consumed or copied as navigation state. This distinction matters in immutable programs and undoable editors.',
        'Zippers are also not ideal for many simultaneous cursors. One zipper represents one focus. If thousands of cursors must move independently, an indexed tree, rope, piece table, interval tree, Finger Tree Measured Sequence, or CRDT metadata may fit better. Use the zipper when focused local navigation is the main operation, not as a universal replacement for indexes.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The main limit is focus locality. A zipper is excellent when the next operation is near the current focus. It is not a search index. If the application repeatedly jumps to arbitrary nodes by ID, the zipper either needs a separate map from IDs to paths or it will spend time rediscovering paths from the root.',
        'Another failure mode is stale context. If the underlying tree is edited elsewhere while a zipper still holds old breadcrumbs, zipping up may rebuild against an outdated structure. Pure immutable designs avoid this by treating the zipper as a versioned view of one root; collaborative or concurrent editors need explicit merge rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the expression tree `(x * 2) + call(f, y)`. Focus on `x`. The top breadcrumb remembers that `x` was the left child of `*` and that `2` was the right child. The next breadcrumb remembers that the `*` subtree was the left child of `+` and that `call(f, y)` was the right child.',
        'If the editor replaces `x` with `price`, no whole-tree copy is needed immediately. When the editor zips up, it rebuilds `price * 2`, then rebuilds `(price * 2) + call(f, y)`. The old `2` and `call(f, y)` subtrees are shared. That is the practical value: local edits produce a new immutable root with copying proportional to depth, not total tree size.',
      ],
    },
    {
      heading: 'When to choose it',
      paragraphs: [
        'Choose a zipper when the user or algorithm has a current location and mostly moves to nearby structure: next sibling, parent, child, previous field, selected expression, current proof term, current directory. The zipper makes that focus first-class without mutating the tree.',
        'Choose something else when the dominant operation is global lookup, range query, many concurrent cursors, or text editing by byte offset. In those cases the zipper may still help inside one local edit, but it should be paired with an index, rope, piece table, finger tree, or CRDT rather than carrying the whole workload alone.',
        'The rule of thumb is simple: if the next edit starts where the previous edit ended, a zipper is probably natural. If every edit starts from a search box, build an index first.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Huet, "The Zipper", PDF at https://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf, INRIA PDF at https://gallium.inria.fr/~huet/PUBLIC/zip.pdf, and Cambridge Journal of Functional Programming page at https://www.cambridge.org/core/journals/journal-of-functional-programming/article/zipper/0C058890B8A9B588F26E6D68CF0CE204. A practical tutorial is Learn You a Haskell: Zippers at https://learnyouahaskell.github.io/zippers.html. Study Linked List, Tree Traversals, Recursion, Persistent Segment Tree, RRB Tree Persistent Vector, Finger Tree Measured Sequence, Gap Buffer Text Editor, Piece Table Text Buffer, Text Rope Data Structure, Pratt Parser Expression AST, Static Single Assignment & Phi Nodes, and Dancing Links & Exact Cover next.',
      ],
    },
  ],
};
