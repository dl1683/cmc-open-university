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
      heading: 'What it is',
      paragraphs: [
        'RDMA stands for Remote Direct Memory Access. It lets one machine access memory associated with another machine without involving the remote operating system and CPU on the data path. The programming model is built around registered memory, queue pairs, work requests, and completion queues.',
        'NVIDIA documents RDMA as direct memory access from one host to another without remote OS and CPU involvement, reducing latency, CPU load, and copy overhead compared with TCP/IP-style paths: https://networking-docs.nvidia.com/rdmaawareprogramming.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application registers memory so the HCA can DMA to or from it safely. Registration pins pages, records address translation, and assigns access permissions. Then the application creates queue pairs. A queue pair has a send queue and a receive queue. The app posts work requests into those queues, and the network adapter executes them. Completion queue entries report the outcome.',
        'NVIDIA key concepts describe Completion Queues as FIFOs of completion entries for ended work requests, and Memory Registration as the process of pinning memory, checking permissions, writing virtual-to-physical mappings to the adapter, and assigning local and remote keys: https://docs.nvidia.com/networking/display/RDMAAwareProgrammingv17/Key+Concepts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RDMA moves overhead out of the kernel data path and into setup discipline. That can be a very good trade for high-throughput storage, training, inference, and database systems. But it means mistakes can be sharp. A stale rkey, freed memory region, missing receive, undrained completion queue, or mismatched queue-pair state can produce hangs, retries, access errors, or data corruption.',
        'The application must manage backpressure explicitly. Queue depths are finite. Completion queues must be drained. Receive buffers must be posted before the sender expects them. Memory lifetimes must extend through all outstanding work requests. In other words, RDMA gives a faster path by making ownership visible and strict.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RDMA appears in high-performance storage, databases, distributed training, parameter exchange, KV-cache movement, and GPU-adjacent systems. It is the transport idea behind many low-latency fabrics because it cuts CPU copies and lets adapters move bytes directly between registered buffers.',
        'In AI infrastructure, RDMA matters because GPU clusters are often bottlenecked by moving activations, gradients, expert tokens, or KV-cache blocks. GPU All-Reduce, KV Cache Transfer Fabric Case Study, and GPUDirect RDMA Peer Memory Case Study all build on this queue-and-completion model.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A common misconception is that RDMA means no CPU work at all. The CPU still sets up memory registrations, queue pairs, routing, permissions, polling loops, and error handling. The point is that the repetitive data movement can bypass the remote CPU and avoid ordinary copy-heavy network paths.',
        'Another misconception is that RDMA removes flow control. It does not. It shifts flow control into posted receives, send queue depth, completion queue draining, retry policy, congestion control, and buffer ownership. If those are wrong, the faster data plane just fails faster.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA RDMA Aware Networks Programming User Manual at https://networking-docs.nvidia.com/rdmaawareprogramming and NVIDIA RDMA key concepts at https://docs.nvidia.com/networking/display/RDMAAwareProgrammingv17/Key+Concepts. Study Queue, Ring Buffer, io_uring Submission/Completion Rings, NIC RX Ring & NAPI Poll, Backpressure & Flow Control, GPUDirect RDMA Peer Memory Case Study, and KV Cache Transfer Fabric Case Study next.',
      ],
    },
  ],
};
