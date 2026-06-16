// On-device LLM inference cost crossover: model the shift from shared GPU
// metering to fixed device-distribution cost, then route work across both.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'on-device-llm-inference-cost-crossover-case-study',
  title: 'On-Device LLM Inference Cost Crossover',
  category: 'Systems',
  summary: 'A hybrid edge-cloud LLM case study: model fixed device cost, per-token cloud cost, model updates, privacy boundaries, and routing rules.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cost crossover', 'hybrid router'], defaultValue: 'cost crossover' },
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

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'request', x: 0.7, y: 3.5, note: 'task' },
      { id: 'policy', label: 'router', x: 2.3, y: 3.5, note: 'policy' },
      { id: 'cache', label: 'cache', x: 3.9, y: 1.7, note: 'reuse' },
      { id: 'device', label: 'device', x: 4.3, y: 5.4, note: 'local' },
      { id: 'cloud', label: 'cloud', x: 6.0, y: 3.5, note: 'per token' },
      { id: 'pkg', label: 'model pkg', x: 6.2, y: 5.4, note: 'weights' },
      { id: 'safety', label: 'safety', x: 7.8, y: 3.5, note: 'guards' },
      { id: 'signals', label: 'signals', x: 9.3, y: 3.5, note: 'thin logs' },
    ],
    edges: [
      { id: 'e-task-policy', from: 'task', to: 'policy' },
      { id: 'e-policy-cache', from: 'policy', to: 'cache', weight: 'repeat' },
      { id: 'e-policy-device', from: 'policy', to: 'device', weight: 'private' },
      { id: 'e-policy-cloud', from: 'policy', to: 'cloud', weight: 'hard' },
      { id: 'e-pkg-device', from: 'pkg', to: 'device', weight: 'update' },
      { id: 'e-device-safety', from: 'device', to: 'safety' },
      { id: 'e-cloud-safety', from: 'cloud', to: 'safety' },
      { id: 'e-safety-signals', from: 'safety', to: 'signals' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'manifest', label: 'manifest', x: 0.8, y: 3.4, note: 'version' },
      { id: 'canary', label: 'canary', x: 2.3, y: 2.1, note: 'slice' },
      { id: 'cdn', label: 'CDN', x: 3.7, y: 3.4, note: 'ship bits' },
      { id: 'device', label: 'device', x: 5.2, y: 3.4, note: 'install' },
      { id: 'base', label: 'base', x: 6.7, y: 2.1, note: 'model' },
      { id: 'adapter', label: 'adapter', x: 6.7, y: 4.7, note: 'skill' },
      { id: 'eval', label: 'eval', x: 8.2, y: 3.4, note: 'quality' },
      { id: 'rollback', label: 'rollback', x: 9.4, y: 5.2, note: 'kill sw' },
    ],
    edges: [
      { id: 'e-manifest-canary', from: 'manifest', to: 'canary' },
      { id: 'e-canary-cdn', from: 'canary', to: 'cdn' },
      { id: 'e-cdn-device', from: 'cdn', to: 'device' },
      { id: 'e-device-base', from: 'device', to: 'base' },
      { id: 'e-device-adapter', from: 'device', to: 'adapter' },
      { id: 'e-base-eval', from: 'base', to: 'eval' },
      { id: 'e-adapter-eval', from: 'adapter', to: 'eval' },
      { id: 'e-eval-rollback', from: 'eval', to: 'rollback' },
      { id: 'e-rollback-manifest', from: 'rollback', to: 'manifest' },
    ],
  }, { title });
}

function costPlot(markers = []) {
  const x = [0, 50, 100, 250, 500, 1000];
  return plotState({
    axes: {
      x: { label: 'monthly prompts per user', min: 0, max: 1000 },
      y: { label: 'relative serving cost', min: 0, max: 170 },
    },
    series: [
      { id: 'cloud', label: 'cloud meter', points: x.map((v) => ({ x: v, y: v * 0.16 })) },
      { id: 'device', label: 'device fix', points: x.map((v) => ({ x: v, y: 14 })) },
      { id: 'hybrid', label: 'hybrid', points: [{ x: 0, y: 9 }, { x: 50, y: 13 }, { x: 100, y: 16 }, { x: 250, y: 24 }, { x: 500, y: 38 }, { x: 1000, y: 68 }] },
    ],
    markers,
  });
}

function latencyPlot() {
  return plotState({
    axes: {
      x: { label: 'prompt tokens', min: 0, max: 32000 },
      y: { label: 'seconds to first answer', min: 0, max: 9 },
    },
    series: [
      { id: 'cache', label: 'cache hit', points: [{ x: 500, y: 0.05 }, { x: 4000, y: 0.07 }, { x: 16000, y: 0.1 }, { x: 32000, y: 0.15 }] },
      { id: 'edge', label: 'device', points: [{ x: 500, y: 0.8 }, { x: 4000, y: 1.8 }, { x: 16000, y: 5.0 }, { x: 32000, y: 8.2 }] },
      { id: 'cloud', label: 'cloud', points: [{ x: 500, y: 0.6 }, { x: 4000, y: 0.9 }, { x: 16000, y: 2.5 }, { x: 32000, y: 4.8 }] },
    ],
    markers: [
      { id: 'tiny', x: 500, y: 0.8, label: 'tiny task' },
      { id: 'long', x: 32000, y: 4.8, label: 'long ctx' },
    ],
  });
}

function* costCrossover() {
  yield {
    state: routeGraph('The crossover is a routing problem'),
    highlight: { active: ['task', 'policy', 'device', 'cloud', 'e-task-policy', 'e-policy-device', 'e-policy-cloud'], found: ['cache'], compare: ['pkg'] },
    explanation: 'Cloud inference charges every prompt against a shared GPU pool. On-device inference shifts cost into a fixed model package and user-owned hardware. A serious product needs a router that understands both cost surfaces.',
  };

  yield {
    state: costPlot([
      { id: 'low', x: 75, y: 12, label: 'low use' },
      { id: 'ambient', x: 650, y: 14, label: 'always-on' },
    ]),
    highlight: { active: ['cloud'], found: ['device', 'ambient'], compare: ['hybrid'] },
    explanation: 'This is a conceptual cost curve. Cloud cost grows with usage because every token consumes provider capacity. Device cost is mostly paid through model distribution, updates, app engineering, and battery, so heavy or ambient usage changes the economics.',
    invariant: 'Device inference is not cheaper cloud; it changes variable cost into fixed rollout cost.',
  };

  yield {
    state: labelMatrix(
      'Cost ledger',
      [
        { id: 'cloud', label: 'cloud' },
        { id: 'device', label: 'device' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'unit', label: 'unit cost' },
        { id: 'fixed', label: 'fixed cost' },
        { id: 'wall', label: 'main wall' },
      ],
      [
        ['per token', 'GPU pool', 'KV + p99'],
        ['near zero', 'model ship', 'RAM + watts'],
        ['routed', 'two stacks', 'drift'],
        ['hit based', 'index ops', 'false hit'],
      ],
    ),
    highlight: { active: ['cloud:unit', 'device:fixed', 'hybrid:wall'], found: ['cache:unit'] },
    explanation: 'The ledger has different columns than ordinary GPU serving. The device path removes shared KV-cache concurrency pressure, but it adds model shipping, hardware fragmentation, update timing, and observability limits.',
  };

  yield {
    state: labelMatrix(
      'Device constraint ledger',
      [
        { id: 'model', label: 'model' },
        { id: 'context', label: 'context' },
        { id: 'runtime', label: 'runtime' },
        { id: 'updates', label: 'updates' },
        { id: 'logs', label: 'logs' },
        { id: 'power', label: 'power' },
      ],
      [
        { id: 'limit', label: 'limit' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['1-4B', 'distill+quant'],
        ['small window', 'pack + RAG'],
        ['CPU/GPU/NPU', 'kernel map'],
        ['GB download', 'staged'],
        ['privacy', 'opt-in agg'],
        ['thermal cap', 'budget gate'],
      ],
    ),
    highlight: { active: ['model:guard', 'context:guard', 'runtime:guard'], found: ['logs:guard', 'power:guard'] },
    explanation: 'On-device quality is won by constraints: compact models, quantization-aware compression, bounded context, optimized kernels, staged updates, and telemetry that respects local data boundaries.',
  };

  yield {
    state: routeGraph('Route by task, device, and risk'),
    highlight: { active: ['policy', 'cache', 'device', 'cloud', 'safety', 'e-policy-cache', 'e-policy-device', 'e-policy-cloud'], found: ['signals'] },
    explanation: 'The product decision is rarely all-cloud or all-device. Easy private tasks can stay local. Repeated FAQ prompts can hit cache. Hard reasoning, unsupported devices, long contexts, or regulated decisions can route to a cloud path with stronger monitoring.',
  };

  yield {
    state: labelMatrix(
      'Decision ledger',
      [
        { id: 'private', label: 'private' },
        { id: 'offline', label: 'offline' },
        { id: 'lowram', label: 'low RAM' },
        { id: 'longctx', label: 'long ctx' },
        { id: 'repeat', label: 'repeat' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['local data', 'device'],
        ['no network', 'device'],
        ['cap miss', 'cloud'],
        ['32k ask', 'cloud/RAG'],
        ['same intent', 'cache'],
      ],
    ),
    highlight: { active: ['private:route', 'offline:route', 'lowram:route'], found: ['repeat:route'], compare: ['longctx:route'] },
    explanation: 'The useful data structure is a decision ledger: one row per routing signal, a chosen path, and a reason. Without this, a hybrid system becomes a pile of special cases that nobody can debug.',
  };
}

function* hybridRouter() {
  yield {
    state: routeGraph('Hybrid inference starts with policy'),
    highlight: { active: ['task', 'policy', 'cache', 'device', 'cloud', 'e-task-policy'], compare: ['pkg'], found: ['signals'] },
    explanation: 'A hybrid router evaluates privacy, offline state, latency budget, device capability, context length, model version, answer criticality, and cacheability before it chooses a path.',
    invariant: 'The route is a typed decision with a reason, not a hidden if statement.',
  };

  yield {
    state: labelMatrix(
      'Route rules',
      [
        { id: 'offline', label: 'offline' },
        { id: 'private', label: 'private' },
        { id: 'cheap', label: 'cheap' },
        { id: 'hard', label: 'hard' },
        { id: 'long', label: 'long ctx' },
        { id: 'faq', label: 'hot FAQ' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'why', label: 'why' },
      ],
      [
        ['device', 'no net'],
        ['device', 'data stays'],
        ['device', 'low risk'],
        ['cloud', 'quality'],
        ['cloud/RAG', 'state size'],
        ['cache', 'same intent'],
      ],
    ),
    highlight: { active: ['offline:route', 'private:route', 'hard:route'], found: ['faq:route'], compare: ['long:route'] },
    explanation: 'Rules should be boring and inspectable. The edge path is for clear bounded work. The cloud path is for capability, long state, and stronger operational visibility. The cache path is for stable repeated intents.',
  };

  yield {
    state: updateGraph('A model package needs a rollout control plane'),
    highlight: { active: ['manifest', 'canary', 'cdn', 'device', 'base', 'eval', 'e-manifest-canary', 'e-canary-cdn', 'e-cdn-device'], found: ['rollback'] },
    explanation: 'Server-side model swaps are instant from the user device perspective. On-device models need manifests, staged downloads, hardware gates, base-model versions, adapter compatibility, canaries, and rollback.',
  };

  yield {
    state: labelMatrix(
      'State boundaries',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'kv', label: 'KV state' },
        { id: 'hit', label: 'cache hit' },
        { id: 'trace', label: 'trace' },
        { id: 'adapter', label: 'adapter' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['device', 'PII'],
        ['device', 'RAM'],
        ['server?', 'false hit'],
        ['opt-in', 'privacy'],
        ['versioned', 'drift'],
      ],
    ),
    highlight: { active: ['prompt:owner', 'kv:owner', 'trace:risk'], found: ['adapter:owner'], compare: ['hit:risk'] },
    explanation: 'Hybrid inference is also a state-boundary design. Prompts and KV state may stay local. Cache hits may need server metadata. Traces need opt-in aggregation. Adapters must match the base model version.',
  };

  yield {
    state: latencyPlot(),
    highlight: { active: ['edge', 'cloud'], found: ['cache'], compare: ['long'] },
    explanation: 'Latency is workload- and hardware-specific. A cache hit can beat both. A tiny local task can feel instant. A long prompt on a weak device can lose to cloud even before quality is considered.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'device', label: 'device', x: 0.8, y: 3.7, note: 'local run' },
        { id: 'counters', label: 'counters', x: 2.8, y: 2.2, note: 'agg only' },
        { id: 'crash', label: 'crash', x: 2.8, y: 5.3, note: 'faults' },
        { id: 'sample', label: 'sample', x: 4.9, y: 3.7, note: 'opt-in' },
        { id: 'eval', label: 'eval', x: 6.8, y: 2.2, note: 'slices' },
        { id: 'flags', label: 'flags', x: 6.8, y: 5.3, note: 'rollback' },
        { id: 'ledger', label: 'ledger', x: 8.9, y: 3.7, note: 'reasons' },
      ],
      edges: [
        { id: 'e-device-counters', from: 'device', to: 'counters' },
        { id: 'e-device-crash', from: 'device', to: 'crash' },
        { id: 'e-counters-sample', from: 'counters', to: 'sample' },
        { id: 'e-crash-sample', from: 'crash', to: 'sample' },
        { id: 'e-sample-eval', from: 'sample', to: 'eval' },
        { id: 'e-sample-flags', from: 'sample', to: 'flags' },
        { id: 'e-eval-ledger', from: 'eval', to: 'ledger' },
        { id: 'e-flags-ledger', from: 'flags', to: 'ledger' },
      ],
    }, { title: 'Observability without copying private prompts' }),
    highlight: { active: ['device', 'counters', 'sample', 'eval', 'ledger'], found: ['flags'], compare: ['crash'] },
    explanation: 'The telemetry design should not secretly turn local inference back into cloud data collection. Prefer aggregate counters, opt-in samples, crash signals, route reasons, and slice-level evals over raw prompt upload.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'kill', label: 'kill switch' },
        { id: 'cap', label: 'cap check' },
        { id: 'eval', label: 'eval set' },
        { id: 'hash', label: 'model hash' },
        { id: 'fresh', label: 'freshness' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['rollback', 'flag'],
        ['avoid crash', 'cap table'],
        ['catch drift', 'slices'],
        ['pin bits', 'manifest'],
        ['stale risk', 'TTL'],
      ],
    ),
    highlight: { active: ['kill:artifact', 'cap:artifact', 'hash:artifact'], found: ['eval:artifact', 'fresh:artifact'] },
    explanation: 'The production checklist is control-plane heavy: kill switch, capability table, evaluation slices, signed model hash, adapter compatibility, and freshness rules for cached or retrieved context.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cost crossover') yield* costCrossover();
  else if (view === 'hybrid router') yield* hybridRouter();
  else throw new InputError('Pick an on-device LLM inference view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'On-device LLM inference changes the economics of a product. Cloud inference prices every request against shared compute, shared memory, queueing, and provider margin. Device inference moves part of the bill into model packaging, distribution, capability detection, battery, and app engineering. The result is a crossover: low-volume or high-capability work may stay cloud-first, while private, repetitive, offline, or ambient work can become better on the device.',
        'The key data structure is a hybrid routing ledger. It records the signals that determine where a prompt should run: privacy level, offline status, device class, model version, context length, cacheability, latency budget, quality requirement, and rollback state. Without that ledger, edge inference becomes a scattered pile of feature-specific branches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The request first passes through a policy router. A semantic cache can answer stable repeated intents. A local model can handle bounded private tasks such as rewriting, summarization, extraction, classification, and lightweight tool payload construction. A cloud model handles unsupported devices, hard reasoning, long context, high-risk answers, and workloads that need richer observability.',
        'A production edge path also needs a model-update control plane. The app downloads a signed manifest, checks hardware and OS capabilities, stages model bits through a CDN or platform service, verifies the model hash, loads the right adapter for the base version, runs a small slice first, and keeps a kill switch. This is closer to progressive delivery than ordinary library linking.',
        'The serving primitives still matter. Quantization makes the model fit. KV Cache Concurrency Capacity Model explains why cloud has a shared memory ceiling while each device gets its own local cache budget. Sliding-Window Attention Context Policy and RAG Context Packing Token Budget keep local prompts inside practical memory and latency limits. Semantic Cache for LLMs reduces calls for repetitive work whether the final answer path is local or cloud.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cloud costs are variable: each prompt consumes prefill, decode, KV-cache residency, queue capacity, and tail-latency budget. On-device costs are more fixed: model licensing or packaging, CDN distribution, app size, update cadence, hardware fragmentation, power draw, and loss of server-side telemetry. The local Cost of Transformers notes in this repo emphasize the same core lesson: the device path is not just cheaper cloud; it removes shared concurrency pressure and adds a deployment-control problem.',
        'The trade is especially sharp for always-on features. Continuous summarization, real-time translation, ambient assistants, keyboard rewriting, and private extraction can be too expensive or too privacy-sensitive to meter through a cloud model for every user interaction. But smaller on-device models are not frontier chatbots. They need scoped UX, task-specific evals, retrieval or tool help, and cloud fallback when quality or policy demands it.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Android Gemini Nano is the system-level example. The Android developer docs describe on-device generative AI as useful when low cost and privacy safeguards matter, with AICore managing Gemini Nano access, updates, safety features, and device hardware use: https://developer.android.com/ai/gemini-nano. The same docs state that local execution removes server calls, keeps sensitive data on device, supports offline use, and reduces inference costs.',
        'Apple exposes a compact on-device foundation model through its Foundation Models framework. Apple reports an approximately 3B-parameter on-device model, KV-cache memory reductions, quantized weights and KV cache, guided generation, tool calling, adapters, and a complementary server model for more complex tasks: https://machinelearning.apple.com/research/apple-foundation-models-2025-updates.',
        'Google LiteRT is the runtime side of the same pattern: an on-device framework for ML and GenAI deployment, conversion, optimization, quantization, accelerator selection, and deployment across mobile, desktop, web, and constrained devices: https://developers.google.com/edge/litert. Google\'s LiteRT-LM announcement adds a concrete edge-LLM stack: cross-platform CPU/GPU/NPU backends, session management, shared KV-cache locality, constrained decoding, function calling, and WebGPU browser inference: https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/.',
        'The browser standardization path matters too. The W3C Web Neural Network API defines a hardware-agnostic abstraction layer for using operating-system and hardware ML capabilities from the web, while calling out privacy and fingerprinting concerns: https://www.w3.org/TR/webnn/.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'A practical hybrid system keeps several ledgers. The route ledger stores route, reason, model version, cache key, device class, and policy version. The capability table maps device and OS versions to supported runtimes, accelerators, memory budgets, and max context. The manifest pins model hashes, adapter compatibility, rollback flags, and staged rollout cohorts. The eval ledger slices quality by device, route, language, task type, and context length. The privacy ledger defines which signals can leave the device.',
        'These ledgers connect otherwise separate topics. Feature Flag Control Plane provides rollout and kill switches. Quantization and KV Cache Quantization & Compression make local and cloud memory budgets tractable. RAG Context Packing Token Budget and Lost in the Middle reduce context waste. Semantic Cache for LLMs and exact caches lower repeated work. Tail Latency & p99 Thinking keeps the user-facing experience honest.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume on-device means no safety work. The app still owns guardrails, scoped UX, tool permissions, abuse handling, and quality checks. Do not assume local inference means all telemetry is forbidden; aggregate counters, opt-in samples, crash signals, and route reasons can preserve debugging without uploading raw prompts by default. Do not hide cloud fallback from product policy. Users, auditors, and developers need to know when data leaves the device.',
        'Do not ship a model update without rollback. A bad cloud model can be switched server-side. A bad local model may sit on millions of devices until the next update channel works. Versioned manifests, signed hashes, adapter compatibility, staged cohorts, and feature flags are part of the inference system, not deployment afterthoughts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Android Gemini Nano docs at https://developer.android.com/ai/gemini-nano, Apple Foundation Models update at https://machinelearning.apple.com/research/apple-foundation-models-2025-updates, Google LiteRT docs at https://developers.google.com/edge/litert, Google LiteRT-LM announcement at https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/, and W3C WebNN at https://www.w3.org/TR/webnn/. Study AI Engineering Stack: Five Parts Primer, LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, LLM Inference Scaling Playbook, KV Cache Concurrency Capacity Model, Quantization, Sliding-Window Attention Context Policy, Semantic Cache for LLMs, RAG Context Packing Token Budget, Feature Flag Control Plane, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
