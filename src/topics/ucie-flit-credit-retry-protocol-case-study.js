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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'UCIe turns a die-to-die wire budget into a layered contract for flits, credits, retries, sideband state, and observability.'},
        'Read the flit-pipeline view as a chain of responsibilities. Active nodes show where traffic currently changes form: packet, flit, adapted stream, raw interface, then physical lanes.',
        'Read the credit-retry view as a bounded queue system. A credit means the receiver has room for one more flit in a traffic class, and a retry buffer means the sender has kept enough history to replay after an error.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'UCIe, Universal Chiplet Interconnect Express, exists because modern packages often connect several dies instead of building one large monolithic chip. A package may combine compute, I/O, cache, memory-facing logic, and accelerators from different process nodes or vendors.',
        'A die-to-die link needs more than fast wires. It needs a shared contract for framing, flow control, retry, sideband bring-up, error reporting, and layer ownership so separately designed chiplets can behave like one system.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to rate the link by raw bandwidth and draw one arrow between chiplets. That sketch is useful for a floorplan, and it is not foolish because physical lane rate is a real limit.',
        'A second simple approach is to design a private package link for each product. That can work inside one company, but it makes reuse, multi-vendor integration, debug tooling, and validation harder every time the package changes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a receiver has finite buffers, traffic has classes, and package links can see bit errors, lane problems, reset events, and training failures. Raw bandwidth does not answer who may send, how much may be in flight, or what happens after corruption.',
        'A private link also creates a validation wall. If every chiplet pair invents its own framing, retries, and management states, each package has to rediscover the same corner cases under load, reset, and fault injection.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is bounded ownership. Protocol traffic, flit format, credit accounting, retry state, raw interface movement, physical lanes, and sideband management are separate responsibilities with explicit handoff points.',
        'A flit is the link-level unit of movement. A credit is permission to send one unit because the receiver has space. A retry buffer is a record of sent units that are not yet safe to forget.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Higher-level traffic such as PCIe or CXL packets is packed into flits at the flit die-to-die interface. The adapter can multiplex traffic classes, arbitrate among virtual channels, attach checks, and keep retry copies before the raw interface and physical lanes move bits.',
        'The receiver returns credits as buffers drain. The sender decrements credits when it injects flits and stops when the relevant credit count reaches zero. A cyclic redundancy check, or CRC, lets the receiver detect corrupted payload bits and trigger replay instead of accepting silent damage.',
        'Sideband state handles reset, discovery, configuration, lane training, and management before ordinary payload traffic is trusted. That is why the animation separates sideband from the main flit path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument starts with flow control. If the receiver advertises exactly the free slots it has, and the sender sends only while credits are positive, the sender cannot overrun that receiver buffer.',
        'Reliability follows from holding sent flits until acknowledgement. If the receiver reports a bad check or missing sequence, the sender can replay from the retry buffer. Persistent faults still fail the link, but transient faults do not silently become wrong data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The steady-state cost is latency, area, power, and validation for flit formatting, virtual-channel queues, credit counters, CRC logic, retry buffers, sideband state, and telemetry. None of that work is free, but it buys bounded behavior under congestion and error.',
        'Cost behaves like a queue. If a receiver has 16 data credits and the round trip for returned credits is 8 cycles, the sender can keep injecting only if completed work returns credits fast enough. Under fault bursts, capacity is spent on replay, so useful throughput falls even when lane rate is unchanged.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'UCIe-style links fit chiplet packages that mix compute dies, I/O dies, cache dies, memory controllers, accelerators, or HBM-facing logic. The reason is not fashion; separate dies can improve yield, reuse proven blocks, and place each function on a suitable process node.',
        'They also matter for ecosystem integration. A standard die-to-die boundary gives vendors and customers a common place to test interoperability, collect link telemetry, and reason about failures.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'UCIe is not automatic plug-and-play. Product teams still choose topology, package substrate, lane count, traffic classes, clocking, power states, error policy, and how link health is exposed to software.',
        'Common failures are credit starvation, retry storms, virtual-channel starvation, sideband bring-up bugs, weak observability, and physical margin loss. A subtle failure is blaming applications or kernels for symptoms that were really link-level stalls or replay loops.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a receiver advertises 8 credits for a data virtual channel. The sender transmits 5 flits, so the credit count falls to 3. If the receiver drains 4 slots and returns 4 credits, the sender can raise the count to 7 and continue without overrunning the buffer.',
        'Now add a fault. Flits 20 through 23 are in the retry buffer, and flit 22 fails CRC at the receiver. The receiver signals a retry from 22, so the sender replays 22 and 23 instead of inventing new traffic for those cycles. Correctness is preserved, but useful bandwidth drops during replay.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: UCIe Consortium at https://www.uciexpress.org/, UCIe white papers at https://www.uciexpress.org/general-8, and the Hot Chips UCIe protocol tutorial at https://hc2023.hotchips.org/assets/program/tutorials/ucie/UCIe%20Protocol.pdf.',
        'Study Chiplet Interconnect Case Study, Chiplet Link Budget and Repair Lane Case Study, Backpressure and Flow Control, Queue, Retries, CXL Memory Pooling, HBM Pseudo-Channel and Bank Scheduler Case Study, and NVLink/NVSwitch GPU Fabric Case Study next.',
      ],
    },
  ],
};