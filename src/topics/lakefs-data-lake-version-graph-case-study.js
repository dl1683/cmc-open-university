// lakeFS: Git-like branches, commits, merges, and object metadata for data
// lakes backed by object storage.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lakefs-data-lake-version-graph-case-study',
  title: 'lakeFS Data Lake Version Graph Case Study',
  category: 'Systems',
  summary: 'lakeFS as a data-lake versioning lesson: branches isolate object changes, commits make reproducible points, and merges publish data atomically.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['branch commit graph', 'object versioning'], defaultValue: 'branch commit graph' },
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

function versionGraph(title) {
  return graphState({
    nodes: [
      { id: 'repo', label: 'repo', x: 0.7, y: 3.5, note: 'namespace' },
      { id: 'main', label: 'main', x: 2.4, y: 2.0, note: 'branch ref' },
      { id: 'dev', label: 'dev', x: 2.4, y: 5.0, note: 'branch ref' },
      { id: 'c1', label: 'commit A', x: 4.4, y: 2.0, note: 'prod data' },
      { id: 'c2', label: 'commit B', x: 4.4, y: 5.0, note: 'experiment' },
      { id: 'merge', label: 'merge', x: 6.4, y: 3.5, note: 'atomic publish' },
      { id: 'c3', label: 'commit C', x: 8.3, y: 3.5, note: 'new main' },
      { id: 'hooks', label: 'hooks', x: 6.4, y: 1.2, note: 'checks' },
    ],
    edges: [
      { id: 'e-repo-main', from: 'repo', to: 'main', weight: 'has' },
      { id: 'e-repo-dev', from: 'repo', to: 'dev', weight: 'has' },
      { id: 'e-main-c1', from: 'main', to: 'c1', weight: 'points' },
      { id: 'e-dev-c2', from: 'dev', to: 'c2', weight: 'points' },
      { id: 'e-c1-merge', from: 'c1', to: 'merge', weight: 'base' },
      { id: 'e-c2-merge', from: 'c2', to: 'merge', weight: 'source' },
      { id: 'e-hooks-merge', from: 'hooks', to: 'merge', weight: 'gate' },
      { id: 'e-merge-c3', from: 'merge', to: 'c3', weight: 'commit' },
      { id: 'e-c3-main', from: 'c3', to: 'main', weight: 'advance' },
    ],
  }, { title });
}

function objectGraph(title) {
  return graphState({
    nodes: [
      { id: 'branch', label: 'branch view', x: 0.7, y: 3.5, note: 'logical tree' },
      { id: 'meta', label: 'metadata', x: 2.8, y: 2.0, note: 'keys + versions' },
      { id: 'obj1', label: 'object v1', x: 4.8, y: 1.5, note: 'physical blob' },
      { id: 'obj2', label: 'object v2', x: 4.8, y: 4.0, note: 'new blob' },
      { id: 'store', label: 'object store', x: 7.0, y: 2.8, note: 'S3/GCS/Azure' },
      { id: 'reader', label: 'reader', x: 9.0, y: 3.5, note: 'read ref/path' },
      { id: 'gc', label: 'GC', x: 7.0, y: 5.3, note: 'retention' },
    ],
    edges: [
      { id: 'e-branch-meta', from: 'branch', to: 'meta', weight: 'path map' },
      { id: 'e-meta-obj1', from: 'meta', to: 'obj1', weight: 'old' },
      { id: 'e-meta-obj2', from: 'meta', to: 'obj2', weight: 'new' },
      { id: 'e-obj1-store', from: 'obj1', to: 'store', weight: 'blob' },
      { id: 'e-obj2-store', from: 'obj2', to: 'store', weight: 'blob' },
      { id: 'e-store-reader', from: 'store', to: 'reader', weight: 'serve' },
      { id: 'e-gc-store', from: 'gc', to: 'store', weight: 'clean' },
      { id: 'e-meta-reader', from: 'meta', to: 'reader', weight: 'resolve' },
    ],
  }, { title });
}

function* branchCommitGraph() {
  yield {
    state: versionGraph('lakeFS applies Git-like versioning to data lakes'),
    highlight: { active: ['repo', 'main', 'dev', 'c1', 'c2'], found: ['merge'] },
    explanation: 'lakeFS represents a repository as a namespace with branches and commits. A branch isolates writes, a commit records a reproducible point, and a merge publishes changes atomically.',
  };

  yield {
    state: labelMatrix(
      'Versioning objects',
      [
        { id: 'repo', label: 'R' },
        { id: 'branch', label: 'B' },
        { id: 'commit', label: 'C' },
        { id: 'merge', label: 'M' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'job', label: 'job' },
      ],
      [
        ['objects', 'scope'],
        ['ref', 'isolate'],
        ['point', 'repeat'],
        ['diff', 'publish'],
      ],
    ),
    highlight: { found: ['branch:job', 'commit:job', 'merge:job'], compare: ['repo:holds'] },
    explanation: 'The mental model is Git semantics over lake objects. The data structure is a graph of refs and commits plus object metadata that resolves paths to physical blobs.',
    invariant: 'Readers pinned to a commit see a stable data snapshot.',
  };

  yield {
    state: versionGraph('Pre-merge hooks can gate data publication'),
    highlight: { active: ['hooks', 'merge', 'e-hooks-merge'], compare: ['c2'], found: ['c3'] },
    explanation: 'A data branch can run validation before merge: schema checks, row counts, quality tests, privacy scans, or table-format validation. The merge becomes the controlled publication step.',
  };

  yield {
    state: labelMatrix(
      'Data release flow',
      [
        { id: 'w', label: 'W' },
        { id: 't', label: 'T' },
        { id: 'c', label: 'C' },
        { id: 'm', label: 'M' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['write', 'dirty'],
        ['test', 'fail'],
        ['commit', 'stale'],
        ['merge', 'conflict'],
      ],
    ),
    highlight: { active: ['t:move', 'm:risk'], found: ['c:move'] },
    explanation: 'A complete release flow writes data on an isolated branch, validates it, commits it, then merges to the production branch. If tests fail, production never sees the broken objects.',
  };
}

function* objectVersioning() {
  yield {
    state: objectGraph('lakeFS maps logical paths to versioned physical objects'),
    highlight: { active: ['branch', 'meta', 'obj1', 'obj2'], found: ['store'] },
    explanation: 'Object stores do not natively give Git-like branch semantics. lakeFS adds a metadata layer that maps repository paths and refs to object versions in S3, GCS, Azure Blob, or compatible stores.',
  };

  yield {
    state: labelMatrix(
      'Path resolution',
      [
        { id: 'ref', label: 'Ref' },
        { id: 'path', label: 'Path' },
        { id: 'meta', label: 'Meta' },
        { id: 'blob', label: 'Blob' },
      ],
      [
        { id: 'in', label: 'in' },
        { id: 'out', label: 'out' },
      ],
      [
        ['main', 'commit'],
        ['a.parq', 'entry'],
        ['version', 'addr'],
        ['S3 key', 'bytes'],
      ],
    ),
    highlight: { active: ['ref:out', 'meta:out'], found: ['blob:out'] },
    explanation: 'A read starts with a ref and path. The metadata layer resolves that to a concrete object address. That indirection is what makes branch reads and time travel possible without copying every object.',
  };

  yield {
    state: objectGraph('Retention and garbage collection protect shared versions'),
    highlight: { active: ['gc', 'store', 'obj1', 'obj2'], compare: ['reader'] },
    explanation: 'Physical objects may be reachable from multiple commits or branches. Garbage collection and retention policy must preserve objects that any live reference can still read.',
  };

  yield {
    state: labelMatrix(
      'Conflict and rollback',
      [
        { id: 'same', label: 'S' },
        { id: 'diff', label: 'D' },
        { id: 'roll', label: 'R' },
        { id: 'audit', label: 'A' },
      ],
      [
        { id: 'case', label: 'case' },
        { id: 'act', label: 'act' },
      ],
      [
        ['same key', 'resolve'],
        ['new key', 'merge'],
        ['bad data', 'reset'],
        ['history', 'trace'],
      ],
    ),
    highlight: { active: ['same:act', 'roll:act'], found: ['audit:act'] },
    explanation: 'The version graph gives teams a practical incident move: find the bad commit, inspect changed paths, and reset or revert the branch to a known-good commit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'branch commit graph') yield* branchCommitGraph();
  else if (view === 'object versioning') yield* objectVersioning();
  else throw new InputError('Pick a lakeFS view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'lakeFS is a version-control layer for data lakes. It applies Git-like semantics to object storage: repositories, branches, commits, merges, hooks, rollback, and reproducible reads over datasets stored in S3, GCS, Azure Blob, or compatible object stores.',
        'This case study connects Git Internals, Merkle Tree, S3 Multipart Upload Manifest, Delta Lake Case Study, Apache Iceberg Table Format Case Study, and OpenLineage Metadata Lineage Graph Case Study. The lesson is the data-lake control plane around object versions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lakeFS repository is a logical namespace for related data. Branches point to committed states. Writes happen on branches, commits create reproducible points, and merges atomically publish a set of changes. Readers can access data by branch, tag, or commit-like reference.',
        'The physical data remains in object storage. lakeFS maintains metadata that maps logical paths and refs to physical object versions. That indirection makes branch isolation possible without copying an entire lake for every experiment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Versioning introduces metadata and lifecycle work. The system must resolve paths quickly, preserve objects still reachable from live refs, garbage-collect safely, handle merge conflicts, and enforce authorization. Hooks and policies must run at the right boundary so bad data does not reach production branches.',
        'The cost model depends on object churn. Branches are cheap when they mostly share objects, but large rewrites create many new physical blobs. Retention policies decide how far back rollback and audit can go.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A data team builds a daily customer feature table. Instead of writing directly to production, the pipeline writes to a lakeFS branch named features-2026-06-15. It runs schema checks, row-count checks, null-rate checks, and a sample model-scoring check. If the hooks pass, the branch merges into main atomically.',
        'If downstream dashboards break, the team can inspect the exact commit that changed main, compare path diffs, and roll back to the previous commit. The data lake now has a release process rather than a pile of mutable object prefixes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'lakeFS does not make object storage transactional by itself for arbitrary external readers. The benefit comes from reading and writing through lakeFS refs and respecting the versioning model. Another misconception is that Git semantics remove data-quality work. Branches make validation safer, but teams still need tests, hooks, ownership, lineage, and rollback drills.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: lakeFS documentation at https://docs.lakefs.io/, concepts and model at https://docs.lakefs.io/understand/model/, data structure documentation at https://docs.lakefs.io/understand/data-structure/, and branch/merge guide at https://docs.lakefs.io/integrations/python-versioning-branches/. Study Git Internals, S3 Multipart Upload Manifest, Delta Lake Case Study, Apache Iceberg Table Format Case Study, and OpenLineage Metadata Lineage Graph Case Study next.',
      ],
    },
  ],
};
