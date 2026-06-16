// VFS path lookup: dentries connect names to inodes, cache successful and
// negative lookups, and make repeated pathname walks cheap.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'vfs-dentry-inode-cache-case-study',
  title: 'VFS Dentry & Inode Cache',
  category: 'Systems',
  summary: 'Linux VFS resolves pathnames through cached dentries and inodes, so common directory walks avoid repeated filesystem lookups.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pathname walk', 'negative dentry case study'], defaultValue: 'pathname walk' },
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

function vfsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'proc', label: 'proc', x: 0.6, y: 4.0, note: notes.proc ?? 'open' },
      { id: 'path', label: 'path', x: 2.3, y: 4.0, note: notes.path ?? '/usr/bin' },
      { id: 'vfs', label: 'VFS', x: 4.0, y: 4.0, note: notes.vfs ?? 'walk' },
      { id: 'dcache', label: 'dcache', x: 5.5, y: 2.1, note: notes.dcache ?? 'parent+name' },
      { id: 'dentry', label: 'dentry', x: 7.3, y: 2.1, note: notes.dentry ?? 'name link' },
      { id: 'inode', label: 'inode', x: 9.1, y: 2.1, note: notes.inode ?? 'metadata' },
      { id: 'fs', label: 'fs lookup', x: 5.5, y: 5.9, note: notes.fs ?? 'slow path' },
      { id: 'pagecache', label: 'pages', x: 9.1, y: 5.9, note: notes.pagecache ?? 'file data' },
    ],
    edges: [
      { id: 'e-proc-path', from: 'proc', to: 'path', weight: '' },
      { id: 'e-path-vfs', from: 'path', to: 'vfs', weight: '' },
      { id: 'e-vfs-dcache', from: 'vfs', to: 'dcache', weight: '' },
      { id: 'e-dcache-dentry', from: 'dcache', to: 'dentry', weight: '' },
      { id: 'e-dentry-inode', from: 'dentry', to: 'inode', weight: '' },
      { id: 'e-vfs-fs', from: 'vfs', to: 'fs', weight: 'miss' },
      { id: 'e-fs-dentry', from: 'fs', to: 'dentry', weight: 'fill' },
      { id: 'e-inode-pagecache', from: 'inode', to: 'pagecache', weight: 'mapping' },
    ],
  }, { title });
}

function* pathnameWalk() {
  yield {
    state: vfsGraph('Pathname lookup walks components through the dentry cache'),
    highlight: { active: ['path', 'vfs', 'dcache'], found: ['dentry', 'inode'] },
    explanation: 'A pathname is not the file. It is a sequence of names. The VFS walks one component at a time, using the dentry cache to map parent directory plus child name to a dentry and then to an inode.',
    invariant: 'A dentry names an inode in a parent directory context.',
  };

  yield {
    state: vfsGraph('Hot path: /usr and /usr/bin are already cached', { path: '/usr/bin/node', dcache: 'hot entries', dentry: 'bin/node', inode: 'cached' }),
    highlight: { active: ['vfs', 'dcache', 'dentry', 'inode', 'e-vfs-dcache', 'e-dcache-dentry', 'e-dentry-inode'], compare: ['fs'] },
    explanation: 'Common prefixes become cheap because their dentries and inodes stay hot. Shell startup, dynamic linking, imports, and stat-heavy tools all benefit from repeated lookup through the same directory components.',
  };

  yield {
    state: vfsGraph('Cold component: ask the filesystem lookup method', { dcache: 'miss', fs: 'directory block', dentry: 'new dentry', inode: 'loaded' }),
    highlight: { active: ['vfs', 'fs', 'dentry', 'inode', 'e-vfs-fs', 'e-fs-dentry'], compare: ['dcache'] },
    explanation: 'On a cache miss, the VFS calls the filesystem-specific lookup operation for the parent inode. ext4, XFS, tmpfs, NFS, and others can all answer through the same VFS contract.',
  };

  yield {
    state: labelMatrix(
      'Objects in the lookup path',
      [
        { id: 'path', label: 'pathname' },
        { id: 'dentry', label: 'dentry' },
        { id: 'inode', label: 'inode' },
        { id: 'mapping', label: 'address_space' },
      ],
      [
        { id: 'key', label: 'key idea' },
        { id: 'changes', label: 'changes when' },
      ],
      [
        ['string from user', 'call site changes'],
        ['parent+name cache', 'rename/unlink/create'],
        ['file object metadata', 'chmod/truncate/write'],
        ['file data cache', 'read/write/page fault'],
      ],
    ),
    highlight: { active: ['dentry:key', 'inode:key', 'mapping:key'], compare: ['path:key'] },
    explanation: 'The VFS splits identity across objects. Names live in dentries, metadata lives in inodes, and file data is indexed through the inode mapping into the page cache.',
  };

  yield {
    state: vfsGraph('Once lookup succeeds, open/stat/read reuse the resolved inode', { proc: 'open()', vfs: 'resolved', inode: 'mode,size,ops', pagecache: 'data mapping' }),
    highlight: { active: ['proc', 'vfs', 'dentry', 'inode', 'pagecache', 'e-inode-pagecache'], found: ['dcache'] },
    explanation: 'After path lookup, stat can read inode metadata, open can create a file object, and read can move into the page cache. This is the name-to-data bridge that the page-cache topic starts after.',
  };
}

function* negativeDentryCaseStudy() {
  yield {
    state: vfsGraph('A missing file can still become a cached dentry', { path: '/tmp/nope', dcache: 'miss', fs: 'not found', dentry: 'negative', inode: 'NULL' }),
    highlight: { active: ['path', 'fs', 'dentry'], removed: ['inode'], compare: ['dcache'] },
    explanation: 'A negative dentry records that a name was looked up and no inode existed. That sounds strange, but it prevents repeated failed lookups from hammering directory blocks or remote filesystems.',
    invariant: 'A negative dentry has no inode, but it is still useful cache state.',
  };

  yield {
    state: vfsGraph('Repeated ENOENT returns from cache', { path: '/tmp/nope', dcache: 'negative hit', dentry: 'negative', inode: 'NULL', fs: 'not called' }),
    highlight: { active: ['vfs', 'dcache', 'dentry'], removed: ['fs', 'inode'] },
    explanation: 'The next stat("/tmp/nope") can hit the negative dentry and return ENOENT quickly. This is especially valuable for programs probing many optional config files or libraries.',
  };

  yield {
    state: vfsGraph('Create converts the negative dentry into a positive one', { path: 'open O_CREAT', dcache: 'same key', dentry: 'now positive', inode: 'new inode', fs: 'create' }),
    highlight: { active: ['path', 'fs', 'dentry', 'inode', 'e-fs-dentry', 'e-dentry-inode'], found: ['dcache'] },
    explanation: 'Kernel path-lookup documentation notes that a file creation can start with a negative dentry and then attach the new inode as part of creation. The cache entry changes meaning when the namespace changes.',
  };

  yield {
    state: labelMatrix(
      'Dentry cache correctness cases',
      [
        { id: 'rename', label: 'rename' },
        { id: 'unlink', label: 'unlink' },
        { id: 'negative', label: 'negative hit' },
        { id: 'pressure', label: 'memory pressure' },
      ],
      [
        { id: 'cache state', label: 'cache state' },
        { id: 'correctness rule', label: 'correctness rule' },
      ],
      [
        ['dentry moves', 'name and inode move together'],
        ['name removed', 'open file may still live'],
        ['no inode', 'invalidate on create'],
        ['shrink caches', 'drop reclaimable entries'],
      ],
    ),
    highlight: { active: ['rename:correctness rule', 'negative:correctness rule'], compare: ['pressure:cache state'] },
    explanation: 'The dentry cache is a namespace cache, not a permanent truth table. Rename, unlink, create, mount changes, and memory pressure all need carefully maintained cache state.',
  };

  yield {
    state: labelMatrix(
      'Why this matters in practice',
      [
        { id: 'shell', label: 'shell PATH search' },
        { id: 'node', label: 'module import' },
        { id: 'container', label: 'container overlay' },
        { id: 'nfs', label: 'network fs' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'cache payoff', label: 'cache payoff' },
      ],
      [
        ['many stats', 'hot positives and negatives'],
        ['try paths', 'avoid repeated misses'],
        ['layered lookup', 'keep common prefixes hot'],
        ['remote round trips', 'avoid slow ENOENT'],
      ],
    ),
    highlight: { active: ['shell:cache payoff', 'node:cache payoff', 'nfs:cache payoff'] },
    explanation: 'Path lookup looks mundane until it is on the hot path. Build tools, interpreters, package managers, containers, and network filesystems can spend a surprising amount of time turning names into inodes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pathname walk') yield* pathnameWalk();
  else if (view === 'negative dentry case study') yield* negativeDentryCaseStudy();
  else throw new InputError('Pick a VFS view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Linux Virtual File System is the layer that turns pathnames into filesystem objects. A dentry represents a name in a directory context and usually points to an inode. An inode represents file metadata and operations. Together they let Linux expose ext4, XFS, tmpfs, NFS, procfs, and many other filesystems through one lookup model.',
        'The cache lesson is that names are expensive. The dentry cache keeps successful and failed lookups, while the inode cache keeps metadata objects. Repeated pathname walks can stay in memory instead of asking the underlying filesystem each time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The VFS resolves a pathname component by component. For each parent directory and child name, it tries the dentry cache. On a hit, it can move to the next component. On a miss, it calls the filesystem lookup method for the parent inode, gets or creates a dentry, and attaches the inode when the name exists.',
        'A negative dentry represents a name that does not currently have an inode. It lets repeated failed lookups return quickly. If a file is created, the same name can become positive by attaching a new inode.',
      ],
    },
    {
      heading: 'Case study: missing config files',
      paragraphs: [
        'Many programs probe optional paths: config files, shared libraries, plugins, imports, and executable names along PATH. Without negative dentries, every miss would repeatedly scan directories or contact remote filesystems. With negative dentries, the VFS can remember that a specific parent-plus-name lookup failed until namespace changes invalidate that answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dentry cache saves directory lookup work, but it is correctness-sensitive. Rename, unlink, mount namespace changes, permissions, network filesystem revalidation, and memory pressure all affect whether an entry can be reused. The inode cache saves metadata allocation and loading, but cached inodes still need reference counting and eviction discipline.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A pathname is not stable object identity. The same pathname can later refer to a different inode, and an unlinked inode can remain alive while an open file description still references it. File Descriptor Table & Open File Description explains that next layer. Linux Page Cache XArray explains how the inode mapping then indexes file data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux VFS overview at https://docs.kernel.org/filesystems/vfs.html, pathname lookup documentation at https://www.kernel.org/doc/html/latest/filesystems/path-lookup.html, and filesystem API summary for inode cache helpers at https://docs.kernel.org/filesystems/api-summary.html. Study Hash Table, Tree Traversals, Linux Page Cache XArray, File Descriptor Table & Open File Description, and Filesystem Extent Trees next.',
      ],
    },
  ],
};
