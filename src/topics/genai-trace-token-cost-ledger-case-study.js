// GenAI observability: trace spans need model, token, cache, tool, eval,
// safety, and cost fields to explain LLM incidents.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'genai-trace-token-cost-ledger-case-study',
  title: 'GenAI Trace Token Cost Ledger',
  category: 'Systems',
  summary: 'A GenAI observability case study: span trees, model/version fields, token usage, cache hits, tool calls, evaluations, safety verdicts, cost, redaction, and tail sampling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['span tree', 'token ledger', 'sampling audit'], defaultValue: 'span tree' },
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

function traceGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'gw', label: 'gw', x: 0.7, y: 3.5, note: notes.gw ?? 'trace' },
      { id: 'route', label: 'route', x: 2.3, y: 3.5, note: notes.route ?? 'model' },
      { id: 'rag', label: 'RAG', x: 4.0, y: 1.5, note: notes.rag ?? 'docs' },
      { id: 'llm', label: 'LLM', x: 4.0, y: 3.5, note: notes.llm ?? 'span' },
      { id: 'tool', label: 'tool', x: 4.0, y: 5.5, note: notes.tool ?? 'call' },
      { id: 'eval', label: 'eval', x: 5.9, y: 2.5, note: notes.eval ?? 'score' },
      { id: 'safe', label: 'safe', x: 5.9, y: 4.5, note: notes.safe ?? 'policy' },
      { id: 'cost', label: 'cost', x: 7.7, y: 3.5, note: notes.cost ?? 'tokens' },
      { id: 'store', label: 'store', x: 9.2, y: 3.5, note: notes.store ?? 'OTLP' },
    ],
    edges: [
      { id: 'e-gw-route', from: 'gw', to: 'route' },
      { id: 'e-route-rag', from: 'route', to: 'rag' },
      { id: 'e-route-llm', from: 'route', to: 'llm' },
      { id: 'e-route-tool', from: 'route', to: 'tool' },
      { id: 'e-rag-eval', from: 'rag', to: 'eval' },
      { id: 'e-llm-eval', from: 'llm', to: 'eval' },
      { id: 'e-llm-safe', from: 'llm', to: 'safe' },
      { id: 'e-tool-safe', from: 'tool', to: 'safe' },
      { id: 'e-eval-cost', from: 'eval', to: 'cost' },
      { id: 'e-safe-cost', from: 'safe', to: 'cost' },
      { id: 'e-cost-store', from: 'cost', to: 'store' },
    ],
  }, { title });
}

function tokenPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'reqs', min: 0, max: 100 }, y: { label: 'tokens', min: 0, max: 9000 } },
    series: [
      { id: 'input', label: 'input', points: [{ x: 10, y: 900 }, { x: 25, y: 1600 }, { x: 50, y: 3000 }, { x: 75, y: 5200 }, { x: 100, y: 7600 }] },
      { id: 'cached', label: 'cached', points: [{ x: 10, y: 300 }, { x: 25, y: 900 }, { x: 50, y: 2100 }, { x: 75, y: 3800 }, { x: 100, y: 5900 }] },
      { id: 'output', label: 'output', points: [{ x: 10, y: 200 }, { x: 25, y: 500 }, { x: 50, y: 1000 }, { x: 75, y: 1700 }, { x: 100, y: 2500 }] },
    ],
    markers,
  });
}

function costPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'latency', min: 0, max: 1200 }, y: { label: 'cost', min: 0, max: 100 } },
    series: [
      { id: 'normal', label: 'normal', points: [{ x: 100, y: 5 }, { x: 220, y: 10 }, { x: 400, y: 18 }, { x: 650, y: 32 }, { x: 900, y: 48 }] },
      { id: 'agent', label: 'agent', points: [{ x: 180, y: 12 }, { x: 420, y: 28 }, { x: 700, y: 55 }, { x: 900, y: 72 }, { x: 1150, y: 92 }] },
    ],
    markers,
  });
}

function* spanTree() {
  yield {
    state: traceGraph('A GenAI request is a span tree, not one call'),
    highlight: { active: ['gw', 'route', 'rag', 'llm', 'tool', 'e-gw-route'], found: ['eval', 'safe'], compare: ['store'] },
    explanation: 'A serious LLM trace includes routing, retrieval, the model call, tool calls, evaluation, safety policy, token accounting, and export. One opaque HTTP span cannot explain an LLM incident.',
  };

  yield {
    state: labelMatrix(
      'Core span fields',
      [
        { id: 'model', label: 'model' },
        { id: 'prompt', label: 'prompt' },
        { id: 'route', label: 'route' },
        { id: 'cache', label: 'cache' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['req', 'diff'],
        ['hash', 'roll'],
        ['rep', 'p99'],
        ['hit', 'cost'],
        ['tier', 'policy'],
      ],
    ),
    highlight: { active: ['model:field', 'prompt:field', 'cache:field'], found: ['route:why', 'tenant:why'] },
    explanation: 'Model requested, model served, prompt hash, route, cache result, tenant tier, and policy state must be span fields. Otherwise rollout, cache, and route changes blur together.',
    invariant: 'If a field changes behavior, record it in a bounded, queryable form.',
  };

  yield {
    state: traceGraph('Eval and safety spans explain the answer path', { eval: 'rubric', safe: 'allow', cost: 'bill' }),
    highlight: { active: ['llm', 'eval', 'safe', 'cost', 'e-llm-eval', 'e-llm-safe'], compare: ['tool'] },
    explanation: 'Quality and safety are not comments in a log line. They need structured spans or events with evaluator version, policy version, score, reason, and action.',
  };

  yield {
    state: labelMatrix(
      'Sensitive fields',
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
        { id: 'docs', label: 'docs' },
        { id: 'tools', label: 'tools' },
        { id: 'ids', label: 'ids' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'safe', label: 'safe' },
      ],
      [
        ['PII', 'hash'],
        ['secret', 'sample'],
        ['private', 'ids'],
        ['args', 'mask'],
        ['high card', 'bucket'],
      ],
    ),
    highlight: { active: ['input:safe', 'output:safe', 'tools:safe'], compare: ['ids:risk'] },
    explanation: 'GenAI telemetry is high-risk because prompts and outputs may contain private data. Prefer ids, hashes, bounded labels, redaction, and policy sampling over dumping full content by default.',
  };

  yield {
    state: traceGraph('Collector policy governs what leaves the service', { store: 'redact', cost: 'sample' }),
    highlight: { active: ['cost', 'store', 'e-cost-store'], found: ['safe'], compare: ['gw'] },
    explanation: 'The Collector boundary is where teams enforce redaction, sampling, routing, and retention. GenAI traces need this more than ordinary traces because content can be expensive and sensitive.',
  };
}

function* tokenLedger() {
  yield {
    state: labelMatrix(
      'Token ledger',
      [
        { id: 'input', label: 'input' },
        { id: 'cached', label: 'cached' },
        { id: 'output', label: 'output' },
        { id: 'reason', label: 'reason' },
        { id: 'tool', label: 'tool' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'bill', label: 'bill' },
      ],
      [
        ['prompt', 'base'],
        ['read', 'cheap'],
        ['answer', 'base'],
        ['hidden', 'varies'],
        ['schema', 'input'],
      ],
    ),
    highlight: { active: ['input:count', 'cached:count', 'output:count'], compare: ['reason:bill'], found: ['tool:bill'] },
    explanation: 'Token accounting should separate input, cached input, output, reasoning or hidden tokens where exposed, and tool/schema overhead. A single total hides the economics.',
  };

  yield {
    state: tokenPlot([
      { id: 'save', x: 75, y: 3800, label: 'saved' },
    ]),
    highlight: { active: ['input', 'cached', 'output', 'save'], compare: [] },
    explanation: 'Cached tokens are still part of the request shape but have different latency and cost effects. Traces should expose both the full input and the cached portion.',
  };

  yield {
    state: costPlot([
      { id: 'tail', x: 900, y: 72, label: 'tail' },
    ]),
    highlight: { active: ['agent', 'tail'], compare: ['normal'] },
    explanation: 'Cost and latency often correlate for agentic calls because long prompts, tool loops, and verifier passes add both delay and tokens. A token-cost ledger makes the tail explainable.',
  };

  yield {
    state: labelMatrix(
      'Cache observability',
      [
        { id: 'key', label: 'key' },
        { id: 'read', label: 'read' },
        { id: 'write', label: 'write' },
        { id: 'deny', label: 'deny' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['hash', 'reuse'],
        ['hit', 'saved'],
        ['miss', 'warm'],
        ['reason', 'safe'],
        ['worker', 'local'],
      ],
    ),
    highlight: { active: ['key:field', 'read:field', 'write:field', 'deny:field'], found: ['route:why'] },
    explanation: 'Prompt cache, KV cache, response cache, and semantic cache all need reason-coded spans. Hit rate without deny reasons is a dangerous metric.',
  };

  yield {
    state: labelMatrix(
      'Cost row',
      [
        { id: 'model', label: 'model' },
        { id: 'tokens', label: 'tokens' },
        { id: 'cache', label: 'cache' },
        { id: 'eval', label: 'eval' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'join', label: 'join' },
      ],
      [
        ['price', 'bill'],
        ['in/out', 'cost'],
        ['saved', 'lat'],
        ['judge', 'qual'],
        ['rep', 'SLO'],
      ],
    ),
    highlight: { active: ['model:field', 'tokens:field', 'cache:join', 'eval:join'], compare: ['route:join'] },
    explanation: 'Cost per useful answer needs model price id, input/output token counts, cached-token savings, evaluator spend, and route/SLO context in the same joinable row.',
  };
}

function* samplingAudit() {
  yield {
    state: traceGraph('Tail sampling keeps rare expensive traces whole', { cost: 'tail', store: 'keep' }),
    highlight: { active: ['gw', 'route', 'llm', 'tool', 'cost', 'store'], found: ['eval', 'safe'] },
    explanation: 'Head sampling can drop the one trace that matters before it knows the request was slow, costly, unsafe, or low quality. Tail sampling waits for the trace shape before deciding.',
  };

  yield {
    state: labelMatrix(
      'Keep policies',
      [
        { id: 'slow', label: 'slow' },
        { id: 'cost', label: 'cost' },
        { id: 'error', label: 'error' },
        { id: 'unsafe', label: 'unsafe' },
        { id: 'canary', label: 'canary' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'why', label: 'why' },
      ],
      [
        ['p99', 'debug'],
        ['tokens', 'bill'],
        ['fail', 'fix'],
        ['deny', 'audit'],
        ['v2', 'rollout'],
      ],
    ),
    highlight: { active: ['slow:signal', 'cost:signal', 'unsafe:signal', 'canary:signal'], compare: ['error:signal'] },
    explanation: 'GenAI sampling policy should keep slow traces, high-token traces, errors, safety denies, and canary traffic. Random samples alone miss the expensive edge cases.',
  };

  yield {
    state: costPlot([
      { id: 'keep', x: 1150, y: 92, label: 'keep' },
      { id: 'drop', x: 220, y: 10, label: 'drop' },
    ]),
    highlight: { active: ['agent', 'keep'], compare: ['normal', 'drop'] },
    explanation: 'A policy can keep the upper-right corner of latency and cost while sampling ordinary traces lightly. That preserves debugging power without storing everything.',
  };

  yield {
    state: labelMatrix(
      'Cardinality caps',
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'prompt', label: 'prompt' },
        { id: 'model', label: 'model' },
        { id: 'tool', label: 'tool' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'good', label: 'good' },
      ],
      [
        ['raw id', 'tier'],
        ['full text', 'hash'],
        ['freeform', 'version'],
        ['args', 'name'],
        ['score text', 'bucket'],
      ],
    ),
    highlight: { active: ['prompt:good', 'model:good', 'tool:good', 'eval:good'], removed: ['prompt:bad'] },
    explanation: 'Keep attributes queryable. Raw prompts, raw tenant ids, free-form model names, and evaluator rationales can explode cardinality or leak data.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'span', label: 'span' },
        { id: 'tokens', label: 'tokens' },
        { id: 'redact', label: 'redact' },
        { id: 'sample', label: 'sample' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'prove', label: 'prove' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['tree', 'ids'],
        ['in/out', 'cost'],
        ['PII', 'hash'],
        ['tail', 'rare'],
        ['eval', 'SLO'],
      ],
    ),
    highlight: { active: ['span:prove', 'tokens:prove', 'redact:guard', 'sample:guard'], found: ['join:prove'] },
    explanation: 'Before shipping GenAI observability, prove span tree completeness, token-cost joins, redaction, rare-trace sampling, and links from evaluation results to SLO and billing records.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'span tree') yield* spanTree();
  else if (view === 'token ledger') yield* tokenLedger();
  else if (view === 'sampling audit') yield* samplingAudit();
  else throw new InputError('Pick a GenAI trace view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for GenAI Trace Token Cost Ledger. A GenAI observability case study: span trees, model/version fields, token usage, cache hits, tool calls, evaluations, safety verdicts, cost, redaction, and tail sampling..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A normal web trace can say that POST /chat took 1.1 seconds. That is not enough for a GenAI incident. The request may have routed across models, expanded a prompt with retrieval, missed a prompt cache, called tools, retried a tool, streamed an answer, run a judge, passed through safety policy, and produced a billable token row. One opaque HTTP span cannot explain that path.',
        'A GenAI trace token-cost ledger exists to make the request explainable without replaying production. It should answer why a request was slow, expensive, unsafe, low quality, cache-missed, or routed to the wrong model. It should also do that without dumping private prompts and outputs into telemetry by default.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable design is ordinary distributed tracing plus application logs. The gateway span records latency. The model client logs the provider response id and total tokens. The billing system records cost later. The evaluator writes scores to a separate table. Cache behavior may live in model-server logs or not be recorded at all.',
        'This works while incidents are simple. It breaks when cost, quality, safety, and routing interact. A model rollout changes output length. A prompt template change misses cache. A retrieval expansion increases input tokens. A tool loop causes both latency and spend. If those facts are split across unjoined systems, the team spends the incident reconstructing the request instead of fixing it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A single token total hides the economics. Input tokens, cached input tokens, output tokens, reasoning tokens where exposed, tool schemas, retrieval chunks, and judge calls can have different latency and cost behavior. A total of 8,000 tokens does not say whether the problem was a long prompt, a verbose answer, a cache miss, or a tool loop.',
        'Raw logging creates the opposite problem. Full prompts, full outputs, tool arguments, tenant identifiers, and evaluator rationales may contain private or regulated data. They are also poor metric labels because they create extreme cardinality. Bad GenAI observability can be both unsafe and hard to query.',
        'Sampling can hide the traces that matter most. Head sampling decides early, before the system knows whether the request became slow, costly, unsafe, or important to a canary rollout. GenAI failures often live in the tail, so random early dropping can remove the evidence needed for debugging.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a span tree plus a joinable token-cost row. The span tree preserves causality: gateway, router, retrieval, model call, tool call, evaluator, safety policy, cost accounting, and export. The token-cost row preserves economics: model, price id, input tokens, cached input tokens, output tokens, tool overhead, evaluator spend, latency, and accepted-answer state.',
        'The key invariant is that fields used to change behavior must also be fields used to explain behavior. If the router reads tenant tier, model policy, prompt version, or cache state, the trace should expose a bounded representation of those fields. If a rollout gate can send traffic to model v2, the trace must say which model was requested and which model was served.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The trace begins at the gateway with a trace id and request class. A routing span records the requested model, served model, route id, policy version, tenant tier, and fallback decision. Retrieval spans record document collection, query hash, chunk count, and retrieval latency. Model spans record provider, model version, prompt hash, input tokens, cached tokens, output tokens, time to first chunk, finish reason, and provider response id where safe.',
        'Tool spans record tool name, schema version, argument shape, result status, retry count, and latency. Evaluation spans record evaluator version, score bucket, rubric id, and action. Safety spans record policy version, verdict, reason bucket, and enforcement action. A cost span or row joins those pieces into a billable and debuggable record.',
        'OpenTelemetry GenAI semantic conventions provide a common direction for this telemetry. The registry includes fields for providers, requested and response models, token counts, cached input tokens, time to first token or chunk, and evaluation-related attributes. The conventions also warn that message content can be sensitive. That warning is central, not incidental.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A span tree preserves order and parentage. If retrieval expanded the prompt before the model call, the trace shows that. If a tool retry happened after the first model call and before a second judge pass, the trace shows that too. This matters because GenAI incidents are often path-dependent. The answer may be wrong because the wrong document was retrieved, not because the model decoded poorly.',
        'The token-cost row makes the economics queryable. A team can ask whether cost rose because output length increased, cache hit rate fell, retrieval expanded prompts, or evaluators ran more often. It can compare model versions by cost per accepted answer instead of raw latency alone. It can also connect billing disputes to specific request classes and policy versions.',
        'Bounded fields make aggregation safe enough to use. Prompt hashes, prompt-template versions, cache-key versions, tenant tiers, model versions, route ids, evaluator versions, and score buckets preserve explainability without turning raw content into high-cardinality labels or privacy leaks.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Detailed GenAI tracing costs storage, collector CPU, schema work, privacy review, and developer discipline. It can also slow incident response if every service invents its own field names. The answer is not to record everything. The answer is to record the fields that explain behavior in bounded, documented forms.',
        'The hardest tradeoff is content. Full prompts and outputs are useful during debugging, but they may contain personal data, secrets, customer records, or regulated information. Many systems should store hashes, ids, redacted snippets, or sampled content under policy rather than raw text by default. Content capture should have an owner, a retention rule, and an access model.',
        'Cardinality is the other tradeoff. Raw tenant ids, prompt text, free-form model strings, tool arguments, and evaluator rationales can make metrics expensive and hard to query. Bucket, hash, normalize, or move those fields into controlled logs instead of high-cardinality span attributes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern wins for agent cost spikes, model rollout regressions, cache misses, tool-call loops, safety denies, evaluator drift, tenant policy disputes, and billing investigations. It is strongest when product teams need to join quality, latency, cost, and release state for the same request.',
        'A coding assistant example shows the value. The ordinary trace says the request took 1.1 seconds. The GenAI ledger says model v2 was selected by a canary route, the prompt hash missed cache because the tool schema version changed, retrieval returned 18 chunks, the formatter tool retried once, the judge ran twice, and the final answer was accepted. The fix points to prompt-layout and tool-schema rollout, not a vague complaint about model speed.',
        'A support bot example is similar. A cost spike appears after a policy update. The ledger shows that output tokens did not increase, but safety denials triggered a second generation for a specific customer tier. The relevant owner is the safety policy rollout, not the model-serving team.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'The pattern fails when teams dump full prompts and outputs into always-on spans, use raw tenant ids or prompt text as labels, aggregate cost without model and cache context, or let evaluator rationales and tool arguments bypass redaction. Those choices create risk without reliable insight.',
        'It also fails when the trace schema is not tied to behavior. Recording a model name is not enough if the route id, prompt version, cache-key version, and policy version are missing. Recording token totals is not enough if cached tokens and evaluator spend are invisible. The ledger must match the decisions the system actually makes.',
        'Finally, it fails when sampling policy drops every rare failure. Random samples are useful for baseline traffic, but expensive GenAI incidents often live in long prompts, canaries, safety denies, tool loops, and high-cost agents. Tail sampling or policy sampling is necessary to keep those traces whole.',
      ],
    },
    {
      heading: 'Tail sampling and retention',
      paragraphs: [
        'Tail sampling waits until the trace has enough shape to decide whether to keep it. A policy can retain traces with high latency, high token count, errors, safety denies, low evaluator scores, canary model versions, or expensive tool loops. Ordinary successful traces can be sampled lightly. This preserves debugging value without storing everything.',
        'Retention should follow risk and utility. A high-level token-cost row may be kept longer for billing and trend analysis. Redacted spans may be kept for operational debugging. Raw content, if captured at all, should have stricter access and shorter retention. The goal is to keep evidence, not to build an accidental prompt warehouse.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an agentic research product with a sudden cost increase. The old dashboard shows request count is stable and median latency is only slightly higher. Without a ledger, the team argues about whether the model got slower, users submitted longer prompts, or retrieval expanded context.',
        'The GenAI trace ledger answers the question directly. It shows that a canary route moved 20 percent of traffic to a larger model, prompt cache hit rate dropped because the system prompt version changed, and evaluator retries doubled for one task class. Output tokens stayed mostly flat, but cached input savings disappeared and judge spend rose. The incident is a rollout and cache-key problem, not organic usage growth.',
        'The fix is also measurable. The team reverts the prompt version for that route, restores cache-key compatibility, and tightens the evaluator retry policy. The next ledger slice shows recovered cache hits, lower judge calls, lower p99, and stable quality scores. That is what the trace token-cost ledger is for: turning a vague AI cost story into a queryable system diagnosis.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references include the OpenTelemetry GenAI semantic-convention registry at https://github.com/open-telemetry/semantic-conventions/blob/main/docs/registry/attributes/gen-ai.md and the OpenTelemetry GenAI events documentation at https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/. Use them as a schema starting point, then adapt field retention and redaction to the product risk model.',
        'Study distributed tracing, trace context propagation, the OpenTelemetry Collector, tail sampling, metric exemplars, PII redaction pipelines, model rollout ledgers, prompt cache-key canonicalization, response-cache safety, serving admission control, LLM unit economics, and AI audit evidence packets. The larger lesson is that AI observability is not separate from systems observability. It is distributed tracing with model, token, cache, evaluation, safety, and cost fields made first-class.',
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
        'Use this topic as a checkpoint: if you can explain why GenAI Trace Token Cost Ledger moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

