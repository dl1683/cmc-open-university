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
      heading: 'Why this exists',
      paragraphs: [
        'A data lake looks like a directory tree, but production data work needs more than paths. Teams need to publish tables, backfill partitions, test feature datasets, roll back bad releases, and prove which files a model or dashboard read. Plain object storage gives durable blobs and cheap listing, but it does not give a release process.',
        'lakeFS adds a version-control layer over object stores. It gives data teams repositories, branches, commits, merges, tags, hooks, and reproducible reads while the physical bytes remain in S3, GCS, Azure Blob, or a compatible store. The system is best read as a metadata control plane that names and protects versions of lake objects.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is prefix discipline. Write incoming data under staging/date=2026-06-17, validate it, then copy or rename objects into production/date=2026-06-17. If something breaks, copy old files back or point jobs at yesterday. This works while the lake is small and one pipeline owns the files.',
        'The approach is reasonable because object stores are simple and cheap. Prefixes are easy to explain, and many tools already know how to read them. The problem is that a prefix is not a transaction boundary. A reader can see half a release, a retry can mix old and new objects, and a rollback can become another unsafe batch of object mutations.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is consistency across many objects. A table snapshot may involve hundreds of Parquet files, manifests, logs, checkpoints, and derived outputs. If publication is just a set of object writes, the lake has no single moment that means this version is now live.',
        'The second wall is experimentation. Backfills, schema migrations, quality repairs, and feature engineering need isolation. Copying the whole lake for every experiment is too expensive. Mutating production in place is too risky. Teams need cheap branches that share unchanged data and record only what differs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate logical data identity from physical object addresses. A reader should ask for a ref and a path, not for whatever bytes happen to be under a mutable prefix at this moment. lakeFS resolves that ref and path through metadata to a concrete object version.',
        'That indirection turns branch creation into metadata work. A branch can point at the same committed object map as main. When a pipeline changes one path, lakeFS records a new version for that path while unchanged paths remain shared. A commit freezes the branch state. A merge advances the target branch to a new committed state instead of copying every blob.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A repository is a logical namespace for related data. A branch is a mutable reference to a committed state plus possible uncommitted changes. A commit records a reproducible point in the repository history. A merge incorporates changes from one ref into a destination branch and creates a new target commit.',
        'The physical objects stay in the backing store. lakeFS keeps metadata that maps repository paths and refs to physical addresses. Reads through a commit see stable metadata. Writes on a branch update staging metadata for that branch. Commit and merge operations move the visible ref only after the metadata state is coherent.',
        'Hooks make the merge boundary useful. A team can require schema checks, row-count checks, privacy scans, partition checks, table-format validation, or custom data quality tests before a branch can merge to main. The same idea appears in software delivery, but the artifact is a data lake snapshot rather than a binary or source tree.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The visible data structure is a version graph: repositories contain branch refs, branch refs point to commits, commits have parents, and merges create new commits on the target branch. Tags or commit identifiers let readers pin a historical state.',
        'The hidden data structure is the object metadata map. It records logical paths, versions, physical addresses, checksums or identity fields, and enough reachability information to preserve objects still needed by live refs. Garbage collection and retention policy must respect that graph. An object that looks old physically may still be reachable from a tag, branch, or historical commit.',
        'This is close to Git in user shape but not identical in implementation goals. Data files are large, object stores have different semantics than local disks, and table formats such as Delta Lake, Iceberg, Hudi, or plain Parquet may add their own metadata above the object files. lakeFS has to cooperate with those layers rather than pretend every dataset is just source code.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a naming argument. If a reader uses a commit ref, the ref resolves to one committed metadata state. Later writes on a branch do not change that commit. Reproducibility comes from the fact that the logical name is bound to a stable object map.',
        'Branch isolation works because branch writes create branch-local metadata changes. A writer on dev can replace path features/users.parquet without changing the object version that main resolves for the same path. Merge is the controlled point where the target branch is allowed to advance.',
        'Rollback works for the same reason. If main moved from commit A to commit B and B is bad, the team can reset or revert to a known-good ref. The system is not guessing from timestamps or reconstructing state from object listings. It has an explicit history of named states.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Branches are cheap when they share most objects. Creating a branch does not require duplicating the lake. The cost appears when jobs rewrite data. A compaction job, full backfill, or table rewrite can create many new physical objects even if the logical change is one table version.',
        'Metadata becomes part of the serving path. Path resolution, commit lookup, branch staging, conflict detection, hook execution, authorization, and garbage collection now matter to data reliability. A lakeFS deployment is not only storage; it is a stateful service whose metadata store must be backed up, monitored, and sized for the workload.',
        'Retention is an explicit tradeoff. Long history improves audit and rollback but preserves more objects. Aggressive garbage collection lowers storage cost but reduces the time window for recovery. The right policy depends on compliance, incident response, model reproducibility, and object churn.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'lakeFS fits data release workflows. A daily pipeline can write to a branch, run validation, commit, and merge only after the table passes. Downstream dashboards then see one published snapshot rather than a directory that changed while they were reading it.',
        'It also fits ML feature pipelines. Training, evaluation, and online-serving backfills can pin exact refs. If a model was trained on commit X and evaluated on commit Y, that statement can be inspected later. This is stronger than saying the files came from some date prefix that may have been overwritten.',
        'The pattern is useful for risky maintenance: GDPR deletes, partition rewrites, schema migrations, late-arriving data repairs, and multi-table releases. In each case the branch is a workspace, the commit is a reproducible checkpoint, and the merge is the publication event.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'lakeFS does not make object storage transactional for readers that bypass lakeFS refs. If a query engine reads raw object paths directly, it can ignore the version graph. The benefit depends on integrating tools, catalogs, credentials, and job code so they resolve data through the versioned namespace.',
        'It also does not replace data quality. A branch can isolate bad data, but it cannot know that a label column is semantically wrong unless a test checks it. Hooks are only as good as the checks behind them. A weak validation suite gives a well-versioned bad release.',
        'Conflict handling is another boundary. Git-style names make conflicts visible, but data conflicts can be semantic. Two branches may both update a customer table in ways that do not collide by object path but still break a business rule. Versioning gives the place to detect the issue; it does not remove the need for domain checks.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Watch merge failures, hook failures, conflict rates, branch age, uncommitted object counts, commit latency, path-resolution latency, metadata-store errors, object-store request failures, and garbage-collection backlog. These are control-plane signals, not just storage signals.',
        'For data correctness, compare release commits with downstream incidents. Track which jobs read by branch, tag, or commit and which jobs still read raw object paths. A single unversioned reader can undo the reproducibility story for a whole workflow.',
        'For cost, track object churn per commit, retained bytes by ref, old branches that keep data alive, and compaction jobs that rewrite large table regions. Version graphs are cheap when changes are narrow and expensive when every release rewrites the world.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Git Internals for refs, commits, and merges. Study Content-Addressed Merkle DAG Object Store for the storage identity pattern. Study S3 Object Storage, Parquet Columnar Format, Delta Lake, Apache Iceberg, Apache Hudi, Project Nessie, and OpenLineage for the surrounding lakehouse stack.',
        'Official sources: lakeFS concepts and model at https://docs.lakefs.io/understand/model/, data structure documentation at https://docs.lakefs.io/understand/data-structure/, versioning internals at https://docs.lakefs.io/understand/how/versioning-internals/, and branch and merge documentation at https://docs.lakefs.io/understand/how/merge/.',
      ],
    },
  ],
};
