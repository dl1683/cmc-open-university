// RDMA verbs: queue pairs, work requests, memory registration, completions, and
// the ownership rules that make zero-copy network IO safe enough to use.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rdma-queue-pair-work-request-case-study',
  title: 'RDMA Queue Pair & Work Request Case Study',
  category: 'Systems',
  summary: 'An RDMA verbs primer: registered memory, queue pairs, send and receive queues, work requests, completion queues, remote keys, and polling loops.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['verbs path', 'flow control'], defaultValue: 'verbs path' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function verbsGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 3.5, note: 'user' },
      { id: 'mr', label: 'MR', x: 2.1, y: 1.7, note: 'lkey/rkey' },
      { id: 'sq', label: 'SQ', x: 2.1, y: 3.5, note: 'send' },
      { id: 'rq', label: 'RQ', x: 2.1, y: 5.3, note: 'recv' },
      { id: 'qp', label: 'QP', x: 4.0, y: 3.5, note: 'state' },
      { id: 'hca', label: 'HCA', x: 5.8, y: 3.5, note: 'NIC' },
      { id: 'wire', label: 'net', x: 7.2, y: 3.5, note: 'IB/RoCE' },
      { id: 'peer', label: 'peer', x: 8.7, y: 3.5, note: 'remote' },
      { id: 'cq', label: 'CQ', x: 5.8, y: 5.7, note: 'done' },
      { id: 'poll', label: 'poll', x: 4.0, y: 5.7, note: 'loop' },
    ],
    edges: [
      { id: 'e-app-mr', from: 'app', to: 'mr', weight: 'reg' },
      { id: 'e-app-sq', from: 'app', to: 'sq', weight: 'post' },
      { id: 'e-app-rq', from: 'app', to: 'rq', weight: 'post' },
      { id: 'e-sq-qp', from: 'sq', to: 'qp', weight: 'WR' },
      { id: 'e-rq-qp', from: 'rq', to: 'qp', weight: 'WR' },
      { id: 'e-qp-hca', from: 'qp', to: 'hca', weight: 'door' },
      { id: 'e-hca-wire', from: 'hca', to: 'wire', weight: 'DMA' },
      { id: 'e-wire-peer', from: 'wire', to: 'peer', weight: 'pkt' },
      { id: 'e-hca-cq', from: 'hca', to: 'cq', weight: 'CQE' },
      { id: 'e-cq-poll', from: 'cq', to: 'poll', weight: '' },
      { id: 'e-poll-app', from: 'poll', to: 'app', weight: 'status' },
    ],
  }, { title });
}

function stateGraph(title) {
  return graphState({
    nodes: [
      { id: 'reset', label: 'RST', x: 1.0, y: 3.5, note: 'new' },
      { id: 'init', label: 'INIT', x: 2.7, y: 3.5, note: 'ports' },
      { id: 'rtr', label: 'RTR', x: 4.5, y: 3.5, note: 'peer' },
      { id: 'rts', label: 'RTS', x: 6.3, y: 3.5, note: 'send' },
      { id: 'err', label: 'ERR', x: 8.1, y: 3.5, note: 'fault' },
      { id: 'cq', label: 'CQ', x: 4.5, y: 5.8, note: 'drain' },
      { id: 'credit', label: 'cred', x: 6.3, y: 5.8, note: 'recv' },
      { id: 'retry', label: 'ret', x: 8.1, y: 5.8, note: 'timeout' },
    ],
    edges: [
      { id: 'e-reset-init', from: 'reset', to: 'init', weight: '' },
      { id: 'e-init-rtr', from: 'init', to: 'rtr', weight: '' },
      { id: 'e-rtr-rts', from: 'rtr', to: 'rts', weight: '' },
      { id: 'e-rts-err', from: 'rts', to: 'err', weight: 'bad' },
      { id: 'e-rts-cq', from: 'rts', to: 'cq', weight: 'CQE' },
      { id: 'e-credit-rts', from: 'credit', to: 'rts', weight: 'ok' },
      { id: 'e-retry-err', from: 'retry', to: 'err', weight: 'fail' },
      { id: 'e-cq-credit', from: 'cq', to: 'credit', weight: '' },
    ],
  }, { title });
}

function* verbsPath() {
  yield {
    state: verbsGraph('RDMA starts with registered memory'),
    highlight: { active: ['app', 'mr', 'e-app-mr'], compare: ['hca'] },
    explanation: 'The app first registers memory so the adapter can translate virtual addresses, pin pages, and enforce permissions. The local key and remote key are capabilities, not decoration.',
  };

  yield {
    state: verbsGraph('Work requests enter send and receive queues'),
    highlight: { active: ['sq', 'rq', 'qp', 'e-app-sq', 'e-app-rq', 'e-sq-qp', 'e-rq-qp'], found: ['mr'] },
    explanation: 'A queue pair owns a send queue and a receive queue. The app posts work requests, then rings a doorbell so the HCA can execute them without a kernel round trip for every message.',
    invariant: 'A posted work request is a promise about buffers, keys, opcodes, and lifetimes.',
  };

  yield {
    state: verbsGraph('The HCA moves bytes and writes completions'),
    highlight: { active: ['hca', 'wire', 'peer', 'e-hca-wire', 'e-wire-peer'], found: ['cq', 'e-hca-cq'], compare: ['app'] },
    explanation: 'The network adapter performs DMA and protocol work. When a work request ends, the HCA writes a completion queue entry, and the application polls or waits for it.',
  };

  yield {
    state: labelMatrix(
      'Verbs objects',
      [
        { id: 'mr', label: 'MR' },
        { id: 'qp', label: 'QP' },
        { id: 'wr', label: 'WR' },
        { id: 'cq', label: 'CQ' },
        { id: 'key', label: 'key' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pages', 'stale'],
        ['queues', 'state'],
        ['op', 'life'],
        ['done', 'lost'],
        ['perm', 'leak'],
      ],
    ),
    highlight: { active: ['mr:owns', 'qp:owns', 'wr:owns'], found: ['cq:owns'], compare: ['key:risk'] },
    explanation: 'RDMA verbs are small control-plane objects around dangerous data-plane power. Memory regions, queue pairs, work requests, completion queues, and keys make remote DMA explicit enough to audit.',
  };
}

function* flowControl() {
  yield {
    state: stateGraph('Queue pairs move through explicit states'),
    highlight: { active: ['reset', 'init', 'rtr', 'rts', 'e-reset-init', 'e-init-rtr', 'e-rtr-rts'], compare: ['err'] },
    explanation: 'A reliable connected queue pair is configured in stages: reset, init, ready to receive, ready to send. That state machine prevents the NIC from interpreting half-configured metadata as a valid endpoint.',
  };

  yield {
    state: stateGraph('Receive credits are real capacity'),
    highlight: { active: ['credit', 'rts', 'e-credit-rts'], found: ['cq'], compare: ['err'] },
    explanation: 'For receive-based operations, the peer needs posted receive buffers. If the receiver forgets to post them or drains completions too slowly, a fast sender can run into queue exhaustion.',
    invariant: 'Zero-copy does not remove backpressure; it moves backpressure into queues and credits.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'recv', label: 'recv' },
        { id: 'cq', label: 'CQ' },
        { id: 'mr', label: 'MR' },
        { id: 'key', label: 'key' },
        { id: 'ord', label: 'ord' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['empty', 'post'],
        ['full', 'poll'],
        ['free', 'ref'],
        ['wrong', 'rotate'],
        ['race', 'fence'],
        ['hang', 'retry'],
      ],
    ),
    highlight: { active: ['recv:bad', 'cq:bad', 'mr:bad'], found: ['recv:fix', 'cq:fix', 'ord:fix'] },
    explanation: 'The common bugs are ownership bugs: missing receives, full completion queues, freed memory regions, stale keys, weak ordering, and timeout paths that do not clean up both sides.',
  };

  yield {
    state: labelMatrix(
      'RDMA versus sockets',
      [
        { id: 'copy', label: 'copy' },
        { id: 'cpu', label: 'CPU' },
        { id: 'lat', label: 'lat' },
        { id: 'code', label: 'code' },
      ],
      [
        { id: 'tcp', label: 'TCP' },
        { id: 'rdma', label: 'RDMA' },
      ],
      [
        ['often', 'avoid'],
        ['higher', 'lower'],
        ['more', 'less'],
        ['simple', 'strict'],
      ],
    ),
    highlight: { found: ['copy:rdma', 'cpu:rdma', 'lat:rdma'], compare: ['code:rdma'] },
    explanation: 'RDMA can reduce copies, CPU load, and latency, but the programming model is stricter. The application now owns queue depth, memory lifetime, key hygiene, and completion polling.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'verbs path') yield* verbsPath();
  else if (view === 'flow control') yield* flowControl();
  else throw new InputError('Pick an RDMA queue-pair view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'RDMA exists because some systems cannot afford to treat networking as a stream of kernel-mediated copies. A storage server, distributed database, training job, or inference cluster may move small control messages and large data buffers at rates where extra copies, syscalls, interrupts, and scheduler wakeups dominate the useful work.',
        'Remote Direct Memory Access moves bytes between registered memory regions through the network adapter. The remote CPU does not have to run an application receive handler for every data movement on the hot path. That promise is attractive, but it is also dangerous. If a NIC can DMA into process memory, the system needs explicit objects that describe which memory is legal, which endpoint may use it, which operation is outstanding, and when ownership returns.',
        {type:'callout', text:'RDMA is fast because ownership moves into explicit verbs objects: registered memory, queue pairs, work requests, and completions define what the adapter may touch and when buffers are safe again.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Infinibandport.jpg', alt:'Close-up of InfiniBand switch ports on a network module.', caption:'InfiniBand switch ports. RDMA verbs expose the hardware data path through registered memory, queue pairs, work requests, and completions. Source: Wikimedia Commons, Omukosan-shibo, CC BY 2.5.'},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The reasonable first attempt is to use TCP sockets. The application writes bytes to a socket, the kernel copies or references buffers, the network stack handles segmentation and retransmission, and the receiver reads bytes when it is scheduled. This model is portable and forgiving. The kernel owns a large part of the safety story.',
        'Sockets are often the right answer. They become the wrong answer when the cost of generality is larger than the work itself. A microsecond-scale storage read or parameter transfer can spend too much budget on copy paths and CPU wakeups. The tempting shortcut is to remove those costs by letting the adapter move data directly. RDMA does that, but it replaces kernel convenience with a stricter application contract.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'Zero-copy is not magic; it is a transfer of responsibility. If the application posts a send work request that points at a buffer, that buffer must remain valid until the hardware reports completion. If a receiver expects a message-based operation, it must have receive buffers posted before the packet arrives. If completion queues fill because the application stopped polling, the data path can stall or fail.',
        'The other wall is capability safety. A remote peer cannot be allowed to write arbitrary virtual memory. RDMA therefore uses memory registration and keys. A local key authorizes the local adapter to access a registered region. A remote key can authorize a peer to perform RDMA read or write against that region, depending on permissions. Stale or leaked keys are not bookkeeping mistakes; they are access-control bugs.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'RDMA verbs turn direct hardware data movement into a set of explicit ownership records. A memory region says which pages are pinned and which keys authorize access. A queue pair says which endpoint state and queues belong together. A work request says which operation the adapter may perform. A completion queue entry says when the operation finished and whether the application may reclaim the buffers.',
        'The invariant is ownership until completion. Posting a work request is a promise about buffers, keys, opcodes, queue capacity, and lifetimes. Ringing the doorbell hands that promise to the host channel adapter. Polling the completion queue is how the application learns that the promise has been settled.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'The path starts with memory registration. The application asks the RDMA stack to register a memory range. Registration pins pages, records translation information for the adapter, checks access permissions, and returns keys. This step is often expensive, so serious systems pool buffers, reuse memory regions, or build registration caches rather than registering on every operation.',
        'The application then creates queue pairs. A queue pair contains a send queue and a receive queue plus state needed to talk to a peer. For reliable connected transport, the queue pair moves through reset, init, ready to receive, and ready to send. Those states prevent a half-configured endpoint from being treated as a live data path.',
        'Work requests are posted into the queues. A send, receive, RDMA read, RDMA write, or atomic operation names buffers and keys through scatter-gather entries. The application rings a doorbell so the HCA can fetch work. The adapter performs protocol work and DMA. When the operation ends, it writes a completion queue entry. The application polls or waits on the completion queue, checks status, and then reuses or frees resources only after completion permits it.',
      ],
    },
    {
      heading: 'Visual Proof',
      paragraphs: [
        'The verbs path proves that RDMA is not one object. The application, memory region, send queue, receive queue, queue pair, HCA, wire, peer, completion queue, and polling loop each hold a different part of the contract. Removing any one of them makes the safety story incomplete. A buffer without a key cannot be used by the adapter; a work request without a completion leaves ownership unresolved; a queue pair without state can point hardware at a peer that is not ready.',
        'The flow-control view proves that zero-copy still has backpressure. Receive credits are real capacity. A sender can be fast only when the receiver has posted buffers and the application is draining completions. The failure ledger names the practical bugs: missing receives, full completion queues, freed memory regions, wrong keys, weak ordering, and timeout paths that do not clean up both sides.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The model works because every unsafe action is represented by an object that can be checked. The HCA can DMA only to memory the process registered with the required permissions. A remote peer needs a valid remote key for remote access. A work request can execute only after it is posted to a queue pair in the right state. A buffer is not safely reusable until the relevant completion says the adapter is done with it.',
        'This is not a proof that every RDMA program is correct. It is a proof of where correctness has to live. The application must maintain the lifetime invariant, queue-depth invariant, and key-permission invariant. The adapter enforces the parts it can see. Bugs happen when the program assumes the kernel is still managing a resource that the verbs contract moved into user space.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'RDMA can reduce copy overhead, CPU load, and latency, but it adds setup cost and operational complexity. Memory registration pins pages and consumes adapter resources. Polling can burn CPU to avoid interrupt latency. Queue pairs, completion queues, and memory regions have capacity limits. A design that creates too many connections or registers too many tiny buffers can lose the performance it was trying to buy.',
        'The main scaling behavior is queue pressure. More outstanding operations require deeper send queues, receive queues, and completion queues. Larger messages amortize setup better than tiny messages, but they hold buffers longer. More peers can mean more queue pairs or a more complex transport choice. On RoCE, the Ethernet fabric also matters: congestion control, loss behavior, priority flow control, and ECN tuning can decide whether the fast path remains fast.',
      ],
    },
    {
      heading: 'Uses and Failure Modes',
      paragraphs: [
        'RDMA fits systems where data movement is frequent, latency-sensitive, and buffer ownership can be engineered carefully. High-performance storage uses it to move blocks with less CPU work. Databases use it for low-latency replication or disaggregated memory experiments. Distributed training and inference systems use it for parameter movement, embedding tables, KV-cache transfer, or GPU-adjacent data paths when the rest of the stack can honor the ownership rules.',
        'It is the wrong tool for ordinary request-response services that value simplicity, portability, and failure isolation more than shaving microseconds. Sockets, HTTP, or a message broker are better when the bottleneck is application logic, serialization, disk, or business workflow. RDMA raises the engineering floor: deployment, observability, retry policy, memory lifetime, and fabric behavior all need expertise.',
        'The common failures are ownership failures. A receive queue runs empty and the sender hits an error. A completion queue fills because polling stopped. A memory region is deregistered while work is still outstanding. A remote key remains valid after the application meant to revoke access. A timeout moves one side to error while the other still believes the queue pair is ready. RDMA makes the data path faster, so these mistakes surface quickly and sometimes severely.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: NVIDIA RDMA Aware Networks Programming User Manual at https://networking-docs.nvidia.com/rdmaawareprogramming and NVIDIA RDMA key concepts at https://docs.nvidia.com/networking/display/RDMAAwareProgrammingv17/Key+Concepts. Those docs define the verbs vocabulary: memory regions, local and remote keys, queue pairs, work requests, completion queues, and state transitions.',
        'Study Queue and Ring Buffer for the bounded-buffer base. Study io_uring Submission/Completion Rings for a related user-kernel ownership model. Study NIC RX Ring and NAPI Poll for adapter-to-CPU packet flow. Study Backpressure and Flow Control for the queue-depth invariant. Then study GPUDirect RDMA Peer Memory Case Study, RoCE PFC ECN DCQCN Lossless Fabric Case Study, and KV Cache Transfer Fabric Case Study to see why RDMA becomes a systems design problem rather than only an API.',
      ],
    },
  ],
};
