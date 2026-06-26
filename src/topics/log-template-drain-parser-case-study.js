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
    { heading: 'How to read the animation', paragraphs: [
      'Read this as an online parser for operational log text. Active nodes show tokenization, tree routing, similarity scoring, and template update; found nodes are stable event templates that downstream systems can count.',
      {type: `callout`, text: `Drain turns unstable text into stable operational keys by indexing log shape before scoring templates.`},
      {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg`, alt: `Trie diagram showing shared prefixes for several short words.`, caption: `Trie example by Booyabazooka, based on Deco, with modifications by Superm401, Wikimedia Commons, public domain.`},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Logs are often text because text is easy for developers and useful during incidents. Machines need stable event keys, while raw lines contain changing ids, numbers, paths, IP addresses, and user values.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is hand-written regular expressions. That works for a small estate, but services, libraries, deployment versions, and incident-only messages change faster than the rule library.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is cardinality and coverage. Counting every full line creates one event per user id, while broad regex rules can merge failures that operators need to keep separate.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Many log lines come from format strings: stable words plus variable slots. Drain uses a fixed-depth parse tree to route by token count and selected token positions before scoring templates.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Preprocessing masks timestamps, UUIDs, IP addresses, paths, numbers, emails, and request ids. The parser routes by length, follows token-position branches, scores similarity, wildcardizes varying positions, or creates a new template.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is approximate but inspectable. If two lines share the same format string after variables are masked, their stable tokens should match at the positions Drain uses for routing and scoring.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Drain reduces comparison cost from all templates to a candidate group. Cost behaves through merge and split errors: a loose threshold hides distinct events, while a strict threshold fragments one event into noisy templates.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Drain fits legacy text logs, third-party libraries, mixed language estates, and observability pipelines that need event keys before every team emits structured logs. New templates after deploy can trigger review or alert candidate creation.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Drain fails when shape hides meaning. It also fails when masking happens after storage, because secrets may leak before the parser learns a wildcard.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'The line "Failed login user 42 from 10.0.0.7" masks to "Failed login user <*> from <*>" and creates a six-token template. The next line with user 91 and another IP joins that template because the stable positions match.',
      'A deploy later emits "Failed login user 91 because account locked". It should become a separate template because the suffix changes the operational event, even though the first tokens overlap.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Drain at https://pinjiahe.github.io/publication/2017-ICWS, the paper PDF at https://netman.aiops.org/~peidan/ANM2023/6.LogAnomalyDetection/phe_icws2017_drain.pdf, and the OpenTelemetry Logs Data Model at https://opentelemetry.io/docs/specs/otel/logs/data-model/.',
      'Next, study tries, finite state machines, Count-Min Sketch, heavy hitters, OpenTelemetry Collector, distributed tracing, metric label cardinality, AIOps incident response, and PII redaction token spans.',
    ] },
  ],
};