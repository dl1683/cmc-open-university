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
      heading: 'Why this exists',
      paragraphs: [
        'An LLM serving fleet rarely has one kind of request. Some prompts are short chats, some are long-context coding tasks, some need low latency, some can wait, some require a stronger model, and some should be rejected before they harm p99 latency.',
        'An SLO-aware router exists to make those tradeoffs explicit. It sends each request to a model, replica, batch, or queue based on latency targets, cost, quality needs, cache locality, and current load.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious router is round robin. It balances request count, but request count is not work. A 200-token prompt and a 100,000-token prompt do not consume the same prefill memory, decode time, or cache capacity.',
        'Another tempting router is cheapest-model-first. That can lower cost for easy requests, but it can also violate quality requirements, overload a small model, or send hard requests down a path that causes retries and higher final cost.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The router should estimate work and risk before admission. Useful features include prompt tokens, expected output tokens, request class, deadline, user tier, model constraints, cache-key hit probability, current queue depth, KV memory pressure, and recent p99 latency.',
        'The decision is not only where to send the request. It may be admit, shed, downgrade, upgrade, queue, split, route to a cached prefix, or send to a verifier-backed path. SLO-aware routing is a control plane, not a load balancer label.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request arrives with metadata and a prompt. The router classifies it, estimates token work, checks policy, reads live fleet state, and chooses a route. The route can be a specific model, replica group, service tier, queue, or fallback plan.',
        'The router then records the decision and watches outcome metrics: time to first token, inter-token latency, total latency, cost, error, truncation, quality score, safety result, and cache behavior. Those outcomes update future routing policy.',
        'A good router distinguishes prefill pressure from decode pressure. Long prompts stress prefill and KV allocation. Long answers stress decode occupancy. Routing by raw request count hides both bottlenecks.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The queue view proves that equal requests are a fiction. Requests carry different token shapes, deadlines, and quality requirements. A router that ignores shape can make average utilization look fine while protected p99 slices fail.',
        'The decision-table view proves that routing is policy under evidence. Cache hit probability, queue age, model capability, and SLO budget all affect the decision. The router should explain why a request went where it went.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The router works when its predictions are good enough to prevent obvious mismatches. A long-context request should not land on a replica with tight KV memory. A low-risk classification task should not consume the most expensive model if a cheaper one meets quality.',
        'It also works through feedback. Routing policy should not be static folklore. If a route misses p99 or fails quality checks, the system should adjust admission, batching, fallback, or model choice.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The router adds latency, policy complexity, observability requirements, and failure modes. If the router is slow or unavailable, the serving stack can fail before a model sees the request.',
        'The tradeoff is global efficiency. A little routing overhead can prevent expensive overload, reduce tail latency, improve cache reuse, and reserve strong models for requests that need them. The value appears at fleet level, not in one isolated request.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'SLO-aware routing wins in multi-model products, enterprise tiers, coding assistants, agent platforms, mixed-context workloads, and fleets that combine GPUs with different memory and throughput profiles.',
        'It is especially useful when paired with prefix caching, continuous batching, prefill/decode disaggregation, semantic caching, verifier-guided routing, and admission control. Each mechanism supplies signals the router can use.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is optimizing the wrong metric. A router that lowers average latency while harming p99 for paid users is not SLO-aware. A router that lowers cost while increasing invalid answers is not successful.',
        'The second failure is stale fleet state. Queue depth, cache pressure, and failure rates change quickly. Routing on old telemetry can create oscillations or overload the route that looked healthy seconds ago.',
        'The third failure is unexplainable policy. When a request misses its SLO, operators need to know whether the cause was admission, model choice, queueing, batching, cache miss, or decode slowdown.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Define SLO classes before writing routing code. Decide which users, routes, and tasks are protected. Track time to first token, inter-token latency, total latency, cost, quality, and error separately.',
        'Use conservative fallbacks. If live telemetry is missing, choose a safe route or shed load rather than pretending the fleet is healthy. If model quality is uncertain, route to a verifier or stronger model for high-risk tasks.',
        'Log route decisions with enough context to audit them later: request class, token estimates, model candidates, cache signal, queue signal, chosen route, fallback path, and outcome.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine three incoming requests: a short support question, a long repository analysis, and a high-risk legal summary. Round robin treats them as peers. An SLO-aware router sees different token shapes, quality risk, and deadlines.',
        'The support question may go to a cheaper model with a short queue. The repository analysis may need a long-context route with enough KV memory and a prefix-cache signal. The legal summary may need a stronger model plus verifier or citation checks, even if that costs more.',
        'If the long-context route is under KV pressure, the router may queue, shed, or ask for a shorter context rather than damaging every active stream. That is the point: route choice is a fleet health decision, not only a model preference.',
      ],
    },
    {
      heading: 'How to tune it',
      paragraphs: [
        'Start with simple policies and hard guardrails. Protect maximum prompt length, maximum expected output, per-tier deadlines, and known high-risk tasks before adding learned routing. A bad learned router can make incidents harder to debug.',
        'Then add feedback. Compare predicted cost and latency with actual outcomes. Track when fallback routes saved a request and when they hid a deeper capacity issue. Route policy should improve from evidence, not from static intuition.',
        'Finally, keep quality in the loop. A route that meets latency but produces unsupported answers is not successful. SLOs for LLM products often need both service metrics and answer-quality metrics.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'The dangerous router is the one that looks efficient during normal load and collapses during a burst. Protect the control plane: routing decisions should remain fast, explainable, and conservative when telemetry is partial or the fleet is already unhealthy.',
        'Watch decision churn. If similar requests bounce between routes because queue depth changes every second, the router may create oscillation instead of stability. Hysteresis, admission limits, and per-class budgets can matter more than a more clever scoring function.',
        'Quality drift also needs its own alarm. A cheap route may satisfy latency for weeks while slowly failing harder prompts, new languages, or high-stakes domains. Sampled evaluation, verifier outcomes, and human escalations should feed routing policy, not sit in a separate quality report.',
      ],
    },
    {
      heading: 'Common misconception',
      paragraphs: [
        'The misconception is that a router is just a load balancer with model names attached. A normal load balancer tries to distribute work across similar backends. An LLM router often chooses among different costs, qualities, context limits, cache states, memory pressures, and risk levels.',
        'That makes the routing decision part of product behavior. A different route can change latency, answer quality, citation reliability, and cost. The policy therefore belongs in the same conversation as SLO design, model evaluation, and incident response.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LLM Continuous Batching, Length-Aware Batching, Chunked Prefill, PagedAttention, Prefix Caching, Tail Latency, Admission Control, Circuit Breakers, Semantic Cache, and Heterogeneous AI Compute Router. A useful exercise is to route the same prompt under three conditions: empty fleet, KV pressure, and p99 incident.',
      ],
    },
  ],
};
