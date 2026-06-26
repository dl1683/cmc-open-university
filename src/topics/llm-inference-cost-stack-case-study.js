// LLM inference cost stack: map each serving optimization to the phase,
// resource, and workload shape it actually improves.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-inference-cost-stack-case-study',
  title: 'LLM Inference Cost Stack Case Study',
  category: 'Systems',
  summary: 'A phase-by-phase map of inference cost levers: batching, paged KV cache, prefix reuse, quantization, kernels, and speculation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cost levers', 'workload fit'], defaultValue: 'cost levers' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.5, note: 'prompt' },
      { id: 'route', label: 'router', x: 2.1, y: 3.5, note: 'admit' },
      { id: 'prefill', label: 'prefill', x: 3.7, y: 2.1, note: 'prompt work' },
      { id: 'kv', label: 'KV cache', x: 5.3, y: 3.5, note: 'state' },
      { id: 'decode', label: 'decode', x: 6.9, y: 2.1, note: 'stream' },
      { id: 'output', label: 'output', x: 8.7, y: 3.5, note: 'tokens' },
      { id: 'batch', label: 'batching', x: 3.7, y: 5.6, note: 'occupancy' },
      { id: 'prefix', label: 'prefix', x: 5.3, y: 5.9, note: 'reuse' },
      { id: 'spec', label: 'speculate', x: 7.0, y: 5.6, note: 'draft' },
    ],
    edges: [
      { id: 'e-request-route', from: 'request', to: 'route' },
      { id: 'e-route-prefill', from: 'route', to: 'prefill' },
      { id: 'e-prefill-kv', from: 'prefill', to: 'kv' },
      { id: 'e-kv-decode', from: 'kv', to: 'decode' },
      { id: 'e-decode-output', from: 'decode', to: 'output' },
      { id: 'e-route-batch', from: 'route', to: 'batch' },
      { id: 'e-prefix-kv', from: 'prefix', to: 'kv' },
      { id: 'e-spec-decode', from: 'spec', to: 'decode' },
      { id: 'e-batch-decode', from: 'batch', to: 'decode' },
    ],
  }, { title });
}

function* costLevers() {
  yield {
    state: stackGraph('Cost levers attach to different serving phases'),
    highlight: { active: ['request', 'route', 'prefill', 'kv', 'decode', 'output', 'e-request-route', 'e-route-prefill', 'e-prefill-kv', 'e-kv-decode', 'e-decode-output'], found: ['batch', 'prefix', 'spec'] },
    explanation: 'LLM inference cost is not one bottleneck. A request pays routing and queueing, prefill, KV cache residency, decode, and output streaming. Each optimization helps a specific phase and can hurt another.',
  };

  yield {
    state: labelMatrix(
      'Lever map',
      [
        { id: 'batch', label: 'batching' },
        { id: 'paging', label: 'paged KV' },
        { id: 'prefix', label: 'prefix cache' },
        { id: 'quant', label: 'quant' },
        { id: 'spec', label: 'spec decode' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['idle GPU', 'queue p99'],
        ['stranded HBM', 'block churn'],
        ['repeat prefill', 'low hit rate'],
        ['memory bytes', 'quality loss'],
        ['serial steps', 'draft mismatch'],
      ],
    ),
    highlight: { active: ['batch:saves', 'paging:saves', 'prefix:saves', 'quant:saves', 'spec:saves'] },
    explanation: 'A lever has a target and a failure mode. Continuous batching improves occupancy but can raise tail latency. Prefix caching saves repeated prompt work only when workloads share prefixes. Speculation helps when the draft model predicts accepted tokens.',
    invariant: 'Measure the phase before choosing the lever.',
  };

  yield {
    state: stackGraph('KV cache is the concurrency budget'),
    highlight: { active: ['prefill', 'kv', 'decode', 'prefix', 'e-prefill-kv', 'e-kv-decode', 'e-prefix-kv'], compare: ['batch'] },
    explanation: 'The KV cache turns context into live GPU memory. PagedAttention reduces fragmentation, prefix caching avoids recomputing shared context, and KV quantization can raise concurrency if quality and kernels cooperate.',
  };

  yield {
    state: labelMatrix(
      'Cost accounting columns',
      [
        { id: 'ttft', label: 'TTFT' },
        { id: 'tpot', label: 'TPOT' },
        { id: 'throughput', label: 'tokens/s' },
        { id: 'dollars', label: 'dollars' },
      ],
      [
        { id: 'mostly', label: 'mostly sees' },
        { id: 'common miss', label: 'common miss' },
      ],
      [
        ['prefill plus queue', 'ignore prompt reuse'],
        ['decode memory path', 'only tune kernels'],
        ['batch and occupancy', 'hide p99'],
        ['all phases plus idle', 'ignore utilization'],
      ],
    ),
    highlight: { active: ['ttft:mostly', 'tpot:mostly', 'throughput:mostly', 'dollars:mostly'] },
    explanation: 'Good cost reporting separates time to first token, time per output token, aggregate throughput, tail latency, and dollars per useful task. One average hides too much.',
  };
}

function* workloadFit() {
  yield {
    state: labelMatrix(
      'Workload to lever fit',
      [
        { id: 'chat', label: 'short chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agents' },
        { id: 'batch', label: 'batch jobs' },
      ],
      [
        { id: 'best', label: 'best levers' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['batch and quant', 'stream p99'],
        ['prefix and prefill', 'cache hits'],
        ['paged KV and tracing', 'long state'],
        ['large batches', 'throughput only'],
      ],
    ),
    highlight: { found: ['chat:best', 'rag:best', 'agent:best', 'batch:best'] },
    explanation: 'Different products want different optimizers. A chat UI needs smooth streaming. RAG cares about prefill reuse and context packing. Agents care about long state and restart cost. Offline jobs care about throughput per dollar.',
  };

  yield {
    state: stackGraph('Agent workloads stress state more than math'),
    highlight: { active: ['request', 'prefill', 'kv', 'decode', 'prefix', 'batch', 'e-prefill-kv', 'e-prefix-kv', 'e-batch-decode'], compare: ['spec'] },
    explanation: 'Long-context and agentic workloads keep more tokens resident, revisit shared prefixes, and generate tool traces. Their cost problem is often state residency and recompute, not only raw matmul speed.',
  };

  yield {
    state: labelMatrix(
      'Do not optimize in isolation',
      [
        { id: 'quant', label: 'quant' },
        { id: 'spec', label: 'spec' },
        { id: 'prefix', label: 'prefix' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'needs', label: 'needs' },
      ],
      [
        ['fewer bytes', 'quality eval'],
        ['fewer steps', 'accept rate'],
        ['less prefill', 'stable prompts'],
        ['higher use', 'latency budget'],
      ],
    ),
    highlight: { active: ['quant:needs', 'spec:needs', 'prefix:needs', 'batch:needs'] },
    explanation: 'Every serving optimization has a companion measurement. Quantization needs quality evals. Speculation needs acceptance rate. Prefix caching needs cache-hit reporting. Batching needs p95 and p99 latency.',
  };

  yield {
    state: labelMatrix(
      'Production decision rule',
      [
        { id: 'phase', label: 'phase' },
        { id: 'lever', label: 'lever' },
        { id: 'slice', label: 'slice' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['where is the wall?', 'TTFT/TPOT profile'],
        ['what does it trade?', 'lever map'],
        ['who gets slower?', 'latency slices'],
        ['how to undo?', 'canary gate'],
      ],
    ),
    highlight: { found: ['phase:artifact', 'lever:artifact', 'slice:artifact', 'rollback:artifact'] },
    explanation: 'The practical workflow is profile, choose a lever, measure by workload slice, and canary. Inference cost is a control-plane problem as much as a kernel problem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cost levers') yield* costLevers();
  else if (view === 'workload fit') yield* workloadFit();
  else throw new InputError('Pick an LLM inference cost view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for LLM inference cost stack. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: "callout", text: "Inference cost falls only when each optimization is attached to the specific phase and workload shape it actually improves."},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM inference cost stack exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in LLM inference cost stack. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM inference cost stack fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a GPU costs $3 per hour and serves 120 successful chat requests per minute at baseline. That is 7200 requests per hour, or $0.000417 per successful request before overhead. If p99 misses cause 5% retries, useful cost rises to about $3 / 6840 = $0.000439.',
        'Prefix caching removes 40% of prefill work for a templated support route, raising throughput on that route to 150 successful requests per minute with the same retry rate. Cost becomes $3 / 8550 = $0.000351 per useful request. The win is real only for the route with repeated prefixes.',
        'If the same cache is applied to personalized account answers and creates a 0.5% unsafe-hit rate, the cost calculation is invalid. Cost as behavior means the system counts useful allowed answers, not merely avoided model calls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM and PagedAttention at https://arxiv.org/abs/2309.06180, SGLang at https://arxiv.org/abs/2312.07104, DistServe at https://arxiv.org/abs/2401.09670, Speculative Decoding at https://arxiv.org/abs/2211.17192, AWQ at https://arxiv.org/abs/2306.00978, and Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102. Study Transformer Inference Roofline, KV Cache, Continuous Batching, PagedAttention, Prefill/Decode Disaggregation, Quantization, and Tail Latency next.',
      ],
    },
  ],
};

