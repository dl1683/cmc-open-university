// Replica-level LLM routing: combine cache locality, queue depth, SLO class,
// policy gates, and cost before selecting the serving worker.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'slo-aware-llm-request-router-case-study',
  title: 'SLO-Aware LLM Request Router',
  category: 'Systems',
  summary: 'A replica-routing case study for LLM serving: score queue depth, prefix or KV-cache locality, SLO class, privacy policy, cost, fallback, and route telemetry.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['scoreboard router', 'cache locality', 'slo audit'], defaultValue: 'scoreboard router' },
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

function routerGraph(title) {
  return graphState({
    nodes: [
      { id: 'ing', label: 'ing', x: 0.6, y: 3.5, note: 'model id' },
      { id: 'route', label: 'route', x: 2.0, y: 3.5, note: 'policy' },
      { id: 'prefix', label: 'prefix', x: 3.7, y: 1.3, note: 'hash' },
      { id: 'queue', label: 'queue', x: 3.7, y: 2.8, note: 'load' },
      { id: 'slo', label: 'SLO', x: 3.7, y: 4.3, note: 'class' },
      { id: 'deny', label: 'deny', x: 3.7, y: 5.8, note: 'policy' },
      { id: 'a', label: 'A', x: 5.8, y: 1.7, note: 'hit' },
      { id: 'b', label: 'B', x: 5.8, y: 3.5, note: 'fast' },
      { id: 'c', label: 'C', x: 5.8, y: 5.3, note: '0%' },
      { id: 'pick', label: 'pick', x: 7.6, y: 3.5, note: 'score' },
      { id: 'span', label: 'span', x: 9.0, y: 2.2, note: 'trace' },
      { id: 'fb', label: 'fb', x: 9.0, y: 4.8, note: 'fail' },
    ],
    edges: [
      { id: 'e-ing-route', from: 'ing', to: 'route' },
      { id: 'e-route-prefix', from: 'route', to: 'prefix' },
      { id: 'e-route-queue', from: 'route', to: 'queue' },
      { id: 'e-route-slo', from: 'route', to: 'slo' },
      { id: 'e-route-deny', from: 'route', to: 'deny' },
      { id: 'e-prefix-a', from: 'prefix', to: 'a', weight: 'hit' },
      { id: 'e-queue-b', from: 'queue', to: 'b', weight: 'low q' },
      { id: 'e-slo-b', from: 'slo', to: 'b', weight: 'p99' },
      { id: 'e-deny-fb', from: 'deny', to: 'fb', weight: '' },
      { id: 'e-a-pick', from: 'a', to: 'pick' },
      { id: 'e-b-pick', from: 'b', to: 'pick' },
      { id: 'e-c-pick', from: 'c', to: 'pick' },
      { id: 'e-pick-span', from: 'pick', to: 'span' },
      { id: 'e-pick-fb', from: 'pick', to: 'fb', weight: '' },
    ],
  }, { title });
}

function localityGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.6, y: 3.5, note: 'tokens' },
      { id: 'tok', label: 'tok', x: 1.9, y: 3.5, note: 'ids' },
      { id: 'key', label: 'key', x: 3.2, y: 3.5, note: 'blocks' },
      { id: 'idx', label: 'index', x: 4.8, y: 3.5, note: 'KV map' },
      { id: 'pod1', label: 'pod1', x: 6.5, y: 1.6, note: '70%' },
      { id: 'pod2', label: 'pod2', x: 6.5, y: 3.5, note: '20%' },
      { id: 'pod3', label: 'pod3', x: 6.5, y: 5.4, note: '0%' },
      { id: 'evict', label: 'evict', x: 8.0, y: 1.6, note: 'stale' },
      { id: 'route', label: 'route', x: 8.0, y: 3.5, note: 'best' },
      { id: 'mm', label: 'mm', x: 8.0, y: 5.4, note: 'image' },
    ],
    edges: [
      { id: 'e-req-tok', from: 'req', to: 'tok' },
      { id: 'e-tok-key', from: 'tok', to: 'key' },
      { id: 'e-key-idx', from: 'key', to: 'idx' },
      { id: 'e-idx-pod1', from: 'idx', to: 'pod1', weight: 'hit' },
      { id: 'e-idx-pod2', from: 'idx', to: 'pod2', weight: 'maybe' },
      { id: 'e-idx-pod3', from: 'idx', to: 'pod3', weight: 'cold' },
      { id: 'e-pod1-evict', from: 'pod1', to: 'evict' },
      { id: 'e-pod1-route', from: 'pod1', to: 'route' },
      { id: 'e-pod2-route', from: 'pod2', to: 'route' },
      { id: 'e-mm-key', from: 'mm', to: 'key', weight: 'hash' },
    ],
  }, { title });
}

function scorePlot(markers = []) {
  return plotState({
    axes: { x: { label: 'queue depth', min: 0, max: 10 }, y: { label: 'route score', min: 0, max: 10 } },
    series: [
      { id: 'cache', label: 'cache hit', points: [{ x: 0, y: 9.5 }, { x: 2, y: 9.0 }, { x: 4, y: 7.6 }, { x: 7, y: 4.8 }, { x: 10, y: 2.0 }] },
      { id: 'fresh', label: 'cold fast', points: [{ x: 0, y: 7.2 }, { x: 2, y: 6.8 }, { x: 4, y: 5.8 }, { x: 7, y: 3.6 }, { x: 10, y: 1.4 }] },
      { id: 'slo', label: 'SLO route', points: [{ x: 0, y: 8.4 }, { x: 2, y: 8.2 }, { x: 4, y: 7.0 }, { x: 7, y: 3.0 }, { x: 10, y: 0.8 }] },
    ],
    markers,
  });
}

function* scoreboardRouter() {
  yield {
    state: routerGraph('Request routing is replica selection'),
    highlight: { active: ['ing', 'route', 'prefix', 'queue', 'slo', 'deny', 'e-ing-route'], compare: ['a', 'b', 'c'] },
    explanation: 'Ingress routing picks the model or deployment. Request routing picks the replica for that model. An LLM router should score cache locality, queue depth, SLO class, policy, and fallback before choosing a worker.',
  };

  yield {
    state: labelMatrix(
      'Replica scoreboard',
      [
        { id: 'a', label: 'gpuA' },
        { id: 'b', label: 'gpuB' },
        { id: 'c', label: 'gpuC' },
        { id: 'fb', label: 'fallback' },
      ],
      [
        { id: 'cache', label: 'cache' },
        { id: 'queue', label: 'queue' },
        { id: 'slo', label: 'SLO' },
        { id: 'policy', label: 'policy' },
        { id: 'score', label: 'score' },
      ],
      [
        ['80%', '7', 'risk', 'ok', 'hold'],
        ['40%', '2', 'ok', 'ok', 'win'],
        ['0%', '1', 'ok', 'ok', 'maybe'],
        ['none', '0', 'late', 'deny', 'safe'],
      ],
    ),
    highlight: { active: ['b:score', 'b:queue', 'b:slo'], compare: ['a:cache', 'a:queue'], found: ['fb:policy'] },
    explanation: 'The best cache hit is not always the best route. A hot replica with a deep queue can lose to a weaker hit if the request is interactive and the SLO budget is tight.',
    invariant: 'A route is acceptable only if it passes policy before optimization.',
  };

  yield {
    state: scorePlot([
      { id: 'pick', x: 2, y: 8.2, label: 'pick' },
      { id: 'bad', x: 8, y: 3.8, label: 'over q' },
    ]),
    highlight: { active: ['slo', 'pick'], compare: ['cache', 'bad'], found: ['fresh'] },
    explanation: 'The score can reward locality and penalize queue depth. SLO-sensitive traffic needs a steeper load penalty than batch traffic because waiting behind long decodes spends user-visible latency budget.',
  };

  yield {
    state: labelMatrix(
      'Route rules',
      [
        { id: 'shared', label: 'shared' },
        { id: 'long', label: 'long' },
        { id: 'tenant', label: 'tenant' },
        { id: 'burn', label: 'burn' },
        { id: 'cold', label: 'cold' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['prefix', 'seek hit'],
        ['prompt', 'P/D pool'],
        ['privacy', 'pin tier'],
        ['p99 high', 'shed'],
        ['no hit', 'pow2'],
      ],
    ),
    highlight: { active: ['shared:action', 'long:action', 'burn:action'], compare: ['tenant:signal'], found: ['cold:action'] },
    explanation: 'A production router is a rule table plus a scorer. Shared prefixes route toward reuse. Long prompts may route to prefill/decode pools. Privacy can restrict eligible replicas. Burned p99 budget can trigger shedding or fallback.',
  };

  yield {
    state: routerGraph('Every route emits an audit span'),
    highlight: { active: ['pick', 'span', 'fb', 'e-pick-span', 'e-pick-fb'], found: ['queue', 'slo'], compare: ['prefix'] },
    explanation: 'The route record should include model id, selected replica, cache score, queue depth, SLO class, policy gate, fallback reason, and observed TTFT/TPOT. Without that span, routing regressions become invisible.',
  };
}

function* cacheLocality() {
  yield {
    state: localityGraph('Cache locality needs an index'),
    highlight: { active: ['req', 'tok', 'key', 'idx', 'pod1', 'route', 'e-req-tok', 'e-tok-key', 'e-key-idx', 'e-idx-pod1'], compare: ['pod2', 'pod3'] },
    explanation: 'KV-aware routing needs a map from request prefix blocks to replicas that currently hold useful cache. Prefix-aware routing approximates that with stable prefix placement; precise KV-aware routing reasons about actual cache state.',
  };

  yield {
    state: labelMatrix(
      'Routing signals',
      [
        { id: 'pow2', label: 'pow2' },
        { id: 'sticky', label: 'sticky' },
        { id: 'prefix', label: 'prefix' },
        { id: 'kv', label: 'KV' },
        { id: 'mm', label: 'mm' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'good', label: 'good at' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['queues', 'balance', 'no reuse'],
        ['session', 'simple', 'hot spot'],
        ['tokens', 'APC', 'evicted'],
        ['blocks', 'real hit', 'stale'],
        ['image hash', 'vision', 'hash cost'],
      ],
    ),
    highlight: { active: ['prefix:good', 'kv:good', 'mm:signal'], compare: ['pow2:risk', 'sticky:risk'], found: ['kv:risk'] },
    explanation: 'Power-of-two routing balances load cheaply. Sticky routing preserves sessions. Prefix-aware routing helps vLLM automatic prefix caching. KV-aware routing is sharper because it asks which worker actually has the blocks after eviction.',
  };

  yield {
    state: localityGraph('Eviction makes stale locality dangerous'),
    highlight: { active: ['idx', 'pod1', 'evict', 'e-pod1-evict'], removed: ['e-pod1-route'], compare: ['route'] },
    explanation: 'A router-local prefix trie can become stale when the backend evicts cache. Precise KV-aware routing needs freshness signals, TTLs, backend metrics, or direct cache-index updates before it trusts locality.',
  };

  yield {
    state: labelMatrix(
      'Cache key gates',
      [
        { id: 'model', label: 'model' },
        { id: 'tok', label: 'tokens' },
        { id: 'adapter', label: 'adapter' },
        { id: 'pos', label: 'pos' },
        { id: 'img', label: 'image' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'miss', label: 'miss if' },
      ],
      [
        ['id', 'wrong base'],
        ['hash', 'edit'],
        ['LoRA', 'swap'],
        ['RoPE', 'shift'],
        ['mm hash', 'new img'],
      ],
    ),
    highlight: { active: ['model:field', 'tok:field', 'adapter:field'], found: ['img:field'], compare: ['pos:miss'] },
    explanation: 'The router cannot score locality from text alone. Model id, tokenizer output, adapter, position scheme, cache format, and multimodal hashes all define whether a cached prefix is actually reusable.',
  };

  yield {
    state: scorePlot([
      { id: 'local', x: 3, y: 8.4, label: 'local' },
      { id: 'cold', x: 1, y: 7.0, label: 'cold' },
    ]),
    highlight: { active: ['cache', 'local'], compare: ['fresh', 'cold'], found: ['slo'] },
    explanation: 'Locality should be a weighted signal, not an absolute command. A small queue plus cold cache may beat a cache hit on a replica that is already behind a long generation.',
  };
}

function* sloAudit() {
  yield {
    state: labelMatrix(
      'SLO classes',
      [
        { id: 'chat', label: 'chat' },
        { id: 'agent', label: 'agent' },
        { id: 'batch', label: 'batch' },
        { id: 'risk', label: 'risk' },
        { id: 'canary', label: 'canary' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'route', label: 'route' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['low TTFT', 'near hit', 'p99'],
        ['reuse', 'sticky', 'state'],
        ['$/tok', 'cheap', 'queue'],
        ['audit', 'private', 'deny'],
        ['learn', 'shadow', 'kill'],
      ],
    ),
    highlight: { active: ['chat:route', 'agent:route', 'risk:guard'], compare: ['batch:goal'], found: ['canary:guard'] },
    explanation: 'A route policy should vary by SLO class. Interactive chat values low TTFT. Agents value state reuse. Batch jobs tolerate queues. Regulated traffic may restrict replicas before any cost optimization.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'load %', min: 0, max: 100 }, y: { label: 'p99 ms', min: 0, max: 1200 } },
      series: [
        { id: 'blind', label: 'load only', points: [{ x: 10, y: 140 }, { x: 35, y: 210 }, { x: 60, y: 420 }, { x: 80, y: 760 }, { x: 95, y: 1150 }] },
        { id: 'aware', label: 'aware', points: [{ x: 10, y: 120 }, { x: 35, y: 160 }, { x: 60, y: 250 }, { x: 80, y: 430 }, { x: 95, y: 780 }] },
      ],
      markers: [
        { id: 'slo', x: 75, y: 500, label: 'SLO' },
      ],
    }),
    highlight: { active: ['aware', 'slo'], compare: ['blind'] },
    explanation: 'A cache-aware and SLO-aware router is trying to bend the p99 curve, not merely maximize average throughput. The route is wrong if it improves hit rate while burning the latency objective.',
  };

  yield {
    state: routerGraph('Fallback is part of routing'),
    highlight: { active: ['deny', 'fb', 'e-deny-fb', 'e-pick-fb'], found: ['slo', 'queue'], compare: ['a', 'b', 'c'] },
    explanation: 'Fallback actions include reject fast, route to a cheaper model, drop cache affinity, shed batch traffic, trigger scale-out, or ask the user to retry. Waiting in the wrong queue is also a route decision.',
  };

  yield {
    state: labelMatrix(
      'Failure audit',
      [
        { id: 'stale', label: 'stale' },
        { id: 'hot', label: 'hot spot' },
        { id: 'leak', label: 'leak' },
        { id: 'cost', label: 'cost' },
        { id: 'drift', label: 'drift' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['miss hit', 'TTL'],
        ['one pod', 'load cap'],
        ['bad tenant', 'policy'],
        ['GPU idle', '$/task'],
        ['rule rot', 'shadow'],
      ],
    ),
    highlight: { active: ['stale:control', 'hot:control', 'leak:control'], compare: ['cost:symptom'], found: ['drift:control'] },
    explanation: 'Router bugs look like systems bugs: stale cache indexes, hot shards, tenant-policy leaks, idle expensive hardware, and route rules that drift away from the workload.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'hit', label: 'hit' },
        { id: 'ttft', label: 'TTFT' },
        { id: 'tpot', label: 'TPOT' },
        { id: 'queue', label: 'queue' },
        { id: 'cost', label: 'cost' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['route', 'up'],
        ['p50/p99', 'SLO'],
        ['stream', 'safe'],
        ['depth', 'cap'],
        ['$/task', 'down'],
        ['canary', 'kill'],
      ],
    ),
    highlight: { active: ['hit:metric', 'ttft:metric', 'queue:metric', 'roll:gate'], compare: ['cost:gate'], found: ['tpot:gate'] },
    explanation: 'Ship the router with route-sliced hit rate, TTFT, TPOT, queue depth, cost per accepted task, shadow comparisons, canary controls, and a kill switch. Otherwise it is unobservable infrastructure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'scoreboard router') yield* scoreboardRouter();
  else if (view === 'cache locality') yield* cacheLocality();
  else if (view === 'slo audit') yield* sloAudit();
  else throw new InputError('Pick an LLM request-router view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An SLO-aware LLM request router chooses which serving replica should handle a request after the ingress layer has already selected the model or deployment. It is not the same as product-level model routing. It is replica-level control: pick the worker or pool that best satisfies cache locality, queue depth, latency objective, privacy policy, cost, and fallback constraints.',
        'Ray Serve LLM draws this boundary directly: ingress routing maps a model id to a deployment, while request routing chooses a replica inside that deployment. Its default policy uses power of two choices, and its prefix-aware policy routes similar prefixes toward the same replicas to improve vLLM automatic prefix caching: https://docs.ray.io/en/latest/serve/llm/architecture/routing-policies.html.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The first data structure is a route feature vector: model id, token prefix hash, expected input and output tokens, queue depth, active decode slots, cache hit estimate, SLO class, tenant or privacy boundary, adapter id, cost tier, and fallback eligibility. The second is a replica scoreboard that turns those features into a ranked route choice. The third is a route ledger that records the chosen replica, route scores, policy gates, cache result, queue wait, TTFT, TPOT, p99 slice, and fallback reason.',
        'This is why a generic Load Balancer is not enough for LLM serving. LLM replicas are stateful because KV cache, prefix cache, LoRA adapters, multimodal preprocessing, and decode queues differ by worker. A route that looks balanced by request count can be bad if it destroys cache locality or sends an interactive request behind long decodes.',
      ],
    },
    {
      heading: 'Cache-aware routing',
      paragraphs: [
        'vLLM Production Stack documents KV-cache-aware routing as sending incoming requests to the instance with the highest KV cache hit rate, instead of merely keeping identical prefixes sticky even after cache eviction: https://docs.vllm.ai/projects/production-stack/en/vllm-stack-0.1.8/use_cases/kv-cache-aware-routing.html. The important distinction is exact state: prefix-aware routing guesses from token-prefix similarity; KV-aware routing tries to use actual cache contents.',
        'The llm-d intelligent scheduling guide makes the same serving argument: prefill dominates time to first token for long prompts, vLLM prefix caching can skip shared prefill, and precise prefix cache mode can introspect each vLLM instance for actual KV entries when churn makes approximate routing weaker: https://developers.redhat.com/articles/2026/06/11/intelligent-inference-scheduling-llm-d-red-hat-ai.',
      ],
    },
    {
      heading: 'SLO and policy controls',
      paragraphs: [
        'Queue depth must be interpreted through the request SLO. Ray Serve autoscaling guidance uses ongoing requests per replica as a key signal and explicitly recommends load testing latency-sensitive workloads before choosing target ongoing request values: https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html. A router can use the same idea at request time: interactive traffic gets a stronger queue penalty than batch traffic.',
        'LLM Serving Admission-Control Goodput Gate is the preceding decision: if no route can finish before deadline, the system should reject, defer, or degrade before routing burns GPU time.',
        'LLM Serving Autoscaling Warm Pool is the downstream capacity loop: once new replicas are starting, the router must know which ones are hot, warm, cold, cache-empty, or safe to receive cache-insensitive traffic.',
        'KServe LLMInferenceService describes an architecture that combines vLLM execution, Kubernetes orchestration, llm-d intelligent routing, KV-cache-aware scheduling, prefill-decode separation, RBAC, monitoring, and metrics: https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-overview. That is the production boundary: routing is not only an algorithm, it is a governed control plane.',
      ],
    },
    {
      heading: 'Complete case study: enterprise copilot',
      paragraphs: [
        'A company runs a coding and research copilot. Short chat completions route to the lowest-queue replica that still has a useful prompt prefix. Long repository prompts route toward replicas with matching KV blocks or to a prefill/decode split. Agent turns prefer sticky state until the queue threatens p99. Regulated tenants can only use approved replicas and adapters. Batch summarization drops cache affinity when the fleet is busy. Every route writes a span so cost and quality can be audited by request class.',
        'Multimodal traffic adds another key. NVIDIA Dynamo documents multimodal KV routing where image content contributes routing metadata through an image hash before the KV router selects a backend worker: https://docs.nvidia.com/dynamo/user-guides/multimodal/multimodal-kv-routing. Prompt Cache-Key Canonicalization Ledger is the upstream companion: the router needs the same identity fields the model server needs to prove cache reuse is legal.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not optimize hit rate alone. A cache hit on an overloaded worker can be worse than a cold route with a short queue. Do not trust a stale prefix index after eviction. Do not route across tenant, adapter, tokenizer, model-version, or multimodal-hash boundaries. Do not hide fallback in application code; fallback is part of the route policy.',
        'Primary sources: Ray Serve request routing at https://docs.ray.io/en/latest/serve/llm/architecture/routing-policies.html, Ray Serve prefix-aware routing at https://docs.ray.io/en/latest/serve/llm/user-guides/prefix-aware-routing.html, vLLM Production Stack KV-cache-aware routing at https://docs.vllm.ai/projects/production-stack/en/vllm-stack-0.1.8/use_cases/kv-cache-aware-routing.html, Ray Serve autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html, llm-d intelligent inference scheduling at https://developers.redhat.com/articles/2026/06/11/intelligent-inference-scheduling-llm-d-red-hat-ai, KServe LLMInferenceService at https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-overview, and NVIDIA Dynamo multimodal KV routing at https://docs.nvidia.com/dynamo/user-guides/multimodal/multimodal-kv-routing. Study Load Balancer, Power of Two Choices Load Balancing, Consistent Hashing, LLM Serving Admission-Control Goodput Gate, LLM Serving Autoscaling Warm Pool, Prompt Cache-Key Canonicalization Ledger, Prefix Caching & RadixAttention, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, LLM Continuous Batching, Chunked Prefill Token Budget Scheduler, Tail Latency & p99 Thinking, Feature Flag Control Plane, Distributed Tracing, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
