// UCIe protocol internals: flits, credits, retry buffers, CRC, adapters, and
// sideband bring-up as a small lossless link-state machine.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ucie-flit-credit-retry-protocol-case-study',
  title: 'UCIe Flit, Credit & Retry Protocol Case Study',
  category: 'Systems',
  summary: 'A UCIe protocol primer: protocol layer packets become flits, credits throttle injection, retry buffers protect reliability, and sideband state brings the die-to-die link up.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['flit pipeline', 'credit retry'], defaultValue: 'flit pipeline' },
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

function flitGraph(title, { fault = false } = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'agent', x: 0.7, y: 3.4, note: 'traffic' },
      { id: 'proto', label: 'proto', x: 2.0, y: 3.4, note: 'CXL/PCIe' },
      { id: 'fdi', label: 'FDI', x: 3.3, y: 3.4, note: 'flits' },
      { id: 'adapt', label: 'adapt', x: 4.8, y: 3.4, note: fault ? 'retry' : 'mux' },
      { id: 'rdi', label: 'RDI', x: 6.2, y: 3.4, note: 'raw' },
      { id: 'phy', label: 'PHY', x: 7.6, y: 3.4, note: 'lanes' },
      { id: 'die', label: 'die B', x: 9.0, y: 3.4, note: 'peer' },
      { id: 'sb', label: 'side', x: 4.8, y: 1.1, note: 'bring-up' },
      { id: 'crc', label: 'CRC', x: 4.8, y: 5.8, note: fault ? 'bad' : 'ok' },
    ],
    edges: [
      { id: 'e-app-proto', from: 'app', to: 'proto' },
      { id: 'e-proto-fdi', from: 'proto', to: 'fdi', weight: 'pkt' },
      { id: 'e-fdi-adapt', from: 'fdi', to: 'adapt', weight: 'flit' },
      { id: 'e-adapt-rdi', from: 'adapt', to: 'rdi', weight: fault ? 'hold' : 'send' },
      { id: 'e-rdi-phy', from: 'rdi', to: 'phy', weight: 'bits' },
      { id: 'e-phy-die', from: 'phy', to: 'die', weight: 'D2D' },
      { id: 'e-sb-adapt', from: 'sb', to: 'adapt', weight: 'state' },
      { id: 'e-adapt-crc', from: 'adapt', to: 'crc', weight: 'check' },
      { id: 'e-crc-rdi', from: 'crc', to: 'rdi', weight: fault ? 'NACK' : 'ACK' },
    ],
  }, { title });
}

function creditGraph(title) {
  return graphState({
    nodes: [
      { id: 'src', label: 'src', x: 0.9, y: 3.5, note: 'inject' },
      { id: 'vc0', label: 'VC0', x: 2.3, y: 2.0, note: 'ctrl' },
      { id: 'vc1', label: 'VC1', x: 2.3, y: 5.0, note: 'data' },
      { id: 'arb', label: 'arb', x: 4.0, y: 3.5, note: 'select' },
      { id: 'ret', label: 'retry', x: 5.6, y: 5.4, note: 'buf' },
      { id: 'wire', label: 'wire', x: 6.2, y: 3.5, note: 'lanes' },
      { id: 'sink', label: 'sink', x: 7.9, y: 3.5, note: 'drain' },
      { id: 'cred', label: 'cred', x: 5.6, y: 1.4, note: 'grant' },
      { id: 'ctl', label: 'ctl', x: 9.1, y: 3.5, note: 'policy' },
    ],
    edges: [
      { id: 'e-src-vc0', from: 'src', to: 'vc0' },
      { id: 'e-src-vc1', from: 'src', to: 'vc1' },
      { id: 'e-vc0-arb', from: 'vc0', to: 'arb' },
      { id: 'e-vc1-arb', from: 'vc1', to: 'arb' },
      { id: 'e-arb-wire', from: 'arb', to: 'wire', weight: 'flit' },
      { id: 'e-arb-ret', from: 'arb', to: 'ret', weight: 'copy' },
      { id: 'e-wire-sink', from: 'wire', to: 'sink', weight: 'send' },
      { id: 'e-sink-cred', from: 'sink', to: 'cred', weight: 'free' },
      { id: 'e-cred-arb', from: 'cred', to: 'arb', weight: 'credit' },
      { id: 'e-sink-ctl', from: 'sink', to: 'ctl', weight: 'ACK' },
      { id: 'e-ctl-ret', from: 'ctl', to: 'ret', weight: 'NACK' },
    ],
  }, { title });
}

function* flitPipeline() {
  yield {
    state: flitGraph('Packets become flits before the die-to-die hop'),
    highlight: { active: ['app', 'proto', 'fdi', 'adapt', 'e-app-proto', 'e-proto-fdi', 'e-fdi-adapt'], compare: ['phy'] },
    explanation: 'A UCIe-style link is layered. Higher-level traffic such as CXL or PCIe packets is packed into flits, handed across the flit die-to-die interface, and adapted before the physical lanes transmit bits.',
  };

  yield {
    state: labelMatrix(
      'Protocol stack duties',
      [
        { id: 'proto', label: 'proto' },
        { id: 'fdi', label: 'FDI' },
        { id: 'adapt', label: 'adapt' },
        { id: 'rdi', label: 'RDI' },
        { id: 'phy', label: 'PHY' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pkt', 'ordering'],
        ['flit', 'format'],
        ['mux', 'retry'],
        ['raw', 'train'],
        ['lanes', 'SI'],
      ],
    ),
    highlight: { active: ['proto:owns', 'fdi:owns', 'adapt:owns'], found: ['phy:risk'] },
    explanation: 'The useful data structure is a responsibility table. Protocol, adapter, raw interface, and PHY each own different invariants, so debugging must know which layer is allowed to retry, reorder, train, or fail.',
    invariant: 'A fast link without a layer contract is only a fast mystery.',
  };

  yield {
    state: flitGraph('Sideband state brings the link up before payloads'),
    highlight: { active: ['sb', 'adapt', 'rdi', 'phy', 'e-sb-adapt', 'e-adapt-rdi', 'e-rdi-phy'], compare: ['app', 'proto'] },
    explanation: 'The sideband path handles discovery, reset, configuration, and training state before ordinary payload traffic is trusted. That path is the control-plane graph for a physical interconnect.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'load', min: 0, max: 100 }, y: { label: 'util', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw', points: [{ x: 10, y: 12 }, { x: 40, y: 46 }, { x: 70, y: 73 }, { x: 95, y: 84 }] },
        { id: 'flit', label: 'flit', points: [{ x: 10, y: 10 }, { x: 40, y: 42 }, { x: 70, y: 70 }, { x: 95, y: 91 }] },
        { id: 'fault', label: 'retry', points: [{ x: 10, y: 9 }, { x: 40, y: 38 }, { x: 70, y: 57 }, { x: 95, y: 61 }] },
      ],
      markers: [
        { id: 'knee', x: 82, y: 84, label: 'credit knee' },
      ],
    }),
    highlight: { active: ['flit', 'knee'], compare: ['raw', 'fault'] },
    explanation: 'Flit framing lets the adapter arbitrate and manage reliability, but utilization still depends on credit return, retry rate, lane health, and payload mix. A protocol gain can vanish if the credit loop is starved.',
  };
}

function* creditRetry() {
  yield {
    state: creditGraph('Credits turn receiver space into send permission'),
    highlight: { active: ['src', 'vc0', 'vc1', 'arb', 'cred', 'e-cred-arb'], compare: ['wire'] },
    explanation: 'Credit-based flow control is backpressure at link speed. The sender can inject a flit only when the receiver has advertised buffer space for that class of traffic.',
  };

  yield {
    state: creditGraph('Virtual channels isolate traffic classes'),
    highlight: { active: ['vc0', 'vc1', 'arb', 'e-vc0-arb', 'e-vc1-arb'], found: ['cred'], compare: ['ret'] },
    explanation: 'A link may carry control, data, coherency, and management traffic. Virtual channels prevent one heavy stream from blocking all progress, provided credits and arbitration are budgeted correctly.',
    invariant: 'Credits are the link-local version of bounded queues.',
  };

  yield {
    state: creditGraph('Retry buffers make errors recoverable'),
    highlight: { active: ['ret', 'wire', 'sink', 'ctl', 'e-arb-ret', 'e-wire-sink', 'e-ctl-ret'], compare: ['cred'] },
    explanation: 'When reliability is handled by the adapter, sent flits remain in a retry buffer until the receiver acknowledges them. A bad CRC or lost flit becomes a replay event instead of silent corruption.',
  };

  yield {
    state: labelMatrix(
      'Link observability ledger',
      [
        { id: 'cred', label: 'crd' },
        { id: 'ret', label: 'retry' },
        { id: 'crc', label: 'CRC' },
        { id: 'vc', label: 'VC' },
        { id: 'lane', label: 'lane' },
      ],
      [
        { id: 'track', label: 'track' },
        { id: 'alarm', label: 'alarm' },
      ],
      [
        ['free', 'stall'],
        ['depth', 'loop'],
        ['err', 'BER'],
        ['grant', 'starve'],
        ['deskew', 'drop'],
      ],
    ),
    highlight: { active: ['cred:track', 'ret:track', 'crc:track'], found: ['vc:alarm', 'lane:alarm'] },
    explanation: 'The production lesson is observability. A protocol trace should expose credit starvation, retry depth, CRC errors, virtual-channel starvation, and lane deskew failures before the system misdiagnoses them as a model or kernel problem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'flit pipeline') yield* flitPipeline();
  else if (view === 'credit retry') yield* creditRetry();
  else throw new InputError('Pick a UCIe protocol view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'UCIe is easiest to understand as a layered protocol stack for chiplets inside a package. The physical layer moves bits across die-to-die lanes. The adapter and flit interfaces turn higher-level traffic into bounded, schedulable transfers. The protocol layer carries PCIe, CXL, streaming, or other traffic above that local link.',
        'The UCIe Consortium describes Universal Chiplet Interconnect Express as an open die-to-die interconnect specification for an open chiplet ecosystem: https://www.uciexpress.org/. Its public white paper page frames the goal as building reusable chiplet interconnects rather than one-off proprietary package links: https://www.uciexpress.org/general-8.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Traffic begins as protocol packets or streams. The protocol layer hands data through FDI, the flit die-to-die interface. A die-to-die adapter can arbitrate, multiplex, format, and optionally handle retry and CRC responsibilities before traffic crosses RDI into the raw physical interface. A sideband path handles bring-up, reset, configuration, training, and management state.',
        'The Hot Chips UCIe protocol tutorial is useful because it makes the adapter boundary concrete: flit formats, retry, CRC, and packing responsibilities depend on the mode being carried: https://hc2023.hotchips.org/assets/program/tutorials/ucie/UCIe%20Protocol.pdf. The educational trick is to draw the link as a pipeline with ownership boundaries, not as one arrow between chiplets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A link protocol buys composability but adds queues, credits, arbitration, retry buffers, sideband state, and compliance work. Those are not optional details. Without bounded buffers and credit return, a fast link can overrun the receiver. Without retry and CRC policy, physical errors become data-integrity bugs. Without health counters, every transient link problem looks like random workload noise.',
        'This is why UCIe belongs next to Backpressure & Flow Control, Queue, and Retries, Backoff & Jitter in the learning graph. The same ideas show up at nanosecond scale: a receiver advertises capacity, the sender injects only within budget, and failed transfers consume retry budget until the system proves forward progress.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'UCIe-style links matter when a product wants to mix compute dies, I/O chiplets, cache chiplets, HBM-facing logic, or accelerators from different process nodes or vendors. The standard does not make chiplets plug-and-play by itself, but it gives integration teams a shared contract for the die-to-die boundary.',
        'The local chiplet source corpus emphasized that HBM and accelerator packages are increasingly constrained by interconnect density, power, and packaging supply. Protocol standardization helps the ecosystem, but the shipped package still needs physical margins, link training, test, and repair logic. That is why this module should be studied after Chiplet Link Budget & Repair Lane Case Study.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that UCIe is only a physical wire spec. The protocol and adapter boundaries matter because they decide framing, flow control, retry, and observability. The second misconception is that a standard removes system design. It does not. Teams still choose topology, package substrate, lane count, traffic classes, health policy, and how much protocol complexity to expose to software.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: UCIe Consortium at https://www.uciexpress.org/, UCIe white papers at https://www.uciexpress.org/general-8, and the UCIe protocol tutorial at https://hc2023.hotchips.org/assets/program/tutorials/ucie/UCIe%20Protocol.pdf. Study Chiplet Interconnect Case Study, Chiplet Link Budget & Repair Lane Case Study, Backpressure & Flow Control, Queue, Retries, and CXL Memory Pooling next.',
      ],
    },
  ],
};
