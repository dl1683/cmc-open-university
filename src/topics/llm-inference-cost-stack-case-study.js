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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for LLM Inference Cost Stack Case Study. A phase-by-phase map of inference cost levers: batching, paged KV cache, prefix reuse, quantization, kernels, and speculation..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "Inference cost falls only when each optimization is attached to the specific phase and workload shape it actually improves."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM inference costs money because each request consumes scarce accelerator time, high-bandwidth memory, network bandwidth, cache state, and scheduler attention. A model server is not only running matrix multiplication. It is admitting requests, batching them, processing prompts, storing KV cache, streaming output tokens, handling retries, and deciding which work deserves priority before a deadline expires.',
        'The cost stack exists because the expensive phase changes by workload. Short chat often cares about smooth streaming and p99 latency. RAG often cares about prompt-side work, shared prefixes, retrieval delay, and context packing. Coding agents keep long traces alive and revisit similar state. Offline summarization cares more about throughput per dollar than time to first token. The same model can need different serving choices in each product.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to chase one headline number: tokens per second. If throughput rises, the system looks cheaper. That approach is useful for early benchmarking, but it hides the user experience and the resource bill. A server can have excellent aggregate throughput while chat users wait too long for the first token. Another server can stream smoothly while leaving GPUs idle between small requests.',
        'A second obvious approach is to copy a benchmark configuration: turn on batching, quantization, prefix caching, or speculative decoding because a paper or vendor report showed a win. That also fails. Each optimization is a trade. It helps one phase, one resource, or one workload shape, and it can hurt another. The right question is not which lever is fashionable. The right question is which phase is the wall for this traffic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is phase fit. Every inference optimization should be attached to the phase, resource, and workload shape it improves. Batching is mostly an occupancy lever. Paged KV is mostly a memory-fragmentation and concurrency lever. Prefix caching is a repeated-prefill lever. Quantization is a byte and bandwidth lever. Kernel fusion and CUDA graphs reduce overhead and memory traffic. Speculation reduces serial decode steps only when the draft model predicts tokens that the target model accepts.',
        'The invariant is: measure the phase before choosing the lever. Queueing, prefill, KV residency, decode, routing, and output streaming should be reported separately. Otherwise a team can optimize decode while users are waiting on retrieval, or optimize prompt prefill while the real bill is idle GPU time caused by poor batching.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request first enters routing and admission. The system estimates prompt tokens, output budget, deadline, model choice, tenant priority, KV pressure, and fallback options. LLM Serving Admission-Control Goodput Gate is the related topic: a request is not useful if it is accepted into a queue where it will miss its service objective.',
        'Prefill processes the prompt and writes KV cache state. Transformer Layer FLOPs Cost Model explains the prompt-side arithmetic, while Transformer Inference Roofline explains why prefill and decode stress hardware differently. Decode then streams one token at a time, repeatedly reading weights and KV state. KV Cache Concurrency Capacity Model explains why live context becomes the concurrency budget. LLM Continuous Batching admits and removes requests at iteration boundaries so the accelerator stays occupied while individual users receive streams.',
        'Several topics deepen this pipeline. Chunked Prefill Token Budget Scheduler slices long prompts so prefill does not block decode. LLM Serving: PagedAttention stores KV in blocks so fragmentation does not waste HBM. Prefix Caching and RadixAttention reuses shared prompt prefixes. Prefill/Decode Disaggregation splits phase-specific work across pools. KV Cache Transfer Fabric and KV Cache Tiered Offload Store show what must exist when state moves between GPU, CPU, SSD, and remote tiers.',
      ],
    },
    {
      heading: 'Lever map',
      paragraphs: [
        'Continuous batching raises accelerator occupancy by grouping active decode steps from different requests. The risk is queueing and tail latency. Prefix caching saves prefill work when prompts share stable prefixes. The risk is low hit rate, stale policy, or unsafe reuse across tenants. Paged KV raises usable concurrency by reducing memory fragmentation. The risk is block churn, eviction pressure, and extra bookkeeping when context lengths vary widely.',
        'Quantization reduces bytes for weights and sometimes KV cache. It helps memory-bound decode and can reduce serving cost, but it needs quality evaluation by task slice. Kernel fusion and CUDA graphs reduce launch overhead and repeated memory traffic, especially when shapes are stable enough. Speculative decoding uses a draft model or draft heads to propose several tokens and asks the target model to verify them. It helps when accepted tokens per verification step exceed the overhead of drafting.',
        'Application-level caching is a separate layer. Semantic Cache for LLMs reuses whole responses when a new prompt is close enough to a previous prompt and passes metadata, freshness, authorization, and retrieval-version gates. It does not reuse KV state inside the model server. LLM Response Cache Safety Ledger turns that idea into a production control plane with canonical keys, version clocks, deny reasons, and audit records.',
      ],
    },
    {
      heading: 'KV cache as the budget',
      paragraphs: [
        'For long-context and agentic workloads, KV cache is often the real concurrency limit. Each live token consumes key and value state across layers. More context means fewer concurrent requests before HBM fills. A server can have spare compute and still reject requests because memory is full. That is why KV block layout, eviction, prefix reuse, offload, and transfer policy matter as much as raw FLOPs.',
        'This also explains why state locality changes routing. If a request resumes an agent trace, the cheapest replica may be the one that already holds the relevant KV blocks. But locality is not absolute. A cache-warm replica that is overloaded may still be slower than a cache-cold replica that can prefill quickly. SLO-Aware LLM Request Router exists because routing is a multi-objective decision: locality, queue age, tenant priority, model availability, deadline, and fallback quality all matter.',
      ],
    },
    {
      heading: 'Workload fit',
      paragraphs: [
        'Short chat workloads usually start with batching, quantization, and strict p95 or p99 guardrails. Repetitive support and FAQ workloads may add semantic response caching if false-hit risk is controlled. RAG workloads care about prompt packing, retrieval latency, prefix reuse, corpus-version invalidation, and time to first token. Agentic AI Patterns: Planning, Tools, Memory creates long traces and repeated tool context, so KV residency and resume cost become economic constraints.',
        'Offline batch jobs can push larger batches and favor throughput per dollar over streaming smoothness. On-Device LLM Inference Cost Crossover adds a product-level choice: some bounded, private, or ambient tasks may be cheaper and safer on user hardware, while harder or longer tasks still route to cloud. The cost stack is not only a server optimization map; it is a product architecture map.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'A serious deployment should report queue age, admission rejects, time to first token, inter-token latency, output tokens per second, prefill tokens per second, decode batch size, KV bytes resident, cache hit rate, eviction rate, prefix reuse, quantization quality slices, speculative acceptance length, GPU utilization, HBM pressure, retry rate, fallback use, and dollars per successful task.',
        'Report those metrics by workload class, not only globally. RAG prompts, coding-agent traces, short chat, long summarization, and offline batch jobs exercise different parts of the stack. A single average hides which users are subsidizing the system and which users are breaking it. Tail Latency and p99 Thinking is the right companion topic because inference optimizations often move the tail before they move the mean.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Build the system around profiles and gates. First, measure the baseline by phase and workload. Second, pick one lever that targets the measured wall. Third, canary it by tenant, prompt length, output length, and product surface. Fourth, compare cost, p99, quality, reject rate, and rollback signals. A lever that lowers aggregate cost while hurting a high-value slice may be a bad release.',
        'Keep the control-plane artifacts explicit. Store model version, quantization recipe, kernel configuration, batching policy, prefix-cache key rules, KV block size, offload policy, routing policy, admission thresholds, and fallback behavior. These settings are part of the serving contract. Without versioned configuration, a cost win cannot be reproduced or debugged.',
        'Plan for rollback. Quantization needs a quality gate. Speculation needs an acceptance-rate gate. Prefix caching needs a safety and hit-rate gate. Batching needs a latency gate. Semantic response caching needs freshness, authorization, and source-version gates. Each optimization should have a companion measurement that can turn it off.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Cost accounting needs more columns than average tokens per second. Time to first token sees queueing, routing, retrieval, and prefill. Time per output token sees decode. Aggregate throughput sees batching and occupancy. Tail latency sees scheduler fairness, long prompts, stragglers, and outliers. Dollars per useful task sees all of those plus idle GPU time, cache misses, failed generations, retries, fallbacks, and quality regressions.',
        'Every lever has a companion risk. Continuous batching can raise throughput while hurting p99. Prefix caching can look good on templated workloads and do little on ad hoc prompts. Quantization can lower cost while degrading rare tasks. Speculation can slow down if the draft model disagrees too often. Tiered offload can save HBM only if promotion latency and bandwidth stay within the time-to-first-token budget. Autoscaling can add GPUs too late if model-load delay and warm-cache state were ignored.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The stack fails when teams apply a lever to the wrong bottleneck. Speculative decoding helps only when draft overhead is lower than the verified tokens it saves. Prefix caching helps only when prompts share stable prefixes and authorization permits reuse. Quantization helps only if quality and rare-slice behavior survive. Paged KV helps memory residency but cannot make unlimited context free.',
        'The most expensive failures are cross-layer. A router can send traffic to the cache-warm replica that is already overloaded. A semantic cache can return a stale answer because corpus versioning was not part of the key. An autoscaler can add GPUs too late because warm capacity was not kept alive. A benchmark can show low cost because it excludes failed generations, retries, retrieval, or safety filters. Inference cost is a stack because the failure modes stack too.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: vLLM at https://arxiv.org/abs/2309.06180, SGLang at https://arxiv.org/abs/2312.07104, DistServe at https://arxiv.org/abs/2401.09670, Speculative Decoding at https://arxiv.org/abs/2211.17192, AWQ at https://arxiv.org/abs/2306.00978, and Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102.',
        'Study Transformer Layer FLOPs Cost Model, Transformer Inference Roofline, KV Cache, KV Cache Concurrency Capacity Model, LLM Serving Admission-Control Goodput Gate, LLM Serving Autoscaling Warm Pool, Chunked Prefill Token Budget Scheduler, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, Grouped-Query Attention, Sliding-Window Attention Context Policy, LLM Continuous Batching, Length-Aware Batching for LLM Serving, LLM Serving: PagedAttention, Prefill/Decode Disaggregation Case Study, Prefix Caching and RadixAttention, Semantic Cache for LLMs, LLM Response Cache Safety Ledger, Inference Kernel Fusion and CUDA Graphs, CUDA Graph Shape Cache, Quantization, Speculative Decoding, Chain of Draft Reasoning Token Budget Case Study, LLM Unit Economics Ledger Case Study, LLM Inference Scaling Playbook, On-Device LLM Inference Cost Crossover, and Tail Latency and p99 Thinking next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why LLM Inference Cost Stack Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

