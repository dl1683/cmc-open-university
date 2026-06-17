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
      heading: 'Why B+ trees exist',
      paragraphs: [
        'A B+ tree is the ordered index shape that makes databases good at equality lookup, range lookup, and ordered traversal over page-sized storage. It exists because a binary search tree is the wrong mental model for disk and buffer pools. A binary tree makes one small decision per node. A database page can hold hundreds of keys, so one page read should narrow the search across hundreds of ranges.',
        'The B+ tree separates routing from data. Internal pages store separator keys and child pointers. Leaf pages store the actual index entries. The leaves are linked to neighboring leaves in key order. That combination gives two important operations: a point lookup descends through a shallow high-fanout tree, and a range scan descends once then walks leaf siblings.',
        'The leaf sibling chain is not a decorative addition. It is why an index can serve queries like customer_id = 17, created_at BETWEEN Monday and Friday, ORDER BY created_at LIMIT 50, and cursor-based pagination. After the first seek, the cursor can move through sorted leaf pages without returning to the root for every row.',
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        'The naive way to support lookup is a sorted array. Binary search finds a key quickly, but insertion in the middle requires shifting entries, and the array does not naturally scale across pages. Another naive approach is a pointer-heavy binary search tree. It supports updates, but it wastes page locality and becomes too tall. A million entries should not require roughly twenty scattered node reads when a few page reads can do the job.',
        'The naive way to support a range query is repeated point lookup: find the first key, then search again for the next key, and so on. That throws away the sorted-page advantage. A database range cursor should seek once, then advance through adjacent entries. B+ tree leaves make that possible because the next leaf pointer is part of the index structure.',
        'The wall is page movement. A real database index lives in fixed-size pages under a buffer manager and write-ahead log. The structure must handle inserts, deletes, splits, recovery, and concurrent readers while preserving sorted order. The B+ tree is the practical answer to that page-level problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Search begins at the root. Each internal page contains sorted separator keys. The engine compares the search key against those separators and chooses one child pointer. It repeats this decision until it reaches a leaf. In the leaf, it searches the entries and either finds a matching key or proves the key is absent from that leaf range.',
        'All leaves stay at the same depth. This balance property gives predictable lookup cost. The cost is not O(log base 2 n) in practice. The base is page fanout. If an internal page can route among hundreds of child ranges, a very large table may need only a root page, one or two internal pages, and a leaf page. Buffer pools often keep upper levels hot, so many lookups pay mostly for the leaf and table row.',
        'A secondary index leaf usually stores the indexed key plus a row locator. In PostgreSQL this might be a tuple identifier. In InnoDB secondary indexes, the leaf contains primary-key columns used to find the clustered row. A covering index stores enough selected columns in the leaf entry to answer a query without fetching the base row. That distinction often matters more than the tree height.',
      ],
    },
    {
      heading: 'Leaf sibling scans',
      paragraphs: [
        'A range scan starts like a point lookup. For a predicate such as WHERE customer_id = 42 AND created_at >= June 1, the engine descends to the first leaf slot that can contain the lower bound. From there, it advances within the leaf, emits matching entries, and follows the next-leaf link when the current page ends. It stops when the key exceeds the upper bound or the prefix changes.',
        'This is why key order matters. An index on (customer_id, created_at) is good for all invoices for one customer in a time window because matching entries are adjacent. An index on (created_at, customer_id) has a different order; it is better for time-window scans across customers. B+ trees do not magically solve ordering mistakes. They make the chosen order efficient.',
        'The scan may still be slow if the index is not covering. The leaf walk can be sequential and cheap, while row fetches are scattered and expensive. A query that returns 50 rows may be fine. A query that returns 500,000 rows from a secondary index may become dominated by heap or clustered-row lookups. The B+ tree solves ordered discovery, not every downstream access cost.',
      ],
    },
    {
      heading: 'Splits and publication',
      paragraphs: [
        'Insertion descends to the target leaf. If the leaf has room, the engine inserts the new entry in sorted position. If the leaf is full, it splits the page. Lower keys remain in the old page. Upper keys move to a new right sibling. The sibling links are repaired so scans can move from old page to new page to the previous next page. A separator key from the new right page is copied into the parent so future searches can route directly.',
        'Parent pages can split too. If the parent has no room for the new separator, it splits and pushes another separator upward. A root split creates a new root and increases tree height by one. Because fanout is high, root splits are rare compared with leaf updates, but the algorithm must handle them cleanly.',
        'Crash-safe publication is the hard part. The system must log enough information to recover the split. It must not leave a newly created leaf unreachable. It must not let a range scan skip keys because a sibling link was repaired in the wrong order. It must not let a parent route searches to a page that does not contain the advertised range. The sorted-array move is simple; the storage-engine protocol around it is the real work.',
      ],
    },
    {
      heading: 'Concrete case study',
      paragraphs: [
        'Consider a billing table with columns customer_id, invoice_date, invoice_id, amount, status, and a large JSON audit payload. The product dashboard needs the last 90 days of invoices for one customer, ordered by date, showing amount and status. An index on (customer_id, invoice_date) INCLUDE (amount, status) fits the access pattern. The engine seeks to the first matching leaf entry, follows leaf siblings while the customer and date range match, and returns the displayed columns directly from the index.',
        'The same index is weaker for an export job that selects the audit payload for every invoice in the year. The B+ tree still finds matching row locators in order, but now each entry requires a base-table fetch. If the table is not clustered by the same order, those fetches may be scattered. The right answer may be a different covering index, a clustered layout, a columnar export path, or a batch job that avoids using a narrow OLTP index as a bulk data pipeline.',
        'A write-heavy tenant adds the maintenance side. New invoices for the same customer range repeatedly modify nearby leaves. Fill factor can leave room for growth. Deduplication can reduce repeated keys in some engines. Vacuum or bottom-up deletion can remove stale MVCC entries. Monitoring needs to track page splits, bloat, index-only scan rate, heap fetch count, and whether the buffer pool keeps upper pages hot.',
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        'The first tradeoff is read speed versus write cost. Every extra B+ tree index makes some reads faster and every write more expensive. Inserts and updates must maintain each affected index. Splits add page writes. WAL volume increases. Cache pressure increases because more pages compete for memory.',
        'The second tradeoff is covering power versus size. Adding included columns can avoid heap fetches, but larger leaf entries reduce fanout and increase write cost. Cover everything and the index becomes a second copy of the table. Cover nothing and range scans may drown in random row lookups.',
        'The third tradeoff is operational aging. Deletes and updates can leave dead index entries until cleanup. Poor fill factor can cause frequent splits. Monotonic keys can create right-edge hot spots. Random keys can scatter writes. A B+ tree is a living structure, not a static textbook diagram.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary engine references are PostgreSQL B-tree index documentation, PostgreSQL index type documentation, SQLite file format and B-tree module documentation, and MySQL InnoDB clustered and secondary index documentation. Read them with page roles in mind: root pages, internal pages, leaf pages, sibling links, row locators, splits, and recovery.',
        'Next topics in this curriculum: B-Trees, Binary Search, Database Indexing, SQLite B-Tree & Pager Case Study, PostgreSQL HOT Update Heap-Only Tuple, Write-Ahead Log, MVCC Internals & VACUUM, B-Epsilon Tree Write-Optimized Index, Bw-Tree Delta Chain & Mapping Table, LSM Tree, LSM Compaction Strategies Primer, Adaptive Radix Tree, ALEX Adaptive Learned Index, and Block Range Index Zone Maps.',
      ],
    },
  ],
};
