// Drain log parsing: turn raw operational text into stable templates using a
// fixed-depth parse tree, token similarity, and online template updates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'log-template-drain-parser-case-study',
  title: 'Log Template Drain Parser',
  category: 'Systems',
  summary: 'How Drain-style online log parsing uses a fixed-depth tree and token similarity to convert raw logs into templates for search, metrics, and anomaly detection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fixed-depth tree', 'online template update'], defaultValue: 'fixed-depth tree' },
  ],
  run,
};

function drainGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'log', x: 0.7, y: 3.6, note: notes.raw || 'text' },
      { id: 'tokenize', label: 'tokens', x: 2.3, y: 3.6, note: notes.tokenize || 'split' },
      { id: 'len', label: 'length', x: 3.9, y: 2.0, note: notes.len || 'bucket' },
      { id: 'pos', label: 'position', x: 3.9, y: 5.2, note: notes.pos || 'fixed depth' },
      { id: 'group', label: 'grp', x: 5.8, y: 3.6, note: notes.group || 'cand' },
      { id: 'sim', label: 'sim', x: 7.4, y: 3.6, note: notes.sim || 'match' },
      { id: 'template', label: 'template', x: 9.1, y: 2.2, note: notes.template || 'stable key' },
      { id: 'new', label: 'new group', x: 9.1, y: 5.0, note: notes.new || 'if no match' },
    ],
    edges: [
      { id: 'e-raw-tokenize', from: 'raw', to: 'tokenize' },
      { id: 'e-tokenize-len', from: 'tokenize', to: 'len' },
      { id: 'e-tokenize-pos', from: 'tokenize', to: 'pos' },
      { id: 'e-len-group', from: 'len', to: 'group' },
      { id: 'e-pos-group', from: 'pos', to: 'group' },
      { id: 'e-group-sim', from: 'group', to: 'sim' },
      { id: 'e-sim-template', from: 'sim', to: 'template' },
      { id: 'e-sim-new', from: 'sim', to: 'new' },
    ],
  }, { title });
}

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

function* fixedDepthTree() {
  yield {
    state: drainGraph('Raw logs need structure before correlation'),
    highlight: { active: ['raw', 'tokenize', 'e-raw-tokenize'], compare: ['template', 'new'] },
    explanation: 'A raw log line is useful to a human but awkward for machines. Drain-style parsing turns unstable text into stable templates such as "Failed login from <*>".',
  };

  yield {
    state: labelMatrix(
      'Tokenization separates constants from likely variables',
      [
        { id: 'line1', label: 'line A' },
        { id: 'line2', label: 'line B' },
        { id: 'line3', label: 'line C' },
      ],
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['Fail login 42', '4 tokens'],
        ['Fail login 91', '4 tokens'],
        ['Disk full a', '5 tokens'],
      ],
    ),
    highlight: { active: ['line1:shape', 'line2:shape'], compare: ['line3:shape'] },
    explanation: 'The first cheap discriminator is message length. Lines with different token counts usually cannot share the same exact template, so the fixed-depth tree branches by length early.',
  };

  yield {
    state: drainGraph('The fixed-depth tree narrows the candidate group', { len: '4 tokens', pos: 'token 1/2', group: 'login logs' }),
    highlight: { active: ['len', 'pos', 'group', 'e-len-group', 'e-pos-group'], found: ['tokenize'], compare: ['sim'] },
    explanation: 'Drain uses a shallow tree rather than comparing against every template. After length and selected token-position branches, the parser searches a small candidate group.',
    invariant: 'The tree is an index over log shape, not a syntax parser for the application.',
  };

  yield {
    state: labelMatrix(
      'Similarity scores a candidate template',
      [
        { id: 't0', label: 'token 0' },
        { id: 't1', label: 'token 1' },
        { id: 't2', label: 'token 2' },
        { id: 't3', label: 'token 3' },
      ],
      [
        { id: 'incoming', label: 'incoming' },
        { id: 'template', label: 'template' },
        { id: 'match', label: 'match' },
      ],
      [
        ['Failed', 'Failed', 'yes'],
        ['login', 'login', 'yes'],
        ['user', 'user', 'yes'],
        ['91', '<*>', 'wildcard'],
      ],
    ),
    highlight: { found: ['t0:match', 't1:match', 't2:match'], active: ['t3:match'] },
    explanation: 'A template match is not full regex inference. It is token equality with wildcard positions. If enough stable positions match, the line joins the group.',
  };

  yield {
    state: drainGraph('The output template becomes an operational key', { template: 'event key' }),
    highlight: { active: ['template', 'e-sim-template'], found: ['sim'], compare: ['raw'] },
    explanation: 'Once logs have template IDs, operations teams can count events, detect new templates, correlate with traces, and search by event type instead of brittle raw strings.',
  };
}

function* onlineTemplateUpdate() {
  yield {
    state: labelMatrix(
      'A matching line updates wildcard positions',
      [
        { id: 'old', label: 'old temp' },
        { id: 'line', label: 'new line' },
        { id: 'next', label: 'next temp' },
      ],
      [
        { id: 'text', label: 'text' },
        { id: 'action', label: 'action' },
      ],
      [
        ['Fail login 42', 'seed'],
        ['Fail login 91', 'compare'],
        ['Fail login <*>', 'generalize'],
      ],
    ),
    highlight: { active: ['next:text', 'next:action'], found: ['line:text'] },
    explanation: 'When a new line matches an existing group except for a token value, that token can become a wildcard. The template evolves online as more examples arrive.',
  };

  yield {
    state: drainGraph('No candidate match creates a new log group', { sim: 'below threshold', new: 'create' }),
    highlight: { active: ['sim', 'new', 'e-sim-new'], compare: ['template'], found: ['group'] },
    explanation: 'If similarity falls below the threshold, the parser should not force the line into the nearest template. It creates a new group so new failure modes remain visible.',
  };

  yield {
    state: labelMatrix(
      'Template IDs power downstream signals',
      [
        { id: 'count', label: 'count' },
        { id: 'new', label: 'new temp' },
        { id: 'burst', label: 'burst' },
        { id: 'trace', label: 'trace id' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'consumer', label: 'consumer' },
      ],
      [
        ['rate per event', 'metrics'],
        ['unknown error', 'AIOps'],
        ['incident clue', 'alerting'],
        ['join to spans', 'tracing'],
      ],
    ),
    highlight: { active: ['new:consumer', 'burst:consumer'], found: ['trace:use'] },
    explanation: 'A log template is the bridge from text to telemetry. Count templates as metrics, join them to traces by trace ID, and highlight newly created templates during incidents.',
  };

  yield {
    state: labelMatrix(
      'Where log parsing fails',
      [
        { id: 'over', label: 'over-wild' },
        { id: 'under', label: 'under-wild' },
        { id: 'drift', label: 'drift' },
        { id: 'pii', label: 'PII' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['one vague key', 'thresholds'],
        ['too many keys', 'mask rules'],
        ['temps shift', 'aging review'],
        ['secrets stored', 'redaction'],
      ],
    ),
    highlight: { active: ['over:symptom', 'under:symptom'], found: ['pii:control'] },
    explanation: 'The parser is only a helper. Over-generalization hides distinct failures; under-generalization creates cardinality noise. Redaction still has to happen before sensitive tokens are stored or exported.',
  };

  yield {
    state: drainGraph('A Collector can parse, redact, and route structured logs', { raw: 'filelog', tokenize: 'parser', template: 'log attr', new: 'novelty' }),
    highlight: { active: ['raw', 'tokenize', 'template', 'e-raw-tokenize', 'e-sim-template'], found: ['new'], compare: ['group'] },
    explanation: 'In an OpenTelemetry pipeline, template extraction can run near ingestion. The resulting event name, severity, trace ID, and resource attributes feed AIOps without turning every unique string into a separate alert.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fixed-depth tree') yield* fixedDepthTree();
  else if (view === 'online template update') yield* onlineTemplateUpdate();
  else throw new InputError('Pick a Drain parser view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Drain is an online log parsing approach that converts raw log lines into templates. The operational goal is simple: turn a stream of slightly different strings into stable event keys that machines can count, search, correlate, and alert on.',
        'The data structure is a fixed-depth parse tree. It uses cheap discriminators such as token count and selected token positions to find candidate groups, then token similarity to decide whether a line belongs to an existing template or should create a new one.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A log line is tokenized. The parser branches by token count and then by selected stable positions. That tree lookup narrows the search to a small group of templates. Similarity compares tokens position by position, treating wildcard slots as matches. If the best template exceeds the threshold, the line joins that group. If a position differs across examples, the template generalizes that position to a wildcard.',
        'If no template is similar enough, the parser creates a new log group. That is important during incidents: a genuinely new failure should appear as a new event type, not be swallowed into the nearest familiar template.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Drain avoids comparing every log line with every known template, so online parsing stays practical for streaming logs. The cost is tuning. A low similarity threshold over-wildcards templates and hides distinct failures. A high threshold under-wildcards templates and creates cardinality noise. Masking rules for IPs, UUIDs, numbers, and request IDs are usually needed before parsing.',
        'Parsing also does not solve privacy. Secrets, tokens, emails, and user IDs must be redacted or classified before export. The OpenTelemetry log data model can carry structured body, severity, trace ID, span ID, resource attributes, and other fields, but teams still need policy for what belongs in each field.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout service emits "Failed login user 42", "Failed login user 91", and "Failed login user 103". Drain groups them into "Failed login user <*>". During a deploy, a new template appears: "Payment timeout provider stripe route /charge". AIOps sees the new template rate spike, joins matching logs to traces by trace ID, and correlates the template burst with an SLO burn-rate page.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a template as ground truth. It is an inferred grouping. Keep raw examples, sample lines, and drift review. Do not put request IDs, session IDs, emails, or UUIDs into metric labels after parsing; those belong in logs or traces, not high-cardinality metrics. Do not assume English-like logs are the only input; structured JSON logs may need field extraction instead of free-text parsing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Drain paper page at https://pinjiahe.github.io/publication/2017-ICWS, Drain PDF at https://netman.aiops.org/~peidan/ANM2023/6.LogAnomalyDetection/phe_icws2017_drain.pdf, OpenTelemetry Logs Data Model at https://opentelemetry.io/docs/specs/otel/logs/data-model/, and OpenTelemetry log data appendix at https://opentelemetry.io/docs/specs/otel/logs/data-model-appendix/. Study Trie, Finite State Machine, OpenTelemetry Collector Case Study, AIOps Incident Response, Metric Label Cardinality Control, Distributed Tracing, and Count-Min Sketch next.',
      ],
    },
  ],
};
