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
        "Read the animation as the execution trace for NVIDIA Dynamo Distributed Inference Control Plane. A distributed inference control-plane case study: disaggregated serving, KV-aware routing, multi-tier cache, worker pools, NIXL transfer, autoscaling, and engine coordination..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single inference engine can make one GPU useful. A distributed inference control plane makes a fleet useful. That distinction is the reason NVIDIA Dynamo-style systems exist. Modern LLM serving is not only a kernel problem, a batching problem, or a model-loading problem. It is a placement problem over requests, cache state, network links, worker pools, service objectives, and failures that happen while traffic is still arriving.',
        'The pressure comes from the shape of generative AI workloads. A short chat turn, a long retrieval-augmented prompt, a tool-using agent trace, and a multimodal request do not stress the same part of the system. Prefill work burns through prompt tokens and builds KV cache. Decode work emits one token at a time and is sensitive to small latency changes. Repeated system prompts and shared retrieved context can make old KV state valuable. Once those facts matter, the platform needs a control plane above engines such as vLLM, SGLang, and TensorRT-LLM.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive design is familiar: put many identical inference workers behind a load balancer and choose round robin, random, or least connections. It is easy to deploy and it works for many stateless HTTP services. If all workers have the same model, the same memory pressure, no useful per-request state, and the same queue shape, the load balancer does not need to understand much.',
        'LLM serving breaks those assumptions. A request is not just a request; it can create gigabytes of reusable KV state. A worker can be warm for one prefix and cold for another. A long prompt can consume prefill capacity while a small continuation waits behind it. A decode worker can look idle by connection count while its token-level latency is already too high. The result is waste that hides behind average utilization: recomputed prefixes, avoidable transfers, poor time to first token, bad inter-token latency, and autoscaling that adds the wrong kind of capacity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat inference state as schedulable data. KV blocks, prefix ownership, cache residency, prefill availability, decode pressure, transfer bandwidth, queue depth, tenant priority, and SLO class all become records that the control plane can read. The system is no longer asking which worker has the fewest connections. It is asking which route gives this request the best chance of meeting its objective with the least wasted work.',
        'That change turns routing into a constrained scoring problem. A cache hit is useful only if the worker can serve the request before the deadline. A remote prefill is useful only if KV transfer is cheaper than local recompute or queueing. A new replica is useful only if the bottleneck is capacity rather than locality or a congested fabric. The scheduler does not need perfect foresight; it needs enough state to avoid the obviously bad choices that a blind load balancer cannot see.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request enters with a model, prompt, tenant, deadline, and traffic class. The frontend normalizes that packet and asks the router for placement. The router checks whether the prefix is known, where useful KV blocks live, which prefill workers can absorb prompt work, which decode workers can protect token latency, and whether a transfer path is available. The answer may be local decode, remote prefill followed by KV movement, a cache-tier fetch, a fallback route, or rejection when no route can meet the contract.',
        'The important object is the handoff record. It should identify the route, chosen engine, prefill worker, decode worker, cache hit or miss reason, KV block ids, transfer method, deadline, fallback path, and trace id. Disaggregated serving only works when this record is explicit. The prefill phase must produce KV that the decode phase can safely consume. The control plane also feeds autoscaling: rising time to first token points toward prefill pressure, rising inter-token latency points toward decode pressure, and falling cache hit rate points toward routing or eviction policy.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The control-plane view proves that the engine is only one node in the serving system. The router, cache tiers, KV transfer layer, worker pools, and autoscaler all participate in the decision. If any of those records are missing, the route becomes guesswork. The matrix of control records is not decoration; it is the minimal evidence a fleet-level scheduler needs in order to explain why work moved where it moved.',
        'The disaggregated-route view proves a different lesson: prefill and decode are connected by a dependency edge, not by hope. A cold long prompt may need prefill first. A repeated prefix may skip that work and go directly to a warm decode path. A KV transfer can be a win, a tie, or a p99 disaster depending on fabric load and deadline. The visual is teaching that disaggregation is a conditional optimization. It wins only when phase separation plus transfer beats the simpler local route.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it makes the hidden state of LLM serving visible to policy. KV cache is expensive to create and valuable to reuse. Decode latency is fragile. Prefill demand arrives in bursts. Network transfer has a real cost. When those facts are modeled explicitly, the scheduler can choose routes that preserve useful state and isolate conflicting phases of work.',
        'The practical invariant is not optimal scheduling. Production fleets are too dynamic for a neat global optimum. The invariant is that each route is made against current locality, capacity, transfer, and deadline evidence, and that the result is recorded. A cache-aware route can still be wrong. A cache-blind route cannot even say what it wasted. That auditability is what lets operators tune scoring, compare engines, and decide whether disaggregation is helping real traffic rather than a benchmark slice.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is real control-plane complexity. The platform now owns routing policy, cache metadata, worker health, transfer bookkeeping, topology awareness, observability, admission control, autoscaling, and recovery after partial failure. Metadata can become stale. Workers can die after a route is chosen. A transfer can complete after the deadline is already lost. The more the scheduler knows, the more carefully that knowledge must be aged, validated, and traced.',
        'There is also a data-movement tax. Moving KV can save prompt recomputation, but it consumes memory bandwidth, network bandwidth, and scheduling time. Small prompts may be cheaper to recompute than to locate and move. Highly unique traffic may not reuse prefixes enough to justify a large cache hierarchy. A fleet with weak observability can end up with sophisticated policy that confidently routes on bad facts. The honest tradeoff is simple: Dynamo-style orchestration buys efficiency and control when state matters, but it raises the operating bar.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern is useful in high-volume assistants, enterprise copilots, coding agents, search and RAG products, batch generation systems, and multimodal services that mix short and long requests. These systems often have repeated system prompts, shared tool schemas, common retrieval templates, and tenants with different latency objectives. A control plane can use those repetitions instead of flattening them into generic work items.',
        'A concrete case is a production assistant that handles short chat, long-context RAG, and tool-using agent sessions. Short chat may benefit from warm decode workers. RAG may need protected prefill capacity for long retrieved context. Agent sessions may reuse large tool schemas and instruction prefixes. Multimodal requests may add an encode stage before text generation. A single engine pool can serve all of this, but it cannot explain the best placement for each phase unless the platform records the phase, state, and outcome.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'This is the wrong first tool for a small service where one well-tuned engine pool already meets the SLO. It also fails when the team cannot maintain trustworthy telemetry. Stale cache-residency records can send requests to the wrong worker. Missing transfer metrics can make a route look efficient while p99 latency burns. Autoscaling can add decode replicas when the real bottleneck is prefill, or add prefill capacity when a cache policy is throwing away useful prefixes.',
        'The most common conceptual failure is benchmark theater. A disaggregated demo can look excellent on handpicked long prompts with repeated prefixes and then lose on real traffic with short prompts, cold prefixes, noisy neighbors, or fabric contention. A credible evaluation should report route reason, cache hit reason, KV bytes transferred, transfer latency, time to first token, inter-token latency, p99, fallback rate, and autoscale action. Without that ledger, the system may only be proving that the benchmark liked the scheduler.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study prefill/decode disaggregation first, because it explains why the request has phases. Then study KV cache layout, prefix caching, transfer fabrics, and cache eviction, because those decide whether state reuse is cheap enough to matter. After that, study SLO-aware routing and warm-pool autoscaling, because control planes should optimize user-facing latency rather than raw utilization.',
        'The adjacent systems are vLLM for serving mechanics, SGLang for structured program execution, TensorRT-LLM for optimized NVIDIA runtime paths, Ray Serve and Kubernetes-native systems for deployment control, and observability tools that can connect route decisions to traces. The next mental model is this: an inference control plane is a distributed database of serving state plus a scheduler that spends that state carefully.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why NVIDIA Dynamo Distributed Inference Control Plane moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

