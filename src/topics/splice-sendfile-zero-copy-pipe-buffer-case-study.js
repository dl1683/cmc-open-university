// sendfile and splice: zero-copy file/socket transfer through page-cache pages,
// pipe buffers, descriptor ownership, and backpressure-sensitive fallbacks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'splice-sendfile-zero-copy-pipe-buffer-case-study',
  title: 'splice/sendfile Zero-Copy Pipe Buffer Case Study',
  category: 'Systems',
  summary: 'How Linux avoids user-space copies with sendfile, splice, pipe buffers, page-cache references, socket queues, and careful fallback handling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['zero copy path', 'backpressure traps'], defaultValue: 'zero copy path' },
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

function zeroCopyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.0, note: notes.app ?? 'server' },
      { id: 'fdin', label: 'file fd', x: 2.2, y: 2.0, note: notes.fdin ?? 'in' },
      { id: 'pcache', label: 'pages', x: 4.0, y: 2.0, note: notes.pcache ?? 'cache' },
      { id: 'pipe', label: 'pipe', x: 5.8, y: 4.0, note: notes.pipe ?? 'pipe bufs' },
      { id: 'sockq', label: 'sock q', x: 7.6, y: 4.0, note: notes.sockq ?? 'send q' },
      { id: 'nic', label: 'NIC', x: 9.2, y: 4.0, note: notes.nic ?? 'DMA' },
      { id: 'user', label: 'user buf', x: 4.0, y: 6.0, note: notes.user ?? 'skip' },
      { id: 'fdout', label: 'sock fd', x: 2.2, y: 6.0, note: notes.fdout ?? 'out' },
    ],
    edges: [
      { id: 'e-app-fdin', from: 'app', to: 'fdin', weight: '' },
      { id: 'e-fdin-pcache', from: 'fdin', to: 'pcache', weight: 'lookup' },
      { id: 'e-pcache-pipe', from: 'pcache', to: 'pipe', weight: 'ref' },
      { id: 'e-pipe-sockq', from: 'pipe', to: 'sockq', weight: 'move' },
      { id: 'e-sockq-nic', from: 'sockq', to: 'nic', weight: 'send' },
      { id: 'e-app-fdout', from: 'app', to: 'fdout', weight: '' },
      { id: 'e-fdout-sockq', from: 'fdout', to: 'sockq', weight: '' },
      { id: 'e-pcache-user', from: 'pcache', to: 'user', weight: 'copy?' },
      { id: 'e-user-sockq', from: 'user', to: 'sockq', weight: 'copy?' },
    ],
  }, { title });
}

function* zeroCopyPath() {
  yield {
    state: zeroCopyGraph('The ordinary path copies file bytes through user memory'),
    highlight: { active: ['fdin', 'pcache', 'user', 'sockq', 'e-pcache-user', 'e-user-sockq'], compare: ['pipe'] },
    explanation: 'A read/write loop often copies data from the page cache into a user buffer, then copies it again from user memory into the socket path. That is simple, but the copies and cache pollution are pure overhead for static transfer.',
  };

  yield {
    state: zeroCopyGraph('sendfile can connect file pages to a socket path', { app: 'sendfile', pipe: 'hidden', user: 'bypass' }),
    highlight: { active: ['app', 'fdin', 'pcache', 'pipe', 'sockq', 'nic', 'e-fdin-pcache', 'e-pcache-pipe', 'e-pipe-sockq', 'e-sockq-nic'], removed: ['user'] },
    explanation: 'sendfile is the direct API for copying from one file descriptor to another, commonly regular file to socket, while avoiding a round trip through user-space buffers.',
    invariant: 'Zero-copy means avoiding user-space copies; it does not mean no references, no queues, or no backpressure.',
  };

  yield {
    state: zeroCopyGraph('splice exposes the pipe-buffer bridge explicitly', { app: 'splice', pipe: 'refs pages', sockq: 'socket queue' }),
    highlight: { active: ['pcache', 'pipe', 'sockq', 'e-pcache-pipe', 'e-pipe-sockq'], found: ['fdin', 'fdout'], compare: ['user'] },
    explanation: 'splice moves data between file descriptors, with one side normally being a pipe. The pipe buffer can hold references to pages instead of forcing immediate byte copies into user memory.',
  };

  yield {
    state: labelMatrix(
      'Copy path comparison',
      [
        { id: 'readwrite', label: 'rw loop' },
        { id: 'sendfile', label: 'sendfile' },
        { id: 'splice', label: 'splice' },
        { id: 'tls', label: 'TLS' },
      ],
      [
        { id: 'usercopy', label: 'user copy' },
        { id: 'control', label: 'control' },
      ],
      [
        ['yes', 'simple'],
        ['avoid', 'narrow'],
        ['avoid', 'flex pipe'],
        ['maybe', 'encrypt'],
      ],
    ),
    highlight: { active: ['sendfile:usercopy', 'splice:usercopy'], compare: ['tls:usercopy'] },
    explanation: 'sendfile is convenient for file-to-socket transfer. splice is more general but pipe-shaped. TLS, filters, unsupported filesystems, or transformations can force copies or different offload paths.',
  };
}

function* backpressureTraps() {
  yield {
    state: zeroCopyGraph('Zero-copy transfer still waits on finite queues', { pipe: 'pipe full?', sockq: 'send full?', nic: 'slow net' }),
    highlight: { active: ['pipe', 'sockq', 'nic', 'e-pipe-sockq', 'e-sockq-nic'], compare: ['app'] },
    explanation: 'Pipe buffers and socket send queues are finite. A zero-copy path can still return partial progress, block, or produce EAGAIN when the downstream socket cannot accept more pages.',
    invariant: 'Avoiding a copy does not avoid flow control.',
  };

  yield {
    state: labelMatrix(
      'Operational traps',
      [
        { id: 'partial', label: 'partial' },
        { id: 'again', label: 'EAGAIN' },
        { id: 'pin', label: 'pin' },
        { id: 'xform', label: 'xform' },
        { id: 'offload', label: 'offload' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'control', label: 'control' },
      ],
      [
        ['short', 'loop'],
        ['full q', 'poll'],
        ['page ref', 'limit'],
        ['needs b', 'copy'],
        ['feature', 'measure'],
      ],
    ),
    highlight: { active: ['partial:control', 'again:control', 'pin:control'], compare: ['xform:control'] },
    explanation: 'A robust server treats zero-copy calls like other nonblocking I/O: handle short transfers, wait for readiness, cap pinned page pressure, and measure whether the path actually avoided copies.',
  };

  yield {
    state: zeroCopyGraph('A fallback read/write path must preserve correctness', { user: 'fallback', pipe: 'unusable', app: 'loop' }),
    highlight: { active: ['pcache', 'user', 'sockq', 'e-pcache-user', 'e-user-sockq'], removed: ['pipe'], found: ['app'] },
    explanation: 'Not every source, sink, filesystem, or transformation supports the fast path. The fallback can be slower, but it must preserve offsets, retry semantics, cancellation, and backpressure behavior.',
  };

  yield {
    state: labelMatrix(
      'Static file server ledger',
      [
        { id: 'small', label: 'small' },
        { id: 'large', label: 'large' },
        { id: 'tls', label: 'TLS' },
        { id: 'range', label: 'range' },
        { id: 'slow', label: 'slow' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['rw', 'syscost'],
        ['zero', 'q depth'],
        ['copy/off', 'CPU'],
        ['offset', 'short'],
        ['backpr', 'pins'],
      ],
    ),
    highlight: { active: ['large:path', 'slow:path', 'range:watch'], compare: ['tls:path'] },
    explanation: 'The complete case is a file server choosing by workload. Large static files benefit most, slow clients need strict queue limits, range requests need careful offset accounting, and encrypted responses may use a different path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'zero copy path') yield* zeroCopyPath();
  else if (view === 'backpressure traps') yield* backpressureTraps();
  else throw new InputError('Pick a zero-copy I/O view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'sendfile and splice are Linux interfaces for moving data between file descriptors while avoiding unnecessary copies through user-space buffers. The data may still move through kernel structures, page-cache references, pipe buffers, socket queues, and device DMA, but the application does not need to copy every byte into its own buffer just to send it back out.',
        'The data-structure lesson is that zero-copy is mostly reference movement. Pipe buffers and socket queues carry references to pages or kernel buffers, with offsets, lengths, flags, and lifetime rules. That is very different from a read/write loop that materializes bytes in user memory.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'sendfile is commonly used for static file transfer: a regular file is the source, a socket is the destination, and the kernel can connect page-cache data to the socket path without a user-space copy. splice is lower level and usually uses a pipe as one side of the transfer, making the pipe buffer the explicit bridge.',
        'The fast path depends on support from the file type, socket path, filesystem, and operation. If the kernel must transform bytes, encrypt them, or handle an unsupported source or sink, it may copy or fall back. A correct application treats zero-copy as an optimization, not as a separate correctness model.',
      ],
    },
    {
      heading: 'Complete case study: static file server',
      paragraphs: [
        'A server receives a request for a large static object. The file data is already in the Linux page cache. Instead of read into a user buffer and write to the socket, the server calls sendfile or constructs a splice loop. The kernel attaches page references to the outgoing path, the socket queue drains as the NIC sends, and the application loops on short progress until the byte range is complete.',
        'If the client is slow, the socket send queue fills. The server must stop feeding that connection, wait for readiness, and avoid pinning too many page-cache pages behind slow clients. This connects File Descriptor Table & Open File Description, Linux Page Cache XArray, epoll Interest & Ready Lists, io_uring Submission & Completion Rings, and Backpressure & Flow Control.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Zero-copy calls can make partial progress. They can block or return EAGAIN in nonblocking mode. They can interact badly with transformations, TLS, compression, filters, or file types that do not support the path. They can also increase memory pressure if page references remain attached to slow downstream queues.',
        'Another misconception is that avoiding user-space copies always dominates. For small payloads, syscall overhead, complexity, and fallback handling can outweigh the benefit. For large static transfers, the savings in CPU and memory bandwidth are usually clearer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: splice(2) at https://man7.org/linux/man-pages/man2/splice.2.html, sendfile(2) at https://man7.org/linux/man-pages/man2/sendfile.2.html, and Linux splice documentation at https://www.kernel.org/doc/html/latest/filesystems/splice.html. Study File Descriptor Table & Open File Description, Linux Page Cache XArray, epoll Interest & Ready Lists, io_uring Submission & Completion Rings, NIC RX Ring & NAPI Poll, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
