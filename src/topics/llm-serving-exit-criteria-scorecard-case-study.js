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
    {
      heading: 'The problem',
      paragraphs: [
        'LLM serving optimization is full of partial wins. Dynamic batching can raise tokens per second while increasing queueing delay. CUDA graph replay can make hot shapes fast while rare shapes fall back unpredictably. Prefix caching can save prefill compute while increasing memory pressure or key-invalidation risk. Quantization can reduce cost while damaging a protected quality slice. Speculative decoding can look fast until acceptance rate falls.',
        'The danger is shipping from the headline metric. A team sees higher throughput, lower average latency, or lower cost per generated token and treats the change as ready. Users experience something broader: time to first token, inter-token latency, p99, answer quality, invalid output rate, availability, routing correctness, and the ability to roll back quickly when a slice breaks.',
        'An exit criteria scorecard is a release gate for serving changes. It turns the optimization into a set of pass/fail claims: what should improve, what must not regress, which slices were tested, how the canary behaved, and how rollback was proven. It is the difference between a promising benchmark and a production-ready change.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is lever-local benchmarking. If the team changed batching, measure throughput. If it enabled CUDA graphs, measure kernel overhead. If it added prefix caching, measure cache hit rate. If it quantized a model, measure cost. If it enabled speculation, measure generated tokens per second.',
        'This is necessary but not sufficient. Every serving lever moves load somewhere else. Batching improves GPU occupancy by making requests wait for compatible neighbors. Graph capture speeds replay by constraining shapes and execution paths. Prefix caching saves recompute by spending memory and relying on key correctness. Quantization lowers memory and bandwidth cost by changing numerical behavior. Speculation reduces target-model work only when the draft path is accepted often enough.',
        'A local benchmark usually runs in a cleaner world than production: controlled prompts, stable hardware, predictable routes, warm caches, and no angry tenants. The exit scorecard exists because production readiness is a joint property, not the maximum value on one chart.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core data structure is a multi-gate release packet. Each gate pairs the intended win with the failure mode that could invalidate it. Batching pairs utilization with p99 and queue caps. CUDA graphs pair capture hit rate with eager fallback. Prefix caching pairs hit rate with memory pressure and key correctness. Quantization pairs cost with protected evals. Speculation pairs speedup with acceptance rate and target-only fallback.',
        'The invariant is that an optimization ships only when useful cost improves without violating latency, quality, reliability, or rollback constraints. Useful cost is important: a cheaper generated token is not a win if more answers are rejected, more verifier retries are needed, or more users abandon before the first token.',
        'The packet should be durable. It stores load runs, eval reports, canary slices, route logs, cache statistics, graph capture coverage, cost calculations, rollback tests, and owner decisions. Future engineers need to know why the change shipped and which boundaries were considered safe.',
      ],
    },
    {
      heading: 'The scorecard shape',
      paragraphs: [
        'A useful scorecard starts with the hypothesis. Example: "enable larger dynamic batches for short prompts to raise GPU utilization without increasing p99 beyond 10 percent." That sentence names the lever, target slice, desired win, and guardrail. Vague goals such as "make serving faster" are not exit criteria.',
        'The next layer is measurement by slice. Prompt length, output length, tenant, model version, GPU type, risk class, route, cache state, and traffic phase can all change the result. A change that is safe for short low-risk prompts on one GPU type may be unsafe for long regulated answers on another route.',
        'The final layer is decision evidence. Each gate has a threshold, owner, artifact, and rollback path. A release packet should say not only "p99 passed" but which load run, which workload mix, which percentile window, which regression threshold, and which rollback flag was tested.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A proposed change enters the scorecard with a declared hypothesis and rollback plan. Before canary, load tests measure throughput, GPU utilization, TTFT, inter-token latency, p50, p95, p99, error rate, queue age, and cost per accepted answer. These tests should include realistic prompt and output distributions, not only the easiest hot path.',
        'Quality gates run separately. They should check protected tasks, invalid-output rate, structured-output validity, refusal or safety behavior where relevant, and any product-specific verifier. A serving optimization is not allowed to buy speed by making the model worse on the slices that matter.',
        'Lever-specific gates then check the mechanism. Dynamic batching needs queue caps, deadline-aware admission, and proof that tail latency is still inside budget. CUDA graph changes need shape coverage, capture hit rate, memory behavior, and eager fallback. Prefix caching needs key correctness, eviction behavior, memory pressure, and a disable switch. Quantization needs full-precision fallback and quality deltas by slice. Speculation needs acceptance rate, draft overhead, target-only fallback, and cost per accepted token.',
        'Canary gates put the change into real traffic gradually. The canary should be sliced: tenant cohort, prompt length, model route, hardware, risk class, and traffic time. Rollout only widens if live metrics match the safe region. If a guardrail trips, the rollback path should be immediate, tested, and visible in the release packet.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The scorecard works because it forces every local win to pay rent at the product boundary. Throughput is checked against p99. Cost is checked against accepted-answer quality. Cache hit rate is checked against memory pressure and correctness. Graph speed is checked against fallback behavior. Canary success is checked against rollback readiness.',
        'It also makes interactions visible. Serving levers compound. Larger batches can change graph shape distribution. Prefix caching can change memory headroom for batching. Quantization can change speculative acceptance. A scorecard that records the whole packet catches regressions that single-lever dashboards miss.',
        'This is not a mathematical proof that future traffic will behave like the canary. It is a control loop. The packet defines the expected safe region. The rollout watches live slices for drift. Rollback turns a failed assumption into a contained incident instead of a platform-wide outage.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is slower release velocity. Every gate needs instrumentation, thresholds, owners, artifacts, and a way to reproduce failures. Load tests require representative traffic. Quality gates require maintained evals. Canary gates require routing and observability. Rollback gates require engineering work that does not appear in the headline speedup.',
        'The process can also become bureaucratic if every small experiment needs a full production packet. The right response is scaling the gate to the blast radius. A private experiment might need a simple hypothesis, load check, quality check, and flag. A shared inference platform serving many tenants needs the full packet.',
        'The tradeoff is worthwhile because serving regressions are expensive and often nonlinear. A small p99 regression can trigger retries that increase load. A small quality regression can increase verifier retries or support tickets. A rollback path that was assumed but never tested can turn a five-minute bad canary into a long incident.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The pattern wins for shared inference platforms, high-volume chat products, agent systems with tool deadlines, regulated answer domains, and any team operating several levers at once. It is most valuable when a serving change can affect many tenants or when quality failures are more expensive than raw latency failures.',
        'It also wins as organizational memory. Six months after a change shipped, the packet explains which workload mix was tested, which GPU types were covered, which fallback exists, and which metric should page the owner. That matters when the next team changes batching, model version, cache policy, or hardware and accidentally moves outside the original safe region.',
        'The scorecard is also useful for saying no. If a change improves a synthetic benchmark but fails long-context p99 or protected evals, the release decision is clear. The team can keep the branch as research without pretending it is production-ready.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The scorecard fails when gates become decorative. If thresholds are vague, owners are missing, artifacts are not reproducible, or rollback was never exercised, the packet is just a report. It creates the appearance of discipline without changing release risk.',
        'It also fails when averages hide the slice that matters. A canary can pass overall while failing long prompts, one GPU generation, one tenant, one language, or one high-risk task class. The scorecard must force slice-level evidence where the product has slice-level risk.',
        'Finally, it fails when teams freeze the scorecard while the platform changes. New models, new hardware, new routing, new safety policy, and new traffic distributions can invalidate old thresholds. Exit criteria should be versioned like any other production contract.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team enables CUDA graph replay for hot decode shapes. The first synthetic test looks excellent: kernel overhead falls and throughput rises. The scorecard does not ship yet. It asks for capture hit rate by shape, TTFT, inter-token latency, p99 by prompt length, memory overhead, quality deltas, canary behavior, and eager fallback.',
        'The canary exposes the problem. Short prompts on the dominant GPU type improve, but long prompts on a smaller route hit rare dynamic shapes and fall back unpredictably. Overall throughput is up, but p99 for that slice is worse. The scorecard holds the release rather than averaging the failure away.',
        'The fix is better shape bucketing, a bounded shape cache, clearer fallback routing, and a flag that can disable graph replay per route. The second packet passes capture coverage, p99, quality, canary, and rollback. Now the feature ships with evidence, not just optimism.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The references for this topic point to concrete mechanisms: vLLM prefix caching, vLLM CUDA graphs, Triton dynamic batching, and NVIDIA CUDA Graphs best practices. Read them with the scorecard question in mind: what does this mechanism improve, what slice can it hurt, what metric proves it, and how do you roll it back?',
        'Study CUDA graph shape caches, speculative decoding acceptance ledgers, prompt-cache key canonicalization, SLO-aware request routing, GenAI token cost ledgers, continuous batching, prefix caching, quantization, and benchmark variance next. The recurring lesson is that serving optimization is not a single metric race. It is a release discipline around useful cost, quality, tail latency, and reversibility.',
      ],
    },
  ],
};
