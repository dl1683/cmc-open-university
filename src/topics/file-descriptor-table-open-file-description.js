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
  yield {
    state: fdGraph('open() returns a descriptor for an open file description', { fd4: 'empty' }),
    highlight: { active: ['proc', 'fdtab', 'fd3', 'ofd'], found: ['inode'] },
    explanation: 'A file descriptor is the small integer user space passes to read, write, close, poll, and epoll_ctl. The descriptor table is per process; the descriptor entry points to an open file description.',
    invariant: 'The fd number is per process; the open file description is the shared kernel object behind it.',
  };

  yield {
    state: fdGraph('The open file description owns offset and status flags', { fd3: '3', fd4: 'empty', ofd: 'offset=4096', inode: 'same file' }),
    highlight: { active: ['fd3', 'ofd'], found: ['inode', 'pages'] },
    explanation: 'The open file description stores the file offset and file status flags. read(fd3) can advance the offset stored here before the next read uses the same open description.',
  };

  yield {
    state: fdGraph('Path lookup is done; later reads use the object reference', { dentry: 'may rename', inode: 'stable ref', pages: 'page cache' }),
    highlight: { active: ['ofd', 'inode', 'pages', 'e-inode-pages'], compare: ['dentry'] },
    explanation: 'After open succeeds, the descriptor does not keep re-walking the pathname. Even if the path is renamed, the open file description still refers to the underlying file object until all references close.',
  };

  yield {
    state: labelMatrix(
      'Three different layers',
      [
        { id: 'fd', label: 'fd number' },
        { id: 'ofd', label: 'open file desc' },
        { id: 'dentry', label: 'dentry' },
        { id: 'inode', label: 'inode' },
      ],
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
    explanation: 'Many file bugs come from confusing these layers. A descriptor number is not a path, and two descriptors may or may not share the same open file description.',
  };

  yield {
    state: labelMatrix(
      'What can sit behind an fd',
      [
        { id: 'regular', label: 'regular file' },
        { id: 'socket', label: 'socket' },
        { id: 'pipe', label: 'pipe' },
        { id: 'epollfd', label: 'epoll fd' },
      ],
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
    explanation: 'The fd table is a uniform handle table. Regular files, sockets, pipes, eventfds, and epoll instances all fit behind integer descriptors even though their internal data structures differ.',
  };
}

function* dupForkCloseCaseStudy() {
  yield {
    state: fdGraph('dup(fd3) creates fd4 pointing at the same open file description', { fd3: '3', fd4: '4 dup', ofd: 'shared offset' }),
    highlight: { active: ['fd3', 'fd4', 'ofd', 'e-fd3-ofd', 'e-fd4-ofd'], found: ['fdtab'] },
    explanation: 'dup allocates a new descriptor entry that refers to the same open file description. The two descriptors can be used interchangeably for I/O.',
    invariant: 'dup shares offset and status flags because it shares the open file description.',
  };

  yield {
    state: labelMatrix(
      'Shared offset surprise',
      [
        { id: 'r1', label: 'read(fd3, 100)' },
        { id: 'seek', label: 'lseek(fd4, 0)' },
        { id: 'r2', label: 'read(fd3, 100)' },
        { id: 'open2', label: 'open path again' },
      ],
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
    explanation: 'Because fd3 and fd4 share one open file description, lseek through fd4 changes what fd3 will read next. Opening the same path a second time creates a separate open file description with its own offset.',
  };

  yield {
    state: fdGraph('fork copies descriptor entries but not the open file description', { proc: 'parent+child', fd3: 'parent fd3', fd4: 'child fd3', ofd: 'shared', inode: 'same object' }),
    highlight: { active: ['proc', 'fd3', 'fd4', 'ofd'], found: ['inode'] },
    explanation: 'After fork, parent and child descriptor tables point at the same open file descriptions. That is useful for pipes and inherited stdio, but surprising for shared file offsets.',
  };

  yield {
    state: fdGraph('close removes one descriptor reference; the object lives until refs hit zero', { fd3: 'closed', fd4: 'still open', ofd: 'refcount=1', dentry: 'unlinked?', inode: 'alive' }),
    highlight: { removed: ['fd3', 'e-fd3-ofd'], active: ['fd4', 'ofd', 'inode'] },
    explanation: 'close(fd3) frees the descriptor slot. It does not necessarily destroy the open file description or inode. If another descriptor, process, or in-flight operation still references the object, it remains alive.',
  };

  yield {
    state: labelMatrix(
      'Descriptor operations',
      [
        { id: 'open', label: 'open(path)' },
        { id: 'dup', label: 'dup(fd)' },
        { id: 'fork', label: 'fork()' },
        { id: 'close', label: 'close(fd)' },
      ],
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
    explanation: 'The table makes the mental model concrete. The question is always: did this operation create a new open file description, or only another descriptor reference to an existing one?',
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
      heading: 'What it is',
      paragraphs: [
        'A file descriptor is a small integer in a process descriptor table. It points to an open file description, the kernel object that stores file offset, file status flags, and a reference to the underlying file, socket, pipe, or device.',
        'This split is why fd numbers are local to a process but open file descriptions can be shared by dup, fork, and descriptor passing. It is also why the same integer API can handle regular files, pipes, sockets, eventfds, and epoll instances.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'open(path) first resolves the pathname through the VFS, then creates a new open file description and installs a descriptor table entry pointing at it. read and write operate through the descriptor, but offset and status flags belong to the open file description.',
        'dup creates a new descriptor entry pointing at the same open file description. fork copies descriptor entries into the child, again sharing the same open file descriptions. close removes one descriptor reference; the open file description disappears only after the last reference is gone.',
      ],
    },
    {
      heading: 'Case study: shared offset bug',
      paragraphs: [
        'Suppose fd3 and fd4 come from dup. If one part of a program calls lseek(fd4, 0), a later read(fd3) uses the reset offset because both descriptors share the same open file description. Opening the path twice instead creates two open file descriptions with independent offsets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Descriptor lookup is intentionally cheap: index into a per-process table, check permissions and flags, and follow the file object. The complexity is lifetime. Descriptor numbers can be reused after close, open files can outlive pathnames after unlink, forked children can inherit descriptors accidentally, and nonblocking flags can affect all descriptors sharing the same open file description.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An fd is not a pathname and not necessarily a unique file. It is a process-local handle. An open file can survive rename or unlink, and two descriptor numbers may share offset. epoll Interest & Ready Lists also works with descriptors, but its readiness semantics are separate from the fd-table lifetime rules.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: open(2) at https://man7.org/linux/man-pages/man2/open.2.html, dup(2) at https://man7.org/linux/man-pages/man2/dup.2.html, close(2) at https://man7.org/linux/man-pages/man2/close.2.html, and Linux VFS overview at https://docs.kernel.org/filesystems/vfs.html. Study VFS Dentry & Inode Cache, Linux Page Cache XArray, epoll Interest & Ready Lists, Ring Buffer, and Message Queues next.',
      ],
    },
  ],
};
