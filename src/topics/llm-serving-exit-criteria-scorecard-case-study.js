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
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['An LLM serving exit scorecard is a release gate for inference optimizations. It stops teams from shipping a change because throughput improved while p99, quality, cache hit rate, graph capture, or rollback safety quietly regressed.', 'The local inference-scaling notes give examples of exit criteria: GPU utilization, CUDA graph use, quantization regression, cache hits, speculative speedups, invalid-output rate, and stable tail latency. This case study turns that into a reusable scorecard.'] },
    { heading: 'How it works', paragraphs: ['Every serving lever gets a metric pair: what it should improve and what it might harm. Dynamic batching should improve utilization without p99 damage. CUDA graphs should show capture hit rates and eager fallback. Prefix caching should show hit rate and recompute saved. Quantization should show quality regression. Speculation should show acceptance rate and target-only fallback.', 'The scorecard joins load tests, offline quality evals, canaries, rollback paths, and cost per accepted answer. A release packet stores those artifacts so future teams can understand what changed.'] },
    { heading: 'Complete case study', paragraphs: ['A team enables CUDA graph replay for hot decode shapes. Throughput rises in synthetic load tests, but canary p99 worsens on rare dynamic shapes because the system falls back unpredictably. The scorecard holds the release. The fix is a shape cache, better bucketing, and an explicit eager fallback path. Only after capture hit rate, quality, p99, and rollback pass does the feature ship.', 'The same pattern applies to prefix caching, quantization, dynamic batching, and speculative decoding. Each lever needs a gate and a rollback route.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not use average tokens per second as the release criterion. Do not ignore quality because the optimization is "only serving." Do not ship a cache or graph feature without a kill switch. Do not report cost per generated token when the product pays for accepted answers after retries and verifier work.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: vLLM prefix caching at https://docs.vllm.ai/en/stable/design/prefix_caching/, vLLM CUDA graphs at https://docs.vllm.ai/en/latest/design/cuda_graphs/, Triton dynamic batching at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html, and NVIDIA CUDA Graphs best practices at https://docs.nvidia.com/dl-cuda-graph/torch-cuda-graph/best-practices.html. Study LLM Inference Scaling Playbook, LLM Inference Cost Stack, CUDA Graph Shape Cache, Speculative Decoding Acceptance Ledger, SLO-Aware LLM Request Router, and Benchmark Variance & Model Selection next.'] },
  ],
};
