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
        'Read the tree as two structures layered together. Internal nodes are routing pages: they hold separator keys that tell a search which child page to read next. Leaf nodes are data pages: they hold the sorted entries and sibling pointers that make range scan a sequential walk.',
        'The safe inference rule is this: once descent reaches the first leaf that can contain the lower bound, the parent path is no longer needed for the rest of the range. The sibling pointer preserves key order across leaves, so the scan can move right until it passes the upper bound.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A database index has to answer two different questions. Point lookup asks for one key, such as user_id = 42. Range scan asks for many ordered keys, such as all events between 10:00 and 10:05, and the second question is where many simple structures break.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Cylinder_Head_Sector.svg',
          alt: 'Hard disk drive platter layout showing cylinders, heads, and sectors',
          caption: 'The physical constraint behind B+ trees: disk reads transfer entire sectors and pages. Each I/O operation that does not contribute to the answer is wasted mechanical movement. Source: Wikimedia Commons.',
        },,
              {
          type: 'callout',
          text: 'A B+ tree exists because no simpler structure solves both point lookups and range scans at page granularity. It separates routing keys from data, keeps all data at the leaves, and links leaves for sequential traversal.',
        },,
        'A page is the unit a storage engine reads and writes, often 4 KB, 8 KB, or 16 KB. The B+ tree is designed around that page fact. It packs many routing decisions into one page and keeps data leaves linked so nearby keys are cheap to read together.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious in-memory answer is a binary search tree. Each node stores one key and points left or right. It preserves sorted order and supports predecessor, successor, and range logic.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Binary_search_tree.svg',
          alt: 'A binary search tree with 9 nodes rooted at 8',
          caption: 'A binary search tree: each node holds one key and two child pointers. The shape is compact in diagrams but wasteful on disk -- a 4 KB page that could hold 200 keys stores just one. Source: Wikimedia Commons.',
        },,
        'The other obvious answer is a hash table. Hashing is excellent for exact lookup because a key maps directly to a bucket. It does not preserve key order, so it has no cheap way to scan key 100 through key 500 in sorted order.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg',
          alt: 'Hash table with chaining showing keys mapped through a hash function to buckets',
          caption: 'A hash table with separate chaining. It provides O(1) point lookups but has no concept of key ordering -- range scans, ORDER BY, and prefix queries are impossible. Source: Wikimedia Commons.',
        },,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is page behavior. A binary tree might need one page read per level, and each page may contain only one useful key if the structure is stored naively. For ten million rows, a tall pointer-heavy tree wastes I/O on routing rather than answers.',
              {
          type: 'callout',
          text: 'The wall is the combination: an index must be wide (high fanout for shallow lookup), sorted (for range scans), and mutable (for online inserts and deletes) -- all at page granularity. The B+ tree is the structure that satisfies all three.',
        },,
        'Hashing hits a different wall. It can find key 42, but it cannot tell what key comes next without scanning unrelated buckets. SQL range predicates, ORDER BY, prefix search, pagination, and merge joins need ordered movement, not just membership.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate navigation from data. Internal pages store only separator keys and child pointers, so they are wide and shallow. Leaf pages store all data entries in sorted order, and each leaf points to its next leaf.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Bplustree.png',
          alt: 'B+ tree structure showing internal nodes with search keys and leaf nodes linked together',
          caption: 'A B+ tree with branching factor 4. Internal nodes hold separator keys for routing; leaf nodes hold data pointers and are linked left-to-right for sequential scan. This linked-leaf structure is the defining difference from a plain B-tree. Source: Wikimedia Commons.',
        },,
        'This makes point lookup and range scan share the same first step. Descend through the internal pages to the first relevant leaf. Then either read one entry for a point lookup or keep walking leaf siblings for a range.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'B-tree with three levels showing internal node key routing and leaf nodes',
          caption: 'A B-tree showing the multi-way branching structure. Each node holds multiple keys and child pointers, packing far more routing decisions into a single page read than a binary tree ever could. In a B+ tree variant, all data entries move down to the leaves and the leaves gain sibling pointers. Source: Wikimedia Commons.',
        },,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Search starts at the root page. Within each internal page, binary search or a small linear scan finds the child interval that can contain the key. The process repeats until it reaches a leaf page.',
              {
          type: 'callout',
          text: 'The sibling chain is not optional -- it is the correctness backstop. Even if the parent has not yet learned about a new leaf after a crash, a sequential scan through the leaf chain will still visit every key.',
        },,
        'For a range query, the leaf search finds the first key greater than or equal to the lower bound. The scan reads entries in that leaf, follows the next-leaf pointer, and stops as soon as a key exceeds the upper bound. The parent pages do not participate in the middle of the scan.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/66/B%2B-tree-organization.png',
          alt: 'B+ tree organization showing root, internal nodes, and leaf node relationships',
          caption: 'B+ tree organization: the root and internal nodes form a routing hierarchy, while the leaf level holds all data entries linked in key order. A split preserves depth uniformity -- the tree grows at the root, not at the leaves. Source: Wikimedia Commons.',
        },,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The routing invariant is that each child page owns a contiguous key interval. Separator keys in the parent divide those intervals, so descent never discards a possible matching key. The leaf invariant is stronger: all data entries live at the same depth and leaves are linked in sorted order.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/LSM_Tree.png',
          alt: 'Log-structured merge tree showing memtable and progressively larger sorted run levels with compaction',
          caption: 'An LSM tree: the write-optimized alternative to B+ trees. Writes go to an in-memory buffer (memtable), then flush to sorted runs on disk. Compaction merges runs to maintain read performance. LSM trades read amplification for lower write amplification. Source: Wikimedia Commons.',
        },,
        'A split preserves correctness by dividing one sorted page into two sorted pages and publishing a separator for future searches. If recovery or concurrency temporarily exposes a right sibling before the parent is fully updated, the sibling link still lets a scan move through the complete sorted sequence. That is why the leaf chain is a correctness mechanism, not just an optimization.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost is dominated by page reads. With fanout 200, a three-level tree can address about 200 * 200 * 200 = 8,000,000 leaf slots before needing another level. Doubling rows often does not change height; it mostly adds leaf pages and occasional splits.',
              {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/PostgreSQL_B-tree.svg',
          alt: 'PostgreSQL B-tree index structure showing hierarchical node organization',
          caption: 'PostgreSQL B-tree index structure, based on the Lehmann-Yao concurrent access protocol. In a real system like PostgreSQL, the B+ tree is not just a textbook diagram -- it must handle concurrent readers, writers, and crash recovery simultaneously. Source: Wikimedia Commons.',
        },,
        'Point lookup costs about tree height plus the data fetch if the index is not covering. Range scan costs height to find the first leaf plus the number of leaf pages in the range. Inserts pay search cost, write cost, and sometimes split propagation to parents.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'B+ trees are the default shape for database indexes when ordered access matters. They support equality lookup, range predicates, prefix queries, ordered pagination, merge joins, uniqueness checks, and index-only scans. The access pattern is many small searches plus occasional ordered scans.',
        'File systems and key-value stores use the same idea when they need sorted metadata or directory entries. The structure fits storage because it turns many comparisons into a few page reads. It also lets hot upper pages stay cached while cold leaves move in and out of memory.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'B+ trees are not free for write-heavy workloads. Random inserts dirty leaf pages across the key space, cause page splits, and create write amplification through logging and rebalancing. If writes arrive mostly in key order, the tree behaves much better because the hot edge absorbs most inserts.',
              {
          type: 'callout',
          text: 'A covering index eliminates heap fetches entirely. The leaf entries carry enough data to answer the query without ever touching the base table. This turns a 200-random-read problem into a 2-3 sequential page scan.',
        },,
        'They also fail when exact lookup is the only operation and memory is abundant. A hash table can be faster for that narrow case. B+ trees earn their complexity when order, scans, and storage pages are part of the problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume 16 KB pages, 32-byte internal entries, and 80-byte leaf entries. An internal page can hold about 500 child separators, while a leaf holds about 200 data entries. One root, one internal level, and leaf pages can cover roughly 500 * 500 * 200 = 50,000,000 rows.',
        'Now query keys from 1,000,000 to 1,000,399, which is 400 ordered rows. Descent reads root, one internal page, and the first leaf: three page reads if nothing is cached. The range then spans about two leaf pages, so the full scan can be five page reads before heap fetches.',
        'Compare that with 400 separate point lookups. Even if the root and internal page stay cached, each lookup may revisit leaf routing and fetch scattered heap rows. The sibling scan wins because it turns many independent searches into one descent followed by sequential leaf movement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bayer and McCreight on B-trees, Lehman and Yao on concurrent B-link trees, PostgreSQL nbtree documentation and source comments, and storage-engine texts that discuss page layout and recovery. Read them with page reads in mind, not just asymptotic comparisons.',
        'Study next by role. For write-heavy alternatives, study LSM trees and compaction. For database execution, study covering indexes, clustered indexes, and merge joins. For correctness, study write-ahead logging, latch coupling, and B-link tree right-sibling protocols.',
      ],
    },
  ],
};
