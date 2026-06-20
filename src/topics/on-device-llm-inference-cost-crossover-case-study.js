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
      heading: 'Why the Cost Crossover Matters',
      paragraphs: [
        "On-device LLM inference changes the unit economics of an AI product. Cloud inference prices each request against shared GPUs, shared KV-cache memory, queueing, networking, operations, and provider margin. Device inference moves part of that cost into model packaging, app size, update delivery, hardware capability detection, battery, thermal budget, and local runtime engineering. The result is a crossover: some workloads are cheaper or better in the cloud, while others become better on the user device.",
        "The crossover is not simply 'cloud expensive, device free.' Device inference is not free. It uses user-owned hardware, drains power, occupies storage, and forces the product team to support fragmented CPUs, GPUs, NPUs, operating systems, and model-package versions. But its marginal cost for repeated local use can be close to zero from the service operator perspective, which changes the economics of high-frequency, private, offline, or ambient features.",
        "The practical system is therefore hybrid. A product needs a router that can choose cache, device, or cloud for each request. It also needs ledgers for device capability, model manifests, route reasons, privacy boundaries, eval slices, and rollback state. Without those data structures, on-device inference becomes a pile of hidden special cases.",
        {type:"callout", text:"On-device inference is a routing economics problem because it trades per-token cloud cost for fixed rollout, hardware, privacy, and update obligations."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/7/77/Raspberry_Pi_5_Hailo_AI_Accelerator_Module.jpg", alt:"Raspberry Pi 5 board with an attached Hailo AI accelerator module.", caption:"Hailo AI Accelerator Module attached to Raspberry Pi 5; photo by RetroEditor, CC BY 4.0, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'The Naive Product Plans',
      paragraphs: [
        "The first naive plan is all cloud. It is operationally clean: one model fleet, one monitoring plane, fast rollback, strong models, centralized abuse controls, and easier evaluation. It also means every prompt consumes shared serving capacity. As usage grows, the product pays repeatedly for small tasks that may not need frontier capability.",
        "The second naive plan is all device. It sounds attractive because prompts stay local and the cloud bill falls. In practice, it fails whenever a device lacks memory or accelerator support, the task needs a larger model, the context is too long, policy requires server-side monitoring, or a model update has not reached the user yet.",
        "The real plan is a policy router with boring rules. Repeated stable intents can hit a cache. Small private tasks can stay local. Hard reasoning, long context, unsupported hardware, or regulated decisions can route to cloud. The router must produce a reason, not just a hidden branch.",
      ],
    },
    {
      heading: 'Core Cost Model',
      paragraphs: [
        "A cloud path has a variable cost surface. Prefill cost grows with input tokens. Decode cost grows with output tokens. KV-cache residency consumes scarce memory while users are active. Tail latency rises under load. The service operator pays for fleet capacity, failover, observability, security, and model updates. The cost is easy to meter but scales with usage.",
        "A device path has more fixed and lumpy costs. The product ships a model package, keeps runtime compatibility tables, stages updates, supports quantized weights and KV cache, tests hardware backends, and maintains fallback routes. Once the model is present and the task fits, repeated local calls do not consume the cloud GPU pool. That is where always-on and high-frequency features become interesting.",
        "The crossover point depends on prompts per user, task difficulty, model size, context length, cache hit rate, device mix, network conditions, and quality floor. A rough ledger row should include cloud tokens avoided, local latency, power budget, model update cost, storage footprint, fallback rate, and quality delta. The decision is not global. It is per workload and per device class.",
      ],
    },
    {
      heading: 'What the Animation Teaches',
      paragraphs: [
        "The cost-crossover view shows why the same prompt can belong on different routes at different usage levels. The cloud line rises with use because every request consumes shared serving capacity. The device line is flatter because much of the cost has already been paid through model distribution and local execution. The hybrid line is not a compromise for its own sake; it is the shape you get when easy local work, repeated cacheable work, and hard cloud work are separated.",
        "The hybrid-router view shows that routing is also a state-boundary problem. Prompts, KV state, cache keys, traces, adapters, and route reasons have different owners and privacy constraints. A local path that uploads raw prompts for debugging has quietly destroyed the privacy value of local inference. A cloud fallback hidden inside the router has quietly changed the product promise.",
      ],
    },
    {
      heading: 'Hybrid Router Data Structures',
      paragraphs: [
        "The route ledger stores one row per decision: request class, privacy level, offline state, device class, model version, context length, cacheability, latency budget, quality requirement, chosen route, and reason. This ledger lets engineers debug why two similar prompts took different paths.",
        "The capability table maps devices and operating systems to supported runtimes, accelerators, memory budgets, max context, quantization formats, and known failure modes. The manifest pins model hashes, base-model versions, adapter compatibility, staged rollout cohorts, expiration rules, and kill switches. The privacy ledger states which counters, samples, crash reports, and route reasons may leave the device.",
        "The eval ledger closes the loop. It records local quality by device class, language, task type, model package, and route. A small local model can be excellent for extraction and rewriting while weak for open-ended reasoning. The router should know that instead of pretending the local model is a smaller version of the cloud model.",
      ],
    },
    {
      heading: 'Mechanism: Request Flow',
      paragraphs: [
        "A request first passes through cheap classification. Is the user offline? Does the prompt contain local-only data? Is the task in a known bounded category such as rewrite, classify, summarize, extract, translate, or draft a tool payload? Is the expected context too long for the local window? Is the answer high risk? Is there a stable cache hit?",
        "The router then chooses a route. Cache wins when the intent and freshness rules are safe. Device wins when privacy, offline state, low latency, or high repetition matter and the task fits the local model. Cloud wins when the device lacks capability, the context is too long, the answer needs stronger quality, or policy requires server-side controls. The route result should include a reason code and the model or cache version used.",
        "After generation, safety and observability run within the route boundaries. Local generation can still use local guardrails and scoped UI. Cloud generation can use richer moderation and logging. Telemetry from the device should prefer aggregate counters, opt-in samples, crash reports, route reasons, and eval slices over raw prompt upload.",
      ],
    },
    {
      heading: 'Worked Example: Ambient Writing Help',
      paragraphs: [
        "Consider a writing assistant inside a mobile keyboard. Users ask for tiny rewrites, tone changes, grammar fixes, and summaries many times per day. Sending every keystroke-adjacent request to a cloud model creates privacy concern, network dependence, and a per-token bill for a task that often has narrow quality requirements.",
        "The local route can handle bounded transformations with a compact quantized model. It keeps draft text on device, works offline, and avoids cloud metering for high-frequency interactions. The cloud route remains available for long documents, complex reasoning, unsupported devices, or explicit user requests for a stronger model. A semantic cache may answer repeated template-like requests.",
        "The crossover is visible in the ledger. Low-use users on unsupported devices may remain cloud-first. Heavy users with capable devices shift much of the volume local. Enterprise tenants with strict logging requirements may prefer cloud despite higher token cost. The right answer is not a slogan; it is a routed policy with measurable costs.",
      ],
    },
    {
      heading: 'Model Packages and Rollout',
      paragraphs: [
        "On-device inference turns model serving into software distribution. A server-side model swap can be reversed centrally. A local model package may be downloaded to millions of devices, cached across app versions, paired with adapters, and loaded under different thermal and memory conditions. That requires a control plane.",
        "A safe rollout starts with a signed manifest. The manifest states model hash, compatible app versions, base-model version, adapter versions, hardware requirements, context limits, staged rollout cohort, expiry, and rollback flag. Devices check capability before download, verify the hash, install atomically, and keep a known-good fallback. Canary cohorts run eval slices and crash monitoring before broad release.",
        "This is where Feature Flag Control Plane connects directly to inference. Kill switches, staged rollout, manifest TTLs, and capability gates are not deployment extras. They are the difference between a recoverable local model bug and a long-lived client-side incident.",
      ],
    },
    {
      heading: 'Why the Hybrid Approach Works',
      paragraphs: [
        "The hybrid design works because different workloads stress different bottlenecks. Cloud is strong where capability, long context, centralized monitoring, and fast model iteration matter. Device is strong where privacy, offline use, low marginal cost, and immediate local interaction matter. Cache is strong where intent repeats and freshness is manageable.",
        "It also works because it turns routing into explicit state. The system can log that a request used device route because it was private and short, or cloud route because context exceeded the local budget. Those reasons make cost reviews, privacy reviews, incident response, and eval failures tractable.",
        "The important invariant is that each route has a quality floor. The device route should not silently answer tasks it is known to fail. The cloud route should not silently receive private local data that product policy promised to keep on the device. The cache route should not return stale or mismatched answers just to save tokens.",
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        "Cloud costs are easier to observe and control centrally. Device costs are partly paid by the user experience: storage, battery, heat, slower answers on weak hardware, and larger downloads. Moving work local can lower cloud spend while making product quality more variable across devices.",
        "Observability is a real tradeoff. Cloud systems can capture traces, sample prompts under policy, monitor failures, and patch quickly. Local systems need privacy-preserving telemetry. Aggregate counters and route reasons may show that something is wrong, but they often provide less detail than server logs. That makes pre-release evals and opt-in diagnostics more important.",
        "Quality is the other tradeoff. Small local models need scoped tasks, guided generation, tool constraints, retrieval help, or cloud fallback. Treating a compact device model as a frontier assistant is how local inference becomes visibly worse while still being expensive to maintain.",
      ],
    },
    {
      heading: 'Where It Wins and Fails',
      paragraphs: [
        "On-device inference wins for private rewriting, extraction from local text, offline translation, accessibility features, summarization of local notifications, lightweight classification, local tool argument drafting, and ambient assistants that would be too expensive to meter constantly through cloud GPUs.",
        "It fails when the task needs a model too large for the device, a context window too long for local memory, strong centralized audit, immediate revocation, or uniform behavior across a fragmented hardware base. It also fails when the organization does not have the release engineering discipline to ship, monitor, and roll back model packages.",
        "A hybrid system is usually the durable answer. It lets the product exploit local strengths without pretending every user has the same device or every task needs the same model.",
      ],
    },
    {
      heading: 'Case Studies and Sources',
      paragraphs: [
        "Android Gemini Nano is a system-level example. The Android developer docs describe on-device generative AI as useful when low cost and privacy safeguards matter, with AICore managing Gemini Nano access, updates, safety features, and device hardware use: https://developer.android.com/ai/gemini-nano.",
        "Apple exposes a compact on-device foundation model through its Foundation Models framework. Apple reports an approximately 3B-parameter on-device model, KV-cache memory reductions, quantized weights and KV cache, guided generation, tool calling, adapters, and a complementary server model for more complex tasks: https://machinelearning.apple.com/research/apple-foundation-models-2025-updates.",
        "Google LiteRT is the runtime side of the same pattern: an on-device framework for ML and GenAI deployment, conversion, optimization, quantization, accelerator selection, and deployment across mobile, desktop, web, and constrained devices: https://developers.google.com/edge/litert. Google's LiteRT-LM announcement adds cross-platform CPU, GPU, and NPU backends, session management, shared KV-cache locality, constrained decoding, function calling, and WebGPU browser inference: https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/.",
        "The browser standardization path matters too. The W3C Web Neural Network API defines a hardware-agnostic abstraction layer for using operating-system and hardware ML capabilities from the web, while calling out privacy and fingerprinting concerns: https://www.w3.org/TR/webnn/.",
      ],
    },
    {
      heading: 'Misconceptions to Avoid',
      paragraphs: [
        "Do not assume on-device means no safety work. The app still owns guardrails, scoped UX, tool permissions, abuse handling, and quality checks. Local generation can still produce bad output or unsafe tool arguments.",
        "Do not assume local means no telemetry. The question is which telemetry is allowed. Aggregate counters, opt-in samples, crash signals, route reasons, and slice-level evals can preserve debugging without uploading raw prompts by default.",
        "Do not hide fallback. Users, auditors, and developers need to know when data leaves the device. A hybrid system that silently sends private local prompts to cloud has broken its own boundary. A hybrid system that never falls back can leave users with a weak answer when the local model is out of depth.",
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources: Android Gemini Nano docs at https://developer.android.com/ai/gemini-nano, Apple Foundation Models update at https://machinelearning.apple.com/research/apple-foundation-models-2025-updates, Google LiteRT docs at https://developers.google.com/edge/litert, Google LiteRT-LM announcement at https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/, and W3C WebNN at https://www.w3.org/TR/webnn/.",
        "Study AI Engineering Stack: Five Parts Primer, LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, LLM Inference Scaling Playbook, KV Cache Concurrency Capacity Model, Quantization, KV Cache Quantization and Compression, Sliding-Window Attention Context Policy, Semantic Cache for LLMs, RAG Context Packing Token Budget, Feature Flag Control Plane, and Tail Latency and p99 Thinking next.",
      ],
    },
  ],
};
