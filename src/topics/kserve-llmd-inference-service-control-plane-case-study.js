// KServe plus llm-d: a Kubernetes-native control plane for generative
// inference services, with model lifecycle, routing, KV locality, and rollout.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kserve-llmd-inference-service-control-plane-case-study',
  title: 'KServe llm-d Inference Service Control Plane',
  category: 'Systems',
  summary: 'A Kubernetes-native LLM serving case study: LLMInferenceService, gateway routing, llm-d scheduling, vLLM execution, KV-cache locality, autoscaling, governance, and observability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['service graph', 'scheduler contract'], defaultValue: 'service graph' },
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

function serviceGraph(title) {
  return graphState({
    nodes: [
      { id: 'crd', label: 'CRD', x: 0.7, y: 3.5, note: 'LLMISvc' },
      { id: 'ctrl', label: 'ctrl', x: 2.2, y: 3.5, note: 'reconcile' },
      { id: 'gw', label: 'gw', x: 3.8, y: 2.0, note: 'Gateway' },
      { id: 'sched', label: 'sched', x: 3.8, y: 5.0, note: 'llm-d' },
      { id: 'engine', label: 'vLLM', x: 5.6, y: 3.5, note: 'pods' },
      { id: 'kv', label: 'KV', x: 7.2, y: 2.0, note: 'locality' },
      { id: 'scale', label: 'HPA', x: 7.2, y: 5.0, note: 'KEDA' },
      { id: 'obs', label: 'obs', x: 8.8, y: 3.5, note: 'metrics' },
    ],
    edges: [
      { id: 'e-crd-ctrl', from: 'crd', to: 'ctrl' },
      { id: 'e-ctrl-gw', from: 'ctrl', to: 'gw' },
      { id: 'e-ctrl-sched', from: 'ctrl', to: 'sched' },
      { id: 'e-gw-engine', from: 'gw', to: 'engine' },
      { id: 'e-sched-engine', from: 'sched', to: 'engine' },
      { id: 'e-sched-kv', from: 'sched', to: 'kv' },
      { id: 'e-engine-kv', from: 'engine', to: 'kv' },
      { id: 'e-engine-scale', from: 'engine', to: 'scale' },
      { id: 'e-scale-ctrl', from: 'scale', to: 'ctrl' },
      { id: 'e-engine-obs', from: 'engine', to: 'obs' },
      { id: 'e-sched-obs', from: 'sched', to: 'obs' },
    ],
  }, { title });
}

function schedulerGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.5, note: 'OpenAI API' },
      { id: 'class', label: 'class', x: 2.2, y: 3.5, note: 'tenant/SLO' },
      { id: 'cache', label: 'cache', x: 3.8, y: 1.7, note: 'prefix' },
      { id: 'queue', label: 'queue', x: 3.8, y: 3.5, note: 'load' },
      { id: 'gpu', label: 'GPU', x: 3.8, y: 5.3, note: 'util' },
      { id: 'score', label: 'score', x: 5.8, y: 3.5, note: 'rank' },
      { id: 'pod', label: 'pod', x: 7.5, y: 3.5, note: 'serve' },
      { id: 'span', label: 'span', x: 9.0, y: 3.5, note: 'trace' },
    ],
    edges: [
      { id: 'e-req-class', from: 'req', to: 'class' },
      { id: 'e-class-cache', from: 'class', to: 'cache' },
      { id: 'e-class-queue', from: 'class', to: 'queue' },
      { id: 'e-class-gpu', from: 'class', to: 'gpu' },
      { id: 'e-cache-score', from: 'cache', to: 'score' },
      { id: 'e-queue-score', from: 'queue', to: 'score' },
      { id: 'e-gpu-score', from: 'gpu', to: 'score' },
      { id: 'e-score-pod', from: 'score', to: 'pod' },
      { id: 'e-pod-span', from: 'pod', to: 'span' },
    ],
  }, { title });
}

function* serviceGraphView() {
  yield {
    state: serviceGraph('LLMInferenceService turns serving into a Kubernetes object'),
    highlight: { active: ['crd', 'ctrl', 'gw', 'sched', 'engine', 'e-crd-ctrl'], found: ['obs'] },
    explanation: 'KServe LLMInferenceService is a useful curriculum object because it packages model lifecycle, routing, scheduler integration, runtime pods, scaling, and observability into a declarative Kubernetes control plane.',
  };

  yield {
    state: labelMatrix(
      'Responsibility split',
      [
        { id: 'kserve', label: 'KServe' },
        { id: 'llmd', label: 'llm-d' },
        { id: 'vllm', label: 'vLLM' },
        { id: 'k8s', label: 'K8s' },
        { id: 'obs', label: 'obs' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['lifecycle', 'status'],
        ['routing', 'hit/p99'],
        ['tokens', 'metrics'],
        ['pods', 'events'],
        ['traces', 'alerts'],
      ],
    ),
    highlight: { active: ['kserve:owns', 'llmd:owns', 'vllm:owns'], compare: ['obs:proof'] },
    explanation: 'The clean mental model is responsibility separation: KServe owns service lifecycle, llm-d owns intelligent inference scheduling, vLLM owns token execution, Kubernetes owns resources, and observability proves the result.',
  };

  yield {
    state: serviceGraph('The service graph must keep cache locality visible'),
    highlight: { active: ['sched', 'engine', 'kv', 'e-sched-kv', 'e-engine-kv'], compare: ['gw'], found: ['obs'] },
    explanation: 'Generic load balancing can destroy prefix-cache locality. The Kubernetes service graph needs a scheduler path that sees cache residency, queue depth, GPU utilization, and tenant policy before choosing a pod.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'platform abstraction', min: 0, max: 10 }, y: { label: 'operator control', min: 0, max: 10 } },
      series: [
        { id: 'raw', label: 'raw pods', points: [{ x: 2, y: 9 }, { x: 4, y: 7 }, { x: 6, y: 5 }, { x: 8, y: 3 }] },
        { id: 'svc', label: 'LLMISvc', points: [{ x: 2, y: 5 }, { x: 4, y: 6.5 }, { x: 6, y: 7.5 }, { x: 8, y: 8 }] },
      ],
      markers: [
        { id: 'sweet', x: 7, y: 7.8, label: 'control' },
      ],
    }),
    highlight: { active: ['svc', 'sweet'], compare: ['raw'] },
    explanation: 'The platform tradeoff is abstraction without losing control. A good LLM service API hides boilerplate but still exposes routing policy, cache behavior, autoscaling metrics, and rollout gates.',
  };
}

function* schedulerContract() {
  yield {
    state: schedulerGraph('llm-d scheduler scores more than load'),
    highlight: { active: ['req', 'class', 'cache', 'queue', 'gpu', 'score'], found: ['pod'] },
    explanation: 'llm-d-style scheduling is not just least-connections. The scheduler can consider cache residency, queue depth, GPU utilization, SLA class, fairness, and predicted latency.',
  };

  yield {
    state: labelMatrix(
      'Scheduler inputs',
      [
        { id: 'cache', label: 'cache' },
        { id: 'queue', label: 'queue' },
        { id: 'gpu', label: 'GPU' },
        { id: 'sla', label: 'SLA' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['hit%', 'skip'],
        ['depth', 'delay'],
        ['util', 'fit'],
        ['p99', 'rank'],
        ['quota', 'fair'],
      ],
    ),
    highlight: { active: ['cache:effect', 'sla:effect', 'tenant:effect'], compare: ['queue:metric'] },
    explanation: 'The scheduler contract should expose what it optimized. A cache-hit route, a fair-share route, and a low-queue route are different decisions and should be visible in spans and metrics.',
  };

  yield {
    state: schedulerGraph('Trace the route decision'),
    highlight: { active: ['score', 'pod', 'span', 'e-score-pod', 'e-pod-span'], compare: ['cache', 'queue', 'gpu'] },
    explanation: 'The route decision must become an observable artifact. Without a span that records scores and chosen pod, operators cannot explain why latency changed after an autoscale or rollout event.',
    invariant: 'A production serving abstraction must preserve the evidence behind the route.',
  };

  yield {
    state: labelMatrix(
      'Complete rollout',
      [
        { id: 'spec', label: 'spec' },
        { id: 'route', label: 'route' },
        { id: 'scale', label: 'scale' },
        { id: 'eval', label: 'eval' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['CRD', 'valid'],
        ['score', 'p99'],
        ['HPA', 'warm'],
        ['slices', 'pass'],
        ['canary', 'ramp'],
      ],
    ),
    highlight: { active: ['spec:gate', 'route:gate', 'scale:gate', 'eval:gate', 'roll:gate'] },
    explanation: 'A complete KServe/llm-d rollout has declarative service spec, route scoring, autoscaling behavior, eval slices, and canary status. The point is to make serving repeatable, governed, and debuggable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'service graph') yield* serviceGraphView();
  else if (view === 'scheduler contract') yield* schedulerContract();
  else throw new InputError('Pick a KServe llm-d view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'KServe LLMInferenceService plus llm-d is a Kubernetes-native control-plane pattern for production generative inference. KServe gives platform teams a declarative service object for model lifecycle, runtime configuration, routing, rollout, autoscaling, and status. llm-d adds LLM-specific scheduling intelligence: KV-cache locality, prefill/decode separation, load-aware routing, and SLO-aware placement.',
        'This topic complements NVIDIA Dynamo. Dynamo teaches a distributed inference framework and its fleet-level control plane. KServe/llm-d teaches what that world looks like when the operating surface is Kubernetes: CRDs, controllers, Gateway API, runtime pods, status fields, scheduler policy, metrics, and rollbacks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to run vLLM pods behind a normal Kubernetes Service or Gateway and let Kubernetes spread traffic across ready pods. That works for simple stateless services, and it is attractive because the platform already knows how to reconcile deployments, endpoints, and autoscalers.',
        'The wall is that an LLM pod is not just a stateless replica. One pod may hold the useful prefix cache. Another may have a deep decode queue. A third may be in the wrong prefill pool, tenant class, or rollout version. Generic readiness and least-connections do not explain those differences, so a platform can be "healthy" while wasting cache locality or violating p99.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a service object plus a route scorecard. The service object declares the desired model-serving shape. The scorecard records why the scheduler chose a pod: cache hit, queue depth, GPU fit, tenant fairness, SLO risk, rollout state, or fallback.',
        'That split matters. Declarative Kubernetes state makes the service repeatable. The route scorecard makes each request explainable. Without the first, operations become shell scripts. Without the second, intelligent routing becomes a black box.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inspect the control plane in layers. The CRD declares desired serving state. The controller reconciles pods, routes, and status. The gateway receives requests. The llm-d scheduler chooses the endpoint using LLM-specific signals. The runtime executes tokens. Observability ties the request back to the service revision and scheduler decision.',
        'The central question is whether the abstraction hides boilerplate or hides truth. Hiding Deployments and Services can be helpful. Hiding queue depth, cache locality, rollout version, or route score is dangerous because those fields decide cost and p99.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'A platform team declares an LLMInferenceService. The controller reconciles the model source, runtime template, Gateway route, scheduler configuration, pods, and status. Runtime pods execute inference, often through vLLM or another OpenAI-compatible engine. Metrics and traces feed autoscaling, alerts, and rollout decisions.',
        'The scheduler path is where llm-d changes the shape. Instead of sending traffic only to a ready endpoint, it can score endpoints by prefix-cache residency, queue pressure, GPU utilization, SLO class, and tenant policy. The selected pod and the score fields should appear in traces so operators can explain latency shifts after an autoscale, rollout, or cache-policy change.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Kubernetes controllers work because they preserve a reconciliation invariant: observed state is repeatedly compared with desired state, and the controller acts until the two converge. LLMInferenceService applies that invariant to model serving instead of asking every team to hand-wire Deployments, Services, Gateways, and runtime-specific flags.',
        'llm-d is useful because it adds the missing serving invariant: route decisions should preserve the evidence behind locality, load, and fairness. If a request was sent to a cache-warm pod, the trace should say so. If fairness overrode locality, the trace should say that too. This is what makes the abstraction operable rather than decorative.',
        'This is the main teaching point: a platform API is not only a convenience wrapper. At this scale it is a memory system for operational intent. The CRD remembers the desired service, the controller remembers convergence, the scheduler remembers request-specific evidence, and traces remember why a decision was made.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is another control plane to learn and debug. CRDs, controllers, scheduler extensions, runtime images, Gateway resources, autoscaling signals, RBAC, and observability must agree. Version skew or missing metrics can make a declarative service look clean while the serving path is degraded.',
        'There is also an abstraction tax. A platform API should hide boilerplate, not hide the levers that determine p99 and cost. If teams cannot see cache behavior, route reason, queue depth, and rollout status, the abstraction is too shallow for serious LLM serving.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern wins when a team already runs Kubernetes and needs repeatable LLM services across tenants, models, engines, and hardware pools. It is especially useful when platform teams need governed rollouts, Gateway integration, autoscaling, metrics, and scheduling policy in one object model.',
        'A strong use case is a customer-support model with repeated system prompts, tenant-specific policies, and canary rollouts. KServe owns the service and rollout. llm-d routes toward useful prefix cache while respecting queue depth and fairness. vLLM executes tokens. Kubernetes supplies the resource and reconciliation layer.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It can be too heavy for a single small model that fits on one node and already meets the SLO. It can also fail when the platform team treats Kubernetes objects as the whole solution and ignores LLM-specific metrics. A normal Service can route to a ready pod that is the wrong pod for KV locality.',
        'The riskiest failure is silent scheduler opacity. If route scores are not logged, a p99 regression becomes guesswork. The rollout packet should store CRD revision, Gateway route, scheduler-score fields, cache-hit rate, pod queue depth, GPU utilization, TTFT, ITL, p99, autoscale action, canary status, and rollback condition.',
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        'Track reconcile errors, stale status conditions, route-score fields, cache-hit rate by pod, TTFT, inter-token latency, pod queue depth, GPU memory pressure, request rejects, rollout slice metrics, autoscaler decisions, and tenant fairness. These signals show whether the declarative service is healthy as an LLM service, not merely as Kubernetes YAML.',
        'A mature platform also records why each request was routed. Cache locality, fairness, SLO risk, rollout safety, and capacity can conflict. If the system cannot explain which reason won, operators cannot debug a regression or teach users how the platform behaves.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'KServe/llm-d is a control-plane pattern: declarative service state plus LLM-aware scheduling evidence. It is valuable when a platform needs repeatable model serving, gateway integration, autoscaling, rollouts, and route decisions that account for KV locality and p99.',
        'The deep lesson is that Kubernetes readiness is not enough for LLM serving. A pod can be ready and still be a bad target for this request. LLM serving needs routing state that understands cache, queue, tenant, rollout, and SLO pressure.',
        'For course design, teach this after Kubernetes reconciliation and after the LLM inference cost stack. Students should see why a generic service abstraction is not enough once cache state and token-level latency become part of correctness for the platform.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A company serves a support model for three tenants. Each tenant has repeated system prompts, different tool schemas, and separate risk policy. The platform team declares one LLMInferenceService per deployment profile, uses Gateway routes for API traffic, and rolls a new runtime image through a canary. llm-d chooses endpoints using cache locality, queue depth, GPU utilization, tenant fairness, and SLO class.',
        'The useful outcome is not just that traffic reaches vLLM. The useful outcome is that the system can answer operational questions: which CRD revision served this answer, which scheduler score won, why did autoscaling fire, which tenant slice regressed, and which flag rolls the change back?',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary and official sources: KServe LLMInferenceService docs at https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-overview, KServe and llm-d cloud-native inference post at https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d, llm-d GitHub at https://github.com/llm-d/llm-d, llm-d production-grade KServe/vLLM post at https://llm-d.ai/blog/production-grade-llm-inference-at-scale-kserve-llm-d-vllm, and KServe project docs at https://kserve.github.io/website/.',
        'Study Kubernetes Reconciliation Case Study for the controller model, Kubernetes HPA Recommendation Ring for autoscaling state, Kubernetes Ingress Gateway Route DAG for traffic policy, SLO-Aware LLM Request Router for scheduling scores, LLM Serving Admission-Control Goodput Gate for front-door rejection, LLM Serving Autoscaling Warm Pool for cold-start control, LLM Model Rollout Shadow Canary Ledger for governed rollout, NVIDIA Dynamo Distributed Inference Control Plane for the fleet abstraction, and GenAI Trace Token Cost Ledger for request evidence.',
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
        'Use this topic as a checkpoint: if you can explain why KServe llm-d Inference Service Control Plane moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

