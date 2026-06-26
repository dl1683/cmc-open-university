// POSIX file descriptors: small per-process integers pointing at open file
// descriptions, which then point at files, sockets, pipes, or devices.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'file-descriptor-table-open-file-description',
  title: 'File Descriptor Table & Open File Description',
  category: 'Systems',
  summary: 'A file descriptor is a per-process integer reference to an open file description, which owns the file offset, status flags, and underlying object reference.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fd to open file description', 'dup fork close case study'], defaultValue: 'fd to open file description' },
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

function fdGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'proc', label: 'process', x: 0.7, y: 4.0, note: notes.proc ?? 'task' },
      { id: 'fdtab', label: 'fd table', x: 2.4, y: 4.0, note: notes.fdtab ?? 'per process' },
      { id: 'fd3', label: 'fd 3', x: 4.2, y: 2.3, note: notes.fd3 ?? 'read' },
      { id: 'fd4', label: 'fd 4', x: 4.2, y: 5.7, note: notes.fd4 ?? 'dup?' },
      { id: 'ofd', label: 'open file', x: 6.3, y: 4.0, note: notes.ofd ?? 'offset+flags' },
      { id: 'dentry', label: 'dentry', x: 8.2, y: 2.4, note: notes.dentry ?? 'name' },
      { id: 'inode', label: 'inode', x: 9.5, y: 4.0, note: notes.inode ?? 'object' },
      { id: 'pages', label: 'pages', x: 8.2, y: 5.8, note: notes.pages ?? 'mapping' },
    ],
    edges: [
      { id: 'e-proc-fdtab', from: 'proc', to: 'fdtab', weight: '' },
      { id: 'e-fdtab-fd3', from: 'fdtab', to: 'fd3', weight: 'slot' },
      { id: 'e-fdtab-fd4', from: 'fdtab', to: 'fd4', weight: 'slot' },
      { id: 'e-fd3-ofd', from: 'fd3', to: 'ofd', weight: 'ref' },
      { id: 'e-fd4-ofd', from: 'fd4', to: 'ofd', weight: 'ref' },
      { id: 'e-ofd-dentry', from: 'ofd', to: 'dentry', weight: 'path ref' },
      { id: 'e-ofd-inode', from: 'ofd', to: 'inode', weight: 'file' },
      { id: 'e-inode-pages', from: 'inode', to: 'pages', weight: 'data' },
    ],
  }, { title });
}

function* fdToOpenFileDescription() {
  const graphNodes = ['proc', 'fdtab', 'fd3', 'fd4', 'ofd', 'dentry', 'inode', 'pages'];
  const graphEdges = ['e-proc-fdtab', 'e-fdtab-fd3', 'e-fdtab-fd4', 'e-fd3-ofd', 'e-fd4-ofd', 'e-ofd-dentry', 'e-ofd-inode', 'e-inode-pages'];
  yield {
    state: fdGraph('open() returns a descriptor for an open file description', { fd4: 'empty' }),
    highlight: { active: ['proc', 'fdtab', 'fd3', 'ofd'], found: ['inode'] },
    explanation: `A file descriptor is the small integer user space passes to read, write, close, poll, and epoll_ctl. The ${graphNodes.length}-node reference graph shows the per-process descriptor table pointing through ${graphEdges.length} edges to the open file description and underlying object.`,
    invariant: `The fd number is per process; the open file description is the shared kernel object behind it — ${graphNodes.length} nodes separate the handle from the file.`,
  };

  yield {
    state: fdGraph('The open file description owns offset and status flags', { fd3: '3', fd4: 'empty', ofd: 'offset=4096', inode: 'same file' }),
    highlight: { active: ['fd3', 'ofd'], found: ['inode', 'pages'] },
    explanation: `The open file description (node ${graphNodes.indexOf('ofd') + 1} of ${graphNodes.length} in the reference graph) stores the file offset and file status flags. read(fd3) advances the offset before the next read uses the same open description.`,
  };

  yield {
    state: fdGraph('Path lookup is done; later reads use the object reference', { dentry: 'may rename', inode: 'stable ref', pages: 'page cache' }),
    highlight: { active: ['ofd', 'inode', 'pages', 'e-inode-pages'], compare: ['dentry'] },
    explanation: `After open succeeds, the descriptor does not keep re-walking the pathname. Even if the path is renamed, the open file description still refers to the underlying ${graphNodes[graphNodes.length - 1]} object until all ${graphEdges.length} reference edges are released.`,
  };

  const layers = [
    { id: 'fd', label: 'fd number' },
    { id: 'ofd', label: 'open file desc' },
    { id: 'dentry', label: 'dentry' },
    { id: 'inode', label: 'inode' },
  ];
  yield {
    state: labelMatrix(
      'Three different layers',
      layers,
      [
        { id: 'scope', label: 'scope' },
        { id: 'owns', label: 'owns' },
      ],
      [
        ['per process', 'integer slot'],
        ['system-wide object', 'offset + flags'],
        ['namespace cache', 'parent + name'],
        ['filesystem object', 'metadata + mapping'],
      ],
    ),
    highlight: { active: ['fd:scope', 'ofd:owns', 'inode:owns'], compare: ['dentry:scope'] },
    explanation: `Many file bugs come from confusing these ${layers.length} layers (${layers.map(l => l.label).join(', ')}). A descriptor number is not a path, and two descriptors may or may not share the same open file description.`,
  };

  const fdTypes = [
    { id: 'regular', label: 'regular file' },
    { id: 'socket', label: 'socket' },
    { id: 'pipe', label: 'pipe' },
    { id: 'epollfd', label: 'epoll fd' },
  ];
  yield {
    state: labelMatrix(
      'What can sit behind an fd',
      fdTypes,
      [
        { id: 'operation', label: 'operations' },
        { id: 'data structure' , label: 'structure behind it' },
      ],
      [
        ['read/write/lseek', 'inode + page cache'],
        ['send/recv/poll', 'socket queues'],
        ['read/write', 'pipe ring buffer'],
        ['epoll_wait/ctl', 'interest + ready lists'],
      ],
    ),
    highlight: { active: ['regular:data structure', 'socket:data structure', 'epollfd:data structure'] },
    explanation: `The fd table is a uniform handle table. All ${fdTypes.length} types — ${fdTypes.map(t => t.label).join(', ')} — fit behind integer descriptors even though their internal data structures differ.`,
  };
}

function* dupForkCloseCaseStudy() {
  const sharedEdges = ['e-fd3-ofd', 'e-fd4-ofd'];
  yield {
    state: fdGraph('dup(fd3) creates fd4 pointing at the same open file description', { fd3: '3', fd4: '4 dup', ofd: 'shared offset' }),
    highlight: { active: ['fd3', 'fd4', 'ofd', 'e-fd3-ofd', 'e-fd4-ofd'], found: ['fdtab'] },
    explanation: `dup allocates a new descriptor entry that refers to the same open file description. The ${sharedEdges.length} edges from fd3 and fd4 both point at one open file description — the two descriptors can be used interchangeably for I/O.`,
    invariant: `dup shares offset and status flags because both ${sharedEdges.length} descriptor slots share one open file description.`,
  };

  const offsetSteps = [
    { id: 'r1', label: 'read(fd3, 100)' },
    { id: 'seek', label: 'lseek(fd4, 0)' },
    { id: 'r2', label: 'read(fd3, 100)' },
    { id: 'open2', label: 'open path again' },
  ];
  yield {
    state: labelMatrix(
      'Shared offset surprise',
      offsetSteps,
      [
        { id: 'offset before', label: 'offset before' },
        { id: 'offset after', label: 'offset after' },
      ],
      [
        ['0', '100'],
        ['100', '0'],
        ['0', '100'],
        ['new object', 'separate offset'],
      ],
    ),
    highlight: { active: ['seek:offset after', 'r2:offset before'], compare: ['open2:offset before'] },
    explanation: `Watch the ${offsetSteps.length} steps: because fd3 and fd4 share one open file description, lseek through fd4 (step ${offsetSteps.findIndex(s => s.id === 'seek') + 1}) changes what fd3 will read next. Opening the same path a second time creates a separate open file description with its own offset.`,
  };

  yield {
    state: fdGraph('fork copies descriptor entries but not the open file description', { proc: 'parent+child', fd3: 'parent fd3', fd4: 'child fd3', ofd: 'shared', inode: 'same object' }),
    highlight: { active: ['proc', 'fd3', 'fd4', 'ofd'], found: ['inode'] },
    explanation: `After fork, parent and child descriptor tables both point at the same open file descriptions via ${sharedEdges.length} shared references. That is useful for pipes and inherited stdio, but surprising for shared file offsets.`,
  };

  yield {
    state: fdGraph('close removes one descriptor reference; the object lives until refs hit zero', { fd3: 'closed', fd4: 'still open', ofd: 'refcount=1', dentry: 'unlinked?', inode: 'alive' }),
    highlight: { removed: ['fd3', 'e-fd3-ofd'], active: ['fd4', 'ofd', 'inode'] },
    explanation: `close(fd3) frees the descriptor slot, dropping from ${sharedEdges.length} references to ${sharedEdges.length - 1}. It does not necessarily destroy the open file description or inode. If another descriptor, process, or in-flight operation still references the object, it remains alive.`,
  };

  const fdOps = [
    { id: 'open', label: 'open(path)' },
    { id: 'dup', label: 'dup(fd)' },
    { id: 'fork', label: 'fork()' },
    { id: 'close', label: 'close(fd)' },
  ];
  const sharingOps = fdOps.filter(o => o.id === 'dup' || o.id === 'fork');
  yield {
    state: labelMatrix(
      'Descriptor operations',
      fdOps,
      [
        { id: 'descriptor effect', label: 'descriptor effect' },
        { id: 'open desc effect', label: 'open desc effect' },
      ],
      [
        ['new fd slot', 'new open desc'],
        ['new fd slot', 'shared open desc'],
        ['copy fd slots', 'shared open descs'],
        ['free one slot', 'destroy at last ref'],
      ],
    ),
    highlight: { active: ['dup:open desc effect', 'fork:open desc effect'], compare: ['open:open desc effect'] },
    explanation: `The table covers ${fdOps.length} operations. The question is always: did this operation create a new open file description, or only another descriptor reference to an existing one? ${sharingOps.length} of ${fdOps.length} (${sharingOps.map(o => o.label).join(', ')}) share the existing description.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fd to open file description') yield* fdToOpenFileDescription();
  else if (view === 'dup fork close case study') yield* dupForkCloseCaseStudy();
  else throw new InputError('Pick a file-descriptor view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view builds the reference graph from a process through its descriptor table, descriptor slots, open file description, dentry, inode, and page cache. Watch which nodes light up at each step. The second view shows dup creating a shared open file description, then demonstrates what happens to offsets and reference counts during fork and close. Pause at each frame and trace every edge before moving on.',
        {type: 'image', src: './assets/gifs/file-descriptor-table-open-file-description.gif', alt: 'Animated walkthrough of the file descriptor table open file description visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The matrix frames label each layer\'s scope and contents. Read them as lookup tables: given an fd number, what scope does it have, and what does the object behind it own? Given an operation like dup or fork, does it create a new open file description or share an existing one?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When a C program calls read(3, buf, 100), the 3 is not a file. It is not a pathname, not a pointer, and not a handle to a specific byte range. It is a small nonnegative integer called a file descriptor (fd). The operating system uses that integer as an index into a per-process table, and the table entry points to a kernel object called an open file description. That kernel object holds the current read/write position (offset), status flags like O_NONBLOCK, the access mode, and a reference to the underlying file, socket, pipe, or device.',
        {type: `callout`, text: `A descriptor is local to a process, but an open file description is shared kernel state with offset and status flags.`},
        'This two-level split exists because user-space programs need cheap, copyable handles (small integers), while the kernel needs rich per-open-instance state (offsets, flags, reference counts). The descriptor table bridges those two worlds. Without it, the kernel would need to encode all that state into the integer itself, or force programs to manage kernel pointers directly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The beginner model says fd 3 means "my file." Under that model, closing fd 3 closes the file, two different fd numbers always refer to different files, and the integer is stable across fork and exec. This model works fine for a single-process program that opens a file, reads it front to back, and closes it.',
        'It even survives simple shell redirection: the shell opens a file on fd 1, execs the child, and the child\'s writes go to the file. As long as nothing is shared and nothing is duplicated, the one-fd-one-file model holds up.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The model breaks the moment sharing enters the picture. Call dup(3) to get fd 4. Now read 100 bytes through fd 3, then read through fd 4. The second read starts at byte 100, not byte 0. The two integers share a single file offset because they point to the same open file description. The beginner model cannot explain this.',
        'Fork makes it worse. After fork, the child gets copies of all the parent\'s descriptor table entries, but those copies point to the same open file descriptions. A seek in the child moves the parent\'s offset. Forgetting close-on-exec leaks descriptors into exec\'d children, keeping sockets and pipes alive longer than intended. These are not exotic edge cases. They are the normal behavior of shells, pipelines, and server processes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'There are two separate things: the descriptor slot (per-process, just an integer index) and the open file description (a kernel object with offset, flags, and a reference to the underlying file). The system call open() creates both: a new open file description and a new descriptor slot pointing to it. The system call dup() creates only a new descriptor slot pointing to an existing open file description. fork() copies all descriptor slots into the child, but the open file descriptions stay shared.',
        'This means the question "do these two fd numbers share an offset?" reduces to "do they point to the same open file description?" If they were created by dup or inherited via fork, yes. If they were created by separate open() calls on the same path, no -- each open() creates its own open file description with its own offset starting at 0.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system has three layers. The descriptor table is per-process. Each entry holds a pointer to an open file description plus descriptor-level flags (the only one that matters in practice is close-on-exec, controlled by FD_CLOEXEC). The open file description is a system-wide kernel object containing the current file offset, file status flags (O_APPEND, O_NONBLOCK, O_DIRECT), the access mode (read, write, or both), and a reference count tracking how many descriptor entries point to it.',
        {type: `image`, src: `https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/images/fdtable.png`, alt: `Unix process descriptor tables pointing to a system open file table and inode table`, caption: `The three table model shows descriptor slots, open file descriptions, and inode records as separate layers. Source: CITS2002 Systems Programming, University of Western Australia, https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/singlepage.html.`},
        'Below the open file description sits the actual object. For a regular file, that means a dentry (directory entry cache for the name) and an inode (metadata, permissions, data block mapping). For a socket, it means send and receive queues. For a pipe, a ring buffer. For an epoll fd, an interest list and ready list. The descriptor table gives all of them a uniform integer handle, but their internals differ completely.',
        'After open() succeeds, the kernel does not re-walk the pathname on every read. The open file description already holds a reference to the inode. Another process can rename or unlink the file from the directory, and the descriptor still works -- the inode stays alive until the last reference (descriptor, memory mapping, or in-kernel operation) is released.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design separates three concerns that would otherwise tangle: naming (the fd integer), per-open-instance state (offset and flags), and per-file identity (the inode). Because naming is per-process, two processes can use fd 3 for completely different things. Because state is per-open-instance, two separate opens of the same file get independent offsets. Because identity is per-inode, dup and fork can share state without duplicating kernel objects.',
        'This separation makes shell plumbing possible. To redirect stdout to a file, the shell calls open() to get a descriptor, calls dup2() to copy it onto fd 1, closes the original, and execs the child. The child writes to fd 1 as usual and the output lands in the file. Pipelines work the same way: the shell creates a pipe (two descriptors), forks, and uses dup2() to wire the writer\'s stdout to the pipe\'s write end and the reader\'s stdin to the pipe\'s read end.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The primary cost is hidden sharing. When two fd numbers share an open file description, a read through one advances the offset seen by the other. If a program duplicates a descriptor and alternates reads through both numbers, each read picks up where the last one left off -- there is no "rewind to where fd 4 was." Programs that need independent cursors into the same file must call open() again or use pread/pwrite, which take an explicit offset and do not change the stored one.',
        'Descriptor reuse is a second cost. After close(3), the next open() may return 3 again. A stale fd 3 stored in a variable now accidentally targets a completely different object. This is a common source of use-after-close bugs in C programs and a reason higher-level languages wrap descriptors in objects with destructors.',
        'Flag scope is a third cost. File status flags (O_NONBLOCK, O_APPEND) live in the open file description, so changing them through one descriptor affects every descriptor sharing that description. Descriptor flags (FD_CLOEXEC) live in the table entry, so they are per-descriptor. Confusing the two causes bugs in nonblocking I/O setup and subprocess launch code.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Shell redirection and pipelines are the canonical use. Every time you type "cmd > file" or "cmd1 | cmd2", the shell is manipulating descriptor tables and open file descriptions. Server processes use descriptor inheritance to pass listening sockets to worker children after fork. The inetd superserver opens the socket, accepts connections, and execs handler programs with the connected socket on fd 0 and 1.',
        'Temporary files use the unlink-after-open pattern: open a file, immediately unlink it, and use the descriptor for scratch space. The data persists through the descriptor even though no directory entry exists. Log rotation relies on the same property -- a rotated log file can be renamed while the server keeps writing through its open descriptor until it is signaled to reopen.',
        'Descriptor passing over Unix domain sockets lets one process send an open file description to another process, even one that could not open the file itself. This is used in privilege separation (one process opens a privileged resource and passes the descriptor to an unprivileged worker) and in container runtimes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The model fails when you treat the descriptor integer as a stable, cross-process identifier. It is not. Fd 3 in process A and fd 3 in process B are unrelated unless they were explicitly shared via fork or descriptor passing. The model also fails when you equate a descriptor with a pathname. The path may have been unlinked, renamed, or may never have existed (sockets, pipes, eventfds have no pathname).',
        'Assuming two descriptors for the same file have independent offsets is another failure mode. They do if each came from a separate open(). They do not if one came from dup() or fork(). The only way to know is to trace how each descriptor was created.',
        'Platform differences also break the model at the edges. POSIX specifies the semantics, but Linux struct file, BSD struct file, and Windows HANDLE have different internal layouts and different edge-case behaviors. Within Linux alone, regular files, sockets, pipes, eventfds, signalfds, inotify fds, and epoll fds all have different backing structures behind the uniform integer handle.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start a process. Call open("/tmp/data.txt", O_RDWR) and get fd 3. The kernel creates open file description OFD-A with offset=0, mode=read-write, refcount=1. Call dup(3) and get fd 4. Now OFD-A has refcount=2. Both fd 3 and fd 4 point to OFD-A.',
        'Call read(3, buf, 100). The kernel reads 100 bytes starting at offset 0, then sets OFD-A\'s offset to 100. Now call read(4, buf, 50). This reads 50 bytes starting at offset 100 (not 0), then sets OFD-A\'s offset to 150. The two descriptors share one offset.',
        'Call open("/tmp/data.txt", O_RDONLY) and get fd 5. The kernel creates a new open file description OFD-B with offset=0, mode=read-only, refcount=1. Call read(5, buf, 200). This reads 200 bytes starting at offset 0 and sets OFD-B\'s offset to 200. OFD-A\'s offset is still 150. Two opens of the same path produce independent offsets.',
        'Call fork(). The child gets copies of fd 3, 4, and 5. OFD-A now has refcount=4 (parent fd 3, parent fd 4, child fd 3, child fd 4). OFD-B has refcount=2. The child calls close(3), dropping OFD-A to refcount=3. The child calls close(4), dropping OFD-A to refcount=2. The child calls close(5), dropping OFD-B to refcount=1. None of the open file descriptions are destroyed because the parent still holds references. The parent calls close(3), close(4), close(5). OFD-A drops to 0 and is destroyed. OFD-B drops to 0 and is destroyed. The inode\'s link count determines whether the file itself is deleted from disk.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The POSIX standard defines file descriptors and open file descriptions in the System Interfaces volume, section 2.5.1 ("Interaction of File Descriptors and Standard I/O Streams"). The Linux man pages open(2), dup(2), fork(2), close(2), and fcntl(2) cover the system call semantics. The University of Western Australia CITS2002 Systems Programming lecture notes provide the three-table diagram used above.',
        'Study VFS Dentry and Inode Cache next to understand what happens below the open file description for regular files. Study Linux Page Cache XArray for how file data reaches memory. Study Ring Buffer for pipe internals, epoll Interest and Ready Lists for I/O multiplexing over descriptors, and Process Table for another example of small integers indexing into kernel-managed objects.',
      ],
    },
  ],
};
