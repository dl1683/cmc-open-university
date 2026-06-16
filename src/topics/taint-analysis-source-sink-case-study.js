// Taint analysis: track untrusted data from sources through transformations to
// dangerous sinks, with sanitizers and summaries controlling precision.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'taint-analysis-source-sink-case-study',
  title: 'Taint Analysis Source-to-Sink Case Study',
  category: 'Concepts',
  summary: 'Track untrusted input through a program: sources, flow steps, sanitizers, summaries, sinks, path explanations, and false-positive controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['web request to sql', 'sanitizers and summaries'], defaultValue: 'web request to sql' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function taintGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'src', x: 0.9, y: 3.8, note: 'req.query' },
      { id: 'route', label: 'route', x: 2.4, y: 3.8, note: 'handler' },
      { id: 'parse', label: 'parse', x: 3.9, y: 2.3, note: 'string' },
      { id: 'build', label: 'sql', x: 5.3, y: 3.8, note: 'build' },
      { id: 'sanitize', label: 'param', x: 5.3, y: 5.7, note: 'safe API' },
      { id: 'sink', label: 'sink', x: 7.1, y: 3.8, note: 'db.exec' },
      { id: 'alert', label: 'alert', x: 8.8, y: 3.8, note: 'path' },
    ],
    edges: [
      { id: 'e-source-route', from: 'source', to: 'route' },
      { id: 'e-route-parse', from: 'route', to: 'parse' },
      { id: 'e-parse-build', from: 'parse', to: 'build' },
      { id: 'e-build-sink', from: 'build', to: 'sink' },
      { id: 'e-sink-alert', from: 'sink', to: 'alert' },
      { id: 'e-build-sanitize', from: 'build', to: 'sanitize' },
      { id: 'e-sanitize-sink', from: 'sanitize', to: 'sink' },
    ],
  }, { title });
}

function* webRequestToSql() {
  yield {
    state: taintGraph('Taint flows from an untrusted source toward a sink'),
    highlight: { active: ['source', 'route', 'parse', 'build', 'sink', 'e-source-route', 'e-route-parse', 'e-parse-build', 'e-build-sink'], compare: ['sanitize'] },
    explanation: 'A taint analysis marks untrusted input at a source, then follows flow steps through assignments, calls, string operations, object fields, and returns until the value reaches a dangerous sink.',
  };
  yield {
    state: labelMatrix(
      'Source to sink rule',
      [
        { id: 'source', label: 'req.query.name' },
        { id: 'step', label: 'template string' },
        { id: 'sink', label: 'db.exec(sql)' },
        { id: 'fix', label: 'db.query(sql,args)' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'taint', label: 'taint state' },
      ],
      [
        ['source', 'tainted'],
        ['flow step', 'tainted'],
        ['sink', 'alert'],
        ['sanitizer/API', 'safe path'],
      ],
    ),
    highlight: { active: ['source:taint', 'step:taint', 'sink:taint'], found: ['fix:taint'] },
    explanation: 'The bad path is not the string itself. It is untrusted data reaching a sink without an approved sanitizer or safe API boundary.',
    invariant: 'A useful alert includes the source, every important hop, and the sink.',
  };
  yield {
    state: taintGraph('Path explanations turn graph reachability into reviewable evidence'),
    highlight: { active: ['source', 'build', 'sink', 'alert', 'e-build-sink', 'e-sink-alert'], visited: ['route', 'parse'], found: ['sanitize'] },
    explanation: 'CodeQL path queries and similar tools report a path, not just a location. Reviewers need to see whether the flow is real, whether a sanitizer was missed, and whether the sink is actually dangerous.',
  };
}

function* sanitizersAndSummaries() {
  yield {
    state: taintGraph('Sanitizers and summaries decide precision'),
    highlight: { active: ['sanitize', 'e-build-sanitize', 'e-sanitize-sink'], compare: ['alert'], visited: ['source', 'build'] },
    explanation: 'A sanitizer removes or transforms taint for a specific sink class. Parameterized SQL may sanitize for SQL injection, but that does not mean the value is safe for shell execution or HTML output.',
  };
  yield {
    state: labelMatrix(
      'Precision controls',
      [
        { id: 'source', label: 'source model' },
        { id: 'sink', label: 'sink model' },
        { id: 'summary', label: 'call summary' },
        { id: 'sanitizer', label: 'sanitizer' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['where taint starts', 'missed input'],
        ['what is dangerous', 'noise or missed bug'],
        ['interprocedural hop', 'path breaks'],
        ['safe transformation', 'false positive'],
      ],
    ),
    highlight: { active: ['source:job', 'sink:job', 'summary:job', 'sanitizer:job'], compare: ['sanitizer:failure'] },
    explanation: 'Production taint analysis is mostly modeling. The data-flow engine is generic; sources, sinks, framework summaries, and sanitizers make it useful for one application stack.',
  };
  yield {
    state: taintGraph('Taint analysis generalizes beyond SQL'),
    highlight: { active: ['source', 'route', 'sink'], found: ['alert'], compare: ['sanitize'] },
    explanation: 'The same graph pattern catches command injection, path traversal, SSRF, unsafe deserialization, XSS, prompt injection, and secret exfiltration. Only the source and sink models change.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'web request to sql') yield* webRequestToSql();
  else if (view === 'sanitizers and summaries') yield* sanitizersAndSummaries();
  else throw new InputError('Pick a taint-analysis view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Taint analysis is a specialized data-flow analysis for security. It marks some values as untrusted at sources, follows how those values move through code, and reports when tainted data reaches a dangerous sink without an approved sanitizer.',
        'The model is intentionally broader than exact value flow. A transformed string may no longer equal the original input, but it can still be derived from the original input and still be dangerous. That is why taint tracking often adds edges that normal value-preserving data flow would not include.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The engine starts with the Data-Flow Worklist Analysis skeleton. A source could be an HTTP parameter, uploaded file, environment variable, retrieved document, or LLM tool observation. A sink could be SQL execution, shell execution, file path access, HTML rendering, secret-returning APIs, or tool calls in an agent.',
        'Sanitizers are sink-specific. Escaping for HTML is not the same as parameter binding for SQL. A summary describes how taint moves through a function call, method, framework helper, promise chain, object field, or collection. Missing summaries cause false negatives; overly broad summaries cause noisy false positives.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a JavaScript route that reads req.query.name, places it into a template string, and sends the resulting string to db.exec. The taint path is source to route handler to string construction to SQL sink. A path query should explain each hop so a reviewer can decide whether the finding is real.',
        'The safe repair is not to guess at quote escaping. It is to move the untrusted value into a parameterized query API. In the analysis model, that API is treated as a sanitizer for SQL execution because the value is passed as data rather than executable query text.',
      ],
    },
    {
      heading: 'Links to LLM security',
      paragraphs: [
        'Prompt Injection Threat Model is taint analysis in a new shape. Untrusted retrieved text flows into the model context. The sink is not only final text; it can be a tool call, email send, repository write, or secret-bearing API. A guardrail policy engine is therefore a source/sink/sanitizer model around an LLM application.',
        'The same discipline applies: label trust boundaries at ingestion, preserve provenance through transformations, keep tool permissions narrow, and log enough path evidence to audit why a tool call was allowed or blocked.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CodeQL data-flow overview at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, CodeQL JavaScript/TypeScript guide at https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/, CodeQL JavaScript data-flow cheat sheet at https://codeql.github.com/docs/codeql-language-guides/data-flow-cheat-sheet-for-javascript/, Semgrep taint overview at https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview, and Semgrep taint labels at https://semgrep.dev/docs/writing-rules/data-flow/taint-mode/advanced. Study Data-Flow Worklist Analysis, Abstract Interpretation & Interval Domain, Prompt Injection Threat Model, LLM Guardrail Policy Engine, and Symbolic Execution Path Constraints next.',
      ],
    },
  ],
};
