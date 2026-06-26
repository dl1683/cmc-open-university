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
  const nodeCount = 8;          // nodes in the uring graph
  const edgeCount = 9;          // edges in the uring graph
  const submitSteps = 4;        // edges on the submission path: app->sqe->sq->enter->kernel
  const completeSteps = 3;      // edges on the completion path: kernel->cq->cqe->app
  const queueParts = 4;         // sqe, sq, cq, eventfd

  yield {
    state: uringGraph('io_uring is two shared ring buffers plus SQE storage'),
    highlight: { active: ['app', 'sqe', 'sq', 'cq', 'cqe', 'kernel'], found: ['device'] },
    explanation: `io_uring makes async I/O visible as two shared queues across ${nodeCount} components linked by ${edgeCount} edges. User space publishes requests in the submission side, and the kernel publishes results in the completion side.`,
    invariant: `Submission and completion are decoupled: a request can leave SQ long before its CQE appears across the ${edgeCount}-edge pipeline.`,
  };

  yield {
    state: uringGraph('User space fills SQEs and advances the SQ tail', { sqe: 'read fd', sq: 'tail=3', enter: 'doorbell' }),
    highlight: { active: ['app', 'sqe', 'sq', 'enter', 'e-app-sqe', 'e-sqe-sq', 'e-sq-enter'], compare: ['cq'] },
    explanation: `The application prepares one or more SQEs, publishes their indexes through the submission ring, and may call io_uring_enter to notify the kernel — ${submitSteps} hops from app to kernel.`,
  };

  yield {
    state: uringGraph('The kernel consumes SQ and later produces CQEs', { kernel: 'worker/path', device: 'read', cq: 'tail++', cqe: 'res=4096' }),
    highlight: { active: ['kernel', 'device', 'cq', 'cqe', 'e-kernel-device', 'e-kernel-cq', 'e-cq-cqe'], found: ['app'] },
    explanation: `The completion queue entry carries the user data and result code. The result travels ${completeSteps} hops back to the app, which can reap many completions in batches instead of blocking one thread per I/O.`,
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
    explanation: `All ${queueParts} queue components have clear ownership. The submission side separates SQE storage from the SQ index ring. The completion side stores results directly. Head/tail discipline and memory barriers are the contract that makes shared memory safe.`,
  };
}

function* asyncFileServerCaseStudy() {
  const serverPhases = 4;   // accept, read, send, reap
  const riskCategories = 4; // ringfull, cqoverflow, ordering, fallback
  const batchLabel = 'N ops';

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
    explanation: `A file server's ${serverPhases} phases (accept, read, send, reap) become a small event loop that submits many reads and sends, then reaps completions as they finish. It does not need one blocked thread for every outstanding operation.`,
  };

  yield {
    state: uringGraph('Batched submissions amortize kernel entry cost', { app: 'server loop', sqe: 'N ops', sq: 'batch', enter: 'one call', cq: 'many CQEs', cqe: 'done set' }),
    highlight: { active: ['app', 'sqe', 'sq', 'enter', 'cq', 'cqe'], found: ['kernel'] },
    explanation: `Batching is the practical payoff. The app can prepare ${batchLabel} SQEs, submit them together, and later process a burst of CQEs across all ${serverPhases} phases.`,
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
    explanation: `io_uring shifts the shape of the bottleneck across ${riskCategories} risk categories. You still need backpressure, completion correlation, kernel feature detection, and careful limits on outstanding work.`,
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
    {heading: 'How to read the animation', paragraphs: ['The animation shows two shared ring buffers between user space and the Linux kernel. User space publishes submissions, the kernel publishes completions, and head and tail pointers mark ownership.', {type: 'image', src: './assets/gifs/io-uring-submission-completion-rings.gif', alt: 'Animated walkthrough of the io uring submission completion rings visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['High-concurrency I/O spends a lot of time crossing the user-kernel boundary. io_uring exists so a program can submit many operations and later drain many results through shared queues.', {type: 'callout', text: 'io_uring turns coordination into head and tail ownership: user space publishes requests, kernel publishes completions.'}]},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is blocking I/O: call read, write, accept, or fsync and wait. It is simple, but thousands of slow clients can mean thousands of sleeping threads and scheduler work.']},
    {heading: 'The wall', paragraphs: ['Readiness APIs such as epoll report that an operation may make progress, not that it finished. File I/O and partial network progress still force the application to manage many state machines.']},
    {heading: 'The core insight', paragraphs: ['Represent I/O coordination as producer-consumer rings. The app owns the submission tail, the kernel owns the completion tail, and user_data joins an out-of-order completion back to request state.', {type: 'image', src: 'https://developers.redhat.com/sites/default/files/uring_0.png', alt: 'io_uring submission and completion queues shared between application and kernel', caption: 'The two shared rings show the ownership contract: app writes SQ tail, kernel writes CQ tail. Source: Red Hat Developer, Donald Hunter.'}]},
    {heading: 'How it works', paragraphs: ['Setup maps submission metadata, completion metadata, and SQE storage into the process. The app fills an SQE, publishes its index, enters the kernel when needed, and later consumes CQEs containing user_data and result.']},
    {heading: 'Why it works', paragraphs: ['A ring works because producer and consumer agree on head, tail, and capacity. Batching works because one kernel entry or wakeup can cover many operations, reducing coordination cost per operation.']},
    {heading: 'Cost and complexity', paragraphs: ['Ring operations are O(1), but the program must manage request lifetimes, full rings, completion draining, cancellation races, and backpressure. Registered buffers and files reduce repeated overhead but add setup and lifecycle rules.']},
    {heading: 'Real-world uses', paragraphs: ['Static file servers, proxies, storage engines, databases, log systems, and high-throughput network services use io_uring when many operations must stay in flight. It is strongest when batching and queue depth hide device or network latency.']},
    {heading: 'Where it fails', paragraphs: ['It is often the wrong first tool for small programs or servers already served well by epoll. It also does not make slow devices fast; page-cache misses, network congestion, and downstream backpressure remain.']},
    {heading: 'Worked example', paragraphs: ['A server with ring capacity 256 submits 64 read SQEs and later receives 40 CQEs. If one kernel entry publishes 64 reads instead of 64 read calls, boundary cost per submitted operation falls sharply, but storage latency still dominates slow reads.']},
    {heading: 'Sources and study next', paragraphs: ['Read the Linux io_uring man page, io_uring_setup man page, LWN introduction, and liburing examples. Then study Ring Buffer, epoll Interest and Ready Lists, Futex Wait Queue, Backpressure and Flow Control, and TCP Listen Backlog.']},
  ],
};
