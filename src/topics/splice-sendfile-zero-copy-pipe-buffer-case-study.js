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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a byte-ownership trace. A file descriptor is a kernel handle for an open file or socket, the page cache is the kernel memory that holds recently read file pages, and a pipe buffer is a small kernel record that can carry a reference to bytes rather than copied bytes.',
        'Active nodes are the structures currently carrying the byte range. Removed nodes show work skipped by the fast path, usually the user-space buffer. The safe inference is narrow: if the page-cache page is referenced by the pipe or socket path and the user buffer is removed, the application avoided copying that range into user memory.',
        {type:'callout', text:'The fast path moves page references through bounded kernel queues, so lifetime and backpressure matter as much as copy avoidance.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A static file server often sends bytes that the application never needs to inspect. The file bytes may already be in the kernel page cache, and the destination socket is also managed by the kernel. Copying the same bytes into a JavaScript, C, or Go buffer only to write them back into the kernel spends CPU and memory bandwidth without changing the response.',
        'sendfile and splice exist for that case. They let the kernel connect a source descriptor to an output path while preserving byte order, offsets, and queue limits. The application still drives progress, but it does not need to touch every byte.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a read/write loop. Read 64 KB from the file into a user buffer, then write 64 KB from that buffer to the socket. It is simple, portable, and works when the application must compress, encrypt, scan, or rewrite the bytes.',
        'The cost is that the buffer becomes a needless stop for unchanged data. A 1 GB file copied through user space can move about 2 GB across copy boundaries before the network card even transmits it. The application also dirties CPU caches with data it will not interpret.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is memory bandwidth and queue behavior, not only syscall count. Faster disks and networks make extra copies more visible because the CPU must keep up with byte movement that carries no application information. Slow clients add another wall because the socket queue fills and every path becomes partial-progress I/O.',
        'A naive zero-copy call also fails if it treats the syscall as all-or-nothing. The kernel may move 192 KB of a 1 MB range, return EAGAIN, or fall back because the source, sink, filesystem, or transformation does not support the path. Correct code must record the remaining byte range.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to move references to kernel pages when the bytes do not need transformation. A page reference plus offset and length can represent the same byte range as a copied buffer. The kernel can attach that reference to a pipe buffer or socket path and release it only after downstream consumers are done.',
        'sendfile packages the common file-to-socket route. splice exposes the pipe as an explicit bridge between descriptors. In both cases, the invariant is that the destination stream receives exactly the requested byte order even when the implementation moves references instead of materialized bytes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For sendfile, the application passes an input descriptor, an output descriptor, an optional offset, and a count. The kernel looks up file pages, attaches eligible ranges to the outgoing path, advances by the number of bytes actually accepted, and returns that count. The loop repeats until the requested range is complete or an error branch wins.',
        'For splice, one side is normally a pipe. One splice can attach source bytes to pipe buffers, and another splice can move those buffers toward the socket. The pipe is a bounded queue, so it is part of the flow-control design rather than a decorative connector.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from matching the stream contract of read followed by write. The byte at file offset x must appear at the destination before the byte at offset x + 1, and the returned count must equal the prefix of the range accepted by the kernel. Retrying from offset plus count preserves that invariant.',
        'The optimization is safe because the kernel owns page lifetimes while references are in flight. A page-cache page cannot be freed or reused while a pipe buffer or socket queue still names it. Backpressure preserves truth: the kernel cannot report bytes as accepted by a full downstream queue unless that queue has actually taken responsibility for them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time saved is proportional to bytes not copied. For a 1 GB static response, avoiding two user-space copy legs can save roughly 2 GB of memory traffic, though the exact win depends on CPU, cache, NIC, TLS path, and filesystem support. When file size doubles, copy traffic in the naive path doubles; reference bookkeeping grows with segments and pages.',
        'The space cost moves from user buffers to pinned or referenced kernel pages and queued descriptors. The engineering cost is higher than the happy-path syscall: short writes, EAGAIN, cancellation, rate limits, offset accounting, and fallback all need tests. Small files may lose because setup and branching dominate the saved copy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The best fit is large static payloads: media segments, downloads, cached assets, backup streams, and reverse-proxy paths that forward unchanged bodies. The access pattern is sequential, and the application value is in routing and accounting rather than byte inspection.',
        'It also appears in high-throughput servers that need to reduce CPU per transferred gigabyte. The useful metric is not whether sendfile was called, but how many response bytes actually stayed on a zero-copy-compatible path under real clients and TLS settings.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when bytes must be changed in user space. Compression, application-layer encryption, content filtering, templating, checksumming, or unsupported descriptor pairs can force a copy or a different offload path. Kernel TLS and device offloads can change the answer, so measurement matters.',
        'It also fails as a memory-pressure story if slow clients keep many page references queued. Avoiding copies does not make queues infinite. A server still needs per-connection caps, global limits, timeouts, and fallback observability.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a server must send a 16 MB file over a socket, and the loop uses a 64 KB user buffer. The read/write path performs 256 reads and 256 writes at the buffer size, and it copies 16 MB from page cache to user space plus 16 MB from user space toward the socket path. The application paid 32 MB of copy traffic for bytes it never inspected.',
        'With sendfile, the first call asks for 16 MB and the socket accepts 5 MB before its queue fills. The application records offset 5 MB and waits for writability. Three later calls move 5 MB, 5 MB, and 1 MB, producing the same 16 MB stream with four progress records instead of 512 buffer-copy operations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with Linux sendfile(2) at https://man7.org/linux/man-pages/man2/sendfile.2.html. Read Linux splice(2) at https://man7.org/linux/man-pages/man2/splice.2.html and the kernel splice notes at https://www.kernel.org/doc/html/latest/filesystems/splice.html for the pipe-buffer model.',
        'Study File Descriptor Table and Open File Description for offsets, then Linux Page Cache XArray for source pages. After that, use epoll Interest and Ready Lists, io_uring Submission and Completion Rings, and Backpressure and Flow Control to understand how the transfer loop is driven.',
      ],
    },
  ],
};
