// LLM unit economics ledger: turn model phase physics, utilization, fixed ops,
// retries, and routing choices into cost per accepted answer.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-unit-economics-ledger-case-study',
  title: 'LLM Unit Economics Ledger Case Study',
  category: 'Systems',
  summary: 'A production finance case study for LLM serving: raw token floor, utilization, fixed ops, quality rejects, API gap, and route decisions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token ledger', 'product routes'], defaultValue: 'token ledger' },
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

function ledgerGraph(title) {
  return graphState({
    nodes: [
      { id: 'workload', label: 'workload', x: 0.7, y: 3.8, note: 'mix' },
      { id: 'phase', label: 'phase', x: 2.3, y: 2.4, note: 'TTFT/TPOT' },
      { id: 'tokens', label: 'tokens', x: 2.3, y: 5.1, note: 'in/out' },
      { id: 'gpu', label: 'GPU floor', x: 4.2, y: 3.8, note: 'raw' },
      { id: 'util', label: 'util', x: 5.9, y: 2.3, note: 'load' },
      { id: 'ops', label: 'ops', x: 5.9, y: 5.2, note: 'fixed' },
      { id: 'quality', label: 'quality', x: 7.6, y: 2.3, note: 'rejects' },
      { id: 'route', label: 'route', x: 7.6, y: 5.2, note: 'policy' },
      { id: 'answer', label: 'accepted', x: 9.4, y: 3.8, note: 'unit' },
    ],
    edges: [
      { id: 'e-workload-phase', from: 'workload', to: 'phase' },
      { id: 'e-workload-tokens', from: 'workload', to: 'tokens' },
      { id: 'e-phase-gpu', from: 'phase', to: 'gpu' },
      { id: 'e-tokens-gpu', from: 'tokens', to: 'gpu' },
      { id: 'e-gpu-util', from: 'gpu', to: 'util' },
      { id: 'e-gpu-ops', from: 'gpu', to: 'ops' },
      { id: 'e-util-quality', from: 'util', to: 'quality' },
      { id: 'e-ops-route', from: 'ops', to: 'route' },
      { id: 'e-quality-answer', from: 'quality', to: 'answer' },
      { id: 'e-route-answer', from: 'route', to: 'answer' },
    ],
  }, { title });
}

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.8, y: 3.8, note: 'task' },
      { id: 'policy', label: 'policy', x: 2.5, y: 3.8, note: 'cost+SLO' },
      { id: 'cache', label: 'cache', x: 4.2, y: 1.4, note: 'reuse' },
      { id: 'small', label: 'small', x: 4.2, y: 2.9, note: 'cheap' },
      { id: 'hosted', label: 'hosted', x: 4.2, y: 4.5, note: 'API' },
      { id: 'self', label: 'self', x: 4.2, y: 6.0, note: 'GPU' },
      { id: 'device', label: 'device', x: 6.3, y: 2.2, note: 'local' },
      { id: 'strong', label: 'strong', x: 6.3, y: 5.2, note: 'quality' },
      { id: 'ledger', label: 'ledger', x: 8.1, y: 3.8, note: 'why' },
      { id: 'ship', label: 'ship', x: 9.5, y: 3.8, note: 'answer' },
    ],
    edges: [
      { id: 'e-request-policy', from: 'request', to: 'policy' },
      { id: 'e-policy-cache', from: 'policy', to: 'cache' },
      { id: 'e-policy-small', from: 'policy', to: 'small' },
      { id: 'e-policy-hosted', from: 'policy', to: 'hosted' },
      { id: 'e-policy-self', from: 'policy', to: 'self' },
      { id: 'e-small-device', from: 'small', to: 'device' },
      { id: 'e-hosted-strong', from: 'hosted', to: 'strong' },
      { id: 'e-self-strong', from: 'self', to: 'strong' },
      { id: 'e-cache-ledger', from: 'cache', to: 'ledger' },
      { id: 'e-device-ledger', from: 'device', to: 'ledger' },
      { id: 'e-strong-ledger', from: 'strong', to: 'ledger' },
      { id: 'e-ledger-ship', from: 'ledger', to: 'ship' },
    ],
  }, { title });
}

function* tokenLedger() {
  yield {
    state: ledgerGraph('Cost per accepted answer is a ledger'),
    highlight: { active: ['workload', 'phase', 'tokens', 'gpu', 'util', 'ops', 'quality', 'route', 'e-workload-phase', 'e-workload-tokens', 'e-phase-gpu'], found: ['answer'] },
    explanation: 'Raw token math is only the floor. A real ledger adds workload mix, phase behavior, utilization, fixed operations, retries, quality rejects, and route policy.',
    invariant: 'Price the accepted answer, not just generated tokens.',
  };

  yield {
    state: labelMatrix(
      'Ledger columns',
      [
        { id: 'model', label: 'model' },
        { id: 'phase', label: 'phase' },
        { id: 'tokens', label: 'tokens' },
        { id: 'util', label: 'util' },
        { id: 'ops', label: 'ops' },
        { id: 'rejects', label: 'rejects' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['size+bits', 'bytes'],
        ['prefill/decode', 'physics'],
        ['input+output', 'bill mix'],
        ['load factor', 'idle tax'],
        ['people+SRE', 'fixed cost'],
        ['bad answers', 'true unit'],
      ],
    ),
    highlight: { active: ['model:stores', 'phase:stores', 'tokens:stores', 'util:stores', 'ops:stores', 'rejects:stores'], found: ['rejects:why'] },
    explanation: 'A unit-economics ledger should store model size and precision, input/output split, utilization, fixed team and reliability costs, and the fraction of outputs that must be retried or discarded.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'GPU utilization', min: 0.05, max: 1.0 }, y: { label: 'raw cost per M output tokens', min: 0, max: 0.09 } },
      series: [
        { id: 'floor', label: 'raw floor', points: [
          { x: 0.10, y: 0.038 }, { x: 0.20, y: 0.019 }, { x: 0.30, y: 0.013 }, { x: 0.50, y: 0.0076 }, { x: 1.00, y: 0.0038 },
        ] },
        { id: 'loaded', label: 'ops loaded', points: [
          { x: 0.10, y: 0.083 }, { x: 0.20, y: 0.049 }, { x: 0.30, y: 0.036 }, { x: 0.50, y: 0.025 }, { x: 1.00, y: 0.017 },
        ] },
      ],
      markers: [
        { id: 'idle', x: 0.10, y: 0.038, label: 'idle tax' },
        { id: 'steady', x: 0.50, y: 0.0076, label: 'steady' },
      ],
    }),
    highlight: { active: ['floor', 'idle'], compare: ['loaded'], found: ['steady'] },
    explanation: 'The local cost notes use an illustrative raw compute floor: same hardware and model, but utilization changes the cost per million tokens by multiples before the architecture changes at all.',
  };

  yield {
    state: labelMatrix(
      'Input tokens are not output tokens',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'cache', label: 'KV stay' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'resource', label: 'resource' },
        { id: 'price reason', label: 'reason' },
      ],
      [
        ['compute', 'parallel'],
        ['bandwidth', 'serial'],
        ['HBM', 'concur cap'],
        ['all again', 'quality tax'],
      ],
    ),
    highlight: { active: ['prefill:resource', 'decode:resource', 'cache:resource'], compare: ['retry:price reason'] },
    explanation: 'Input and output prices differ because prefill and decode are different workloads. Decode is sequential and often memory-bound; long KV residency also limits how many users fit on the GPU.',
  };

  yield {
    state: ledgerGraph('The API gap includes the service layer'),
    highlight: { active: ['gpu', 'ops', 'route', 'quality', 'answer', 'e-gpu-ops', 'e-ops-route', 'e-quality-answer', 'e-route-answer'], compare: ['util'] },
    explanation: 'The gap between a raw compute floor and a hosted API price is not pure margin. It includes burst capacity, safety, monitoring, incident response, model refreshes, compliance, and uptime promises.',
  };

  yield {
    state: labelMatrix(
      'Bad shortcuts',
      [
        { id: 'floor', label: 'raw floor' },
        { id: 'avg', label: 'avg TPS' },
        { id: 'api', label: 'API gap' },
        { id: 'cheap', label: 'cheap route' },
        { id: 'quality', label: 'quality' },
      ],
      [
        { id: 'mistake', label: 'mistake' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['call it price', 'load ops'],
        ['hide p99', 'slice SLOs'],
        ['call margin', 'model service'],
        ['route all', 'risk bands'],
        ['ignore rejects', 'accepted cost'],
      ],
    ),
    highlight: { active: ['floor:fix', 'avg:fix', 'quality:fix'], compare: ['api:mistake'] },
    explanation: 'A credible cost model prices accepted, policy-compliant answers by workload slice. It does not confuse GPU rental arithmetic with production economics.',
  };
}

function* productRoutes() {
  yield {
    state: routeGraph('Unit economics becomes a route policy'),
    highlight: { active: ['request', 'policy', 'cache', 'small', 'hosted', 'self', 'e-request-policy', 'e-policy-cache', 'e-policy-small', 'e-policy-hosted', 'e-policy-self'], found: ['ledger'] },
    explanation: 'A product should not send every task to the same model path. The route policy spends more only when risk, quality, latency, or privacy requirements justify it.',
    invariant: 'Route decisions should be logged like financial decisions.',
  };

  yield {
    state: labelMatrix(
      'Workload route fit',
      [
        { id: 'faq', label: 'FAQ' },
        { id: 'draft', label: 'drafting' },
        { id: 'legal', label: 'legal' },
        { id: 'ambient', label: 'ambient' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cache/small', 'stale hit'],
        ['small+verify', 'weak prose'],
        ['strong+audit', 'bad cite'],
        ['device', 'battery'],
        ['self-host', 'low util'],
      ],
    ),
    highlight: { active: ['faq:route', 'draft:route', 'legal:route', 'ambient:route', 'batch:route'], compare: ['legal:risk'] },
    explanation: 'FAQ traffic can reuse answers. Drafting can use a cheap model plus verifier. Legal or financial work may need a stronger model and audit. Ambient features often need device-side economics.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'requests per user per month', min: 0, max: 500 }, y: { label: 'monthly cost, relative', min: 0, max: 12 } },
      series: [
        { id: 'cloud', label: 'cloud', points: [{ x: 50, y: 1.1 }, { x: 100, y: 2.2 }, { x: 250, y: 5.6 }, { x: 500, y: 11.2 }] },
        { id: 'device', label: 'device', points: [{ x: 50, y: 1.0 }, { x: 100, y: 1.0 }, { x: 250, y: 1.0 }, { x: 500, y: 1.0 }] },
      ],
      markers: [
        { id: 'cross', x: 50, y: 1.1, label: 'near cross' },
      ],
    }),
    highlight: { active: ['cloud', 'device', 'cross'] },
    explanation: 'The local cost notes frame the key shape: cloud cost grows with use, while on-device cost is mostly fixed after packaging and updates. The more ambient the feature, the more the device route matters.',
  };

  yield {
    state: routeGraph('The ledger prevents hidden lock-in'),
    highlight: { active: ['policy', 'hosted', 'self', 'device', 'ledger', 'e-policy-hosted', 'e-policy-self', 'e-small-device', 'e-device-ledger', 'e-strong-ledger'], found: ['ship'] },
    explanation: 'A route ledger records model, vendor, cache hit, privacy boundary, fallback, and accepted quality. That makes cost regressions and vendor lock-in visible before they become product architecture.',
  };

  yield {
    state: labelMatrix(
      'Fixed-cost layer',
      [
        { id: 'eng', label: 'ML eng' },
        { id: 'ops', label: 'SRE' },
        { id: 'safe', label: 'safety' },
        { id: 'burst', label: 'burst cap' },
        { id: 'eval', label: 'evals' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'why', label: 'why' },
      ],
      [
        ['salary', 'tune stack'],
        ['on-call', 'uptime'],
        ['review', 'risk'],
        ['idle headroom', 'spikes'],
        ['fixtures', 'no regress'],
      ],
    ),
    highlight: { active: ['eng:cost', 'ops:cost', 'safe:cost', 'burst:cost', 'eval:cost'] },
    explanation: 'Self-hosting can win only after fixed costs amortize. The GPU bill is visible, but the engineering, reliability, safety, burst-capacity, and evaluation layers decide the real break-even point.',
  };

  yield {
    state: labelMatrix(
      'Ship gates',
      [
        { id: 'cost', label: 'cost/task' },
        { id: 'p99', label: 'p99' },
        { id: 'quality', label: 'quality' },
        { id: 'privacy', label: 'privacy' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['down?', 'ledger'],
        ['within SLO?', 'trace'],
        ['slice safe?', 'eval'],
        ['data leaves?', 'route log'],
        ['works?', 'canary'],
      ],
    ),
    highlight: { active: ['cost:artifact', 'p99:artifact', 'quality:artifact', 'privacy:artifact', 'fallback:artifact'] },
    explanation: 'A cheaper route ships only if accepted-answer cost falls without breaking p99, protected quality slices, privacy policy, or fallback behavior.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token ledger') yield* tokenLedger();
  else if (view === 'product routes') yield* productRoutes();
  else throw new InputError('Pick an LLM unit-economics view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An LLM unit-economics ledger converts inference physics into product cost. It starts with the raw token floor, then adds utilization, fixed operations, tail latency, retries, quality rejects, cache behavior, routing policy, and vendor or device boundaries. The result is cost per accepted answer, not just cost per generated token.',
        'This extends LLM Inference Cost Stack Case Study. The cost stack tells you which phase a lever attacks. The unit-economics ledger tells you whether the lever changes the business: lower cost per useful task at the same SLO and quality bar.',
      ],
    },
    {
      heading: 'Ledger model',
      paragraphs: [
        'The minimum record includes model id, model size, precision, input tokens, output tokens, route, phase timings, GPU or API cost, utilization, cache hit, verifier cost, retry count, accepted/rejected state, and quality slice. A raw GPU calculation without accepted-answer state is incomplete because bad answers, policy rejects, and retries still consumed compute.',
        'The local Cost of Transformers notes give an illustrative floor model: decode is memory-bound, a 14B-class INT4 deployment can have a very low raw compute floor when well utilized, and the same hardware can become several times more expensive when utilization falls. Treat those numbers as an arithmetic example, not a current pricing source. The durable lesson is that utilization and workload mix can dominate small architecture changes.',
      ],
    },
    {
      heading: 'Why hosted APIs cost more than the floor',
      paragraphs: [
        'A hosted API price is not raw GPU rental divided by tokens. It packages burst capacity, scheduling, model refreshes, safety systems, monitoring, abuse handling, compliance, uptime, support, and idle headroom. Self-hosting removes provider markup but adds ML engineering, SRE, evaluation, security, release management, and model-decay work.',
        'The right comparison is not "API expensive, GPU cheap." It is total cost per accepted task at the required quality and latency. Low-volume teams often rationally pay the API premium. High-volume or repetitive workloads may earn self-hosting, semantic caching, smaller-model routing, or on-device inference.',
      ],
    },
    {
      heading: 'Production route case study',
      paragraphs: [
        'A support product receives FAQ, account-specific, legal-risk, and ambient summarization traffic. FAQ requests first hit a semantic cache governed by an LLM Response Cache Safety Ledger, with freshness, authorization, admission, and audit checks. Low-risk drafting goes to a small model plus verifier. Account-specific support uses a hosted strong model when the customer tier requires high reliability. Legal-risk answers use a stronger model, citations, and audit. Ambient summarization runs on device when possible because cloud metering makes always-on usage expensive.',
        'Every route writes a ledger row: why the route fired, what it cost, whether the output passed evaluation, which data left the device, and what fallback was available. That ledger becomes the artifact for cost review, privacy review, vendor migration, and regression debugging.',
      ],
    },
    {
      heading: 'Sources and production context',
      paragraphs: [
        'The JAX scaling book gives a clear transformer-inference overview, including latency and serving concerns: https://jax-ml.github.io/scaling-book/inference/. NVIDIA lists H100-class memory bandwidth as a key hardware constraint for accelerated servers: https://www.nvidia.com/en-us/data-center/h100/. Efficiently Scaling Transformer Inference develops analytical models for latency and model-FLOPS utilization tradeoffs at large scale: https://arxiv.org/abs/2211.05102.',
        'PagedAttention/vLLM is the key KV-memory-management source: https://arxiv.org/abs/2309.06180. It matters for economics because cache fragmentation and duplication limit batching. KV Cache Transfer Fabric Case Study adds the remote-state bill: transfer bytes, NIC pressure, parked decode slots, and cleanup failures can change cost per accepted answer even when GPU arithmetic looks cheap. KV Cache Tiered Offload Store Case Study adds the storage-tier bill: GPU memory saved must beat CPU promotion, SSD reads, remote-store latency, and recompute fallback. SLO-Aware LLM Request Router is where those bills become a route decision: cache hit, queue wait, tenant policy, SLO class, and fallback must all be visible in the accepted-answer ledger. LLM Serving Admission-Control Goodput Gate is the front-door economic decision: reject, defer, or brown out work whose token budget and deadline would otherwise burn GPU time without becoming a useful answer. LLM Serving Autoscaling Warm Pool adds the idle-capacity bill: warm GPUs cost money, but cold starts and cache-empty replicas can cost more when they turn paid requests into missed deadlines. On the route side, On-Device LLM Inference Cost Crossover covers fixed device costs, privacy, local execution, and cloud fallback.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not use raw compute floor as the product price. Do not average across request classes if one high-risk slice drives the SLO. Do not call a route cheaper unless accepted-answer quality is unchanged. Do not ignore idle headroom; burst capacity is part of the product. Do not hide model or vendor lock-in in application code. The route ledger should make every expensive decision auditable.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Transformer Inference Roofline, LLM Inference Cost Stack Case Study, KV Cache Concurrency Capacity Model, LLM Serving: PagedAttention, LLM Serving Admission-Control Goodput Gate, LLM Serving Autoscaling Warm Pool, LLM Model Rollout Shadow Canary Ledger, GenAI Trace Token Cost Ledger, Chunked Prefill Token Budget Scheduler, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, LLM Continuous Batching, Prefill/Decode Disaggregation Case Study, Semantic Cache for LLMs, LLM Response Cache Safety Ledger, Chain of Draft Reasoning Token Budget Case Study, Verifier-Guided Inference Control Plane Case Study, Agent Model Router & Context Handoff Ledger, On-Device LLM Inference Cost Crossover, Hybrid Attention State Budget Case Study, Feature Flag Control Plane, Distributed Tracing, Tail Latency & p99 Thinking, and Scaling as Local Optimum Case Study next.',
      ],
    },
  ],
};
