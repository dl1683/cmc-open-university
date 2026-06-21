// io_uring: shared submission and completion rings between user space and the
// Linux kernel, turning async I/O into two coordinated ring-buffer queues.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'io-uring-submission-completion-rings',
  title: 'io_uring Submission & Completion Rings',
  category: 'Systems',
  summary: 'Linux io_uring uses shared submission and completion ring buffers so applications enqueue I/O and reap results with fewer copies and fewer syscalls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared rings', 'async file server case study'], defaultValue: 'shared rings' },
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

function uringGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.8, y: 4.0, note: notes.app ?? 'user space' },
      { id: 'sqe', label: 'SQE', x: 2.5, y: 2.0, note: notes.sqe ?? 'request' },
      { id: 'sq', label: 'SQ', x: 4.5, y: 2.0, note: notes.sq ?? 'tail++' },
      { id: 'enter', label: 'doorbell', x: 6.5, y: 2.0, note: notes.enter ?? 'submit' },
      { id: 'kernel', label: 'kern', x: 8.2, y: 3.7, note: notes.kernel ?? 'consume' },
      { id: 'device', label: 'dev', x: 9.5, y: 4.8, note: notes.device ?? 'I/O' },
      { id: 'cq', label: 'CQ', x: 4.5, y: 6.0, note: notes.cq ?? 'head' },
      { id: 'cqe', label: 'CQE', x: 2.5, y: 6.0, note: notes.cqe ?? 'results' },
    ],
    edges: [
      { id: 'e-app-sqe', from: 'app', to: 'sqe', weight: 'fill' },
      { id: 'e-sqe-sq', from: 'sqe', to: 'sq', weight: 'idx' },
      { id: 'e-sq-enter', from: 'sq', to: 'enter', weight: 'tail' },
      { id: 'e-enter-kernel', from: 'enter', to: 'kernel', weight: '' },
      { id: 'e-kernel-device', from: 'kernel', to: 'device', weight: 'submit' },
      { id: 'e-device-kernel', from: 'device', to: 'kernel', weight: 'done' },
      { id: 'e-kernel-cq', from: 'kernel', to: 'cq', weight: 'produce' },
      { id: 'e-cq-cqe', from: 'cq', to: 'cqe', weight: 'read' },
      { id: 'e-cqe-app', from: 'cqe', to: 'app', weight: 'result' },
    ],
  }, { title });
}

function* sharedRings() {
  yield {
    state: uringGraph('io_uring is two shared ring buffers plus SQE storage'),
    highlight: { active: ['app', 'sqe', 'sq', 'cq', 'cqe', 'kernel'], found: ['device'] },
    explanation: 'io_uring makes async I/O visible as two shared queues. User space publishes requests in the submission side, and the kernel publishes results in the completion side.',
    invariant: 'Submission and completion are decoupled: a request can leave SQ long before its CQE appears.',
  };

  yield {
    state: uringGraph('User space fills SQEs and advances the SQ tail', { sqe: 'read fd', sq: 'tail=3', enter: 'doorbell' }),
    highlight: { active: ['app', 'sqe', 'sq', 'enter', 'e-app-sqe', 'e-sqe-sq', 'e-sq-enter'], compare: ['cq'] },
    explanation: 'The application prepares one or more SQEs, publishes their indexes through the submission ring, and may call io_uring_enter to notify the kernel.',
  };

  yield {
    state: uringGraph('The kernel consumes SQ and later produces CQEs', { kernel: 'worker/path', device: 'read', cq: 'tail++', cqe: 'res=4096' }),
    highlight: { active: ['kernel', 'device', 'cq', 'cqe', 'e-kernel-device', 'e-kernel-cq', 'e-cq-cqe'], found: ['app'] },
    explanation: 'The completion queue entry carries the user data and result code. The application can reap many completions in batches instead of blocking one thread per I/O.',
  };

  yield {
    state: labelMatrix(
      'Queue responsibilities',
      [
        { id: 'sqe', label: 'SQE array' },
        { id: 'sq', label: 'SQ ring' },
        { id: 'cq', label: 'CQ ring' },
        { id: 'eventfd', label: 'wakeup' },
      ],
      [
        { id: 'owner', label: 'main writer' },
        { id: 'holds', label: 'holds' },
      ],
      [
        ['app', 'request fields'],
        ['app', 'indexes/tail'],
        ['kernel', 'result entries'],
        ['kernel/app', 'notification'],
      ],
    ),
    highlight: { active: ['sqe:holds', 'sq:owner', 'cq:owner'], compare: ['eventfd:holds'] },
    explanation: 'The submission side separates SQE storage from the SQ index ring. The completion side stores results directly. Head/tail discipline and memory barriers are the contract that makes shared memory safe.',
  };
}

function* asyncFileServerCaseStudy() {
  yield {
    state: labelMatrix(
      'Static file server loop',
      [
        { id: 'accept', label: 'accept' },
        { id: 'read', label: 'read file' },
        { id: 'send', label: 'send' },
        { id: 'reap', label: 'reap CQE' },
      ],
      [
        { id: 'old', label: 'thread-per-op' },
        { id: 'uring', label: 'io_uring' },
      ],
      [
        ['thread blocks', 'submit accept'],
        ['worker blocks', 'submit read'],
        ['worker blocks', 'submit send'],
        ['wake one/many', 'batch completions'],
      ],
    ),
    highlight: { active: ['read:uring', 'send:uring', 'reap:uring'], compare: ['read:old'] },
    explanation: 'A file server can keep a small event loop that submits many reads and sends, then reaps completions as they finish. It does not need one blocked thread for every outstanding operation.',
  };

  yield {
    state: uringGraph('Batched submissions amortize kernel entry cost', { app: 'server loop', sqe: 'N ops', sq: 'batch', enter: 'one call', cq: 'many CQEs', cqe: 'done set' }),
    highlight: { active: ['app', 'sqe', 'sq', 'enter', 'cq', 'cqe'], found: ['kernel'] },
    explanation: 'Batching is the practical payoff. The app can prepare several SQEs, submit them together, and later process a burst of CQEs.',
  };

  yield {
    state: labelMatrix(
      'Operational risks',
      [
        { id: 'ringfull', label: 'SQ full' },
        { id: 'cqoverflow', label: 'CQ overflow' },
        { id: 'ordering', label: 'ordering' },
        { id: 'fallback', label: 'unsupported op' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['cannot submit', 'backpressure'],
        ['lost batching', 'drain faster'],
        ['completion reorder', 'user_data join'],
        ['slow path', 'feature probe'],
      ],
    ),
    highlight: { active: ['ringfull:control', 'ordering:control'], compare: ['cqoverflow:symptom'] },
    explanation: 'io_uring shifts the shape of the bottleneck. You still need backpressure, completion correlation, kernel feature detection, and careful limits on outstanding work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared rings') yield* sharedRings();
  else if (view === 'async file server case study') yield* asyncFileServerCaseStudy();
  else throw new InputError('Pick an io_uring view.');
}

export const article = {
  sections: [
    {
      heading: 'What problem io_uring solves',
      paragraphs: [
        'A busy server spends much of its life waiting on the kernel. It accepts sockets, reads files, writes responses, arms timeouts, cancels work, and cleans up after clients that disappear. The CPU may be free, but each operation still crosses the user-kernel boundary. If every request blocks a thread, memory and scheduler overhead grow with the number of outstanding operations. If the server uses readiness APIs, it avoids most blocked threads, but it still has to ask the kernel which descriptors are ready, issue the operation, and handle partial progress.',
        {type: 'callout', text: 'io_uring turns coordination into head and tail ownership: user space publishes requests, kernel publishes completions.'},
        'io_uring exists to make high-concurrency I/O look like two shared queues. User space writes requests into a submission side. The kernel writes results into a completion side. The application can publish many operations, ring the kernel once, and later drain many completions. The data-structure lesson is simple: when both sides already agree on a bounded ring buffer layout, the hot path can become head/tail movement plus batched work instead of one syscall per small step.',
      ],
    },
    {
      heading: 'The older models',
      paragraphs: [
        'The first model is blocking I/O. A thread calls read(), write(), accept(), send(), or fsync(), then sleeps until the operation can finish or fail. It is easy to write and easy to debug. It also scales poorly when most operations are waiting. A thread has a stack, scheduler state, wakeup costs, and cache footprint even when it is asleep.',
        'The second model is readiness notification. select, poll, and epoll tell the program that an operation on a descriptor should make progress. This is a major improvement for network servers, but readiness is not completion. The app still has to perform the read or write, handle short reads, retry when it would block, and manage a state machine for every live request. For files, readiness is also a poor fit because regular files are usually reported ready even when the real work may still block on storage.',
      ],
    },
    {
      heading: 'The core data structure',
      paragraphs: [
        'An io_uring instance has a submission queue, a completion queue, and a separate array of submission queue entries. The application fills an SQE with an operation code, file descriptor or registered file slot, buffer address or registered buffer slot, length, offset, flags, and a user_data value. It then publishes the SQE index into the submission ring and advances the submission tail. The kernel consumes those indexes, reads the SQEs, executes the operations, and writes CQEs into the completion ring.',
        {type: 'image', src: 'https://developers.redhat.com/sites/default/files/uring_0.png', alt: 'io_uring submission and completion queues shared between application and kernel', caption: 'The two shared rings show the ownership contract: app writes SQ tail, kernel writes CQ tail. Source: Red Hat Developer, Donald Hunter.'},
        'The completion queue entry is the receipt. It carries the original user_data field, a result value, and flags. The result is often a byte count or a negative errno. user_data is the stable join key because completions do not have to arrive in submission order. A server might submit accept, read, timeout, and send operations in one batch. The CQE tells the server exactly which request state to resume.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a static file server handling 10,000 slow clients. In a blocking design, it may need many worker threads or a complex handoff between an event loop and a file I/O pool. With epoll, the network readiness side is efficient, but file reads and sends still require careful state transitions. With io_uring, the main loop can keep a bounded number of outstanding operations: accept new sockets, issue file reads, issue sends, and arm timeouts.',
        'For one request, the server submits a read SQE with user_data pointing to request 42. It also submits a timeout SQE with user_data pointing to request 42 and a different tag. The kernel may complete the read first with res=4096, or the timeout first with res=-ETIME. The application drains CQEs, looks up request 42, and takes the next step. If the read won, it submits a send. If the timeout won, it cancels or closes the request. The queue does not make the policy for the app; it gives the app a precise, batched completion boundary.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The shared-rings view separates the pieces that beginners often merge together. SQE storage is not the same as the submission ring. The SQ ring publishes indexes into SQE storage. The CQ ring stores completed results. That split lets the application prepare rich request records while the hot submission path only moves small indexes and tail pointers.',
        'The file-server view shows the real payoff: batching and completion correlation. A server does not win just because a diagram contains rings. It wins when the loop can submit several operations with one kernel entry, keep enough work in flight to hide device latency, and drain completions in groups. It also shows the new obligations. Full rings are backpressure signals, CQ overflow is a correctness and performance risk, and every completion must be matched to application state through user_data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Setup starts with io_uring_setup, which creates ring metadata and returns a file descriptor. The application maps the submission ring, completion ring, and SQE array into its address space. From then on, the common path is shared memory. User space writes SQEs, publishes indexes, advances tails, and uses io_uring_enter when it needs to notify the kernel or wait for completions. Some configurations, such as submission queue polling, change the notification shape, but the ring contract remains the center.',
        'A submission has two phases. First the application writes the SQE fields. Then it makes that SQE visible by placing its index in the submission ring and advancing the tail with the required memory ordering. That ordering matters. The kernel must not see a tail update before the SQE contents are ready. The completion side has the opposite ownership. The kernel writes a CQE and advances the CQ tail. The application reads CQEs and advances the CQ head after it has consumed them.',
        'io_uring also includes features that reduce repeated per-operation overhead. Registered files can avoid repeated descriptor table lookups. Registered buffers can avoid repeated pinning work. Linked operations can express simple dependencies, such as a timeout attached to another operation. Cancellation lets the application remove work that is no longer useful. These features are not required to understand the ring, but they explain why io_uring became a full I/O interface rather than only a queue primitive.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because ownership is narrow. User space is the producer for submissions and the consumer for completions. The kernel is the consumer for submissions and the producer for completions. A ring buffer is a good fit for that contract because each side can tell which entries are available by comparing head and tail positions. The ring capacity gives a natural upper bound on outstanding queue metadata.',
        'The design also works because it prices the expensive boundary correctly. A syscall is not only the CPU instructions in the syscall handler. It is a privilege transition, argument validation, possible wakeups, and often a break in batching. If the application can publish 32 operations and notify the kernel once, or reap 32 completions after one wakeup, the cost per operation falls. The kernel still does the I/O. io_uring reduces the coordination tax around that I/O.',
        'The completion model removes a common ambiguity in readiness systems. Readiness says an operation may make progress. Completion says an operation finished and gives the result. That is why io_uring can be cleaner for applications whose real state machine is operation-based: "the file read finished", "the send finished", "the timeout fired", "the accept produced a socket".',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The ring operations are O(1), but that does not mean the system has zero overhead. The application must allocate ring capacity, keep request state alive until completion, drain the CQ promptly, and apply backpressure before the SQ fills. Registered buffers and files can improve the hot path, but they add setup cost, memory pinning concerns, and lifecycle rules. A program that registers too much memory or keeps too much work in flight can harm the rest of the system.',
        'The largest tradeoff is complexity. Blocking code is linear. io_uring code is a state machine driven by completions. Every request needs an identity, a current phase, cancellation behavior, timeout behavior, and cleanup rules. Error handling is also more explicit. A CQE with a negative result is not an exception from the call site; it is a later event that must be routed to the right request. That is powerful, but it punishes sloppy bookkeeping.',
        'Kernel support is another cost. io_uring has evolved quickly, and not every operation, flag, or optimization is available on every deployment target. Production programs need feature probing and fallback paths. Security policy can also matter because some environments restrict io_uring. A portable library has to know when ordinary epoll, blocking I/O, or a thread pool is the better answer.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'io_uring is strongest when there are many outstanding operations, enough batching to amortize kernel entry, and a real benefit from completion-based control. Static file servers, proxies, storage engines, log systems, databases, and high-throughput network services can all fit that profile. It is especially useful when one event loop wants to coordinate files, sockets, timeouts, cancellation, and sometimes zero-copy paths without handing half the work to a separate thread pool.',
        'It also wins when tail latency depends on keeping the device and kernel busy without flooding them. A storage engine can keep a controlled queue depth. A server can submit more work while older operations wait on disk or network. A proxy can cancel stale work when the client disconnects. These are not only speed tricks. They are control-plane improvements because the application has a single ledger of outstanding operations and completions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'io_uring is often the wrong first tool for small programs. A command-line program that reads one file, writes one response, or handles a few sockets will usually be simpler and fast enough with blocking calls. An evented network server that already uses epoll well and rarely touches files may not gain much. If there is little batching, the ring mostly adds setup and cognitive load.',
        'It also does not make slow I/O fast. Disk latency, network congestion, page-cache misses, memory pressure, and device queue limits still exist. If downstream is slow, the application must stop submitting unlimited work. If completions are not drained, the completion side becomes the bottleneck. If a request is canceled, the app must handle the race where the operation completes at the same time. The queue interface is sharper, but the system still needs flow control.',
        'A final misconception is that io_uring means "zero copy". It can combine with registered buffers and some zero-copy operations, but the core abstraction is asynchronous submission and completion through shared rings. Data movement depends on the specific operation and kernel path. The ring reduces coordination overhead; it does not automatically remove every copy in the data path.',
      ],
    },
    {
      heading: 'Misconceptions',
      paragraphs: [
        'Do not think of io_uring as just "faster epoll". epoll reports descriptor readiness. io_uring submits operations and reports completions. They overlap in server design, but they expose different facts. Do not think of it as a way to avoid all threads either. The kernel may still use worker paths for operations that need them, and the application may still use threads for CPU work.',
        'Do not treat the rings as unbounded mailboxes. Their bounded size is part of the correctness story. When the SQ is full, the application has reached its chosen queue depth. When the CQ is near full, the application is falling behind on completions. Those are control signals, not annoyances to hide behind a larger buffer.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: io_uring man page at https://man7.org/linux/man-pages/man7/io_uring.7.html, io_uring_setup man page at https://man7.org/linux/man-pages/man2/io_uring_setup.2.html, LWN introduction at https://lwn.net/Articles/776703/, and Oracle Linux io_uring overview at https://blogs.oracle.com/linux/an-introduction-to-the-io-uring-asynchronous-io-framework.',
        'Study Ring Buffer for the head/tail layout, eBPF Ring Buffer Telemetry Case Study for another kernel/user ring, The Event Loop and epoll Interest & Ready Lists for the readiness contrast, Futex Wait Queue Case Study for sleep and wake mechanics, Backpressure & Flow Control for capacity limits, Message Queues for producer-consumer design, TCP Listen Backlog & Accept Queue Case Study for admission pressure, and Linux Fair Scheduler Run Queue for the scheduler cost that blocked-thread designs create.',
      ],
    },
  ],
};
