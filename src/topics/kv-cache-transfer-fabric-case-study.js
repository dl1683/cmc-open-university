// KV-cache transfer fabric: the data structures that move prompt state from
// prefill workers to decode workers without turning P/D disaggregation into a
// tail-latency trap.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kv-cache-transfer-fabric-case-study',
  title: 'KV Cache Transfer Fabric Case Study',
  category: 'Systems',
  summary: 'How disaggregated LLM servers move KV-cache blocks: block IDs, producer/consumer roles, async connectors, RDMA read/write modes, cleanup, and congestion gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['block handoff', 'async connector', 'tail gate'], defaultValue: 'block handoff' },
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

function handoffGraph(title, { mode = 'read' } = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'user', x: 0.5, y: 3.7, note: 'req' },
      { id: 'proxy', label: 'proxy', x: 2.0, y: 3.7, note: 'route' },
      { id: 'prefill', label: 'pre', x: 3.7, y: 2.2, note: 'make KV' },
      { id: 'map', label: 'map', x: 5.0, y: 2.2, note: 'ids' },
      { id: 'link', label: 'link', x: 5.0, y: 4.7, note: mode === 'write' ? 'RDMA wr' : 'RDMA rd' },
      { id: 'decode', label: 'dec', x: 7.0, y: 3.3, note: 'use KV' },
      { id: 'wait', label: 'wait', x: 7.0, y: 5.6, note: 'park' },
      { id: 'stream', label: 'out', x: 9.1, y: 3.3, note: 'tokens' },
      { id: 'free', label: 'free', x: 9.1, y: 5.6, note: 'cleanup' },
    ],
    edges: [
      { id: 'e-client-proxy', from: 'client', to: 'proxy', weight: '' },
      { id: 'e-proxy-prefill', from: 'proxy', to: 'prefill', weight: '' },
      { id: 'e-proxy-decode', from: 'proxy', to: 'decode', weight: '' },
      { id: 'e-prefill-map', from: 'prefill', to: 'map', weight: 'KV' },
      { id: 'e-map-link', from: 'map', to: 'link', weight: '' },
      { id: 'e-link-decode', from: 'link', to: 'decode', weight: 'KV' },
      { id: 'e-decode-wait', from: 'decode', to: 'wait', weight: 'hold' },
      { id: 'e-wait-decode', from: 'wait', to: 'decode', weight: 'ok' },
      { id: 'e-decode-stream', from: 'decode', to: 'stream', weight: '' },
      { id: 'e-decode-free', from: 'decode', to: 'free', weight: '' },
      { id: 'e-free-prefill', from: 'free', to: 'prefill', weight: '' },
    ],
  }, { title });
}

function connectorGraph(title) {
  return graphState({
    nodes: [
      { id: 'sched', label: 'sched', x: 0.6, y: 3.5, note: 'plan' },
      { id: 'workq', label: 'q', x: 2.1, y: 3.5, note: 'ops' },
      { id: 'attn', label: 'attn', x: 3.4, y: 2.0, note: 'layer' },
      { id: 'prod', label: 'prod', x: 4.9, y: 2.0, note: 'save' },
      { id: 'pipe', label: 'pipe', x: 6.1, y: 3.5, note: 'FIFO' },
      { id: 'cons', label: 'recv', x: 7.2, y: 5.0, note: 'load' },
      { id: 'inject', label: 'inj', x: 8.7, y: 5.0, note: 'blocks' },
      { id: 'ready', label: 'go', x: 9.5, y: 3.5, note: 'decode' },
      { id: 'gc', label: 'gc', x: 7.2, y: 2.0, note: 'idle buf' },
    ],
    edges: [
      { id: 'e-sched-workq', from: 'sched', to: 'workq', weight: '' },
      { id: 'e-workq-prod', from: 'workq', to: 'prod', weight: '' },
      { id: 'e-attn-prod', from: 'attn', to: 'prod', weight: 'KV' },
      { id: 'e-prod-pipe', from: 'prod', to: 'pipe', weight: 'send' },
      { id: 'e-pipe-cons', from: 'pipe', to: 'cons', weight: 'recv' },
      { id: 'e-cons-inject', from: 'cons', to: 'inject', weight: '' },
      { id: 'e-inject-ready', from: 'inject', to: 'ready', weight: 'ok' },
      { id: 'e-cons-gc', from: 'cons', to: 'gc', weight: '' },
      { id: 'e-gc-workq', from: 'gc', to: 'workq', weight: '' },
    ],
  }, { title });
}

function topologyGraph(title) {
  return graphState({
    nodes: [
      { id: 'router', label: 'router', x: 0.8, y: 3.5, note: 'SLO' },
      { id: 'rackA', label: 'rA', x: 2.2, y: 2.0, note: 'near' },
      { id: 'rackB', label: 'rB', x: 2.2, y: 5.0, note: 'far' },
      { id: 'preA', label: 'pA', x: 4.0, y: 2.0, note: 'hit' },
      { id: 'decA', label: 'dA', x: 5.8, y: 2.0, note: 'HBM' },
      { id: 'preB', label: 'pB', x: 4.0, y: 5.0, note: 'busy' },
      { id: 'decB', label: 'dB', x: 5.8, y: 5.0, note: 'open' },
      { id: 'trace', label: 'trace', x: 8.0, y: 3.5, note: 'p99' },
      { id: 'shed', label: 'shed', x: 9.1, y: 5.0, note: 'deny' },
    ],
    edges: [
      { id: 'e-router-rackA', from: 'router', to: 'rackA', weight: '' },
      { id: 'e-router-rackB', from: 'router', to: 'rackB', weight: '' },
      { id: 'e-rackA-preA', from: 'rackA', to: 'preA', weight: '' },
      { id: 'e-preA-decA', from: 'preA', to: 'decA', weight: 'KV' },
      { id: 'e-rackB-preB', from: 'rackB', to: 'preB', weight: '' },
      { id: 'e-preB-decB', from: 'preB', to: 'decB', weight: 'KV' },
      { id: 'e-decA-trace', from: 'decA', to: 'trace', weight: 'lat' },
      { id: 'e-decB-trace', from: 'decB', to: 'trace', weight: 'lat' },
      { id: 'e-trace-shed', from: 'trace', to: 'shed', weight: 'over' },
    ],
  }, { title });
}

function transferPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'payload GB', min: 0, max: 8 }, y: { label: 'p95 ms', min: 0, max: 900 } },
    series: [
      { id: 'single', label: '1 stream', points: [{ x: 1, y: 130 }, { x: 2, y: 250 }, { x: 4, y: 520 }, { x: 6, y: 780 }] },
      { id: 'split', label: 'split', points: [{ x: 1, y: 95 }, { x: 2, y: 180 }, { x: 4, y: 360 }, { x: 6, y: 560 }] },
      { id: 'busy', label: 'busy net', points: [{ x: 1, y: 170 }, { x: 2, y: 330 }, { x: 4, y: 640 }, { x: 6, y: 890 }] },
    ],
    markers,
  });
}

function* blockHandoff() {
  yield {
    state: handoffGraph('KV handoff is a request-state transfer'),
    highlight: { active: ['client', 'proxy', 'prefill', 'decode', 'e-client-proxy', 'e-proxy-prefill', 'e-proxy-decode'], compare: ['wait'] },
    explanation: 'A disaggregated server starts as a routing problem: send prompt work to prefill, start or prepare decode, and attach enough metadata for the decode side to find the produced KV state.',
  };

  yield {
    state: handoffGraph('The block map is the contract'),
    highlight: { active: ['prefill', 'map', 'link', 'e-prefill-map', 'e-map-link'], found: ['decode'], compare: ['proxy'] },
    explanation: 'The handoff is not just a tensor copy. The producer must publish which engine owns the state, which layer/block ranges exist, how they map to token positions, and when the consumer may read them.',
    invariant: 'A decode worker cannot safely run until its prompt KV blocks are complete or streamable by policy.',
  };

  yield {
    state: labelMatrix(
      'Read mode versus write mode',
      [
        { id: 'read', label: 'read' },
        { id: 'write', label: 'write' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'local', label: 'local' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'proxy', label: 'proxy' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pull', 'ids', 'serial'],
        ['push', 'early', 'addr'],
        ['policy', 'both', 'bugs'],
        ['none', 'short', 'simple'],
      ],
    ),
    highlight: { active: ['read:move', 'write:move'], compare: ['read:risk', 'write:risk'], found: ['local:risk'] },
    explanation: 'In read mode the decode side pulls remote blocks after prefill publishes IDs. In write mode prefill can push blocks into decode-owned memory as layers finish. Read is simpler to reason about; write can overlap more work but needs stronger address and completion discipline.',
  };

  yield {
    state: labelMatrix(
      'Block-map fields',
      [
        { id: 'req', label: 'req' },
        { id: 'engine', label: 'engine' },
        { id: 'blocks', label: 'blocks' },
        { id: 'layers', label: 'layers' },
        { id: 'epoch', label: 'epoch' },
        { id: 'free', label: 'free' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['id', 'join'],
        ['addr', 'owner'],
        ['ranges', 'copy'],
        ['mask', 'done'],
        ['ver', 'stale'],
        ['ack', 'leak'],
      ],
    ),
    highlight: { active: ['engine:field', 'blocks:field', 'layers:field'], found: ['epoch:why', 'free:why'] },
    explanation: 'The useful data structure is a tiny ownership ledger. It records request identity, remote owner, block ranges, per-layer readiness, version or epoch, and the cleanup acknowledgement that lets prefill free memory.',
  };

  yield {
    state: handoffGraph('Cleanup is part of correctness', { mode: 'write' }),
    highlight: { active: ['decode', 'stream', 'free', 'e-decode-stream', 'e-decode-free', 'e-free-prefill'], removed: ['wait'], found: ['prefill'] },
    explanation: 'After decode starts streaming, the transfer is still not done operationally. The system must release temporary buffers, notify the producer when remote blocks are no longer needed, and avoid leaking HBM after cancellations.',
  };
}

function* asyncConnector() {
  yield {
    state: connectorGraph('Connectors turn KV movement into queued ops'),
    highlight: { active: ['sched', 'workq', 'prod', 'pipe', 'cons', 'inject', 'e-sched-workq', 'e-prod-pipe', 'e-pipe-cons'], found: ['ready'] },
    explanation: 'Production implementations separate scheduling from data movement. A scheduler connector plans transfers, worker connectors save and load blocks, and the model loop can keep running while IO proceeds on separate threads or streams.',
  };

  yield {
    state: labelMatrix(
      'Connector roles',
      [
        { id: 'sched', label: 'sched' },
        { id: 'prod', label: 'prod' },
        { id: 'pipe', label: 'pipe' },
        { id: 'cons', label: 'cons' },
        { id: 'buf', label: 'buf' },
        { id: 'gc', label: 'gc' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['plan', 'lost op'],
        ['save', 'block main'],
        ['send', 'head line'],
        ['load', 'wrong blk'],
        ['stage', 'OOM'],
        ['drop', 'leak'],
      ],
    ),
    highlight: { active: ['sched:job', 'prod:job', 'cons:job'], compare: ['pipe:bad', 'buf:bad'], found: ['gc:job'] },
    explanation: 'The connector API is a control plane for tensors. It needs non-blocking insert paths, blocking or parked lookup paths, FIFO transfer channels, staging buffers, and a garbage collector for aborted requests.',
  };

  yield {
    state: connectorGraph('Layer-by-layer transfer overlaps compute and IO'),
    highlight: { active: ['attn', 'prod', 'pipe', 'cons', 'inject', 'e-attn-prod', 'e-prod-pipe', 'e-pipe-cons', 'e-cons-inject'], compare: ['sched'], found: ['ready'] },
    explanation: 'A useful fabric does not wait for the whole prompt to become one giant blob. It can save layer outputs, slice blocks, stream them through multiple channels, and inject them into preallocated decode blocks as they arrive.',
    invariant: 'Transfer granularity is a latency knob: too small adds overhead, too large delays readiness.',
  };

  yield {
    state: labelMatrix(
      'Request states',
      [
        { id: 'new', label: 'new' },
        { id: 'fill', label: 'fill' },
        { id: 'send', label: 'send' },
        { id: 'recv', label: 'recv' },
        { id: 'inj', label: 'inject' },
        { id: 'ready', label: 'ready' },
        { id: 'abort', label: 'abort' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'next', label: 'next' },
      ],
      [
        ['route', 'prefill'],
        ['KV made', 'send'],
        ['in pipe', 'recv'],
        ['staged', 'inject'],
        ['local', 'ready'],
        ['decode', 'stream'],
        ['cancel', 'gc'],
      ],
    ),
    highlight: { active: ['send:state', 'recv:state', 'inj:state'], found: ['ready:next'], removed: ['abort:next'] },
    explanation: 'The scheduler needs an explicit state machine. Requests can be new, filling, sending, receiving, injecting, ready, or aborted. Hiding those states as booleans makes p99 debugging much harder.',
  };

  yield {
    state: connectorGraph('Abort paths must clean staged buffers'),
    highlight: { active: ['cons', 'gc', 'workq', 'e-cons-gc', 'e-gc-workq'], removed: ['ready'], compare: ['pipe'] },
    explanation: 'Cancelled users, failed transfers, preempted decode requests, and partial receives are normal events. The fabric must clean staged CPU/GPU buffers and remove parked scheduler work, otherwise one incident becomes a later OOM.',
  };
}

function* tailGate() {
  yield {
    state: transferPlot([
      { id: 'slo', x: 4, y: 420, label: '4G SLO' },
      { id: 'bad', x: 4, y: 640, label: 'p99 risk' },
    ]),
    highlight: { active: ['single', 'busy', 'bad'], found: ['split', 'slo'] },
    explanation: 'A KV transfer fabric has a bandwidth curve. Large prompts create multi-gigabyte state movement, and network congestion can turn a good average into a bad tail.',
  };

  yield {
    state: labelMatrix(
      'Tail gate ledger',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'nic', label: 'NIC' },
        { id: 'flow', label: 'flows' },
        { id: 'hit', label: 'hit' },
        { id: 'slo', label: 'SLO' },
        { id: 'shed', label: 'shed' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'act', label: 'act' },
      ],
      [
        ['KV GB', 'chunk'],
        ['queue', 'reroute'],
        ['count', 'split'],
        ['prefix', 'sticky'],
        ['TTFT', 'gate'],
        ['risk', 'deny'],
      ],
    ),
    highlight: { active: ['bytes:measure', 'nic:measure', 'slo:measure'], found: ['flow:act', 'hit:act'], removed: ['shed:act'] },
    explanation: 'The serving gate should track transfer bytes, NIC queueing, flow count, prefix-cache locality, TTFT/ITL SLO, and rejection risk. This is the evidence needed before routing a long prompt across a busy link.',
  };

  yield {
    state: topologyGraph('Topology-aware routing protects the tail'),
    highlight: { active: ['router', 'rackA', 'preA', 'decA', 'e-router-rackA', 'e-rackA-preA', 'e-preA-decA'], compare: ['rackB', 'preB', 'decB'], found: ['trace'] },
    explanation: 'The closest open decode slot is not always the best target. A router needs cache locality, rack locality, transfer backlog, and decode capacity together, because the KV path can dominate the user-visible first-token wait.',
    invariant: 'Route the request, the KV state, and the SLO together.',
  };

  yield {
    state: labelMatrix(
      'Long-chat case',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'reuse', label: 'reuse' },
        { id: 'route', label: 'route' },
        { id: 'xfer', label: 'xfer' },
        { id: 'decode', label: 'decode' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['64k toks', 'prefill'],
        ['sys prompt', 'sticky'],
        ['same rack', 'near'],
        ['4G KV', 'split'],
        ['HBM ok', 'start'],
        ['p99 up', 'cap'],
      ],
    ),
    highlight: { active: ['prompt:fact', 'xfer:fact', 'route:choice'], found: ['reuse:choice', 'decode:choice'], compare: ['audit:choice'] },
    explanation: 'A long-context chatbot request is decided by state placement. Stable system prompts want sticky prefill routing, large KV payloads want near decode targets and split transfer, and rising p99 should cap or reject work before the cluster wastes prefill compute.',
  };

  yield {
    state: transferPlot([
      { id: 'cap', x: 6, y: 560, label: 'cap' },
      { id: 'deny', x: 6, y: 890, label: 'deny' },
    ]),
    highlight: { active: ['split', 'cap'], removed: ['busy', 'deny'], compare: ['single'] },
    explanation: 'The repair pattern is not just faster networking. Split flows, improve locality, cap oversized transfers, shed work that cannot meet SLO, and keep traces that separate prefill time, transfer time, injection time, and decode time.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'block handoff') yield* blockHandoff();
  else if (view === 'async connector') yield* asyncConnector();
  else if (view === 'tail gate') yield* tailGate();
  else throw new InputError('Pick a KV transfer fabric view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The fabric view shows prefill and decode as separate workers. Prefill is the phase that reads the prompt and produces KV blocks; decode is the phase that generates new tokens by reading those blocks. Active transfer nodes mean the request is not ready for decode until the required blocks arrive and are injected.',
        'The async-connector view shows ownership, not just bytes. A block can be produced, queued, sent, received, injected, ready, streamed, completed, or aborted. The safe inference is that decode may sample only after the ledger proves identity, readiness, and live ownership for the needed block range.',
        {type: 'callout', text: 'The fabric is a distributed ownership ledger for live KV blocks, not a copy path, so readiness, locality, and cleanup become part of serving correctness.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Infinibandport.jpg', alt: 'Close-up of six InfiniBand switch ports on a network module.', caption: 'InfiniBand switch ports by Wikimedia Commons user Omukosan-shibo, CC BY 2.5.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Prefill/decode disaggregation separates two phases with different hardware behavior. Prefill does heavy parallel work over a long prompt. Decode does small repeated steps and is sensitive to inter-token latency.',
        'Splitting the phases creates a new correctness problem. The KV state made by prefill must reach decode before the first generated token. If it is late, time to first token rises; if it is stale or incomplete, decode attends to the wrong prompt state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is to run prefill on one pool, run decode on another pool, and copy tensors when prefill finishes. That is attractive because it maps to a simple pipeline: prompt in, KV out, copy, decode. Small prototypes can use direct RPC or shared storage.',
        'This approach is reasonable because average bandwidth may look high enough. A 100 Gbps link can move about 12.5 GB/s before overhead, so a 1.25 GB payload appears to need only 100 ms. The problem is that p99 latency, queueing, memory ownership, and cancellation are not averages.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is live state identity under tail latency. Decode needs to know which request epoch, model version, token range, layer range, and block ids the received tensors belong to. A boolean named kv_ready cannot safely encode that lifecycle.',
        'The second wall is cleanup. KV blocks pass through producer HBM, CPU staging, network buffers, consumer staging, decode block tables, and abort paths. A cancelled request can leak scarce HBM unless every owner has a release rule.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A transfer fabric is a versioned ownership ledger for KV blocks. Each row binds request id, producer, consumer, token range, layer range, block ids, transfer mode, readiness mask, epoch, destination allocation, and cleanup acknowledgement. Decode trusts the ledger, not a loose copy completion event.',
        'This converts the problem from moving tensors to preserving an invariant. Every block has a known current owner, a version that rejects stale metadata, a readiness state, and a cleanup path. Locality-aware routing then becomes part of correctness and latency, not an optional optimization.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A scheduler assigns prefill and decode roles. The prefill worker computes prompt KV blocks and publishes metadata. A connector either lets decode pull the blocks by id or pushes them into agreed decode-side addresses while prefill is still running.',
        'Read mode is easier to audit because decode decides what to fetch. Write mode can overlap transfer with prefill, but it needs stronger address exchange and completion tracking. Both modes must park decode until the required readiness mask is satisfied.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on a readiness invariant: decode cannot sample from a layer or token range until the corresponding KV block is present in the decode layout for the current request epoch. Versioned metadata prevents a stale block id from being reused after cancellation, retry, or worker restart.',
        'The cleanup invariant is equally important. When a request completes or aborts, the fabric must release producer blocks, transfer buffers, and consumer allocations. Otherwise the current output may be correct while the next request fails from leaked memory or stale ownership.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is bytes moved before first token. KV payload grows with prompt length, layers, key-value heads, head dimension, and bytes per value. Doubling prompt length roughly doubles the handoff payload and the transfer time.',
        'For the 70B example with about 1.34 GiB of KV for a 4,096-token prompt, a clean 100 Gbps path needs at least about 107 ms just for payload bytes. Real systems add queueing, serialization, CPU staging, GPU injection, and synchronization. Cost as behavior means disaggregation can improve inter-token latency while increasing first-token sensitivity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The fabric fits serving stacks with long prompts and strict decode latency, such as chat, coding agents, and RAG systems. Prefill workers can specialize in prompt throughput while decode workers protect steady token streaming. The separation is useful only if the transfer path stays inside the first-token budget.',
        'It also enables topology-aware scheduling. A router can choose a decode worker near the prefill worker, near cached prefix state, or on a less congested network path. Capacity-only routing can create cross-rack transfers that dominate p99.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when prompts are short or the network is weak. Colocated serving with chunked prefill may be simpler and faster because it avoids the handoff boundary. Disaggregation is not a free throughput win.',
        'It also fails with vague telemetry. Aggregate tokens per second cannot show whether first-token delay came from prefill, transfer, injection, parked waiting, or cleanup. The fabric needs per-request state, bytes, queue time, readiness time, and cleanup lag.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A request has a 16,384-token prompt. Using the same 70B KV shape, the payload is about 5.36 GiB. On a 200 Gbps link, the raw payload floor is about 214 ms; on 100 Gbps it is about 429 ms. If prefill takes 700 ms, the transfer is a first-token component, not noise.',
        'Two decode workers are available. Worker A is idle but across racks on a 100 Gbps congested path; worker B has a 60 ms queue but sits near the prefill worker on a 200 Gbps path. Worker A may look better to a capacity-only router, while worker B can win first-token latency after transfer is included.',
        'If the user cancels after prefill finishes but before decode readiness, the ledger must mark the request aborted and release all producer, network, and consumer buffers. Without that cleanup, the fabric spends future HBM on a request that no longer exists.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM disaggregated prefilling at https://docs.vllm.ai/en/latest/features/disagg_prefill/, Ray Serve prefill/decode disaggregation at https://docs.ray.io/en/latest/serve/llm/user-guides/prefill-decode.html, DistServe at https://arxiv.org/abs/2401.09670, and Mooncake at https://kvcache-ai.github.io/Mooncake/.',
        'Study Prefill/Decode Disaggregation, PagedAttention, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, tail latency, distributed tracing, backpressure, and memory ownership protocols next.',
      ],
    },
  ],
};