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
    explanation: 'Nessie is a transactional catalog that gives a data lake branches, tags, commits, and merges. Engines can work on a branch, then promote a consistent catalog state later.',
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
    explanation: 'The ref map is the core data structure. A branch name resolves to a commit hash; a tag pins a known state; a merge changes which state other users can see.',
  };

  yield {
    state: branchGraph('Data teams can isolate changes before promoting them'),
    highlight: { active: ['dev', 'c2', 'orders', 'cust', 'e-c2-orders', 'e-c2-cust'], compare: ['main'], found: ['tag'] },
    explanation: 'A team can update several Iceberg tables on a dev branch, run validation, and keep production readers pinned to main until the branch is merged.',
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
    explanation: 'The workflow looks like software version control, but the guarded asset is table metadata. The merge operation is a visibility decision for data consumers.',
  };
}

function* crossTableTxn() {
  yield {
    state: txnGraph('A single catalog commit can expose many table changes together'),
    highlight: { active: ['a', 'b', 'commit', 'e-a-commit', 'e-b-commit'], found: ['view'] },
    explanation: 'Nessie supports a commit containing multiple object changes. That lets connected table updates become visible as one catalog state instead of leaking partial lakehouse changes.',
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
    explanation: 'Cross-table transactions need read state, write set, conflict checks, and an atomic reference move. Otherwise dashboards can observe table A after migration and table B before migration.',
    invariant: 'The visible catalog state should advance as a unit when downstream users need the tables to agree.',
  };

  yield {
    state: txnGraph('Isolation depends on recording what was read and changed'),
    highlight: { active: ['read', 'conflict', 'commit', 'e-commit-conflict'], compare: ['ref'], found: ['view'] },
    explanation: 'Nessie exposes primitives for isolation by resolving a ref to a commit hash and checking whether later commits changed tables that the transaction read or wrote.',
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
    explanation: 'A common case is changing dimensions and facts together. Branch validation plus an atomic catalog promotion keeps downstream dashboards from seeing half the migration.',
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
      heading: 'What it is',
      paragraphs: [
        'Project Nessie is a transactional catalog for data lakes with Git-like semantics. It gives lakehouse metadata named branches, tags, commits, merges, and cross-table visibility control, especially with Apache Iceberg tables.',
        'This topic links Git Internals, lakeFS Data Lake Version Graph Case Study, Iceberg Table Format Case Study, Iceberg REST Catalog Protocol Case Study, Two-Phase Commit, and OpenLineage Metadata Lineage Graph Case Study. Git and lakeFS explain version graphs; Iceberg explains table metadata; Nessie adds catalog transactions over the lake.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Nessie ref such as main or dev resolves to a commit hash. A commit records catalog changes such as table metadata pointer updates. Tags pin known states. Branches isolate work. Merges make a branch state visible to another branch.',
        'For cross-table changes, a commit can include multiple object changes. A branch can also collect several commits and later expose the sequence through a merge. That makes table visibility a catalog decision instead of a race between independent table commits.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The central data structures are refs, commit hashes, commit logs, object changes, table identifiers, branch heads, tags, merge operations, read sets, write sets, and conflict checks. These structures sit above table-format metadata files.',
        'Nessie is not a replacement for Iceberg manifests or Parquet files. It versions the catalog references that point engines toward the current table metadata roots, and it gives teams a transactional history over those references.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Large data lakes often have related tables that must change together. Without catalog-level transactions, downstream users can observe partial migrations, broken dimensions, or mixed schema versions.',
        'Nessie gives data teams a safer promotion workflow: branch, write, validate, tag, merge, and roll back. The mental model becomes closer to source-code release management, but applied to data table metadata.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main risks are stale refs, unsafe merges, tools that do not expose isolation primitives, branch drift, orphaned files from failed writers, unclear rollback expectations, and assuming Git-like names mean Git-like storage of data bytes.',
        'A mature Nessie deployment needs branch policy, merge validation, commit observability, garbage collection, access control, clear engine compatibility, and lineage that records which catalog hash produced a downstream dataset.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Project Nessie home page at https://projectnessie.org/, Nessie transaction guide at https://projectnessie.org/guides/transactions/, and Nessie repository at https://github.com/projectnessie/nessie.',
        'Study this with Iceberg REST Catalog Protocol for the engine-facing API, lakeFS for object-store version graphs, Iceberg Table Format for snapshot metadata, and dbt/OpenLineage for downstream transformation and lineage graphs.',
      ],
    },
  ],
};
