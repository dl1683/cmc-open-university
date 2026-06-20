// Project Nessie transactional catalog: Git-like refs, commits, tags, merges,
// cross-table visibility, and Iceberg catalog transactions for data lakes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'project-nessie-transactional-catalog-case-study',
  title: 'Project Nessie Transactional Catalog Case Study',
  category: 'Systems',
  summary: 'Project Nessie as a Git-like transactional catalog for data lakes: branches, tags, commits, multi-table changes, merge visibility, and Iceberg references.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['branch catalog', 'cross-table txn'], defaultValue: 'branch catalog' },
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

function branchGraph(title) {
  return graphState({
    nodes: [
      { id: 'main', label: 'main', x: 0.8, y: 3.5, note: 'prod ref' },
      { id: 'c1', label: 'c1', x: 2.2, y: 3.5, note: 'hash' },
      { id: 'dev', label: 'dev', x: 3.7, y: 1.7, note: 'branch' },
      { id: 'c2', label: 'c2', x: 5.2, y: 1.7, note: 'test' },
      { id: 'tag', label: 'tag', x: 3.7, y: 5.3, note: 'release' },
      { id: 'orders', label: 'orders', x: 6.8, y: 2.4, note: 'Iceberg' },
      { id: 'cust', label: 'cust', x: 6.8, y: 4.6, note: 'Iceberg' },
      { id: 'merge', label: 'merge', x: 8.6, y: 3.5, note: 'promote' },
    ],
    edges: [
      { id: 'e-main-c1', from: 'main', to: 'c1', weight: 'points' },
      { id: 'e-c1-dev', from: 'c1', to: 'dev', weight: 'fork' },
      { id: 'e-dev-c2', from: 'dev', to: 'c2', weight: 'commit' },
      { id: 'e-c1-tag', from: 'c1', to: 'tag', weight: 'pin' },
      { id: 'e-c2-orders', from: 'c2', to: 'orders', weight: 'new' },
      { id: 'e-c2-cust', from: 'c2', to: 'cust', weight: 'new' },
      { id: 'e-c2-merge', from: 'c2', to: 'merge', weight: 'fast?' },
      { id: 'e-merge-main', from: 'merge', to: 'main', weight: 'move' },
    ],
  }, { title });
}

function txnGraph(title) {
  return graphState({
    nodes: [
      { id: 'read', label: 'read', x: 0.8, y: 3.5, note: 'hash' },
      { id: 'a', label: 'table A', x: 2.7, y: 2.0, note: 'change' },
      { id: 'b', label: 'table B', x: 2.7, y: 5.0, note: 'change' },
      { id: 'commit', label: 'commit', x: 4.8, y: 3.5, note: 'multi' },
      { id: 'conflict', label: 'check', x: 6.6, y: 2.0, note: 'reads' },
      { id: 'ref', label: 'ref', x: 6.6, y: 5.0, note: 'move' },
      { id: 'view', label: 'view', x: 8.6, y: 3.5, note: 'serial' },
    ],
    edges: [
      { id: 'e-read-a', from: 'read', to: 'a', weight: '' },
      { id: 'e-read-b', from: 'read', to: 'b', weight: '' },
      { id: 'e-a-commit', from: 'a', to: 'commit', weight: '' },
      { id: 'e-b-commit', from: 'b', to: 'commit', weight: '' },
      { id: 'e-commit-conflict', from: 'commit', to: 'conflict', weight: 'safe' },
      { id: 'e-conflict-ref', from: 'conflict', to: 'ref', weight: 'ok' },
      { id: 'e-ref-view', from: 'ref', to: 'view', weight: 'visible' },
    ],
  }, { title });
}

function* branchCatalog() {
  yield {
    state: branchGraph('Nessie puts Git-like refs over lakehouse table metadata'),
    highlight: { active: ['main', 'c1', 'dev', 'c2', 'e-c1-dev', 'e-dev-c2'], found: ['merge'] },
    explanation: 'Nessie takes a familiar version-control shape and applies it to lakehouse catalog metadata. Engines can work on a branch, validate a catalog state, and promote it later instead of exposing half-finished table changes.',
    invariant: 'Branches version catalog pointers and table metadata references, not arbitrary mutable data files.',
  };

  yield {
    state: labelMatrix(
      'Refs',
      [
        { id: 'main', label: 'main' },
        { id: 'dev', label: 'dev' },
        { id: 'tag', label: 'tag' },
        { id: 'hash', label: 'hash' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['prod', 'blast'],
        ['test', 'drift'],
        ['pin', 'old'],
        ['id', 'lost'],
      ],
    ),
    highlight: { active: ['main:role', 'dev:role', 'tag:role'], compare: ['dev:risk'], found: ['hash:role'] },
    explanation: 'The ref map is the core data structure. Human names such as main and dev resolve to commit hashes; tags pin known states; merges change which catalog state other users can see.',
  };

  yield {
    state: branchGraph('Data teams can isolate changes before promoting them'),
    highlight: { active: ['dev', 'c2', 'orders', 'cust', 'e-c2-orders', 'e-c2-cust'], compare: ['main'], found: ['tag'] },
    explanation: 'A team can update several Iceberg tables on a dev branch, run validation, and keep production readers pinned to main. The branch is a staging area for visibility, not a copy of every data byte.',
  };

  yield {
    state: labelMatrix(
      'Moves',
      [
        { id: 'fork', label: 'fork' },
        { id: 'load', label: 'load' },
        { id: 'test', label: 'test' },
        { id: 'merge', label: 'merge' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['iso', 'base'],
        ['data', 'snap'],
        ['QA', 'gate'],
        ['prod', 'conf'],
      ],
    ),
    highlight: { active: ['fork:use', 'test:guard', 'merge:use'], compare: ['merge:guard'] },
    explanation: 'The workflow looks like software version control, but the guarded asset is table metadata. A merge is a visibility decision: it decides which table pointers downstream consumers will resolve next.',
  };
}

function* crossTableTxn() {
  yield {
    state: txnGraph('A single catalog commit can expose many table changes together'),
    highlight: { active: ['a', 'b', 'commit', 'e-a-commit', 'e-b-commit'], found: ['view'] },
    explanation: 'Nessie supports commits containing multiple object changes. That lets connected table updates become visible as one catalog state instead of leaking a migration one table at a time.',
  };

  yield {
    state: labelMatrix(
      'Txn',
      [
        { id: 'read', label: 'read' },
        { id: 'write', label: 'write' },
        { id: 'check', label: 'check' },
        { id: 'show', label: 'show' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['hash', 'stale'],
        ['multi', 'split'],
        ['reads', 'race'],
        ['ref', 'leak'],
      ],
    ),
    highlight: { active: ['read:needs', 'write:needs', 'show:needs'], compare: ['write:fail'] },
    explanation: 'Cross-table transactions need read state, write sets, conflict checks, and an atomic reference move. Otherwise a dashboard can observe table A after migration and table B before migration.',
    invariant: 'The visible catalog state should advance as a unit when downstream users need the tables to agree.',
  };

  yield {
    state: txnGraph('Isolation depends on recording what was read and changed'),
    highlight: { active: ['read', 'conflict', 'commit', 'e-commit-conflict'], compare: ['ref'], found: ['view'] },
    explanation: 'Isolation starts by resolving a ref to an exact commit hash. From there, the system can ask whether later commits touched objects the transaction read or wrote before it moves the visible ref.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'dim', label: 'dim' },
        { id: 'fact', label: 'fact' },
        { id: 'dash', label: 'dash' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['new', 'join'],
        ['new', 'metric'],
        ['both', 'bad'],
        ['tag', 'late'],
      ],
    ),
    highlight: { active: ['dim:need', 'fact:need', 'dash:need'], compare: ['dash:risk'], found: ['roll:need'] },
    explanation: 'A common case is changing dimensions and facts together. Branch validation plus atomic catalog promotion keeps downstream dashboards from joining old facts to new dimensions or the reverse.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'branch catalog') yield* branchCatalog();
  else if (view === 'cross-table txn') yield* crossTableTxn();
  else throw new InputError('Pick a Nessie view.');
}

export const article = {
  sections: [
    {
      heading: 'Problem',
      paragraphs: [
        'Data lakes often fail at the catalog boundary rather than the file boundary. The object store may contain every Parquet file durably. Each Iceberg table may have a valid snapshot. The failure is that related tables do not become visible as one coherent state. A fact table moves forward, a dimension table remains behind, a dashboard joins them, and no one can answer which version of the data product was actually queried.',
        'Project Nessie exists to give lakehouse catalogs versioned, transactional, Git-like behavior. It adds branches, tags, commits, merges, and conflict checks around table metadata references. The goal is not to version every byte in the lake like a source repository. The goal is to version the catalog pointers that tell engines which table metadata and snapshots belong to a named state such as main, dev, or a release tag.',
        {type:'callout', text:'Nessie turns catalog visibility into a commit graph, so multi-table lakehouse changes can be tested before production readers resolve them.'},
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive lakehouse approach lets every table commit independently. A writer updates an Iceberg table snapshot, another writer updates a related table later, orchestration scripts decide the order, and downstream engines refresh their catalog view whenever they run. This is simple when tables are independent. It is fragile when a business change spans many tables.',
        'Teams often patch the gap with naming conventions, staging directories, manual promotion, or scheduler dependencies. Those conventions help, but they are outside the core catalog semantics. If a dashboard, notebook, or batch job can still observe a half-promoted release, the lake does not have true cross-table visibility control. It has a social agreement that every tool must remember to follow.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears during coordinated releases. A team changes customer dimensions, order facts, and a derived aggregate. If those table changes become visible one by one, readers can see new facts with old dimensions, old facts with new aggregates, or a schema migration that only landed on half the tables. Every individual table can pass validation while the combined data product is wrong.',
        'Rollback has the same problem. Returning one table to an old snapshot does not necessarily return the whole lake to a coherent point. Auditing and lineage also become ambiguous because a downstream dataset may depend on a moving mixture of table states rather than a named catalog hash. The danger is subtle because the storage layer is durable and each table snapshot is valid. The bug lives in the relationship between tables and in the instant when a new catalog state becomes visible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Nessie treats catalog visibility as a versioned data structure. A ref such as main or dev resolves to a commit hash. A commit records object changes, commonly table metadata pointer updates. A tag pins a known state. A branch gives writers an isolated place to create and validate changes. A merge or reference move decides what another audience will resolve next.',
        'This turns a messy operational workflow into a small set of catalog operations. Fork a branch, update metadata references, validate the branch, tag known states, merge when safe, and let production readers continue resolving main until promotion happens. The data files can already exist in object storage, but readers do not discover them through the production catalog state until the reference points there.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A Nessie branch is a named pointer into a commit graph. When a user writes through an engine that uses the catalog, the engine resolves the branch to a current commit hash, prepares table metadata changes, and commits those object changes against the branch. If the commit is accepted, the branch now points at a new hash. Readers resolving that branch see the new catalog state; readers resolving another branch do not.',
        'A tag is a stable name for a known commit hash. Tags are useful for releases, audits, reproducible experiments, and rollback targets. A merge moves changes from one branch into another after conflict checks and policy gates. The system must know what was read or changed so it can reject unsafe promotions. If another commit touched an object in a way that invalidates the proposed change, the merge should fail rather than exposing an inconsistent catalog state.',
        'The catalog transaction is about metadata visibility. Iceberg already gives each table a snapshot and metadata chain. Nessie adds a versioned map around many such table references. That map can change several object pointers in one commit, so connected table changes become visible together instead of leaking through as independent table refreshes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a retailer needs to release a new customer segmentation model. The change touches customer_dim, order_fact, campaign_assignment, and a derived dashboard table. The team creates a branch from main, writes new Iceberg metadata for all four tables on that branch, and runs validation jobs against the branch reference. Production readers continue to use main, so they do not see the half-built release.',
        'After validation, the team tags the current production hash as release-before-segments and merges the branch to main. A dashboard that resolves main before the merge sees the old coherent set. A dashboard that resolves main after the merge sees the new coherent set. It does not see new order facts joined to old customer segments. If validation fails, main never moves. If the release later has a business problem, the tag gives operators a known previous catalog state to inspect or restore toward.',
      ],
    },
    {
      heading: 'Animation lesson',
      paragraphs: [
        'The branch-catalog view shows main, a commit, a dev branch, a tag, table objects, and a merge. The important transition is the movement of a reference. The dev branch can advance while main remains stable. A tag can pin the old state. A merge can promote tested catalog changes. The table nodes represent Iceberg metadata references, not copies of every data file.',
        'The cross-table transaction view shows why a single catalog commit matters. Table A and table B can both change before the visible ref moves. The conflict-check node reminds you that isolation depends on the base hash and the touched objects. The final view node represents the user-facing guarantee: downstream consumers should observe a coherent catalog state when related tables must agree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates physical existence from logical visibility. Data files can be written before they are part of production. Table metadata can be created before readers are pointed at it. Validation can run against a branch without asking every downstream consumer to coordinate manually. Only the catalog reference decides when a named audience sees the new state.',
        'It also works because immutable commit hashes make state precise. A branch name is human-friendly, but the resolved hash is the exact catalog state. That hash can be logged in lineage, attached to audit records, used in reproducibility, or compared during conflict checks. The system can reason about what changed because catalog updates are stored as explicit commits rather than hidden side effects in a scheduler.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Nessie adds a control plane, and control planes need policy. Teams must decide who can create branches, who can merge to production, which validation gates are required, how long tags live, how lineage records catalog hashes, and how abandoned branches are cleaned. The value of versioned catalog state depends on engines and users consistently going through that catalog.',
        'There is also a metadata and operations cost. Branches can drift. Long-lived experimental states can keep old table snapshots or files reachable. Merge conflicts need human or automated resolution. Garbage collection must respect all visible refs and retention policy, otherwise old files can be deleted too early or kept forever. A Git-like interface can make the system feel familiar, but lakehouse storage has different cleanup and data-retention consequences than source code.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Nessie wins when data products span multiple tables. Schema migrations, backfills, feature-store releases, experiment branches, quality gates, and environment promotion all benefit from a named catalog state. It is especially useful when teams want production readers to remain stable while validation runs elsewhere.',
        'It also wins for reproducibility. A notebook, training job, or audit process can record the catalog hash it used. A tag can preserve a release state. A branch can let analysts test a new table version without copying the whole lake. Iceberg provides table-level snapshot semantics; Nessie provides a multi-table history and reference model around those snapshots.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Nessie cannot fix bad data quality, poor table design, or engines that bypass the catalog. If some writers update object storage directly and some readers ignore Nessie references, the guarantee collapses into convention. The catalog can only coordinate visibility for tools that participate in its protocol.',
        'It also does not make multi-table business logic correct by itself. A commit can expose a coherent set of wrong table states. Validation still matters. Access control still matters. Lineage still matters. The catalog gives teams a place to encode promotion and rollback, but it does not decide whether a release is analytically valid.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failure modes include stale long-lived branches, unsafe force-like reference moves, merge conflicts resolved without domain review, orphaned files from failed writes, tags with unclear retention meaning, and dashboards that do not record the catalog hash behind a result. Another common problem is assuming rollback is equivalent to deleting files. In a lakehouse, rollback usually means moving visibility back to a known metadata state while separately handling retention and cleanup.',
        'A mature Nessie workflow treats branch and merge operations as release engineering. Production promotion should have gates. Critical outputs should record the ref and resolved hash. Automated cleanup should understand which refs still protect old snapshots. Incident response should distinguish data-file corruption, table-metadata errors, and catalog-reference mistakes because each has a different recovery path.',
      ],
    },
    {
      heading: 'Mental model',
      paragraphs: [
        'The most useful mental model is "Git for catalog pointers, not Git for data files." A commit is a catalog-state change. A branch is an isolated line of catalog evolution. A tag is a pinned catalog state. A merge is a controlled visibility change. The payloads are table metadata references and related catalog objects.',
        'This mental model prevents two mistakes. First, it avoids treating object storage as if every byte is copied per branch. Second, it avoids treating table snapshots as enough for data-product consistency. A lakehouse needs both levels: table formats for per-table snapshots and catalog versioning for multi-table visibility.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Project Nessie home page at https://projectnessie.org/, Nessie transaction guide at https://projectnessie.org/guides/transactions/, and Nessie repository at https://github.com/projectnessie/nessie.',
        'After this, study Git Internals for commit graphs and refs, Iceberg Table Format for table snapshot metadata, Iceberg REST Catalog Protocol for engine-facing catalog calls, lakeFS for object-store versioning contrast, Two-Phase Commit for atomic visibility coordination, MVCC for snapshot reasoning, and OpenLineage for recording which catalog state produced downstream data.',
      ],
    },
  ],
};
