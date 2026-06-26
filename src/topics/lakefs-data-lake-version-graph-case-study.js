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
      heading: 'How to read the animation',
      paragraphs: [
        'The branch-commit graph view shows refs, commits, and parent edges. A ref is a name such as main or experiment that points to a commit. A commit is a durable snapshot of the logical object map.',
        'The object-versioning view shows why the graph matters. Reads through a commit resolve paths through metadata to physical objects. The safe inference is that changing a branch later does not change what an older commit meant.',
        {type: 'callout', text: 'lakeFS turns object storage paths into versioned logical refs, so publication, rollback, and reproducibility become metadata operations instead of risky blob rewrites.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph shown with vertices ordered so each edge points from earlier to later.', caption: 'Topological ordering diagram by David Eppstein, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A data lake stores many files in object storage, but production data work needs release semantics. Teams publish tables, backfill partitions, test features, roll back bad data, and prove which files a model or dashboard used. Plain prefixes do not provide a transaction boundary.',
        'lakeFS adds version control over object stores. It gives repositories, branches, commits, merges, tags, hooks, and reproducible reads while the bytes remain in S3, GCS, Azure Blob, or compatible storage. The system is a metadata control plane for data lake versions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is prefix discipline. Write new data under staging/date=2026-06-25, validate it, then copy or rename objects into production/date=2026-06-25. If a problem appears, copy old files back or point jobs at yesterday.',
        'That works when one pipeline owns a small number of files. It fails when a release spans many objects and readers run while writes are still happening. A prefix is a naming convention, not an atomic publication event.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multi-object consistency. A table snapshot can include hundreds of Parquet files, manifests, checkpoints, and derived outputs. If publication is many independent object writes, readers can observe a mixed state.',
        'The second wall is experimentation without full copies. A backfill may change 5 percent of a 100 TB lake. Copying 100 TB for every experiment is too expensive, but mutating production in place is unsafe.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate logical identity from physical object addresses. A reader asks for a ref and path, and lakeFS resolves that pair through metadata to concrete object versions. The physical bytes can be shared while logical versions remain distinct.',
        'This makes branches cheap when most data is unchanged. A new branch can point to the same committed map as main. Writing one path records a branch-local change, and merging advances the target ref only after validation and conflict checks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A repository groups related data. A branch is a mutable ref. A commit freezes a metadata state and records parent history. A merge incorporates changes from one ref into another and creates a new target commit.',
        'The backing store holds physical objects. lakeFS metadata maps repository paths and refs to those objects. Hooks can run schema checks, row-count checks, privacy scans, or table-format validation before a merge to main.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is a naming invariant. If a reader pins commit C, path data/events resolves through the object map for C. Later writes to branch dev or main do not change C. Reproducibility comes from binding a logical name to a stable metadata state.',
        'Rollback works for the same reason. If main moves from commit A to bad commit B, operators can reset or revert to A. The system is not guessing from timestamps or object listings; it has an explicit graph of named states.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Branches are cheap when they share objects, but rewrites are not free. If a compaction job rewrites 20 TB of files, the version graph now preserves old and new objects until retention rules allow cleanup. Cost grows with changed bytes and retained history, not with branch count alone.',
        'Metadata becomes part of the read path. Commit lookup, path resolution, conflict detection, hooks, authorization, and garbage collection must be monitored and backed up. Cost as behavior means safer publication in exchange for a stateful control plane.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'lakeFS fits data release workflows. A daily pipeline can write to a branch, run tests, commit, and merge only if checks pass. Dashboards then read one published snapshot instead of a prefix changing underneath them.',
        'It also fits ML feature pipelines and risky maintenance. Training can pin commit X, evaluation can pin commit Y, and a GDPR delete or schema migration can be tested on a branch before publication. The graph records what changed and when.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'lakeFS does not help readers that bypass versioned refs and read raw object paths. The value depends on integrating query engines, catalogs, credentials, and jobs so they resolve through lakeFS. One unversioned reader can break the reproducibility story.',
        'It also does not prove data quality by itself. Hooks only catch what they test. Two branches can both update different paths and still create a semantic conflict in a business metric, so domain checks remain necessary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A lake has 100 TB under main. A fraud team creates branch risk-model from commit A. The branch creation is metadata only, so it does not copy 100 TB. The team backfills 500 GiB of new feature files and updates a manifest.',
        'Tests show one partition has a bad row count, so the branch is not merged. Production readers pinned to main still resolve commit A and see none of the 500 GiB backfill. After fixing the partition, the team commits and merges, creating commit B on main.',
        'If commit B breaks a dashboard, rollback means moving main back to A or creating a revert commit, depending on policy. The cost is retained bytes: both the old objects and the 500 GiB changed objects remain reachable until retention and garbage collection allow deletion.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: lakeFS concepts at https://docs.lakefs.io/understand/model/, data structure at https://docs.lakefs.io/understand/data-structure/, versioning internals at https://docs.lakefs.io/understand/how/versioning-internals/, and merge documentation at https://docs.lakefs.io/understand/how/merge/.',
        'Study Git refs and commits, object storage consistency, Parquet, Apache Iceberg, Delta Lake, Apache Hudi, Project Nessie, OpenLineage, data quality hooks, and garbage collection next.',
      ],
    },
  ],
};