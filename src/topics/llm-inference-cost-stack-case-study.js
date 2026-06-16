// LLM inference cost stack: map each serving optimization to the phase,
// resource, and workload shape it actually improves.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-inference-cost-stack-case-study',
  title: 'LLM Inference Cost Stack Case Study',
  category: 'Systems',
  summary: 'A phase-by-phase map of inference cost levers: batching, paged KV cache, prefix reuse, quantization, kernels, and speculation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cost levers', 'workload fit'], defaultValue: 'cost levers' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.5, note: 'prompt' },
      { id: 'route', label: 'router', x: 2.1, y: 3.5, note: 'admit' },
      { id: 'prefill', label: 'prefill', x: 3.7, y: 2.1, note: 'prompt work' },
      { id: 'kv', label: 'KV cache', x: 5.3, y: 3.5, note: 'state' },
      { id: 'decode', label: 'decode', x: 6.9, y: 2.1, note: 'stream' },
      { id: 'output', label: 'output', x: 8.7, y: 3.5, note: 'tokens' },
      { id: 'batch', label: 'batching', x: 3.7, y: 5.6, note: 'occupancy' },
      { id: 'prefix', label: 'prefix', x: 5.3, y: 5.9, note: 'reuse' },
      { id: 'spec', label: 'speculate', x: 7.0, y: 5.6, note: 'draft' },
    ],
    edges: [
      { id: 'e-request-route', from: 'request', to: 'route' },
      { id: 'e-route-prefill', from: 'route', to: 'prefill' },
      { id: 'e-prefill-kv', from: 'prefill', to: 'kv' },
      { id: 'e-kv-decode', from: 'kv', to: 'decode' },
      { id: 'e-decode-output', from: 'decode', to: 'output' },
      { id: 'e-route-batch', from: 'route', to: 'batch' },
      { id: 'e-prefix-kv', from: 'prefix', to: 'kv' },
      { id: 'e-spec-decode', from: 'spec', to: 'decode' },
      { id: 'e-batch-decode', from: 'batch', to: 'decode' },
    ],
  }, { title });
}

function* costLevers() {
  yield {
    state: stackGraph('Cost levers attach to different serving phases'),
    highlight: { active: ['request', 'route', 'prefill', 'kv', 'decode', 'output', 'e-request-route', 'e-route-prefill', 'e-prefill-kv', 'e-kv-decode', 'e-decode-output'], found: ['batch', 'prefix', 'spec'] },
    explanation: 'LLM inference cost is not one bottleneck. A request pays routing and queueing, prefill, KV cache residency, decode, and output streaming. Each optimization helps a specific phase and can hurt another.',
  };

  yield {
    state: labelMatrix(
      'Lever map',
      [
        { id: 'batch', label: 'batching' },
        { id: 'paging', label: 'paged KV' },
        { id: 'prefix', label: 'prefix cache' },
        { id: 'quant', label: 'quant' },
        { id: 'spec', label: 'spec decode' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['idle GPU', 'queue p99'],
        ['stranded HBM', 'block churn'],
        ['repeat prefill', 'low hit rate'],
        ['memory bytes', 'quality loss'],
        ['serial steps', 'draft mismatch'],
      ],
    ),
    highlight: { active: ['batch:saves', 'paging:saves', 'prefix:saves', 'quant:saves', 'spec:saves'] },
    explanation: 'A lever has a target and a failure mode. Continuous batching improves occupancy but can raise tail latency. Prefix caching saves repeated prompt work only when workloads share prefixes. Speculation helps when the draft model predicts accepted tokens.',
    invariant: 'Measure the phase before choosing the lever.',
  };

  yield {
    state: stackGraph('KV cache is the concurrency budget'),
    highlight: { active: ['prefill', 'kv', 'decode', 'prefix', 'e-prefill-kv', 'e-kv-decode', 'e-prefix-kv'], compare: ['batch'] },
    explanation: 'The KV cache turns context into live GPU memory. PagedAttention reduces fragmentation, prefix caching avoids recomputing shared context, and KV quantization can raise concurrency if quality and kernels cooperate.',
  };

  yield {
    state: labelMatrix(
      'Cost accounting columns',
      [
        { id: 'ttft', label: 'TTFT' },
        { id: 'tpot', label: 'TPOT' },
        { id: 'throughput', label: 'tokens/s' },
        { id: 'dollars', label: 'dollars' },
      ],
      [
        { id: 'mostly', label: 'mostly sees' },
        { id: 'common miss', label: 'common miss' },
      ],
      [
        ['prefill plus queue', 'ignore prompt reuse'],
        ['decode memory path', 'only tune kernels'],
        ['batch and occupancy', 'hide p99'],
        ['all phases plus idle', 'ignore utilization'],
      ],
    ),
    highlight: { active: ['ttft:mostly', 'tpot:mostly', 'throughput:mostly', 'dollars:mostly'] },
    explanation: 'Good cost reporting separates time to first token, time per output token, aggregate throughput, tail latency, and dollars per useful task. One average hides too much.',
  };
}

function* workloadFit() {
  yield {
    state: labelMatrix(
      'Workload to lever fit',
      [
        { id: 'chat', label: 'short chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agents' },
        { id: 'batch', label: 'batch jobs' },
      ],
      [
        { id: 'best', label: 'best levers' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['batch and quant', 'stream p99'],
        ['prefix and prefill', 'cache hits'],
        ['paged KV and tracing', 'long state'],
        ['large batches', 'throughput only'],
      ],
    ),
    highlight: { found: ['chat:best', 'rag:best', 'agent:best', 'batch:best'] },
    explanation: 'Different products want different optimizers. A chat UI needs smooth streaming. RAG cares about prefill reuse and context packing. Agents care about long state and restart cost. Offline jobs care about throughput per dollar.',
  };

  yield {
    state: stackGraph('Agent workloads stress state more than math'),
    highlight: { active: ['request', 'prefill', 'kv', 'decode', 'prefix', 'batch', 'e-prefill-kv', 'e-prefix-kv', 'e-batch-decode'], compare: ['spec'] },
    explanation: 'Long-context and agentic workloads keep more tokens resident, revisit shared prefixes, and generate tool traces. Their cost problem is often state residency and recompute, not only raw matmul speed.',
  };

  yield {
    state: labelMatrix(
      'Do not optimize in isolation',
      [
        { id: 'quant', label: 'quant' },
        { id: 'spec', label: 'spec' },
        { id: 'prefix', label: 'prefix' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'needs', label: 'needs' },
      ],
      [
        ['fewer bytes', 'quality eval'],
        ['fewer steps', 'accept rate'],
        ['less prefill', 'stable prompts'],
        ['higher use', 'latency budget'],
      ],
    ),
    highlight: { active: ['quant:needs', 'spec:needs', 'prefix:needs', 'batch:needs'] },
    explanation: 'Every serving optimization has a companion measurement. Quantization needs quality evals. Speculation needs acceptance rate. Prefix caching needs cache-hit reporting. Batching needs p95 and p99 latency.',
  };

  yield {
    state: labelMatrix(
      'Production decision rule',
      [
        { id: 'phase', label: 'phase' },
        { id: 'lever', label: 'lever' },
        { id: 'slice', label: 'slice' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['where is the wall?', 'TTFT/TPOT profile'],
        ['what does it trade?', 'lever map'],
        ['who gets slower?', 'latency slices'],
        ['how to undo?', 'canary gate'],
      ],
    ),
    highlight: { found: ['phase:artifact', 'lever:artifact', 'slice:artifact', 'rollback:artifact'] },
    explanation: 'The practical workflow is profile, choose a lever, measure by workload slice, and canary. Inference cost is a control-plane problem as much as a kernel problem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cost levers') yield* costLevers();
  else if (view === 'workload fit') yield* workloadFit();
  else throw new InputError('Pick an LLM inference cost view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The LLM inference cost stack is a phase map for serving a model cheaply without breaking user latency. Transformer Inference Roofline explains the core split: prefill is often compute-heavy, while decode is often memory-bound. This case study adds the deployment view: batching, PagedAttention, prefix caching, quantization, kernel fusion, and Speculative Decoding each attach to a different bottleneck.',
        'The practical question is not "which trick is best?" It is "which phase dominates this workload, and what risk does the lever introduce?" A short chat product, an enterprise RAG Pipeline, a coding agent, and an offline summarization batch can all run the same model and need different serving choices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request first waits in an admission and scheduling layer. LLM Serving Admission-Control Goodput Gate decides whether the request can still complete before deadline given token budget, KV pressure, queue age, and fallback options. Prefill processes the prompt and builds KV Cache state. Transformer Layer FLOPs Cost Model explains the prompt-side arithmetic, while KV Cache Concurrency Capacity Model explains how the same prompt becomes resident memory. Decode streams one token at a time while reading weights and cache. LLM Continuous Batching admits and removes requests at iteration boundaries so the GPU stays occupied. Chunked Prefill Token Budget Scheduler protects decode by slicing long prompt work into bounded prefill chunks. LLM Serving: PagedAttention stores KV cache in blocks so memory fragmentation does not waste HBM. Prefix Caching & RadixAttention reuses shared prompt prefixes instead of recomputing them. Prefill/Decode Disaggregation Case Study separates the two phases across pools when interference becomes the bottleneck, KV Cache Transfer Fabric Case Study explains the remote block maps, connectors, and transfer gates needed to make that split real, KV Cache Tiered Offload Store Case Study shows how cold blocks can move through GPU, CPU, SSD, and remote tiers before becoming recompute misses, and SLO-Aware LLM Request Router decides which replica or pool should receive the request in the first place.',
        'Quantization reduces bytes for weights and sometimes cache, moving memory-bound decode in the right direction. Grouped-Query Attention reduces stored K/V heads, and Sliding-Window Attention Context Policy bounds old-token attention when the product can tolerate a local context policy. Inference Kernel Fusion & CUDA Graphs reduce launch overhead and unnecessary memory traffic. Speculative decoding uses a draft model or draft heads to propose several tokens, then verifies them with the target model. It helps when the acceptance rate is high enough to offset draft overhead.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost accounting needs more columns than average tokens per second. Time to first token sees queueing and prefill. Time per output token sees decode. Aggregate throughput sees batching and occupancy. Tail latency sees scheduler fairness, long prompts, and outliers. Dollars per task sees all of those plus idle GPU time, cache misses, failed generations, retries, and quality regressions.',
        'Every lever has a companion risk. Continuous batching can improve throughput while hurting p99. Prefix caching can look great on templated workloads and do almost nothing on ad hoc prompts. Quantization can lower cost while degrading rare tasks. Speculation can slow down if the draft model disagrees too often. Paged KV cache helps residency but still needs eviction policy when live tokens exceed memory. Tiered offload can save GPU memory, but only if promotion latency, serialization format, and spill bandwidth stay inside the time-to-first-token budget. Routing can improve locality, but a hot cache on an overloaded replica can still be the expensive route. Autoscaling can add capacity, but LLM Serving Autoscaling Warm Pool shows why model-load delay, GPU placement, warm floors, and cold KV locality decide whether that capacity arrives in time.',
        'There is also an application-layer lever: Semantic Cache for LLMs. It does not reuse KV state inside the model server. It reuses whole answers when a new prompt is close enough to a previously answered prompt and passes metadata, freshness, authorization, and retrieval-version gates. LLM Response Cache Safety Ledger turns that idea into the full production control plane: canonical keys, version clocks, policy denies, admission rules, and route audit. That makes response caching powerful for repetitive support and FAQ workloads, but risky when answers are personalized or rapidly changing.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'vLLM introduced PagedAttention to manage KV cache with paging-style blocks and improve serving throughput: https://arxiv.org/abs/2309.06180. SGLang introduces RadixAttention for automatic KV cache reuse across structured generation programs: https://arxiv.org/abs/2312.07104. Speculative decoding proposes a lossless way to accelerate sampling by drafting and verifying tokens: https://arxiv.org/abs/2211.17192. AWQ is a representative weight-quantization source focused on activation-aware low-bit LLM compression: https://arxiv.org/abs/2306.00978.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Short chat workloads often start with batching, quantization, and p99 guardrails. Repetitive FAQ workloads can add Semantic Cache for LLMs and LLM Response Cache Safety Ledger if false-hit risk is controlled. RAG workloads care about prompt packing, prefix reuse, semantic answer reuse, corpus-version invalidation, and time to first token. Agentic AI Patterns: Planning, Tools, Memory creates long traces and repeated tool context, so KV residency and cache reuse become economic constraints. Offline batch jobs can push larger batches and prioritize throughput per dollar over streaming smoothness. On-Device LLM Inference Cost Crossover adds the product-level decision: some bounded, private, or ambient tasks may be cheaper and safer on user hardware, while harder or longer tasks still route to cloud.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not optimize inference by copying a benchmark configuration blindly. A leaderboard throughput number may use long batches, fixed prompts, no streaming pressure, and no tail-latency target. Do not assume quantization or speculation is free. Do not optimize prefill when users are complaining about token streaming. Do not optimize decode when the product actually waits on retrieval or tool calls. Profile the phase, then pick the lever.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM at https://arxiv.org/abs/2309.06180, SGLang at https://arxiv.org/abs/2312.07104, DistServe at https://arxiv.org/abs/2401.09670, Speculative Decoding at https://arxiv.org/abs/2211.17192, AWQ at https://arxiv.org/abs/2306.00978, and Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102. Study Transformer Layer FLOPs Cost Model, Transformer Inference Roofline, KV Cache, KV Cache Concurrency Capacity Model, LLM Serving Admission-Control Goodput Gate, LLM Serving Autoscaling Warm Pool, Chunked Prefill Token Budget Scheduler, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, Grouped-Query Attention, Sliding-Window Attention Context Policy, LLM Continuous Batching, Length-Aware Batching for LLM Serving, LLM Serving: PagedAttention, Prefill/Decode Disaggregation Case Study, Prefix Caching & RadixAttention, Semantic Cache for LLMs, LLM Response Cache Safety Ledger, Inference Kernel Fusion & CUDA Graphs, CUDA Graph Shape Cache, Quantization, Speculative Decoding, Chain of Draft Reasoning Token Budget Case Study, LLM Unit Economics Ledger Case Study, LLM Inference Scaling Playbook, On-Device LLM Inference Cost Crossover, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
