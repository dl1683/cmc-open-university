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
    { heading: 'How to read the animation', paragraphs: [
      'Read the service graph as a Kubernetes control plane. A CRD is a Custom Resource Definition, and a controller reconciles desired service state into gateways, pods, scheduler resources, autoscaling, and status. The scheduler view shows one request being routed with cache, queue, GPU, tenant, and SLO signals.',
      {type:'callout', text:'A production LLM serving API needs both declared service state and per-request routing evidence, because cache locality and SLO pressure are part of the control plane.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Serving one model in one pod is not the hard part. Production LLM serving needs model lifecycle, GPUs, gateways, streaming, autoscaling, rollout, tenant policy, observability, and rollback. KServe provides the Kubernetes API surface, while llm-d adds LLM-aware routing and scheduling.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to run vLLM pods behind a normal Kubernetes Service or Gateway. Kubernetes can expose ready endpoints and spread traffic. That works for simple stateless services, but LLM replicas differ by cache state, queue depth, runtime version, and tenant pressure.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is hidden serving state. A pod can be ready and still be the wrong target because it lacks the prefix KV cache, has a deep decode queue, or belongs to the wrong canary. Generic load balancing cannot see the state that drives time to first token and p99 latency.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The control plane needs two memories. The LLMInferenceService object remembers desired deployment state. The route scorecard remembers why a request chose one pod: cache hit, low queue, GPU fit, SLO pressure, tenant fairness, or rollout rule.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A team creates an LLMInferenceService. The controller reconciles model source, runtime pods, Gateway routes, scheduler configuration, status, and rollout. A request enters the gateway, the llm-d path scores candidate pods, a runtime such as vLLM executes tokens, and metrics plus traces feed autoscaling and debugging.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The Kubernetes side works by the reconciliation invariant: observed state is repeatedly compared with desired state until it converges or reports a condition. The LLM side works when routing evidence matches real cost drivers. Cache hits avoid recomputation, queue scores protect latency, and rollout scores keep canaries bounded.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is another control plane: CRDs, controllers, Gateway resources, scheduler components, runtime images, RBAC, metrics, and version skew. A real routing example shows the behavior: pod A has a 40 ms queue but a cache hit worth 300 ms, while pod B has a 5 ms queue and no cache. An LLM-aware scheduler should choose pod A despite the longer queue.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This pattern wins for Kubernetes platforms serving many models, tenants, runtimes, and GPU pools. It is useful for repeated prompts, chat history, LoRA adapters, governed canaries, and SLO classes where routing affects cost and latency. It gives platform teams one API surface without losing request-level evidence.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It can be too heavy for one small model on one node. It also fails when abstraction hides the levers that matter: cache-hit rate, route score, queue depth, GPU pressure, rollout revision, and autoscaler action. A platform API should hide boilerplate, not hide truth.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A support platform serves one 8B model for three tenants. Tenant A has p99 target 800 ms, tenant B has 1500 ms, and tenant C is in canary. If tenant A has a prefix cache hit on pod 2 with 30 ms queue and pod 1 has no cache with 5 ms queue, a 250 ms prefix recompute cost makes pod 2 the better target, and the trace should record that reason.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: KServe LLMInferenceService at https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-overview, KServe llm-d blog at https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d, llm-d at https://github.com/llm-d/llm-d, vLLM docs at https://docs.vllm.ai/, and Kubernetes controllers at https://kubernetes.io/docs/concepts/architecture/controller/. Study Kubernetes Reconciliation, Gateway API, HPA, KV Cache, Prefix Caching, Prefill-Decode Disaggregation, PagedAttention, and GenAI Trace Token Cost Ledger next.',
    ] },
  ],
};
