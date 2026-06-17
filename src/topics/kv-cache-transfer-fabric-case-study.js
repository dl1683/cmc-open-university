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
      heading: 'Why it exists',
      paragraphs: [
        'Prefill/decode disaggregation separates two phases that want different hardware behavior. Prefill reads a long prompt and builds key/value state for every transformer layer. Decode then generates one token at a time and repeatedly reads that state. Splitting the phases can protect inter-token latency because decode workers are no longer interrupted by heavy prompt work, but it creates a new systems problem: the state made by prefill must arrive at decode before decode can produce a correct first token.',
        'A KV cache transfer fabric is the layer that makes that handoff explicit. It names the prompt state, records who owns it, moves the bytes, parks decode requests until the required blocks are ready, and releases temporary memory after the request is done or aborted. The fabric is not a faster memcpy. It is an ownership protocol for large tensors under latency pressure.',
        'The constraint is severe because KV state is both large and live. A long prompt can produce gigabytes of layer-by-layer cache. The decode side cannot approximate or skip those blocks without changing the model computation. If the handoff is late, time-to-first-token rises. If it is wrong, decode attends to the wrong prompt state. If cleanup is missing, GPU memory leaks into later requests.',
      ],
    },
    {
      heading: 'The obvious split',
      paragraphs: [
        'The obvious design is to run prefill on one pool, run decode on another pool, and let the decode worker fetch tensors when it needs them. That design is attractive because it keeps the scheduling story simple: route the prompt, produce the cache, copy it, then decode.',
        'That approach is not foolish. It is exactly the first shape many systems reach for, and read-mode connectors still follow this broad pattern. The decode worker waits for metadata from prefill, receives remote engine identity and block identifiers, pulls the blocks, injects them into local KV memory, and then starts the decode step.',
        'The problem is that the simple story hides every correctness edge. Decode needs to know whether each layer is complete, whether the block ids belong to the current request epoch, whether the destination allocation still exists, and whether the user cancelled while the transfer was in flight. A transfer fabric exists because those questions have to be answered in data structures, not in comments.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is tail latency plus state identity. Average bandwidth can look fine while a few large prompts fill the NIC queue and stall first-token delivery. A routing policy that chooses the nearest open decode slot can still be bad if the KV path to that slot crosses a busy link or loses prefix-cache locality.',
        'The second wall is ownership. KV blocks outlive the function call that created them. They pass through scheduler queues, connector buffers, CPU staging memory, network streams, GPU staging buffers, decode-side block tables, and cleanup paths. A boolean such as "kv_ready" cannot safely represent that lifecycle.',
        'The fabric therefore has to model a request as a state machine. New, filling, sending, receiving, injecting, ready, streaming, completed, and aborted are different states with different allowed transitions. Treating them as incidental statuses makes p99 debugging hard and makes memory leaks likely.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to make KV movement a versioned ledger. The ledger binds request id, producer engine, token range, layer range, physical or remote block id, transfer mode, readiness mask, epoch, destination allocation, and cleanup acknowledgement. Decode may use a block only when that row proves the block is complete for the right computation and still belongs to a live request.',
        'This changes the problem from "copy a tensor" to "preserve an invariant across distributed workers." The invariant is ownership plus readiness: every KV block has one current producer or storage owner, a known consumer policy, a version that rejects stale metadata, and a cleanup path that eventually frees the memory.',
        'Once the handoff is a ledger, the router can reason about more than capacity. It can route the request, the KV state, and the service-level objective together. The best route is not just an open decode slot; it is an open decode slot whose transfer path, cache locality, HBM headroom, and p99 risk all make the first token feasible.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A proxy or scheduler first assigns the request to prefill and decode roles. The prefill worker runs prompt attention and emits KV blocks, often layer by layer. A producer connector saves those blocks into transfer-accessible memory, records the block metadata, and places transfer operations onto a queue. A consumer connector receives or pulls blocks, stages them if necessary, injects them into decode-owned KV memory, and marks the request ready.',
        'Read mode and write mode place the synchronization point in different places. In read mode, prefill publishes remote block ids and decode pulls the blocks after it knows what to fetch. This is easier to audit because decode controls the read, but it serializes more of the prefill-to-decode path. In write mode, prefill pushes layer-by-layer blocks into decode-side addresses while prefill is still running. That overlaps transfer with compute, but it requires stronger address exchange, completion tracking, and cleanup discipline.',
        'The connector design separates the model loop from heavy IO. Scheduler connectors plan work. Worker connectors save and load blocks. Pipes or transfer channels move payloads. Lookup buffers and staging areas decouple completion from immediate scheduling. Garbage collection clears idle or aborted buffers. The model loop should not block on a synchronous network copy for every layer if the serving system is trying to protect tail latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is plain: decode is allowed to sample only after all required prompt KV blocks for its policy are present in the local decode layout or are streamable with a safe wait rule. The block map proves identity, readiness, and version. The scheduler state prevents a request from being selected while it is still waiting for remote KV.',
        'The cleanup side is part of the same argument. A request that finishes, cancels, or gets preempted must release producer-side blocks, transfer buffers, and decode-side staging memory. Otherwise the fabric may remain correct for the current request while poisoning the next one through leaked HBM or stale block ids.',
        'The latency argument is also structural. Disaggregation can make inter-token latency steadier because decode batches do not share the worker with prefill jobs. It often adds first-token overhead because KV state must cross a boundary. Write mode, locality-aware routing, split transfer streams, and prefix-cache sticky routing are attempts to reduce that boundary cost without giving up decode isolation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is bytes moved. KV size grows with layers, heads, head dimension, precision, and prompt length. Doubling prompt length roughly doubles the KV payload for the handoff. Longer context therefore turns the network and injection path into a first-token component, not just a background detail.',
        'The second cost is metadata and scheduling complexity. The system needs block maps, request states, readiness masks, transfer queues, connector buffers, and metrics that separate prefill time, transfer time, injection time, parked-wait time, decode time, and cleanup lag. Aggregate tokens per second is not enough to debug this layer.',
        'Granularity is a real tradeoff. Tiny blocks and too many channels create overhead, lock contention, and message pressure. Giant blocks delay readiness and reduce overlap. Good fabrics choose transfer units that are large enough to use bandwidth efficiently and small enough to pipeline with layer completion.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'Consider a long-chat request with a 64k-token context and a stable system prompt. The router sees two possible decode workers. One is open but in another rack. The other is slightly busier but near the prefill worker and likely to reuse prefix state. A capacity-only router may choose the open worker and create a multi-gigabyte cross-rack transfer. A fabric-aware router may keep the request near the cached prefix and avoid a p99 spike.',
        'The transfer record for that request should show the prompt byte estimate, chosen prefill and decode engines, block ids, layer readiness, transfer mode, channel count, waiting duration, injection duration, first-token time, and cleanup acknowledgement. If the user cancels after prefill but before decode readiness, the same record should drive garbage collection rather than leaving staging buffers behind.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Build the fabric like a control plane. Use explicit request states. Version block metadata. Make stale ids fail closed. Track producer and consumer ownership separately. Record why a request is parked. Put cleanup on the normal path and the abort path. Keep transfer metrics separate from model metrics so a slow first token is not misattributed to sampling.',
        'Route with topology and locality. Prefer decode targets that can receive the KV payload within the first-token budget, not merely targets with open batch slots. Include NIC queueing, rack locality, prefix-cache hit probability, HBM headroom, and outstanding transfer bytes in the admission decision. When a request cannot meet its SLO, reject or defer it before spending expensive prefill compute.',
        'Treat read and write modes as engineering choices, not as universal winners. Read mode is easier to reason about and can be safer for early systems. Write mode can overlap more work, but it moves risk into address exchange, readiness tracking, and completion handling. The right answer depends on hardware, connector maturity, prompt length distribution, and the cost of first-token latency.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Small blocks can create too many operations. Large blocks can delay readiness. Remote block ids can go stale. Decode injection can run out of memory when aborted requests are not cleaned. Prefix-cache locality can be lost by a router that sees only decode capacity. A fabric can also look healthy on average while a few long prompts dominate p99.',
        'Do not assume disaggregation raises throughput. vLLM documentation explicitly frames disaggregated prefilling as a way to tune time-to-first-token and inter-token latency separately and warns that it does not automatically improve throughput. If prompts are short, traffic is light, or network bandwidth is weak, colocated serving plus chunked prefill may be simpler and faster.',
        'The technique is also the wrong layer for some problems. If the goal is reuse across turns or across requests, a KV cache storage or prefix-caching layer matters more. If the problem is memory pressure inside one worker, paged attention, quantized KV, eviction policy, or tiered offload may be the better first study.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Current system references for this topic are vLLM disaggregated prefilling docs at https://docs.vllm.ai/en/latest/features/disagg_prefill/, Ray Serve prefill/decode disaggregation docs at https://docs.ray.io/en/latest/serve/llm/user-guides/prefill-decode.html, the PyTorch and vLLM disaggregated inference writeup at https://pytorch.org/blog/disaggregated-inference-at-scale-with-pytorch-vllm/, the vLLM MoRI-IO connector writeup at https://vllm.ai/blog/2026-04-07-moriio-kv-connector, DistServe at https://arxiv.org/abs/2401.09670, and Mooncake at https://kvcache-ai.github.io/Mooncake/.',
        'Study Prefill/Decode Disaggregation Case Study first, because this fabric exists to connect separated prefill and decode workers. Then study Chunked Prefill Token Budget Scheduler, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, PagedAttention, KV Cache Concurrency Capacity Model, Prefix Caching and RadixAttention, GPU Memory Pool Fragmentation Ledger, Distributed Tracing, Backpressure, Load Balancing, and Tail Latency.',
      ],
    },
  ],
};
