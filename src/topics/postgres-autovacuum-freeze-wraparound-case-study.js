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
      heading: 'Why this exists',
      paragraphs: [
        `PostgreSQL uses multi-version concurrency control, so a row version is not simply current or deleted. It carries transaction identity, and readers decide whether that version is visible by comparing their snapshot against the transaction IDs stored on the tuple. That gives PostgreSQL excellent concurrency because readers and writers can avoid blocking each other in many ordinary cases. It also creates a clock that never stops. The transaction ID counter advances as the database processes work, and old tuple IDs continue to age even when the rows themselves are no longer changing.`,
        `Autovacuum freeze exists because that counter is finite. If transaction IDs are allowed to wrap while old tuple IDs remain meaningful, comparison by age can become unsafe. PostgreSQL therefore has to turn sufficiently old transaction IDs into a permanent visibility fact: this tuple is frozen and can be treated as visible to all future transactions. The feature is not cosmetic cleanup. It is a correctness mechanism that prevents a running database from losing the ability to order old and new versions.`,
        `The operational problem is that the most dangerous table is not always the busiest table. A quiet archive, old tenant partition, or append-only audit table can contain transaction IDs from far in the past. Its pages may look stable and harmless, but its table-level frozen horizon keeps falling behind the global counter. Anti-wraparound autovacuum is the background system that notices that age, schedules the right work, freezes old tuple IDs, and advances the table horizon before the database reaches emergency territory.`,
        {type:'callout', text:`Freeze is not cleanup; it is a correctness mechanism that converts old transaction identities into permanent visibility facts before the finite counter wraps.`},
      ],
    },
    {
      heading: 'Why ordinary cleanup is not enough',
      paragraphs: [
        `The obvious approach is to treat vacuum as a space-reclamation service. When updates and deletes leave dead tuples behind, vacuum removes them, updates statistics, and lets the storage engine reuse space. Under that mental model, a table that no one updates does not need urgent maintenance. There are no new dead tuples, the index is not obviously bloated, and the application is not complaining.`,
        `That approach fails because wraparound risk is independent of visible bloat. Old row versions can be perfectly valid, frequently read, and still carry transaction IDs that must eventually be frozen. A table can be dangerous precisely because it is quiet: no writer comes along to change the pages, but the global transaction ID counter keeps moving. If autovacuum only chased dead-tuple cleanup, it would ignore the tables whose XID horizons most need to advance.`,
        `Manual scheduling has the same weakness at production scale. A human can run VACUUM on the biggest tables, but the real risk is age relative to the transaction counter, not table size alone. PostgreSQL needs an automatic age-aware queue that can override ordinary cost preferences when correctness is at stake. This is why anti-wraparound vacuum can happen even on tables that do not look dirty from a bloat-only point of view.`,
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        `The system is easiest to understand as two coordinated indexes over age. At the table level, PostgreSQL records a frozen horizon such as relfrozenxid. That horizon summarizes how far back the table may still contain unfrozen transaction IDs. The age of that horizon is compared with freeze thresholds, so autovacuum can prioritize tables that are drifting toward wraparound risk.`,
        `At the page level, PostgreSQL uses the visibility map. Each heap page can carry compact facts such as all-visible and all-frozen. All-visible says every tuple on the page is visible to all current and future transactions, which can also help index-only scans. All-frozen is stronger for this topic: it says the tuples on that page no longer require future freezing until a later page change invalidates the fact.`,
        `Those two levels serve different purposes. The table horizon tells PostgreSQL which relation is becoming old. The visibility map tells a vacuum worker where expensive heap inspection may be avoidable. Without the table horizon, the database would not know which tables are urgent. Without the page-level skip facts, every urgent table would tend toward full heap scans even when most pages were already permanently safe.`,
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        `A vacuum worker scans heap pages, identifies old transaction IDs that are safe to replace with frozen markers, and writes the page metadata needed to remember the result. A frozen tuple no longer depends on comparing its original old XID against future snapshots. That removes it from the wraparound danger set. Once all relevant old tuple IDs in a relation are frozen past a safe boundary, PostgreSQL can advance the relation horizon.`,
        `The scheduling side uses multiple thresholds rather than a single panic button. Ordinary autovacuum can clean dead tuples and freeze opportunistically. As table age rises, autovacuum becomes more aggressive about anti-wraparound work. At high risk, PostgreSQL can force anti-wraparound vacuum and reduce normal throttling because a database that cannot safely compare transaction IDs is worse than a database that briefly spends too much I/O on maintenance.`,
        `The visibility map is what keeps this from being ruinously repetitive. If an old append-only page has already been proven all-frozen, a later aggressive vacuum can skip it. If a page is updated, deleted from, locked in a way that changes tuple state, or otherwise dirtied, the conservative fact can be cleared. Vacuum must later re-check the page before trusting it again. The invariant is simple: skip facts may be lost too often, but they must not remain set after they become false.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Freezing works because old visibility decisions eventually become stable. Once every transaction that could have seen a tuple as invisible is gone, and the tuple is known to be visible to all future transactions, PostgreSQL no longer needs the original transaction ID for future visibility comparisons. Replacing that old ID with a frozen marker preserves the useful semantic fact while removing the wraparound hazard.`,
        `The horizon works because it summarizes the oldest remaining risk. A table does not need to remember every historical transaction ID in its scheduling metadata. It needs a conservative lower bound: there may be unfrozen tuple IDs this old in the table. Advancing that bound after vacuum work gives the autovacuum launcher a compact way to compare tables, choose work, and detect urgency.`,
        `The visibility map works because it converts repeated proof into a reusable certificate. Anti-wraparound safety requires certainty, so a page can only be skipped when PostgreSQL has a conservative all-frozen fact for it. The moment later activity makes the fact uncertain, the bit can be cleared. This design favors extra work over unsound skipping, which is the right bias for a correctness feature.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a SaaS product with a large events table partitioned by month. The current month is hot: inserts arrive constantly, some rows are corrected, and ordinary vacuum has dead tuples to clean. Three-year-old partitions are different. They are read for audits but no longer receive writes. Those old partitions contain very old XIDs, so their relfrozenxid values fall behind as the rest of the system continues processing transactions.`,
        `During routine maintenance, vacuum reaches an old partition and freezes every tuple that can now be treated as permanently visible. Pages that contain only frozen tuples are marked all-frozen in the visibility map. The partition horizon advances because PostgreSQL can prove that no remaining tuple in that relation requires the old horizon. Future anti-wraparound passes see the partition age, inspect the visibility map, and skip most old pages because the all-frozen facts are still valid.`,
        `Now compare a neglected tenant table that is rarely touched but was never frozen enough. It has little bloat, so a space-only maintenance view would ignore it. Its age crosses the freeze threshold anyway. Autovacuum schedules anti-wraparound work, scans pages that do not have valid all-frozen facts, freezes old tuple IDs, and advances the horizon. If the table keeps being blocked by long transactions or lock conflicts, the database moves closer to failsafe behavior because the risk is not performance degradation; the risk is transaction ID wraparound.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is starvation. Autovacuum workers are finite, and they can be delayed by high write volume, poor cost settings, long-running transactions, lock conflicts, or a workload that creates dead tuples faster than workers can process them. Anti-wraparound tasks can force their way forward, but reaching that stage means ordinary maintenance capacity was already insufficient.`,
        `The second failure mode is a frozen horizon that cannot advance. Vacuum may scan a table but still be unable to move the relation horizon as far as expected because some pages remain unfrozen, a long transaction holds back what can be considered safe, or visibility map facts keep being cleared by updates. Operators sometimes see vacuum activity and assume safety; the important check is whether the relevant horizons are actually advancing.`,
        `The third failure mode is misunderstanding the page bits. All-visible is not the same as all-frozen. An all-visible page can help reads because every tuple is visible, but it may still contain transaction IDs that must eventually be frozen. An all-frozen page carries the stronger anti-wraparound skip fact. Treating those two facts as interchangeable leads to bad expectations about why an aggressive vacuum still scans a relation.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Monitor age, not just bloat. The operational questions are: which databases and tables have old frozen horizons, which ones are approaching configured freeze ages, whether autovacuum workers are keeping up, and whether long transactions are holding back cleanup. A dashboard that only shows dead tuples will miss the wraparound story. A dashboard that shows table age, vacuum progress, worker saturation, and oldest active transactions gives a much better picture.`,
        `Partitioning can make freeze work easier when old partitions become stable. An append-mostly audit log, event stream, or ledger table often has a natural time boundary. Once old partitions stop changing, vacuum can freeze them, set all-frozen bits, and make future maintenance cheap. A constantly updated table behaves differently because updates clear page facts and force repeated inspection.`,
        `Do not disable autovacuum as a routine performance fix. If a table has special needs, tune it deliberately: scale worker capacity, adjust thresholds, schedule manual VACUUM FREEZE where appropriate, investigate blockers, and fix transactions that stay open too long. The maintenance system is part of correctness, not an optional background convenience. PostgreSQL Routine Vacuuming documents wraparound prevention at https://www.postgresql.org/docs/current/routine-vacuuming.html, and vacuum configuration settings such as autovacuum_freeze_max_age and vacuum_failsafe_age are documented at https://www.postgresql.org/docs/current/runtime-config-vacuum.html.`,
      ],
    },
    {
      heading: 'Implementation notes',
      paragraphs: [
        `The implementation pattern is a conservative summary plus a conservative skip index. The relation horizon is allowed to be older than the true oldest unfrozen tuple because that causes extra work, not incorrect skipping. The visibility map is allowed to lose bits and force rechecks. What it must not do is claim that a page is all-frozen when it is not. This asymmetric error budget is common in storage systems: false negatives cost I/O, while false positives can break correctness.`,
        `The worker must also coordinate with normal MVCC rules. Freezing is only valid when tuple visibility has become permanent relative to future snapshots. Vacuum therefore interacts with transaction horizons, page state, indexes, and write-ahead logging. It is not merely rewriting labels in place; it is making durable storage changes that future recovery and future readers must interpret consistently.`,
        `For application engineers, the lesson is to design data lifecycles that help the maintenance algorithm. Avoid accidental forever-open transactions. Keep old partitions stable when possible. Use retention and partition detach/drop workflows deliberately. For database operators, the lesson is to treat anti-wraparound warnings as correctness alarms. Once the system escalates to failsafe behavior, the database is already spending performance budget to buy safety.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `This mechanism matters anywhere PostgreSQL stores long-lived data under sustained transaction volume: SaaS audit trails, billing ledgers, event streams, queues, analytics staging tables, regulatory archives, and multi-tenant systems with uneven tenant activity. The larger and older the database, the more dangerous it is to think of vacuum only as cleanup.`,
        `It also matters for incident response. A production system approaching wraparound risk can suddenly run aggressive vacuums, consume I/O, ignore some normal throttles, or block unsafe operations. Those symptoms are easy to misread as a spontaneous performance bug. The root cause is often historical maintenance debt: old horizons, blocked vacuums, underprovisioned workers, or old transactions that prevented freezing from keeping pace.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: PostgreSQL Routine Vacuuming at https://www.postgresql.org/docs/current/routine-vacuuming.html, PostgreSQL Vacuuming settings at https://www.postgresql.org/docs/current/runtime-config-vacuum.html, PostgreSQL Visibility Map at https://www.postgresql.org/docs/current/storage-vm.html, and pg_visibility at https://www.postgresql.org/docs/current/pgvisibility.html. Read those with the article model in mind: table horizons identify age risk, the visibility map stores conservative page facts, and autovacuum turns both into scheduled maintenance work.`,
        `Study MVCC Internals & VACUUM next if you want the tuple-visibility rules behind freezing. Study PostgreSQL HOT Update Heap-Only Tuple to see how updates shape heap page churn. Study PostgreSQL WAL Checkpoint & Recovery to understand why freezing changes must be durable. Study PostgreSQL Buffer Pool Clock Sweep for the memory side of large scans. Study PostgreSQL Lock Manager & Deadlock Detector for blockers that can interfere with maintenance. Study Database Indexing to separate visibility-map benefits for index-only scans from all-frozen benefits for anti-wraparound vacuum.`,
      ],
    },
  ],
};
