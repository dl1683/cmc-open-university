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
      heading: `Why This Exists`,
      paragraphs: [
        `A finite-state transducer static map is for large read-only dictionaries where keys are strings or byte sequences and each key has an associated value. Search engines map terms to ordinals or block pointers. Autocomplete systems map prefixes to ranges. Lexicons and URL tables need exact lookup while preserving sorted order.`,
        `A hash table can answer exact lookup, but it loses lexicographic structure. A trie keeps the structure, but a pointer-heavy trie can be too large. An FST keeps trie-like traversal, shares more structure than a trie, and emits compact output while it walks the key.`,
      ],
    },
    {
      heading: `Naive Baseline`,
      paragraphs: [
        `The first baseline is a hash table from key to value. It is simple and fast for exact lookup, but it does not naturally support ordered iteration, prefix traversal, or "next term after this prefix" operations.`,
        `The second baseline is a trie. It supports prefix operations and sorted traversal, but ordinary tries mostly share prefixes. If many keys have equivalent suffix behavior, a trie repeats those suffix subgraphs. The node and transition overhead can dominate the actual key bytes.`,
      ],
    },
    {
      heading: `The Wall`,
      paragraphs: [
        `The wall appears when the dictionary is static, huge, and queried constantly. The system wants the navigational behavior of a trie, the compactness of a compressed automaton, and a value lookup at the end of the path.`,
        `A plain minimal automaton can compact the accepted keys, but a map also needs outputs. Storing one external value object per key gives back much of the memory savings. The structure has to compress both the accepted language and the values associated with that language.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `Build a minimal acyclic automaton for the sorted keys, then make it a transducer by placing output fragments on arcs or final states. Lookup consumes the key symbols and accumulates those fragments. If it reaches an accepting final state, the accumulated output is the value or a pointer to the value.`,
        `The invariant is state equivalence. Two states may merge when every possible remaining suffix from them has the same accept/reject behavior and compatible output behavior. Once merged, one suffix subgraph can represent many different prefixes without changing any lookup result.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the "lookup path" view, follow the graph from key bytes through the FST, output accumulation, slot, and answer. The tiny static map frame shows the concrete contract: car, card, care, and dog are accepted paths, and each path emits a value such as 10, 11, 12, or 30.`,
        `In the "build and minimize" view, focus on the register. Sorted terms let the builder freeze suffixes that will never receive more children, compare them with already seen suffix states, and merge equivalent ones. The output factoring frame shows why nearby ordinals can share a common output prefix and leave only small deltas on later arcs.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `A practical builder reads keys in lexicographic order. It appends the new key's unmatched suffix to the current trie-like frontier. The part of the previous key that is no longer shared with future keys becomes fixed. The builder canonicalizes that fixed suffix by looking it up in a register of already built states.`,
        `If an equivalent state already exists, the builder redirects the parent transition to the existing state. If not, it stores the new state in the register. This online minimization produces a compact acyclic automaton without first materializing a full trie.`,
        `Outputs are factored during construction. If several outgoing paths share the same output prefix, that common piece can move earlier in the path, and only the residual deltas stay later. Lookup adds outputs as it traverses arcs, then checks final acceptance before returning the accumulated result.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `The automaton part is correct because equivalent states have identical futures. For every suffix that can be read from one state, the other state accepts or rejects the same suffix. Replacing duplicate equivalent states with one representative therefore preserves the accepted key set.`,
        `The transducer part is correct when output factoring preserves path sums. Moving a common output fragment earlier on a shared arc and subtracting it from later deltas does not change the total output accumulated along any complete key path. Each accepted key still reaches the same value; missing transitions or non-final states still prove absence.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `Lookup is O(length of key), like a trie. The constants depend on transition encoding: linear scan is small for low-degree states, binary search helps sorted transition arrays, and packed encodings improve locality at the cost of decoding work.`,
        `Space depends on how much prefix and suffix sharing the key set has, how compactly transitions are encoded, and how well outputs factor. Construction is heavier than hashing because the builder must maintain canonical states and output deltas. Updates are usually rebuilds or segment merges, not cheap in-place edits.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Take the keys car -> 10, card -> 11, care -> 12, and dog -> 30 from the animation. The car, card, and care paths share the prefix c-a-r. A trie would already share that prefix. The FST can also share equivalent final behavior and can place the common output 10 near the shared path, then use deltas 0, 1, and 2 for the related keys.`,
        `Lookup for card reads c, a, r, d. Along the way it accumulates the output fragments attached to the traversed arcs. The final state must be accepting; otherwise a prefix such as ca would not count as a key. If the final state accepts, the accumulated output is 11 or a pointer that leads to the real payload.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `FST static maps win for large ordered dictionaries with values: Lucene-style term dictionaries, URL sets, byte-key maps, lexicons, static routing tables, and autocomplete indexes. They are strongest when the key set is sorted, mostly immutable, and useful to traverse by prefix or range.`,
        `They also work well when the output is an ordinal, delta, block pointer, weight, or payload id rather than a large value blob. Large external payloads can stay outside the FST while the FST stores the compact route to them.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `If the workload only needs exact lookup and can verify keys externally, a hash table or minimal perfect hash static dictionary may be simpler. If it only needs cheap negative tests, a Bloom filter or binary fuse filter may be smaller.`,
        `FSTs also require disciplined input normalization. Byte order, case folding, Unicode normalization, separator conventions, and sorted-build order are part of the data contract. Changing any of those details changes the accepted language and may require a rebuild.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Trie and Finite State Machine for the baseline concepts, then Minimal Perfect Hash Static Dictionary for a contrasting exact-lookup structure. Study LOUDS Succinct Trie for a compact trie that keeps topology instead of minimizing suffixes. Study Inverted Index and FM-Index to see why compact ordered dictionaries matter in search systems.`,
        `Useful references include Daciuk et al., Incremental Construction of Minimal Acyclic Finite-State Automata at https://aclanthology.org/J00-1002.pdf, Lucene FST package docs at https://lucene.apache.org/core/9_12_3/core/org/apache/lucene/util/fst/package-summary.html, Mike McCandless on Lucene FSTs at https://blog.mikemccandless.com/2010/12/using-finite-state-transducers-in.html, OpenFst at https://www.openfst.org/, and the Rust fst writeup at https://blog.burntsushi.net/transducers/.`,
      ],
    },
  ],
};
