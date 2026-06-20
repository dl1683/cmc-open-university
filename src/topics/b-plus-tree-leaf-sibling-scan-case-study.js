// B+ trees: the database index shape that keeps routing keys above and
// complete records at the leaves, then links leaves for cheap range scans.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'b-plus-tree-leaf-sibling-scan-case-study',
  title: 'B+ Tree Leaf Sibling Scan Case Study',
  category: 'Data Structures',
  summary: 'A page-index case study: internal separators route lookups, leaves hold entries, sibling links make range scans sequential, and splits publish new separators safely.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fanout path', 'leaf scan', 'split audit'], defaultValue: 'fanout path' },
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

function bplusGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 1.1, note: 'key 41' },
      { id: 'root', label: 'root', x: 5.0, y: 1.1, note: 'sep 56' },
      { id: 'left', label: 'int L', x: 3.0, y: 3.0, note: '22|37' },
      { id: 'right', label: 'int R', x: 7.0, y: 3.0, note: '77' },
      { id: 'l0', label: 'L0', x: 1.2, y: 5.6, note: '10 18' },
      { id: 'l1', label: 'L1', x: 3.1, y: 5.6, note: '22 29' },
      { id: 'l2', label: 'L2', x: 5.0, y: 5.6, note: '37 41' },
      { id: 'l3', label: 'L3', x: 6.9, y: 5.6, note: '56 63' },
      { id: 'l4', label: 'L4', x: 8.8, y: 5.6, note: '77 84' },
      { id: 'heap', label: 'heap', x: 5.0, y: 7.5, note: 'rows' },
    ],
    edges: [
      { id: 'e-query-root', from: 'query', to: 'root', weight: 'seek' },
      { id: 'e-root-left', from: 'root', to: 'left', weight: '<56' },
      { id: 'e-root-right', from: 'root', to: 'right', weight: '>=56' },
      { id: 'e-left-l0', from: 'left', to: 'l0' },
      { id: 'e-left-l1', from: 'left', to: 'l1' },
      { id: 'e-left-l2', from: 'left', to: 'l2' },
      { id: 'e-right-l3', from: 'right', to: 'l3' },
      { id: 'e-right-l4', from: 'right', to: 'l4' },
      { id: 'e-l0-l1', from: 'l0', to: 'l1', weight: 'next' },
      { id: 'e-l1-l2', from: 'l1', to: 'l2', weight: 'next' },
      { id: 'e-l2-l3', from: 'l2', to: 'l3', weight: 'next' },
      { id: 'e-l3-l4', from: 'l3', to: 'l4', weight: 'next' },
      { id: 'e-l2-heap', from: 'l2', to: 'heap', weight: 'tid' },
      { id: 'e-l3-heap', from: 'l3', to: 'heap', weight: 'tid' },
    ],
  }, { title });
}

function* fanoutPath() {
  yield {
    state: bplusGraph('B+ tree: route above, data at leaves'),
    highlight: { active: ['root', 'left', 'right'], found: ['l0', 'l1', 'l2', 'l3', 'l4'] },
    explanation: 'A B+ tree separates navigation from payload. Internal pages store separator keys and child pointers. Leaf pages store index entries, row pointers, and links to neighboring leaves.',
    invariant: 'All searches end at a leaf; all leaves stay at the same depth.',
  };

  yield {
    state: labelMatrix(
      'Page roles',
      [
        { id: 'root', label: 'root' },
        { id: 'inner', label: 'inner' },
        { id: 'leaf', label: 'leaf' },
        { id: 'heap', label: 'heap' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['seps', 'pick child', 'hot page'],
        ['seps', 'narrow', 'split'],
        ['keys+tids', 'answer', 'bloat'],
        ['rows', 'payload', 'random IO'],
      ],
    ),
    highlight: { active: ['root:stores', 'inner:job'], found: ['leaf:job'], compare: ['heap:risk'] },
    explanation: 'The name matters: in a B+ tree, full index entries live at the bottom. The upper levels are compact routing tables, so one page read can choose among many key ranges.',
  };

  yield {
    state: bplusGraph('Point lookup for key 41'),
    highlight: {
      active: ['query', 'root', 'left', 'l2', 'e-query-root', 'e-root-left', 'e-left-l2'],
      compare: ['right', 'l0', 'l1', 'l3', 'l4'],
    },
    explanation: 'Search key 41 touches the root, chooses the left internal page because 41 is less than 56, then chooses leaf L2 because 41 belongs between separators 37 and 56.',
  };

  yield {
    state: labelMatrix(
      'Leaf L2 search',
      [
        { id: 'k37', label: 'key 37' },
        { id: 'k41', label: 'key 41' },
        { id: 'next', label: 'next' },
        { id: 'tid', label: 'TID' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'meaning', label: 'means' },
      ],
      [
        ['37', 'too low'],
        ['41', 'match'],
        ['L3', 'scan hop'],
        ['p8:14', 'row addr'],
      ],
    ),
    highlight: { found: ['k41:value', 'k41:meaning', 'tid:value'], active: ['next:meaning'] },
    explanation: 'The leaf is still sorted, so the engine searches within the page and finds the matching entry. The table row address is stored here unless the index itself covers the query.',
  };

  yield {
    state: labelMatrix(
      'Fanout math',
      [
        { id: 'small', label: 'fanout 4' },
        { id: 'page', label: 'fanout 200' },
        { id: 'big', label: 'fanout 500' },
        { id: 'why', label: 'why' },
      ],
      [
        { id: 'height', label: 'height' },
        { id: 'touches', label: 'touches' },
      ],
      [
        ['10+', 'many'],
        ['4-5', 'few'],
        ['3-4', 'tiny'],
        ['wide', 'shallow'],
      ],
    ),
    highlight: { found: ['page:height', 'big:touches'], compare: ['small:touches'] },
    explanation: 'A production page may hold hundreds of separator keys. That is why the logarithm base is not 2. A very large index can be only a handful of page touches tall.',
  };
}

function* leafScan() {
  yield {
    state: bplusGraph('Range query starts with one seek'),
    highlight: { active: ['query', 'root', 'left', 'l1', 'e-query-root', 'e-root-left', 'e-left-l1'], found: ['l1'] },
    explanation: 'For BETWEEN 29 AND 63, the engine first performs an ordinary descent to the first leaf that can contain the lower bound. That is the only tree descent the range needs.',
    invariant: 'Seek once, then advance through the leaf chain.',
  };

  yield {
    state: bplusGraph('Leaf links turn the range into a scan'),
    highlight: {
      active: ['l1', 'l2', 'l3', 'e-l1-l2', 'e-l2-l3'],
      found: ['e-l1-l2', 'e-l2-l3'],
      compare: ['root', 'left', 'right', 'l0', 'l4'],
    },
    explanation: 'After the first leaf, the cursor follows sibling links. It reads L1, L2, and L3 in order, then stops before L4 because 77 is above the upper bound.',
  };

  yield {
    state: labelMatrix(
      'Range cursor',
      [
        { id: 'seek', label: 'seek' },
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'l3', label: 'L3' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'page', label: 'page' },
        { id: 'action', label: 'action' },
        { id: 'out', label: 'out' },
      ],
      [
        ['root', 'descend', 'none'],
        ['22 29', 'emit 29', '1 row'],
        ['37 41', 'emit all', '2 rows'],
        ['56 63', 'emit all', '2 rows'],
        ['77 84', 'halt', 'none'],
      ],
    ),
    highlight: { active: ['l1:action', 'l2:action', 'l3:action'], found: ['stop:action'], compare: ['seek:page'] },
    explanation: 'The cursor state is small: current leaf, slot inside the leaf, high bound, and scan direction. That is why ordered indexes are so good at pagination, time windows, and prefix ranges.',
  };

  yield {
    state: labelMatrix(
      'Covering index',
      [
        { id: 'key', label: 'cust,day' },
        { id: 'include', label: 'amount' },
        { id: 'tid', label: 'TID' },
        { id: 'heap', label: 'heap' },
      ],
      [
        { id: 'needed', label: 'needed' },
        { id: 'result', label: 'result' },
      ],
      [
        ['yes', 'filter'],
        ['yes', 'return'],
        ['no', 'skip'],
        ['no', 'no read'],
      ],
    ),
    highlight: { found: ['key:result', 'include:result', 'heap:result'], compare: ['tid:result'] },
    explanation: 'If the selected columns are already in the leaf entry, the scan can be index-only or covering. It returns from the leaf chain and avoids random heap reads.',
  };

  yield {
    state: labelMatrix(
      'Non-covering bill',
      [
        { id: 'leaf', label: 'leaf scan' },
        { id: 'tid', label: 'TID list' },
        { id: 'heap', label: 'heap fetch' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['seq pages', 'ok'],
        ['row addrs', 'batch'],
        ['random IO', 'cover'],
        ['hits help', 'measure'],
      ],
    ),
    highlight: { active: ['leaf:cost', 'tid:cost'], compare: ['heap:cost'], found: ['heap:fix'] },
    explanation: 'A range scan can be fast inside the index and still slow overall if every matching tuple forces a scattered table lookup. Covering indexes, clustering, and buffer-pool locality decide the real latency.',
  };
}

function* splitAudit() {
  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'root', x: 5.0, y: 1.2, note: '37|56' },
        { id: 'full', label: 'full leaf', x: 4.0, y: 3.8, note: '37 41 44' },
        { id: 'insert', label: 'insert', x: 1.5, y: 3.8, note: '45' },
        { id: 'right', label: 'new leaf', x: 6.5, y: 3.8, note: '45 47' },
        { id: 'next', label: 'old next', x: 8.7, y: 3.8, note: '56 63' },
      ],
      edges: [
        { id: 'e-root-full', from: 'root', to: 'full' },
        { id: 'e-insert-full', from: 'insert', to: 'full' },
        { id: 'e-full-right', from: 'full', to: 'right', weight: 'next' },
        { id: 'e-right-next', from: 'right', to: 'next', weight: 'next' },
      ],
    }, { title: 'A full leaf splits before the parent changes' }),
    highlight: { active: ['full', 'insert'], compare: ['right', 'next'] },
    explanation: 'An insert targets a full leaf. A B+ tree does not rotate the way an AVL tree does. It creates room by splitting the page and preserving the leaf order.',
    invariant: 'The first key of the new right leaf becomes the separator copied upward.',
  };

  yield {
    state: labelMatrix(
      'Leaf split',
      [
        { id: 'before', label: 'before' },
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
        { id: 'sep', label: 'sep' },
      ],
      [
        { id: 'keys', label: 'keys' },
        { id: 'link', label: 'link' },
      ],
      [
        ['37 41 44', 'to L3'],
        ['37 41 44', 'to new'],
        ['45 47', 'to L3'],
        ['45', 'parent'],
      ],
    ),
    highlight: { active: ['left:link', 'right:link'], found: ['sep:keys'], compare: ['before:keys'] },
    explanation: 'The split keeps the lower keys in the old page, moves upper keys into a new right sibling, and copies separator 45 into the parent. The old leaf remains a valid scan position.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'wal', label: 'WAL', x: 0.8, y: 4.0, note: 'redo' },
        { id: 'left', label: 'left pg', x: 2.6, y: 4.0, note: 'trim' },
        { id: 'right', label: 'right pg', x: 4.4, y: 4.0, note: 'new' },
        { id: 'link', label: 'link', x: 6.1, y: 4.0, note: 'next' },
        { id: 'parent', label: 'parent', x: 7.8, y: 4.0, note: 'sep 45' },
        { id: 'root', label: 'root', x: 9.2, y: 4.0, note: 'maybe' },
      ],
      edges: [
        { id: 'e-wal-left', from: 'wal', to: 'left' },
        { id: 'e-left-right', from: 'left', to: 'right' },
        { id: 'e-right-link', from: 'right', to: 'link' },
        { id: 'e-link-parent', from: 'link', to: 'parent' },
        { id: 'e-parent-root', from: 'parent', to: 'root' },
      ],
    }, { title: 'Crash-safe publication order' }),
    highlight: { active: ['wal', 'left', 'right', 'link'], found: ['parent'], compare: ['root'] },
    explanation: 'Storage engines must order the physical work. Log the split, make both leaf pages reachable through sibling links, then make the parent separator route future searches directly.',
  };

  yield {
    state: labelMatrix(
      'Split checks',
      [
        { id: 'wal', label: 'WAL' },
        { id: 'links', label: 'links' },
        { id: 'parent', label: 'parent' },
        { id: 'root', label: 'root' },
        { id: 'scan', label: 'scan' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['log first', 'lost page'],
        ['old->new', 'skip keys'],
        ['copy sep', 'miss leaf'],
        ['split up', 'bad height'],
        ['bounds', 'dup rows'],
      ],
    ),
    highlight: { active: ['wal:rule', 'links:rule', 'parent:rule'], found: ['scan:bug'], compare: ['root:bug'] },
    explanation: 'The hard part is not the sorted array move. It is proving every reader, range cursor, crash recovery path, and parent update still sees each key exactly once.',
  };

  yield {
    state: labelMatrix(
      'Ops knobs',
      [
        { id: 'fill', label: 'fill' },
        { id: 'dedupe', label: 'dedupe' },
        { id: 'vacuum', label: 'vacuum' },
        { id: 'reindex', label: 'reindex' },
        { id: 'hot', label: 'HOT' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['future', 'bloat'],
        ['dups', 'CPU'],
        ['dead', 'lag'],
        ['shape', 'locks'],
        ['no idx', 'heap only'],
      ],
    ),
    highlight: { found: ['fill:helps', 'dedupe:helps', 'hot:helps'], compare: ['vacuum:watch', 'reindex:watch'] },
    explanation: 'A production B+ tree is also an operational object. Fill factor, deduplication, vacuuming, reindexing, and heap-only updates decide whether the clean diagram stays clean under months of writes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fanout path') yield* fanoutPath();
  else if (view === 'leaf scan') yield* leafScan();
  else if (view === 'split audit') yield* splitAudit();
  else throw new InputError('Pick a B+ tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces three views of a B+ tree index: the fanout path showing a point lookup, the leaf scan showing a range query cursor, and the split audit showing crash-safe page splitting.',
        'Active nodes mark the current decision point -- the page being examined or the key comparison in progress. Found nodes mark entries whose result is now confirmed: a matching key, a completed scan range, or a published separator. Compare nodes mark structure that is excluded by the current decision -- child subtrees the search key cannot reach, or leaves outside the scan bounds.',
        {
          type: 'note',
          text: 'Inference rule: if a node is active and all its children are compare-highlighted, the search has narrowed to exactly one child path. The fanout decision at that internal page is complete.',
        },
        'At each frame, ask three things: which page was read, what range of keys was eliminated, and how many page reads remain before the answer is known.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Databases store rows on fixed-size pages, typically 4 KB, 8 KB, or 16 KB. A query like SELECT * FROM orders WHERE customer_id = 42 AND created_at BETWEEN June 1 AND June 30 ORDER BY created_at must find a needle in potentially billions of rows, then return its neighbors in sorted order, all without reading the entire table.',
        'The constraint is page-granularity I/O. Disk and SSD reads transfer whole pages regardless of how many bytes you need. Every page read that does not contribute to the answer is wasted. The index must minimize total page reads for both point lookups (find one key) and range scans (find a contiguous slice of sorted keys).',
        {
          type: 'table',
          headers: ['Operation', 'Without index', 'With B+ tree index'],
          rows: [
            ['Point lookup (1 row in 10M)', 'Full scan: ~1.2M page reads', '3-4 page reads (root + internal + leaf + heap)'],
            ['Range scan (1,000 rows)', 'Full scan: ~1.2M page reads', '4 + ~7 sequential leaf reads'],
            ['Ordered pagination (LIMIT 20 OFFSET 200)', 'Sort 10M rows, skip 200', 'Seek + walk 11 leaf slots'],
          ],
        },
        'A B+ tree exists because no simpler structure solves both problems at page granularity. It separates routing keys from data entries, keeps all data at the leaf level, and links leaves for sequential traversal. That three-part design makes point lookups logarithmic in the page fanout and range scans proportional to the result size, not the table size.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is a sorted file with binary search. It works well for static data: store rows in key order across pages, binary-search the page directory, read the target page. Read cost is O(log2 n) page reads. For a million-page file, that is about 20 page reads per lookup -- acceptable.',
        'The second reasonable attempt is a binary search tree in memory. Each node holds one key and two child pointers. Lookup is O(log2 n) comparisons. Updates are straightforward. Balanced variants (AVL, red-black) keep the tree shallow.',
        {
          type: 'bullets',
          items: [
            'Sorted file: fast reads, but inserting a row in the middle requires rewriting half the file. Deletion leaves gaps that fragment over time.',
            'Binary search tree: fast updates, but each node is tiny (one key, two pointers). A 4 KB page that could hold 200 keys instead holds one. The tree becomes 7-8 times taller than necessary, and every level is a potential cache miss or disk seek.',
            'Hash index: O(1) point lookup, but no sorted order at all. Range scans, ORDER BY, and prefix queries are impossible without a full scan.',
          ],
        },
        'All three approaches work for some access pattern. None of them simultaneously handle equality lookup, range scan, ordered traversal, and online updates across page-sized storage.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The sorted file breaks on writes. Inserting one row into a 10 GB sorted file may shift 5 GB of data. Even with a page directory, the insert cost is O(n) page writes in the worst case. Real OLTP workloads insert continuously; they cannot afford to reorganize the file on every write.',
        'The binary search tree breaks on page utilization. A node with one key and two 8-byte pointers wastes almost all of a 4 KB or 8 KB page. Log base 2 of 100 million is about 27, so a point lookup touches 27 nodes scattered across 27 pages. A B+ tree with fanout 200 stores the same 100 million keys in a tree only 4 levels deep. The difference is 27 random page reads versus 4.',
        {
          type: 'diagram',
          alt: 'Height comparison between binary tree and B+ tree for 100M keys',
          label: 'Tree height as a function of fanout',
          body: [
            'Binary tree (fanout 2):     height ~27    page reads per lookup: ~27',
            'B-tree (fanout 100):        height ~4     page reads per lookup: ~4',
            'B+ tree (fanout 200):       height ~4     page reads per lookup: ~4',
            '',
            'Why: log_2(100M) = 26.6    vs    log_200(100M) = 3.4',
            '',
            'Each internal page holds ~200 separator keys in 8 KB.',
            'Each level multiplies reachable leaves by 200, not by 2.',
          ].join('\n'),
          text: [
            'Binary tree (fanout 2):     height ~27    page reads per lookup: ~27',
            'B-tree (fanout 100):        height ~4     page reads per lookup: ~4',
            'B+ tree (fanout 200):       height ~4     page reads per lookup: ~4',
            '',
            'Why: log_2(100M) = 26.6    vs    log_200(100M) = 3.4',
            '',
            'Each internal page holds ~200 separator keys in 8 KB.',
            'Each level multiplies reachable leaves by 200, not by 2.',
          ].join('\n'),
        },
        'The hash index breaks on order. It answers "is key X present?" in O(1) but cannot answer "give me every key between A and B in sorted order" without scanning the entire hash table. Range queries, ORDER BY, MIN/MAX, and cursor pagination all need sorted access.',
        'The wall is the combination: an index must be wide (high fanout for shallow lookup), sorted (for range scans), and mutable (for online inserts and deletes) -- all at page granularity. The B+ tree is the structure that satisfies all three.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Rudolf Bayer and Edward McCreight, "Organization and Maintenance of Large Ordered Indexes" (1972)',
          text: 'The index organization described is, in several respects, for any given set of keys, not unique. Variants are possible depending on a parameter -- the page size -- and the order of insertion.',
        },
        'The core insight has two parts. First: make each node as wide as a disk page, so one I/O decision eliminates hundreds of key ranges instead of one. Second: push all data entries to the leaves and link the leaves in key order, so a range scan never needs to return to internal nodes after the initial descent.',
        'The invariant is: every key in the index appears exactly once, at a leaf. Internal nodes hold only separator keys that route searches downward. The leaf chain is a doubly- or singly-linked list in key order. After seeking to any leaf, the cursor can walk forward (or backward) through the entire sorted index without touching a single internal page.',
        {
          type: 'note',
          text: 'This is the difference between a B-tree and a B+ tree. In a classic B-tree, data can appear at internal nodes, so a range scan must do an in-order traversal that bounces between internal levels and leaves. A B+ tree guarantees data lives only at leaves and the leaves are linked, which turns range scans into simple sequential reads.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A B+ tree has three node types: the root, internal pages, and leaf pages. Each internal page contains sorted separator keys and child-page pointers. If an internal page has k separator keys, it has k+1 child pointers. The separator at position i divides keys that belong in child i (left, strictly less) from keys that belong in child i+1 (right, greater or equal).',
        {
          type: 'code',
          language: 'text',
          body: [
            'Internal page layout (8 KB page, 8-byte keys, 8-byte pointers):',
            '',
            '  [ptr0][key0][ptr1][key1][ptr2]...[key_{k-1}][ptr_k]',
            '',
            '  ptr0 -> child with all keys < key0',
            '  ptr1 -> child with keys >= key0 and < key1',
            '  ...',
            '  ptr_k -> child with all keys >= key_{k-1}',
            '',
            '  With 8-byte keys and pointers, one 8 KB page holds:',
            '    k = floor((8192 - header) / 16) ~ 500 separators',
            '    fanout = k + 1 ~ 501 children',
          ].join('\n'),
          text: [
            'Internal page layout (8 KB page, 8-byte keys, 8-byte pointers):',
            '',
            '  [ptr0][key0][ptr1][key1][ptr2]...[key_{k-1}][ptr_k]',
            '',
            '  ptr0 -> child with all keys < key0',
            '  ptr1 -> child with keys >= key0 and < key1',
            '  ...',
            '  ptr_k -> child with all keys >= key_{k-1}',
            '',
            '  With 8-byte keys and pointers, one 8 KB page holds:',
            '    k = floor((8192 - header) / 16) ~ 500 separators',
            '    fanout = k + 1 ~ 501 children',
          ].join('\n'),
        },
        'Point lookup: compare the search key against root separators, follow the correct child pointer, repeat at each internal level until reaching a leaf. Binary-search the leaf entries. If the key is found, return the row pointer (TID). If not, the key does not exist in the index.',
        'Range scan: descend to the leaf containing the lower bound. Scan forward through entries in that leaf. When the leaf ends, follow the next-leaf pointer to the sibling. Continue until the key exceeds the upper bound or there are no more leaves. The internal tree is touched exactly once; the rest is a sequential walk.',
        {
          type: 'diagram',
          alt: 'Point lookup versus range scan page access pattern',
          label: 'Access pattern comparison',
          body: [
            'Point lookup for key 41:',
            '  root (sep 56) -> intL (seps 22,37) -> leaf L2 (keys 37,41)',
            '  Pages read: 3 (root + internal + leaf)',
            '',
            'Range scan for keys 29..63:',
            '  root (sep 56) -> intL (seps 22,37) -> leaf L1 (keys 22,29)',
            '  Then sequential: L1 -> L2 -> L3 (stop: 77 > 63)',
            '  Pages read: 3 (descent) + 2 (sibling walk) = 5',
            '  Internal pages touched: only during initial descent',
          ].join('\n'),
          text: [
            'Point lookup for key 41:',
            '  root (sep 56) -> intL (seps 22,37) -> leaf L2 (keys 37,41)',
            '  Pages read: 3 (root + internal + leaf)',
            '',
            'Range scan for keys 29..63:',
            '  root (sep 56) -> intL (seps 22,37) -> leaf L1 (keys 22,29)',
            '  Then sequential: L1 -> L2 -> L3 (stop: 77 > 63)',
            '  Pages read: 3 (descent) + 2 (sibling walk) = 5',
            '  Internal pages touched: only during initial descent',
          ].join('\n'),
        },
        'Leaf entries typically store the indexed key columns plus a row locator. In PostgreSQL, the locator is a TID (page number, offset within page). In InnoDB secondary indexes, the locator is the primary key value, which then requires a second B+ tree lookup on the clustered (primary key) index. A covering index includes extra columns in the leaf entry so the query can be answered without fetching the base table row at all.',
      ],
    },
    {
      heading: 'Splits and crash safety',
      paragraphs: [
        'When a leaf is full and a new key must be inserted, the leaf splits. The lower half of keys stays in the original page. The upper half moves to a newly allocated page. The new page is wired into the sibling chain: its next pointer inherits the old page\'s next, and the old page\'s next is updated to point to the new page. A copy of the new page\'s first key is inserted into the parent as a separator.',
        {
          type: 'code',
          language: 'text',
          body: [
            'Before split:',
            '  Parent: [...sep_a | ptr_old | sep_b...]',
            '  Old leaf: [37, 41, 44] -> next: L3',
            '',
            'Insert key 45 (leaf is full):',
            '',
            'After split:',
            '  Old leaf: [37, 41, 44] -> next: NewLeaf',
            '  NewLeaf:  [45]         -> next: L3',
            '  Parent:   [...sep_a | ptr_old | 45 | ptr_new | sep_b...]',
            '',
            'The separator 45 (first key of new right page) is COPIED up.',
            'Both leaves remain reachable: by parent pointers AND sibling links.',
          ].join('\n'),
          text: [
            'Before split:',
            '  Parent: [...sep_a | ptr_old | sep_b...]',
            '  Old leaf: [37, 41, 44] -> next: L3',
            '',
            'Insert key 45 (leaf is full):',
            '',
            'After split:',
            '  Old leaf: [37, 41, 44] -> next: NewLeaf',
            '  NewLeaf:  [45]         -> next: L3',
            '  Parent:   [...sep_a | ptr_old | 45 | ptr_new | sep_b...]',
            '',
            'The separator 45 (first key of new right page) is COPIED up.',
            'Both leaves remain reachable: by parent pointers AND sibling links.',
          ].join('\n'),
        },
        'If the parent is also full, it splits too, pushing a separator further up. A root split creates a new root and increases tree height by one. Because fanout is so high, root splits are extremely rare: a tree with fanout 500 does not grow past height 4 until it exceeds 500^3 = 125 million leaf pages.',
        'Crash safety requires strict ordering of writes. The standard protocol for a leaf split:',
        {
          type: 'bullets',
          items: [
            'Write a WAL record describing the entire split (old page, new page, separator, parent page ID).',
            'Write the new leaf page to disk with its sibling link pointing to the old next neighbor.',
            'Update the old leaf page to point to the new sibling (the leaf chain is now correct).',
            'Insert the separator into the parent page.',
            'If the system crashes between steps 3 and 4, the leaf chain is still intact -- a range scan will find all keys via sibling links. The parent just has a "missing" shortcut. Recovery replays the WAL and completes the parent update.',
          ],
        },
        'This is why the sibling chain is not optional. It provides a safety net: even if the parent has not yet learned about the new leaf, a sequential scan through the leaf chain will still visit every key. The parent separator is a performance optimization (it lets point lookups skip directly to the right leaf) but the sibling chain is the correctness backstop.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three invariants maintained across every insert, delete, and split:',
        {
          type: 'bullets',
          items: [
            'Completeness: every key in the index appears at exactly one leaf. No key lives at an internal node. No key is stored in two leaves.',
            'Order: within each leaf, keys are sorted. The leaf chain visits leaves in ascending key order. If leaf A precedes leaf B in the chain, every key in A is less than every key in B.',
            'Depth uniformity: all leaves are at the same depth. This guarantees that point lookup cost is the same for any key.',
          ],
        },
        'Preservation through split: before the split, leaf L contains keys [k1...kn] in sorted order. After the split, L retains [k1...km] and a new leaf R gets [k_{m+1}...kn]. The chain is rewired: L.next = R, R.next = L.old_next. Separator k_{m+1} is copied into the parent. Completeness is preserved because every key is in exactly one of L or R. Order is preserved because the split point respects sorted order. Depth is unchanged because both L and R remain at the same level.',
        'Preservation through root split: when the root splits, a new root is created with one separator and two children (the old root halves). Depth increases by one, but uniformly -- all leaves are still at the same depth. No leaf moves; only the root level changes.',
        {
          type: 'note',
          text: 'Corner case: concurrent readers. A cursor performing a range scan may be positioned on leaf L when L splits. If the cursor has already read all entries in L and follows L.next, it reaches the new right sibling R and sees exactly the keys that moved. If the cursor has not yet reached the split point, those keys are still in L. The sibling chain guarantees no key is skipped or double-counted, provided the scan direction matches the chain direction.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Let f be the fanout (number of children per internal page) and n be the number of leaf entries.',
        {
          type: 'table',
          headers: ['Operation', 'Page reads', 'Intuition'],
          rows: [
            ['Point lookup', 'log_f(n) ~ 3-4 for billions of rows', 'Each level multiplies reachable keys by f. With f=500, 500^4 = 62.5 billion.'],
            ['Range scan (k results)', 'log_f(n) + ceil(k / entries_per_leaf)', 'One descent, then sequential leaf walk. Proportional to result size.'],
            ['Insert (no split)', 'log_f(n) + 1 write', 'Descend to leaf, write updated leaf page.'],
            ['Insert (leaf split)', 'log_f(n) + 3-4 writes', 'Descend, write old leaf, new leaf, parent update, WAL.'],
            ['Delete', 'log_f(n) + 1 write', 'Mark entry dead or remove. Merge is deferred in most engines.'],
          ],
        },
        'Doubling the table size adds at most one level to the tree. Going from 1 billion to 2 billion rows may not add any levels at all if the current height already accommodates the key space. The logarithm base is f, not 2, so growth is extremely slow.',
        'In practice, buffer pool caching dominates. The root page and most internal pages are hot in the cache. A point lookup on a warm index typically incurs only one or two physical I/O operations: the leaf page and possibly the heap page for the row. PostgreSQL reports this as "index scan" with buffers hit (cached) versus buffers read (from disk).',
        {
          type: 'table',
          headers: ['Table size', 'Rows (est.)', 'Tree height (f=500)', 'Physical reads per lookup (warm cache)'],
          rows: [
            ['1 MB', '10,000', '2', '0-1 (all cached)'],
            ['1 GB', '10,000,000', '3', '1 (leaf only)'],
            ['100 GB', '1,000,000,000', '4', '1-2 (leaf + maybe heap)'],
            ['10 TB', '100,000,000,000', '5', '2-3 (leaf + heap, internal levels cached)'],
          ],
        },
        'Space overhead: the index typically adds 2-3x the size of the indexed columns, because internal pages duplicate separator keys and each leaf stores key values plus TIDs plus per-entry overhead. A secondary index on an 8-byte integer column over 100 million rows might occupy 2-3 GB, compared to the 800 MB of raw key data.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce platform stores orders in a table: order_id (bigint PK), customer_id (int), created_at (timestamp), total_cents (int), status (varchar(20)), and items_json (jsonb, avg 2 KB). The table has 50 million rows, ~120 GB on disk with 8 KB pages.',
        'The product dashboard runs: SELECT total_cents, status FROM orders WHERE customer_id = 42 AND created_at >= \'2026-01-01\' AND created_at < \'2026-04-01\' ORDER BY created_at;',
        {
          type: 'code',
          language: 'sql',
          body: [
            '-- Covering index for the dashboard query',
            'CREATE INDEX idx_orders_cust_date',
            '  ON orders (customer_id, created_at)',
            '  INCLUDE (total_cents, status);',
            '',
            '-- Query plan (simplified):',
            '-- Index Only Scan using idx_orders_cust_date',
            '--   Index Cond: customer_id = 42',
            '--              AND created_at >= 2026-01-01',
            '--              AND created_at < 2026-04-01',
            '--   Heap Fetches: 0  (covering -- no table access)',
          ].join('\n'),
          text: [
            '-- Covering index for the dashboard query',
            'CREATE INDEX idx_orders_cust_date',
            '  ON orders (customer_id, created_at)',
            '  INCLUDE (total_cents, status);',
            '',
            '-- Query plan (simplified):',
            '-- Index Only Scan using idx_orders_cust_date',
            '--   Index Cond: customer_id = 42',
            '--              AND created_at >= 2026-01-01',
            '--              AND created_at < 2026-04-01',
            '--   Heap Fetches: 0  (covering -- no table access)',
          ].join('\n'),
        },
        'What happens page by page: the engine reads the root (cached), descends through one internal page (likely cached), and lands on the first leaf whose key range includes (42, 2026-01-01). It scans forward through leaf siblings, emitting (total_cents, status) from each matching entry. Because the index INCLUDEs those columns, it never touches the 120 GB heap table. If customer 42 has 200 orders in Q1, the scan reads about 2-3 leaf pages sequentially.',
        'Contrast with a non-covering variant: CREATE INDEX idx_orders_cust_date_nc ON orders (customer_id, created_at); Now the engine must follow each leaf TID back to the heap to fetch total_cents and status. Those 200 heap fetches may hit 200 different 8 KB pages scattered across the 120 GB table. The leaf scan is fast; the heap fetches dominate.',
        {
          type: 'table',
          headers: ['Index type', 'Leaf pages read', 'Heap pages read', 'Total I/O'],
          rows: [
            ['Covering (INCLUDE)', '2-3 sequential', '0', '2-3 pages'],
            ['Non-covering', '2-3 sequential', 'Up to 200 random', '~200 pages'],
            ['No index (seq scan)', '~15M pages', '0 (data is in-line)', '~15M pages'],
          ],
        },
        'For the export job that needs items_json for all orders in a year, the covering index cannot help -- jsonb is too large to include. The engine must fetch heap rows. If the query returns 5 million rows, the optimizer may choose a sequential scan over the index because reading the entire table once is cheaper than 5 million random heap lookups. The B+ tree is the wrong tool when the result set is a large fraction of the table.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'B+ tree role', 'Why it fits'],
          rows: [
            ['PostgreSQL', 'Default index type (btree)', 'All standard indexes use nbtree: equality, range, ORDER BY, UNIQUE constraints, foreign key checks.'],
            ['InnoDB (MySQL)', 'Clustered + secondary indexes', 'The primary key IS the table, stored as a B+ tree with rows at the leaves. Secondary indexes store PK values as row locators.'],
            ['SQLite', 'Both table and index storage', 'Every SQLite table is a B+ tree keyed by rowid. Indexes are separate B+ trees whose leaves point to rowids.'],
            ['NTFS / ext4 / HFS+', 'Directory and extent indexes', 'Filesystem metadata uses B+ trees to map filenames to inodes and file offsets to disk blocks.'],
            ['LMDB', 'Entire storage engine', 'Memory-mapped B+ tree with copy-on-write. No WAL needed -- crash consistency comes from atomic page writes to the COW tree.'],
          ],
        },
        'The B+ tree is the right choice when the workload needs any combination of: equality lookup, range scan, sorted output, prefix matching, MIN/MAX, or cursor-based pagination. It is especially dominant when the working set fits in the buffer pool (internal pages cached) and the query accesses a small, contiguous slice of the key space.',
        {
          type: 'bullets',
          items: [
            'OLTP point lookups: shallow tree + cached upper levels = 1-2 page reads per query.',
            'Time-range dashboards: seek to the start of the window, scan leaves until the window ends. Cost is proportional to the result, not the table.',
            'Cursor pagination (WHERE id > last_seen ORDER BY id LIMIT 20): seek to last_seen, advance 20 leaf slots. No OFFSET scan.',
            'Unique constraints: the B+ tree enforces uniqueness during insert by checking for an existing key before allowing the write.',
            'Composite key ordering: an index on (country, city, zip) serves lookups by country alone, country+city, or all three. It cannot serve zip-only lookups efficiently because the prefix is missing.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Every B+ tree index is a write amplification tax. An INSERT into a table with 5 indexes must update 5 separate B+ trees plus the heap, each generating WAL records. Write-heavy workloads (event logging, time-series ingestion, IoT telemetry) often prefer LSM trees, which batch writes into sorted runs and merge them later. LSM trades read amplification (checking multiple levels on lookup) for lower write amplification.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Mitigation'],
          rows: [
            ['Write amplification', 'Each index adds page writes + WAL per row insert', 'Fewer indexes; batch inserts; LSM-based engines for append-heavy workloads'],
            ['Index bloat', 'MVCC dead tuples remain in leaves until VACUUM', 'Aggressive autovacuum tuning; monitoring pg_stat_user_indexes for dead tuples'],
            ['Covering index size', 'INCLUDEd columns inflate leaf entries, reducing fanout', 'Include only columns needed by hot queries; measure index size vs. benefit'],
            ['Random-key scatter', 'UUIDs as primary keys cause random leaf inserts across the tree', 'UUIDv7 (time-ordered) or bigserial PKs; reduces split rate and improves cache locality'],
            ['Right-edge hot spot', 'Monotonic keys (auto-increment) concentrate all inserts on the rightmost leaf', 'Usually acceptable; but under extreme concurrency, the rightmost leaf lock becomes a bottleneck'],
            ['Wrong column order', 'Index on (A, B) cannot serve WHERE B = ? without scanning all A values', 'Design composite indexes with the most selective or most-filtered column first'],
          ],
        },
        'B+ trees are also the wrong tool for full-text search (inverted indexes are better), high-dimensional nearest-neighbor queries (use HNSW or IVF), and analytical scans over wide column subsets (columnar storage wins). The B+ tree optimizes for narrow, sorted, row-oriented access. Using it outside that pattern wastes I/O.',
        {
          type: 'note',
          text: 'A common production mistake: creating a B+ tree index to speed up a query that returns 30% of the table. The optimizer will ignore the index and do a sequential scan, because 30% random heap fetches cost more than one pass through the whole table. Indexes help when selectivity is high (small result / large table).',
        },
      ],
    },
    {
      heading: 'Operational maintenance',
      paragraphs: [
        'A B+ tree is not a static structure. Under sustained writes, it requires ongoing maintenance to stay efficient.',
        {
          type: 'table',
          headers: ['Operation', 'What it does', 'When to run'],
          rows: [
            ['VACUUM (PostgreSQL)', 'Removes dead MVCC tuples from leaf pages, making space for new entries', 'Continuously via autovacuum; tune autovacuum_vacuum_scale_factor for write-heavy tables'],
            ['REINDEX', 'Rebuilds the B+ tree from scratch, eliminating bloat and restoring optimal fill', 'When bloat exceeds 30-50%; requires ACCESS EXCLUSIVE lock (use CONCURRENTLY variant)'],
            ['ANALYZE', 'Updates column statistics so the optimizer knows when to use the index', 'After bulk loads or significant data changes'],
            ['Fill factor', 'Leaves space in each leaf page for future inserts (e.g., fillfactor=90)', 'Set at index creation for tables with frequent updates to clustered ranges'],
            ['Deduplication (PG 13+)', 'Compresses repeated key values in leaf entries into a single key + list of TIDs', 'Automatic; most beneficial for low-cardinality indexed columns'],
          ],
        },
        'Monitor index health with pg_stat_user_indexes (PostgreSQL) or SHOW INDEX (MySQL). Key metrics: index size relative to table size, number of index scans versus sequential scans, dead tuple count, and buffer hit ratio. An index that is never scanned is pure write overhead -- drop it.',
        {
          type: 'code',
          language: 'sql',
          body: [
            '-- PostgreSQL: find unused indexes',
            'SELECT schemaname, relname, indexrelname,',
            '       idx_scan, idx_tup_read, idx_tup_fetch,',
            '       pg_size_pretty(pg_relation_size(indexrelid)) AS size',
            '  FROM pg_stat_user_indexes',
            ' WHERE idx_scan = 0',
            ' ORDER BY pg_relation_size(indexrelid) DESC;',
            '',
            '-- PostgreSQL: check index bloat',
            'SELECT nspname, relname,',
            '       round(100 * pg_relation_size(indexrelid) /',
            '             pg_relation_size(indrelid))::int AS idx_pct_of_table',
            '  FROM pg_stat_user_indexes',
            '  JOIN pg_index USING (indexrelid)',
            ' ORDER BY pg_relation_size(indexrelid) DESC;',
          ].join('\n'),
          text: [
            '-- PostgreSQL: find unused indexes',
            'SELECT schemaname, relname, indexrelname,',
            '       idx_scan, idx_tup_read, idx_tup_fetch,',
            '       pg_size_pretty(pg_relation_size(indexrelid)) AS size',
            '  FROM pg_stat_user_indexes',
            ' WHERE idx_scan = 0',
            ' ORDER BY pg_relation_size(indexrelid) DESC;',
            '',
            '-- PostgreSQL: check index bloat',
            'SELECT nspname, relname,',
            '       round(100 * pg_relation_size(indexrelid) /',
            '             pg_relation_size(indrelid))::int AS idx_pct_of_table',
            '  FROM pg_stat_user_indexes',
            '  JOIN pg_index USING (indexrelid)',
            ' ORDER BY pg_relation_size(indexrelid) DESC;',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Bayer & McCreight, "Organization and Maintenance of Large Ordered Indexes" (1972)', 'Original B-tree paper. Introduces the wide-node idea and split algorithm.'],
            ['Douglas Comer, "The Ubiquitous B-Tree" (ACM Computing Surveys, 1979)', 'Comprehensive survey of B-tree variants including B+ trees. Covers deletion, concurrency, and variable-length keys.'],
            ['PostgreSQL nbtree source code (src/backend/access/nbtree/)', 'Production B+ tree with MVCC, deduplication, HOT chain awareness, and concurrent split protocol.'],
            ['SQLite file format documentation (sqlite.org/fileformat2.html)', 'Detailed page layout, overflow pages, cell format, and free-page management for a B+ tree engine.'],
            ['MySQL InnoDB documentation on clustered and secondary indexes', 'How InnoDB uses the primary key as the clustered B+ tree and stores PK values in secondary index leaves.'],
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Binary Search -- the within-page search that B+ tree nodes use internally'],
            ['Prerequisite', 'B-Trees -- the general balanced multi-way tree; B+ tree is the leaf-linked variant'],
            ['Extension', 'Write-Ahead Log -- crash recovery protocol that makes splits durable'],
            ['Extension', 'MVCC Internals and VACUUM -- how dead tuples accumulate in B+ tree leaves and how cleanup works'],
            ['Alternative', 'LSM Tree -- write-optimized alternative that trades read cost for lower write amplification'],
            ['Alternative', 'Adaptive Radix Tree -- trie-based index for in-memory databases that avoids key comparisons'],
            ['Case study', 'SQLite B-Tree and Pager Case Study -- full page-level walkthrough of a production B+ tree'],
            ['Case study', 'PostgreSQL HOT Update Heap-Only Tuple -- optimization that avoids updating the B+ tree index when non-indexed columns change'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain why all data lives at the leaves and not at internal nodes, in terms of range scan cost?',
            'If a B+ tree has fanout 300 and 27 million leaf entries, how many page reads does a point lookup require? (Answer: log_300(27M) ~ 3.)',
            'What happens to a range scan cursor if the leaf it is reading splits during the scan? Why does the sibling chain prevent key loss?',
            'Why does a covering index avoid heap fetches, and what is the cost of making the index covering?',
            'When would you choose an LSM tree over a B+ tree, and what read-side cost do you accept?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Draw a B+ tree with fanout 3 (each internal node holds at most 2 separators) and insert keys 10, 20, 5, 15, 25, 30, 12, 18 in that order. After each insert, verify the three invariants: all data at leaves, leaves in sorted order via sibling links, all leaves at the same depth. Predict when each split occurs and which separator is copied to the parent.',
        'Then simulate the range query "all keys between 12 and 25." Trace the descent to the first matching leaf, then walk the sibling chain. Count total page reads. Compare this to the cost of doing 14 separate point lookups (one for each integer in [12..25]).',
        'Run the animation in all three views and confirm your hand-traced split sequence matches the split audit view. If a frame surprises you, re-examine which invariant you missed.',
      ],
    },
  ],
};
