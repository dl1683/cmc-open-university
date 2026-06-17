// Speculative decoding runtime controller: choose a draft method per traffic
// segment, watch acceptance and tail latency, and fall back quickly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'speculative-decoding-runtime-controller-case-study',
  title: 'Speculative Decoding Runtime Controller Case Study',
  category: 'Systems',
  summary: 'A production serving case study: route requests among draft models, Medusa, EAGLE, Lookahead, n-gram speculation, and fallback using acceptance and latency ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['method router', 'fallback gates'], defaultValue: 'method router' },
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

function runtimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.6, y: 3.4, note: 'traffic' },
      { id: 'seg', label: 'seg', x: 2.0, y: 3.4, note: 'class' },
      { id: 'draft', label: 'dft', x: 3.8, y: 1.3, note: 'model' },
      { id: 'med', label: 'med', x: 3.8, y: 2.7, note: 'heads' },
      { id: 'eagle', label: 'egl', x: 3.8, y: 4.1, note: 'feat' },
      { id: 'look', label: 'look', x: 3.8, y: 5.5, note: 'pool' },
      { id: 'ver', label: 'ver', x: 5.7, y: 3.4, note: 'target' },
      { id: 'met', label: 'met', x: 7.3, y: 2.2, note: 'stats' },
      { id: 'fb', label: 'fb', x: 7.3, y: 4.8, note: 'plain' },
      { id: 'out', label: 'out', x: 9.0, y: 3.4, note: 'tokens' },
    ],
    edges: [
      { id: 'e-req-seg', from: 'req', to: 'seg' },
      { id: 'e-seg-draft', from: 'seg', to: 'draft' },
      { id: 'e-seg-med', from: 'seg', to: 'med' },
      { id: 'e-seg-eagle', from: 'seg', to: 'eagle' },
      { id: 'e-seg-look', from: 'seg', to: 'look' },
      { id: 'e-draft-ver', from: 'draft', to: 'ver' },
      { id: 'e-med-ver', from: 'med', to: 'ver' },
      { id: 'e-eagle-ver', from: 'eagle', to: 'ver' },
      { id: 'e-look-ver', from: 'look', to: 'ver' },
      { id: 'e-ver-met', from: 'ver', to: 'met' },
      { id: 'e-met-fb', from: 'met', to: 'fb' },
      { id: 'e-ver-out', from: 'ver', to: 'out' },
      { id: 'e-fb-out', from: 'fb', to: 'out' },
    ],
  }, { title });
}

function* methodRouter() {
  yield {
    state: runtimeGraph('Speculative method router'),
    highlight: { active: ['req', 'seg', 'draft', 'med', 'eagle', 'look', 'e-req-seg', 'e-seg-draft', 'e-seg-med', 'e-seg-eagle', 'e-seg-look'], found: ['ver'] },
    explanation: 'A production server should not enable one speculative method globally. It routes by traffic segment, model, temperature, output shape, memory headroom, and observed acceptance.',
    invariant: 'Speculation is a serving policy, not a model identity.',
  };

  yield {
    state: labelMatrix(
      'Routing table',
      [
        { id: 'code', label: 'code' },
        { id: 'json', label: 'json' },
        { id: 'chat', label: 'chat' },
        { id: 'agent', label: 'agent' },
        { id: 'hot', label: 'hot' },
      ],
      [
        { id: 'method', label: 'meth' },
        { id: 'why', label: 'why' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['EAGLE', 'acc', 'p95'],
        ['Medusa', 'shape', 'mask'],
        ['draft', 'cheap', 'qual'],
        ['look', 'copy', 'hit'],
        ['plain', 'var', 'safe'],
      ],
    ),
    highlight: { active: ['code:method', 'json:method', 'agent:method'], compare: ['chat:method'], found: ['hot:method'] },
    explanation: 'Different traffic wants different speculation. Code may reward EAGLE; constrained JSON may reward Medusa heads or draft models; repetitive agent tool calls may reward Lookahead or suffix-style pooling.',
  };

  yield {
    state: runtimeGraph('All methods report into the same verifier ledger'),
    highlight: { active: ['draft', 'med', 'eagle', 'look', 'ver', 'met', 'e-draft-ver', 'e-med-ver', 'e-eagle-ver', 'e-look-ver', 'e-ver-met'], found: ['out'] },
    explanation: 'The acceptance ledger normalizes method-specific details into common metrics: accepted tokens per target pass, verifier latency, rejected work, KV handoff, quality gate, and tail latency.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'traffic entropy', min: 0, max: 1 }, y: { label: 'best accepted tokens/pass', min: 0.8, max: 4 } },
      series: [
        { id: 'medusa', label: 'Medusa', points: [{ x: 0.1, y: 3.0 }, { x: 0.3, y: 2.6 }, { x: 0.5, y: 2.0 }, { x: 0.7, y: 1.5 }, { x: 0.9, y: 1.2 }] },
        { id: 'eagle', label: 'EAGLE', points: [{ x: 0.1, y: 3.4 }, { x: 0.3, y: 3.1 }, { x: 0.5, y: 2.4 }, { x: 0.7, y: 1.7 }, { x: 0.9, y: 1.2 }] },
        { id: 'look', label: 'Lookahead', points: [{ x: 0.1, y: 2.2 }, { x: 0.3, y: 2.0 }, { x: 0.5, y: 1.6 }, { x: 0.7, y: 1.2 }, { x: 0.9, y: 0.9 }] },
      ],
      markers: [
        { id: 'route', x: 0.42, y: 2.5, label: 'route' },
      ],
    }),
    highlight: { active: ['eagle', 'route'], compare: ['medusa', 'look'] },
    explanation: 'Traffic predictability changes the winner. The controller should learn by segment instead of assuming the highest headline speedup applies to every request.',
  };
}

function* fallbackGates() {
  yield {
    state: runtimeGraph('Fallback gates protect latency and correctness'),
    highlight: { active: ['ver', 'met', 'fb', 'out', 'e-ver-met', 'e-met-fb', 'e-fb-out'], compare: ['draft', 'med', 'eagle', 'look'] },
    explanation: 'Speculation must fail closed. If quality, latency, memory, or acceptance metrics leave the allowed band, the controller routes to plain target decoding.',
  };

  yield {
    state: labelMatrix(
      'Gate ledger',
      [
        { id: 'acc', label: 'acc' },
        { id: 'p95', label: 'p95' },
        { id: 'p99', label: 'p99' },
        { id: 'mem', label: 'mem' },
        { id: 'qual', label: 'qual' },
      ],
      [
        { id: 'now', label: 'now' },
        { id: 'min', label: 'min' },
        { id: 'act', label: 'act' },
      ],
      [
        ['2.4', '1.5', 'keep'],
        ['80', '120', 'keep'],
        ['280', '250', 'fb'],
        ['hot', 'ok', 'fb'],
        ['pass', 'pass', 'keep'],
      ],
    ),
    highlight: { active: ['acc:act', 'p95:act', 'qual:act'], removed: ['p99:act', 'mem:act'] },
    explanation: 'The controller should watch p95 and p99 separately. A method can improve average speed while hurting tail latency or memory pressure.',
  };

  yield {
    state: labelMatrix(
      'Complete case: mixed API traffic',
      [
        { id: 'a', label: 'JSON' },
        { id: 'b', label: 'code' },
        { id: 'c', label: 'chat' },
        { id: 'd', label: 'tool' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'metric', label: 'metric' },
        { id: 'act', label: 'act' },
      ],
      [
        ['med', '2.1', 'keep'],
        ['egl', '3.0', 'keep'],
        ['dft', '1.2', 'plain'],
        ['look', '2.4', 'keep'],
      ],
    ),
    highlight: { active: ['a:act', 'b:act', 'd:act'], compare: ['c:route'], found: ['c:act'] },
    explanation: 'JSON, code, chat, and tool-call traffic get different speculation policies. Chat has low acceptance at high temperature, so the controller falls back to plain decoding for that segment.',
  };

  yield {
    state: runtimeGraph('Runtime decisions become training data for serving'),
    highlight: { active: ['met', 'seg', 'e-req-seg', 'e-ver-met'], found: ['out'], compare: ['fb'] },
    explanation: 'The controller ledger becomes the dataset for future routing: segment, method, acceptance, tail latency, memory pressure, quality checks, and fallback reason. Serving policy should be observable and reversible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'method router') yield* methodRouter();
  else if (view === 'fallback gates') yield* fallbackGates();
  else throw new InputError('Pick a speculative-decoding runtime view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A speculative decoding runtime controller is the serving policy layer that decides whether a request should use a draft model, Medusa, EAGLE, Lookahead, n-gram or suffix speculation, or plain target decoding. It sits above the token-level algorithm. Its job is to decide which acceleration method is worth trying for this request, under current traffic, memory, batching, quality, and tail-latency conditions.',
        'Speculative decoding is attractive because the expensive target model can verify several proposed tokens in one pass. But the method is useful only when the proposed tokens are accepted often enough to outweigh the draft work, extra memory, scheduler complexity, and rollback cost. The controller makes that tradeoff explicit instead of assuming one paper result applies to every endpoint.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The obvious production move is to pick the fastest benchmarked speculation method, enable it for every request, and measure average tokens per second. That is simple, and it can look impressive on a narrow demo set. It also hides the real serving problem.',
        'Traffic is heterogeneous. JSON extraction, code completion, chat, summarization, tool-call planning, and high-temperature brainstorming have different acceptance behavior. A method that works on predictable JSON may waste time on open-ended chat. A method that helps a single request may hurt a continuous-batching server by increasing memory pressure or fragmenting batches. The runtime needs a decision system, not a global switch.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The controller treats speculation as a reversible route. Each route has preconditions, expected benefit, measurement fields, and fallback rules. If acceptance drops, p99 latency rises, quality checks fail, or memory pressure crosses a threshold, the route can shrink draft length, change verifier batch size, switch method, or fall back to target-only decoding.',
        'This is why the controller belongs in the control plane. Medusa heads, EAGLE feature drafting, Lookahead n-gram pools, suffix speculation, and classic draft-model verification are different proposal mechanisms. They all need the same operational question answered: is this proposal stream cheap enough, accurate enough, and schedulable enough for the current request slice?',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main data structure is a routing table keyed by traffic segment. A row can include model family, endpoint, prompt class, temperature band, output schema, average prompt length, expected generation length, current batch mode, and risk tier. Its value is a method choice plus parameters: draft length, tree width, verifier batch size, acceptance threshold, enablement percentage, and fallback method.',
        'The method registry describes requirements and side effects. A classic draft-model route needs a compatible draft model and KV handoff rules. Medusa needs trained heads and tree-attention masks. EAGLE needs feature-draft support. Lookahead needs an n-gram pool. Suffix speculation needs a suffix index. Every method also needs rollback behavior, batching compatibility, memory estimates, and quality checks.',
        'The acceptance ledger is the evidence store. For each slice it records proposed tokens, accepted tokens, rejected branches, target passes, draft cost, end-to-end latency, p50/p95/p99, memory footprint, quality flags, and fallback reasons. Without that ledger, the team may celebrate a higher average throughput while silently damaging the expensive slices users care about most.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each request, the controller first classifies the request. It looks at endpoint, model, prompt shape, temperature, schema constraints, generation length estimate, and whether the output will drive a tool or user-visible decision. Then it checks live capacity: GPU memory, batch queue depth, prefill/decode balance, cache pressure, and recent acceptance for the matching slice.',
        'If the route is enabled, the chosen proposal method generates candidate tokens or branches. The target model verifies them. Accepted tokens advance the sequence; the first rejected token forces the runtime to keep the target output and discard the invalid speculative tail. The controller logs the result and updates rolling metrics. If the route misses its acceptance or latency gate, the next requests in that slice get a safer configuration.',
        'The important point is that the controller changes behavior at request boundaries, not inside a single hallucinated policy prompt. It is normal service logic with thresholds, experiments, canaries, and rollback. That makes it observable and debuggable.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The method-router view shows the system choosing among acceleration paths before generation begins. The useful thing to watch is not only which path lights up, but which evidence justifies it: constrained schema, repeated phrase structure, low temperature, long expected decode, available draft resources, or recent high acceptance. The same request can be routed differently tomorrow if the traffic mix changes.',
        'The fallback-gates view shows why speculative decoding belongs behind runtime guards. Accepted tokens per target pass must beat the cost of proposal generation. Tail latency must not rise. Memory pressure must stay inside the service budget. Quality gates must not degrade structured outputs or tool-call arguments. When a gate fails, the controller should explain the fallback reason and return to target-only decoding without changing user-visible semantics.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Speculation works when proposal is cheaper than verification and verification can accept multiple tokens per expensive target pass. If a draft path proposes four tokens and the target accepts three, the runtime may replace three target decode steps with one target verification pass plus cheap draft work. That is the whole economic argument.',
        'The controller works because acceptance is not random noise. It clusters by model, prompt type, temperature, output format, product workflow, and recent history. Constrained JSON, boilerplate code, repeated tool-call formats, and low-temperature continuations are often more predictable than open-ended creative text. Segmenting traffic lets the runtime spend speculation where predictability exists and avoid it where rejection would dominate.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a hosted inference endpoint that serves four workloads: JSON extraction, code generation, open-ended chat, and agent tool calls. JSON extraction is constrained and repetitive, so the controller routes it to Medusa with a narrow tree and strict quality checks. Code generation routes to EAGLE when memory is healthy because feature drafting often produces longer accepted branches. Agent tool-call text routes to Lookahead because repeated function names and argument scaffolds hit the n-gram pool. High-temperature chat stays on plain target decoding because acceptance is low and user-visible wording matters.',
        'During normal traffic, the acceptance ledger shows JSON accepting enough tokens to keep Medusa enabled. Later, a product change adds new tool schemas. Lookahead hit rate falls, so the controller disables that route until the pool rebuilds useful continuations. During a traffic spike, GPU memory pressure rises and EAGLE p99 regresses for code. The controller lowers enablement or falls back to plain decoding. No engineer has to redeploy the model to protect the service.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost model has more terms than speedup. Proposal generation consumes compute. Extra heads or draft models consume memory. Tree attention and verification change scheduler behavior. Rejected branches waste work. Larger draft lengths can improve best-case speed while worsening p99 when acceptance is mediocre. Metrics must be reported by traffic segment, not only as a blended average.',
        'There is also an operational cost. Each method adds compatibility checks, deployment artifacts, route rules, observability, and incident paths. A small team may be better served by one conservative speculative method with excellent rollback than by five partially understood methods with unclear quality gates.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The controller wins in high-volume serving where the same endpoint sees repeatable slices. It is especially useful for structured outputs, low-temperature generation, boilerplate-heavy code, templated assistant workflows, and agent scaffolding where many continuations are predictable. It also helps when the service can canary methods and gather enough traffic to measure acceptance reliably.',
        'It is less useful for tiny models, very short completions, highly creative high-temperature traffic, workloads bottlenecked on prefill rather than decode, or systems where memory is already the tight constraint. If the target model is not the expensive part of the request, speculative decoding may optimize the wrong thing.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The worst failure is silent regression: average throughput improves while tail latency, memory pressure, or quality gets worse for the highest-value slice. The second failure is method lock-in: leaving a speculative path enabled after acceptance collapses because dashboards still show a blended win. The third failure is comparing papers instead of deployments. A method can be elegant and still lose inside a particular batching engine.',
        'Do not judge a route only by accepted tokens per pass. Compare end-to-end latency, throughput, p99, memory, quality, scheduler impact, rollback frequency, and operator complexity by traffic segment. Also check semantic quality. Verification guarantees that the target model accepted tokens under the decoding procedure; it does not prove the product outcome is good.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: vLLM speculative decoding at https://docs.vllm.ai/en/stable/features/speculative_decoding/, NVIDIA Triton speculative decoding at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tutorials/Feature_Guide/Speculative_Decoding/README.html, speculative decoding at https://arxiv.org/abs/2211.17192, Medusa at https://arxiv.org/abs/2401.10774, EAGLE at https://arxiv.org/abs/2401.15077, and Lookahead Decoding at https://arxiv.org/abs/2402.02057.',
        'Study next: Speculative Decoding Acceptance Ledger for the token-level acceptance record, Medusa Tree Attention Candidate Mask Case Study for multi-head branch verification, EAGLE Feature Draft Tree Case Study for feature-level proposals, Lookahead Decoding N-Gram Pool Case Study for repeated continuation reuse, LLM Continuous Batching for scheduler interaction, and Transformer Inference Roofline for the decode-side cost model.',
      ],
    },
  ],
};
