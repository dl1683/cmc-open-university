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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the phase-interference view as one queue feeding workers that must handle two different jobs. Active nodes show where compute is being spent, compare nodes show the phase being delayed, and found nodes show user-visible output. Prefill means processing the prompt to build key-value cache state; decode means generating output tokens one at a time using that state.',
        'The disaggregated view shows the boundary. The prefill pool creates KV state, the transfer node moves or exposes it, and the decode pool streams tokens. The safe inference is that the split is correct only if the decode worker receives the same state a colocated worker would have kept locally.',
        {type:'callout', text:'The architectural split turns one LLM request into two schedulable phases joined by a precise KV-state handoff.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'A single LLM request hides two workloads. Prefill is a dense pass over all prompt tokens and mostly shapes time to first token, called TTFT. Decode is a repeated one-token loop and mostly shapes time per output token, called TPOT.',
      'A chat service needs a fast first token and a steady stream after it. When both phases share one GPU pool, long prompts can delay streams and long streams can keep memory occupied while prompts wait. Disaggregation exists to size and schedule those phases separately.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious serving design is colocated workers. Put requests in a queue, batch them, and let the same GPU handle prefill and decode. This keeps ownership simple because the worker that builds the KV cache also uses it.',
      'Colocation is often right for short prompts, short outputs, small clusters, or weak networks. There is no distributed state handoff and fewer failure modes. Many serving stacks start here because it matches the application view of one request in and one response out.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall appears when prompt bursts and streaming loops compete for the same hardware. Prefill wants large compute-heavy batches, while decode wants memory bandwidth and stable cache residency. One scheduler must choose a compromise that can hurt both TTFT and TPOT.',
      'Raw tokens per second can hide this failure. A cluster can produce many total tokens while interactive users see slow first tokens or uneven streams. Goodput counts completed work that satisfies the latency targets, so it exposes interference that throughput averages hide.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Split the request at the KV-cache boundary. A router sends prompt work to a prefill pool, then moves or registers the resulting KV blocks for a decode worker. The logical request stays intact, but cluster resources are allocated by phase.',
      'The invariant is state identity. KV blocks must bind to the model revision, tokenizer behavior, adapter state, positions, precision, and request prefix that produced them. If identity is loose, the decode phase can use wrong state and generate an answer that looks valid but is semantically corrupted.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The router estimates prompt length, output length, cache hits, queue depth, and bandwidth to candidate workers. A prefill worker runs the prompt forward pass and materializes KV blocks for every layer and token. The system then transfers those blocks, stores them in a shared KV service, or makes them remotely readable.',
      'The decode worker receives the KV handle and enters the token loop. It reads weights and cache, produces the next token, appends new KV, streams the token, and repeats until a stop condition. Monitoring must separate prefill queue time, KV transfer time, decode queue time, TTFT, and TPOT.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness is equivalence to colocation. If the decode worker uses exactly the KV state that the prefill worker would have kept, the next-token computation is the same for the same model and sampling settings. The architecture changes placement, not the mathematical dependency between prompt state and generation.',
      'Performance improves only when saved interference is larger than transfer cost. Prefill workers can be tuned for dense prompt computation, and decode workers can be tuned for memory-resident streams. If network delay or cache misses dominate, the split loses.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'KV movement is the new cost. For a model with 32 layers, 32 heads, head dimension 128, K and V tensors, and fp16 values, one token needs about 512 KB of KV state. A 4,000-token prompt therefore produces about 2 GB of state before decode starts.',
      'The control plane also becomes harder. Pool sizing, placement, retries, cache lifetime, overload policy, and state cleanup now affect user latency. Autoscaling the prefill pool alone can overproduce KV that decode workers cannot consume.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Prefill/decode disaggregation fits large LLM services with mixed prompt lengths, long streams, strict latency targets, and enough bandwidth to move state. DistServe frames the goal as goodput under TTFT and TPOT constraints. Splitwise studies phase-specific hardware and cost. Mooncake makes KV cache a first-class distributed resource for long-context serving.',
      'The pattern also composes with adjacent mechanisms. A system can use prefix caching before prefill, PagedAttention inside workers, chunked prefill for fairness, and an SLO-aware router across phase pools. Disaggregation is the cluster-level placement decision around those mechanisms.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The split fails when prompts are short, outputs are short, traffic is modest, or the network is the bottleneck. Colocated continuous batching may be faster and simpler. Extra handoff latency can harm the exact first-token metric the architecture meant to protect.',
      'It also fails when state placement is wrong. A decode worker waiting on remote KV cannot stream smoothly. Missing identity checks can reuse stale blocks. A failed decode worker needs retry, recompute, or rejection policy before users see silent stalls.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Two requests arrive together: one has a 20,000-token document and asks for a 100-token summary, while another has a 200-token chat prompt and asks for 800 output tokens. In a colocated queue, the long prompt can occupy compute while the chat stream waits. Then the long chat stream can hold cache and batch slots while later prompts wait.',
      'In a disaggregated cluster, the document goes to a prefill pool built for large prompt bursts. Its KV state moves to decode only after the heavy prompt pass. The short chat prompt can use another prefill worker and then a decode worker optimized for steady streaming, so first-token latency and stream cadence are controlled separately.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: DistServe at https://arxiv.org/abs/2401.09670, Splitwise at https://arxiv.org/abs/2311.18677, Mooncake at https://arxiv.org/abs/2407.00079, Mooncake FAST 2025 at https://www.usenix.org/conference/fast25/presentation/qin, and PagedAttention at https://arxiv.org/abs/2309.06180.',
      'Study Transformer Inference Roofline, PagedAttention, Prefix Caching RadixAttention, Chunked Prefill Token Budget Scheduler, SLO-Aware LLM Request Router, and KV Cache Transfer Fabric before building this for production traffic.',
    ] },
  ],
};
