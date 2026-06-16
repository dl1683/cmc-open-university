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
      heading: 'What it is',
      paragraphs: [
        'A finite-state transducer, or FST, is a finite-state machine that consumes an input sequence and emits output. Used as a static map, it stores an ordered set of strings and maps each accepted string to a compact value such as an ordinal, file pointer, frequency class, or payload id. It is exact: a missing transition proves absence.',
        'A trie shares prefixes. A minimal acyclic automaton can also share identical suffixes. An FST adds output factoring, so common output pieces move onto shared arcs and lookup accumulates deltas along the path. That makes FSTs useful for large read-only dictionaries where order, prefix traversal, and compact value lookup matter together.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction usually starts from sorted input. The builder appends the new key, freezes the part of the previous key that can no longer change, and checks whether the resulting states are equivalent to states already in a register. Equivalent states are merged. Daciuk, Mihov, Watson, and Watson described this incremental construction for minimal acyclic finite-state automata, avoiding a separate build-a-trie-then-minimize pass.',
        'During lookup, start at the root and consume one symbol at a time. Each transition may contribute an output fragment. If every symbol is consumed and the final state accepts, the accumulated output is the value. If any transition is missing, the key is absent. Range and prefix enumeration are natural because accepted strings are still ordered by automaton traversal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(length of key), like a trie. Space depends on how much prefix and suffix sharing the key set contains and how compactly transitions are encoded. Static FSTs can be dramatically smaller than pointer-heavy tries, especially for sorted term dictionaries, URL sets, language lexicons, and autocomplete dictionaries. Construction is heavier than ordinary hashing because minimization and output factoring happen during build.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Lucene adopted FSTs for compact term dictionaries and related maps. A term dictionary needs exact lookup, ordered iteration, and fast movement from a term to postings metadata. The FST keeps the navigational structure compact in memory while postings lists live elsewhere. The Rust fst crate demonstrated the same idea at web scale, indexing large ordered key sets such as Common Crawl URL collections with compact automata.',
        'OpenFst generalizes the idea to weighted finite-state transducers used in speech and language systems. There the output can be a label sequence and a weight, and algorithms compose, optimize, and search transducers. The static-map version in this lesson is the data-structure slice of the same theory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An FST is not the best answer for every dictionary. If you only need exact lookup and the set has no useful order or shared structure, a Hash Table or Minimal Perfect Hash Static Dictionary may be simpler. If you only need cheap rejection before a slower lookup, a Bloom Filter or Binary Fuse Filter can be smaller and faster. FSTs shine when the dictionary is static, sorted, prefix-friendly, and value-bearing.',
        'Another pitfall is treating Unicode strings as simple characters. Production FSTs usually operate on bytes or normalized code-point sequences with a carefully defined ordering. If normalization changes, the automaton contract changes. Updates are also awkward: many production FSTs are rebuilt in batches rather than edited in place.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Daciuk et al., Incremental Construction of Minimal Acyclic Finite-State Automata at https://aclanthology.org/J00-1002.pdf, Lucene FST package docs at https://lucene.apache.org/core/9_12_3/core/org/apache/lucene/util/fst/package-summary.html, Mike McCandless on Lucene FSTs at https://blog.mikemccandless.com/2010/12/using-finite-state-transducers-in.html, OpenFst at https://www.openfst.org/, and the Rust fst large-scale writeup at https://blog.burntsushi.net/transducers/. Study Trie, Finite State Machine, Minimal Perfect Hash Static Dictionary, LOUDS Succinct Trie, Inverted Index, and FM-Index next.',
      ],
    },
  ],
};
