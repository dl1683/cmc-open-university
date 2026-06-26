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
  const lookupStages = ['key', 'fst', 'output', 'slot', 'answer'];
  yield {
    state: lookupGraph('An FST maps strings to compact outputs'),
    highlight: { active: ['key', 'fst', 'output'], found: ['slot', 'answer'] },
    explanation: `A finite-state transducer is an automaton with outputs on transitions. Lookup walks ${lookupStages.length} stages (${lookupStages.join(' -> ')}) — key symbols are consumed, output pieces accumulate, and a stored ordinal, pointer, or payload id emerges.`,
    invariant: `The FST is exact for its stored language: a missing transition at any of the ${lookupStages.length} stages proves the key is absent.`,
  };

  const keys = [
    { id: 'car', label: 'car', out: 10 },
    { id: 'card', label: 'card', out: 11 },
    { id: 'care', label: 'care', out: 12 },
    { id: 'dog', label: 'dog', out: 30 },
  ];
  yield {
    state: labelMatrix(
      'Tiny static map',
      keys.map(({ id, label }) => ({ id, label })),
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
    explanation: `${keys.length} stored keys (${keys.map(k => k.label).join(', ')}) remain lexicographic like a trie, but outputs (${keys.map(k => k.out).join(', ')}) are part of the machine. A search engine can map a term to a term ordinal or block pointer without storing one object per term.`,
  };

  const sharingDimensions = [
    { id: 'prefix', label: 'prefixes' },
    { id: 'suffix', label: 'suffixes' },
    { id: 'outputs', label: 'outputs' },
    { id: 'finals', label: 'final states' },
  ];
  yield {
    state: labelMatrix(
      'What gets shared',
      sharingDimensions,
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
    explanation: `Across ${sharingDimensions.length} sharing dimensions, a minimized acyclic automaton can merge identical suffix subgraphs — not just prefixes. With ${keys.length} keys like ours, transducer outputs are factored so common output prefixes live near the root and deltas live on later arcs.`,
  };

  const alternatives = [
    { id: 'hash', label: 'MPHF' },
    { id: 'fst', label: 'FST' },
    { id: 'trie', label: 'trie' },
    { id: 'bloom', label: 'Bloom' },
  ];
  yield {
    state: labelMatrix(
      'Compare static dictionaries',
      alternatives,
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
    explanation: `Among ${alternatives.length} static dictionary structures (${alternatives.map(a => a.label).join(', ')}), FSTs sit between tries and perfect hashes. They keep order and prefix traversal like tries, compress static dictionaries aggressively, and return values directly like a map.`,
  };
}

function* buildAndMinimize() {
  const buildStages = ['terms', 'trie', 'register', 'merge', 'fst'];
  yield {
    state: buildGraph('Sorted input enables online minimization'),
    highlight: { active: ['terms', 'trie', 'register'], found: ['merge', 'fst'] },
    explanation: `A practical builder reads terms through ${buildStages.length} stages (${buildStages.join(' -> ')}). After each new key, the suffix of the previous key is frozen, compared with a register of equivalent states, and merged when the future behavior is identical.`,
    invariant: `Two states can merge when they accept the same suffix language and carry compatible outputs — the ${buildStages[2]} decides.`,
  };

  const equivCriteria = [
    { id: 'same', label: 'same suffix', decision: 'merge' },
    { id: 'final', label: 'same final', decision: 'merge' },
    { id: 'out', label: 'same output', decision: 'merge/factor' },
    { id: 'diff', label: 'different arc', decision: 'keep apart' },
  ];
  const mergeable = equivCriteria.filter(c => c.decision.startsWith('merge'));
  yield {
    state: labelMatrix(
      'State equivalence',
      equivCriteria.map(({ id, label }) => ({ id, label })),
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
    explanation: `Minimization is not visual decoration. ${mergeable.length} of ${equivCriteria.length} criteria lead to merging — if two states answer every possible remaining suffix in the same way, one state can represent both histories.`,
  };

  const factorKeys = [
    { id: 'car', label: 'car', common: 10, delta: 0 },
    { id: 'card', label: 'card', common: 10, delta: 1 },
    { id: 'care', label: 'care', common: 10, delta: 2 },
    { id: 'cars', label: 'cars', common: 10, delta: 3 },
  ];
  const commonOut = factorKeys[0].common;
  yield {
    state: labelMatrix(
      'Output factoring',
      factorKeys.map(({ id, label }) => ({ id, label })),
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
    explanation: `All ${factorKeys.length} keys share common output ${commonOut} on the early arc. The builder pushes this toward the root, leaving deltas ${factorKeys.map(k => k.delta).join(', ')} on later arcs. Lookup accumulates the common part plus the final delta.`,
  };

  yield {
    state: buildGraph('Lucene-style terms dictionaries use the pattern'),
    highlight: { active: ['terms', 'fst'], found: ['merge'], compare: ['trie'] },
    explanation: `Lucene popularized FSTs for compact in-memory term dictionaries. Through the ${buildStages.length}-stage pipeline, the FST can guide a term lookup toward the block or ordinal that contains the postings metadata, while larger postings data stays outside the automaton.`,
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
        'The visualization has two views. The "lookup path" view traces a single key through the FST, which is the automaton that stores our dictionary. Active nodes mark the current position in the machine: key bytes enter one at a time, arcs (transitions) are followed, output fragments accumulate into a running total, and the final state decides whether the key exists. Found markers appear when a value is determined. Compare markers highlight sibling keys whose paths share arcs with the current lookup, so you can see how different keys reuse the same structure.',
        {type: 'callout', text: 'An FST map stores keys as paths and values as output accumulated along those paths.'},
        'The "build and minimize" view traces construction. Sorted terms feed a trie-like frontier one by one. When the builder moves past a suffix that will never receive new children, that suffix is frozen. The builder checks a register of already-built states: if an equivalent frozen state already exists, the two merge into one. The output factoring frame shows how nearby values share a common prefix on early arcs and leave only small deltas on later arcs. Watch for the moment two separate suffix chains collapse into one -- that is where the FST earns its compression.',
        'In both views, a missing transition is proof of absence. If the automaton has no arc for the next input byte, the key is not in the dictionary. Unlike a hash miss, which only says a slot is empty and might be a collision artifact, a missing FST arc is definitive: no key with that prefix exists.',
        {type: 'image', src: './assets/gifs/finite-state-transducer-static-map.gif', alt: 'Animated walkthrough of the finite state transducer static map visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A search engine like Lucene stores millions of indexed terms -- every word that appears in every document. For each term, the engine needs to find a block pointer or ordinal that leads to the posting list (the list of documents containing that term). This term dictionary sits in memory and is hit on every single query. It must be compact enough to fit in RAM, ordered so that prefix and range queries work, and fast enough that dictionary lookup does not dominate query latency.',
        'The same pressure appears in autocomplete indexes, URL routing tables with millions of prefixes, NLP lexicons mapping word forms to lemma IDs, and any static key-value store where the key set is known at build time and changes rarely. The shared constraint is always the same: a large, static, sorted set of string keys, each associated with a small value, queried far more often than it changes.',
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
        'A hash map gives O(1) average exact lookup but destroys sorted order. You cannot iterate terms alphabetically, find "all terms starting with comp," or answer "what is the next term after this prefix." These are not niche features; a search engine uses them constantly for wildcard queries, fuzzy matching, and block-level seeking. Giving up order means giving up half the operations a term dictionary needs.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Trie-vs-minimal-acyclic-fa.svg/250px-Trie-vs-minimal-acyclic-fa.svg.png', alt: 'Trie compared with a minimal acyclic finite automaton for a small word set', caption: 'The DAFSA side shows how suffix sharing shrinks a static dictionary beyond ordinary prefix sharing. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie-vs-minimal-acyclic-fa.svg.'},
        'A trie (prefix tree) preserves sorted order and supports prefix operations naturally. Each shared prefix is stored once, so "computer," "compute," and "compact" share the "comp" path. But a trie only shares prefixes. If thousands of terms end in "-tion," "-ment," or "-ing," the trie builds a separate suffix subtree for every prefix that reaches that ending. Node pointers, transition arrays, and per-node bookkeeping add up. A naive trie over English Wikipedia terms can exceed the raw term bytes in pointer overhead alone.',
        'A sorted array with binary search is compact and ordered, but lookup costs O(log n) string comparisons. Each comparison touches memory at an unpredictable location, so cache behavior is poor for millions of variable-length strings. There is no way to share common substrings across keys.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is simultaneous pressure from three directions. The dictionary must be ordered, which rules out hash maps. It must be compact, which rules out pointer-heavy tries. And it must carry values -- not just answer "is this key present?" but "what value does this key map to?" This third requirement rules out a DAWG (directed acyclic word graph), which is a plain minimal automaton that shares both prefixes and suffixes but has no mechanism for storing associated data.',
        'A DAWG solves the first two problems beautifully. It recognizes exactly the same set of strings as a trie but with far fewer states, because it merges states whose suffixes are identical. The compression can be dramatic -- 10x or more over a raw trie for natural-language key sets. But a DAWG is a recognizer, not a map. It answers "yes" or "no" for membership. Bolting an external value array back on reintroduces per-key storage and throws away much of the compression gain.',
        'What we need is a structure that carries output data inside the automaton itself, accumulating value fragments along the path so that lookup returns both a membership answer and a result value, without a separate table.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A transducer is an automaton that produces output, not just acceptance. The core move is to put an output label on each arc alongside the input label. When a key is looked up, the machine reads one input byte per arc and sums the output labels along the path. If the path ends at an accepting state, the accumulated sum is the value. The output is distributed across the arcs, not stored at a single node.',
        'This distribution is what makes suffix sharing possible even with values. Consider keys car=10, card=11, care=12. In a naive map, the three values are distinct, so the suffix structures look different. But the transducer pushes the common output (10) onto the shared "c" arc near the root, then puts only the residual deltas (0, 1, 2) on the diverging suffix arcs. Now the suffix states -- "r" followed by nothing, "r" followed by "d", "r" followed by "e" -- differ only in their small deltas, and the states after the delta arcs are identical (all final, no outgoing arcs). The minimizer merges them.',
        'The invariant: for every key, the sum of output labels along its path equals the original value. Factoring moves output toward the root without changing any path sum, and the resulting suffix states become equivalent, so the automaton shrinks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A finite-state transducer (FST) is a finite automaton where each transition carries two labels: an input symbol and an output value. In the Mealy convention used by Lucene and the Rust fst crate, outputs live on arcs (transitions) rather than states. Final states may carry an additional output that is added to the sum when the path terminates there. Lookup reads the key one byte at a time, follows arcs, and accumulates the output. If the path ends at an accepting final state, the total is the mapped value.',
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
        'Construction uses Daciuk\'s algorithm, which builds a minimal acyclic automaton incrementally from sorted input. The builder maintains a frontier of active states, much like a trie under construction. When a new key diverges from the previous one at some position, every state after that position in the previous key will never receive new children. Those states are frozen. Each frozen state is hashed and compared against a register of already-built states. If an equivalent state exists (same outgoing arcs, same finality, same outputs), the frozen state is replaced by a pointer to the existing one. Otherwise it enters the register as new.',
        'Output factoring runs alongside construction. When multiple keys sharing a prefix map to nearby values, the builder computes the greatest common output prefix and pushes it toward the root arc. Only residual deltas remain on later arcs. This is what makes suffix states mergeable: the values that would have made them different have already been absorbed earlier in the path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness of the automaton rests on state equivalence. Two states are equivalent when they accept exactly the same set of suffixes with the same output behavior. Merging equivalent states preserves the accepted language: every key that was accepted before is still accepted by the same path of input labels, and every non-key still hits a missing transition or a non-final state. No accepted path is created or destroyed.',
        'Correctness of the output rests on path-sum invariance. Moving a common output fragment from later arcs to an earlier shared arc does not change the total output accumulated along any complete key path. If three arcs each carried output 10 and a shared parent arc carried 0, moving 10 to the parent and setting the three arcs to 0 preserves every path sum. A formal proof proceeds by induction on the number of factoring steps, showing each step preserves every key\'s path sum.',
        'Minimality follows from the Myhill-Nerode theorem applied to acyclic automata. The register-based construction produces the unique minimal deterministic acyclic automaton for the key language. No smaller acyclic DFA accepts exactly the same set of strings. Combined with the output invariant, the result is the smallest possible transducer that maps each key to its correct value.',
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
        'Lookup touches one byte of input per transition, the same as a trie. Practical speed depends on how transitions are encoded in memory. Lucene packs arcs into a contiguous byte array with variable-length encodings, optimized for sequential scan of low-fanout states. The Rust fst crate uses a similar packed representation. Both avoid pointer chasing by laying out the entire automaton in a single byte buffer, which makes lookups cache-friendly even for large dictionaries.',
        'Space savings over a trie are proportional to suffix sharing. Natural-language term sets share heavily: "-tion," "-ing," "-ment," "-ed," "-ly" suffixes collapse thousands of subtrees into one. Lucene reports FST sizes 10-20x smaller than the raw term bytes for English indexes. Random byte strings share little and compress poorly -- the worst case for an FST approaches a trie in size.',
        'Construction is O(n * average key length) and requires sorted input. The register lookup at each suffix freeze is O(1) amortized with a hash-based register. Memory during construction is proportional to the longest common prefix between consecutive keys, not the entire key set, because the builder only materializes the active frontier.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene\'s BlockTree terms dictionary is the canonical production deployment. Every Lucene, Elasticsearch, and Solr index builds an FST that maps terms to block file pointers in the terms file. The FST sits entirely in memory; the postings data stays on disk. A term lookup walks the FST to find the right disk block, then reads that one block to locate the exact term and its posting list metadata. Tantivy, the Rust search engine, uses the same architecture via the fst crate.',
        'The pattern generalizes to any system that needs a compact, ordered, in-memory index over a large static key set. URL routing tables where millions of URL prefixes map to handler IDs use FSTs to avoid the memory cost of storing every prefix as a separate string. NLP lexicons map word forms to lemma IDs with an FST so the entire lexicon fits in a few megabytes. Autocomplete indexes map prefixes to suggestion-list pointers, and the FST\'s prefix iteration makes "type and see completions" trivial to implement.',
        {
          type: 'note',
          text: 'FSTs are strongest when the key set is built once and queried many times. If keys change frequently, the rebuild cost dominates and a mutable structure like a B-tree or skip list is a better fit.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If sorted order does not matter and you only need exact lookup, a hash map or minimal perfect hash function is simpler and often faster. A minimal perfect hash maps n keys to exactly n consecutive slots with no collisions and O(1) lookup. It uses less memory than an FST when order is irrelevant, but it cannot answer prefix or range queries.',
        'If you only need probabilistic membership -- "is this term probably in the dictionary?" -- a Bloom filter or binary fuse filter is far smaller. An FST gives exact answers but pays for that exactness in construction complexity and space.',
        'FSTs are brittle to input normalization changes. The automaton encodes the exact byte sequences of its keys. Changing case folding rules, Unicode normalization forms, or locale-specific sort order invalidates the entire structure. There is no way to patch individual entries; the only option is a full rebuild from the new sorted key set. For systems where normalization rules evolve, this rebuild cost is a real operational burden.',
        'Large values do not belong inside the FST. The output on each arc is typically a small integer -- an ordinal, a delta, or a block pointer. If each key maps to a large payload, store the payloads externally and let the FST map keys to payload offsets. Embedding large outputs inflates the automaton and defeats the compression that makes FSTs worthwhile.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build an FST for five keys: ant=5, ante=7, anti=9, bat=20, bath=22. The keys must be sorted (they are). The builder processes them one at a time.',
        'Key "ant"=5: the builder creates states 0-a->1-n->2-t->3 with output 5 on the first arc (a:5, n:0, t:0). State 3 is final with final output 0. No previous states to freeze yet.',
        'Key "ante"=7: shares prefix "ant" with the previous key, diverges at position 3. The builder extends from state 3: 3-e->4. State 4 is final. The common output prefix of 5 and 7 is 5 (the minimum, since both share the "a" arc). The "a" arc keeps output 5. State 3\'s final output becomes 0 (for "ant": 5+0+0+0 = 5). The "e" arc from state 3 carries 2 (for "ante": 5+0+0+2 = 7).',
        'Key "anti"=9: shares prefix "ant" again, diverges at position 3. Add arc 3-i->5, final. The "i" arc carries 4 (for "anti": 5+0+0+4 = 9). Now state 3 has two outgoing arcs (e and i) and is itself final.',
        'Key "bat"=20: diverges at the root (position 0). The entire "ant" subtree is frozen. States 4 and 5 are both final with no outgoing arcs -- they are equivalent, so the register merges them into one state. The builder starts a new chain: 0-b->6-a->7-t->8, final. Arc "b" carries output 20.',
        'Key "bath"=22: shares prefix "bat", diverges at position 3. Add arc 8-h->9, final. Common output prefix of 20 and 22 is 20. Arc "b" keeps 20. State 8\'s final output is 0 (for "bat": 20+0+0+0 = 20). Arc "h" carries 2 (for "bath": 20+0+0+2 = 22).',
        'After all keys are processed, the remaining frontier is frozen. States 3 and 8 both have the same structure: final, outgoing arcs to equivalent final states with the same relative outputs. The register merges them. The final FST has fewer states than the original trie because suffix sharing collapsed the repeated "final state with one arc to another final state" pattern.',
        'Verify the path sums: ant = 5+0+0+0 = 5. ante = 5+0+0+2 = 7. anti = 5+0+0+4 = 9. bat = 20+0+0+0 = 20. bath = 20+0+0+2 = 22. Every value matches the input. Looking up "bad" would fail at state 7 (no arc for "d"), proving absence without checking any further.',
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
