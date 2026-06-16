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
      heading: 'What it is',
      paragraphs: [
        'A KV cache transfer fabric is the data-movement layer underneath prefill/decode disaggregation. Prefill computes prompt KV state. Decode cannot generate correctly until that state is available locally, remotely readable, or streamable under a clear policy. The fabric is the set of block maps, connectors, queues, buffers, network paths, and cleanup acknowledgements that make that handoff safe.',
        'The existing Prefill/Decode Disaggregation Case Study explains why the phases are split. This page zooms into the handoff. In a real server, the request carries more than text: it carries remote engine identity, block IDs, layer readiness, transfer direction, local block allocation, and a cleanup contract.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A proxy or router sends prompt work to a prefill instance and sends metadata to a decode instance. In read mode, prefill publishes remote block IDs and decode pulls the KV cache. In write mode, prefill can push layer-by-layer KV blocks into decode-owned memory while prefill is still running. Either way, the decode scheduler must park the request until the required KV blocks are ready.',
        'vLLM documents disaggregated prefilling as two vLLM instances connected by KV-transfer connectors, with abstractions such as Connector, LookupBuffer, and Pipe under vllm/distributed/kv_transfer: https://docs.vllm.ai/en/latest/features/disagg_prefill/. Ray Serve exposes the same pattern for deployments and lists NIXLConnector and LMCacheConnectorV1 as KV-transfer backends for separated prefill and decode: https://docs.ray.io/en/latest/serve/llm/user-guides/prefill-decode.html.',
      ],
    },
    {
      heading: 'Complete case study: long-context chat',
      paragraphs: [
        'A long-chat request with a 64k-token prompt may produce several gigabytes of KV state. If the router sends prefill to one rack and decode to a far or congested node, the first token can wait on transfer rather than compute. A better control plane routes by prefix-cache locality, rack locality, transfer backlog, decode capacity, and SLO risk together. SLO-Aware LLM Request Router is the replica-selection layer that turns those signals into a scored route rather than a blind load-balancer pick.',
        'Mooncake frames this as a KVCache-centric architecture: separate prefill and decode clusters, then use CPU, DRAM, SSD, and NIC resources to form a disaggregated KV-cache pool for long-context serving: https://kvcache-ai.github.io/Mooncake/. The USENIX FAST page describes Mooncake as the Kimi serving platform and highlights the same KVCache-centric design: https://www.usenix.org/conference/fast25/presentation/qin.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The performance ledger has at least four clocks: prefill time, transfer time, injection time, and decode time. A system that reports only aggregate tokens per second can miss the real problem. KV-transfer bytes, NIC queue depth, flow count, prefix-cache hit rate, staging-buffer occupancy, parked-request count, and cleanup lag should be visible in traces.',
        'PyTorch and vLLM describe production P/D serving components such as a service proxy, Python KV connector, C++ prefill/decode connectors, temporary CPU or GPU buffers, separate CUDA streams, multiple transfer channels, sticky routing, and garbage collection for aborted requests: https://pytorch.org/blog/disaggregated-inference-at-scale-with-pytorch-vllm/. vLLM also shows RDMA read and write modes in a MoRI-IO connector flow, including remote block IDs, waiting states, layer-by-layer writes, and cleanup notifications: https://vllm.ai/blog/2026-04-07-moriio-kv-connector.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat KV transfer as a memcpy footnote. It is a distributed-systems boundary with ownership, ordering, backpressure, cancellation, and tail-latency failure modes. Small block sizes can create too many kernel launches or messages. Giant payloads can delay readiness. Remote block IDs can go stale. Decode-side injection can OOM if aborted requests are not cleaned.',
        'Do not assume disaggregation always raises throughput. Some documentation explicitly warns that disaggregated prefill is mainly for separately tuning first-token and inter-token latency or controlling tail latency. If prompts are short, traffic is small, or network bandwidth is weak, colocated serving plus Chunked Prefill Token Budget Scheduler can be the better engineering choice. If the problem is reuse across turns rather than phase handoff, KV Cache Tiered Offload Store is the better next layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: DistServe at https://arxiv.org/abs/2401.09670, vLLM disaggregated prefilling docs at https://docs.vllm.ai/en/latest/features/disagg_prefill/, Ray Serve P/D disaggregation docs at https://docs.ray.io/en/latest/serve/llm/user-guides/prefill-decode.html, PyTorch/vLLM disaggregated inference at https://pytorch.org/blog/disaggregated-inference-at-scale-with-pytorch-vllm/, Mooncake docs at https://kvcache-ai.github.io/Mooncake/, Mooncake FAST page at https://www.usenix.org/conference/fast25/presentation/qin, llm-d networking notes at https://llm-d.ai/blog/llm-d-v0.5-sustaining-performance-at-scale, vLLM MoRI-IO connector blog at https://vllm.ai/blog/2026-04-07-moriio-kv-connector, and NVIDIA Kubernetes disaggregated inference notes at https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/.',
        'Study Prefill/Decode Disaggregation Case Study first, then Chunked Prefill Token Budget Scheduler, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, LLM Serving: PagedAttention, KV Cache Concurrency Capacity Model, Prefix Caching & RadixAttention, GPU Memory Pool Fragmentation Ledger, LLM Inference Cost Stack Case Study, Distributed Tracing, Backpressure, Load Balancer, Tail Latency & p99 Thinking, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
