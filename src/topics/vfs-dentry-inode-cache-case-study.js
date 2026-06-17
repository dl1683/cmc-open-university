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
      heading: 'Why this exists',
      paragraphs: [
        'Every open, stat, import, shell PATH search, and dynamic-library lookup starts with the same problem: turn a human-facing pathname into kernel objects. The string /usr/bin/node is not the file. It is a sequence of names interpreted one component at a time under a mount namespace, permission context, and filesystem implementation.',
        'Doing that from scratch would be ruinous. Programs repeatedly walk the same prefixes: /usr, /lib, /etc, node_modules, Python package paths, container overlay layers, and shared-library directories. The VFS dentry and inode caches exist because namespace answers are hot. If the kernel recently learned what a parent directory plus child name means, it should not ask the disk or remote filesystem again unless something changed.',
        'The important design point is that Linux does not have one filesystem. ext4, XFS, tmpfs, overlayfs, NFS, procfs, and many others all expose files through the Virtual Filesystem layer. The VFS gives pathname lookup a common contract while still letting each filesystem answer misses in its own way.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first idea is to cache absolute path strings: /usr/bin/node maps to this file, /tmp/nope maps to missing. That works until rename, unlink, mount namespaces, chroot, bind mounts, permissions, and parent-directory changes enter the picture.',
        'Linux caches one component at a time. The key is not just a string; it is parent directory context plus child name. That smaller invariant lets the kernel update only the affected namespace edges when the tree changes.',
        'Another tempting simplification is to think the pathname is identity. It is not. The same path can refer to different inodes in different mount namespaces. The same inode can be reached by several names. An inode can stay alive after its name has been unlinked if a process still holds an open file. Pathnames are routes through a namespace, not permanent object IDs.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A positive dentry says: in this parent directory, this name currently reaches this inode. A negative dentry says: in this parent directory, this name was looked up and currently has no inode. The inode then holds file metadata, operations, and the mapping that leads to cached file data.',
        'The correctness rule is local: namespace operations such as create, unlink, and rename must update or invalidate the dentries whose parent-plus-name answers changed. The cache can be fast only because those answers have a precise scope.',
        'That split between name and object is the core insight. Dentries cache namespace edges. Inodes represent filesystem objects and metadata. Page cache entries hold file data. File descriptors refer to open file descriptions after lookup succeeds. Keeping those identities separate is what lets Linux support hard links, renames, open-but-unlinked files, mount points, and many filesystem implementations without pretending path strings are stable truth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A pathname walk starts with a starting directory: root for absolute paths, current working directory for relative paths, or another directory file descriptor for openat-style APIs. The VFS splits the path into components and resolves each component against the current parent dentry and inode. For each child name, it first checks the dentry cache.',
        'On a positive cache hit, the dentry points to an inode, and the walk can continue. On a negative cache hit, the kernel knows that name was recently looked up and did not exist in that parent, so it can return ENOENT without asking the filesystem again. On a miss, the VFS calls the filesystem-specific lookup method, then installs a positive or negative dentry according to the result.',
        'After lookup reaches the final inode, later operations depend on what the caller requested. stat reads metadata. open creates a file object. read and write eventually interact with the inode mapping and page cache. The dentry cache is therefore the front door to several other kernel caches rather than the whole file I/O story.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The pathname-walk view proves that a path is resolved through a chain of component lookups. The hot path shows repeated prefixes being answered from dcache and inode cache. The cold path shows where the generic VFS has to delegate to ext4, XFS, tmpfs, NFS, or another filesystem.',
        'The object table proves the identity split. A pathname is input text. A dentry is a parent-plus-name cache entry. An inode is the file object metadata and operations. The address_space mapping points toward cached file data. Mixing those roles leads to wrong explanations of rename, unlink, hard links, and open file behavior.',
        'The negative-dentry case study proves that even failure can be cached. A missing optional config file, module path, or shared library candidate may be checked repeatedly. Remembering that a name is absent can save as much work as remembering that it exists, especially on network filesystems where a miss may require remote round trips.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because namespace locality is high. Programs do not choose paths uniformly at random. They check the same directories, load the same libraries, import the same modules, and probe the same optional files. Component-level caching turns that locality into repeated memory lookups instead of repeated filesystem work.',
        'It also works because the cache key is scoped correctly. Parent directory plus child name is small enough to invalidate when the namespace changes but expressive enough to reuse across many full paths. If /usr is hot, every path under /usr can benefit from that component before diverging into its own suffix.',
        'Negative dentries work for the same reason. Many applications search lists of candidate names. Most candidates are absent. Caching absence prevents the system from repeatedly proving the same nonexistence.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'A warm pathname walk is still O(number of components), but each component can be a memory lookup. A cold component pays filesystem lookup cost and may trigger I/O. On a local disk that can be noticeable; on a remote filesystem it can dominate. Negative dentries save repeated failed lookups, but they still consume memory and must be invalidated correctly.',
        'The engineering cost is cache coherence. Cached dentries and inodes need reference counts, RCU path-walk rules, shrinkers, revalidation hooks, and careful behavior under rename, unlink, create, mount changes, permissions, network filesystem consistency, and memory pressure. The cache must be fast on the common path without lying after the namespace changes.',
        'There is also a security cost to sloppy mental models. If a program checks a path and then uses it later, a rename or symlink race may change what that path means. Modern APIs such as openat and directory file descriptors exist partly to make path resolution more explicit and less race-prone.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Dentry and inode caching wins in shell PATH search, language module imports, dynamic linking, package managers, build tools, container overlays, web servers serving repeated files, and NFS paths with expensive misses. It is one reason stat-heavy workloads can become much faster after warming up.',
        'It is especially important in developer tooling. A JavaScript or Python process may probe many directories before resolving one import. A build tool may stat thousands of files. A container runtime may traverse layered filesystems. These workloads look like ordinary path usage from user space, but inside the kernel they are cache stress tests.',
        'The model also helps explain production incidents. If a workload slows after cache pressure, after a container image layout change, or after moving from local disk to network storage, path lookup behavior may be part of the story.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main conceptual failure is treating a pathname as stable identity. A path can be renamed, replaced, shadowed by a mount, interpreted differently in another namespace, or disconnected from an inode that still has open references. Correct programs should hold file descriptors or directory handles when identity matters.',
        'The main cache failure is stale or overbroad assumptions. Network filesystems may need revalidation. Overlay filesystems add layered lookup behavior. Memory pressure can evict entries. A warm-cache benchmark may not represent cold start, and a cold-cache benchmark may exaggerate production cost if hot prefixes persist.',
        'Another failure is ignoring negative lookups. Missing files can be a performance problem. Repeated optional-config probes, extension searches, and package resolution misses can hammer the namespace unless negative dentries stay hot.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux VFS overview at https://docs.kernel.org/filesystems/vfs.html, pathname lookup documentation at https://www.kernel.org/doc/html/latest/filesystems/path-lookup.html, and filesystem API summary for inode cache helpers at https://docs.kernel.org/filesystems/api-summary.html. Study Hash Table for lookup mechanics, Tree Traversals for pathname walks, File Descriptor Table & Open File Description for the object after open, Linux Page Cache XArray for file data, and Filesystem Extent Trees for disk mapping.',
        'A useful exercise is to trace stat calls for a shell command or module import, then repeat after warmup. Count positive lookups, negative lookups, and repeated prefixes. That connects the abstract dentry/inode split to visible workload behavior.',
      ],
    },
  ],
};
