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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the queue pair as the endpoint state that owns a send queue and a receive queue. Read a work request as an instruction handed to the network adapter, not as a function call that has already finished.',
        'A completion queue entry is the ownership signal. Until completion arrives, the application must assume the adapter may still read or write the buffers named by the work request.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Remote Direct Memory Access, or RDMA, lets a network adapter move bytes directly between registered memory regions. The goal is to avoid kernel-mediated copies, syscalls, interrupts, and scheduler wakeups on hot data paths.',
        'That speed is useful for storage, databases, distributed training, inference clusters, and low-latency replication. It is also dangerous because a device that can DMA into memory needs explicit rules about which buffers, peers, keys, queues, and lifetimes are valid.',
        {type:'callout', text:'RDMA is fast because ownership moves into explicit verbs objects: registered memory, queue pairs, work requests, and completions define what the adapter may touch and when buffers are safe again.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Infinibandport.jpg', alt:'Close-up of InfiniBand switch ports on a network module.', caption:'InfiniBand switch ports. RDMA verbs expose the hardware data path through registered memory, queue pairs, work requests, and completions. Source: Wikimedia Commons, Omukosan-shibo, CC BY 2.5.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is TCP sockets. The application writes bytes, the kernel manages most buffering and retransmission, and the receiver reads when scheduled.',
        'Sockets are portable and forgiving. They become expensive when a microsecond-scale storage read or parameter transfer spends more budget on copies and CPU wakeups than on useful data movement.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that zero-copy transfers responsibility to the application. A buffer named in a work request must stay valid until hardware reports completion.',
        'Capability safety is the other wall. A remote peer must not be able to write arbitrary process memory, so RDMA uses registered memory regions and keys to bound access.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RDMA verbs turn direct hardware movement into explicit ownership records. A memory region says which pages are pinned, a queue pair says which endpoint queues are active, a work request says what operation may run, and a completion says when ownership returns.',
        'The invariant is ownership until completion. Posting a work request promises that buffers, keys, queue capacity, and operation parameters remain valid until the completion queue reports the result.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application registers memory, which pins pages and returns local or remote keys. It creates a queue pair, moves it through required states, posts receives or sends, and rings a doorbell so the host channel adapter can fetch work.',
        'Work requests name buffers through scatter-gather entries and opcodes such as send, receive, RDMA read, RDMA write, or atomic. The adapter performs DMA and protocol work, then writes a completion queue entry that the application polls or waits for.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The safety argument is object visibility. The adapter can access only registered memory with valid permissions, the peer needs the right remote key, and a queue pair must be in the right state before work can execute.',
        'The application still owns lifetime correctness. If it deregisters memory too early, posts too few receives, leaks remote keys, or stops polling completions, the verbs objects cannot save the program from its own broken contract.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RDMA can reduce latency and CPU work, but setup is expensive. Memory registration pins pages and consumes adapter resources, queue pairs and completion queues have limits, and polling can burn a full CPU core to avoid interrupt latency.',
        'Queue depth controls behavior. If each peer keeps 1024 outstanding sends and there are 100 peers, the system may need to track 102,400 in-flight operations plus matching completions and receive buffers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RDMA fits high-performance storage, low-latency replication, disaggregated memory experiments, distributed training, embedding-table access, KV-cache transfer, and GPU-adjacent data paths. The common requirement is frequent data movement with carefully managed buffers.',
        'It is most useful when the application can pool memory, batch operations, keep queues full, and handle failure paths explicitly. Without that discipline, the hardware speed exposes software bugs faster.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RDMA is a poor fit for ordinary request-response services where application logic, serialization, database work, or product workflow dominates latency. TCP, HTTP, or a message broker may give better portability and failure isolation.',
        'It also fails operationally on poorly tuned fabrics. RoCE deployments can depend on congestion control, ECN, priority flow control, loss behavior, and switch configuration as much as on application code.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A storage client posts 64 receive buffers of 4 KB each and issues 32 RDMA reads of 4 KB. The data payload is only 128 KB, but the application must keep all 32 source buffers valid and poll for 32 completions before reusing them.',
        'If memory registration takes 20 microseconds and the read itself takes 4 microseconds, registering a fresh buffer per operation loses the point of RDMA. Reusing a registered pool amortizes that 20 microseconds across thousands of operations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA RDMA Aware Networks Programming User Manual and NVIDIA RDMA key concepts. These define memory regions, local keys, remote keys, queue pairs, work requests, completion queues, and state transitions.',
        'Study queues, ring buffers, io_uring submission and completion rings, NIC receive rings, backpressure, GPUDirect RDMA, RoCE congestion control, and KV-cache transfer fabrics next. RDMA is an API lesson and a systems operations lesson at the same time.',
      ],
    },
  ],
};
