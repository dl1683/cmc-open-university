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
  const text = 'banana$';
  const suffixes = ['banana$', 'anana$', 'nana$', 'ana$', 'na$', 'a$', '$'];

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
    explanation: `A suffix tree begins as the trie you would get by inserting every suffix of the text "${text}". With ${suffixes.length} suffixes (indices 0 through ${suffixes.length - 1}), the sentinel $ makes every suffix end at a distinct leaf.`,
    invariant: `Every suffix is represented by one root-to-leaf path — ${suffixes.length} suffixes produce ${suffixes.length} leaves.`,
  };

  yield {
    state: suffixTreeShape('Compress one-child paths into edge labels'),
    highlight: { active: ['root', 'a', 'na1', 'ana_leaf', 'e-root-a', 'e-a-na'], found: ['banana', 'sentinel'] },
    explanation: `The compressed tree stores whole substrings on edges instead of one character per node. For "${text}" with ${text.length} characters, the structure has linear size even though the uncompressed suffix trie can be quadratic.`,
    invariant: `Internal nodes are real branch points; long non-branching paths become one labeled edge.`,
  };

  const pattern = 'ana';
  yield {
    state: suffixTreeShape(`Search for pattern "${pattern}"`),
    highlight: { active: ['root', 'a', 'na1', 'e-root-a', 'e-a-na'], found: ['ana_leaf'], compare: ['n'] },
    explanation: `Substring search walks the ${pattern.length}-character pattern "${pattern}" across edge labels. If the walk succeeds, every leaf below that point is an occurrence. For "${pattern}", the leaves under the a->na path give starts 1 and 3.`,
  };

  const structures = ['Suffix Tree', 'Suffix Array', 'Suffix Automaton', 'FM-Index'];
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
    explanation: `This comparison covers ${structures.length} suffix structures: ${structures.join(', ')}. Suffix trees are conceptually powerful, but suffix arrays and FM-indexes often win in memory-sensitive production indexes. Learn the tree to understand the questions; choose the representation by workload.`,
  };
}

function* ukkonenPhases() {
  const activePointFields = ['active node', 'active edge', 'active length', 'remainder'];
  const extensionRules = ['leaf extension', 'split edge', 'already present', 'canonize'];

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
    explanation: `Ukkonen construction is online: after adding each character, it updates all newly needed suffixes without rebuilding the tree. The ${activePointFields.length} active-point fields (${activePointFields.join(', ')}) form the compressed cursor that makes this efficient.`,
  };

  yield {
    state: suffixTreeShape('Suffix links jump from xA to A'),
    highlight: { active: ['na1', 'link', 'n', 'e-link', 'e-link-root'], compare: ['root'] },
    explanation: `A suffix link connects an internal node representing xA to the node representing A. When one extension finishes, the next extension can follow the link instead of rescanning from the root.`,
    invariant: `Suffix links preserve the work already paid for by previous extensions.`,
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
    explanation: `The implementation feels complex because it mixes ${extensionRules.length} ideas: ${extensionRules.slice(0, 3).join(', ')}, and ${extensionRules[3]}. Each rule protects the linear-time bound by refusing to repeat old comparisons.`,
  };

  const caseStudySteps = ['load sequence', 'build tree', 'scan internal nodes', 'report repeat'];
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
    explanation: `The complete ${caseStudySteps.length}-step pattern is simple: ${caseStudySteps[1]}, then ask topology questions. A deep internal node with multiple descendant leaves is a repeated substring, and the leaves give the positions.`,
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
        'Read the tree as a compressed trie of every suffix. A trie is a tree where each root-to-node path spells a string; compressed means a chain with no branch is stored as one edge label. Leaves mark suffix starts, and internal nodes mark real branch points where suffixes diverge.',
        {type: 'callout', text: 'A suffix tree wins by storing every suffix path while charging memory only for branch points and edge-label intervals.'},
        'In the search view, following the pattern from the root proves membership one character at a time, even if the character sits inside a long edge label. In the construction view, the active point is the compressed cursor used by Ukkonen construction. The safe inference is that splitting an edge creates a branch exactly where two suffixes first differ.',
        {type: 'image', src: './assets/gifs/suffix-tree.gif', alt: 'Animated walkthrough of the suffix tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many string questions ask about all substrings of one text. Pattern search, longest repeated substring, longest common substring, and distinct substring count all become expensive if the text is rescanned for every query. A suffix tree preprocesses the text so later substring queries walk the index instead of the whole text.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Suffix_tree_BANANA.svg/250px-Suffix_tree_BANANA.svg.png', alt: 'Suffix tree for BANANA with suffix links and numbered leaves', caption: 'The BANANA suffix tree shows the key layout: edge labels compress paths, leaves identify suffix starts, and dashed suffix links speed construction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_tree_BANANA.svg.'},
        'The tree exists because every substring is a prefix of some suffix. If all suffixes are indexed, a substring query becomes a downward walk from the root. The sentinel character, usually $, forces every suffix to end at its own leaf so occurrence counts are unambiguous.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a suffix trie. Insert every suffix into a character-by-character trie, then answer a substring query by walking from the root. This is correct because every substring appears as a prefix of at least one inserted suffix.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'A suffix tree starts from the trie invariant, then removes the one-child nodes that do not represent real branch decisions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'For a small word, the suffix trie is a fine teaching model. It shows the exact path that proves a pattern exists. It also shows the waste: many nodes have only one child and therefore represent no decision.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A suffix trie can have O(n^2) nodes because it stores long suffix paths one character at a time. The total length of all suffixes is n(n+1)/2, so a one-million-character text implies about 500 billion character positions before sharing. That is too large for an index.',
        'The waste is structural. A path segment with one child cannot change a search outcome because there is no branch to choose. The wall is keeping all suffix paths while removing nodes that do not encode decisions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compress every maximal one-child chain into one edge labeled by an interval in the original text. The tree keeps branch points and leaves, but it does not copy substrings into edges. An edge stores start and end positions, so the text remains the source of truth for labels.',
        'Suffix links make construction fast. A suffix link from a node spelling xA points to the node spelling A, where x is one character. That link lets the builder move from one pending suffix insertion to the next without rescanning from the root each time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query starts at the root and compares pattern characters against edge labels. If a mismatch occurs, the pattern is absent. If the pattern ends in the middle of an edge or at a node, every leaf below that point gives one occurrence position.',
        'Ukkonen construction builds the tree left to right. It maintains an active node, active edge, active length, and remainder of suffixes still needing work in the current phase. New characters extend all leaves implicitly with a shared end pointer, and only real branch conflicts create explicit splits.',
        'When a split creates an internal node, a suffix link connects it to the next shorter context. Following suffix links and using skip-counting keeps the total construction linear. The implementation is subtle because active-point updates must agree with edge splits and implicit suffixes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts from the suffix property: every substring of the text is a prefix of some suffix. Since every suffix has a root-to-leaf path, any real substring has a path from the root. A failed character comparison proves no suffix begins with the queried pattern, so the substring is absent.',
        'Compression preserves behavior because it removes only nodes with one child. A search compares the same characters in the same order; it just crosses them as an edge interval instead of separate nodes. No branching decision is lost, so the compressed tree recognizes the same substrings as the suffix trie.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With Ukkonen construction and constant-time child lookup, build time is O(n) and space is O(n). Pattern search costs O(m) for pattern length m, and reporting k occurrences costs O(m + k). Longest repeated substring and distinct substring count can also be computed by tree walks after construction.',
        'The hidden cost is memory layout. Nodes, edge maps, suffix links, parent links, and intervals create many heap objects and pointer jumps. Doubling the text roughly doubles the number of structural objects, but cache misses can make wall-clock behavior worse than the clean linear bound suggests.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Suffix trees are useful when the workload needs explicit substring topology. Deep internal nodes reveal long repeated substrings, descendant leaves give occurrence positions, and generalized suffix trees expose common substrings across texts. Bioinformatics and plagiarism detection are natural settings for those queries.',
        'They are also useful as a teaching structure. Suffix arrays, LCP arrays, and FM-indexes are often better production choices, but the tree makes the hidden branching structure visible. Understanding the tree makes the compressed representations easier to trust.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The memory tax is the main failure. A suffix tree can use many times more memory than the raw text because each structural edge and node carries pointers and metadata. Large static corpora often prefer suffix arrays or FM-indexes because flat or compressed arrays fit cache and RAM better.',
        'The implementation is also difficult. Ukkonen bugs can leave implicit suffixes wrong, suffix links stale, or edge intervals off by one. For one-off pattern matching, KMP or Boyer-Moore is simpler; for mutable text, rebuilding a suffix tree after edits is usually too expensive.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For banana$, the suffixes start at positions 0 through 6. The suffixes ana$ and anana$ share the prefix ana, so the tree has a branch path for a followed by na, with leaves below it for starts 3 and 1. Searching ana reaches that point and reports both leaves.',
        'A suffix trie would store the path a-n-a-$ for ana$ and a-n-a-n-a-$ for anana$ with several one-child nodes. The suffix tree stores shared labels as intervals into banana$, so the edge na can refer to positions 2 through 4 instead of copying characters. The query still compares a, n, a in order and stops at the same logical point.',
        'If the pattern is anb, the search matches a and n, then compares b against the next edge character a. That mismatch proves absence immediately. The cost is three character checks, not a scan of all seven suffixes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Weiner 1973 for the first linear suffix-tree construction, McCreight 1976 for a simpler linear construction, and Ukkonen 1995 for online construction. Dan Gusfield, "Algorithms on Strings, Trees, and Sequences," is the standard textbook treatment.',
        'Study tries before this topic, then suffix arrays and LCP arrays for the flat alternative. Afterward, study suffix automata, FM-indexes, and Burrows-Wheeler Transform to see different ways of storing the same substring evidence.',
      ],
    },
  ],
};