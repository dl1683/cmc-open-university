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
      heading: 'What it is',
      paragraphs: [
        'A GenAI trace token-cost ledger is the observability data structure that makes LLM systems debuggable. It extends ordinary distributed tracing with model identity, prompt and cache versions, token usage, tool calls, eval scores, safety actions, route decisions, cost, redaction policy, and sampling decisions.',
        'Distributed Tracing teaches span trees. OpenTelemetry Collector Case Study teaches telemetry pipelines. This case study adds the GenAI-specific fields that let a team explain why one request was slow, expensive, unsafe, low quality, cache-missed, or routed to the wrong model.',
      ],
    },
    {
      heading: 'Semantic convention anchors',
      paragraphs: [
        'OpenTelemetry GenAI semantic conventions define the direction for model-request telemetry. The OpenTelemetry registry includes attributes such as provider, requested model, response model, input tokens, output tokens, cached input tokens, time to first chunk, evaluation score labels, and warnings that message attributes can contain sensitive information: https://github.com/open-telemetry/semantic-conventions/blob/main/docs/registry/attributes/gen-ai.md.',
        'The GenAI events page describes request-detail events for completion operations: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/. Treat those conventions as the common vocabulary, then add product-specific bounded fields for route id, prompt hash, cache key version, tenant tier, eval slice, and rollback cohort.',
      ],
    },
    {
      heading: 'Token and cost accounting',
      paragraphs: [
        'Token fields should distinguish input, cached input, output, hidden or reasoning tokens where exposed, and tool/schema overhead. Provider billing and latency can differ across those classes, so a single total is not enough for cost attribution.',
        'Prompt Cache-Key Canonicalization Ledger and LLM Unit Economics Ledger Case Study meet here. Cache-read tokens explain cost savings; cache-write or miss reasons explain warmup cost; model price ids and eval calls explain why two equal-looking answers had different bills.',
      ],
    },
    {
      heading: 'Complete case study: expensive agent trace',
      paragraphs: [
        'A coding agent request spikes p99 and cost. The ordinary HTTP trace says the request took 1.1 seconds. The GenAI ledger shows the real path: route chose model v2, prompt hash missed cache because the tool schema version changed, retrieval returned 18 chunks, the model used a long input plus output tokens, a tool call retried once, the judge ran twice, and a safety policy allowed the final answer. The fix is not a vague model complaint; it is a prompt-layout and tool-schema rollout issue.',
        'The same ledger protects rollouts. LLM Model Rollout Shadow Canary Ledger can compare stable and canary spans by model version, prompt hash, cache-key version, eval score, safety verdict, latency, and cost. If the canary regresses only on long repository prompts, the trace fields make the slice visible.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not dump full prompts and outputs into always-on spans. Do not use raw tenant ids or raw prompt text as metric labels. Do not sample away all rare failures. Do not aggregate token cost without model/version and cache context. Do not let eval rationales or tool arguments bypass redaction.',
        'Study Distributed Tracing, Trace Context & Baggage Propagation, OpenTelemetry Collector Case Study, OpenTelemetry Tail Sampling Policy, Metric Exemplars Trace Correlation, PII Redaction Token Span Pipeline, LLM Model Rollout Shadow Canary Ledger, Prompt Cache-Key Canonicalization Ledger, LLM Response Cache Safety Ledger, LLM Serving Admission-Control Goodput Gate, LLM Unit Economics Ledger Case Study, and AI Audit Evidence Packet Case Study next.',
      ],
    },
  ],
};
