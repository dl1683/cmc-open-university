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
      heading: 'What it is',
      paragraphs: [
        'Prefill/decode disaggregation is a modern LLM serving architecture that separates the prompt-processing phase from the token-generation phase. Prefill consumes a full prompt and builds the KV Cache. Decode uses that cache to stream one new token at a time. The two phases have different resource shapes, so systems such as DistServe, Splitwise, and Mooncake split them across separate pools or even separate hardware classes.',
        'DistServe states the core problem directly: colocating prefill and decode causes interference and couples resource allocation for two phases with different latency metrics. The paper optimizes goodput under time-to-first-token and time-per-output-token constraints: https://arxiv.org/abs/2401.09670. The OSDI paper PDF is available from USENIX at https://www.usenix.org/system/files/osdi24-zhong-yinmin.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A router admits a request and sends its prompt to a prefill worker. The prefill worker runs the prompt forward pass and produces KV state for every prompt token. That state is transferred to a decode worker, which owns the streaming loop. The decode worker repeatedly reads model weights and the prompt KV state, appends one token, and updates the cache.',
        'The architecture only pays off if the cluster handles KV transfer intelligently. KV Cache Transfer Fabric Case Study zooms into that missing layer: block IDs, producer and consumer roles, async connectors, RDMA read/write choices, staged buffers, cleanup acknowledgements, and congestion gates. DistServe places prefill and decode workers according to cluster bandwidth. Splitwise describes phase splitting as a way to assign prompt computation and token generation to machines suited to their different compute, memory, cost, and power characteristics: https://arxiv.org/abs/2311.18677. Microsoft Research summarizes the same phase-splitting motivation in its Splitwise blog: https://www.microsoft.com/en-us/research/blog/splitwise-improves-gpu-usage-by-splitting-llm-inference-phases/.',
      ],
    },
    {
      heading: 'Complete case study: long-context chatbot serving',
      paragraphs: [
        'Mooncake, the serving platform behind Kimi, pushes the idea further by making KV cache the center of the architecture. It separates prefill and decoding clusters and uses underutilized CPU, DRAM, SSD, and NIC resources to build a disaggregated KV cache pool. The FAST 2025 page describes Mooncake as a KVCache-centric disaggregated architecture for serving an LLM chatbot: https://www.usenix.org/conference/fast25/presentation/qin.',
        'This is the production-systems lesson: long-context LLM serving is not only matrix multiplication. It is state placement. A long prompt creates a large KV object. If that object is expensive to recompute, the cluster should preserve, transfer, reuse, or evict it deliberately. Prefix Caching & RadixAttention handles reuse inside a server; Mooncake-style designs treat KV as a distributed memory tier.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Disaggregation introduces a new cost ledger. It can reduce prefill/decode interference, raise goodput, and let each phase use a better hardware or parallelism plan. It also adds KV transfer latency, routing complexity, cache consistency questions, network placement, overload control, and more failure modes. Chunked Prefill Token Budget Scheduler is the simpler local alternative when one pool can still meet the SLO: split long prompt work into bounded chunks before reaching for a remote P/D architecture.',
        'The practical metrics are phase-specific. TTFT measures queueing plus prefill. TPOT measures the decode loop. Goodput counts only requests that satisfy those SLOs. Network bytes per transferred KV block, cache hit rate, pool utilization, admission rejection rate, and p99 by workload slice become first-class serving metrics.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not split phases just because the architecture is fashionable. If prompts are short, outputs are short, network bandwidth is limited, or the cluster is small, colocated serving may be simpler and faster. Do not optimize raw throughput while violating TTFT or TPOT. Do not ignore failure recovery: if a decode worker loses the transferred KV state, the system needs a recompute, retry, or rejection policy.',
        'Do not confuse this with PagedAttention. PagedAttention manages KV memory blocks inside an inference runtime. Prefill/decode disaggregation decides where phases run and how KV state moves between workers. In a serious serving stack, both layers can appear together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DistServe at https://arxiv.org/abs/2401.09670 and https://www.usenix.org/system/files/osdi24-zhong-yinmin.pdf, Splitwise at https://arxiv.org/abs/2311.18677, Microsoft Splitwise blog at https://www.microsoft.com/en-us/research/blog/splitwise-improves-gpu-usage-by-splitting-llm-inference-phases/, Mooncake at https://arxiv.org/abs/2407.00079, USENIX FAST Mooncake page at https://www.usenix.org/conference/fast25/presentation/qin, Mooncake GitHub at https://github.com/kvcache-ai/Mooncake/, and vLLM/PagedAttention at https://arxiv.org/abs/2309.06180.',
        'Study Transformer Inference Roofline, LLM Continuous Batching, Chunked Prefill Token Budget Scheduler, LLM Serving: PagedAttention, Prefix Caching & RadixAttention, KV Cache, KV Cache Transfer Fabric Case Study, Tail Latency & p99 Thinking, Load Balancer, LLM Inference Cost Stack Case Study, and LLM Inference Scaling Playbook next.',
      ],
    },
  ],
};
