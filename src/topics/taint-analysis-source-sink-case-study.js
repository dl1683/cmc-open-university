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
      heading: 'Why this exists',
      paragraphs: [
        `Security bugs often appear when untrusted data crosses a trust boundary and later reaches an operation that treats the value as authority. An HTTP parameter becomes SQL text. A path segment becomes a filesystem path. A header becomes a redirect URL. Retrieved text becomes an LLM tool instruction. The value may pass through helpers, objects, arrays, promises, and string builders before the dangerous call happens.`,
        `Taint analysis exists to make that path visible. It marks values from sources as untrusted, propagates that influence through program operations, and reports when taint reaches a dangerous sink without an approved sanitizer or safe API boundary. The useful output is not merely "line 42 is bad." It is a source-to-sink path that a reviewer can inspect.`,
        `This matters because manual review does not scale across modern applications. Searching for database calls, shell execution, template rendering, file access, SSRF-capable clients, or tool calls finds the endpoints, but not the data provenance. Taint analysis turns the question into graph reachability with security-specific models: where does untrusted data start, how can it move, where is it dangerous, and which transformations change its role?`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is to grep for dangerous APIs and inspect the arguments by hand. That is still useful for small codebases or narrow audits. A reviewer can look at db.exec, child_process.exec, innerHTML, open redirects, file reads, template rendering, and tool dispatch calls, then trace each argument backward.`,
        `The wall is indirection. Real applications wrap frameworks, pass values through route objects, create helper functions, serialize and deserialize payloads, store values in maps, and build strings over several statements. The dangerous call may be far from the source. A human can trace one path, but large repositories contain thousands of possible paths and many framework-specific shortcuts.`,
        `A second wall is review consistency. One reviewer may understand that parameterized SQL is safe for SQL injection but not for shell execution. Another may trust a sanitizer outside its context. A tool does not replace judgment, but it can enforce a consistent source, sink, sanitizer, and summary model across the whole codebase.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `Taint follows influence, not exact equality. If req.query.name is copied into a variable, concatenated into a template string, placed into an object field, returned from a helper, or sent through a promise chain, the final value may not equal the original text. It is still attacker-controlled in the way that matters to the sink.`,
        `The analysis is usually a data-flow engine plus a security model. The engine knows how facts move through assignments, calls, returns, fields, arrays, and control-flow joins. The security model says which values are sources, which APIs are sinks, which calls are sanitizers, and which library or framework functions pass taint through.`,
        `The key distinction is role. A value can be tainted and still safe for one sink if it is passed as data rather than syntax. A parameterized SQL API can keep an attacker-controlled id from becoming query syntax. That does not make the same id safe for HTML output, shell commands, file paths, or LLM tool authority.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The engine starts by assigning taint facts to source expressions. In a web application, sources can include query parameters, route params, request bodies, headers, cookies, uploaded files, environment variables, webhooks, queue messages, database fields containing user content, retrieved documents, or LLM observations from untrusted tools.`,
        `The propagation rules carry those facts through the program. A variable assignment copies taint. String concatenation combines taint. A property write can taint an object field. A function call may pass taint from argument to return value. A promise chain may preserve taint across callbacks. A collection may need element-level or whole-collection taint depending on the precision of the analysis.`,
        `A sink is an operation where attacker influence can become authority. SQL execution, shell execution, path-based file access, HTML or JavaScript rendering, SSRF-capable HTTP clients, unsafe deserialization, template evaluation, secret-returning APIs, and agent tool dispatch can all be sinks. A sink model should name the dangerous argument position and the kind of taint that matters there.`,
        `Sanitizers and safe APIs are context-specific. Escaping for HTML is meaningful for an HTML sink. Parameter binding is meaningful for SQL. URL validation may be meaningful for SSRF only if it handles redirects, DNS rebinding, private address ranges, and scheme restrictions. A sanitizer model that says "clean" without naming the sink class is usually too broad.`,
        `Summaries connect the analysis across abstraction boundaries. If a framework helper returns req.query.name but the model does not know that, the path breaks and the bug is missed. If a summary says every helper returns tainted data, harmless flows become noisy. Production taint analysis is therefore mostly modeling work around a reusable data-flow core.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness claim is conditional: if the source model is right, the sink model is right, and the flow rules over-approximate real data influence, then a reported path is evidence that untrusted data can reach the sink. The tool may not prove exploitability, but it gives the reviewer a concrete path to check.`,
        `The path explanation matters because taint analysis is not useful as a naked warning label. A reviewer needs to see the source, intermediate transformations, call summaries, sanitizer decisions, and sink. If the path jumps through a missing framework model or ignores a real sanitizer, the reviewer can fix the model rather than guessing.`,
        `A safe repair changes the role of the value at the sink. For SQL injection, the usual repair is not hand-written quote escaping. It is a parameterized API that sends SQL syntax and untrusted data separately. In the model, the untrusted value may remain tainted, but it no longer reaches the SQL-text argument in the dangerous role.`,
        `The same reasoning applies outside SQL. A path traversal repair may canonicalize and constrain a path under an allowed directory. An SSRF repair may parse the URL, enforce scheme and host policy, resolve and recheck addresses, and block redirects to private ranges. An LLM tool-call repair may preserve provenance and forbid untrusted retrieved text from authorizing side effects.`,
      ],
    },
    {
      heading: 'Concrete case',
      paragraphs: [
        `Consider a route that reads req.query.table, builds SELECT * FROM plus that table name, and calls db.exec. The source is the query parameter. The flow steps are assignment and string construction. The sink is raw SQL execution. The alert is useful because it explains the missing boundary: untrusted text became query syntax.`,
        `Changing the code to db.query("SELECT * FROM users WHERE id = ?", [id]) changes the sink role. The id value is still attacker-controlled, but the API treats it as a parameter, not executable SQL syntax. A precise taint query should stop reporting SQL injection for that path while still allowing the same id to be reported if it later reaches a shell command or HTML sink unsafely.`,
        `A more subtle example uses a helper: getTable(req) returns req.query.table after a small transformation. If the analysis lacks a summary for getTable, the path from source to sink disappears. If the summary says getTable sanitizes table names but the helper only trims whitespace, the analysis becomes unsound. The model must say what the helper actually guarantees.`,
        `A useful finding therefore has two layers. The first is graph reachability from source to sink. The second is semantic review: is the sink dangerous in this call, does the sanitizer apply to this sink class, and can an attacker control the source in the deployed route?`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Start with a narrow vulnerability class. SQL injection, command injection, path traversal, SSRF, XSS, unsafe deserialization, secret exfiltration, prompt injection to tool calls, and unsafe file writes all need different source, sink, and sanitizer definitions. A broad "find badness" query is usually noisy.`,
        `Model the framework before judging the application. For JavaScript, route parameters, request bodies, Express middleware, ORM helpers, template engines, promise utilities, and wrapper modules often decide whether paths are visible. For a codebase with custom abstractions, a small set of accurate summaries can improve results more than a clever query.`,
        `Make findings reviewable. Store the source location, sink location, path steps, sanitizer decisions, and rule id. Group duplicate paths that share the same source and sink. Suppressions should name the reason, such as trusted source, validated enum, safe parameter API, or sink not reachable in production.`,
        `Use taint analysis as part of CI with severity gates that match confidence. High-confidence source-to-dangerous-sink paths can block changes. Lower-confidence paths can create review tasks. The tool should improve security throughput, not train engineers to ignore a wall of false positives.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Precision costs modeling time. Every framework shortcut, helper, wrapper, sanitizer, and sink argument position can affect results. A cheap first query may find real bugs, but a durable deployment needs ownership for models and suppressions as the codebase changes.`,
        `Soundness and noise pull against each other. If the analysis over-approximates every possible flow, reviewers drown in paths that cannot happen. If it under-approximates to stay quiet, real bugs disappear. Different teams choose different points on that curve depending on whether the tool is used for research, CI blocking, or audit support.`,
        `Path sensitivity is expensive. A value may be safe only after a particular validation branch, or only when an enum check succeeds, or only for one route. A path-insensitive analysis may report false positives because it merges safe and unsafe states. A highly path-sensitive analysis may become too slow or too complex for large applications.`,
        `Alias and heap modeling are also hard. If taint is stored inside object fields, arrays, maps, request contexts, closures, or global registries, the analysis must decide how precisely to track it. Whole-object taint is simple but noisy. Field-sensitive taint is better but more expensive and easier to get wrong.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is sanitizer confusion. A value escaped for HTML is not safe for SQL. A SQL parameter is not safe for a shell command. A URL allowlist may not be safe if redirects, encoded hosts, IPv6 forms, or DNS rebinding are ignored. Sanitizers should be tied to sink classes and threat models.`,
        `The second failure mode is missing implicit flows. If a secret controls a branch and the branch controls public output, the secret influenced behavior without being copied as a value. Classic taint tracking usually follows data flow, not every information-flow channel. That is acceptable for many injection classes, but it should not be mistaken for full noninterference.`,
        `The third failure mode is dynamic behavior. eval, reflection, dependency injection, monkey-patching, dynamic property names, runtime route registration, and generated code can hide paths from a static analyzer. Runtime instrumentation, tests, or symbolic execution may be needed when static models cannot see enough of the program.`,
        `The fourth failure mode is trusting the path too much. A taint path is evidence, not the exploit. The reviewer still needs to check reachability, authentication, deployment configuration, data shape, sink semantics, and whether the reported source is attacker-controlled in the relevant context.`,
      ],
    },
    {
      heading: 'Links to LLM security',
      paragraphs: [
        `Prompt injection is taint analysis with a newer sink. Untrusted retrieved documents, web pages, user messages, and tool observations flow into model context. The dangerous sink may be a tool call, repository edit, email send, purchase, database query, or secret-bearing API rather than final text.`,
        `The same discipline applies. Label trust boundaries at ingestion. Preserve provenance through chunking, retrieval, summarization, context packing, and tool planning. Keep tool permissions narrow. Treat policy checks as sanitizers only for the sink class they actually constrain. Log enough path evidence to explain why a tool call was allowed or blocked.`,
        `This framing prevents a common mistake: treating the model as a sanitizer. A model may rewrite, summarize, or classify untrusted text, but that does not automatically remove the attacker's influence. If the rewritten text can still steer a side-effecting tool, the taint has changed shape rather than disappeared.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: CodeQL data-flow overview at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, CodeQL JavaScript/TypeScript guide at https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/, CodeQL JavaScript data-flow cheat sheet at https://codeql.github.com/docs/codeql-language-guides/data-flow-cheat-sheet-for-javascript/, Semgrep taint overview at https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview, and Semgrep taint labels at https://semgrep.dev/docs/writing-rules/data-flow/taint-mode/advanced.`,
        `Study Data-Flow Worklist Analysis for the propagation engine, Abstract Interpretation and Interval Domain for conservative approximation, Symbolic Execution Path Constraints for concrete path witnesses, Prompt Injection Threat Model for LLM source/sink modeling, LLM Guardrail Policy Engine for enforcement, and Software Supply Chain Provenance Graph for another example of path evidence across trust boundaries.`,
      ],
    },
  ],
};
