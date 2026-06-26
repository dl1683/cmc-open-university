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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the branch-catalog view like a commit graph for table metadata. Active nodes show the branch or commit being changed, found nodes show a visible catalog state, and compare nodes show production state that remains pinned. A ref is a human name such as main or dev that resolves to a commit hash.',
        'The cross-table transaction view shows why the final reference move matters. Table metadata for related tables can change before production readers see it. The safe inference is that visibility changes only when the catalog ref advances to a new commit.',
        {type:'callout', text:'Nessie turns catalog visibility into a commit graph, so multi-table lakehouse changes can be tested before production readers resolve them.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Data lakes often fail at the catalog boundary. Object storage may durably hold every Parquet file, and each Iceberg table may have a valid snapshot. A dashboard can still join a new fact table to an old dimension table because related table changes became visible at different times.',
      'Project Nessie gives lakehouse catalog metadata Git-like refs, commits, tags, branches, and merges. The goal is not to copy every data file per branch. The goal is to version the pointers that tell engines which table snapshots belong to a named catalog state.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious lakehouse approach lets each table commit independently. A job updates customer_dim, another updates order_fact, and orchestration decides the order. This is simple when tables are independent.',
      'Teams often patch coordinated releases with staging directories, naming rules, and scheduler gates. Those conventions help, but they live outside the catalog contract. Any engine that refreshes midway can still observe a half-promoted release.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall appears when one business change spans multiple tables. A segmentation release may touch customers, orders, campaigns, and aggregates. If those tables move one at a time, every individual snapshot can be valid while the combined data product is wrong.',
      'Rollback has the same problem. Moving one table back does not restore the lake to a coherent point. Auditing becomes ambiguous because the downstream result came from a moving mixture of table states rather than one catalog hash.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat catalog visibility as a versioned data structure. A branch points at a commit hash, a commit records object changes such as table metadata pointer updates, and a tag pins a known state. A merge changes which commit another ref resolves next.',
      'The invariant is named-state consistency. Readers of main should resolve one catalog state, not a rolling sequence of per-table updates. Writers can build and validate elsewhere before production visibility changes.',
    ] },
    { heading: 'How it works', paragraphs: [
      'An engine resolves a branch name to a current hash, prepares table metadata changes, and commits those object changes against the branch. If the commit succeeds, the branch points at a new hash. Other branches keep resolving their previous hashes.',
      'A merge promotes changes after conflict checks and policy gates. The catalog must know the base hash and touched objects so it can reject unsafe promotions. Iceberg still owns table-level snapshots; Nessie versions the map around many table references.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness comes from separating physical existence from logical visibility. Data files and table metadata can exist before production readers resolve them. Only the reference move changes what a named audience sees.',
      'Immutable hashes make state precise. A branch name is convenient, but the resolved hash is the exact catalog state for audit, lineage, conflict checks, and reproducible queries. If a job records that hash, later readers can know which lake state produced the result.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Nessie adds a control plane. Teams need policies for who can create branches, merge to production, tag releases, force reference moves, and clean abandoned states. The value depends on engines consistently going through the catalog.',
      'Metadata retention becomes behavior. Long-lived branches can keep old snapshots reachable, which can keep files from garbage collection. Too-aggressive cleanup can delete files still protected by a ref. Versioned visibility needs retention policy as much as commit syntax.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Nessie fits multi-table data releases, backfills, feature-store changes, schema migrations, experiment branches, and data-quality gates. Production readers can stay on main while validation runs against a branch.',
      'It also helps reproducibility. A training job, notebook, or audit report can record the catalog hash it read. A tag can preserve a release state so teams can inspect or compare results later.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Nessie cannot fix engines that bypass the catalog. If some writers mutate object storage directly and some readers ignore Nessie refs, the guarantee becomes a convention again. The catalog only coordinates participants in its protocol.',
      'It also cannot prove the data is analytically correct. A coherent commit can expose wrong tables. Validation, access control, lineage, and quality tests still decide whether a release should be promoted.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A retailer releases a new segmentation model touching customer_dim, order_fact, campaign_assignment, and dashboard_daily. The team branches from main at hash a1, writes four table metadata updates on branch dev, and validates 24 checks there. Production readers keep resolving main at a1.',
      'After validation, the team tags a1 as before-segmentation and merges dev to main at hash b7. A dashboard before the merge sees the old coherent set; after the merge it sees the new coherent set. It never sees new order facts joined to old customer segments through main.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Project Nessie at https://projectnessie.org/, Nessie transactions guide at https://projectnessie.org/guides/transactions/, and the Nessie repository at https://github.com/projectnessie/nessie.',
      'Study Git internals for refs and commits, Apache Iceberg table metadata, Iceberg REST catalog protocol, MVCC snapshot reasoning, two-phase commit, lakeFS as an object-store contrast, and OpenLineage for recording catalog state in downstream work.',
    ] },
  ],
};
