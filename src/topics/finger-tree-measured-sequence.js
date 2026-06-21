// Finger trees: persistent sequences with fast access at both ends and
// monoidal measures that turn one tree shape into many indexed structures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'finger-tree-measured-sequence',
  title: 'Finger Tree Measured Sequence',
  category: 'Data Structures',
  summary: 'A persistent 2-3 sequence tree: digits give fast ends, the middle recurses, and monoidal measures power split, indexing, priority, and interval queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['digits and spine', 'measured split', 'case studies'], defaultValue: 'digits and spine' },
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

function fingerShape(title) {
  return graphState({
    nodes: [
      { id: 'measure', label: 'measure', x: 4.9, y: 0.9, note: 'monoid' },
      { id: 'prefix', label: 'prefix', x: 1.2, y: 3.0, note: '1..4 items' },
      { id: 'middle', label: 'middle', x: 4.9, y: 3.0, note: 'recursive' },
      { id: 'suffix', label: 'suffix', x: 8.6, y: 3.0, note: '1..4 items' },
      { id: 'left', label: 'left end', x: 1.2, y: 5.2, note: 'O(1)' },
      { id: 'right', label: 'right end', x: 8.6, y: 5.2, note: 'O(1)' },
      { id: 'split', label: 'split', x: 4.9, y: 5.5, note: 'log n' },
    ],
    edges: [
      { id: 'e-measure-prefix', from: 'measure', to: 'prefix', weight: '' },
      { id: 'e-measure-middle', from: 'measure', to: 'middle', weight: '' },
      { id: 'e-measure-suffix', from: 'measure', to: 'suffix', weight: '' },
      { id: 'e-prefix-middle', from: 'prefix', to: 'middle', weight: '' },
      { id: 'e-middle-suffix', from: 'middle', to: 'suffix', weight: '' },
      { id: 'e-prefix-left', from: 'prefix', to: 'left', weight: '' },
      { id: 'e-suffix-right', from: 'suffix', to: 'right', weight: '' },
      { id: 'e-middle-split', from: 'middle', to: 'split', weight: '' },
    ],
  }, { title });
}

function* digitsAndSpine() {
  yield {
    state: fingerShape('Deep node: prefix digit, recursive middle, suffix digit'),
    highlight: { active: ['prefix', 'middle', 'suffix'], found: ['left', 'right'] },
    explanation: 'A finger tree is a persistent sequence shaped as Empty, Single, or Deep. In Deep, small prefix and suffix digits expose the two ends, while the middle recursively stores groups of 2 or 3 items.',
    invariant: 'Digits stay small, so pushing or popping at either end touches only a constant-size edge before occasional recursive repair.',
  };

  yield {
    state: labelMatrix(
      'Shape of a Deep node',
      [
        { id: 'prefix', label: 'prefix digit' },
        { id: 'middle', label: 'middle tree' },
        { id: 'suffix', label: 'suffix digit' },
        { id: 'node', label: 'Node2/3' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'role', label: 'role' },
      ],
      [
        ['1..4 values', 'fast left'],
        ['nodes', 'recursion'],
        ['1..4 values', 'fast right'],
        ['2 or 3 children', 'balance'],
      ],
    ),
    highlight: { active: ['prefix:role', 'suffix:role'], found: ['middle:role', 'node:role'] },
    explanation: 'The recursive middle does not hold raw elements at the next level. It holds Node2 and Node3 packets. That keeps the underlying 2-3-tree balance while making the ends cheap.',
  };

  yield {
    state: labelMatrix(
      'Deque operations',
      [
        { id: 'cons', label: 'push left' },
        { id: 'snoc', label: 'push right' },
        { id: 'viewl', label: 'pop left' },
        { id: 'viewr', label: 'pop right' },
      ],
      [
        { id: 'usual', label: 'usual touch' },
        { id: 'amortized', label: 'amortized' },
      ],
      [
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
        ['one digit', 'O(1)'],
      ],
    ),
    highlight: { found: ['cons:amortized', 'snoc:amortized', 'viewl:amortized', 'viewr:amortized'] },
    explanation: 'The name "finger" means the structure gives efficient access near distinguished positions. For the standard sequence, those fingers are the left and right ends.',
  };

  yield {
    state: fingerShape('Persistence comes from path copying and sharing'),
    highlight: { active: ['prefix', 'suffix', 'split'], compare: ['middle'], found: ['measure'] },
    explanation: 'Like RRB Tree Persistent Vector and Zipper Focused Tree, updates return a new root and share old pieces. The old sequence stays valid for undo, snapshots, or concurrent readers.',
  };
}

function* measuredSplit() {
  yield {
    state: labelMatrix(
      'Measure each element by size',
      [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
        { id: 'd', label: 'd' },
        { id: 'e', label: 'e' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'prefix', label: 'prefix sum' },
      ],
      [
        ['1', '1'],
        ['1', '2'],
        ['1', '3'],
        ['1', '4'],
        ['1', '5'],
      ],
    ),
    highlight: { active: ['c:prefix'], found: ['d:prefix'] },
    explanation: 'A measure is an associative summary. If every element has size 1, internal summaries are counts. Split at index 3 becomes: find the first place where the accumulated count crosses 3.',
    invariant: 'Measures must combine associatively so summaries can be cached at internal nodes and recomputed locally after updates.',
  };

  yield {
    state: fingerShape('Split follows cached measures down the tree'),
    highlight: { active: ['measure', 'middle', 'split'], found: ['prefix', 'suffix'] },
    explanation: 'The split operation does not scan the whole sequence. It walks by comparing the target predicate with cached measures, descends into one child, and rebuilds the two sides around the split point.',
  };

  yield {
    state: labelMatrix(
      'Swap the measure, get a different structure',
      [
        { id: 'seq', label: 'sequence' },
        { id: 'prio', label: 'priority q' },
        { id: 'interval', label: 'intervals' },
        { id: 'search', label: 'ordered search' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'query', label: 'query' },
      ],
      [
        ['count', 'index/split'],
        ['minimum priority', 'find min'],
        ['max endpoint', 'overlap'],
        ['ordered key summary', 'split by key'],
      ],
    ),
    highlight: { found: ['seq:query', 'prio:query', 'interval:query'], active: ['seq:measure'] },
    explanation: 'This is why finger trees are called general-purpose. The tree shape is stable; the measure decides what question can be routed quickly.',
  };

  yield {
    state: labelMatrix(
      'Complexities',
      [
        { id: 'ends', label: 'ends' },
        { id: 'concat', label: 'concat' },
        { id: 'split', label: 'split' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['amortized O(1)', 'digits'],
        ['O(log min(n,m))', 'join smaller side'],
        ['O(log n)', 'measure descent'],
        ['O(log n)', 'count measure'],
      ],
    ),
    highlight: { found: ['ends:cost', 'concat:cost', 'split:cost'], compare: ['index:reason'] },
    explanation: 'Finger trees are not flat arrays. They trade tight cache locality for persistent structure, fast ends, efficient concatenation, and flexible measured search.',
  };
}

function* caseStudies() {
  yield {
    state: labelMatrix(
      'Complete case-study routes',
      [
        { id: 'haskell', label: 'Data.Sequence' },
        { id: 'rope', label: 'rope/editor' },
        { id: 'prio', label: 'priority queue' },
        { id: 'interval', label: 'interval index' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'measure', label: 'measure' },
      ],
      [
        ['persistent deque', 'size'],
        ['split near index', 'chunk length'],
        ['find best task', 'min priority'],
        ['overlap query', 'max endpoint'],
      ],
    ),
    highlight: { active: ['haskell:need', 'haskell:measure'], found: ['rope:measure', 'interval:measure'] },
    explanation: 'Haskell Data.Sequence is the canonical production-facing case study: a persistent finite sequence built on finger-tree ideas. The same measured-tree recipe adapts to text, priority, and interval workloads.',
  };

  yield {
    state: fingerShape('Editor case study: split and rejoin persistent text chunks'),
    highlight: { active: ['split', 'measure'], found: ['prefix', 'suffix'], compare: ['middle'] },
    explanation: 'A rope-like editor can store chunks in a measured finger tree where the measure is character count. Cursor movement and split-at-position use cached sizes, while edits share most unchanged chunks.',
  };

  yield {
    state: labelMatrix(
      'When to choose it',
      [
        { id: 'versions', label: 'versions' },
        { id: 'ends', label: 'two ends' },
        { id: 'splits', label: 'split/join' },
        { id: 'arrays', label: 'tight arrays' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['undo/snapshots', 'good fit'],
        ['deque-heavy', 'good fit'],
        ['measured routing', 'good fit'],
        ['numeric loops', 'bad fit'],
      ],
    ),
    highlight: { found: ['versions:decision', 'ends:decision', 'splits:decision'], compare: ['arrays:decision'] },
    explanation: 'The practical rule is conservative. Use a finger tree when persistence plus measured split/join are first-class operations. Do not use it to replace a simple array in hot numeric code.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'digits and spine') yield* digitsAndSpine();
  else if (view === 'measured split') yield* measuredSplit();
  else if (view === 'case studies') yield* caseStudies();
  else throw new InputError('Pick a finger-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A finger tree is a persistent sequence data structure built from a small set of cases: Empty, Single, and Deep. A Deep node has a prefix digit, a recursive middle tree, and a suffix digit. The digits keep the two ends close, while the middle stores groups of two or three elements to preserve balance.',
        {type: 'callout', text: 'The measure is the index: once every subtree carries a monoidal summary, split and search become guided descent.'},
        'The obvious persistent sequence choices each miss something. A linked list has a fast front but slow indexing and concatenation. A balanced tree has logarithmic access but can make deque operations feel heavier than they should. A flat array is cache-friendly but expensive to edit immutably. Finger trees exist to combine fast ends, persistence, split, concat, and searchable summaries in one general shape.',
        'The Hinze and Paterson version is a 2-3 finger tree with a second idea layered on top: every element has a measure, and measures combine through an associative operation. That makes the same tree shape support indexed sequences, priority queues, interval searches, ordered splits, and other structures.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Pushing or popping at either end usually edits only a small digit of one to four items. When a digit overflows or underflows, a small Node2 or Node3 packet is moved into or out of the recursive middle. Because the middle stores nodes rather than raw elements, the tree stays balanced without global rebuilding.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Finger-tree_from_2-3_tree.jpg/330px-Finger-tree_from_2-3_tree.jpg', alt: 'Transformation from a 2-3 tree into a finger tree with exposed ends', caption: 'A finger tree pulls the ends of a balanced tree close to the top while keeping the middle recursive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Finger-tree_from_2-3_tree.jpg.'},
        'For indexed sequences, the measure is size. Internal nodes cache the total size below them. To split at index k, walk down the tree while accumulating sizes until the predicate "past k" becomes true, then rebuild the left and right sides around the split point. Other measures route other questions in the same way.',
        'Why it works: the 2-3 shape bounds height, and the measure is a monoid. Associativity means cached summaries can be regrouped when the tree is rebalanced without changing their meaning. The split predicate can descend using summaries because each summary faithfully represents the whole subtree below it.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Watch the digits at the ends first. They explain why push and pop near either end are cheap: most updates touch a tiny prefix or suffix before the recursive middle gets involved.',
        'When the measured split view runs, treat the cached measure as a routing summary. The tree is not scanning every element to find the split point; it descends through summaries until the predicate crosses the boundary. The correctness hinge is that the measure combines associatively, so cached summaries still mean the same thing after regrouping.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Access, push, and pop at either end are amortized O(1). Concatenation and split are logarithmic, with concat depending on the size of the smaller side. Indexing through a size measure is O(log n). Updates allocate along the edited path and share the untouched structure, so previous versions remain available.',
        'The tradeoff is constant factors and locality. A finger tree is elegant and flexible, but it is pointer-rich and more complex than an array, deque, or plain rope. It earns its keep when persistence, ends, split, concat, or measured search matter at the same time.',
        'When n doubles, tree height grows logarithmically, but the number of small objects also grows. That object overhead is the tax paid for structural sharing and general measured routing.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'The canonical library case study is Haskell Data.Sequence, which exposes a persistent finite sequence API with fast operations at both ends and logarithmic indexed operations. Its value is not that every operation is faster than a specialized mutable container; it is that a functional program can keep old versions, build new versions, and still use a serious sequence abstraction.',
        'A second case study is a text editor or structured document store. Store text chunks in a measured finger tree where the measure is character count. Split at cursor, insert a chunk, concatenate the two sides, and keep old roots for undo. Compare this route with Text Rope Data Structure, Piece Table Text Buffer, RRB Tree Persistent Vector, and Zipper Focused Tree: all solve versioned editing, but each chooses a different invariant.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The key misconception is that finger trees are one magic replacement for every collection. The structure is general because measures are general, not because it beats specialized layouts on every workload. Flat arrays win on tight numeric loops. B-trees win when page locality dominates. RRB vectors often feel more array-like for random indexed sequences.',
        'Another pitfall is using a non-associative measure. Cached summaries are only valid if combining left-to-right pieces gives the same result regardless of grouping. If the measure cannot be updated locally after an edit, the split/search machinery loses its correctness argument.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose the measure before choosing the operations. Size supports indexing. Minimum priority supports priority search. Maximum interval endpoint supports overlap queries. A vague measure usually means the structure will not answer the intended question cleanly.',
        'Keep measure recomputation local and automatic. Constructors for digits, nodes, and deep trees should compute cached measures consistently so edits cannot leave stale summaries behind.',
        'Test persistence explicitly. After an update, old roots should still produce old results. Structural sharing is a feature only if the program never mutates shared pieces accidentally.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For a text sequence split into chunks, let each chunk measure be its character length. Internal measures store total length below each subtree. To split at character offset 10, the tree descends through cached lengths until it finds the chunk containing that offset, then rebuilds the left and right sequences around the split.',
        'The same tree shape can become a priority queue if the measure is minimum priority instead of length. That is the deep idea: the structure is not tied to one query. The measure gives the tree a searchable meaning.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use a finger tree when you need persistence, efficient ends, split or concat, and a summary that can guide search. If you only need a mutable deque or a flat numeric array, simpler structures will be faster and easier.',
        'The measure must be associative and cheap enough to maintain. If maintaining the measure costs more than the query saves, the abstraction is working against you.',
        'The fastest way to misuse a finger tree is to choose it for elegance alone. It should earn its keep by combining operations that would otherwise require several separate structures.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'Watch allocation rate and cache behavior. Persistent trees create new path nodes instead of mutating in place, and that is exactly the feature that enables old versions. It can also pressure garbage collection if the workload is update-heavy.',
        'Watch measure size. A small numeric measure is cheap. A large object measure copied through every internal node can dominate the cost of updates. The measure is part of the performance model, not just an annotation.',
        'Finally, document the measure law. Future maintainers need to know why the combine operation is associative and what query the cached summary supports. Without that, a clever general structure becomes fragile infrastructure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ralf Hinze and Ross Paterson, "Finger Trees: A Simple General-purpose Data Structure", PDF at https://www.cs.ox.ac.uk/ralf.hinze/publications/FingerTrees.pdf and DOI page at https://dl.acm.org/doi/10.1017/S0956796805005769. Practical documentation: Haskell Data.Sequence at https://hackage.haskell.org/package/containers/docs/Data-Sequence.html. A useful explanatory source is Monoids and Finger Trees at https://apfelmus.nfshost.com/articles/monoid-fingertree.html. Study Implicit Treap Sequence Editor, RRB Tree Persistent Vector, Zipper Focused Tree, Text Rope Data Structure, Piece Table Text Buffer, Persistent Segment Tree, and Data Structure Design Patterns Primer next.',
      ],
    },
  ],
};
