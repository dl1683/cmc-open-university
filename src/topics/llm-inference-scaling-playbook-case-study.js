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
      heading: 'What it is',
      paragraphs: [
        'LLM inference scaling is the discipline of getting more useful answers per dollar, second, and watt after the model has already been trained. It is not just faster kernels. It is a tiered serving playbook: continuous batching and KV management, prefill/decode separation, quantization, structured pruning, kernels, multi-token decoding, verifier-guided search, topology placement, and budget routing.',
        'The local Inference Scaling notes frame the field as a practical response to diminishing returns from pure training scale. This page turns that into an operational sequence: profile the bottleneck, choose the lowest tier that attacks it, and exit only when quality, p99, and cost all improve.',
      ],
    },
    {
      heading: 'Tier 1: utilization and state',
      paragraphs: [
        'The first tier is ordinary serving discipline. Continuous batching admits and removes requests at iteration boundaries so decode lanes stay full. Orca introduced iteration-level scheduling for transformer serving and showed large throughput gains at a given latency target: https://www.usenix.org/conference/osdi22/presentation/yu. PagedAttention makes KV cache allocation block-based so live sequence memory is not stranded: https://arxiv.org/abs/2309.06180.',
        'Prefill/decode disaggregation belongs here when phase interference becomes the bottleneck. DistServe separates compute-heavy prefill from memory-heavy decode and optimizes goodput under TTFT and TPOT constraints: https://arxiv.org/abs/2401.09670. Splitwise and Mooncake add hardware placement and KV-cache-centric architecture to the same family.',
      ],
    },
    {
      heading: 'Tier 2: fewer decode steps',
      paragraphs: [
        'The second tier attacks the autoregressive decode loop. Speculative Decoding uses a draft model and verifies multiple tokens in one target-model pass: https://arxiv.org/abs/2211.17192. Medusa adds future-token heads and tree attention, avoiding a separate draft model for some deployments: https://arxiv.org/abs/2401.10774. Lookahead decoding is an exact parallel decoding method that trades extra per-step work for fewer total decode steps: https://arxiv.org/abs/2402.02057. Early-exit and LayerSkip-style self-speculative decoding add an adaptive-depth option: shallow layers draft easy tokens while deeper layers verify.',
        'The exit metric is accepted tokens per expensive pass at the target p99, not candidates proposed. A low acceptance rate can waste compute. A clever decoding method that fights continuous batching or increases tail latency is not a production win.',
      ],
    },
    {
      heading: 'Tier 3: verifiers and topology',
      paragraphs: [
        'The third tier is where inference scaling becomes a control-plane problem. Verifiers terminate bad branches, rerank candidate answers, request repairs, or escalate. Process Reward Models & Verifier Search explains the reasoning version of this pattern, while Verifier-Guided Inference Control Plane Case Study turns it into route packets, thresholds, budget caps, and audit logs. The economic question is whether verifier cost buys enough quality or risk reduction to justify extra calls.',
        'Topology is the other hidden lever. Co-locating LLM servers, vector databases, feature stores, cache tiers, and verifier services can matter as much as model speed. A RAG product can double p99 through cross-rack retrieval hops even if the GPU kernel is excellent. Placement, routing, and observability determine whether lower-tier wins survive real traffic.',
      ],
    },
    {
      heading: 'Budget router',
      paragraphs: [
        'The practical product architecture is a budget router. Repeated intents go to semantic or exact cache. Easy low-risk tasks can use a small or local model. Hard tasks use the strong cloud model. High-risk tasks get verifier budget. Long-context tasks use retrieval, packing, windowing, or explicit downgrade. Each route should record a reason, model version, budget cap, and quality signal.',
        'Exit criteria should be explicit: invalid outputs below a threshold, cache hit rate high enough to matter, p99 stable by route, average output tokens reduced when that is the goal, cost per accepted answer down, and no silent quality loss on protected slices. Otherwise inference scaling has only moved the bill from one subsystem to another.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Orca at https://www.usenix.org/conference/osdi22/presentation/yu, vLLM/PagedAttention at https://arxiv.org/abs/2309.06180, DistServe at https://arxiv.org/abs/2401.09670, Medusa at https://arxiv.org/abs/2401.10774, Lookahead Decoding at https://arxiv.org/abs/2402.02057, LayerSkip at https://aclanthology.org/2024.acl-long.681/, and TensorRT-LLM overview at https://nvidia.github.io/TensorRT-LLM/overview.html. Study LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, Transformer Inference Roofline, Structured Pruning and N:M Sparsity, Titans Test-Time Neural Memory Case Study, LLM Continuous Batching, LLM Serving: PagedAttention, Prefill/Decode Disaggregation, Multi-Token Decoding, Early-Exit Transformer Layer Skipping, Chain of Draft Reasoning Token Budget Case Study, Process Reward Models & Verifier Search, Verifier-Guided Inference Control Plane Case Study, Semantic Cache for LLMs, LLM Response Cache Safety Ledger, On-Device LLM Inference Cost Crossover, Heterogeneous AI Compute Workload Router, and Scaling as Local Optimum Case Study next.',
      ],
    },
  ],
};
