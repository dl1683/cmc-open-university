// LLM inference scaling playbook: organize serving levers into tiers, route
// budget by workload, and exit only when quality, cost, and p99 all hold.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-inference-scaling-playbook-case-study',
  title: 'LLM Inference Scaling Playbook',
  category: 'Systems',
  summary: 'A tiered playbook for LLM inference scaling: continuous batching, KV optimization, multi-token decoding, verifiers, placement, and exit metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tier ladder', 'budget router'], defaultValue: 'tier ladder' },
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

function ladderGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.7, note: 'workload' },
      { id: 'profile', label: 'profile', x: 2.3, y: 3.7, note: 'phase mix' },
      { id: 'tier1', label: 'tier 1', x: 4.0, y: 2.0, note: 'util+KV' },
      { id: 'tier2', label: 'tier 2', x: 4.0, y: 3.7, note: 'decode' },
      { id: 'tier3', label: 'tier 3', x: 4.0, y: 5.4, note: 'verify' },
      { id: 'topo', label: 'topology', x: 6.1, y: 3.7, note: 'placement' },
      { id: 'metrics', label: 'metrics', x: 8.2, y: 3.7, note: 'p99+cost' },
      { id: 'exit', label: 'exit', x: 9.5, y: 3.7, note: 'stable' },
    ],
    edges: [
      { id: 'e-request-profile', from: 'request', to: 'profile' },
      { id: 'e-profile-tier1', from: 'profile', to: 'tier1' },
      { id: 'e-profile-tier2', from: 'profile', to: 'tier2' },
      { id: 'e-profile-tier3', from: 'profile', to: 'tier3' },
      { id: 'e-tier1-topo', from: 'tier1', to: 'topo' },
      { id: 'e-tier2-topo', from: 'tier2', to: 'topo' },
      { id: 'e-tier3-topo', from: 'tier3', to: 'topo' },
      { id: 'e-topo-metrics', from: 'topo', to: 'metrics' },
      { id: 'e-metrics-exit', from: 'metrics', to: 'exit' },
    ],
  }, { title });
}

function routerGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.7, note: 'task' },
      { id: 'policy', label: 'policy', x: 2.3, y: 3.7, note: 'budget' },
      { id: 'cache', label: 'cache', x: 4.1, y: 1.6, note: 'hit' },
      { id: 'local', label: 'local', x: 4.1, y: 3.2, note: 'small' },
      { id: 'cloud', label: 'cloud', x: 4.1, y: 4.8, note: 'strong' },
      { id: 'verify', label: 'verify', x: 6.3, y: 4.8, note: 'score' },
      { id: 'answer', label: 'answer', x: 8.4, y: 3.7, note: 'guarded' },
    ],
    edges: [
      { id: 'e-prompt-policy', from: 'prompt', to: 'policy' },
      { id: 'e-policy-cache', from: 'policy', to: 'cache', weight: 'repeat' },
      { id: 'e-policy-local', from: 'policy', to: 'local', weight: 'easy' },
      { id: 'e-policy-cloud', from: 'policy', to: 'cloud', weight: 'hard' },
      { id: 'e-cloud-verify', from: 'cloud', to: 'verify' },
      { id: 'e-cache-answer', from: 'cache', to: 'answer' },
      { id: 'e-local-answer', from: 'local', to: 'answer' },
      { id: 'e-verify-answer', from: 'verify', to: 'answer' },
    ],
  }, { title });
}

function* tierLadder() {
  yield {
    state: ladderGraph('Inference scaling should be tiered'),
    highlight: { active: ['request', 'profile', 'tier1', 'tier2', 'tier3'], found: ['metrics', 'exit'] },
    explanation: 'Inference scaling is not one trick. Profile the workload, then apply tiers: utilization and KV state first, decode-step reduction second, and verifier/topology/control-plane economics third.',
    invariant: 'Do not spend on a higher tier before measuring the lower-tier bottleneck.',
  };

  yield {
    state: labelMatrix(
      'Tier ladder',
      [
        { id: 'batch', label: 'batching' },
        { id: 'kv', label: 'KV state' },
        { id: 'kernel', label: 'kernels' },
        { id: 'decode', label: 'decode' },
        { id: 'verify', label: 'verifiers' },
        { id: 'topo', label: 'topology' },
      ],
      [
        { id: 'lever', label: 'lever' },
        { id: 'exit', label: 'exit metric' },
      ],
      [
        ['continuous', 'GPU busy'],
        ['paged+reuse', 'hit rate'],
        ['fusion', 'TTFT down'],
        ['multi-token', 'TPOT down'],
        ['prune/rerank', 'bad paths cut'],
        ['co-locate', 'p99 stable'],
      ],
    ),
    highlight: { active: ['batch:lever', 'kv:lever', 'decode:lever'], found: ['topo:exit'] },
    explanation: 'Each tier has a lever and an exit metric. Continuous batching should improve utilization without p99 damage. KV work should raise concurrency or hit rate. Multi-token decoding should reduce time per output token. Topology should stabilize p99.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'optimization stage', min: 0, max: 4 }, y: { label: 'relative value', min: 0, max: 100 } },
      series: [
        { id: 'throughput', label: 'tokens/sec', points: [{ x: 0, y: 25 }, { x: 1, y: 55 }, { x: 2, y: 72 }, { x: 3, y: 82 }, { x: 4, y: 88 }] },
        { id: 'p99', label: 'p99 health', points: [{ x: 0, y: 35 }, { x: 1, y: 55 }, { x: 2, y: 70 }, { x: 3, y: 68 }, { x: 4, y: 85 }] },
        { id: 'cost', label: 'cost/task', points: [{ x: 0, y: 85 }, { x: 1, y: 62 }, { x: 2, y: 48 }, { x: 3, y: 42 }, { x: 4, y: 35 }] },
      ],
    }),
    highlight: { active: ['throughput', 'p99'], found: ['cost'] },
    explanation: 'This conceptual plot shows why one metric is dangerous. Throughput can improve while p99 gets worse. Cost per task can fall only after cache hits, routing, and output-length controls are included.',
  };

  yield {
    state: labelMatrix(
      'Phase-to-lever map',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'context', label: 'context' },
        { id: 'quality', label: 'quality' },
        { id: 'network', label: 'network' },
      ],
      [
        { id: 'wall', label: 'wall' },
        { id: 'lever', label: 'lever' },
      ],
      [
        ['compute/queue', 'chunk+disagg'],
        ['memory loop', 'spec/multi'],
        ['KV bytes', 'window+reuse'],
        ['bad paths', 'verifier'],
        ['cross hops', 'co-locate'],
      ],
    ),
    highlight: { active: ['prefill:lever', 'decode:lever', 'context:lever'], found: ['network:lever'] },
    explanation: 'The right lever is phase-specific. Prefill has queue and compute shape. Decode has serial memory-bound shape. Long context is KV state. Verifier scaling is quality-budget routing. Topology is cross-hop control.',
  };

  yield {
    state: ladderGraph('Exit requires quality, latency, and cost together'),
    highlight: { active: ['metrics', 'exit', 'e-metrics-exit'], found: ['tier1', 'tier2', 'tier3'], compare: ['profile'] },
    explanation: 'The playbook exits only when invalid outputs are controlled, cache hit rate is useful, p99 is stable, output tokens per task fall, and cost per accepted answer improves. Otherwise the system has only moved the bottleneck.',
  };
}

function* budgetRouter() {
  yield {
    state: routerGraph('Inference scaling becomes a budget router'),
    highlight: { active: ['prompt', 'policy', 'cache', 'local', 'cloud', 'verify'], found: ['answer'] },
    explanation: 'At product scale, inference scaling is a routing problem. The system decides how much compute, cache, verifier budget, and cloud strength each request deserves.',
  };

  yield {
    state: labelMatrix(
      'Spend decision',
      [
        { id: 'repeat', label: 'repeat' },
        { id: 'easy', label: 'easy' },
        { id: 'hard', label: 'hard' },
        { id: 'risk', label: 'high risk' },
        { id: 'long', label: 'long ctx' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['cache', 'same intent'],
        ['local/small', 'low risk'],
        ['cloud', 'quality'],
        ['verify', 'needs proof'],
        ['RAG+pack', 'state cost'],
      ],
    ),
    highlight: { active: ['repeat:route', 'easy:route', 'risk:route'], found: ['long:reason'] },
    explanation: 'A router can spend less on repeated or easy tasks and more on high-risk or hard tasks. The decision should be explicit and logged, not hidden in scattered application branches.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'extra inference budget', min: 0, max: 10 }, y: { label: 'answer success', min: 0, max: 1 } },
      series: [
        { id: 'plain', label: 'plain', points: [{ x: 0, y: 0.62 }, { x: 2, y: 0.63 }, { x: 5, y: 0.63 }, { x: 10, y: 0.63 }] },
        { id: 'bestof', label: 'best-of', points: [{ x: 0, y: 0.62 }, { x: 2, y: 0.70 }, { x: 5, y: 0.76 }, { x: 10, y: 0.78 }] },
        { id: 'verify', label: 'verifier', points: [{ x: 0, y: 0.62 }, { x: 2, y: 0.73 }, { x: 5, y: 0.82 }, { x: 10, y: 0.87 }] },
      ],
      markers: [
        { id: 'knee', x: 5, y: 0.82, label: 'budget knee' },
      ],
    }),
    highlight: { active: ['verify', 'knee'], compare: ['plain'], found: ['bestof'] },
    explanation: 'Extra inference budget should have a curve. If best-of sampling or verifier search stops improving after a knee, cap the budget and spend the next dollar on data, routing, or UX.',
  };

  yield {
    state: labelMatrix(
      'Verifier economics',
      [
        { id: 'stop', label: 'terminate' },
        { id: 'rank', label: 'rerank' },
        { id: 'repair', label: 'repair' },
        { id: 'human', label: 'human' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['bad branch', 'false stop'],
        ['many paths', 'judge bias'],
        ['fix trace', 'looping'],
        ['high stakes', 'slow+costly'],
      ],
    ),
    highlight: { active: ['stop:use', 'rank:use', 'repair:use'], compare: ['human:risk'] },
    explanation: 'Verifiers are an inference-scaling lever because they decide where more generation is worth it. They can terminate, rerank, repair, or escalate. But verifier errors get amplified by search.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'user', label: 'user', x: 0.8, y: 3.7, note: 'request' },
        { id: 'edge', label: 'edge', x: 2.5, y: 3.7, note: 'route' },
        { id: 'llm', label: 'LLM', x: 4.5, y: 2.4, note: 'tokens' },
        { id: 'vec', label: 'vector DB', x: 4.5, y: 5.1, note: 'evidence' },
        { id: 'rack', label: 'same rack', x: 6.7, y: 3.7, note: 'low hop' },
        { id: 'p99', label: 'p99', x: 8.7, y: 3.7, note: 'watch' },
      ],
      edges: [
        { id: 'e-user-edge', from: 'user', to: 'edge' },
        { id: 'e-edge-llm', from: 'edge', to: 'llm' },
        { id: 'e-edge-vec', from: 'edge', to: 'vec' },
        { id: 'e-llm-rack', from: 'llm', to: 'rack' },
        { id: 'e-vec-rack', from: 'vec', to: 'rack' },
        { id: 'e-rack-p99', from: 'rack', to: 'p99' },
      ],
    }, { title: 'Placement is an inference-scaling lever' }),
    highlight: { active: ['llm', 'vec', 'rack', 'p99'], found: ['edge'] },
    explanation: 'Model/data co-location matters. A RAG product can lose p99 to cross-rack retrieval hops even when the model server is optimized. Topology is invisible until it dominates the tail.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'invalid', label: 'invalid out' },
        { id: 'cache', label: 'bad cache' },
        { id: 'branch', label: 'branch blowup' },
        { id: 'topo', label: 'topology' },
        { id: 'lock', label: 'lock-in' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['wasted calls', 'schema gate'],
        ['false hit', 'freshness'],
        ['cost spike', 'budget cap'],
        ['p99 spike', 'placement'],
        ['one vendor', 'route ledger'],
      ],
    ),
    highlight: { active: ['invalid:control', 'branch:control', 'topo:control'], compare: ['lock:symptom'] },
    explanation: 'The final tier is not more raw decoding. It is cutting wasted inference, preventing false cache hits, bounding search, placing services correctly, and keeping route decisions portable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tier ladder') yield* tierLadder();
  else if (view === 'budget router') yield* budgetRouter();
  else throw new InputError('Pick an inference-scaling playbook view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        `Training creates a model, but serving buys every answer one request at a time. Each answer spends accelerator memory, memory bandwidth, scheduler capacity, network hops, cache state, and sometimes verifier calls. LLM inference scaling is the work of getting more accepted answers per dollar and second without breaking quality.`,
        `This playbook exists because LLM serving is not one bottleneck. A chat product, code assistant, RAG workflow, and batch summarizer can fail for different reasons. The useful habit is to profile the request mix, pick the lowest tier that attacks the current wall, and exit only when latency, quality, and cost improve together.`,
        {type: `callout`, text: `A scaling playbook works by spending the lowest effective tier of serving complexity and exiting only when quality, latency, and cost improve together.`},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is to buy more GPUs and add every optimization that sounds relevant: bigger batches, quantization, KV cache tricks, speculative decoding, model routing, semantic caching, and verifier search. Some of those tools are valuable, but stacking them blindly makes the system harder to explain.`,
        `Another obvious approach is to maximize throughput. Tokens per second is easy to graph, so teams often treat it as the goal. That misses the product constraint. A change can raise throughput while p99 latency gets worse, invalid outputs rise, output length grows, or cache hits become unsafe.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `LLM inference has two very different phases. Prefill processes the prompt and builds KV state. Decode then generates output token by token, repeatedly reading model weights and KV state. Long prompts, long outputs, and many concurrent users stress different parts of the system.`,
        `The wall appears when one lever improves one metric and damages another. Larger batches can raise utilization while hurting tail latency. More verifier search can improve quality while multiplying cost. Aggressive cache reuse can cut latency while serving stale or cross-user answers. A playbook is needed because local wins can move the bottleneck rather than solve it.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `The invariant is simple: do not spend on a higher tier before measuring the lower-tier bottleneck. Tier 1 is utilization and state: batching, KV allocation, cache reuse, quantization, and phase scheduling. Tier 2 reduces decode work per accepted token. Tier 3 decides which requests deserve extra model, cache, verifier, or topology budget.`,
        `Each tier needs an exit metric. Batching should improve utilization without p99 damage. KV work should raise concurrency or hit rate without unsafe reuse. Multi-token decoding should reduce time per accepted output token. Verifiers and routers should lower cost per accepted answer, not just add more calls.`,
      ],
    },
    {
      heading: 'Tier 1: Utilization And State',
      paragraphs: [
        `Tier 1 asks whether the serving engine is wasting hardware or memory. Orca's iteration-level scheduling is the classic lesson: schedule generation at token-iteration granularity so requests can enter and leave batches dynamically. That attacks idle work caused by request-level batching.`,
        `KV state is the other Tier 1 pressure. PagedAttention and vLLM treat KV cache memory more like paged memory, reducing fragmentation and enabling larger effective batches. Prefill/decode disaggregation, as in DistServe, separates phases with different resource profiles so time to first token and time per output token can be optimized under separate constraints.`,
      ],
    },
    {
      heading: 'Tier 2: Fewer Decode Steps',
      paragraphs: [
        `Tier 2 attacks the autoregressive loop. A normal decoder produces one token, feeds it back, and repeats. That loop is hard to parallelize because each token depends on previous tokens. Reducing the number of expensive target-model passes can cut latency when acceptance is high enough.`,
        `Speculative decoding uses a cheaper draft path and verifies proposed tokens with the target model. Medusa adds extra decoding heads and tree attention to propose multiple future tokens. Lookahead decoding explores exact parallel decoding without a separate draft model. LayerSkip-style self-speculation uses earlier layers for draft behavior and later layers for verification. These methods are not interchangeable; each has training, acceptance, batching, and quality constraints.`,
      ],
    },
    {
      heading: 'Tier 3: Routing And Verification',
      paragraphs: [
        `Tier 3 treats inference as a budget router. A repeated low-risk request may deserve a cache hit. A short easy task may deserve a small local model. A high-risk answer may deserve a stronger model, retrieval, verifier search, or human escalation. The decision should be explicit and logged.`,
        `Verifiers are inference-scaling tools because they decide which branches deserve more generation. They can terminate bad paths, rerank candidates, trigger repair, or escalate. They can also amplify their own mistakes. A weak verifier inside a wide search can make the system confidently prefer bad answers.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The tier ladder proves ordering. The request is profiled before a lever is selected. The tiers feed into topology and metrics before the system exits. The metrics node is not decorative; it is the gate that prevents a throughput win from hiding a quality or p99 loss.`,
        `The budget-router view proves that scaling is a control-plane problem, not only a kernel problem. Repeated, easy, hard, risky, and long-context requests should not all spend the same budget. Route reason, model version, cache key, verifier use, and rollback path are part of the serving state.`,
      ],
    },
    {
      heading: 'Why The Playbook Works',
      paragraphs: [
        `Tiering works because it matches interventions to the phase that is actually constrained. If the GPU is idle, decode tricks are premature. If KV memory is the limiter, more scheduler cleverness may not help. If the product wastes output tokens on bad paths, kernels alone will not lower accepted-answer cost.`,
        `The playbook also keeps the feedback loop honest. Every tier asks for a before-and-after metric tied to the bottleneck. That does not guarantee success, but it prevents the common failure where a team celebrates one graph while the user-visible system gets slower, more expensive, or less reliable.`,
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        `Tier 1 often gives the cleanest wins, but it can add scheduler complexity and sharper p99 tradeoffs. Better batching increases utilization, yet large or unfair batches can delay small requests. KV cache reuse saves memory and compute, yet unsafe reuse can leak freshness, tenant, or prompt-boundary bugs.`,
        `Tier 2 can reduce decode latency, but it depends on acceptance rate and integration cost. A draft path that is cheap but rarely accepted wastes work. Extra heads or early exits may require training changes. Tier 3 can improve cost and quality, but a router or verifier becomes another production system with logs, tests, rollbacks, and failure policies.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `The playbook wins in products with mixed request shapes. A support bot has repeated questions, long-context escalations, easy classification tasks, and high-risk policy answers. Treating those requests identically wastes budget. Routing lets the product spend where marginal quality is worth the latency and cost.`,
        `It also wins in platform teams that must explain capacity. A tiered map turns vague "make inference cheaper" work into measurable levers: GPU utilization, KV hit rate, time to first token, time per output token, accepted tokens per pass, p99 by route, and cost per accepted answer.`,
      ],
    },
    {
      heading: 'Failure Modes And Study Next',
      paragraphs: [
        `The main failure mode is optimizing the wrong metric. A change is not done if invalid outputs rise, cache hit rate is fake, p99 worsens on protected slices, output tokens per task grow, or cost per accepted answer does not fall. A clever decoder that fights continuous batching may be a benchmark win and a serving loss.`,
        `Another failure is applying every technique at once. Continuous batching, prefix caching, speculative decoding, routing, and verifier loops interact. Roll them out behind route-level measurements so a gain in one traffic class does not quietly damage another.`,
        `Study LLM Continuous Batching, PagedAttention, Prefill/Decode Disaggregation, Speculative Decoding, Multi-Token Decoding, Early-Exit Transformer Layer Skipping, Semantic Cache for LLMs, Verifier-Guided Inference Control Plane, and Heterogeneous AI Compute Workload Router. Primary sources used here include Orca at https://www.usenix.org/conference/osdi22/presentation/yu, PagedAttention at https://arxiv.org/abs/2309.06180, DistServe at https://arxiv.org/abs/2401.09670, Medusa at https://arxiv.org/abs/2401.10774, Lookahead Decoding at https://arxiv.org/abs/2402.02057, LayerSkip at https://aclanthology.org/2024.acl-long.681/, and TensorRT-LLM docs at https://nvidia.github.io/TensorRT-LLM/.`,
      ],
    },
  ],
};
