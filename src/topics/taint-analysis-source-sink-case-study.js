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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a flow of influence, not as a call stack. A source is an input boundary where untrusted data enters, a sink is an operation where that data can become authority, and a sanitizer is a transformation or API boundary that is safe only for a named sink class.',
        'A highlighted path is review evidence. The safe inference rule is that an alert matters when attacker-controlled data reaches the dangerous argument of a sink without a sanitizer that applies to that sink.',
        {type:'callout', text:`Taint analysis turns security review into reachability over trust labels, with sources, sinks, sanitizers, and summaries defining the useful graph.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Security bugs often start when data crosses a trust boundary. An HTTP parameter can become SQL text, a path segment can become a filesystem path, a header can become a redirect URL, or retrieved text can steer an agent tool call.',
        'Taint analysis exists to track that influence through code. It marks untrusted values at sources, propagates labels through assignments and calls, and reports when tainted data reaches a sink in a dangerous role.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to search for dangerous endpoint APIs. A reviewer can inspect raw query runners, shell launchers, browser rendering assignments, file access, redirect builders, deserializers, and tool-dispatch calls.',
        'That works for small codebases and narrow audits. It also gives useful endpoint inventory because sinks are where bugs usually become exploitable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is indirection. Real programs pass values through helpers, route objects, promises, arrays, maps, serializers, and wrapper modules before the dangerous call happens.',
        'Manual review also loses consistency. A value parameterized for SQL is still unsafe for HTML or shell execution, and a sanitizer model that ignores the sink class creates either false confidence or noise.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Taint follows attacker influence rather than exact string equality. If req.query.name is copied, trimmed, concatenated, stored in an object, returned from a helper, and then used in a query builder, the sink may still be attacker-controlled.',
        'The analysis has two parts: a generic data-flow engine and a security model. The model defines sources, sinks, sanitizers, and summaries, which are compact descriptions of how library calls pass taint between inputs and outputs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The engine assigns taint to source expressions such as request bodies, route parameters, headers, cookies, uploaded files, queue messages, webhooks, database fields containing user content, or untrusted LLM observations.',
        'Propagation rules carry the label through assignments, string operations, property writes, function returns, callbacks, promises, and collections. A precise analysis may track fields separately, while a cheaper one may taint a whole object.',
        'At a sink, the query checks whether tainted data reaches the dangerous argument. Sanitizers can stop the path only for the sink class they actually protect, such as SQL parameters for SQL syntax or HTML escaping for HTML output.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservative. If the source model is right, the sink model is right, and the propagation rules over-approximate real data influence, then a reported path is evidence that untrusted data can reach a dangerous operation.',
        'The path does not prove exploitability by itself. It gives a reviewer the source, hops, sanitizer decisions, and sink needed to check reachability, permissions, input shape, and the exact sink semantics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Precision costs modeling time. Every framework helper, sanitizer, wrapper, source, sink argument, and summary can change results, so a durable deployment needs ownership for models and suppressions.',
        'Runtime cost grows with program size, call graph size, heap precision, path sensitivity, and the number of source-sink pairs. A path-insensitive query is faster but noisier; a path-sensitive query can be more accurate but harder to scale.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Taint analysis is used for SQL injection, command injection, path traversal, SSRF, XSS, unsafe deserialization, secret exfiltration, and unsafe file writes. The same source-to-sink shape also applies to prompt injection when untrusted text can authorize tool calls.',
        'It works best as a review amplifier. High-confidence paths can block changes in CI, while lower-confidence paths can create audit tasks with enough evidence for a human to decide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Taint analysis fails when the model is wrong. Missing framework summaries hide bugs, overly broad summaries create noise, and sanitizer confusion can label a value safe for the wrong sink.',
        'It also misses many implicit flows. If a secret controls a branch and the branch controls public output, influence exists without copying the secret value, and classic injection-focused taint may not capture it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose req.query.id is assigned to id, interpolated into a SQL string, and passed to a raw query runner. The source is req.query.id, the flow steps are assignment and template construction, and the sink is the SQL text argument.',
        'If the same id is passed as a bound SQL parameter, the value remains attacker-controlled but no longer becomes SQL syntax. A precise query should stop the SQL-injection alert for that path while still reporting the value if it later reaches a shell command.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include CodeQL data-flow documentation at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, CodeQL JavaScript data-flow guidance at https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/, and Semgrep taint-mode documentation at https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview. Study data-flow worklists, abstract interpretation, symbolic execution, SSRF defenses, prompt injection threat models, and provenance graphs next.',
      ],
    },
  ],
};
