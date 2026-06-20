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
      heading: 'Why this exists',
      paragraphs: [
        'An LLM unit-economics ledger measures the cost of useful answers, not the cost of tokens in isolation. It starts with inference physics: input tokens, output tokens, prefill, decode, KV cache residency, hardware, and utilization. Then it adds the product layer: routing, cache hits, retries, verifier calls, policy rejects, fixed operations, support burden, privacy boundaries, and quality gates. The final unit is cost per accepted answer.',
        'That distinction matters because the product does not sell raw token generation. It sells a support answer, a legal draft, a coding suggestion, an agent action, a summary, or an ambient feature. A cheap response that fails quality and must be retried is not cheap. A route that saves model spend but breaks p99 latency is not cheaper in the product sense. A ledger makes those hidden costs visible.',
        {type: 'callout', text: 'Price the accepted product outcome, not the raw token stream.'},
      ],
    },
    {
      heading: 'Why raw token math is not enough',
      paragraphs: [
        'Raw token math is the floor. If you know model size, precision, hardware price, throughput, and utilization, you can estimate a cost per million tokens. That is useful, but it is incomplete. It ignores idle capacity, batch shape, tail latency, failed generations, safety filters, evaluation, retries, route fallbacks, and the engineering layer needed to keep the service running.',
        'It also hides phase behavior. Prefill and decode are different workloads. Prefill processes the prompt and builds KV cache, often with more parallelism. Decode emits one token step after another and often waits on memory bandwidth for weights and KV cache. Input tokens and output tokens can therefore have different cost shapes. A prompt-heavy summarization workload, a short-chat workload, and a long-reasoning workload should not share one average token price unless the team is intentionally choosing to lose information.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to price the accepted product unit, not the visible model call. Tokens are one input to that unit. The real unit also includes route choice, quality rejection, retry work, cache behavior, latency misses, privacy controls, fixed operations, and the cost of keeping the service reliable.',
        'That changes the engineering question. A cheaper model is not cheaper if it increases rejections. A faster route is not faster if it raises fallback traffic. A self-hosted path is not cheaper if idle headroom and on-call work dominate the GPU savings. The ledger forces each route to prove that accepted-answer economics improved.',
      ],
    },
    {
      heading: 'The minimum row',
      paragraphs: [
        'A useful ledger row records at least these fields: request id, tenant or product surface, task class, model id, route, provider or cluster, input tokens, output tokens, prefill time, decode time, queue time, cache hit state, KV memory class, verifier calls, retry count, accepted or rejected state, rejection reason, privacy boundary, SLO class, and final cost allocation.',
        'The row should also record fixed and shared costs through allocation keys. Hosted API usage may be direct. Self-hosted inference needs GPU depreciation or rental, utilization, power if relevant, networking, storage, SRE, ML engineering, evaluation, release management, safety review, monitoring, incident response, and idle headroom. Some of those costs are hard to allocate perfectly. That is not a reason to omit them. A rough allocation is still better than pretending the GPU bill is the whole service.',
      ],
    },
    {
      heading: 'A concrete formula',
      paragraphs: [
        'For one route, start with generated cost: input token cost plus output token cost, or the internal equivalent from GPU seconds and utilization. Add verifier cost, retrieval cost, cache lookup cost, tool-call cost, and amortized fixed cost. Then divide by accepted answers, not attempted answers. In plain form: accepted unit cost = total route cost / accepted answers.',
        'If 1000 attempts cost $10 in model and service spend, but 120 are rejected by policy or quality checks and 80 require one retry, the accepted-answer cost is not one cent. The retry work consumed more compute, and only 880 answers were accepted. If retries add $0.80, the accepted unit is $10.80 / 880, or about 1.23 cents. The point is not the specific number. The point is the denominator. Rejected and retried work belongs in the cost of useful answers.',
        'The same formula applies to latency. Average tokens per second is not the user unit. The user feels time to first token, time to final answer, and p99 misses. A route that is cheap on average but often misses a contractual deadline should be charged for its misses, fallback calls, or customer-impact budget.',
      ],
    },
    {
      heading: 'How the visualizer maps the ledger',
      paragraphs: [
        'The token-ledger view shows that the raw GPU floor is only one column. Workload mix controls prefill and decode. Tokens control billable or internal compute. Utilization controls the idle tax. Operations add fixed cost. Quality determines whether the answer counts. Routing decides which path pays the bill. The accepted answer is at the end because it is the business unit.',
        'The product-routes view shows why one model path is usually wrong. FAQ traffic may be served from a governed semantic cache. Low-risk drafting may use a small model plus verification. Legal or financial answers may need a stronger model, citations, and audit logs. Ambient features may need on-device inference because cloud cost grows with every background use. The ledger records why the route fired so cost changes can be explained later.',
      ],
    },
    {
      heading: 'Hosted API versus self-hosting',
      paragraphs: [
        'A hosted API price is not raw GPU rental divided by tokens. It packages model serving, burst capacity, scheduling, safety systems, monitoring, abuse handling, model refreshes, compliance work, uptime, and support. Some of the gap is provider margin. Some of it is the service layer that a buyer would otherwise have to build and operate.',
        'Self-hosting can still win, but only after fixed costs amortize. A team must run capacity planning, model loading, batching, KV cache management, upgrades, security, evals, incident response, and fallback. Low-volume teams often rationally pay hosted prices because the alternative is hiring and operating a platform. High-volume teams, stable workloads, strict privacy boundaries, or repetitive prompts may earn self-hosting, smaller-model routing, caching, or on-device execution.',
      ],
    },
    {
      heading: 'Routing as economics',
      paragraphs: [
        'A route policy is a financial control plane. It decides when to spend on a strong hosted model, when to use a small model, when to hit a cache, when to run on device, when to defer, and when to reject. The policy should consider task risk, tenant tier, privacy boundary, prompt length, expected output length, queue state, cache hit probability, deadline, and fallback.',
        'Consider a support product. FAQ requests first try a semantic cache with authorization and freshness checks. Low-risk drafting goes to a smaller model and a verifier. Account-specific questions use retrieval plus a stronger model if the account tier requires higher reliability. Legal-risk answers require citations and audit. Ambient meeting summaries run locally when possible, because always-on cloud usage can grow faster than subscription revenue.',
        'Every route writes a ledger row. The row explains why the route fired, what it spent, what data left the device or tenant boundary, whether the output passed quality checks, and what fallback was available. That record becomes the artifact for cost review, privacy review, vendor migration, and regression debugging.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Build the ledger from the request path outward. The inference gateway should attach a stable request id, model id, route id, tenant tier, task class, privacy boundary, and SLO class before it calls any model. The serving layer should add queue time, prefill time, decode time, input tokens, output tokens, cache state, batching state, accelerator pool, and error or timeout state. The quality layer should add verifier calls, reject reasons, retry count, human escalation, and accepted status.',
        'Keep cost allocation explicit instead of hiding it in dashboards. Hosted API calls can be priced directly from provider invoices. Self-hosted calls need an allocation model for GPU hours, reserved idle headroom, power if tracked, networking, storage, monitoring, engineering, safety review, and evaluation. The allocation model will be imperfect, but it should be versioned. When finance or engineering changes the allocation rule, old and new cost views should be explainable.',
        'Store route decisions as facts, not only as aggregate metrics. A row should answer: why was this model chosen, what cheaper route was considered, what risk forced the stronger route, what fallback existed, and what quality gate accepted the answer? That detail turns the ledger into a debugging tool. Without it, a cost spike becomes a mystery: more users, longer prompts, worse cache hit rate, lower utilization, a provider price change, or a quality regression can all look like the same monthly bill.',
      ],
    },
    {
      heading: 'Operating review loop',
      paragraphs: [
        'Review the ledger by slice. Separate interactive and batch traffic, free and enterprise tenants, short and long prompts, retrieval and no-retrieval tasks, cached and uncached answers, high-risk and low-risk domains, and each model route. A single blended cost per token can hide the fact that one feature is profitable, another is subsidized by the rest of the product, and a third is cheap only because its failures are being handled manually.',
        'The weekly review should compare accepted-answer cost, p95 and p99 latency, reject rate, retry rate, cache hit rate, fallback rate, quality score, and incident count. Cost reductions that worsen protected quality slices should be rejected. Quality gains that double spend may still be worth it for high-value tasks. The ledger does not decide strategy by itself; it gives product, finance, and engineering the same factual surface.',
        'Use experiments to change the route policy. Route a small slice to a cheaper model, a quantized self-hosted model, a larger context window, a cache-first strategy, or an on-device path. Compare accepted-answer cost at matched quality and SLO. If the cheaper path wins only by increasing retries, hiding tail latency, or dropping hard cases, it is not a real win. If it preserves acceptance and latency, promote it and leave the decision trail in the ledger.',
      ],
    },
    {
      heading: 'Costs that hide in the tail',
      paragraphs: [
        'Tail latency has a cost even when the average looks fine. Slow requests hold KV cache, occupy queue slots, trigger retries, violate SLOs, and may force the system to keep more warm capacity. A ledger should record p50, p95, p99, timeout, and fallback behavior by route. Without that split, a team can ship a cheap average path that quietly burns user trust and incident budget.',
        'KV cache is another hidden cost. Long prompts and long outputs hold memory for active sequences. Fragmentation can reduce effective capacity. Remote KV transfer can add network pressure. Tiered offload can save GPU memory but add promotion latency. These state costs belong in unit economics because they decide how many concurrent accepted answers the fleet can produce.',
        'Quality is the most expensive hidden cost. If a small model is 40 percent cheaper but causes more rejected answers, support escalations, manual review, or customer churn, the route may be worse. Evaluation slices need to match the product: citations, code correctness, policy compliance, tone, freshness, privacy, tool-call safety, and domain-specific accuracy.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A unit-economics ledger is most useful when product traffic is mixed. One feature may need a strong model. Another may be safe with caching. A third may need local execution for privacy. A fourth may be batchable overnight. The ledger keeps those decisions from collapsing into one average cost number.',
        'It also wins during architecture changes. Quantization, prompt caching, PagedAttention, continuous batching, chunked prefill, speculative decoding, self-hosting, and on-device inference all claim to reduce cost. The ledger asks the same question for each: did accepted-answer cost fall at the same quality and SLO, or did the cost move somewhere else?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails when teams feed it bad allocation rules. If fixed engineering cost is ignored, self-hosting looks artificially cheap. If policy rejects are omitted, risky routes look cheap. If p99 misses are averaged away, overloaded systems look healthy. If tenant tiers are mixed together, a free-user workload can hide the cost of an enterprise guarantee.',
        'It also fails when used as a pure cost cutter. The cheapest answer is often no answer, but a product exists to create value. The ledger should sit beside revenue, retention, risk, and quality. The goal is not minimum spend. The goal is profitable, reliable, policy-compliant answers for the right tasks.',
      ],
    },
    {
      heading: 'Misconceptions',
      paragraphs: [
        'Do not call the raw compute floor the price. It is a lower bound under assumptions. Do not call the hosted API gap pure margin. Some of it buys a service layer. Do not call a route cheaper until retries, rejects, p99, privacy, and fixed operations are included. Do not average input and output tokens if prefill and decode have different bottlenecks.',
        'Do not hide vendor or model lock-in in application code. A route ledger should make model id, provider, fallback, cache hit, and quality result visible. That makes migration possible. It also prevents a cost regression from looking like harmless application behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and production context sources: JAX scaling book inference overview at https://jax-ml.github.io/scaling-book/inference/, NVIDIA H100 product page at https://www.nvidia.com/en-us/data-center/h100/, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, and PagedAttention/vLLM at https://arxiv.org/abs/2309.06180.',
        'Study Transformer Inference Roofline, LLM Inference Cost Stack Case Study, KV Cache Concurrency Capacity Model, LLM Serving: PagedAttention, LLM Continuous Batching, Chunked Prefill Token Budget Scheduler, Prefill/Decode Disaggregation Case Study, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, LLM Serving Admission-Control Goodput Gate, LLM Serving Autoscaling Warm Pool, Semantic Cache for LLMs, LLM Response Cache Safety Ledger, GenAI Trace Token Cost Ledger, Verifier-Guided Inference Control Plane Case Study, Agent Model Router & Context Handoff Ledger, On-Device LLM Inference Cost Crossover, Feature Flag Control Plane, Distributed Tracing, Tail Latency & p99 Thinking, and Scaling as Local Optimum Case Study next.',
      ],
    },
  ],
};
