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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each request as work with shape, risk, deadline, and cost. Active queues are candidates being considered, visited signals are measurements already used, and the chosen route is a policy decision under current fleet state. The safe inference is that equal request count is not equal load.',
        {type:'callout', text:'An LLM router is a control plane that scores work, risk, cache locality, and live fleet state before admission.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LLM, or large language model, service handles short chats, long coding tasks, cached-prefix continuations, high-risk summaries, and low-value background work. An SLO is a service-level objective, such as p99 latency below 8 seconds for paid chat. A router exists because the same fleet cannot treat every prompt as the same unit of work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious router is round robin across replicas. It balances request count, but a 200-token prompt and a 100,000-token prompt do not use the same prefill time, KV memory, or decode occupancy. Cheapest-model-first is also tempting, but retries and bad answers can make it more expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is tail behavior. A few long prompts can fill KV cache memory, the key-value attention state held for generation, delay decode streams, and push p99 over the SLO while average latency still looks acceptable. Routing by backend count misses the actual bottleneck: token shape, queue age, cache locality, and quality risk.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Route by predicted work and consequence. Useful signals include prompt tokens, expected output tokens, deadline, user tier, model capability, cache hit probability, current queue depth, KV pressure, fallback rate, and recent p99. The decision can be admit, queue, shed, downgrade, upgrade, or send to a verifier-backed path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The router classifies the request, estimates token work, checks policy, reads live fleet state, scores candidate routes, and records the decision. Outcomes such as time to first token, total latency, cost, error, quality score, cache result, and fallback path feed future policy. A conservative router must behave safely when telemetry is missing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is an SLO invariant: protected classes should not be sacrificed by work that could have been delayed or rejected. If a route lacks KV headroom for a long-context request, sending it there is predictably unsafe. Feedback closes the loop by comparing predicted latency and quality with observed outcomes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The router adds a control-plane hop, policy code, telemetry dependencies, and incident modes. If scoring takes 8 ms, that overhead is small compared with a 6-second generation but large for a 40 ms embedding call. The behavior benefit appears at fleet level: fewer overload cascades, better cache reuse, and fewer strong-model calls for easy work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits multi-model chat products, coding assistants, agent platforms, enterprise tiers, prefill/decode-disaggregated fleets, and heterogeneous GPU pools. It is strongest when requests vary widely in context length, answer length, quality risk, and cache reuse.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the optimized metric is wrong. Lower average latency with worse paid-user p99 is not SLO-aware, and lower cost with unsupported answers is not success. Stale telemetry can also create oscillation as many routers chase the same route that looked healthy seconds ago.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three requests arrive: a 300-token support answer due in 2 seconds, a 90,000-token repo analysis due in 45 seconds, and a legal summary due in 12 seconds with high quality risk. Round robin may send all three to similar queues. An SLO router sends support to a cheap low-latency model, repo analysis to a long-context route with 14 GB KV headroom, and legal summary to a stronger model plus citation verifier.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study tail latency, SLOs, admission control, circuit breakers, continuous batching, length-aware batching, chunked prefill, PagedAttention, prefix caching, semantic caching, verifier routing, and heterogeneous accelerator scheduling. Then inspect route logs because route choice is product behavior.',
      ],
    },
  ],
};
