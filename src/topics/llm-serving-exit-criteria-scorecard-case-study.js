// LLM serving exit criteria: a scorecard that prevents teams from shipping an
// optimization just because one isolated benchmark improved.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-serving-exit-criteria-scorecard-case-study',
  title: 'LLM Serving Exit Criteria Scorecard Case Study',
  category: 'Systems',
  summary: 'A production readiness case study: ship inference optimizations only when utilization, p99, quality, cache, graph capture, acceptance, and rollback gates all hold.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['readiness gates', 'regression loop'], defaultValue: 'readiness gates' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'change', label: 'change', x: 0.7, y: 3.5, note: 'lever' },
      { id: 'bench', label: 'bench', x: 2.3, y: 2.0, note: 'load' },
      { id: 'quality', label: 'quality', x: 2.3, y: 5.0, note: 'eval' },
      { id: 'score', label: 'scorecard', x: 4.6, y: 3.5, note: 'all gates' },
      { id: 'canary', label: 'canary', x: 6.6, y: 2.0, note: 'slice' },
      { id: 'rollback', label: 'rollback', x: 6.6, y: 5.0, note: 'safe' },
      { id: 'ship', label: 'ship', x: 8.5, y: 3.5, note: 'ready' },
    ],
    edges: [
      { id: 'e-change-bench', from: 'change', to: 'bench' },
      { id: 'e-change-quality', from: 'change', to: 'quality' },
      { id: 'e-bench-score', from: 'bench', to: 'score' },
      { id: 'e-quality-score', from: 'quality', to: 'score' },
      { id: 'e-score-canary', from: 'score', to: 'canary' },
      { id: 'e-score-rollback', from: 'score', to: 'rollback' },
      { id: 'e-canary-ship', from: 'canary', to: 'ship' },
      { id: 'e-rollback-change', from: 'rollback', to: 'change' },
    ],
  }, { title });
}

function* readinessGates() {
  yield {
    state: gateGraph('A serving optimization exits through gates'),
    highlight: { active: ['change', 'bench', 'quality', 'score', 'e-change-bench', 'e-change-quality', 'e-bench-score', 'e-quality-score'], found: ['canary', 'ship'] },
    explanation: 'An inference optimization should not ship because one graph looks better. It exits only after load, quality, cost, p99, canary, and rollback gates pass together.',
    invariant: 'One metric win is not a release decision.',
  };

  yield {
    state: labelMatrix(
      'Exit scorecard',
      [
        { id: 'util', label: 'GPU util' },
        { id: 'graph', label: 'graph hit' },
        { id: 'cache', label: 'cache hit' },
        { id: 'accept', label: 'accept' },
        { id: 'quality', label: 'quality' },
        { id: 'p99', label: 'p99' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['>=75%', 'idle GPU'],
        ['hot shapes', 'eager fallbk'],
        ['useful', 'recompute'],
        ['>=2x path', 'draft waste'],
        ['no regress', 'cheap bad'],
        ['stable', 'tail spike'],
      ],
    ),
    highlight: { active: ['util:target', 'graph:target', 'quality:target', 'p99:target'], found: ['cache:target', 'accept:target'] },
    explanation: 'The scorecard is deliberately multi-column. CUDA graph capture, cache hit rate, speculative acceptance, quality, and p99 can each invalidate a change that looks good in isolation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'release stage', min: 0, max: 5 }, y: { label: 'normalized metric', min: 0, max: 1.1 } },
      series: [
        { id: 'throughput', label: 'throughput', points: [{ x: 0, y: 0.40 }, { x: 1, y: 0.66 }, { x: 2, y: 0.78 }, { x: 3, y: 0.84 }, { x: 4, y: 0.86 }] },
        { id: 'quality', label: 'quality', points: [{ x: 0, y: 0.96 }, { x: 1, y: 0.95 }, { x: 2, y: 0.94 }, { x: 3, y: 0.96 }, { x: 4, y: 0.96 }] },
        { id: 'p99', label: 'p99 health', points: [{ x: 0, y: 0.70 }, { x: 1, y: 0.62 }, { x: 2, y: 0.78 }, { x: 3, y: 0.84 }, { x: 4, y: 0.88 }] },
      ],
      markers: [
        { id: 'hold', x: 1, y: 0.62, label: 'hold' },
        { id: 'ship', x: 4, y: 0.88, label: 'ship' },
      ],
    }),
    highlight: { active: ['throughput', 'quality', 'p99', 'ship'], compare: ['hold'] },
    explanation: 'A change can improve throughput while hurting p99 in early tests. The scorecard forces the team to hold until tail latency and quality recover.',
  };

  yield {
    state: labelMatrix(
      'Lever-specific gates',
      [
        { id: 'batch', label: 'batching' },
        { id: 'cuda', label: 'CUDA graph' },
        { id: 'prefix', label: 'prefix' },
        { id: 'quant', label: 'quant' },
        { id: 'spec', label: 'spec' },
      ],
      [
        { id: 'must show', label: 'must show' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        ['util+p99', 'queue cap'],
        ['capture hit', 'eager path'],
        ['hit rate', 'disable key'],
        ['eval ok', 'fp16 route'],
        ['accept rate', 'target only'],
      ],
    ),
    highlight: { found: ['batch:must show', 'cuda:must show', 'prefix:must show', 'quant:must show', 'spec:must show'] },
    explanation: 'Each lever needs its own proof and rollback. CUDA graphs need eager fallback. Prefix caching needs key disablement. Quantization needs a full-precision route. Speculation needs a target-only path.',
  };
}

function* regressionLoop() {
  yield {
    state: gateGraph('Regression loop connects canary evidence back to the lever'),
    highlight: { active: ['canary', 'rollback', 'change', 'e-score-canary', 'e-score-rollback', 'e-rollback-change'], compare: ['ship'] },
    explanation: 'Canary evidence should either widen rollout, roll back, or change the lever. A scorecard without rollback is just reporting.',
  };

  yield {
    state: labelMatrix(
      'Canary slice ledger',
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'model', label: 'model' },
        { id: 'prompt', label: 'prompt len' },
        { id: 'risk', label: 'risk' },
        { id: 'device', label: 'device' },
      ],
      [
        { id: 'slice', label: 'slice' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['A/B cohort', 'complaints'],
        ['version', 'quality'],
        ['short/long', 'TTFT'],
        ['low/high', 'verdict'],
        ['GPU type', 'capture'],
      ],
    ),
    highlight: { active: ['prompt:watch', 'risk:watch', 'device:watch'], found: ['tenant:slice'] },
    explanation: 'A serving optimization can be safe for short prompts and bad for long prompts, safe for one GPU type and bad for another, or safe for low-risk tasks and bad for regulated answers.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'metric', label: 'metric', x: 0.8, y: 3.5, note: 'alert' },
        { id: 'slice', label: 'slice', x: 2.7, y: 3.5, note: 'where' },
        { id: 'owner', label: 'owner', x: 4.6, y: 2.2, note: 'team' },
        { id: 'flag', label: 'flag', x: 4.6, y: 4.8, note: 'switch' },
        { id: 'rollback', label: 'rollback', x: 6.7, y: 3.5, note: 'route' },
        { id: 'post', label: 'postmortem', x: 8.6, y: 3.5, note: 'learn' },
      ],
      edges: [
        { id: 'e-metric-slice', from: 'metric', to: 'slice' },
        { id: 'e-slice-owner', from: 'slice', to: 'owner' },
        { id: 'e-slice-flag', from: 'slice', to: 'flag' },
        { id: 'e-flag-rollback', from: 'flag', to: 'rollback' },
        { id: 'e-rollback-post', from: 'rollback', to: 'post' },
        { id: 'e-owner-post', from: 'owner', to: 'post' },
      ],
    }, { title: 'Rollback must be a first-class path' }),
    highlight: { active: ['metric', 'slice', 'flag', 'rollback', 'e-metric-slice', 'e-slice-flag', 'e-flag-rollback'], found: ['post'] },
    explanation: 'The rollback path should be just as designed as the fast path. It needs flags, owners, slice identification, and postmortem evidence so the optimization can be improved safely.',
  };

  yield {
    state: labelMatrix(
      'Final release packet',
      [
        { id: 'bench', label: 'bench' },
        { id: 'eval', label: 'eval' },
        { id: 'canary', label: 'canary' },
        { id: 'rollback', label: 'rollback' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'status', label: 'status' },
      ],
      [
        ['load run', 'pass'],
        ['quality report', 'pass'],
        ['slice graph', 'pass'],
        ['flag tested', 'pass'],
        ['$/task', 'lower'],
      ],
    ),
    highlight: { found: ['bench:status', 'eval:status', 'canary:status', 'rollback:status', 'cost:status'] },
    explanation: 'The release packet is the durable proof that the optimization improved useful cost without hiding quality or reliability regressions. It is what future teams read before touching the next lever.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'readiness gates') yield* readinessGates();
  else if (view === 'regression loop') yield* regressionLoop();
  else throw new InputError('Pick an LLM serving scorecard view.');
}

export const article = {
  references: [
    { title: 'vLLM Automatic Prefix Caching', url: 'https://docs.vllm.ai/en/stable/design/prefix_caching/' },
    { title: 'vLLM CUDA Graphs', url: 'https://docs.vllm.ai/en/latest/design/cuda_graphs/' },
    { title: 'NVIDIA Triton Dynamic Batcher', url: 'https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html' },
    { title: 'NVIDIA CUDA Graphs Best Practices', url: 'https://docs.nvidia.com/dl-cuda-graph/torch-cuda-graph/best-practices.html' },
    { title: 'Orca: A Distributed Serving System for Transformer-Based Models (Yu et al., OSDI 2022)', url: 'https://www.usenix.org/conference/osdi22/presentation/yu' },
    { title: 'Efficiently Scaling Transformer Inference (Pope et al., MLSys 2023)', url: 'https://arxiv.org/abs/2211.05102' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces the lifecycle of an LLM serving optimization from proposal to production ship. In the "readiness gates" view, active nodes mark the current decision surface: load testing, quality evaluation, or scorecard aggregation. Found nodes mark gates that have been satisfied with durable evidence. The path from "change" to "ship" is not a pipeline -- it is a control loop where failing any gate feeds back to the lever.',
        'In the "regression loop" view, active edges trace the canary-to-rollback feedback path. The rollback node returning to "change" is the key structural claim: rollback is not failure, it is the mechanism that makes experimentation safe. If rollback were absent, canary deployment would be an irreversible bet.',
        'The matrices show gate structure. Each row is a dimension the optimization must satisfy. Each column splits the target from the failure mode. A single red cell in the failure column is enough to block release, even if every other gate is green.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM inference is expensive. A single A100 GPU serving a 70B-parameter model at INT8 costs roughly $1-2 per GPU-hour in the cloud. At scale, a 5% throughput improvement across a thousand-GPU fleet saves hundreds of thousands of dollars per year. Teams are under constant pressure to ship optimizations.',
        {
          type: 'note',
          text: 'Every major serving optimization -- continuous batching, CUDA graph replay, prefix caching, quantization, speculative decoding -- improves at least one metric while quietly degrading another. The scorecard exists because shipping from a single improved chart is the most common way production inference breaks.',
        },
        'The problem is that each optimization lever moves load, not just speed. Dynamic batching raises GPU utilization by making requests wait for compatible neighbors, which trades throughput for queueing delay. CUDA graph capture eliminates kernel launch overhead for hot shapes but forces rare shapes into an eager fallback path. Prefix caching saves prefill compute by reusing KV blocks, but spends memory and relies on hash-key correctness. Quantization cuts memory bandwidth cost by changing numerical precision, which can silently degrade quality on tail distributions. Speculative decoding reduces target-model forward passes only when the draft model achieves high acceptance rates.',
        'Users do not experience throughput. They experience time to first token (TTFT), inter-token latency (ITL), answer quality, error rate, and availability. A serving team that ships from the throughput chart can deliver a net-negative user experience.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural instinct is lever-local benchmarking. If the team changed batching, run a throughput benchmark. If it enabled CUDA graphs, measure kernel overhead reduction. If it added prefix caching, track cache hit rate. If it quantized, measure cost per token. If it enabled speculation, measure tokens generated per second.',
        {
          type: 'table',
          headers: ['Optimization lever', 'Metric teams measure', 'What they miss'],
          rows: [
            ['Dynamic batching', 'Tokens/sec throughput', 'p99 queueing delay, deadline violations'],
            ['CUDA graph capture', 'Kernel launch overhead', 'Shape miss rate, eager fallback frequency'],
            ['Prefix caching', 'Cache hit rate', 'Memory pressure, stale key eviction'],
            ['INT8/INT4 quantization', 'Cost per token', 'Quality regression on protected evals'],
            ['Speculative decoding', 'Tokens/sec speedup', 'Acceptance rate collapse on hard prompts'],
          ],
        },
        'This is necessary but insufficient. A local benchmark runs in a cleaner world than production: controlled prompt distributions, stable hardware, predictable routes, warm caches, no competing tenants, and no traffic bursts. The exit scorecard exists because production readiness is a joint property across all these dimensions simultaneously, not the peak value on any single chart.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is metric coupling. Every serving lever shifts load between resources, and that shift creates a failure mode invisible to single-metric benchmarks.',
        {
          type: 'diagram',
          label: 'The coupling chain that local benchmarks miss',
          text: 'Larger batches\n  -> higher GPU util (good)\n  -> more varied sequence lengths in batch (hidden)\n  -> CUDA graph shape misses increase (hidden)\n  -> eager fallback frequency rises (hidden)\n  -> p99 latency spikes for long-context requests (bad)\n  -> user-facing timeout rate increases (incident)',
        },
        'This chain is real and common. A team enables larger dynamic batches for a 70B model. Throughput benchmark shows 40% more tokens per second. The team ships. Within hours, the on-call gets paged: p99 TTFT doubled for a tenant sending long system prompts. The batch scheduler is packing those long prompts alongside short chat turns. The padded batch shape misses every captured CUDA graph, triggering eager execution. The throughput win is real for short prompts. The latency regression is also real for long prompts. The local benchmark never tested the interaction.',
        {
          type: 'note',
          text: 'The invariant the scorecard enforces: an optimization ships only when useful cost improves without violating latency, quality, reliability, or rollback constraints across every tested slice. A single slice failure blocks global rollout.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a multi-gate release packet. Each gate pairs the intended win with the specific failure mode that could invalidate it.',
        {
          type: 'table',
          headers: ['Gate', 'Win it validates', 'Failure it guards against', 'Rollback mechanism'],
          rows: [
            ['GPU utilization', '>=75% sustained occupancy', 'Idle GPU from batch fragmentation', 'Revert batch size config'],
            ['CUDA graph capture', 'Kernel overhead elimination', 'Eager fallback on rare shapes', 'Disable graph replay per route'],
            ['Prefix cache hit', 'Prefill compute savings', 'Memory pressure, stale keys', 'Evict cache, disable per model'],
            ['Quality eval', 'No regression on protected tasks', 'Cheap tokens, bad answers', 'Route to full-precision model'],
            ['Spec acceptance', '>=60% draft acceptance', 'Draft waste exceeds savings', 'Target-only fallback'],
            ['p99 latency', 'Stable tail within SLO', 'Tail spike from interaction effects', 'Revert to previous serving config'],
          ],
        },
        'The key idea is that each gate is not just a threshold check but a pair: (proof of benefit, proof of contained failure). The scorecard is not a dashboard. A dashboard shows numbers. A scorecard demands that each number comes with an artifact, an owner, a slice breakdown, and a tested rollback path.',
        {
          type: 'quote',
          text: 'A cheaper generated token is not a win if more answers are rejected, more verifier retries are needed, or more users abandon before the first token arrives.',
          attribution: 'Core scorecard principle: useful cost, not raw cost',
        },
        'The packet must be durable. Six months later, when a new engineer changes the batch scheduler or swaps in a new model, the packet explains which workload mix was tested, which GPU types were covered, which fallback exists, and which metric should page the owner if the safe region is violated.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A proposed optimization enters the scorecard pipeline with two required inputs: a falsifiable hypothesis and a rollback plan.',
        {
          type: 'code',
          language: 'yaml',
          text: '# Example scorecard entry for a batching change\nhypothesis: |\n  Increase max_batch_tokens from 8192 to 16384 for\n  Llama-70B-INT8 on A100-80GB to raise GPU utilization\n  from 55% to 75% without increasing p99 TTFT beyond\n  800ms (current: 620ms, budget: +29%).\nrollback:\n  flag: serving.batch.max_tokens\n  revert_value: 8192\n  owner: inference-platform@\n  tested: true  # rollback exercised in staging\nslices:\n  - prompt_len: [0-512, 512-2048, 2048-8192]\n  - gpu_type: [A100-80GB, H100-80GB]\n  - tenant_risk: [low, high]\n  - traffic_phase: [peak, off-peak]',
        },
        'The hypothesis names the lever, target slice, expected improvement, guardrail metric, and acceptable regression budget. "Make serving faster" is not a hypothesis. "Raise GPU utilization from 55% to 75% without p99 TTFT exceeding 800ms" is testable.',
        'The pipeline runs four gate tiers sequentially:',
        {
          type: 'bullets',
          items: [
            'Load gates: throughput, GPU utilization, TTFT, ITL, p50/p95/p99, error rate, queue depth, and cost per accepted answer. Tests must use realistic prompt and output length distributions, not just the hot path.',
            'Quality gates: protected task evals, invalid-output rate, structured-output schema compliance, safety/refusal behavior, and product-specific verifiers. A serving optimization cannot buy speed by making the model worse on slices that matter.',
            'Lever-specific gates: each mechanism has its own proof requirement. Batching needs queue cap and deadline-aware admission proof. CUDA graphs need shape coverage and capture hit rate. Prefix caching needs key correctness and eviction behavior. Quantization needs full-precision fallback and per-slice quality deltas. Speculation needs acceptance rate and draft cost overhead.',
            'Canary gates: gradual real-traffic rollout sliced by tenant cohort, prompt length, model route, GPU type, risk class, and traffic time. Rollout widens only if live metrics stay inside the safe region. If any guardrail trips, rollback must be immediate and the rollback evidence enters the packet.',
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The scorecard works because it forces every local win to pay rent at the product boundary. Throughput is checked against p99. Cost is checked against accepted-answer quality. Cache hit rate is checked against memory pressure. Graph speed is checked against fallback behavior. Canary success is checked against rollback readiness.',
        'It also makes lever interactions visible. Serving optimizations compound in ways that single-lever dashboards cannot catch:',
        {
          type: 'table',
          headers: ['Lever A', 'Lever B', 'Hidden interaction'],
          rows: [
            ['Larger batches', 'CUDA graph capture', 'More varied shapes per batch increase graph miss rate'],
            ['Prefix caching', 'Dynamic batching', 'Cached prefixes reduce prefill time, changing batch scheduling dynamics'],
            ['INT4 quantization', 'Speculative decoding', 'Lower-precision draft model may reduce acceptance rate'],
            ['Continuous batching', 'Prefix caching', 'Preemption and recompute invalidate cached KV blocks'],
          ],
        },
        'The scorecard is not a proof that future traffic will behave like the canary. It is a control loop. The packet defines the expected safe region. The rollout watches live slices for drift. Rollback turns a failed assumption into a contained incident -- five minutes of bad canary, not a platform-wide outage.',
        {
          type: 'note',
          text: 'The scorecard also serves as organizational memory. When the next team touches the same lever six months later, the packet tells them which boundaries were tested and which were assumed safe. Without this, every optimization is built on undocumented assumptions about traffic, hardware, and model behavior.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The tax is release velocity. Every gate needs instrumentation, thresholds, owners, artifacts, and reproducibility.',
        {
          type: 'table',
          headers: ['Gate type', 'Engineering cost', 'Ongoing maintenance'],
          rows: [
            ['Load testing', 'Build representative traffic generator', 'Update prompt distributions as product evolves'],
            ['Quality evals', 'Curate protected eval sets per task type', 'Refresh evals as model capabilities change'],
            ['Canary routing', 'Implement slice-aware traffic splitting', 'Maintain routing rules as tenants change'],
            ['Rollback testing', 'Exercise every rollback flag in staging', 'Re-test after config schema changes'],
            ['Packet storage', 'Persist artifacts with git commit links', 'Prune stale packets, version thresholds'],
          ],
        },
        'The right response to cost is scaling the gate to the blast radius. A private experiment on a dev cluster needs a hypothesis, a load check, a quality spot-check, and a flag. A shared inference platform serving thousands of tenants across multiple GPU types and model versions needs the full packet. Do not apply the same gate weight to both.',
        'The tradeoff is worthwhile because serving regressions are expensive and nonlinear. A 15% p99 regression triggers client-side retries. Retries increase server load by 10-30%. Increased load pushes more requests into the tail. The tail gets worse. More retries fire. This feedback loop can turn a modest latency regression into a cascading outage within minutes. A rollback path that was assumed but never tested can turn a five-minute bad canary into a multi-hour incident.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Shared inference platforms (vLLM, TensorRT-LLM, Triton) serving multiple tenants with different SLOs. A batching change safe for chat may violate deadlines for tool-calling agents.',
            'High-volume chat products where a 50ms p99 TTFT regression across millions of daily users generates measurable engagement drops and support tickets.',
            'Agent systems with hard tool-call deadlines. If the LLM does not respond within 2 seconds, the orchestrator times out and the entire agent turn fails. Tail latency matters more than throughput.',
            'Regulated answer domains (medical, legal, financial) where quantization-induced quality drift on a protected eval set creates compliance risk that no throughput gain justifies.',
            'Multi-model routing systems where a serving change to one model shifts traffic patterns to others, creating cross-model interaction effects invisible to single-model benchmarks.',
          ],
        },
        'The scorecard is also useful for saying no. If a change improves a synthetic benchmark but fails long-context p99 or protected evals, the release decision is clear and defensible. The team keeps the branch as research. The packet documents why it did not ship and what would need to change.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The scorecard fails in three predictable ways:',
        {
          type: 'bullets',
          items: [
            'Decorative gates. Thresholds are vague ("quality should be good"), owners are missing, artifacts are not reproducible, rollback was never exercised. The packet exists but changes nothing about release risk. This is the most common failure mode.',
            'Averages hiding slice failures. A canary passes overall p99 while failing long prompts on one GPU generation, or one tenant, or one language, or one high-risk task class. The scorecard must force slice-level evidence wherever the product has slice-level risk.',
            'Frozen thresholds on a moving platform. New models, new hardware, new routing policies, new safety requirements, and new traffic distributions invalidate old thresholds. A p99 budget set for a 13B model is meaningless after migration to 70B. Exit criteria must be versioned like any other production contract.',
          ],
        },
        {
          type: 'quote',
          text: 'A scorecard without rollback is just reporting.',
          attribution: 'The difference between discipline and theater',
        },
        'A subtler failure: the scorecard becomes a bottleneck that incentivizes workarounds. If the gate process takes two weeks and the team is under pressure, engineers will find ways to classify changes as "not requiring a full packet." The fix is scaling gate weight to blast radius, not removing gates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team enables CUDA graph replay for hot decode shapes on a vLLM cluster serving Llama-70B-INT8 across A100 and H100 GPUs. The hypothesis:',
        {
          type: 'code',
          language: 'text',
          text: 'Hypothesis: Enable CUDA graph capture for the 8 most\nfrequent decode batch shapes (bs=1,2,4,8,16,32,64,128)\nto reduce kernel launch overhead by 40%, raising\nthroughput from 1200 to 1680 tok/s on A100-80GB\nwithout increasing p99 ITL beyond 45ms (current: 38ms).',
        },
        'The first synthetic benchmark looks excellent: kernel overhead drops 43%, throughput rises to 1720 tok/s. The scorecard does not ship. It asks for capture hit rate by shape, p99 by prompt length, memory overhead, quality deltas, canary behavior, and eager fallback frequency.',
        {
          type: 'table',
          headers: ['Gate', 'Result', 'Status'],
          rows: [
            ['Throughput', '+43% on hot shapes', 'PASS'],
            ['GPU utilization', '78% sustained', 'PASS'],
            ['Capture hit rate', '94% on A100, 91% on H100', 'PASS'],
            ['p99 ITL (short prompts)', '32ms (was 38ms)', 'PASS'],
            ['p99 ITL (long prompts, >4k tokens)', '112ms (was 41ms)', 'FAIL'],
            ['Quality eval (MMLU, HumanEval)', 'No change', 'PASS'],
            ['Eager fallback rate', '6% on A100, 9% on H100', 'WARN'],
            ['Rollback flag tested', 'Yes, staging', 'PASS'],
          ],
        },
        'The canary exposes the coupling. Short prompts on A100 improve because their decode shapes hit captured graphs consistently. Long prompts (>4k context) on H100 generate dynamic KV-cache shapes that miss every captured graph, triggering eager fallback. The eager path on H100 has different kernel scheduling than A100, adding 70ms of overhead per miss. Overall throughput is up, but p99 for the long-prompt slice is 2.7x worse.',
        'The scorecard holds the release. The fix: expand the shape bucket list to cover long-context decode shapes, add a bounded LRU shape cache (max 32 entries, ~200MB overhead), implement per-route graph disable flags, and re-run the full packet. The second packet passes all gates including long-prompt p99 at 44ms. The feature ships with evidence, not optimism.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Production teams can use this checklist as a starting template for their own scorecard process:',
        {
          type: 'code',
          language: 'text',
          text: 'SCORECARD CHECKLIST\n\n[ ] Hypothesis written: lever, slice, expected win, guardrail\n[ ] Rollback plan: flag name, revert value, owner, tested in staging\n[ ] Load test: realistic prompt distribution, not just hot path\n    [ ] Throughput delta\n    [ ] GPU utilization\n    [ ] TTFT p50/p95/p99\n    [ ] ITL p50/p95/p99\n    [ ] Error rate\n    [ ] Queue depth / wait time\n    [ ] Cost per accepted answer\n[ ] Quality gate:\n    [ ] Protected eval set (no regression beyond threshold)\n    [ ] Invalid output rate\n    [ ] Structured output schema compliance\n[ ] Lever-specific gate:\n    [ ] Mechanism proof (capture rate, hit rate, acceptance, etc.)\n    [ ] Fallback path verified\n[ ] Canary gate:\n    [ ] Sliced by: prompt len, tenant, GPU type, risk class\n    [ ] Duration: >= 24h covering peak and off-peak\n    [ ] Live metrics inside safe region\n[ ] Release packet stored with git commit, artifacts, owner sign-off',
        },
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'Three classes of bugs recur in serving optimization releases:',
        {
          type: 'table',
          headers: ['Bug class', 'Mechanism', 'Detection signal'],
          rows: [
            ['Slow leak', 'Cache grows unbounded; graph cache never evicts', 'Memory usage trending upward over hours/days'],
            ['Phase-dependent regression', 'Optimization helps at low load, hurts at peak', 'p99 divergence between off-peak and peak windows'],
            ['Stale-config interaction', 'New optimization interacts with old flag left enabled', 'Metrics do not match staging because staging has clean config'],
          ],
        },
        'The slow leak is especially dangerous because it passes every gate at test time. A prefix cache with no eviction bound looks great for 30 minutes. After 8 hours of production traffic, it exhausts GPU memory and the OOM killer takes down the worker. The scorecard should require a memory-over-time measurement, not just a point-in-time snapshot.',
        'Phase-dependent regressions hide behind averages. An optimization that helps at 40% GPU utilization can hurt at 85% utilization because batch packing changes under load. The load test must include a sustained-peak phase, not just a ramp-up.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        {
          type: 'diagram',
          label: 'Gate scaling by blast radius',
          text: 'Blast radius        Gate weight\n-----------        -----------\nDev experiment     -> Hypothesis + load spot-check + flag\nStaging deploy     -> + quality eval + rollback test\nSingle-tenant prod -> + canary slice + 24h soak\nMulti-tenant prod  -> Full packet: all gates, all slices, stored artifacts\nCross-model change -> Full packet + cross-model interaction test',
        },
        'If the change can only affect your own dev cluster, a lightweight check is fine. If it can affect every tenant on a shared fleet, the full packet is mandatory. The rule is: gate weight should be proportional to the number of users who experience a failure before you can roll back.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Prerequisite: continuous batching (Orca). Without understanding iteration-level scheduling, the batching gates in the scorecard will not make sense. Study how vLLM and TensorRT-LLM implement continuous batching and why it replaced static batching.',
            'Extension: SLO-aware request routing. The scorecard checks metrics per slice, but a routing layer can prevent bad slices from forming in the first place by directing long prompts away from graph-heavy routes.',
            'Mechanism deep-dive: CUDA graph shape caches. Read the vLLM CUDA graph documentation and NVIDIA best practices to understand capture, replay, shape bucketing, and eager fallback at the implementation level.',
            'Companion case study: speculative decoding acceptance ledgers. Speculation is the lever with the most complex exit criteria because acceptance rate depends on prompt difficulty, draft model quality, and temperature -- all of which vary by slice.',
            'Contrast: GenAI token cost ledgers. Cost optimization and latency optimization can conflict. A cost ledger tracks spend; the scorecard tracks whether the spend reduction damaged the product.',
          ],
        },
        'The recurring lesson across all these topics: serving optimization is not a single-metric race. It is a release discipline around useful cost, quality, tail latency, and reversibility.',
      ],
    },
  ],
};

