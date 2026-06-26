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
      heading: 'How to read the animation',
      paragraphs: [
        'Read a heap page as PostgreSQL row storage and a line pointer as the stable slot an index can target. A HOT successor is a newer row version stored on the same page behind the root line pointer.',
        'In the HOT-chain view, the secondary index still points to the root. Readers follow the on-page chain to the visible version, and the index does not receive a new entry for every heap-only version.',
        {type:'callout', text:'HOT works by keeping logical row identity stable in the index while same-page heap versions absorb update churn.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PostgreSQL MVCC updates create a new tuple version instead of overwriting the old version in place. HOT means heap-only tuple, and it exists to let some updates stay local to the heap page when indexed columns do not change.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to update every index whenever a row is updated. That is simple because each index entry can point directly to the current physical tuple version.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is write amplification. Frequent updates to non-indexed fields should not force every secondary index to learn about a new tuple version.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate logical row identity from physical tuple versions. The secondary index points to a stable root line pointer, and same-page heap versions form a chain behind that root.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When an update qualifies, PostgreSQL writes the new tuple version on the same heap page and marks it as heap-only. The old tuple links forward, and readers use MVCC visibility rules to choose the version their snapshot can see.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on unchanged indexed values. If the indexed key is the same, the existing index entry still identifies the same logical row candidate and can lead to the visible heap version through the chain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HOT reduces secondary-index writes, index bloat, WAL, and future vacuum work when updates qualify. If a table performs 1 million status updates per hour and has four secondary indexes, preserving HOT can avoid millions of index-entry writes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HOT wins on high-update tables where volatile columns are not indexed. Status flags, retry counters, heartbeat fields, progress markers, and denormalized payload fields are common examples.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HOT fails when an updated column is indexed. It also fails when the new tuple cannot fit on the same page, which makes fillfactor, row growth, dead-tuple cleanup, and autovacuum cadence part of the behavior.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An orders table has 10 million rows and indexes on order_id and customer_id. If retry_count changes five times per order and is not indexed, 50 million updates can form HOT chains; adding an index on retry_count turns those updates into index-maintenance work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL HOT storage at https://www.postgresql.org/docs/current/storage-hot.html, page layout at https://www.postgresql.org/docs/current/storage-page-layout.html, CREATE TABLE fillfactor at https://www.postgresql.org/docs/current/sql-createtable.html, free space map at https://www.postgresql.org/docs/current/storage-fsm.html, index-only scans at https://www.postgresql.org/docs/current/indexes-index-only-scans.html, monitoring statistics at https://www.postgresql.org/docs/current/monitoring-stats.html, and pageinspect at https://www.postgresql.org/docs/current/pageinspect.html. Study MVCC Internals and VACUUM, PostgreSQL Autovacuum Freeze and Wraparound, PostgreSQL Buffer Pool Clock Sweep, Database Indexing, B-Trees, Hot Rows and Append-and-Aggregate, and PostgreSQL WAL Checkpoint and Recovery next.',
      ],
    },
  ],
};
