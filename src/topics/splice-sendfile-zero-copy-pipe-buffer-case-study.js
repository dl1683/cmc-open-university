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
      heading: 'Why this exists',
      paragraphs: [
        'A static file server often needs to move bytes from disk cache to a socket. The content already sits in the kernel page cache, and the destination is also in the kernel networking path. Copying the bytes into a user-space buffer just to copy them back into the kernel wastes CPU cycles, memory bandwidth, and cache space.',
        'sendfile and splice exist to remove that unnecessary user-space copy. They do not remove all work. The kernel still manages page references, pipe buffers, socket queues, offsets, lifetimes, and backpressure. The win is that the application can move ownership and references instead of touching every byte.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The straightforward implementation is a read/write loop: read file bytes into a buffer, then write that buffer to the socket. It is portable, easy to debug, and correct for transformations because the application owns the bytes in the middle.',
        'The wall appears when the transfer is large and unmodified. The loop performs two copies across the user-kernel boundary path, pollutes CPU caches with data the application never inspects, and burns memory bandwidth that could have gone to useful work. Under slow clients it also needs the same partial-write and readiness logic as the zero-copy path.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core data structure is a queue of references, not a buffer of copied bytes. Page-cache pages already contain the file data. Pipe buffers and socket queues can carry references to those pages or kernel buffers, plus offset, length, flags, and release rules.',
        'sendfile packages the common file-to-socket case behind one interface. splice exposes the pipe-buffer bridge explicitly, usually requiring a pipe on one side of the transfer. The invariant is that byte order and offsets are preserved even when the implementation moves references instead of materializing bytes in user memory.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the path as a chain of ownership and backpressure. The file descriptor names the source, the page cache holds the bytes, pipe buffers or socket queues carry references, and the application records how many bytes actually moved. The fast path is only real if the trace shows the bytes avoided user-space materialization.',
        'The key debugging question is where the byte range lives right now. It may be in the page cache, attached to pipe buffers, queued to the socket, or already acknowledged by the write side. A zero-copy system that cannot answer that question is only a hope wrapped around a syscall.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For sendfile, the application provides an input descriptor, output descriptor, optional offset, and byte count. The kernel looks up file pages, attaches data to the outgoing path where supported, advances offsets according to actual progress, and returns the number of bytes moved.',
        'For splice, one side is normally a pipe. The first splice can attach file page references to pipe buffers. The second splice can move those pipe buffers into a socket or another compatible destination. The pipe is not just plumbing; it is the bounded queue that carries the transfer state.',
        'Both calls must be driven like other I/O. They can move fewer bytes than requested, block, or return EAGAIN in nonblocking mode. A correct loop keeps the remaining byte range, waits for readiness, and retries without duplicating or skipping bytes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from preserving the same stream contract as read/write. The destination receives the same byte sequence in the same order, and the returned byte count tells the application exactly how much of the range has advanced.',
        'The optimization is safe only because the kernel owns the page-cache references, pipe-buffer lifetimes, and socket-queue release path. A page cannot be reclaimed or overwritten out from under an in-flight reference. Backpressure keeps the bounded queues from pretending the network accepted data it has not accepted.',
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
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Zero-copy saves copy cost, but it adds capability checks, fallback paths, and lifetime pressure. The fast path depends on support from the source, destination, filesystem, socket path, and operation. TLS, compression, filters, checksumming, or unsupported file types can force copies or a different offload path.',
        'The practical cost is control complexity. The application still handles short transfers, readiness, cancellation, offsets, rate limiting, and error recovery. Slow clients can keep page references alive in outgoing queues, so a server must cap per-connection and global pressure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The fit is strongest for large, already-cached, unmodified payloads: static files, media segments, backups, and proxy paths that forward bytes without inspecting them. The access pattern is sequential, and the application does not need to transform the body.',
        'It is the wrong default for tiny responses, highly dynamic bodies, content that must be encrypted or compressed in user space, or paths where unsupported sources and sinks make fallback common. In those cases a plain buffered loop may be simpler and just as fast.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Zero-copy calls can make partial progress. They can block or return EAGAIN in nonblocking mode. They can interact badly with transformations, TLS, compression, filters, or file types that do not support the path. They can also increase memory pressure if page references remain attached to slow downstream queues.',
        'Another misconception is that avoiding user-space copies always dominates. For small payloads, syscall overhead, branchy fallback handling, and more complicated accounting can outweigh the benefit. For large static transfers, the savings in CPU and memory bandwidth are usually clearer.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track bytes sent by zero-copy path, fallback bytes, short-transfer count, EAGAIN count, socket-queue depth, pinned page pressure, per-connection outstanding bytes, slow-client age, TLS or compression bypass rate, and CPU cycles per transferred megabyte. These metrics tell you whether the design is actually saving work.',
        'The fallback path needs the same observability as the fast path. A server that silently falls back to read/write for most responses may still be correct, but the performance story has changed. The article-level lesson is that system calls are not magic labels; workload fit and measured path determine the result.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'splice and sendfile are reference-moving tools for specific byte paths. They are excellent when the application does not need to inspect or transform the payload. They are less compelling when responses are tiny, dynamic, encrypted in user space, or frequently unsupported by the source and sink.',
        'For course design, teach this after file descriptors and page cache, then connect it to backpressure. Students should see that zero-copy is not only an optimization trick. It is a lifetime, offset, and queue-management discipline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: splice(2) at https://man7.org/linux/man-pages/man2/splice.2.html, sendfile(2) at https://man7.org/linux/man-pages/man2/sendfile.2.html, and Linux splice documentation at https://www.kernel.org/doc/html/latest/filesystems/splice.html.',
        'Study next by role: File Descriptor Table & Open File Description for offset and descriptor semantics, Linux Page Cache XArray for the source pages, epoll Interest & Ready Lists and io_uring Submission & Completion Rings for driving nonblocking progress, NIC RX Ring & NAPI Poll for the device side, and Backpressure & Flow Control for the queue limits that zero-copy does not remove.',
      ],
    },
  ],
};
