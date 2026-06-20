// Prefill/decode disaggregation: separate prompt computation from token
// generation, move KV state between pools, and optimize TTFT/TPOT separately.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prefill-decode-disaggregation-case-study',
  title: 'Prefill/Decode Disaggregation Case Study',
  category: 'Systems',
  summary: 'Modern LLM serving architecture: separate compute-heavy prefill from memory-heavy decode and move KV cache state between phase-specific pools.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['phase interference', 'disaggregated cluster'], defaultValue: 'phase interference' },
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

function colocatedGraph(title) {
  return graphState({
    nodes: [
      { id: 'queue', label: 'queue', x: 0.8, y: 3.9, note: 'mixed work' },
      { id: 'gpu0', label: 'GPU 0', x: 3.1, y: 3.3, note: 'prefill+decode' },
      { id: 'gpu1', label: 'GPU 1', x: 3.1, y: 4.55, note: 'prefill+decode' },
      { id: 'prefill', label: 'prefill', x: 5.6, y: 3.3, note: 'TTFT' },
      { id: 'decode', label: 'decode', x: 5.6, y: 4.55, note: 'TPOT' },
      { id: 'users', label: 'users', x: 8.4, y: 3.9, note: 'streams' },
    ],
    edges: [
      { id: 'e-queue-gpu0', from: 'queue', to: 'gpu0' },
      { id: 'e-queue-gpu1', from: 'queue', to: 'gpu1' },
      { id: 'e-gpu0-prefill', from: 'gpu0', to: 'prefill' },
      { id: 'e-gpu1-decode', from: 'gpu1', to: 'decode' },
      { id: 'e-prefill-users', from: 'prefill', to: 'users' },
      { id: 'e-decode-users', from: 'decode', to: 'users' },
    ],
  }, { title });
}

function disaggregatedGraph(title) {
  return graphState({
    nodes: [
      { id: 'router', label: 'router', x: 0.7, y: 3.65, note: 'SLO aware' },
      { id: 'prefillPool', label: 'prefill pool', x: 3.0, y: 3.05, note: 'compute' },
      { id: 'kv', label: 'KV state', x: 5.1, y: 3.65, note: 'transfer' },
      { id: 'decodePool', label: 'decode pool', x: 7.1, y: 4.45, note: 'memory' },
      { id: 'stream', label: 'stream', x: 9.1, y: 3.65, note: 'tokens' },
      { id: 'cache', label: 'KV store', x: 5.1, y: 2.65, note: 'reuse' },
    ],
    edges: [
      { id: 'e-router-prefill', from: 'router', to: 'prefillPool' },
      { id: 'e-prefill-kv', from: 'prefillPool', to: 'kv' },
      { id: 'e-kv-decode', from: 'kv', to: 'decodePool' },
      { id: 'e-decode-stream', from: 'decodePool', to: 'stream' },
      { id: 'e-prefill-cache', from: 'prefillPool', to: 'cache' },
      { id: 'e-cache-kv', from: 'cache', to: 'kv' },
    ],
  }, { title });
}

function* phaseInterference() {
  yield {
    state: colocatedGraph('Colocated serving mixes two different workloads'),
    highlight: { active: ['gpu0', 'gpu1', 'prefill', 'decode'], compare: ['queue'], found: ['users'] },
    explanation: 'Traditional LLM servers often colocate prompt prefill and token decode on the same GPU pool. That is simple, but the two phases fight each other: prefill wants dense compute over many prompt tokens, while decode repeatedly reads weights and KV cache for one new token per sequence.',
  };

  yield {
    state: labelMatrix(
      'The phases want different resources',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'long', label: 'long prompt' },
        { id: 'stream', label: 'streaming chat' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'metric', label: 'metric' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['many tokens at once', 'TTFT', 'compute'],
        ['one token loop', 'TPOT', 'memory'],
        ['large prefill burst', 'first token', 'queue blocking'],
        ['steady decode', 'smooth stream', 'tail latency'],
      ],
    ),
    highlight: { active: ['prefill:pressure', 'decode:pressure'], compare: ['long:metric', 'stream:metric'] },
    explanation: 'DistServe frames the product metrics separately: time to first token is mostly prefill plus queueing; time per output token is mostly decode. Optimizing one by crowding the GPU can hurt the other.',
    invariant: 'TTFT and TPOT are different SLOs, not one latency number.',
  };

  yield {
    state: colocatedGraph('Interference couples placement and parallelism'),
    highlight: { active: ['queue', 'gpu0', 'gpu1', 'e-queue-gpu0', 'e-queue-gpu1'], removed: ['prefill'], compare: ['decode'] },
    explanation: 'When the same pool handles both phases, the system must choose one resource plan for two shapes. Prefill may prefer more compute-heavy parallelism. Decode may prefer high memory bandwidth, larger live batches, or cheaper hardware.',
  };

  yield {
    state: labelMatrix(
      'Goodput lens',
      [
        { id: 'throughput', label: 'throughput' },
        { id: 'goodput', label: 'goodput' },
        { id: 'ttft', label: 'TTFT miss' },
        { id: 'tpot', label: 'TPOT miss' },
      ],
      [
        { id: 'counts', label: 'counts' },
        { id: 'problem', label: 'problem' },
      ],
      [
        ['all completed work', 'can hide bad latency'],
        ['work within SLO', 'serving objective'],
        ['slow first token', 'bad prompt phase'],
        ['slow stream', 'bad decode phase'],
      ],
    ),
    highlight: { found: ['goodput:counts'], compare: ['throughput:problem'], removed: ['ttft:problem', 'tpot:problem'] },
    explanation: 'Goodput asks how much traffic the cluster serves while satisfying both latency contracts. That is stricter and more product-relevant than raw tokens per second.',
  };
}

function* disaggregatedCluster() {
  yield {
    state: disaggregatedGraph('Disaggregation gives each phase its own pool'),
    highlight: { active: ['router', 'prefillPool', 'decodePool', 'e-router-prefill', 'e-kv-decode'], found: ['kv', 'stream'] },
    explanation: 'Prefill/decode disaggregation sends prompt computation to a prefill pool, transfers the produced KV state, then streams tokens from a decode pool. The architecture separates resource allocation, placement, and scheduling for the two phases.',
  };

  yield {
    state: disaggregatedGraph('KV state is the handoff between phases'),
    highlight: { active: ['prefillPool', 'kv', 'decodePool', 'e-prefill-kv', 'e-kv-decode'], compare: ['cache'] },
    explanation: 'The handoff is not raw text; it is model state. After prefill, the decode worker needs the KV cache for the prompt so it can generate the next tokens without recomputing the entire prompt.',
    invariant: 'Disaggregation only works when KV transfer is cheaper than the interference it removes.',
  };

  yield {
    state: labelMatrix(
      'Architecture choices',
      [
        { id: 'distserve', label: 'DistServe' },
        { id: 'splitwise', label: 'Splitwise' },
        { id: 'mooncake', label: 'Mooncake' },
        { id: 'baseline', label: 'colocated' },
      ],
      [
        { id: 'core move', label: 'core move' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['split phases for SLO goodput', 'network placement'],
        ['match phase to hardware', 'state transfer'],
        ['KV-centric disaggregated cache', 'overload policy'],
        ['simple deployment', 'phase interference'],
      ],
    ),
    highlight: { active: ['distserve:core move', 'splitwise:core move', 'mooncake:core move'], compare: ['baseline:watch'] },
    explanation: 'The papers differ in emphasis. DistServe optimizes TTFT/TPOT goodput. Splitwise highlights phase-specific hardware, cost, and power. Mooncake treats KV cache as a first-class disaggregated resource for long-context chatbot serving.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'network', label: 'network' },
        { id: 'placement', label: 'placement' },
        { id: 'cache', label: 'KV cache' },
        { id: 'overload', label: 'overload' },
      ],
      [
        { id: 'failure', label: 'failure' },
        { id: 'control', label: 'control' },
      ],
      [
        ['KV transfer stalls', 'bandwidth-aware routing'],
        ['wrong pool size', 'phase-specific autoscaling'],
        ['state missing or evicted', 'cache admission policy'],
        ['too many long prompts', 'early rejection or downgrade'],
      ],
    ),
    highlight: { removed: ['network:failure', 'cache:failure'], active: ['placement:control', 'overload:control'] },
    explanation: 'Disaggregation trades GPU interference for distributed-systems problems: network placement, KV lifetime, cache admission, routing, overload control, and observability by phase.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'phase interference') yield* phaseInterference();
  else if (view === 'disaggregated cluster') yield* disaggregatedCluster();
  else throw new InputError('Pick a prefill/decode disaggregation view.');
}

export const article = {
  sections: [
    {
      heading: 'Why it exists',
      paragraphs: [
        "Autoregressive LLM serving looks like one request from the outside, but the runtime sees two different workloads. Prefill reads the full prompt, runs a large forward pass over many input tokens, and creates the KV cache for those tokens. Decode then uses that cache to generate one new token at a time. The first phase is a burst. The second phase is a long loop.",
        "Those phases put pressure on different resources and different user-facing metrics. Prefill dominates time to first token, often called TTFT. Decode dominates time per output token, often called TPOT. A chat product needs the first token to appear quickly and the stream to keep moving after that. Prefill/decode disaggregation exists because one mixed GPU pool can make those goals fight each other.",
        {type:"callout", text:"The architectural split turns one LLM request into two schedulable phases joined by a precise KV-state handoff."},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The reasonable first design is colocated serving. Put requests in a queue, batch them, and let each GPU worker handle prefill and decode together. This is simple to deploy and can be the right answer for short prompts, short outputs, small clusters, or networks that cannot move KV state cheaply.",
        "Colocation also keeps ownership simple. The worker that computes the prompt owns the cache and streams the answer. There is no distributed handoff, no cache-transfer protocol, and no extra scheduler boundary. Many serving systems begin here because the architecture matches the request lifecycle that application engineers see.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall appears when prompt bursts and streaming loops share the same scarce devices. A long prompt can occupy compute and delay first tokens for other users. A large decode batch can keep cache state resident and make prefill wait. The cluster has to choose one batching policy, one parallelism plan, and one placement strategy for two resource shapes.",
        "Raw throughput hides this failure. A server can report many tokens per second while users see slow first tokens or uneven streams. Goodput is stricter: it counts work that meets the latency contracts. DistServe frames the issue this way by separating TTFT and TPOT constraints. The serving objective is not just more tokens. It is more useful requests inside both latency budgets.",
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        "The core insight is to split the request at the KV cache boundary. Send prompt computation to a prefill pool. Move or expose the produced KV state. Then let a decode pool own the token-generation loop. The phases still form one logical request, but the cluster can size and schedule them as different workloads.",
        "The invariant is exact state handoff. Decode cannot resume from raw text alone without recomputing the prompt. It needs the right KV blocks for the right model weights, tokenizer behavior, adapter state, positional scheme, and request prefix. Disaggregation is useful only when moving that state costs less than the interference removed by separating the phases.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "A request enters a router with a prompt, generation parameters, and SLO context. The router chooses a prefill worker based on queue depth, prompt length, prefix-cache hits, model placement, and bandwidth to possible decode workers. The prefill worker runs the prompt forward pass and materializes KV blocks for every prompt token.",
        "After prefill, the system transfers KV blocks, registers them in a shared KV store, or makes them remotely readable by the selected decode worker. The decode worker then enters the token loop: read weights and KV, sample or select the next token, append new KV, stream the token, and repeat until stop. The split turns one request into a stateful pipeline.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "It works when the phase split creates more scheduling freedom than it costs in communication. Prefill workers can be tuned for prompt bursts, larger prompt batches, tensor parallelism, or newer compute-heavy accelerators. Decode workers can be tuned for memory bandwidth, cache residency, long-lived streams, and stable per-token cadence. The scheduler no longer has to pretend those are the same problem.",
        "The proof sketch is a systems tradeoff, not an algorithm theorem. If the decode worker receives the same KV state that a colocated worker would have held locally, generation semantics are preserved. If the network path, cache lookup, and queueing delay are smaller than the saved interference, TTFT, TPOT, or goodput improves. If they are larger, the split is a regression.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "The new cost is KV movement. KV cache size grows with layers, hidden dimensions, heads, precision, and prompt length. Long-context prompts make the handoff heavier. Compression, quantized KV, shared memory, RDMA, NVLink, cache locality, and prefix reuse can change the break-even point, but none remove the basic fact: state must cross a boundary.",
        "The scheduler also becomes a control plane. It must track phase queues, bandwidth, cache placement, worker health, SLO classes, prompt length estimates, output length estimates, and overload policy. Autoscaling one pool without the other can move the bottleneck rather than fix it. A healthy disaggregated system reports TTFT, prefill queue time, KV transfer time, decode queue time, TPOT, and stream gap percentiles separately.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Consider two requests arriving together. One user sends a 20,000-token document and asks for a short summary. Another sends a short chat prompt and expects a long answer. In a colocated pool, the long prompt can delay decode work, and the long stream can keep cache state resident while new prompts wait.",
        "In a disaggregated cluster, the router sends the document prompt to a prefill pool sized for large prompt bursts. When prefill finishes, the KV state moves to a decode pool. The short chat prompt may use a different prefill worker and then join a decode worker optimized for steady streaming. The system can protect first-token latency and stream cadence separately instead of letting one mixed queue decide both.",
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        "This design matters most in large LLM services with mixed prompt lengths, long output streams, strict interactive latency, high cluster cost, and enough network bandwidth to move state efficiently. DistServe emphasizes goodput under TTFT and TPOT. Splitwise emphasizes matching each phase to hardware with different compute, memory, cost, and power characteristics. Mooncake pushes KV cache into the center of the architecture for long-context chatbot workloads.",
        "It also matters when prefix caching and cache reuse are common. A system that can find, place, and reuse existing KV blocks may avoid some prompt work entirely. In that world, routing is not just load balancing. It is a decision about where state already lives, how expensive it is to move, and which worker can meet the next phase's latency target.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Do not split phases just because a paper architecture does it. If prompts are short, outputs are short, traffic is modest, or the network is weak, colocated serving with continuous batching, paged KV memory management, and chunked prefill may be simpler and faster. The extra boundary can add latency, increase tail risk, and make debugging harder.",
        "Disaggregation fails when state placement is wrong. A decode worker that waits on remote KV cannot stream smoothly. A prefill pool that overproduces KV faster than decode can consume it creates memory pressure. A failed decode worker needs retry, recompute, or rejection policy. A cache eviction bug can turn a normal request into a silent wrong-state hazard unless identity checks are strict.",
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        "Treat KV as a named resource. Give every cache block an identity that binds model, revision, adapter, tokenizer assumptions, request prefix, position encoding, precision, and ownership state. Record where it lives, how long it may live, whether it can be shared, and what happens if the consumer disappears.",
        "Make overload explicit. Long prompts can fill prefill queues. Long generations can fill decode capacity. The router needs admission control, downgrade rules, early rejection, or backpressure before queues destroy latency for everyone. Dashboards should separate prefill saturation from decode saturation so operators do not add the wrong kind of capacity.",
      ],
    },
    {
      heading: 'Relationship to nearby topics',
      paragraphs: [
        "PagedAttention and paged KV managers solve memory layout inside a serving runtime. Prefix caching and RadixAttention solve reuse across shared prefixes. Continuous batching solves how many active sequences can advance together. Chunked prefill limits how much prompt work can block decode on a shared worker. Prefill/decode disaggregation is the cluster-level decision about where phases run and how state crosses between them.",
        "The ideas compose. A disaggregated service may still use PagedAttention inside each worker, prefix caching before prefill, chunked prefill for fairness, and an SLO-aware router across pools. The dangerous mistake is to treat any one mechanism as the whole serving system.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary sources: DistServe at https://arxiv.org/abs/2401.09670, Splitwise at https://arxiv.org/abs/2311.18677, Mooncake at https://arxiv.org/abs/2407.00079, the USENIX FAST 2025 Mooncake page at https://www.usenix.org/conference/fast25/presentation/qin, and PagedAttention at https://arxiv.org/abs/2309.06180.",
        "Study Transformer Inference Roofline first for the compute and memory bottlenecks. Then study Chunked Prefill Token Budget Scheduler, Prefix Caching RadixAttention, SLO-Aware LLM Request Router, Tail Latency, GPU Memory Pool Fragmentation Ledger, and Heterogeneous AI Compute Workload Router.",
      ],
    },
  ],
};
