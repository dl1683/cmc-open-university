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
      heading: 'The problem',
      paragraphs: [
        'String problems often ask the same question in different forms: where does this pattern occur, what is the longest repeated substring, where do two texts share a substring, or how can many substring queries be answered after one preprocessing pass. Re-scanning the text for every question wastes the repeated structure inside the string.',
        'A good substring index should make all suffixes visible without copying the whole text many times. It should also preserve enough topology to answer richer questions than simple membership.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious index is a trie containing every suffix. Insert `banana$`, `anana$`, `nana$`, `ana$`, `na$`, `a$`, and `$`. Then a substring query walks from the root. If the walk succeeds, the substring appears.',
        'The wall is size. A plain suffix trie can be quadratic because long one-child paths duplicate text. The query idea is right, but the representation is too large unless those paths are compressed and edge labels refer back to the original text.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Every substring is a prefix of some suffix. If all suffixes are indexed, substring search becomes path search. A suffix tree keeps that property while compressing every one-child path into one edge label.',
        'The tree is not just a membership index. Its branching structure exposes repeated substrings. A deep internal node with several descendant leaves represents a long substring that occurs at several positions.',
        'That topology is the reason suffix trees are worth learning even when another structure ships. They make substring problems visible as path and branch questions, which is the mental model behind suffix arrays, LCP arrays, suffix automata, and compressed text indexes.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'The conceptual build is insert every suffix into a trie, append a sentinel such as `$` so every suffix ends at a distinct leaf, and compress non-branching paths. Real implementations store edge labels as `[start, end]` intervals into the original text rather than copied strings.',
        'Ukkonen construction builds the same structure online in linear time. It maintains an active node, active edge, active length, and remainder. When a new character arrives, the algorithm extends the pending suffixes, splits an edge only when a new branch is forced, updates implicit leaf ends cheaply, and follows suffix links to avoid rescanning known contexts.',
        'The sentinel is not cosmetic. Without a unique terminal symbol, one suffix can be a prefix of another and disappear as an implicit endpoint inside an edge. The sentinel forces every suffix to end at its own leaf, which makes occurrence reporting and repeat logic unambiguous.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For `banana$`, the suffixes beginning with `a` share the path for `a`, then branch through `na`. Searching for `ana` starts at root, follows `a`, then consumes `na` across the next edge. The leaves below that point correspond to occurrences beginning at positions 1 and 3.',
        'The same topology finds repeats. The path spelling `ana` reaches an internal branching point with multiple leaves below it, so `ana` is a repeated substring. The deeper the internal node, the longer the repeated string represented by that node.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Indexing all suffixes is enough because any substring of the text begins at some position, and the suffix starting at that position has the substring as its prefix. A root-to-leaf suffix path therefore contains every substring that starts at that suffix position.',
        'Compression preserves query behavior because it removes only nodes that have no branching decision. A search still compares the same characters in the same order, but long deterministic runs are stored as edge intervals. Suffix links preserve construction work because the next suffix context after `xA` is `A`.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'A suffix tree has O(n) nodes and can be built in O(n) time with Ukkonen construction, but the constants are large. Pointer-heavy nodes, maps of outgoing edges, suffix links, and edge interval bookkeeping make it much less compact than the asymptotic bound suggests.',
        'The implementation is also easy to get subtly wrong. Common failures include omitting the sentinel, copying edge strings instead of storing intervals, mishandling active length after a split, and treating suffix links as optional. Suffix links are the reason efficient construction avoids repeated root scans.',
        'Memory layout matters more than the big-O line suggests. A suffix tree for a large genome or document collection can spend most of its time chasing pointers through cache-unfriendly nodes. A suffix array plus LCP array may answer the production query with less direct topology but far better locality.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Suffix trees are often not the production structure for large static text collections. Suffix arrays, LCP arrays, FM-indexes, and compressed indexes usually have better memory locality and lower space use while preserving enough search power for many workloads.',
        'They are also awkward for frequent text edits. The classic structure is built for a fixed or append-only text. If the underlying string changes in the middle, maintaining the full topology is usually more trouble than rebuilding or choosing a different index.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use suffix-tree thinking when the workload asks for string topology: longest repeated substring, longest common substring, occurrence positions, repeated motifs, and explaining why suffix arrays or compressed text indexes work. The tree gives the clearest mental picture even when another representation ships.',
        'A genome repeat task is the clean case study. Build the tree once for a static DNA sequence. Internal nodes with multiple descendant leaves mark repeated substrings; the string depth gives repeat length; leaf labels give positions.',
        'The same pattern appears in plagiarism checks, log-template discovery, malware signature analysis, and text indexing. The exact data structure may differ, but the question is often the same: after paying one preprocessing cost, how quickly can the system answer many substring questions?',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Store edge labels as source-text intervals, not copied substrings. Keep leaf suffix indices so successful searches can report positions. Use a terminal symbol that cannot occur in the input alphabet. If multiple texts are indexed together, give each text its own terminal marker so suffixes do not cross document boundaries.',
        'For Ukkonen-style construction, test tiny strings with repeated prefixes such as `aaaa$`, branching strings such as `banana$`, and strings with no repeated structure. Those cases expose active-length errors, missing edge splits, and bad suffix-link updates quickly.',
        'Separate the educational model from the production layout. The tree is easiest to understand as labeled edges and branch nodes, but production code usually wants compact child maps, integer node ids, shared edge-end objects for leaves, and cache-aware arrays where possible.',
        'When searches need counts only, store subtree leaf counts at internal nodes. When searches need positions, keep suffix indices at leaves or a compact range over a suffix-array order built from the same topology.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the compressed trie view, start with the suffix table and watch which suffixes share first branches. The graph then compresses those shared character runs into labeled edges. When the view searches for `ana`, the important signal is that success ends inside the suffix topology, and all leaves below that point are occurrences.',
        'In the Ukkonen phases view, focus on the active point and suffix link frames. Active node, active edge, active length, and remainder explain where construction resumes. The suffix link from a longer context to its shorter suffix context is the move that prevents the algorithm from restarting at the root after every extension.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: Esko Ukkonen, "On-line construction of suffix trees", https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf, and the VLDB paper "Practical Suffix Tree Construction", https://www.vldb.org/conf/2004/RS1P3.PDF. Study Suffix Array, LCP Array, FM-Index, Trie, KMP Prefix Function, and Suffix Automaton next.',
      ],
    },
  ],
};
