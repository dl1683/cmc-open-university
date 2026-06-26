// NVIDIA Dynamo distributed inference: coordinate engines, routers, KV transfer,
// cache tiers, and autoscaling across a datacenter-scale serving fleet.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nvidia-dynamo-distributed-inference-control-plane-case-study',
  title: 'NVIDIA Dynamo Distributed Inference Control Plane',
  category: 'Systems',
  summary: 'A distributed inference control-plane case study: disaggregated serving, KV-aware routing, multi-tier cache, worker pools, NIXL transfer, autoscaling, and engine coordination.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['control plane', 'disaggregated route'], defaultValue: 'control plane' },
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

function planeGraph(title) {
  return graphState({
    nodes: [
      { id: 'front', label: 'front', x: 0.6, y: 3.5, note: 'API' },
      { id: 'router', label: 'router', x: 2.0, y: 3.5, note: 'policy' },
      { id: 'prefill', label: 'pre', x: 3.8, y: 1.8, note: 'pool' },
      { id: 'decode', label: 'dec', x: 3.8, y: 5.2, note: 'pool' },
      { id: 'kvx', label: 'NIXL', x: 5.5, y: 3.5, note: 'KV xfer' },
      { id: 'cache', label: 'cache', x: 7.1, y: 1.8, note: 'tiers' },
      { id: 'engine', label: 'engine', x: 7.1, y: 5.2, note: 'vLLM/SGL' },
      { id: 'scale', label: 'scale', x: 8.8, y: 3.5, note: 'fleet' },
    ],
    edges: [
      { id: 'e-front-router', from: 'front', to: 'router' },
      { id: 'e-router-prefill', from: 'router', to: 'prefill' },
      { id: 'e-router-decode', from: 'router', to: 'decode' },
      { id: 'e-prefill-kvx', from: 'prefill', to: 'kvx', weight: 'KV' },
      { id: 'e-kvx-decode', from: 'kvx', to: 'decode', weight: 'KV' },
      { id: 'e-router-cache', from: 'router', to: 'cache', weight: 'hit?' },
      { id: 'e-cache-kvx', from: 'cache', to: 'kvx' },
      { id: 'e-decode-engine', from: 'decode', to: 'engine' },
      { id: 'e-prefill-engine', from: 'prefill', to: 'engine' },
      { id: 'e-engine-scale', from: 'engine', to: 'scale' },
      { id: 'e-cache-scale', from: 'cache', to: 'scale' },
    ],
  }, { title });
}

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.6, y: 3.5, note: 'prompt' },
      { id: 'class', label: 'class', x: 2.1, y: 3.5, note: 'SLO' },
      { id: 'hit', label: 'hit', x: 3.7, y: 1.7, note: 'prefix' },
      { id: 'miss', label: 'miss', x: 3.7, y: 5.3, note: 'cold' },
      { id: 'pre', label: 'pre', x: 5.5, y: 5.3, note: 'make KV' },
      { id: 'move', label: 'move', x: 6.8, y: 3.5, note: 'KV' },
      { id: 'dec', label: 'dec', x: 8.2, y: 3.5, note: 'tokens' },
      { id: 'trace', label: 'trace', x: 9.4, y: 3.5, note: 'p99' },
    ],
    edges: [
      { id: 'e-req-class', from: 'req', to: 'class' },
      { id: 'e-class-hit', from: 'class', to: 'hit' },
      { id: 'e-class-miss', from: 'class', to: 'miss' },
      { id: 'e-hit-move', from: 'hit', to: 'move', weight: 'reuse' },
      { id: 'e-miss-pre', from: 'miss', to: 'pre' },
      { id: 'e-pre-move', from: 'pre', to: 'move', weight: 'NIXL' },
      { id: 'e-move-dec', from: 'move', to: 'dec' },
      { id: 'e-dec-trace', from: 'dec', to: 'trace' },
    ],
  }, { title });
}

function* controlPlane() {
  yield {
    state: planeGraph('Dynamo coordinates the inference fleet'),
    highlight: { active: ['front', 'router', 'prefill', 'decode', 'kvx', 'cache', 'engine'], found: ['scale'] },
    explanation: 'Dynamo is best taught as the control plane above engines. It does not replace vLLM, SGLang, or TensorRT-LLM; it coordinates routing, prefill/decode separation, KV transfer, cache tiers, and scaling across a fleet.',
  };

  yield {
    state: labelMatrix(
      'Control records',
      [
        { id: 'route', label: 'route' },
        { id: 'pre', label: 'pre' },
        { id: 'dec', label: 'dec' },
        { id: 'kv', label: 'KV' },
        { id: 'cache', label: 'cache' },
        { id: 'scale', label: 'scale' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'writes', label: 'writes' },
      ],
      [
        ['SLO', 'pick'],
        ['prompt', 'blocks'],
        ['blocks', 'tokens'],
        ['ids', 'xfer'],
        ['prefix', 'evict'],
        ['load', 'replicas'],
      ],
    ),
    highlight: { active: ['route:writes', 'kv:writes', 'scale:writes'], compare: ['cache:reads'] },
    explanation: 'The control plane is a set of ledgers: routing decisions, prefill workers, decode workers, KV-transfer handles, cache residency, and autoscaling state. Without those records, disaggregation becomes guesswork.',
  };

  yield {
    state: planeGraph('Engines become interchangeable workers'),
    highlight: { active: ['engine', 'prefill', 'decode', 'router', 'e-prefill-engine', 'e-decode-engine'], compare: ['cache'], found: ['scale'] },
    explanation: 'A fleet-level orchestrator can place different engines behind the same policy boundary: vLLM for flexible serving, SGLang for structured programs, TensorRT-LLM for optimized NVIDIA paths, or a mix by traffic class.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cache locality', min: 0, max: 100 }, y: { label: 'goodput score', min: 0, max: 1 } },
      series: [
        { id: 'naive', label: 'round robin', points: [{ x: 0, y: 0.35 }, { x: 25, y: 0.38 }, { x: 50, y: 0.40 }, { x: 75, y: 0.42 }, { x: 100, y: 0.44 }] },
        { id: 'aware', label: 'KV aware', points: [{ x: 0, y: 0.35 }, { x: 25, y: 0.50 }, { x: 50, y: 0.68 }, { x: 75, y: 0.82 }, { x: 100, y: 0.92 }] },
      ],
      markers: [
        { id: 'hit', x: 75, y: 0.82, label: 'locality' },
      ],
    }),
    highlight: { active: ['aware', 'hit'], compare: ['naive'] },
    explanation: 'This conceptual chart shows the control-plane thesis. Once KV state and prefix locality matter, routing cannot be round-robin. The route decision should value locality, queue depth, SLO class, and transfer cost together.',
  };
}

function* disaggregatedRoute() {
  yield {
    state: routeGraph('Disaggregated route: classify, prefill, transfer, decode'),
    highlight: { active: ['req', 'class', 'miss', 'pre', 'move', 'dec'], found: ['trace'] },
    explanation: 'Disaggregated serving splits prompt prefill from token decode. The control plane decides whether to reuse existing KV, run a prefill worker, move KV state, and continue generation on a decode worker.',
  };

  yield {
    state: labelMatrix(
      'Route choices',
      [
        { id: 'hit', label: 'hit' },
        { id: 'cold', label: 'cold' },
        { id: 'long', label: 'long' },
        { id: 'hot', label: 'hot' },
      ],
      [
        { id: 'send', label: 'send' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['decode', 'fresh'],
        ['prefill', 'TTFT'],
        ['split', 'xfer'],
        ['local', 'p99'],
      ],
    ),
    highlight: { active: ['hit:send', 'long:send', 'hot:send'], compare: ['cold:watch'] },
    explanation: 'A good route can be local decode, remote prefill, split prefill/decode, or fallback. The decision depends on prefix hit, prompt length, queue depth, transfer bandwidth, and user-facing SLO.',
  };

  yield {
    state: routeGraph('KV transfer is a dependency edge'),
    highlight: { active: ['pre', 'move', 'dec', 'e-pre-move', 'e-move-dec'], compare: ['hit'], found: ['trace'] },
    explanation: 'The transfer path is not incidental. If KV movement blocks decode or crosses a congested fabric, the theoretical benefit of disaggregation disappears in p99 latency.',
    invariant: 'Disaggregation wins only when compute separation beats transfer overhead.',
  };

  yield {
    state: labelMatrix(
      'Complete case',
      [
        { id: 'encode', label: 'encode' },
        { id: 'pre', label: 'pre' },
        { id: 'dec', label: 'dec' },
        { id: 'cache', label: 'cache' },
        { id: 'scale', label: 'scale' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['image', 'hit'],
        ['prompt', 'TTFT'],
        ['tokens', 'ITL'],
        ['KV', 'reuse'],
        ['pods', 'SLO'],
      ],
    ),
    highlight: { active: ['pre:gate', 'dec:gate', 'cache:gate', 'scale:gate'] },
    explanation: 'For multimodal or agent traffic, the complete packet includes encode, prefill, decode, cache, and scale records. Dynamo-style orchestration turns that packet into routing and autoscaling decisions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'control plane') yield* controlPlane();
  else if (view === 'disaggregated route') yield* disaggregatedRoute();
  else throw new InputError('Pick a Dynamo control-plane view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the control-plane view as a map of who knows what. The frontend sees a request, the router sees cached prefix records and worker load, prefill workers build key-value cache, and decode workers spend that cache one token at a time. Active means the system is making a routing or scaling decision from current state. Visited means the record has already been considered and can no longer change this decision.',
        {type:"callout", text:"Dynamo turns hidden serving state into router-visible records so phase split, KV locality, transfer cost, and scale decisions share one control surface."},
        'In the disaggregated-route view, prefill means processing the prompt once to create attention state. Decode means generating output tokens from that state. A safe inference rule is this: route to a remote prefill worker only when saved recompute time is greater than queueing plus key-value transfer time.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language model serving is hard because one request creates state that can be useful to later requests. A key-value cache stores the attention keys and values produced while reading the prompt, so repeated prefixes can avoid work. A distributed control plane is the layer that records this state and uses it to route traffic across many GPUs.',
        'Dynamo exists for fleets where a single engine is no longer the whole system. The platform must decide which worker should prefill, which worker should decode, when to move cache blocks, and when to add capacity. The goal is lower user latency for the same hardware budget, not a prettier load balancer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run identical inference workers behind round robin or least-connections routing. That is a reasonable first design because most web services are close to stateless at the load balancer. If each request costs about the same and leaves no reusable state, connection count is often enough.',
        'A second simple approach is to keep prefill and decode on the same GPU. That avoids cache transfer and makes failure handling easier. It works well for small traffic, short prompts, or a team that needs one reliable pool before it needs fine-grained phase control.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when request cost stops matching request count. A 400-token chat turn and a 32,000-token retrieval prompt both look like one request to a blind load balancer. The long prompt can monopolize prefill capacity while short decodes wait, even when other GPUs hold useful cache for the same prefix.',
        'The second wall is stale or missing state. A router that does not know prefix location, queue depth, transfer bandwidth, and deadline cannot tell whether reuse is cheaper than recompute. It may move cache for a tiny prompt, recompute a large prefix that was already warm, or autoscale decode when prefill is the real bottleneck.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make serving state schedulable. Cache residency, worker role, queue depth, model placement, transfer path, tenant priority, and deadline become records that the router can score. The routing unit is no longer just a request; it is a request plus the state needed to serve it cheaply.',
        'This changes the question from which worker is least busy to which path wastes the least scarce resource. Sometimes the answer is local recompute. Sometimes it is remote prefill followed by key-value transfer. Sometimes it is admission control because every path would miss the service objective.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request enters with a model name, prompt tokens, tenant, and latency target. The frontend normalizes that packet and asks the router for a route. The router checks prefix overlap, current worker load, cache block locations, transfer cost, and whether a prefill or decode pool is the limiting resource.',
        'If the route is disaggregated, a prefill worker reads the prompt and creates key-value blocks. Those blocks move through a transfer layer to the decode worker or to a cache tier. The decode worker then generates tokens while the control plane records the route reason, cache hit reason, bytes moved, and latency outcome.',
        'Autoscaling uses the same records. Rising time to first token points toward prefill pressure. Rising inter-token latency points toward decode pressure. Falling cache hit rate points toward routing, eviction, or workload mix rather than raw GPU count.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant about ownership and evidence. A decode worker may consume a cache block only after the prefill result is complete, identified for the same model and prefix, and reachable through the selected transfer path. If any part of that evidence is missing, the route must fall back to recompute or rejection.',
        'The scheduling policy is heuristic, but the safety rule is not. Each accepted route has a recorded reason based on state that existed when the decision was made. That record lets the system compare predicted cost with actual latency and repair bad scoring without guessing after the fact.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The fast path adds lookup and bookkeeping cost before generation begins. If prefix lookup takes 1 ms, route scoring takes 1 ms, and transfer setup takes 2 ms, the route has already spent 4 ms before model work. That cost is worth paying only when saved prefill or better queue placement is larger than the control-plane tax.',
        'Memory cost grows with cached tokens. For a simple estimate, a 32-layer model with 32 attention heads, head dimension 128, and 2 byte values stores roughly 32 * 32 * 128 * 2 * 2 = 524,288 bytes per token for keys and values. Even after implementation details change the exact number, the behavior is clear: longer reusable prefixes quickly become a memory-management problem.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits high-volume assistants, coding agents, search products, and retrieval-augmented generation systems. These services reuse system prompts, tool schemas, policy instructions, and retrieved context. A state-aware router can send repeated prefixes to workers that already paid the prefill cost.',
        'It also fits mixed traffic where prefill and decode need different scaling. Long-context requests want prompt throughput, while short interactive requests want stable token cadence. Separate pools let an operator protect token latency without overprovisioning the prompt side.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design fails when traffic has little reuse or when prompts are too short for cache locality to matter. In that case the router spends time maintaining records that rarely change a route. A simple engine pool can be cheaper and easier to debug.',
        'It also fails when telemetry is untrusted. Stale cache records send requests to cold workers. Missing transfer metrics hide a fabric bottleneck. A sophisticated router using bad facts is worse than a simple router whose limits are visible.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose request A has a 16,000-token prefix that takes 240 ms to prefill locally. Worker W7 already has 12,000 of those tokens cached, but it has a 30 ms decode queue. Moving the missing key-value blocks from prefill worker P2 to W7 is estimated at 25 ms, and route scoring costs 2 ms.',
        'The local route costs about 240 ms before decode can start. The reuse route costs 2 ms of routing, 60 ms to prefill the 4,000 missing tokens, 25 ms to move blocks, and 30 ms of decode queueing, for 117 ms before decode. The router should choose reuse because it saves about 123 ms and keeps the route within a 150 ms time-to-first-token target.',
        'Change the prefix to 1,000 tokens and the decision flips. If local prefill is 15 ms and transfer setup is still 25 ms, remote reuse loses before decode begins. The control plane is useful because it can make that difference explicit per request.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Dynamo repository and documentation at https://github.com/ai-dynamo/dynamo and https://docs.nvidia.com/dynamo/latest/. Study the Dynamo sections on disaggregated serving, key-value aware routing, Planner, and key-value block management before relying on benchmark claims.',
        'Next, study vLLM prefix caching, SGLang serving, TensorRT-LLM, NIXL transfer, Kubernetes Gateway API Inference Extension, queueing theory, and autoscaling. The useful mental model is a distributed database of serving state plus a scheduler that spends that state only when it beats recompute.',
      ],
    },
  ],
};

