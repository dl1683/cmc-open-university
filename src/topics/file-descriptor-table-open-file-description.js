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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/file-descriptor-table-open-file-description.gif', alt: 'Animated walkthrough of the file descriptor table open file description visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A file descriptor is a small nonnegative integer that a process passes to system calls such as read, write, close, poll, dup, and epoll_ctl. The integer is not the file. It is an index into a per-process file-descriptor table. The table entry points to a kernel object called an open file description, which then points to the underlying file, socket, pipe, device, or other object.`,
        {type: `callout`, text: `A descriptor is local to a process, but an open file description is shared kernel state with offset and status flags.`},
        `This split is the important idea. User space needs compact handles that are cheap to copy and easy to pass through APIs. The kernel needs richer state: the current file offset, file status flags, access mode, reference counts, and links into the virtual filesystem or socket layer. The descriptor table is the handle table that connects those two worlds.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious mental model says fd 3 means a pathname, or maybe a file. That model breaks immediately. The same integer in two different processes can refer to different objects. A pathname can be renamed or unlinked after open while the descriptor still works. Two different descriptor numbers in one process can share a single file offset if one was made with dup.`,
        `The wall appears in real bugs. A program redirects standard output, forks a child, seeks through a duplicated descriptor, or forgets close-on-exec, and suddenly writes go to the wrong place or files stay open longer than expected. The integer alone cannot explain the behavior. You have to know which table entry points to which open file description and which open file descriptions are shared.`,
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        `A descriptor number is a per-process table slot. An open file description is the shared kernel object behind one or more slots. open(path) creates a new open file description and returns a descriptor slot that refers to it. dup creates another descriptor slot referring to the same open file description. fork copies descriptor slots into the child, so parent and child usually share the same open file descriptions after the fork.`,
        `Because the file offset and file status flags live in the open file description, shared descriptors can affect each other. If fd 3 and fd 4 were created by dup, a read through fd 3 advances the offset seen by fd 4. An lseek through fd 4 changes what fd 3 reads next. Opening the same pathname a second time creates a separate open file description with a separate offset.`,
      ],
    },
    {
      heading: 'Mechanism: the layers',
      paragraphs: [
        `There are several layers that are easy to collapse. The descriptor table is per process. A descriptor entry contains a pointer to an open file description and descriptor-level flags such as close-on-exec. The open file description contains the current offset and file status flags such as nonblocking or append behavior. Below that are type-specific operations and objects: an inode and page cache for a regular file, socket queues for a socket, a pipe buffer for a pipe, or an epoll interest set for an epoll file descriptor.`,
        {type: `image`, src: `https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/images/fdtable.png`, alt: `Unix process descriptor tables pointing to a system open file table and inode table`, caption: `The three table model shows descriptor slots, open file descriptions, and inode records as separate layers. Source: CITS2002 Systems Programming, University of Western Australia, https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/singlepage.html.`},
        `For regular files, path lookup produces dentries and inodes before or during open. After open succeeds, later reads do not re-walk the pathname. They follow the object references already held by the open file description. This is why a program can open a file, another process can rename or unlink the directory entry, and the original descriptor can still read the old object until the last reference is closed.`,
      ],
    },
    {
      heading: 'What operations do',
      paragraphs: [
        `open creates a new open file description. dup, dup2, and dup3 create a new descriptor entry that refers to an existing open file description. fork copies the descriptor table entries into the child, again referring to the same open file descriptions. close removes one descriptor entry. The open file description and underlying object are destroyed only when the last reference is gone and no in-flight kernel operation still needs them.`,
        `exec is different. By default, descriptors survive across exec, so the new program image inherits them. Descriptor entries marked close-on-exec are closed during exec. This flag is descriptor-level state, not open-file-description state. That distinction matters for servers and tools that spawn children; accidentally inherited descriptors can keep sockets, pipes, or files alive and can leak authority into a program that should not have it.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The first visual separates the process, descriptor table, descriptor slots, open file description, dentry, inode, and page cache. That separation is the lesson. The fd number is only a table slot. The open file description is the shared record that owns offset and status flags. The inode and lower object hold the real file or device state. Once those nodes are separate, rename, unlink, dup, fork, and close behavior stops looking special.`,
        `The dup and fork case study shows sharing by drawing two descriptor slots into one open file description. That is why an lseek through fd 4 can change what fd 3 reads next. The close step removes one descriptor edge while the open file description and inode remain alive through another edge. The model is not narrating a syscall trace; it is teaching the reference graph that explains the trace.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it separates naming, sharing, and lifetime. Descriptor numbers are cheap process-local names. Open file descriptions are shared kernel records for an open instance. The underlying object has its own lifetime and representation. This lets the kernel support uniform APIs while still allowing regular files, sockets, pipes, eventfds, terminals, and epoll instances to behave differently underneath.`,
        `It also makes common shell and process patterns possible. Standard input, output, and error are just descriptors 0, 1, and 2 by convention. A shell can open a file, duplicate its descriptor onto fd 1, close the extra descriptor, and exec a program whose ordinary writes now go to the file. A pipeline works because children inherit selected pipe descriptors and close the ends they do not need.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The cost of the abstraction is hidden sharing. Shared offsets are useful for shells, pipes, and inherited streams, but they surprise programs that expected descriptor numbers to be independent. If a process duplicates a descriptor and alternates reads through both numbers, the reads advance one shared offset. If the process needs independent offsets, it must open the file again or use positioned I/O where appropriate.`,
        `Descriptor reuse is another cost. After close, the same integer may be returned by a later open. A stale fd value in user space can accidentally target a completely different object. Flag scope adds one more tradeoff: file status flags associated with the open file description can affect every descriptor that shares it, while descriptor flags such as close-on-exec belong to the table entry. Mixing those scopes causes bugs in nonblocking I/O, subprocess launch code, and library code that changes flags without restoring them.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Useful signals include open descriptor count, growth rate, per-process limits, EMFILE and ENFILE errors, leaked descriptors across exec, unexpected shared offsets, descriptors stuck in CLOSE_WAIT or similar socket states, and paths shown as deleted while still held open. On Linux, /proc/<pid>/fd and /proc/<pid>/fdinfo expose much of the practical state: target objects, positions, flags, and descriptor identities.`,
        `A good diagnostic starts by asking four questions. Which process owns the descriptor number? Which open file description does the descriptor reference? Is that open file description shared by another descriptor or process? What underlying object sits behind it? Tools such as lsof, strace, procfs, and targeted logging help answer those questions, but the mental model must come first.`,
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        `This model explains regular file I/O, shell redirection, inherited standard streams, pipes, socket servers, epoll loops, descriptor passing over Unix-domain sockets, temporary files unlinked after open, log rotation behavior, and many resource leaks. It is also essential for understanding why readiness APIs operate on descriptors while the readiness state may be tied to a deeper object.`,
        `It is useful as a curriculum topic because it is a concrete handle table with shared references and lifetimes. The same pattern appears in process tables, object-capability systems, database connection pools, GPU handles, window-system resources, and runtime object registries. Small integers are easy to pass, but the system correctness lives in the table and the object graph behind them.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `The model fails when you treat the descriptor integer as a durable identity. It is process-local and reusable. It fails when you treat a descriptor as a pathname. The path may no longer name the same object, and the descriptor may refer to something that never had a pathname, such as a socket or eventfd. It fails when you assume two descriptors for the same file have independent offsets without checking how they were created.`,
        `It also fails if you ignore platform details. POSIX terminology, Linux implementation objects, BSD behavior, and Windows handle semantics are related but not identical. Even within Linux, regular files, sockets, pipes, eventfds, signalfds, inotify descriptors, and epoll descriptors have different lower-level structures. The descriptor table gives a uniform handle, not uniform behavior.`,
      ],
    },
    {
      heading: 'Evaluation cases',
      paragraphs: [
        `A small test suite can make the semantics concrete. Open a file once, duplicate the descriptor, read through one number, and verify that the other sees the advanced offset. Open the same path twice and verify that the offsets are independent. Fork after opening and check that parent and child share the offset unless the program deliberately avoids it. Mark one descriptor close-on-exec and verify that only the intended descriptors survive into the child program.`,
        `Also test close and reuse. Close a descriptor, open another object, and observe that the integer may be reused. Unlink an open temporary file and verify that I/O still works through the descriptor while directory lookup no longer finds it. These cases prevent the common beginner model from surviving contact with real process behavior.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study VFS Dentry & Inode Cache for pathname lookup, Linux Page Cache XArray for regular-file data, Ring Buffer for pipes and byte queues, epoll Interest & Ready Lists for readiness over descriptors, Socket Accept Queue for network endpoints, and Process Table for another example of small identifiers pointing into kernel-managed objects. Then read about close-on-exec, descriptor passing, and positioned I/O to see where the basic model becomes production engineering.`,
      ],
    },
  ],
};
