// Finite-state transducers as static maps: share prefixes and suffixes like a
// minimized trie, while emitting compact outputs during lookup.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'finite-state-transducer-static-map',
  title: 'Finite-State Transducer Static Map',
  category: 'Data Structures',
  summary: 'A compressed ordered dictionary: walk input symbols through a minimized automaton while accumulating outputs such as ordinals, file pointers, or payload ids.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookup path', 'build and minimize'], defaultValue: 'lookup path' },
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

function lookupGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key bytes', x: 0.8, y: 3.2, note: 'sorted input' },
      { id: 'fst', label: 'FST', x: 2.8, y: 3.2, note: 'shared arcs' },
      { id: 'output', label: 'out', x: 4.8, y: 3.2, note: 'delta' },
      { id: 'slot', label: 'slot', x: 6.8, y: 3.2, note: 'ptr' },
      { id: 'answer', label: 'answer', x: 8.8, y: 3.2, note: 'hit or miss' },
    ],
    edges: [
      { id: 'e-key-fst', from: 'key', to: 'fst' },
      { id: 'e-fst-output', from: 'fst', to: 'output' },
      { id: 'e-output-slot', from: 'output', to: 'slot' },
      { id: 'e-slot-answer', from: 'slot', to: 'answer' },
    ],
  }, { title });
}

function buildGraph(title) {
  return graphState({
    nodes: [
      { id: 'terms', label: 'sorted terms', x: 0.8, y: 3.2, note: 'lexicographic' },
      { id: 'trie', label: 'trie path', x: 2.8, y: 3.2, note: 'append' },
      { id: 'register', label: 'register', x: 4.8, y: 3.2, note: 'seen suffixes' },
      { id: 'merge', label: 'merge', x: 6.8, y: 3.2, note: 'same future' },
      { id: 'fst', label: 'minimal FST', x: 8.8, y: 3.2, note: 'static map' },
    ],
    edges: [
      { id: 'e-terms-trie', from: 'terms', to: 'trie' },
      { id: 'e-trie-register', from: 'trie', to: 'register' },
      { id: 'e-register-merge', from: 'register', to: 'merge' },
      { id: 'e-merge-fst', from: 'merge', to: 'fst' },
    ],
  }, { title });
}

function* lookupPath() {
  yield {
    state: lookupGraph('An FST maps strings to compact outputs'),
    highlight: { active: ['key', 'fst', 'output'], found: ['slot', 'answer'] },
    explanation: 'A finite-state transducer is an automaton with outputs on transitions or states. Lookup walks the key symbols and accumulates output pieces to reach a stored ordinal, pointer, weight, or payload id.',
    invariant: 'The FST is exact for its stored language: a missing transition proves the key is absent.',
  };

  yield {
    state: labelMatrix(
      'Tiny static map',
      [
        { id: 'car', label: 'car' },
        { id: 'card', label: 'card' },
        { id: 'care', label: 'care' },
        { id: 'dog', label: 'dog' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'out', label: 'output' },
      ],
      [
        ['c-a-r', '10'],
        ['c-a-r-d', '11'],
        ['c-a-r-e', '12'],
        ['d-o-g', '30'],
      ],
    ),
    highlight: { active: ['card:path'], found: ['card:out'], compare: ['car:path', 'care:path'] },
    explanation: 'The stored keys remain lexicographic like a trie, but the output is part of the machine. A search engine can map a term to a term ordinal or a block pointer without storing one object per term.',
  };

  yield {
    state: labelMatrix(
      'What gets shared',
      [
        { id: 'prefix', label: 'prefixes' },
        { id: 'suffix', label: 'suffixes' },
        { id: 'outputs', label: 'outputs' },
        { id: 'finals', label: 'final states' },
      ],
      [
        { id: 'trie', label: 'plain trie' },
        { id: 'fst', label: 'minimal FST' },
      ],
      [
        ['shared', 'shared'],
        ['duplicated', 'merged'],
        ['external values', 'arc deltas'],
        ['many leaves', 'shared finals'],
      ],
    ),
    highlight: { active: ['suffix:fst', 'outputs:fst'], compare: ['suffix:trie'] },
    explanation: 'A minimized acyclic automaton can share identical suffix subgraphs, not just prefixes. Transducer outputs are factored so common output prefixes live near the root and deltas live on later arcs.',
  };

  yield {
    state: labelMatrix(
      'Compare static dictionaries',
      [
        { id: 'hash', label: 'MPHF' },
        { id: 'fst', label: 'FST' },
        { id: 'trie', label: 'trie' },
        { id: 'bloom', label: 'Bloom' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'miss', label: 'miss proof' },
      ],
      [
        ['exact id', 'verify key'],
        ['ordered keys', 'missing arc'],
        ['prefix query', 'missing edge'],
        ['cheap reject', 'zero bit'],
      ],
    ),
    highlight: { found: ['fst:best', 'fst:miss'], compare: ['hash:miss', 'bloom:miss'] },
    explanation: 'FSTs sit between tries and perfect hashes. They keep order and prefix traversal like tries, compress static dictionaries aggressively, and can return values directly like a map.',
  };
}

function* buildAndMinimize() {
  yield {
    state: buildGraph('Sorted input enables online minimization'),
    highlight: { active: ['terms', 'trie', 'register'], found: ['merge', 'fst'] },
    explanation: 'A practical builder reads terms in sorted order. After each new key, the suffix of the previous key is frozen, compared with a register of equivalent states, and merged when the future behavior is identical.',
    invariant: 'Two states can merge when they accept the same suffix language and carry compatible outputs.',
  };

  yield {
    state: labelMatrix(
      'State equivalence',
      [
        { id: 'same', label: 'same suffix' },
        { id: 'final', label: 'same final' },
        { id: 'out', label: 'same output' },
        { id: 'diff', label: 'different arc' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['merge', 'same future'],
        ['merge', 'same accept'],
        ['merge/factor', 'compatible'],
        ['keep apart', 'different keys'],
      ],
    ),
    highlight: { found: ['same:decision', 'final:decision'], active: ['out:decision'], compare: ['diff:decision'] },
    explanation: 'Minimization is not visual decoration. It is the compression step. If two states answer every possible remaining suffix in the same way, one state can represent both histories.',
  };

  yield {
    state: labelMatrix(
      'Output factoring',
      [
        { id: 'car', label: 'car' },
        { id: 'card', label: 'card' },
        { id: 'care', label: 'care' },
        { id: 'cars', label: 'cars' },
      ],
      [
        { id: 'common', label: 'common out' },
        { id: 'delta', label: 'delta' },
      ],
      [
        ['10', '0'],
        ['10', '1'],
        ['10', '2'],
        ['10', '3'],
      ],
    ),
    highlight: { active: ['car:common', 'card:common', 'care:common', 'cars:common'], found: ['card:delta', 'care:delta', 'cars:delta'] },
    explanation: 'When nearby keys map to nearby ordinals, the builder can push common output pieces toward shared arcs. Lookup accumulates the common part plus the final delta.',
  };

  yield {
    state: buildGraph('Lucene-style terms dictionaries use the pattern'),
    highlight: { active: ['terms', 'fst'], found: ['merge'], compare: ['trie'] },
    explanation: 'Lucene popularized FSTs for compact in-memory term dictionaries. The FST can guide a term lookup toward the block or ordinal that contains the postings metadata, while larger postings data stays outside the automaton.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookup path') yield* lookupPath();
  else if (view === 'build and minimize') yield* buildAndMinimize();
  else throw new InputError('Pick a finite-state-transducer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "lookup path" view traces a single key through the FST. Active nodes are the current stage of the pipeline: key bytes enter, arcs are followed, output fragments accumulate, and the final state decides hit or miss. Found markers show values that are now determined. Compare markers show sibling keys whose paths share arcs with the current lookup.',
        'The "build and minimize" view traces construction. Active nodes are the builder stages: sorted terms feed a trie frontier, frozen suffixes enter a register, equivalent states merge, and the minimal FST emerges. The output factoring frame shows how nearby values share a common prefix on early arcs and leave only small deltas on later arcs.',
        'In both views, a missing transition is proof of absence. If the automaton has no arc for the next input byte, the key is not in the dictionary. This is stronger than a hash miss, which only says the slot is empty.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search engines store millions of terms and need to map each term to a block pointer, ordinal, or posting list offset. The term dictionary sits in memory and is hit on every query. It must be compact enough to fit, ordered enough to support prefix and range queries, and fast enough to not dominate query latency.',
        'The same problem appears in autocomplete indexes, URL routing tables, lexicons for NLP pipelines, and static key-value stores where the key set is known at build time. The shared constraint: a large, static, sorted set of string keys, each associated with a compact value, queried far more often than it changes.',
        {
          type: 'quote',
          text: 'An FST is like a trie, except that it also shares suffixes, not just prefixes, and it can associate an output value with each key.',
          attribution: 'Andrew Gallant, "Index 1,600,000,000 Keys with Automata and Rust" (2015)',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash map gives O(1) exact lookup but destroys sorted order. You cannot iterate terms alphabetically, find "all terms starting with comp," or answer "what is the next term after this prefix." These are not niche features; a search engine uses them constantly for wildcard queries, fuzzy matching, and block-level seeking.',
        'A trie preserves sorted order and supports prefix operations naturally. Each shared prefix is stored once. But a trie only shares prefixes. If thousands of terms end in "-tion," "-ment," or "-ing," the trie builds a separate suffix subtree for each prefix that reaches that ending. Node pointers, transition arrays, and per-node bookkeeping add up. A naive trie over English Wikipedia terms can exceed the term bytes themselves in pointer overhead.',
        'A sorted array with binary search is compact and ordered, but lookup is O(log n) string comparisons, each touching memory at unpredictable locations. For millions of variable-length strings, cache behavior is poor and there is no way to share common substrings.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is simultaneous pressure from three directions. The dictionary must be ordered (rules out hash maps). It must be compact (rules out pointer-heavy tries). And it must carry values, not just membership (rules out plain minimal automata like DAWGs, which can compress the key set but have nowhere to put the associated data).',
        'A DAWG (directed acyclic word graph) solves the first two: it shares both prefixes and suffixes, producing a minimal acyclic automaton far smaller than a trie. But a DAWG is a recognizer, not a map. It answers "is this key present?" but not "what value does this key map to?" Bolting an external value array back on reintroduces per-key storage and throws away much of the compression.',
        'The structure needs to carry output data inside the automaton itself, accumulating value fragments along the path so that lookup returns a result without a separate table.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A finite-state transducer is a finite automaton where each transition carries an input label and an output label. A Mealy machine puts outputs on transitions; a Moore machine puts outputs on states. FST-based static maps use the Mealy convention: each arc carries an input byte and an output fragment. Lookup reads the key byte by byte, follows arcs, and sums the output fragments. If it reaches an accepting final state, the accumulated sum is the value.',
        {
          type: 'diagram',
          label: 'FST with shared suffixes and output weights',
          text: [
            '       c:10        a:0        r:0',
            '  (0) -------> (1) -----> (2) -----> (3) [final, out=0]',
            '   |                                   |  \\',
            '   |  d:20                        d:1  |   e:2',
            '   +---------> (4) --o--> (5)    (6)  |   (7)',
            '                g:0        [final]  [final] [final]',
            '',
            '  Keys and values:',
            '    car  = 10+0+0+0 = 10     dog = 20+0+0 = 20',
            '    card = 10+0+0+1 = 11     ',
            '    care = 10+0+0+2 = 12',
            '',
            '  States (3), (6), (7) share the same suffix structure:',
            '  no outgoing arcs, all final. The minimizer merges them.',
          ].join('\n'),
        },
        'Construction uses Daciuk\'s algorithm (incremental construction of minimal acyclic finite-state automata). Keys must arrive in sorted order. The builder maintains a trie-like frontier. When a new key diverges from the previous one, the suffix of the previous key that will never receive new children is frozen. The builder checks a register of already-built states: if an equivalent state exists (same outgoing arcs, same finality, same output behavior), the frozen suffix is redirected to the existing state instead of creating a duplicate.',
        'Output factoring happens during construction. When multiple keys sharing a prefix map to nearby values, the builder pushes the greatest common output prefix toward the root arc and stores only residual deltas on later arcs. For example, if car=10, card=11, care=12, the arc for "c" can carry output 10, and the arcs for "d" and "e" carry deltas 1 and 2. This lets suffix states merge even when they carry different values, because the difference has already been absorbed by earlier arcs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness of the automaton rests on state equivalence. Two states are equivalent when they accept exactly the same set of suffixes. Merging equivalent states preserves the accepted language: every key that was accepted before is still accepted by the same path of input labels, and every key that was rejected still hits a missing transition or a non-final state.',
        'Correctness of the transducer rests on output path sums. Moving a common output fragment from later arcs to an earlier shared arc does not change the total output accumulated along any complete key path. The sum of fragments along each accepted path is invariant under factoring. A formal proof uses induction on the number of factoring steps, showing that each step preserves the path sum for every key.',
        'Minimality follows from the Myhill-Nerode theorem applied to acyclic automata. The register-based construction produces the unique minimal automaton for the key language. No smaller acyclic DFA accepts exactly the same set of strings.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'FST', 'Trie', 'Hash map', 'Sorted array'],
          rows: [
            ['Exact lookup', 'O(|key|)', 'O(|key|)', 'O(|key|) avg', 'O(|key| log n)'],
            ['Prefix iteration', 'Yes', 'Yes', 'No', 'Binary search + scan'],
            ['Range scan', 'Yes (ordered)', 'Yes (ordered)', 'No', 'Yes'],
            ['Space', 'Minimal (shared prefixes + suffixes)', 'Shared prefixes only', 'Keys + values + table', 'Keys + values'],
            ['Construction', 'O(n |key|), sorted input required', 'O(n |key|)', 'O(n |key|) avg', 'O(n |key| log n)'],
            ['Updates', 'Rebuild or segment merge', 'O(|key|) insert', 'O(|key|) avg insert', 'O(n) insert'],
            ['Carries values', 'Yes (output on arcs)', 'External', 'Yes', 'Yes'],
            ['Proves absence', 'Missing arc', 'Missing edge', 'Empty slot (needs key check)', 'Binary search miss'],
          ],
        },
        'Lookup touches one byte of input per transition, like a trie. The practical speed depends on how transitions are encoded. Lucene uses a packed byte array with variable-length arc encodings, optimized for sequential scan of low-fanout states. The Rust fst crate uses a similar packed representation. Both avoid pointer chasing by laying out the automaton in a contiguous byte buffer.',
        'Space savings over a trie are proportional to suffix sharing. Natural-language term sets share heavily: "-tion," "-ing," "-ment," "-ed," "-ly" suffixes collapse thousands of subtrees into one. Lucene reports FST sizes 10-20x smaller than the raw term bytes for English indexes. The exact ratio depends on the key distribution; random byte strings share little and compress poorly.',
        'Construction requires sorted input and is O(n * average key length). The register lookup at each suffix freeze is O(1) amortized with a hash-based register. The builder allocates states and arcs incrementally and never materializes a full trie. Memory during construction is proportional to the longest common prefix between consecutive keys, not the entire key set.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Lucene\'s BlockTree terms dictionary is the canonical production use. Every Lucene/Elasticsearch/Solr index builds an FST that maps terms to block file pointers in the terms file. The FST sits in memory; the postings data stays on disk. A term lookup walks the FST to find the right block, then reads one disk block to find the exact term and its posting list metadata. Tantivy (the Rust search engine) uses the same design via the fst crate.',
        'The pattern generalizes to any system that needs a compact, ordered, in-memory index over a large, static key set: URL routing tables where millions of URL prefixes map to handler IDs; NLP lexicons where word forms map to lemma IDs; static configuration stores where string keys map to integer offsets; and autocomplete indexes where prefixes map to suggestion-list pointers.',
        {
          type: 'note',
          text: 'FSTs are strongest when the key set is built once and queried many times. If keys change frequently, the rebuild cost dominates and a mutable structure like a B-tree or skip list is a better fit.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If sorted order does not matter and you only need exact lookup, a hash map or minimal perfect hash function is simpler and often faster. A perfect hash maps n keys to n slots with no collisions and O(1) lookup; it does not support prefix queries but uses less memory than an FST when order is irrelevant.',
        'If you only need probabilistic membership ("is this term in the dictionary, probably?"), a Bloom filter or binary fuse filter is far smaller. An FST is exact but pays for that exactness in construction complexity and space.',
        'FSTs are brittle to input normalization changes. The automaton encodes the exact byte sequences of its keys. Changing case folding rules, Unicode normalization forms, or locale-specific sort order invalidates the entire structure. There is no way to patch an FST; you rebuild from the new sorted key set. For systems where normalization rules evolve (e.g., adding new Unicode characters), this rebuild cost is a real operational burden.',
        'Large values do not belong inside the FST. The output on each arc is typically a small integer (ordinal, delta, block pointer). If each key maps to a large payload, store the payloads externally and let the FST map keys to payload offsets. Embedding large outputs inflates the automaton and defeats the compression.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Daciuk, Mihov, Watson, Watson, "Incremental Construction of Minimal Acyclic Finite-State Automata" (Computational Linguistics, 2000) -- the algorithm behind sorted-order FST construction. https://aclanthology.org/J00-1002.pdf',
            'Mihov and Maurel, "Direct Construction of Minimal Acyclic Subsequential Transducers" (2001) -- extends Daciuk to transducers with outputs.',
            'Mike McCandless, "Using Finite State Transducers in Lucene" (2010) -- the blog post that introduced FSTs to the Lucene community. https://blog.mikemccandless.com/2010/12/using-finite-state-transducers-in.html',
            'Andrew Gallant, "Index 1,600,000,000 Keys with Automata and Rust" (2015) -- practical guide to the Rust fst crate, with benchmarks. https://blog.burntsushi.net/transducers/',
            'Lucene FST package documentation. https://lucene.apache.org/core/9_12_3/core/org/apache/lucene/util/fst/package-summary.html',
            'OpenFst library (general-purpose weighted FST toolkit). https://www.openfst.org/',
          ],
        },
        {
          type: 'note',
          text: 'Mealy vs Moore: a Mealy machine puts outputs on transitions (arcs); a Moore machine puts outputs on states. Lucene and the Rust fst crate use the Mealy convention with an additional final-state output. The distinction matters when you read FST literature -- "output on arc" means Mealy.',
        },
        'Prerequisite: study Trie for prefix sharing and Finite State Machine for automaton fundamentals. Extension: study LOUDS Succinct Trie for a different compact trie encoding that preserves topology rather than minimizing suffixes. Contrast: study Minimal Perfect Hash for the case where sorted order is unnecessary and only exact lookup matters. Application: study Inverted Index to see how FST term dictionaries fit into the larger search-engine pipeline.',
      ],
    },
  ],
};
