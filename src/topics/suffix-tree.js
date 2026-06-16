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
    { heading: 'What it is', paragraphs: [
      'A suffix tree is a compressed trie containing every suffix of a text. Each root-to-leaf path spells one suffix, and every substring of the text appears as a prefix of some path. Compression is the key: instead of storing one node per character on long chains, an edge stores a whole substring interval from the original text.',
      'The structure is one of the most powerful string indexes because it turns many substring questions into tree questions. Pattern search is a path walk. Longest repeated substring is the deepest internal node with multiple leaves. Shared prefixes become explicit topology instead of repeated comparisons.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The naive mental model is insert every suffix into a trie, then compress every single-child path. That explains the query behavior. Ukkonen construction explains how to build it online in linear time: keep an active point, track how many suffixes remain in the current phase, split edges only when a new branch is forced, and follow suffix links from one repeated context to the next.',
      'Suffix links are the practical bridge between suffixes. If an internal node represents xA, its suffix link points to A. After finishing work for one suffix, the algorithm drops the first character and resumes at the linked context rather than starting over from the root.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A suffix tree can be built in O(n) time with a linear-time algorithm and uses O(n) nodes, but the hidden constants and pointer overhead are real. Each edge label is usually stored as a pair of indices into the original text, not as a copied string. Without that trick, construction can accidentally become memory-heavy and slow.',
      'The most common implementation mistakes are forgetting the sentinel, copying edge substrings, mishandling active length after a split, and treating suffix links as optional decoration. They are not decorative in efficient construction; they are the mechanism that keeps repeated scans from dominating.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Consider a genome-analysis task: find long repeats in a static DNA sequence. Build a suffix tree once. Then inspect internal nodes. A node with many descendant leaves marks a substring that occurs many times, and the string-depth of that node gives the repeat length. Leaves provide positions, so the same structure answers both "what repeated?" and "where did it repeat?"',
      'This is why suffix trees are a conceptual hub for string algorithms. Even when a production system chooses Suffix Array, FM-Index, or Suffix Automaton for memory reasons, suffix-tree thinking explains what the compressed index is trying to preserve.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Esko Ukkonen, "On-line construction of suffix trees", https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf, and the VLDB paper "Practical Suffix Tree Construction", https://www.vldb.org/conf/2004/RS1P3.PDF. Study Suffix Array, FM-Index, Trie, KMP Prefix Function, and Suffix Automaton next.',
    ] },
  ],
};
