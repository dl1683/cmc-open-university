// PostgreSQL HOT updates: heap-only tuple chains, stable index pointers,
// same-page free space, fillfactor, pruning, visibility-map effects, and stats.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-hot-update-heap-only-tuple-case-study',
  title: 'PostgreSQL HOT Update Heap-Only Tuple',
  category: 'Systems',
  summary: 'How PostgreSQL HOT updates keep secondary indexes stable when an update changes no indexed column and the new tuple version fits on the same heap page.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['HOT chain', 'free space', 'index bloat'], defaultValue: 'HOT chain' },
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

function hotGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'idx', label: 'index', x: 0.7, y: 4.0, note: notes.idx ?? 'ctid' },
      { id: 'lp1', label: 'LP1', x: 2.3, y: 4.0, note: notes.lp1 ?? 'root' },
      { id: 'old', label: 'old', x: 4.0, y: 2.4, note: notes.old ?? 'xmax' },
      { id: 'new', label: 'new', x: 4.0, y: 5.6, note: notes.new ?? 'xmin' },
      { id: 'page', label: 'page', x: 5.8, y: 4.0, note: notes.page ?? 'same' },
      { id: 'free', label: 'free', x: 7.2, y: 2.4, note: notes.free ?? 'room' },
      { id: 'prune', label: 'prune', x: 7.2, y: 5.6, note: notes.prune ?? 'local' },
      { id: 'vm', label: 'VM', x: 8.8, y: 4.0, note: notes.vm ?? 'bits' },
      { id: 'vac', label: 'vac', x: 9.8, y: 4.0, note: notes.vac ?? 'later' },
    ],
    edges: [
      { id: 'e-idx-lp1', from: 'idx', to: 'lp1', weight: 'points' },
      { id: 'e-lp1-old', from: 'lp1', to: 'old', weight: 'root' },
      { id: 'e-old-new', from: 'old', to: 'new', weight: 'ctid' },
      { id: 'e-new-page', from: 'new', to: 'page', weight: 'on page' },
      { id: 'e-page-free', from: 'page', to: 'free', weight: 'needs' },
      { id: 'e-page-prune', from: 'page', to: 'prune', weight: 'clean' },
      { id: 'e-prune-vm', from: 'prune', to: 'vm', weight: 'prove' },
      { id: 'e-vm-vac', from: 'vm', to: 'vac', weight: 'skip' },
    ],
  }, { title });
}

function* hotChain() {
  yield {
    state: hotGraph('HOT keeps the index pointer on the root line pointer'),
    highlight: { active: ['idx', 'lp1', 'old', 'e-idx-lp1', 'e-lp1-old'], found: ['new'], compare: ['free'] },
    explanation: 'A normal secondary index points to a heap TID: page plus line pointer. A HOT update can keep that external index entry pointing at the root line pointer while newer heap-only versions are found by following a same-page tuple chain.',
    invariant: 'HOT is possible only when indexed columns stay unchanged and the new tuple fits on the same heap page.',
  };

  yield {
    state: labelMatrix(
      'HOT gates',
      [
        { id: 'idxcol', label: 'idx col' },
        { id: 'space', label: 'space' },
        { id: 'page', label: 'page' },
        { id: 'brin', label: 'BRIN' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['same', 'new idx'],
        ['room', 'offpage'],
        ['same', 'move'],
        ['ok', 'summary'],
      ],
    ),
    highlight: { active: ['idxcol:need', 'space:need', 'page:need'], compare: ['idxcol:fail'], found: ['brin:need'] },
    explanation: 'The two practical gates are simple: do not change columns referenced by ordinary indexes, and leave enough free space on the old heap page. BRIN is a summarizing index and has special handling in current PostgreSQL docs.',
  };

  yield {
    state: hotGraph('The new tuple version is heap-only on the same page', { old: 'HOT_UPD', new: 'HEAP_ONLY', page: 'blk 42', free: 'used' }),
    highlight: { active: ['old', 'new', 'page', 'e-old-new', 'e-new-page'], found: ['idx', 'lp1'], compare: ['free'] },
    explanation: 'The old tuple links forward to the new tuple. The new tuple is heap-only: no secondary index entry points directly to it. Readers enter through the indexed root and follow the chain to the visible version.',
  };

  yield {
    state: labelMatrix(
      'Read path',
      [
        { id: 'idx', label: 'index' },
        { id: 'root', label: 'root' },
        { id: 'chain', label: 'chain' },
        { id: 'snap', label: 'snap' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'why', label: 'why' },
      ],
      [
        ['find LP1', 'stable'],
        ['old row', 'link'],
        ['walk', 'newer'],
        ['test', 'visible'],
      ],
    ),
    highlight: { active: ['idx:step', 'root:why', 'chain:step'], found: ['snap:step'] },
    explanation: 'An index scan still reaches the heap. The difference is that the index does not need one entry per update version. The heap page carries the version chain and the snapshot test chooses the visible tuple.',
  };

  yield {
    state: hotGraph('Page pruning can remove dead heap-only versions locally', { old: 'dead', new: 'live', prune: 'prune', vm: 'maybe set', vac: 'less work' }),
    highlight: { active: ['old', 'new', 'page', 'prune', 'e-page-prune'], found: ['vm', 'vac'], compare: ['idx'] },
    explanation: 'HOT also enables local cleanup. Once old heap-only versions are dead, page pruning can reclaim their space without adding table-wide index cleanup work for every version.',
  };
}

function* freeSpace() {
  yield {
    state: labelMatrix(
      'Page layout',
      [
        { id: 'hdr', label: 'header' },
        { id: 'lp', label: 'LPs' },
        { id: 'free', label: 'free' },
        { id: 'tup', label: 'tuples' },
      ],
      [
        { id: 'grows', label: 'grows' },
        { id: 'job', label: 'job' },
      ],
      [
        ['fixed', 'meta'],
        ['front', 'ctid'],
        ['middle', 'room'],
        ['back', 'rows'],
      ],
    ),
    highlight: { active: ['free:job', 'lp:job'], found: ['tup:job'] },
    explanation: 'A PostgreSQL heap page has stable line pointers at the front, tuple data from the back, and free space between them. HOT needs enough middle free space to place the updated tuple on the same page.',
  };

  yield {
    state: hotGraph('Fillfactor reserves room for future same-page updates', { page: '90 pct', free: 'reserve', new: 'fits' }),
    highlight: { active: ['page', 'free', 'new', 'e-page-free', 'e-new-page'], found: ['idx'] },
    explanation: 'A lower table fillfactor leaves headroom on each page. That costs table size up front, but it gives UPDATE a chance to keep the new tuple version on the old page and stay HOT.',
  };

  yield {
    state: labelMatrix(
      'Fillfactor trade',
      [
        { id: '100', label: '100' },
        { id: '90', label: '90' },
        { id: '80', label: '80' },
        { id: '60', label: '60' },
      ],
      [
        { id: 'room', label: 'room' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['none', 'dense'],
        ['some', 'ok'],
        ['more', 'bigger'],
        ['lots', 'waste'],
      ],
    ),
    highlight: { active: ['90:room', '80:room'], compare: ['100:room', '60:cost'] },
    explanation: 'Fillfactor is not a magic low-is-better knob. Too high leaves no HOT room. Too low wastes cache and disk. The right value depends on update size, update frequency, and page density.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'fill', min: 60, max: 100 }, y: { label: 'pct', min: 0, max: 100 } },
      series: [
        { id: 'hot', label: 'HOT', points: [{ x: 60, y: 92 }, { x: 70, y: 88 }, { x: 80, y: 76 }, { x: 90, y: 48 }, { x: 100, y: 12 }] },
        { id: 'density', label: 'density', points: [{ x: 60, y: 60 }, { x: 70, y: 70 }, { x: 80, y: 80 }, { x: 90, y: 90 }, { x: 100, y: 100 }] },
      ],
      markers: [
        { id: 'sweet', x: 80, y: 76, label: 'tune' },
      ],
    }),
    highlight: { active: ['hot', 'sweet'], compare: ['density'] },
    explanation: 'The tuning target is workload-specific: raise HOT update ratio without paying too much density loss. Measure n_tup_hot_upd against total updates instead of guessing.',
  };

  yield {
    state: labelMatrix(
      'Observe it',
      [
        { id: 'hot', label: 'hot upd' },
        { id: 'upd', label: 'updates' },
        { id: 'dead', label: 'dead' },
        { id: 'fsm', label: 'FSM' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'signal', label: 'signal' },
      ],
      [
        ['stats', 'ratio'],
        ['stats', 'denom'],
        ['stats', 'bloat'],
        ['map', 'room'],
      ],
    ),
    highlight: { active: ['hot:signal', 'upd:signal'], found: ['fsm:signal'], compare: ['dead:signal'] },
    explanation: 'The operational loop is measurable: watch table stats for HOT ratio and dead tuples, and inspect free-space map/page samples when deciding whether fillfactor or schema changes will help.',
  };
}

function* indexBloat() {
  yield {
    state: labelMatrix(
      'Update cost',
      [
        { id: 'hot', label: 'HOT' },
        { id: 'cold', label: 'cold' },
        { id: 'idxchg', label: 'idx chg' },
        { id: 'nospace', label: 'no room' },
      ],
      [
        { id: 'heap', label: 'heap' },
        { id: 'index', label: 'index' },
      ],
      [
        ['chain', 'reuse'],
        ['new row', 'new ptr'],
        ['new row', 'all idx'],
        ['offpage', 'new ptr'],
      ],
    ),
    highlight: { active: ['hot:heap', 'hot:index'], compare: ['idxchg:index', 'nospace:index'] },
    explanation: 'A HOT update avoids redundant secondary index entries. If an indexed column changes or the new tuple cannot stay on page, PostgreSQL must update indexes to point at the new tuple location.',
  };

  yield {
    state: hotGraph('Index churn is the hidden cost HOT avoids', { idx: '1 entry', old: 'dead', new: 'live', prune: 'reuse', vac: 'less idx' }),
    highlight: { active: ['idx', 'lp1', 'old', 'new'], found: ['prune', 'vac'], compare: ['free'] },
    explanation: 'Secondary indexes are often the expensive part of a high-update table. HOT keeps the index fanout stable when the logical key is unchanged, reducing write amplification and later index vacuum work.',
  };

  yield {
    state: labelMatrix(
      'VM impact',
      [
        { id: 'before', label: 'before' },
        { id: 'update', label: 'update' },
        { id: 'prune', label: 'prune' },
        { id: 'vac', label: 'vac' },
      ],
      [
        { id: 'vm', label: 'VM' },
        { id: 'scan', label: 'scan' },
      ],
      [
        ['all vis', 'idx only'],
        ['clear', 'heap hit'],
        ['clean', 'maybe'],
        ['set', 'idx only'],
      ],
    ),
    highlight: { active: ['update:vm', 'vac:vm'], found: ['before:scan'], compare: ['update:scan'] },
    explanation: 'Updates clear visibility-map certainty for the affected page. Vacuum or pruning later proves visibility again. That is why high-update tables can lose index-only scan benefits even when the index covers the query.',
  };

  yield {
    state: labelMatrix(
      'Complete case',
      [
        { id: 'table', label: 'orders' },
        { id: 'safe', label: 'status' },
        { id: 'bad', label: 'email' },
        { id: 'fix', label: 'fix' },
        { id: 'gate', label: 'gate' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'result', label: 'result' },
      ],
      [
        ['idx id', 'ok'],
        ['not idx', 'HOT'],
        ['idx', 'cold'],
        ['fill 80', 'room'],
        ['HOT pct', 'ship'],
      ],
    ),
    highlight: { active: ['safe:result', 'fix:result'], compare: ['bad:result'], found: ['gate:result'] },
    explanation: 'Case study: an orders table updates status frequently but queries by order_id and customer_id. If status is not indexed and pages have room, those status updates can be HOT. Indexing status for a rarely used dashboard may destroy that win.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'hr', min: 0, max: 8 }, y: { label: 'writes', min: 0, max: 900 } },
      series: [
        { id: 'heap', label: 'heap', points: [{ x: 0, y: 120 }, { x: 2, y: 260 }, { x: 4, y: 420 }, { x: 6, y: 600 }, { x: 8, y: 760 }] },
        { id: 'idx', label: 'idx', points: [{ x: 0, y: 110 }, { x: 2, y: 140 }, { x: 4, y: 180 }, { x: 6, y: 220 }, { x: 8, y: 260 }] },
        { id: 'dead', label: 'dead', points: [{ x: 0, y: 20 }, { x: 2, y: 70 }, { x: 4, y: 130 }, { x: 6, y: 190 }, { x: 8, y: 240 }] },
      ],
      markers: [
        { id: 'gate', x: 8, y: 260, label: 'ok' },
      ],
    }),
    highlight: { active: ['idx', 'dead', 'gate'], compare: ['heap'] },
    explanation: 'The release gate should show index writes flattening relative to heap updates, HOT ratio rising, and dead tuple pressure staying within autovacuum capacity.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'HOT chain') yield* hotChain();
  else if (view === 'free space') yield* freeSpace();
  else if (view === 'index bloat') yield* indexBloat();
  else throw new InputError('Pick a PostgreSQL HOT update view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'PostgreSQL uses MVCC, so an UPDATE normally creates a new tuple version rather than overwriting the old row in place. If every update also adds fresh entries to every secondary index, a high-update table pays write amplification twice: once in the heap and again across its indexes.',
        'A HOT update is PostgreSQLs page-local escape hatch. When an UPDATE does not change columns referenced by ordinary indexes and the new tuple version fits on the same heap page, PostgreSQL can avoid adding new secondary index entries. The index keeps pointing at the root heap line pointer, and readers follow the on-page version chain to the visible tuple.',
        'PostgreSQL documents HOT directly: it is possible when indexed columns are unchanged and there is enough free space on the page containing the old row. The same page-locality rule is the data-structure heart of the feature: https://www.postgresql.org/docs/current/storage-hot.html.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Separate logical identity from tuple version storage. The secondary index entry points to a stable root line pointer. New versions that do not affect indexed values can live behind that root inside the same heap page. The heap page carries the version chain; the index does not need to know every version.',
        'That is why HOT has two hard gates. If an indexed value changes, the old index entry no longer represents the new row and a new index entry is required. If the new tuple cannot fit on the same page, the stable root pointer cannot reach it through a local chain.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the HOT-chain view, follow the index pointer to the root line pointer, then follow the tuple chain on the heap page. The important fact is that no secondary index points directly at the heap-only successor.',
        'In the free-space and index-bloat views, read the page as the constraint. Fillfactor leaves room for future tuple versions. If that room exists and indexed columns stay unchanged, PostgreSQL can keep index fanout stable while the heap page handles version churn.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The heap page matters. PostgreSQL page layout uses item identifiers, also called line pointers, that remain stable long enough to act as CTID targets; a CTID is page number plus item identifier. Tuple bytes can move within the page while the item identifier remains the reference point: https://www.postgresql.org/docs/current/storage-page-layout.html.',
        'HOT turns that stability into an update chain. The secondary index points to the root line pointer. The old tuple links to the heap-only successor through its tuple id. Because no index points directly at the successor, page pruning can later reclaim dead heap-only versions locally.',
        'Snapshot visibility still decides which version a reader sees. HOT does not weaken MVCC. It changes the physical route from an index entry to the visible version, keeping the chain local enough that PostgreSQL can prune dead versions without cleaning secondary index entries for every update.',
      ],
    },
    {
      heading: 'Free space and fillfactor',
      paragraphs: [
        'HOT needs room on the old page. PostgreSQL CREATE TABLE fillfactor reserves page space for updates when set below 100, making same-page updates more likely: https://www.postgresql.org/docs/current/sql-createtable.html. The tradeoff is density: lower fillfactor can improve update locality but increases table size and cache footprint.',
        'The Free Space Map records available space per heap or index page in a tree-like side structure, so PostgreSQL can find pages with room: https://www.postgresql.org/docs/current/storage-fsm.html. HOT tuning should watch observed HOT ratio and dead tuples, not rely on a universal fillfactor.',
      ],
    },
    {
      heading: 'Complete case study: high-update orders table',
      paragraphs: [
        'An orders table has indexes on order_id and customer_id. The application updates status and retry_count frequently. If status and retry_count are not indexed and the table uses a fillfactor that leaves same-page room, many updates can be HOT. Secondary indexes stop receiving a new entry for every status change.',
        'A dashboard request proposes an index on status. That index may make the dashboard faster but can turn every status update cold, multiplying index writes, index vacuum work, WAL volume, and page churn. The right decision is workload-specific: measure the dashboard gain against the lost HOT ratio.',
      ],
    },
    {
      heading: 'Visibility and index-only scans',
      paragraphs: [
        'Updates clear visibility-map certainty for changed heap pages. PostgreSQL index-only scans consult the visibility map; if a page is all-visible, the scan can return index data without visiting the heap, and if not, it must visit the heap to check visibility: https://www.postgresql.org/docs/current/indexes-index-only-scans.html.',
        'This creates a second-order effect. A high-update table may have the right covering index but still perform heap fetches because recent updates keep clearing all-visible bits. Vacuum and pruning restore page facts only after the page becomes provably safe.',
      ],
    },
    {
      heading: 'Observe and tune',
      paragraphs: [
        'The main counters live in PostgreSQL cumulative statistics. pg_stat_all_tables and pg_stat_user_tables expose table activity, including update and HOT-update counters in the table statistics view: https://www.postgresql.org/docs/current/monitoring-stats.html. pageinspect can inspect heap pages directly for educational debugging: https://www.postgresql.org/docs/current/pageinspect.html.',
        'The release gate is concrete: HOT update percentage rises, secondary index writes flatten, n_dead_tup stays within autovacuum capacity, index-only scan heap fetches remain acceptable, and latency does not trade one bottleneck for another.',
      ],
    },
    {
      heading: 'Where it wins and where it fails',
      paragraphs: [
        'HOT wins for high-update tables where frequently changed columns are not indexed: status fields, retry counters, heartbeat metadata, or denormalized payload columns. It lowers secondary-index churn, reduces index bloat pressure, and gives page pruning a local cleanup path.',
        'It fails when the updated column is indexed, when the row grows and cannot fit on the same heap page, when fillfactor leaves no headroom, or when autovacuum cannot keep up with dead tuple cleanup. It can also conflict with a well-intentioned new dashboard index: indexing a volatile column may quietly destroy HOT eligibility.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Before adding an index to a volatile column, check whether that column participates in frequent updates and whether those updates are currently HOT. A new index can look harmless in a read-only query plan and still increase write amplification, WAL, vacuum work, and bloat on the write path.',
        'For HOT tuning, record table fillfactor, HOT update ratio, dead tuple count, autovacuum cadence, index-only scan heap fetches, and the list of indexed columns that change during common updates. Those facts keep the discussion concrete: either the schema preserves page-local updates, or it does not.',
      ],
    },
    {
      heading: 'Schema design rule',
      paragraphs: [
        'The practical rule is to keep high-churn attributes away from ordinary secondary indexes unless the read path clearly earns the write cost. Status flags, retry counters, last_seen timestamps, and progress fields often change far more often than they are searched. Indexing them can turn a page-local update into an index-maintenance event across the whole table.',
        'When a read feature needs one of those columns, consider alternatives before adding the direct index: a partial index for the narrow hot query, a separate append-only event table, a materialized reporting path, or a denormalized summary updated at a lower frequency. HOT is not the only concern, but it is a useful pressure test for whether the schema respects the write workload.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An orders table has indexes on order_id and customer_id. The application updates retry_count many times while processing payment callbacks. If retry_count is not indexed and the heap page has free space, those updates can form a HOT chain behind the same root line pointer.',
        'Now add an index on retry_count for a rare admin report. Every retry_count update changes an indexed value, so HOT is no longer available for that update. The admin report may speed up, but the write path now pays secondary-index maintenance on a high-frequency field. This is why schema design and update behavior have to be evaluated together.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study MVCC Internals & VACUUM, PostgreSQL Autovacuum Freeze & Wraparound, PostgreSQL Buffer Pool Clock Sweep, Database Indexing, B-Trees, B+ Tree Leaf Sibling Scan Case Study, Hot Rows & Append-and-Aggregate, and PostgreSQL WAL Checkpoint & Recovery next.',
      ],
    },
  ],
};
