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
      heading: 'What it is',
      paragraphs: [
        'A B+ tree is the page-oriented ordered index used by many database engines. It is closely related to the B-tree primer, but the production mental model is sharper: internal pages store separator keys and child pointers, while leaf pages store the actual index entries and links to adjacent leaves.',
        'That leaf chain is the signature feature. A point lookup descends through high-fanout pages to one leaf. A range query descends once to the lower bound, then walks leaf siblings in key order. This is why the same index can support WHERE user_id = 42, ORDER BY created_at, and BETWEEN time windows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Search starts at the root. Each internal page uses the sorted separators to choose one child range. The engine repeats that decision until it reaches a leaf, then searches the leaf entries. In a secondary index, the leaf entry usually stores the indexed key plus a row pointer or primary-key value. In a covering index, the leaf can store enough columns to answer the query without visiting the table.',
        'Range scans reuse the first descent. Once the cursor reaches the first matching leaf slot, it advances inside that leaf and then follows the next-leaf pointer. The upper tree is not revisited for every key. This is the practical advantage over a plain binary search tree drawing: database cursors move through pages, not isolated nodes.',
        'Insertion descends to a leaf. If the page has room, the entry is inserted in sorted position. If it is full, the leaf splits: lower keys stay, upper keys move to a new right sibling, sibling links are repaired, and the first key of the new right page is copied into the parent as a separator. Parent pages can split too, and a root split adds a level.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Asymptotically, search is O(log_f n), where f is page fanout. In practice the important unit is page touches. A high-fanout page makes the tree shallow, so lookup cost is root page, a few internal pages, then a leaf. Range scans add mostly sequential leaf reads, which storage devices and buffer pools handle far better than scattered heap fetches.',
        'The hidden costs are writes, recovery, and stale entries. Every secondary index adds work to INSERT and UPDATE. Splits create extra page writes and may cascade upward. MVCC systems can leave old index tuples behind until cleanup. Crash safety requires WAL or an equivalent protocol so a page split cannot leave an unreachable leaf or a parent separator pointing nowhere.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a SaaS billing table with an index on (customer_id, invoice_date) INCLUDE (amount, status). The customer dashboard asks for the last 90 days of invoices for one customer. The B+ tree descends to the first (customer_id, invoice_date) leaf entry, follows leaf siblings while the customer and date bound still match, and returns amount and status directly from the leaf. No heap fetch is needed for the dashboard list.',
        'The same design can fail if the dashboard also selects a large JSON payload that is not in the index. The index scan is still ordered, but every invoice row now needs a table lookup. If the matching invoices are scattered, latency becomes random IO and buffer-pool misses. The fix might be a narrower result set, a covering INCLUDE column, clustering, or a different storage model, not merely "add another index."',
        'A write-heavy tenant adds the other half of the case study. New invoices append near the hot end of that tenant-date range, causing repeated leaf modifications and occasional splits. Fill factor leaves growth room; WAL protects split ordering; vacuum or bottom-up deletion controls old row versions; and monitoring has to watch page splits, bloat, index-only scan hit rate, and heap fetch count.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A B+ tree is not automatically a covering index. If the query needs columns absent from the leaf entry, the engine still has to visit table rows. It is also not free to maintain. Every extra index increases write amplification, cache pressure, WAL volume, and lock or latch traffic.',
        'Another misconception is that range scans are just repeated point lookups. A good B+ tree cursor seeks once and then follows leaves. If an implementation had to descend from root for every returned row, it would throw away the core advantage of sibling-linked leaves.',
      ],
    },
    {
      heading: 'Sources and engine details',
      paragraphs: [
        'PostgreSQL documents B-tree indexes as multi-level balanced tree structures. Its implementation notes describe leaf pages, internal pages, doubly linked pages at each level, page splits, cascading parent updates, bottom-up deletion, and deduplication: https://www.postgresql.org/docs/current/btree.html. The index-types page explains why B-tree indexes are the default fit for equality, range comparisons, and ordered retrieval: https://www.postgresql.org/docs/current/indexes-types.html.',
        'SQLite exposes the page-level view in its file format and B-tree module docs: tables and indexes are B-trees over database pages, with page cells, interior pages, leaf pages, and a pager layer underneath: https://www.sqlite.org/fileformat.html and https://sqlite.org/btreemodule.html. MySQL InnoDB documents the clustered-index and secondary-index distinction, including the fact that secondary index records contain primary-key columns used to find clustered rows: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Start with B-Trees for the core split invariant, Binary Search for in-page lookup, and Database Indexing for full scan versus index scan versus covering index. Then study SQLite B-Tree & Pager Case Study, MySQL InnoDB Clustered Index, PostgreSQL HOT Update Heap-Only Tuple, MVCC Internals & VACUUM, and Write-Ahead Log to see the same structure inside real storage engines.',
        'For alternatives, compare Bw-Tree Delta Chain & Mapping Table, B-Epsilon Tree Write-Optimized Index, LSM Tree, LSM Compaction Strategies Primer, SSTable Block Index & Filter, Adaptive Radix Tree, ALEX Adaptive Learned Index, Block Range Index Zone Maps, and Filesystem Extent Tree & Delayed Allocation.',
      ],
    },
  ],
};
