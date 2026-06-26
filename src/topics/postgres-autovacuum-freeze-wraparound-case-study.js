// PostgreSQL autovacuum freeze and wraparound protection: XID age queues,
// relfrozenxid horizons, visibility map bits, and aggressive vacuum scans.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-autovacuum-freeze-wraparound-case-study',
  title: 'PostgreSQL Autovacuum Freeze & Wraparound',
  category: 'Systems',
  summary: 'How PostgreSQL tracks transaction ID age with relfrozenxid, autovacuum freeze thresholds, visibility-map all-frozen bits, aggressive scans, and failsafe behavior.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['freeze horizon', 'visibility map'], defaultValue: 'freeze horizon' },
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

function freezeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'xid', label: 'XID', x: 0.5, y: 4.2, note: notes.xid ?? 'counter' },
      { id: 'table', label: 'table', x: 2.0, y: 4.2, note: notes.table ?? 'relfrozen' },
      { id: 'age', label: 'age', x: 3.5, y: 5.4, note: notes.age ?? 'distance' },
      { id: 'threshold', label: 'limit', x: 3.5, y: 3.0, note: notes.threshold ?? 'freeze age' },
      { id: 'worker', label: 'worker', x: 5.3, y: 4.2, note: notes.worker ?? 'autovac' },
      { id: 'heap', label: 'heap', x: 7.0, y: 5.4, note: notes.heap ?? 'pages' },
      { id: 'vm', label: 'VM', x: 7.0, y: 3.0, note: notes.vm ?? 'all frozen' },
      { id: 'freeze', label: 'freeze', x: 8.6, y: 4.2, note: notes.freeze ?? 'mark' },
      { id: 'safe', label: 'ok', x: 9.7, y: 4.2, note: notes.safe ?? 'hzn' },
    ],
    edges: [
      { id: 'e-xid-table', from: 'xid', to: 'table', weight: '' },
      { id: 'e-table-age', from: 'table', to: 'age', weight: '' },
      { id: 'e-table-threshold', from: 'table', to: 'threshold', weight: '' },
      { id: 'e-age-worker', from: 'age', to: 'worker', weight: '' },
      { id: 'e-threshold-worker', from: 'threshold', to: 'worker', weight: '' },
      { id: 'e-worker-heap', from: 'worker', to: 'heap', weight: '' },
      { id: 'e-worker-vm', from: 'worker', to: 'vm', weight: '' },
      { id: 'e-heap-freeze', from: 'heap', to: 'freeze', weight: '' },
      { id: 'e-vm-freeze', from: 'vm', to: 'freeze', weight: '' },
      { id: 'e-freeze-safe', from: 'freeze', to: 'safe', weight: '' },
    ],
  }, { title });
}

function* freezeHorizon() {
  yield {
    state: freezeGraph('Transaction IDs age as the global counter advances'),
    highlight: { active: ['xid', 'table', 'age', 'e-xid-table', 'e-table-age'], compare: ['threshold'] },
    explanation: 'PostgreSQL transaction IDs are finite and compared by age. Each table records a frozen horizon. If that horizon becomes too old, wraparound safety becomes urgent.',
    invariant: 'Freezing is not optional cleanup; it protects transaction-ID ordering from wraparound failure.',
  };

  yield {
    state: freezeGraph('autovacuum chooses tables whose age crosses freeze thresholds', { threshold: 'max age', worker: 'forced' }),
    highlight: { active: ['table', 'age', 'threshold', 'worker', 'e-age-worker', 'e-threshold-worker'], compare: ['heap'] },
    explanation: 'Autovacuum has ordinary cleanup work and anti-wraparound work. Once a table age approaches the configured maximum, PostgreSQL forces vacuum work to advance the frozen horizon.',
  };

  yield {
    state: labelMatrix(
      'Age states',
      [
        { id: 'young', label: 'young' },
        { id: 'normal', label: 'normal' },
        { id: 'aggr', label: 'aggr' },
        { id: 'failsafe', label: 'failsafe' },
      ],
      [
        { id: 'scan' },
        { id: 'risk' },
      ],
      [
        ['skip many', 'low'],
        ['vacuum', 'bloat'],
        ['scan more', 'wrap'],
        ['no delay', 'urgent'],
      ],
    ),
    highlight: { active: ['normal:scan', 'aggr:scan', 'failsafe:scan'], compare: ['failsafe:risk'] },
    explanation: 'The queue is age-ordered. As the table gets older, PostgreSQL moves from routine cleanup toward aggressive anti-wraparound behavior and finally failsafe measures.',
  };

  yield {
    state: freezeGraph('Freezing old tuple XIDs advances the table horizon', { freeze: 'replace old', safe: 'relfrozen' }),
    highlight: { active: ['worker', 'heap', 'freeze', 'safe', 'e-worker-heap', 'e-heap-freeze', 'e-freeze-safe'], found: ['vm'] },
    explanation: 'VACUUM can replace old transaction IDs with frozen markers where visibility is permanent. Once enough old tuples are frozen, relfrozenxid can advance.',
  };

  yield {
    state: freezeGraph('The complete case study is a write-heavy multi-tenant events table', { table: 'events', age: 'old tenant', worker: 'anti-wrap', safe: 'advanced' }),
    highlight: { active: ['xid', 'table', 'age', 'threshold', 'worker', 'heap', 'freeze', 'safe'], compare: ['vm'] },
    explanation: 'A multi-tenant events table has partitions that stopped receiving writes but still contain old XIDs. Autovacuum prioritizes the old partitions, scans pages that need freezing, and advances their horizons before wraparound pressure becomes a production incident.',
  };
}

function* visibilityMapView() {
  yield {
    state: freezeGraph('The visibility map stores per-page all-visible and all-frozen facts', { vm: 'bits', heap: 'pages' }),
    highlight: { active: ['heap', 'vm', 'worker', 'e-worker-heap', 'e-worker-vm'], compare: ['freeze'] },
    explanation: 'The visibility map is a compact side structure for heap pages. It records whether all tuples on a page are visible to all transactions and whether all tuples are frozen.',
    invariant: 'The all-frozen bit is a skip index for future anti-wraparound work.',
  };

  yield {
    state: labelMatrix(
      'Page bits',
      [
        { id: 'dead', label: 'dead tuples' },
        { id: 'visible', label: 'all visible' },
        { id: 'frozen', label: 'all frozen' },
        { id: 'dirty', label: 'changed' },
      ],
      [
        { id: 'vacuum' },
        { id: 'next time' },
      ],
      [
        ['cleanup', 'revisit'],
        ['index-only', 'maybe skip'],
        ['skip freeze', 'cheap'],
        ['clear bits', 'rescan'],
      ],
    ),
    highlight: { active: ['visible:vacuum', 'frozen:vacuum', 'frozen:next time'], compare: ['dirty:next time'] },
    explanation: 'Visibility bits turn a heap scan into a page-classification problem. Pages marked all-frozen are cheap during future aggressive vacuums because they need no freezing.',
  };

  yield {
    state: freezeGraph('A changed page clears skip facts until vacuum proves them again', { heap: 'updated', vm: 'bit clear', freeze: 'recheck' }),
    highlight: { active: ['heap', 'vm', 'freeze', 'e-vm-freeze'], compare: ['safe'] },
    explanation: 'Visibility map facts are conservative. Updates, deletes, and locks can clear bits. VACUUM later re-establishes facts after checking the page.',
  };

  yield {
    state: freezeGraph('Aggressive vacuum can skip pages already marked all-frozen', { worker: 'aggressive', vm: 'skip set', heap: 'some pages', safe: 'faster' }),
    highlight: { active: ['worker', 'vm', 'freeze', 'safe', 'e-worker-vm', 'e-vm-freeze'], compare: ['heap'] },
    explanation: 'The all-frozen bit is what keeps anti-wraparound vacuum from becoming a full-table punishment every time. Append-mostly tables benefit heavily when old pages stay all-frozen.',
  };

  yield {
    state: freezeGraph('The complete case study is an append-mostly audit log', { table: 'audit log', vm: 'old pages', freeze: 'skip most', safe: 'stable' }),
    highlight: { active: ['table', 'worker', 'vm', 'freeze', 'safe'], found: ['heap'] },
    explanation: 'An audit log receives new pages at the end while old pages never change. Once vacuum marks old pages all-frozen, later anti-wraparound runs can skip most of the table and focus on recent pages.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'freeze horizon') yield* freezeHorizon();
  else if (view === 'visibility map') yield* visibilityMapView();
  else throw new InputError('Pick a PostgreSQL freeze view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read transaction IDs as a finite clock used by PostgreSQL multi-version concurrency control, or MVCC. MVCC keeps old row versions so readers and writers can overlap, and snapshots compare transaction IDs to decide which version is visible.',
        'In the freeze-horizon view, the risky table is the one whose oldest unfrozen transaction ID is aging toward wraparound. In the visibility-map view, an all-frozen page is a page-level certificate that vacuum can safely skip later.',
        {type:'callout', text:`Freeze is not cleanup; it is a correctness mechanism that converts old transaction identities into permanent visibility facts before the finite counter wraps.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PostgreSQL transaction IDs are finite, so after enough transactions the counter wraps. Autovacuum freeze exists to replace sufficiently old transaction identities with a permanent visible-to-all fact before comparisons become unsafe.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to think of vacuum as space reclamation. If a table has few dead tuples and no visible bloat, it looks safe to ignore.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is wraparound. A finite counter cannot support old-vs-new ordering forever unless old row versions are converted into a representation that no longer depends on their original transaction ID.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a conservative table-level horizon plus conservative page-level skip facts. The relation horizon summarizes old unfrozen risk, while the visibility map records whether individual pages are all-visible or all-frozen.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A vacuum worker scans heap pages and identifies tuples whose old transaction IDs can be frozen under MVCC visibility rules. It writes durable page changes and advances relation metadata only after the old risk has been removed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Freezing is correct because old visibility eventually becomes permanent. Once no future snapshot needs the original transaction ID, replacing it with a frozen marker preserves the observable result.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is heap inspection, page writes, WAL, buffer-pool pressure, and worker time. If a 200 GB archive has no valid all-frozen coverage, an anti-wraparound pass may read a large fraction of it even though the application sees it as cold.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This mechanism matters in SaaS audit trails, billing ledgers, event streams, queues, regulatory archives, and multi-tenant databases. Long-lived data under sustained transaction volume makes frozen horizons operationally important.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails operationally when autovacuum is starved. Too few workers, long-running transactions, lock conflicts, heavy write volume, and bad cost settings can keep horizons from advancing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a database processes 1 million transactions per hour and an old audit partition has a relfrozenxid age of 1.7 billion. Even with almost no dead tuples, its age increases by about 24 million per day until vacuum freezes pages and advances the horizon.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL Routine Vacuuming at https://www.postgresql.org/docs/current/routine-vacuuming.html, PostgreSQL Vacuuming settings at https://www.postgresql.org/docs/current/runtime-config-vacuum.html, PostgreSQL Visibility Map at https://www.postgresql.org/docs/current/storage-vm.html, and pg_visibility at https://www.postgresql.org/docs/current/pgvisibility.html. Study MVCC Internals and VACUUM, PostgreSQL HOT Update Heap-Only Tuple, PostgreSQL WAL Checkpoint and Recovery, PostgreSQL Buffer Pool Clock Sweep, PostgreSQL Lock Manager and Deadlock Detector, and Database Indexing next.',
      ],
    },
  ],
};
