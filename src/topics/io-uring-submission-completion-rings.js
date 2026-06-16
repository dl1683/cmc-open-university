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
    explanation: 'An io_uring instance gives user space and the kernel shared submission and completion queues. The app writes submission queue entries, the kernel consumes them, and completions appear in the completion ring.',
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
    explanation: 'The submission side has SQE storage and a submission ring. The completion side is a ring of completion entries. Head/tail discipline and memory barriers make the shared queues safe.',
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
      heading: 'What it is',
      paragraphs: [
        'io_uring is a Linux asynchronous I/O interface built around shared ring buffers. User space submits work through a submission queue, and the kernel reports results through a completion queue. epoll Interest & Ready Lists is the useful contrast: epoll reports readiness, while io_uring reports operation completions.',
        'The data-structure lesson is that async I/O becomes a pair of producer/consumer rings with explicit head and tail movement, not a hidden stack of blocked threads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application fills submission queue entries with operations such as reads, writes, accepts, timeouts, or linked operations. It publishes indexes through the submission ring and notifies the kernel. The kernel consumes entries, performs the work, and writes completion queue entries with result codes and user_data.',
        'The SQ and CQ are shared memory queues. That enables batching and fewer copies, but it also means memory-ordering discipline, ring capacity, overflow handling, and completion correlation are part of correctness.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A static file server can submit accepts, reads, and sends without dedicating a thread to each blocked operation. The server loop batches SQEs, enters the kernel, and later reaps CQEs. user_data links each completion back to the request state machine.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'io_uring does not remove backpressure. A full submission queue, a completion queue that is not drained fast enough, unsupported operations, memory registration costs, and kernel-version differences can all dominate. It gives a sharper queue interface; the application still owns flow control.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: io_uring man page at https://man7.org/linux/man-pages/man7/io_uring.7.html, io_uring_setup man page at https://man7.org/linux/man-pages/man2/io_uring_setup.2.html, LWN introduction at https://lwn.net/Articles/776703/, and Oracle Linux io_uring overview at https://blogs.oracle.com/linux/an-introduction-to-the-io-uring-asynchronous-io-framework. Study Ring Buffer, eBPF Ring Buffer Telemetry Case Study, Event Loop, epoll Interest & Ready Lists, Futex Wait Queue, Backpressure & Flow Control, Message Queues, and Linux Fair Scheduler Run Queue next.',
      ],
    },
  ],
};
