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
        'Read the animation as one request moving through a causal trace. A span is a timed operation inside a trace, a token is a model input or output unit used for billing and context length, and a ledger is the durable row that joins tokens, cost, model choice, cache behavior, tools, and policy decisions.',
        'Active spans are running now, visited spans have already produced evidence, and found rows are facts that can be queried after the incident. The safe inference rule is that every field used to route, cache, judge, or bill the request must be recorded in a bounded form that can explain the behavior later.',
        {type:"callout", text:"A GenAI incident becomes debuggable only when model routing, retrieval, tools, safety, evaluation, tokens, and cost are captured as one causal trace."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A normal web trace might say that POST /chat took 1.1 seconds. That does not explain whether the request used the intended model, missed a prompt cache, called a tool twice, retrieved too many chunks, ran an evaluator, or crossed a safety policy.',
        'A GenAI trace token-cost ledger exists so teams can debug quality, latency, safety, and spend without replaying production traffic. It turns an opaque model call into a request history with causal order and cost attribution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is ordinary distributed tracing plus a few logs. The gateway records latency, the model client logs a provider id and token total, billing records cost later, and evaluators write scores somewhere else.',
        'That is enough while incidents are simple. It breaks when a prompt change causes a cache miss, retrieval expands context, a tool retry adds latency, and the judge path adds cost in the same request.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is join failure. If route id, prompt version, model version, cache status, tool calls, safety verdict, evaluator score, and cost live in separate systems, the team reconstructs the request during the incident instead of fixing it.',
        'Raw content logging creates the opposite failure. Full prompts, tool arguments, outputs, tenant identifiers, and evaluator rationales can leak private data and explode metric cardinality, making telemetry risky and hard to query.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a span tree joined to a token-cost ledger row. The span tree preserves causality, while the ledger row makes economics queryable by model, route, prompt, cache, tool, evaluator, and accepted-answer state.',
        'The invariant is bounded explainability. Record identifiers, versions, hashes, buckets, and counts that explain behavior; do not make raw private content the default index of the system.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The gateway creates a trace id and records request class, tenant tier bucket, route id, and release version. A router span records requested model, served model, policy version, fallback reason, and cache-key version.',
        'Retrieval spans record collection id, query hash, chunk count, and latency. Model spans record provider, model version, prompt-template version, input tokens, cached input tokens, output tokens, time to first token, finish reason, and safe provider response identifiers.',
        'Tool, safety, evaluation, and cost spans attach to the same trace. The exported ledger row normalizes prices, sums token classes, records cache savings, and keeps redaction and retention policy attached to the evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The span tree works because parent-child order preserves causality. If retrieval expanded the prompt before the model call, or a tool retry caused a second generation, the trace shows the path that produced the output.',
        'The ledger works because cost is not one number. Input tokens, cached input tokens, output tokens, tool overhead, and evaluator calls can move independently, so separating them lets the team identify which behavior changed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is storage, collector CPU, schema discipline, privacy review, and query design. If one million requests per day each emit 12 spans, the system stores 12 million span records before sampling or retention rules reduce them.',
        'Cost behaves with cardinality. Adding a bounded model_version field is cheap to aggregate, while adding raw prompt text as a metric label can make queries expensive and unsafe. Tail sampling keeps high-latency, high-token, error, canary, and safety-denied traces while sampling ordinary successes lightly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits model rollout regressions, agent cost spikes, prompt-cache misses, tool loops, safety denials, evaluator drift, tenant disputes, and billing investigations. It is strongest when the same request needs to be understood across product, model, infrastructure, and finance boundaries.',
        'It also supports release discipline. A canary route can be compared against control traffic by cost per accepted answer, cache-hit rate, safety action rate, and evaluator score bucket rather than by average latency alone.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when teams log everything as raw text. That creates privacy risk, retention risk, high-cardinality metrics, and noisy traces that are hard to search during an incident.',
        'It also fails when the schema does not match behavior. Recording a model name is not enough if route id, prompt version, cache-key version, retrieval chunk count, tool retry count, and evaluator spend are missing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a support agent handles 10,000 requests per day and average cost jumps from 0.8 cents to 1.4 cents. Request count is flat, so the old dashboard cannot tell whether users asked longer questions or the system changed.',
        'The ledger shows input tokens rose from 2,000 to 3,200, cached input tokens fell from 1,400 to 200, output tokens stayed near 500, and judge calls rose from 1.0 to 1.6 per request. The cause is a prompt-template version that broke cache compatibility plus an evaluator retry policy, not organic demand growth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study OpenTelemetry tracing, trace context propagation, semantic conventions for GenAI telemetry, collector processors, tail sampling, and metric exemplars. Use official OpenTelemetry documentation as the schema starting point, then apply local privacy and retention rules.',
        'Next study prompt-cache key design, model rollout ledgers, redaction pipelines, LLM unit economics, evaluator reliability, and audit evidence packets. The larger lesson is that AI observability is distributed tracing with model, token, cache, tool, safety, evaluation, and cost fields made first-class.',
      ],
    },
  ],
};

