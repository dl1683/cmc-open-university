// Suffix tree: a compressed trie of every suffix, with suffix links that make
// online construction possible.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'suffix-tree',
  title: 'Suffix Tree',
  category: 'Data Structures',
  summary: 'Compress the trie of all suffixes so substring search, longest repeat, and many string questions become path walks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compressed trie', 'ukkonen phases'], defaultValue: 'compressed trie' },
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

function suffixTreeShape(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 1.0, y: 3.7, note: 'all suffixes start here' },
      { id: 'banana', label: 'banana$', x: 3.5, y: 0.8, note: 'suffix 0' },
      { id: 'a', label: 'a', x: 3.0, y: 2.3, note: 'branch a' },
      { id: 'na1', label: 'na', x: 5.2, y: 2.0, note: 'shares ana' },
      { id: 'ana_leaf', label: '$ / na$', x: 7.4, y: 1.8, note: 'suffixes 3 and 1' },
      { id: 'n', label: 'na', x: 3.3, y: 4.6, note: 'branch n' },
      { id: 'na_leaf', label: '$ / na$', x: 5.7, y: 4.7, note: 'suffixes 4 and 2' },
      { id: 'sentinel', label: '$', x: 3.0, y: 6.4, note: 'suffix 6' },
      { id: 'link', label: 'suffix link', x: 7.5, y: 5.0, note: 'drop first char' },
    ],
    edges: [
      { id: 'e-root-banana', from: 'root', to: 'banana', weight: 'banana$' },
      { id: 'e-root-a', from: 'root', to: 'a', weight: 'a' },
      { id: 'e-a-na', from: 'a', to: 'na1', weight: 'na' },
      { id: 'e-na-leaf', from: 'na1', to: 'ana_leaf', weight: '$ / na$' },
      { id: 'e-root-n', from: 'root', to: 'n', weight: 'na' },
      { id: 'e-n-leaf', from: 'n', to: 'na_leaf', weight: '$ / na$' },
      { id: 'e-root-dollar', from: 'root', to: 'sentinel', weight: '$' },
      { id: 'e-link', from: 'na1', to: 'link', weight: 'ana -> na' },
      { id: 'e-link-root', from: 'link', to: 'n', weight: 'target' },
    ],
  }, { title });
}

function* compressedTrie() {
  yield {
    state: labelMatrix(
      'Every suffix of banana$',
      [
        { id: 's0', label: '0' },
        { id: 's1', label: '1' },
        { id: 's2', label: '2' },
        { id: 's3', label: '3' },
        { id: 's4', label: '4' },
        { id: 's5', label: '5' },
        { id: 's6', label: '6' },
      ],
      [{ id: 'suffix', label: 'suffix' }, { id: 'branch', label: 'first branch' }],
      [
        ['banana$', 'b'],
        ['anana$', 'a'],
        ['nana$', 'n'],
        ['ana$', 'a'],
        ['na$', 'n'],
        ['a$', 'a'],
        ['$', '$'],
      ],
    ),
    highlight: { active: ['s1:suffix', 's3:suffix', 's5:suffix'], compare: ['s1:branch', 's3:branch', 's5:branch'] },
    explanation: 'A suffix tree begins as the trie you would get by inserting every suffix of the text. The sentinel $ makes every suffix end at a distinct leaf.',
    invariant: 'Every suffix is represented by one root-to-leaf path.',
  };

  yield {
    state: suffixTreeShape('Compress one-child paths into edge labels'),
    highlight: { active: ['root', 'a', 'na1', 'ana_leaf', 'e-root-a', 'e-a-na'], found: ['banana', 'sentinel'] },
    explanation: 'The compressed tree stores whole substrings on edges instead of one character per node. That is why the structure has linear size even though the uncompressed suffix trie can be quadratic.',
    invariant: 'Internal nodes are real branch points; long non-branching paths become one labeled edge.',
  };

  yield {
    state: suffixTreeShape('Search for pattern "ana"'),
    highlight: { active: ['root', 'a', 'na1', 'e-root-a', 'e-a-na'], found: ['ana_leaf'], compare: ['n'] },
    explanation: 'Substring search walks the pattern across edge labels. If the walk succeeds, every leaf below that point is an occurrence. For "ana", the leaves under the a->na path give starts 1 and 3.',
  };

  yield {
    state: labelMatrix(
      'Choose the right suffix structure',
      [
        { id: 'tree', label: 'Suffix Tree' },
        { id: 'array', label: 'Suffix Array' },
        { id: 'automaton', label: 'Suffix Automaton' },
        { id: 'fm', label: 'FM-Index' },
      ],
      [{ id: 'strength', label: 'strength' }, { id: 'cost', label: 'tradeoff' }],
      [
        ['rich path queries', 'pointer-heavy'],
        ['compact static index', 'less direct topology'],
        ['online substring automaton', 'harder to visualize paths'],
        ['compressed search', 'rank/select machinery'],
      ],
    ),
    highlight: { found: ['tree:strength', 'array:strength'], compare: ['tree:cost'] },
    explanation: 'Suffix trees are conceptually powerful, but suffix arrays and FM-indexes often win in memory-sensitive production indexes. Learn the tree to understand the questions; choose the representation by workload.',
  };
}

function* ukkonenPhases() {
  yield {
    state: labelMatrix(
      'Ukkonen keeps an active point',
      [
        { id: 'active_node', label: 'active node' },
        { id: 'active_edge', label: 'active edge' },
        { id: 'active_len', label: 'active length' },
        { id: 'remainder', label: 'remainder' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'why', label: 'why it exists' }],
      [
        ['current explicit node', 'avoid restarting at root'],
        ['first char of pending edge', 'resume inside edge label'],
        ['characters already matched', 'skip repeated scanning'],
        ['suffixes still to add', 'finish phase correctly'],
      ],
    ),
    highlight: { active: ['active_node:meaning', 'active_edge:meaning', 'active_len:meaning'], found: ['remainder:why'] },
    explanation: 'Ukkonen construction is online: after adding each character, it updates all newly needed suffixes without rebuilding the tree. The active point is the compressed cursor that makes this efficient.',
  };

  yield {
    state: suffixTreeShape('Suffix links jump from xA to A'),
    highlight: { active: ['na1', 'link', 'n', 'e-link', 'e-link-root'], compare: ['root'] },
    explanation: 'A suffix link connects an internal node representing xA to the node representing A. When one extension finishes, the next extension can follow the link instead of rescanning from the root.',
    invariant: 'Suffix links preserve the work already paid for by previous extensions.',
  };

  yield {
    state: labelMatrix(
      'Extension outcomes',
      [
        { id: 'rule1', label: 'leaf extension' },
        { id: 'rule2', label: 'split edge' },
        { id: 'rule3', label: 'already present' },
        { id: 'canon', label: 'canonize' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'effect', label: 'effect' }],
      [
        ['grow leaf edge', 'cheap end index update'],
        ['create internal node + leaf', 'new branch point'],
        ['stop phase early', 'remaining suffixes implicit'],
        ['walk down long edge', 'keep active point normalized'],
      ],
    ),
    highlight: { active: ['rule2:action', 'rule3:effect'], found: ['canon:effect'] },
    explanation: 'The implementation feels complex because it mixes three ideas: implicit leaves, edge splitting, and suffix-link jumps. Each rule protects the linear-time bound by refusing to repeat old comparisons.',
  };

  yield {
    state: labelMatrix(
      'Case study: DNA repeat discovery',
      [
        { id: 'load', label: 'load sequence' },
        { id: 'build', label: 'build tree' },
        { id: 'scan', label: 'scan internal nodes' },
        { id: 'report', label: 'report repeat' },
      ],
      [{ id: 'signal', label: 'signal' }, { id: 'answer', label: 'answer' }],
      [
        ['millions of bases', 'static text'],
        ['all suffixes indexed', 'linear-size topology'],
        ['deep node with many leaves', 'long repeated substring'],
        ['leaf positions', 'where repeats occur'],
      ],
    ),
    highlight: { found: ['scan:signal', 'report:answer'], compare: ['build:signal'] },
    explanation: 'The complete case-study pattern is simple: build once, then ask topology questions. A deep internal node with multiple descendant leaves is a repeated substring, and the leaves give the positions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compressed trie') yield* compressedTrie();
  else if (view === 'ukkonen phases') yield* ukkonenPhases();
  else throw new InputError('Pick a suffix-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "compressed trie" view opens with a matrix listing every suffix of banana$. Rows highlighted in green share a first character -- those suffixes will merge into a common branch. The graph that follows compresses one-child chains into single labeled edges. Each internal node is a real branch point; each leaf is a distinct suffix.',
        {type: 'callout', text: 'A suffix tree wins by storing every suffix path while charging memory only for branch points and edge-label intervals.'},
        'When the view searches for "ana", watch the path from root through the "a" edge and then across "na". The walk succeeds partway through the tree, and every leaf below that point is an occurrence. Green leaves are hits; blue nodes are the path taken.',
        'The "Ukkonen phases" view focuses on construction. The matrix shows the active point -- active node, active edge, active length, and remainder. These four values are the compressed cursor that lets Ukkonen avoid restarting from the root. The suffix link arrow shows the jump from an internal node representing xA to the node representing A.',
        {
          type: 'note',
          text: 'In both views, the sentinel $ appears as a distinct edge label. It is not decoration. Without it, suffix "a" would be a prefix of suffix "ana" and would vanish as an implicit point inside an edge, making leaf counting for occurrences ambiguous.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'On-line construction of suffix trees provides a way to preprocess a string so that any subsequent pattern matching query can be answered in time proportional to the length of the pattern, independent of the length of the text.',
          attribution: 'Esko Ukkonen, "On-line construction of suffix trees," Algorithmica, 1995',
        },
        'String problems repeat the same shape: where does this pattern appear, what is the longest repeated substring, where do two documents share content, how many distinct substrings exist. Each question rescans the text unless the text has been preprocessed into an index that makes all substrings visible at once.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Suffix_tree_BANANA.svg/250px-Suffix_tree_BANANA.svg.png', alt: 'Suffix tree for BANANA with suffix links and numbered leaves', caption: 'The BANANA suffix tree shows the key layout: edge labels compress paths, leaves identify suffix starts, and dashed suffix links speed construction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_tree_BANANA.svg.'},
        'A suffix tree is that index. It stores every suffix of a string in a compressed trie so that any substring query becomes a downward walk from the root. The tree answers the query in O(m) time where m is the pattern length, regardless of how long the text is. One preprocessing pass, then unlimited queries.',
        'The topology also exposes structure that flat search cannot see. Internal branch points correspond to repeated substrings. The depth of a branch gives the repeat length. The number of descendant leaves gives the repeat count. These are not separate algorithms -- they are path and counting questions on the same tree.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a plain suffix trie: insert every suffix of the text into a character-by-character trie. For banana$, insert banana$, anana$, nana$, ana$, na$, a$, and $. Each insertion walks from the root, creating one node per character where the path does not yet exist.',
        'This works correctly. A substring query walks the trie from the root, consuming one query character per node. If the walk succeeds, the substring exists; all leaves below are occurrences. The logic is simple and the correctness argument is immediate.',
        {
          type: 'diagram',
          label: 'Suffix trie for "ab$": every character gets its own node',
          text: '        root\n       / | \\\n      a  b  $\n      |  |\n      b  $\n      |\n      $',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'A suffix tree starts from the trie invariant, then removes the one-child nodes that do not represent real branch decisions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'For short strings the trie is fine. Many learners and quick prototypes stop here.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The suffix trie has O(n^2) nodes in the worst case. Every suffix of length k contributes up to k nodes, and the sum 1 + 2 + ... + n = n(n+1)/2. For a 10-million-character genome, that is 50 trillion nodes. The structure does not fit in memory.',
        'The waste is specific: long one-child chains. When a suffix passes through ten characters before hitting a branch point, the trie stores ten nodes that carry no decision. Each node has only one child, so no query could diverge there. Those nodes exist only because the trie insists on one character per edge.',
        {
          type: 'bullets',
          items: [
            'For ab$, the trie has 6 character nodes while the compressed tree has 5 structural nodes.',
            'For banana$, the trie shape has 22 possible character nodes while the compressed tree needs about 11 nodes.',
            'For abcabcabc$, the quadratic trie budget is 55 character nodes, but compression keeps the tree linear.',
            'For a repeated 10-character run plus $, the trie budget is 66 character nodes; the compressed tree stays near 2n.',
            'For a 250-million-base chromosome, the trie budget reaches roughly 31 quadrillion character nodes while a suffix tree remains below about 500 million nodes.',
          ],
        },
        'The query idea is right. The representation is wrong. Compression must eliminate the one-child chains without losing the ability to walk paths and count leaves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A suffix tree compresses every maximal one-child chain into a single edge whose label is the concatenated characters. Internal nodes exist only at branch points -- positions where at least two suffixes diverge. Leaves exist at suffix endpoints, forced to be distinct by the sentinel $.',
        {
          type: 'diagram',
          label: 'Suffix tree for "banana$": branch points only, edge labels as substrings',
          text: '              root\n           /   |   \\\n       banana$ a    na       $\n               |     |\n              na    na$\n             / \\   / \\\n           na$  $  na$ $\n\n  Edge labels refer back to the original string.\n  Internal nodes: root, "a", "na" (under a), "na" (under root)\n  Leaves: 7 (one per suffix, including $)',
        },
        'Edge labels are stored as [start, end] intervals into the original text, not as copied strings. This is critical: it keeps space linear. A node stores two integers per edge, not a substring.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Edge label as interval into the source text\nclass Edge {\n  constructor(start, end, targetNode) {\n    this.start = start;   // index into text[]\n    this.end = end;       // index into text[] (may be a shared leaf-end pointer)\n    this.target = targetNode;\n  }\n  get length() { return this.end - this.start; }\n  label(text) { return text.slice(this.start, this.end); }\n}',
          },
        'Ukkonen construction builds the tree online, left to right, in O(n) time. It maintains four values: active node (which internal node the cursor sits at), active edge (which outgoing edge the cursor is partway down), active length (how many characters into that edge), and remainder (how many suffixes still need explicit insertion in this phase).',
        'Each new character triggers at most three outcomes per pending suffix:',
        {
          type: 'bullets',
          items: [
            'Leaf extension: if the active point is at a leaf edge, increment the shared leaf-end pointer; all leaves grow in O(1).',
            'Edge split: if the next character diverges mid-edge, create one internal node and one leaf; this happens at most n - 1 times total.',
            'Already present: if the next character already matches, stop the phase early and let the remaining suffixes stay implicit.',
          ],
        },
        'Suffix links connect an internal node that spells xA (some character x followed by string A) to the internal node that spells A. After an edge split creates a new internal node, the next extension follows the suffix link instead of rescanning from root. This is the mechanism that keeps total construction work linear.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Suffix link usage after an edge split\n// previousNewNode was created in the last extension\nif (previousNewNode !== null) {\n  previousNewNode.suffixLink = currentInternalNode;\n}\npreviousNewNode = currentInternalNode;\n\n// Follow suffix link for the next extension\nif (activeNode === root) {\n  activeEdge = text[i - remainder + 1];\n  activeLength--;\n} else {\n  activeNode = activeNode.suffixLink || root;\n}',
        },
        'The sentinel $ must be a character not in the input alphabet. Without it, suffix "a" is a prefix of suffix "ana" and would end implicitly inside an edge. The sentinel forces every suffix to terminate at its own leaf, which makes occurrence counting and position reporting unambiguous.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one property: every substring of the text is a prefix of some suffix. If all suffixes are indexed, then any substring query walks from the root and either succeeds (the substring exists) or fails at a character mismatch (the substring does not exist). No substring can hide because every position in the text starts some suffix.',
        'Compression preserves query behavior because it removes only nodes with one child. A search still compares the same characters in the same order -- the only difference is that deterministic runs of characters are traversed as a single edge skip rather than one node at a time. No branching decision is lost.',
        'Ukkonen achieves O(n) time through three amortization arguments:',
        {
          type: 'bullets',
          items: [
            'Leaf ends are updated implicitly by incrementing a shared end pointer. All existing leaves grow for free.',
            'The remainder counter tracks how many suffixes were deferred by rule 3 (already present). Those suffixes are not lost -- they become explicit only when a future character forces a split.',
            'Suffix links reduce the cost of consecutive extensions. Walking from xA to A via a suffix link costs O(1), whereas rescanning A from root would cost O(|A|). Across all extensions, the total suffix-link and walk-down work is O(n).',
          ],
        },
        {
          type: 'note',
          text: 'The linear bound depends on the alphabet. Ukkonen with a hash map or sorted list for outgoing edges gives O(n) construction for any alphabet. With a fixed-size array (e.g., ASCII), the per-node branching lookup is O(1) but each node wastes 128 or 256 slots. The O(n) time claim assumes O(1) edge lookup per node.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ukkonen build: O(n) time and O(n) space, online from left to right; constants are large.',
            'Naive suffix insertion: O(n^2) time with linear-size compressed output, but it becomes impractical past moderate n.',
            'Pattern search: O(m) for pattern length m because the query walks edge labels from the root and never scans unrelated text.',
            'Occurrence counting: O(m) when internal nodes store subtree leaf counts; reporting k positions costs O(m + k).',
            'Longest repeated substring: O(n) by finding the deepest internal node by string depth.',
            'Longest common substring over two texts: O(n + m) with a generalized suffix tree and the deepest node whose leaves come from both texts.',
            'Distinct substring count: O(n) by summing edge-label lengths across all edges.',
          ],
        },
        'The constants matter. Each internal node stores a suffix link, a parent pointer, and an edge map. Each edge stores two integers (start, end) and a target pointer. For a 100-million-character genome, a suffix tree can consume 10--20 bytes per input character, reaching 1--2 GB. A suffix array for the same text uses 4--8 bytes per character.',
        'When n doubles, the tree doubles in nodes and edges (linear), but the pointer-chasing cost grows worse than linear in practice because cache misses increase. The asymptotic bound is O(n); the wall-clock cost grows faster than O(n) on real hardware.',
        {
          type: 'note',
          text: 'The O(m) search time is the reason suffix trees exist. Naive search through the text takes O(n * m). KMP and Boyer-Moore take O(n + m) but answer only one pattern at a time. A suffix tree inverts the cost: pay O(n) once at build time, then answer each query in O(m) with no dependence on n.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Suffix trees win when the workload asks many substring questions against a single static text. The O(n) build cost is paid once; each subsequent query costs only O(m). No other structure answers the full range of substring topology questions as directly.',
        {
          type: 'bullets',
          items: [
            'Genome repeat finding: the deepest internal node gives the longest repeated substring, and its descendant leaves give coordinates.',
            'Plagiarism detection: a generalized tree over two documents exposes the deepest internal node shared by both inputs.',
            'Log template extraction: internal nodes with high leaf count reveal repeated motifs across entries.',
            'Many exact pattern queries: each query costs O(|P| + k) for k matches after the tree is built, instead of rescanning the whole text.',
            'Bioinformatics tools such as MUMmer: maximal unique matches appear as internal-node neighborhoods with exactly one leaf per input sequence.',
          ],
        },
        'The mental model transfers even when the shipped structure differs. Suffix arrays, LCP arrays, and FM-indexes solve the same problems, but the suffix tree makes the topology explicit. Understanding why a deep internal node means a long repeat, or why leaf counts give occurrence counts, makes the compressed representations intelligible.',
        {
          type: 'quote',
          text: 'The suffix tree is the Swiss Army knife of string algorithms.',
          attribution: 'Dan Gusfield, "Algorithms on Strings, Trees, and Sequences," Cambridge University Press, 1997',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Memory is the primary tax. A suffix tree uses 10--20x more memory than the raw text. For large-scale production text search -- web-scale document collections, multi-gigabyte log archives -- suffix arrays or FM-indexes fit the same role in a fraction of the space with better cache behavior.',
        'Pointer-heavy layout destroys cache locality. Each tree traversal chases pointers through scattered heap allocations. A suffix array stores the same suffix order as a flat integer array, and binary search over it hits contiguous memory. On modern CPUs the cache advantage often outweighs the log(n) vs O(1) lookup difference.',
        {
          type: 'bullets',
          items: [
            'Large static corpora: use suffix array + LCP array. Same query power, 4x less memory, cache-friendly.',
            'Compressed search over huge text: use FM-index (BWT + wavelet tree). Sublinear space.',
            'Frequent text edits: suffix trees are built for fixed text. Insertions and deletions in the middle require expensive restructuring or full rebuild.',
            'Simple single-pattern search: KMP or Boyer-Moore is O(n + m) with O(m) space. No need to index the entire text.',
            'Real-time construction constraints: Ukkonen constants are large. If build latency matters, consider suffix arrays built via SA-IS (also O(n), smaller constants).',
          ],
        },
        {
          type: 'note',
          text: 'The common engineering mistake is building a suffix tree when a suffix array would suffice. If the workload is pattern search and longest common prefix queries, the array + LCP combination answers those in the same asymptotic time with far less memory. Reserve the tree for problems that genuinely need explicit branching topology -- or for learning, where the tree makes the structure visible.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Esko Ukkonen, "On-line construction of suffix trees," Algorithmica 14(3), 1995. The foundational online O(n) construction algorithm. https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf',
            'Peter Weiner, "Linear pattern matching algorithms," IEEE Symposium on Switching and Automata Theory, 1973. The first linear-time suffix tree construction (right-to-left). Historically important but rarely implemented today.',
            'Dan Gusfield, "Algorithms on Strings, Trees, and Sequences," Cambridge University Press, 1997. Chapters 5--9 cover suffix trees, generalized suffix trees, and applications. The standard textbook reference.',
            'Stefan Kurtz, "Reducing the space requirement of suffix trees," Software: Practice and Experience, 1999. Techniques for shrinking suffix tree memory in bioinformatics applications.',
            'Juha Karkkainen and Peter Sanders, "Simple linear work suffix array construction," ICALP, 2003. The SA-IS predecessor that showed suffix arrays can be built in O(n) without a suffix tree.',
          ],
        },
        'Prerequisite: study Trie first if the concept of character-by-character path branching is unfamiliar. The suffix tree is a compressed trie, so the basic trie invariants (each edge label is a character, each root-to-leaf path spells a stored string) must be solid.',
        'Extensions: Suffix Array stores the same suffix ordering in a flat integer array with better cache behavior. LCP Array pairs with a suffix array to recover the branching information lost by flattening. FM-Index compresses the index further using the Burrows-Wheeler Transform. Suffix Automaton is the dual structure -- a minimal DAG that accepts exactly the substrings of the text.',
        'Contrast: KMP Prefix Function solves single-pattern matching in O(n + m) without indexing the text. It is the right tool when you have one pattern and one text. The suffix tree is the right tool when you have one text and many patterns.',
      ],
    },
  ],
};
