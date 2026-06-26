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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the cost-crossover view as a comparison between fixed cost and marginal cost. Cloud inference charges every request through remote compute, network, and serving overhead. On-device inference pays a large upfront cost in model size, integration, update, and battery use, then serves some requests locally. Active marks the route currently cheaper for the next request.',
        {type:"callout", text:"On-device inference is a routing economics problem because it trades per-token cloud cost for fixed rollout, hardware, privacy, and update obligations."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/7/77/Raspberry_Pi_5_Hailo_AI_Accelerator_Module.jpg", alt:"Raspberry Pi 5 board with an attached Hailo AI accelerator module.", caption:"Hailo AI Accelerator Module attached to Raspberry Pi 5; photo by RetroEditor, CC BY 4.0, via Wikimedia Commons."},
        'In the hybrid-router view, a router decides local or cloud per request. A safe inference rule is this: local execution wins only when quality, latency, privacy, energy, and update constraints still hold after the nominal token cost looks cheaper.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM inference means running a language model to produce output tokens from input tokens. Cloud inference centralizes the model on servers. On-device inference runs a smaller or optimized model on a phone, laptop, car, camera, or embedded accelerator.',
        'The crossover exists because cloud and local cost curves have different shapes. Cloud cost is mostly per request or per token. On-device cost includes fixed engineering and distribution work, plus local energy, storage, thermal, and quality limits. At enough repeated use, local can become cheaper or more private for some requests.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious product plan is cloud-first. Send every request to a strong hosted model, centralize updates, monitor behavior, and scale servers as traffic grows. That is reasonable when quality is the top requirement or when the client hardware is weak.',
        'The opposite simple plan is local-first. Ship a model and avoid per-token server cost. That is reasonable for privacy-sensitive, offline, or high-frequency low-complexity tasks. It fails when the model is too large, too stale, too slow, or too expensive to update across many devices.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that neither path dominates all requests. A spelling suggestion, a short classification, and a private notification summary may run well locally. A complex reasoning task, long-context analysis, or fresh web-grounded answer may need cloud models and server-side tools.',
        'Average cost hides behavior. A local model that saves server dollars may drain battery, heat the device, or produce lower quality. A cloud model that gives the best answer may add network latency, privacy exposure, and variable serving cost.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat local and cloud inference as a routing decision under constraints. The router estimates request difficulty, token count, privacy class, freshness need, latency target, device state, and model capability. It then chooses the cheapest route that still meets the product contract.',
        'Cost is not only money. Battery, heat, model-download size, update cadence, failure recovery, and user trust are costs because they change system behavior. A correct crossover model counts the resource that becomes scarce in the real product.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request enters with input length, task type, user privacy setting, network state, and device telemetry such as battery and thermal state. The router checks whether a local model is installed and whether it can handle the task class. It also estimates cloud cost and latency.',
        'If the local route is allowed, the device runs the model and may return immediately. If confidence is low, the system can ask the cloud for verification or escalation. If local is blocked by quality, freshness, missing tools, or device state, the request goes to the cloud.',
        'A production system records route, token counts, latency, quality signals, fallback reason, and energy estimate. Those records update the crossover threshold. The threshold should move when cloud prices, model size, hardware capability, or user behavior changes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is constraint satisfaction before cost minimization. The router may choose the cheaper path only after required constraints pass: model capability, privacy policy, latency target, safety policy, and device health. If a constraint fails, the cheaper path is not a valid route.',
        'This avoids a common product bug. Saving 0.2 cents on a local request is not correct if the answer quality drops below the task threshold or the device overheats. Cost optimization is correct only inside the feasible set.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A simple crossover formula is fixed_local_cost / savings_per_request. If integration, testing, model hosting for downloads, and support cost $500,000, and each local request saves $0.0005 of cloud cost, the break-even point is 1,000,000,000 local requests. If the saving is $0.005, break-even falls to 100,000,000 requests.',
        'Device cost changes the threshold. A 3 GB model package may be unacceptable for many phones, while a 300 MB quantized model may be fine. Running locally can add 200 ms and burn battery on one device but be instant on a laptop with an accelerator. The router needs device-specific behavior, not one global slogan.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'On-device LLMs fit keyboard suggestions, notification summaries, private search over local files, meeting cleanup, camera or sensor interpretation, coding assistance on laptops, and offline enterprise workflows. The best tasks are frequent, short, privacy-sensitive, and tolerant of smaller local models.',
        'Hybrid routing fits assistants that need both privacy and capability. The device can handle easy or sensitive work locally and escalate harder tasks to cloud models. This keeps cloud spending focused on requests where the cloud path actually changes the outcome.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Local inference fails when quality gaps are user-visible, when the task needs fresh server data, or when the device cannot meet latency or energy targets. It also fails when model updates must be tightly controlled for safety or compliance. Shipping stale behavior to millions of devices can be expensive to undo.',
        'Cloud inference fails when network access is poor, privacy rules prohibit upload, traffic cost grows faster than revenue, or server latency dominates user experience. Hybrid systems fail when the router is opaque and users cannot predict where data goes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a notes app handles 50 million short summarization requests per month. Cloud cost is $0.0012 per request, so monthly cloud spend is $60,000. A local model can handle 70 percent of requests with acceptable quality, saving 35 million cloud calls and $42,000 per month.',
        'The local rollout costs $420,000 in engineering, evaluation, model packaging, telemetry, and support. At $42,000 saved per month, pure cloud-cost payback takes 10 months. If local execution raises support cost by $8,000 per month, net saving is $34,000 and payback becomes about 12.4 months.',
        'Now add behavior. If 10 percent of local summaries fail quality and need cloud retry, local saves only 31.5 million calls. If privacy-sensitive users value local-only mode enough to reduce churn, the product may accept a longer payback. The decision is economic, technical, and behavioral at once.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study current platform sources such as Apple on on-device foundation models at https://machinelearning.apple.com/research/introducing-apple-foundation-models, Android AI Edge at https://ai.google.dev/edge, and ONNX Runtime or llama.cpp deployment notes for local inference mechanics. Verify device support, model size, and accelerator claims against current vendor documentation.',
        'Next, study quantization, distillation, speculative decoding, model routing, token accounting, battery profiling, privacy threat models, federated evaluation, and cloud serving cost. The reusable lesson is that local inference becomes correct only when the route is cheaper and still satisfies the user contract.',
      ],
    },
  ],
};
