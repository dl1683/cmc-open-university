// LOUDS succinct trie: encode tree topology level-by-level as unary degrees,
// then navigate with rank/select and compact label arrays instead of pointers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'louds-succinct-trie',
  title: 'LOUDS Succinct Trie',
  category: 'Data Structures',
  summary: 'A compact trie layout: store level-order unary degree bits plus labels, then use rank/select to navigate children without pointer-heavy nodes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode topology', 'navigate labels'], defaultValue: 'encode topology' },
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

function* encodeTopology() {
  yield {
    state: graphState({
      nodes: [
        { id: 'trie', label: 'trie', x: 0.8, y: 4.0, note: 'nodes' },
        { id: 'level', label: 'level order', x: 2.7, y: 4.0, note: 'BFS' },
        { id: 'degree', label: 'degrees', x: 4.6, y: 4.0, note: 'unary' },
        { id: 'bits', label: 'bits', x: 6.5, y: 4.0, note: '11010...' },
        { id: 'rank', label: 'rank/select', x: 8.4, y: 4.0, note: 'navigate' },
      ],
      edges: [
        { id: 'e-trie-level', from: 'trie', to: 'level' },
        { id: 'e-level-degree', from: 'level', to: 'degree' },
        { id: 'e-degree-bits', from: 'degree', to: 'bits' },
        { id: 'e-bits-rank', from: 'bits', to: 'rank' },
      ],
    }, { title: 'LOUDS turns tree shape into a navigable bitvector' }),
    highlight: { active: ['level', 'degree', 'bits'], found: ['rank'] },
    explanation: 'LOUDS means level-order unary degree sequence. Visit nodes breadth-first; for each node, write one 1 bit per child, then a 0. Rank/select makes those bits behave like tree pointers.',
    invariant: 'The topology is static bits plus small navigation directories, not object pointers.',
  };

  yield {
    state: labelMatrix(
      'Unary degree encoding',
      [
        { id: 'root', label: 'root' },
        { id: 'a', label: 'node a' },
        { id: 'b', label: 'node b' },
        { id: 'c', label: 'node c' },
      ],
      [
        { id: 'children', label: 'children' },
        { id: 'code', label: 'LOUDS code' },
      ],
      [
        ['2', '110'],
        ['1', '10'],
        ['0', '0'],
        ['2', '110'],
      ],
    ),
    highlight: { active: ['root:code', 'a:code', 'c:code'], compare: ['b:code'] },
    explanation: 'A node with two children contributes 110. A leaf contributes 0. Concatenating these codes in level order gives a bitstring from which child ranges can be recovered.',
  };

  yield {
    state: labelMatrix(
      'Compact trie arrays',
      [
        { id: 'louds', label: 'LOUDS bits' },
        { id: 'labels', label: 'edge labels' },
        { id: 'terminal', label: 'terminal bits' },
        { id: 'values', label: 'values' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'queryUse', label: 'query use' },
      ],
      [
        ['tree topology', 'parent/child'],
        ['bytes or chars', 'match path'],
        ['word ends?', 'membership'],
        ['optional payload', 'map lookup'],
      ],
    ),
    highlight: { found: ['louds:queryUse', 'labels:queryUse'], active: ['terminal:stores'] },
    explanation: 'A LOUDS trie usually stores topology separately from labels. The bitvector says where children are; the label array says which edge byte each child represents.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'keys stored', min: 0, max: 100 }, y: { label: 'pointer overhead', min: 0, max: 100 } },
      series: [
        { id: 'pointer', label: 'pointer trie', points: [{ x: 5, y: 28 }, { x: 50, y: 72 }, { x: 100, y: 96 }] },
        { id: 'louds', label: 'LOUDS trie', points: [{ x: 5, y: 14 }, { x: 50, y: 22 }, { x: 100, y: 30 }] },
      ],
    }),
    highlight: { found: ['louds'], compare: ['pointer'] },
    explanation: 'The chart is conceptual. LOUDS matters when pointer overhead dominates: dictionaries, autocomplete tables, static key maps, and range filters with millions or billions of nodes.',
  };
}

function* navigateLabels() {
  yield {
    state: labelMatrix(
      'Lookup cat',
      [
        { id: 'root', label: 'root' },
        { id: 'c', label: 'edge c' },
        { id: 'a', label: 'edge a' },
        { id: 't', label: 'edge t' },
        { id: 'done', label: 'terminal' },
      ],
      [
        { id: 'childRange', label: 'child range' },
        { id: 'labelSearch', label: 'label search' },
      ],
      [
        ['rank/select range', 'find c'],
        ['rank/select range', 'find a'],
        ['rank/select range', 'find t'],
        ['no children', 'stop'],
        ['terminal bit', 'key exists'],
      ],
    ),
    highlight: { active: ['root:childRange', 'c:labelSearch', 'a:labelSearch', 't:labelSearch'], found: ['done:labelSearch'] },
    explanation: 'To follow a key, compute the current node child range from LOUDS bits, search labels inside that range, then move to the selected child node.',
    invariant: 'Trie lookup is still prefix navigation; only the representation changed.',
  };

  yield {
    state: labelMatrix(
      'Navigation operations',
      [
        { id: 'firstChild', label: 'first child' },
        { id: 'nextSibling', label: 'next sibling' },
        { id: 'parent', label: 'parent' },
        { id: 'degree', label: 'degree' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'cost', label: 'typical cost' },
      ],
      [
        ['select/rank', 'constant-ish'],
        ['next 1 in range', 'local'],
        ['rank/select inverse', 'constant-ish'],
        ['child run length', 'local'],
      ],
    ),
    highlight: { found: ['firstChild:uses', 'parent:uses'], compare: ['degree:cost'] },
    explanation: 'Different LOUDS variants expose different formulas, but the pattern is stable: rank counts earlier structure, select jumps to the k-th structural marker.',
  };

  yield {
    state: labelMatrix(
      'Dense top, sparse bottom',
      [
        { id: 'upper', label: 'upper trie' },
        { id: 'lower', label: 'lower trie' },
        { id: 'suffix', label: 'suffix bits' },
        { id: 'payload', label: 'payloads' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['fast bitmap', 'hot levels'],
        ['LOUDS sparse', 'many nodes'],
        ['optional', 'false positives'],
        ['separate array', 'values'],
      ],
    ),
    highlight: { active: ['upper:reason', 'lower:reason'], found: ['suffix:layout'] },
    explanation: 'Fast Succinct Trie designs often split the trie: upper levels get a faster layout because every lookup touches them; lower levels get a denser layout because they contain most nodes.',
  };

  yield {
    state: labelMatrix(
      'When LOUDS is a fit',
      [
        { id: 'staticDict', label: 'static dictionary' },
        { id: 'autocomplete', label: 'autocomplete' },
        { id: 'rangeFilter', label: 'range filter' },
        { id: 'hotWrites', label: 'frequent writes' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'compact keys'],
        ['strong', 'prefix path'],
        ['strong', 'ordered trie'],
        ['weak', 'static bits'],
      ],
    ),
    highlight: { found: ['staticDict:fit', 'autocomplete:fit', 'rangeFilter:fit'], compare: ['hotWrites:reason'] },
    explanation: 'LOUDS is best for static or snapshot-built structures. If nodes are inserted and deleted constantly, pointer tries or dynamic trees are often simpler.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode topology') yield* encodeTopology();
  else if (view === 'navigate labels') yield* navigateLabels();
  else throw new InputError('Pick a LOUDS view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "encode topology" view walks the LOUDS pipeline: trie nodes are visited breadth-first, each node emits a unary degree code (one 1 per child, then a 0), and the codes concatenate into a single bitvector. Active highlights mark the node being encoded. Found highlights mark the rank/select layer that makes the bitvector navigable.',
        {type: 'callout', text: 'LOUDS keeps trie semantics but replaces pointers with bit positions, counts, and jumps.'},
        'The "navigate labels" view traces a key lookup through the finished structure. Active highlights show the child-range computation via rank/select; found highlights show the label match that advances the path. The terminal-bit check at the end confirms whether the path is a stored key or only a prefix.',
        'At each frame, track three things: which node is being processed, what bits it contributes to the bitvector, and how rank/select recovers the same parent-child relationship that a pointer would have stored explicitly.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A trie indexes strings by following the key one symbol at a time. The problem is cost. A pointer-based trie node carries an object header, a child map or array (often sparse), a terminal flag, and one pointer per child. For an English dictionary with a million entries, the pointer and object overhead can exceed the actual character data by an order of magnitude.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Radix_tree.svg', alt: 'Radix tree diagram showing prefix branches from a root', caption: 'A trie shares common prefixes; LOUDS keeps that prefix tree while changing the storage layout. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.'},
        'Guy Jacobson introduced LOUDS in his 1989 thesis to solve this: encode the tree topology as a bitvector of roughly 2n+1 bits for n nodes, then navigate it with rank and select instead of pointers. The trie idea stays intact -- prefix lookup, ordered traversal, common-prefix sharing -- but the representation shrinks from tens of bytes per node to about two bits per node for topology alone.',
        'LOUDS matters whenever the trie is built once and queried many times: static dictionaries, autocomplete indexes, IP routing tables, and succinct range filters inside storage engines.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The baseline is an ordinary pointer trie. Each node is an object with a map from outgoing character to child pointer, a boolean terminal flag, and an optional payload. Insertion walks the path and creates missing nodes. Lookup walks the path and checks the terminal bit. This is easy to build, easy to mutate, and easy to explain.',
        'The cost stays invisible until the dictionary is large. A node with two children still carries a full object header, a hash map or array with empty slots, and two 64-bit pointers. Millions of nodes means hundreds of megabytes of overhead for structure that could, in principle, be described by two bits per node.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Compressing the tree shape into bits is the easy half. The hard half is navigation. A lookup still needs to find a node\'s first child, scan labels in that child range, move to the selected child, and check whether the path is terminal. These are the same operations a pointer trie does with object references.',
        'A compact representation must answer pointer-like questions -- parent, first child, next sibling, degree -- without pointers, and it must answer them fast enough that the memory savings are not consumed by arithmetic overhead. The wall is not compression; it is making compression navigable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Visit every node in breadth-first (level) order. For each node, write one 1-bit for each child, then write a 0-bit to end that node\'s run. A node with two children contributes "110". A node with one child contributes "10". A leaf contributes "0". Prepend a superroot sentinel "10" so that the root itself has a parent entry. Concatenating all runs produces the LOUDS bitvector.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Rank and select recover parent-child movement from ordered markers rather than from stored pointers. Source: Wikimedia Commons, David W., public domain.'},
        {
          type: 'diagram',
          label: 'BFS traversal producing the LOUDS bitstring',
          text: 'Tree:          root\n               / \\\n              c   d\n              |    \n              a    \n              |    \n              t    \n\nBFS order:    root  c  d  a  t\nDegrees:       2    1  0  1  0\nUnary codes:  110  10  0  10  0\n\nLOUDS bits:   10 | 110 | 10 | 0 | 10 | 0\n              ^     ^    ^   ^    ^    ^\n           super  root   c   d    a    t\n              root',
        },
        'The trie stores four parallel arrays. The LOUDS bitvector encodes topology. A label array stores the edge character for each child entry, aligned with the 1-bits. A terminal bitvector marks nodes that complete stored keys. An optional value array holds payloads for map-style lookups.',
        'Lookup begins at the root. For the current node i, the child range is computed by rank and select on the bitvector. The formulas are:',
        {
          type: 'code',
          language: 'javascript',
          text: '// Given node number i (0-indexed among nodes):\n// Position of node i\'s unary run in the bitvector:\nlet p = select0(bits, i);       // position of i-th 0-bit\n\n// First child position in the bitvector:\nlet firstChildBit = p + 1;      // bit right after the 0\n// But the children are the 1-bits BEFORE the 0.\n// Standard LOUDS child navigation:\n//   first child of node i  = rank1(bits, select0(bits, i - 1) + 1)\n//   node number of j-th 1  = rank0(bits, select1(bits, j))\n\n// Practical form used in most implementations:\nfunction firstChild(bits, nodeNum) {\n  // y = position of node in the bitstring\n  let y = select1(bits, nodeNum); // nodeNum-th 1-bit\n  return rank0(bits, y);          // count 0s before y = child node number\n}\n\nfunction parent(bits, nodeNum) {\n  let y = select0(bits, nodeNum); // nodeNum-th 0-bit\n  return rank1(bits, y);          // count 1s before y = parent node number\n}',
        },
        'The code searches labels in the child range for the next input character. If no label matches, the key is absent. If a label matches, the child entry maps to the next node number, and lookup consumes that character. After the last character, the terminal bitvector decides whether the reached node marks a complete key.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The encoding is lossless for any ordered rooted tree. Each node contributes exactly one 0-bit (its run terminator), so the number of 0-bits equals the number of nodes. Each child contributes exactly one 1-bit in its parent\'s run, so the number of 1-bits equals the number of edges. For a tree with n nodes and n-1 edges, the bitvector has n + (n-1) + 1 = 2n bits (including the superroot sentinel), which is within one bit of the information-theoretic lower bound.',
        'Rank and select do not guess the topology; they count and jump among the markers the encoding created. rank1(p) counts how many 1-bits appear before position p, which identifies child entries. select0(k) jumps to the k-th 0-bit, which locates a node\'s run boundary. Because BFS lists all children in the same order they become nodes in the next level, the child entries are already sorted by node number. This alignment is the key invariant: the j-th 1-bit in the bitvector corresponds to the j-th child entry, the j-th label, and eventually the j-th node.',
        'If the label array is stored in child-entry order, following matching labels reconstructs exactly the same path a pointer trie would follow. The representation changes; the traversal semantics do not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pointer trie: roughly 256-512 topology bits per node after object headers and pointers; navigation is direct pointer chasing; mutation is easy; memory is the tax.',
            'LOUDS: roughly two topology bits per node plus rank/select directories; navigation is O(1) with arithmetic; mutation usually means rebuilding shifted bits and labels.',
            'DFUDS: roughly two topology bits per node with depth-first unary degree encoding; similar static-update cost, different traversal formulas.',
            'Balanced parentheses: roughly two topology bits per node with support tables; richer subtree queries, but still a static succinct-tree layout in practice.',
          ],
        },
        'The LOUDS bitvector costs 2n+1 bits for n nodes. Rank/select support structures add o(n) bits -- typically about 6-25% overhead depending on the implementation. Labels cost one byte per edge. Terminal bits cost one bit per node. The total is roughly 2-3 bytes per node instead of 50-100+ bytes in a pointer trie.',
        'When n doubles, storage grows linearly. Each lookup step costs O(1) via rank/select (with precomputed directory tables), so lookup remains O(k) for a key of length k -- same as a pointer trie. The constant factor is higher because each step involves arithmetic instead of a pointer chase, and cache behavior depends on how the bitvector fits in memory. For small tries (under a few thousand nodes), the pointer trie is faster in practice. LOUDS pays off when the node count reaches hundreds of thousands or millions.',
        'Updates are expensive. Inserting or deleting a node shifts all later bits and labels, requiring an O(n) rebuild. This is why LOUDS is used for static or batch-built structures, not online dictionaries.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LOUDS wins wherever a trie is the right abstraction but pointer overhead is the bottleneck. Static dictionaries and lexicons are the classic case: build once from a sorted word list, query millions of times. Autocomplete indexes benefit because prefix traversal is natural and the compact layout fits more of the trie in cache.',
        'SuRF (Succinct Range Filter) is the most prominent production use. SuRF replaces Bloom filters in LSM-tree storage engines (RocksDB, LevelDB-style systems) with a succinct trie that supports not just point queries but range queries. It splits the trie into a dense upper level (LOUDS-Dense, using 256-bit bitmaps per node for fast child lookup) and a sparse lower level (LOUDS-Sparse, using byte labels and position bitvectors). The upper level is small and hot; the lower level is large and compact.',
        {
          type: 'note',
          text: 'SuRF adds suffix bits or suffix hashes to trie leaves to control false-positive rates. A SuRF with 10 suffix bits achieves a false-positive rate below 0.1% while using roughly 14 bits per key -- far less than a Bloom filter with comparable accuracy for range queries, which Bloom filters cannot support at all.',
        },
        'Other uses include IP routing tables (longest-prefix match on bit strings), genome sequence indexes (DNA alphabet is only 4 symbols, so tries compress well), and compact serialization formats for shipping dictionary data over the network.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LOUDS is a poor fit for workloads with frequent insertions and deletions. Every structural change requires rebuilding the bitvector and shifting label arrays. If the dictionary changes often, a pointer trie, an adaptive radix tree (ART), or a log-structured merge approach with periodic LOUDS snapshots is simpler and faster.',
        'It is also not automatically better than a hash table. If the workload needs only exact membership ("is this key present?") without order, prefix queries, or range scans, a hash table, minimal perfect hash function, Bloom filter, or binary fuse filter may be smaller, faster, or both. LOUDS earns its complexity when prefix structure and ordering matter.',
        'Implementation complexity is a real cost. Rank/select primitives require careful engineering -- broadword operations, cache-aligned blocks, SIMD popcount -- and bugs in the index arithmetic are hard to diagnose. The conceptual simplicity of "it is just a bitvector" hides significant systems work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Jacobson, "Space-efficient static trees and graphs" (FOCS 1989) -- the original LOUDS definition and the rank/select framework for succinct data structures.',
            'Zhang et al., "SuRF: Practical Range Query Filtering with Fast Succinct Tries" (SIGMOD 2018) -- the production LOUDS-Dense / LOUDS-Sparse split used in RocksDB experiments. Paper: https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf',
            'Memoria framework LOUDS tree overview: https://memoria-framework.dev/docs/data-zoo/louds-tree/',
            'Kampersanda fast_succinct_trie (C++ implementation): https://github.com/kampersanda/fast_succinct_trie',
          ],
        },
        'Study Rank/Select Bitvector first -- LOUDS is unusable without those primitives. Study Trie for the uncompressed baseline that LOUDS replaces. Study Adaptive Radix Tree for a pointer-based trie that also targets memory efficiency but supports mutation. Study Bloom Filter and Binary Fuse Filter to understand the membership-query alternatives that LOUDS-based range filters compete with. Study FM-Index or Wavelet Matrix to see rank/select applied to full-text indexing rather than tree navigation.',
      ],
    },
  ],
};
