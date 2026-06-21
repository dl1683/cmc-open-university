// Text rope data structure: large strings as balanced concatenation trees.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'text-rope-data-structure',
  title: 'Text Rope Data Structure',
  category: 'Data Structures',
  summary: 'Represent a large string as a balanced tree of chunks so concatenation, slicing, and localized edits avoid copying the whole text.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['concat tree', 'split insert'], defaultValue: 'concat tree' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function ropeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'concat len 11', x: 4.8, y: 0.8, note: 'whole string' },
      { id: 'left', label: 'left len 6', x: 2.6, y: 2.5, note: 'hello + space' },
      { id: 'right', label: 'right len 5', x: 7.0, y: 2.5, note: 'world' },
      { id: 'hello', label: '"hello"', x: 1.4, y: 4.6, note: 'leaf chunk len 5' },
      { id: 'space', label: '" "', x: 3.6, y: 4.6, note: 'leaf chunk len 1' },
      { id: 'world', label: '"world"', x: 6.4, y: 4.6, note: 'leaf chunk len 5' },
      { id: 'insert', label: '" brave"', x: 8.8, y: 4.6, note: 'new leaf' },
      { id: 'rebalance', label: 'rebalance', x: 8.8, y: 1.0, note: 'keep depth bounded' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left', weight: 'first 6 chars' },
      { id: 'e-root-right', from: 'root', to: 'right', weight: 'remaining chars' },
      { id: 'e-left-hello', from: 'left', to: 'hello', weight: 'chunk' },
      { id: 'e-left-space', from: 'left', to: 'space', weight: 'chunk' },
      { id: 'e-right-world', from: 'right', to: 'world', weight: 'chunk' },
      { id: 'e-insert-root', from: 'insert', to: 'root', weight: 'concat after split' },
      { id: 'e-root-rebalance', from: 'root', to: 'rebalance', weight: 'balance policy' },
    ],
  }, { title });
}

function* concatTree() {
  const text = 'hello world';
  const totalLen = text.length;
  const leftLen = 6;
  const rightLen = totalLen - leftLen;
  const leafCount = 3;
  const lookupIndex = 8;
  const lookupChar = text[lookupIndex];
  const adjustedIndex = lookupIndex - leftLen;
  const ops = ['index', 'concat', 'split', 'flatten'];

  yield {
    state: ropeGraph('A rope stores text as a weighted concatenation tree'),
    highlight: { active: ['root', 'left', 'right'], found: ['hello', 'space', 'world'], compare: ['insert'] },
    explanation: `A rope represents "${text}" (length ${totalLen}) as a tree with ${leafCount} leaves. Internal nodes store weights or lengths; leaves store small flat string chunks. The full text is the left-to-right leaf concatenation.`,
    invariant: `In-order leaf order equals the string order — the ${leafCount} leaves read left to right produce "${text}".`,
  };

  yield {
    state: labelMatrix(
      'Index lookup for character 8 in "hello world"',
      [
        { id: 'root', label: 'root weight 6' },
        { id: 'right', label: 'go right' },
        { id: 'world', label: 'world leaf' },
        { id: 'answer', label: 'offset 2' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'result' },
      ],
      [
        ['8 >= left length 6', 'subtract 6'],
        ['new index 2', 'descend right subtree'],
        ['index inside chunk', 'read r'],
        ['character', 'r'],
      ],
    ),
    highlight: { found: ['answer:result'], active: ['root:result', 'right:result'] },
    explanation: `Weights guide indexing. To find index ${lookupIndex} in "${text}", compare with left weight ${leftLen}: ${lookupIndex} >= ${leftLen}, so go right with adjusted index ${adjustedIndex}. The character is '${lookupChar}'.`,
  };

  yield {
    state: ropeGraph('Concatenation creates a new parent instead of copying bytes'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['insert'], compare: ['hello'] },
    explanation: `Concatenating two large strings creates one new internal node pointing at existing subtrees. Instead of copying all ${totalLen} characters, the rope reuses the left (${leftLen} chars) and right (${rightLen} chars) subtrees.`,
  };

  yield {
    state: labelMatrix(
      'Rope operations',
      [
        { id: 'index', label: 'index' },
        { id: 'concat', label: 'concat' },
        { id: 'split', label: 'split' },
        { id: 'flatten', label: 'flatten' },
      ],
      [
        { id: 'usualCost', label: 'usual cost' },
        { id: 'risk' },
      ],
      [
        ['O(log n + leaf)', 'needs balance'],
        ['O(1) then rebalance', 'tree depth growth'],
        ['O(log n)', 'leaf splitting'],
        ['O(n)', 'copy whole text'],
      ],
    ),
    highlight: { active: ['index:usualCost', 'concat:usualCost', 'split:usualCost'], compare: ['flatten:risk'] },
    explanation: `Ropes improve ${ops.length - 1} of ${ops.length} core operations. Index, concat, and split run in O(log n), but flattening still touches all ${totalLen} characters.`,
  };
}

function* splitInsert() {
  const insertPos = 6;
  const insertText = ' brave';
  const original = 'hello world';
  const result = original.slice(0, insertPos) + insertText + original.slice(insertPos);
  const bufferTypes = ['flat string/array', 'gap buffer', 'piece table', 'rope'];
  const docSize = '200 MB';
  const docSteps = ['load', 'slice', 'insert', 'save'];

  yield {
    state: labelMatrix(
      'Insert " brave" at position 6',
      [
        { id: 'before', label: 'before' },
        { id: 'split', label: 'split at 6' },
        { id: 'insert', label: 'new leaf' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'piece', label: 'piece' },
        { id: 'text' },
      ],
      [
        ['one rope', 'hello world'],
        ['left/right ropes', 'hello | world'],
        ['leaf chunk', ' brave'],
        ['concat three ropes', 'hello brave world'],
      ],
    ),
    highlight: { active: ['split:text', 'insert:text'], found: ['join:text'] },
    explanation: `Insertion is split plus concat. Split "${original}" at position ${insertPos}, create a leaf for "${insertText}", and concatenate left + inserted + right to get "${result}".`,
  };

  yield {
    state: ropeGraph('Balance keeps repeated edits from forming a chain'),
    highlight: { active: ['root', 'rebalance', 'e-root-rebalance'], compare: ['hello', 'insert'] },
    explanation: `If every append simply creates a new parent, the rope can degenerate into a tall chain. After inserting "${insertText}" at position ${insertPos}, the tree must rebalance to preserve logarithmic depth.`,
    invariant: `Rope performance depends on maintaining bounded depth — inserting ${insertText.length}-char chunks must not degrade index time from O(log n) to O(n).`,
  };

  yield {
    state: labelMatrix(
      'Text-buffer comparison',
      [
        { id: 'array', label: 'flat string/array' },
        { id: 'gap', label: 'gap buffer' },
        { id: 'piece', label: 'piece table' },
        { id: 'rope', label: 'rope' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'weakness' },
      ],
      [
        ['simple scanning', 'large inserts copy'],
        ['local cursor edits', 'far cursor moves'],
        ['undo and file edits', 'many pieces need indexing'],
        ['large concat/split', 'tree and chunk complexity'],
      ],
    ),
    highlight: { found: ['rope:best', 'piece:best'], compare: ['array:weakness'] },
    explanation: `Ropes are one of ${bufferTypes.length} common text-buffer strategies. Piece tables are often better when preserving original and inserted buffers matters; gap buffers excel at local cursor edits.`,
  };

  yield {
    state: labelMatrix(
      'Complete document case study',
      [
        { id: 'load', label: 'load 200 MB log' },
        { id: 'slice', label: 'slice region' },
        { id: 'insert', label: 'insert annotation' },
        { id: 'save', label: 'save/flatten' },
      ],
      [
        { id: 'ropeMove', label: 'rope move' },
        { id: 'lesson' },
      ],
      [
        ['chunk leaves', 'avoid one huge copy'],
        ['split by index', 'share subtrees'],
        ['concat new leaf', 'localized edit'],
        ['stream leaves', 'copy only at boundary'],
      ],
    ),
    highlight: { found: ['load:lesson', 'insert:lesson'], compare: ['save:lesson'] },
    explanation: `The rope case study is editing a ${docSize} document through ${docSteps.length} stages — copying the whole string on every operation is unacceptable at that scale.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'concat tree') yield* concatTree();
  else if (view === 'split insert') yield* splitInsert();
  else throw new InputError('Pick a text-rope view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Large text is expensive to edit when it lives as one contiguous string. Inserting near the front of a 200 MB document can copy almost the whole buffer. Concatenating many fragments can repeatedly copy the growing result.`,
        `A rope represents text as a balanced tree of chunks. Edits rearrange tree nodes and small leaves instead of moving the whole string. The full text still exists conceptually: it is the left-to-right concatenation of the leaf chunks.`,
        `This topic is about text ropes, not RoPE, Rotary Positional Embeddings. They share a name but solve unrelated problems.`,
        `The structure exists for workloads where most operations preserve most of the text. A source editor may insert a character in the middle of a large file, a compiler may assemble generated output from many fragments, and a log viewer may keep appending while still serving slices from earlier regions. In each case, copying the whole string is wasted work because the edit touches only a small neighborhood.`,
        {type: `callout`, text: `A rope makes text editing cheap by preserving untouched chunks and paying only for the path where position metadata changes.`},
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious representation is a flat string or array. It stays compact, cache-friendly, and fast for scanning. That is why most programs should use it for ordinary strings.`,
        `The wall appears when edits are large, frequent, or nonlocal. A flat buffer copies too much for insertion and deletion away from the end. A linked list of chunks avoids large copies but makes indexing, slicing, and line navigation slow because the structure has no way to skip whole regions by length.`,
        `A rope keeps chunks but adds a tree index over their lengths. That gives the structure a way to edit locally and still navigate by position.`,
        `The nearby alternatives are useful to keep straight. A gap buffer is excellent when most edits happen near one cursor because the gap absorbs local insertions. A piece table is excellent for editor undo because it preserves the original file and records inserted pieces separately. A rope is more general when the text is huge, edits appear in different places, concatenation matters, or persistent snapshots are valuable. It pays pointer and balancing overhead to avoid whole-buffer movement.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Leaves store small flat string chunks. Internal nodes represent concatenation. Each internal node stores enough length metadata, usually the length of the left subtree, to route an index search without scanning every character.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/8/8a/Vector_Rope_example.svg`, alt: `Example rope tree built from string chunks`, caption: `A rope is a binary tree over string leaves; weights route index lookup without flattening text. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Vector_Rope_example.svg.`},
        `The invariant is simple: an in-order traversal of the leaves equals the document. The metadata doesn't define a different string. It only caches lengths so operations can skip subtrees.`,
        `A useful rope also has balance and chunk-size rules. Without them, repeated appends can create a tall chain, and repeated tiny edits can create too many tiny leaves.`,
        `The metadata can be richer than character count. Editors often need byte offsets, UTF-16 code units, Unicode scalar counts, grapheme clusters, line counts, or newline positions. A production rope may store several measures per subtree so a cursor can move by visual character, a language server can report line and column, and a file writer can stream bytes. The idea is the same: cache enough subtree facts to skip over text that is not being inspected.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `The concat-tree view shows the reason a rope is not just a string builder. Concatenation can create a parent node that points at existing left and right texts. The final text order is still the in-order leaf order, but the operation avoids copying both children into a new flat array immediately.`,
        `The split-insert view shows the editor pattern. To insert at position i, find the leaf containing i, split that leaf if needed, attach the inserted chunk, and join the pieces back into a balanced tree. The untouched left and right subtrees do not move. They are only reconnected through new internal nodes and rebalanced when the shape gets unhealthy.`,
      
        {type: 'image', src: './assets/gifs/text-rope-data-structure.gif', alt: 'Animated walkthrough of the text rope data structure visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Index lookup compares the target position with the left-subtree length. If the index is smaller, descend left. If it is larger or equal, subtract the left length and descend right. At a leaf, read inside the flat chunk.`,
        `Concatenation can create one new parent node pointing at two existing ropes. Split descends to the split position, divides a leaf if needed, and returns two ropes. Insert is split at the insertion point, concatenate the inserted text, then concatenate the right side.`,
        `Deletion is split twice: split before the removed range, split after it, then join the remaining left and right ropes. Substring can be represented by shared subtrees in persistent implementations, or flattened when the caller needs a contiguous string.`,
        `Rebalancing is what keeps the mechanism honest. A rope that repeatedly concatenates on the right can become a linked list of right children. A rope that receives thousands of single-character edits can become a dust cloud of tiny leaves. Implementations usually enforce maximum depth, minimum and maximum leaf sizes, and rebuilding rules that flatten a local region and rebuild it into a balanced subtree.`,
        `Chunk policy is part of the design. Very small chunks waste memory and pointer traversals. Very large chunks make local edits expensive because splitting or copying inside the leaf becomes large again. A common strategy is to keep leaves within a target byte or character range, merge underfull neighbors after deletion, and split overfull leaves after insertion.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The correctness argument is structural. Each internal node means left text followed by right text. Replacing a flat string with a tree doesn't change the order because the leaves are read in-order.`,
        `The weights are cached proofs of length. If a node says its left subtree has 6 characters, an index below 6 must be in the left subtree, and an index at least 6 must be in the right subtree after subtracting 6.`,
        `Balancing is a performance guarantee, not a string-order guarantee. An unbalanced rope can still represent the right text, but it loses the reason to use a rope because operations degrade toward walking a chain.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `A balanced rope gives O(log n) navigation to a position, plus the cost of touching the leaf chunk. Split, insert, and delete are O(log n) plus the size of the edited chunks and any rebalancing work. Concatenation can be O(1) before rebalancing because it creates a parent node.`,
        `Flattening, saving, searching all text, and full traversal are still O(n). A rope doesn't make reading every character cheaper. It avoids copying untouched text during structural edits.`,
        `The hidden costs are pointer overhead, poorer cache locality, metadata maintenance, and rebalancing. Small strings usually belong in flat arrays because the rope overhead is larger than the copied data.`,
        `There is also a latency tradeoff. A flat string often has excellent constant factors because adjacent characters live together in memory. A rope turns one large memory move into several pointer hops and branch decisions. That is a good trade for large nonlocal edits and snapshots, but a poor trade for small strings, tight scanning loops, or workloads that repeatedly convert the rope back to a flat string after every change.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Ropes are useful in text editors, compilers, language runtimes, large-string builders, diff tools, log viewers, and systems that need persistent string snapshots. They fit workloads where many operations preserve most of the existing text.`,
        `A concrete build example is generated source output. A flat string builder that repeatedly appends fragments may copy the growing result many times unless it has a special buffer. A rope can store fragments as leaves and stream the final text once.`,
        `A concrete editor example is background parsing. The editor can keep a rope snapshot for the parser while the user continues editing a newer rope that shares most old subtrees. That gives the parser a stable document without copying the whole file.`,
        `Undo and redo are another natural fit when the rope is persistent. An edit can return a new root while old roots keep pointing at the old version of unchanged subtrees. The system then stores roots for snapshots rather than full document copies. This does not make history free, because edited leaves and rebalanced paths still allocate, but it makes the cost proportional to change rather than document size.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Ropes aren't always better than strings. Flat arrays are faster for small text, simple scanning, and append-only builders with enough spare capacity. Gap buffers can be better for edits near one cursor. Piece tables can be better when undo and original-file preservation dominate.`,
        `Encoding rules matter. Splitting by byte offset can break UTF-8. Splitting by code unit can break surrogate pairs. Splitting by Unicode grapheme cluster is closer to user-visible editing, but it requires extra indexing above the rope.`,
        `Collaborative editing is a different layer. Operational Transformation or a sequence CRDT decides how remote edits map into a shared document order. A rope can store the local text efficiently, but it doesn't solve conflict resolution by itself.`,
        `The easiest rope to get wrong is an unbalanced one. It may pass correctness tests because traversal still returns the right text, but performance silently degrades until every index lookup walks a long chain. Test shape invariants, not just final strings. Track depth, leaf sizes, total cached length, and whether every internal weight equals the true size of its left subtree.`,
        `Another misconception is that a rope automatically makes random editing cheap at every scale. It reduces the amount of copied text, but each edit still has allocation, tree traversal, cache misses, and potential rebalancing. The workload has to be large enough or persistent enough for those costs to pay back.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Define the unit of length first. A file-storage rope may index bytes. A JavaScript-facing rope may need UTF-16 code units. A user-facing editor may need grapheme clusters and line columns. Mixing those units inside one set of weights causes cursor bugs that are hard to reproduce, especially with emoji, combining marks, and different newline conventions.`,
        `Keep operations small and composable: lookup, split, concat, rebalance, flatten, and measure. Insert and delete should be built from those primitives so the invariants are centralized. After every mutation in tests, verify that cached lengths equal the flattened text, the leaves stay within size bounds, and traversal order matches the expected string.`,
        `Do not flatten accidentally. Debug logging, equality checks, syntax highlighting, search, and serialization can all force a full traversal. That may be correct, but it should be visible in profiles. A rope-based editor that flattens the document after every keystroke has kept the complexity and lost the benefit.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary source: Boehm, Atkinson, and Plass, "Ropes: An Alternative to Strings," at https://www.cs.tufts.edu/comp/150FP/archive/hans-boehm/ropes.pdf and https://research.google/pubs/ropes-an-alternative-to-strings/. Study Tree Traversals for the in-order invariant, Splay Tree and Red-Black Tree for balancing, Gap Buffer Text Editor and Piece Table Text Buffer for editor alternatives, Implicit Treap Sequence Editor for split/merge sequences, and Sequence CRDTs, Operational Transformation Collaborative Editing Case Study, and Peritext Rich-Text CRDT Case Study for collaborative text.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Edit text efficiently. String or array: insert at position i requires shifting n minus i characters, so every insert costs O(n). Delete is similarly O(n). For a 1 MB file with rapid typing, that is roughly one million shifts per keystroke.',
        'Gap buffer (Emacs): maintain a gap at the cursor position. Insert and delete at the gap cost O(1). Move the cursor: O(gap move distance). Good for sequential editing, but cursor jumps are expensive.',
        'Rope (Boehm et al. 1995): represent the string as a balanced binary tree of chunks. Each leaf holds a short string, typically 512 to 2048 characters. Internal nodes store the total length of their left subtree (weight). Concatenation creates a new root with the two ropes as children, O(log n) with rebalancing. Split at position i walks down the tree using weights to find the split point, breaks into two ropes, O(log n). Insert at position i splits at i, concatenates left plus new string plus right, O(log n). Delete range [i, j] splits at i, splits at j, concatenates left plus right, O(log n).',
        'Used in: VS Code (piece table, a rope variant), Xi editor (ropes), Zed editor (rope plus CRDT).',
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        'String "Hello, World!" as a rope. Split into leaves: ["Hello", ", ", "Wor", "ld!"]. Tree: root(weight=7) with left(weight=5) pointing to ["Hello", ", "] and right(weight=3) pointing to ["Wor", "ld!"].',
        'Index 8 (the \'o\' in "World"): root weight is 7, 8 > 7 so go right, adjust index to 8 minus 7 which is 1. Right node weight is 3, 1 < 3 so go left. Leaf "Wor", index 1 gives \'o\'. Found in 3 steps, O(log n).',
        'Insert "beautiful " at position 7: split at 7 produces left = "Hello, " (leaves ["Hello", ", "]) and right = "World!" (leaves ["Wor", "ld!"]). New rope: concat(left, "beautiful ", right). Result: "Hello, beautiful World!". Three O(log n) operations.',
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Why not just use arrays? For 1000 characters: array insert O(1000), rope insert O(log 1000) which is about 10. Rope is 100x faster. For 1,000,000 characters: array O(10 to the 6), rope O(20). Rope is 50,000x faster. But rope has higher constant factor from tree node overhead and cache misses from pointer chasing. Crossover: ropes win for files larger than roughly 64 KB. Below that, a simple array with gap buffer is often faster.',
        'Piece table (VS Code): instead of breaking the text into chunks, maintain a table of pieces pointing into two buffers, the original file and an append-only add buffer. Insert: append to add buffer, split one piece, insert new piece, O(log n) with a sorted piece table. No text is ever copied or moved. The original file buffer is read-only, so undo is trivial (remove pieces).',
        'Memory-mapped I/O: the original buffer can be the mmap of the file, so the editor opens instantly regardless of size.',
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        'Boehm, Atkinson, and Plass 1995, "Ropes: an Alternative to Strings," the original paper from Xerox PARC.',
        'Study next: B-Tree (balanced tree for disk, similar rebalancing ideas), Segment Tree (tree-based range operations), Splay Tree (self-adjusting tree, used in some rope implementations), Gap Buffer (simpler alternative for sequential editing), CRDT (conflict-free replicated data types, ropes extend to collaborative editing).',
      ],
    },
],
};
