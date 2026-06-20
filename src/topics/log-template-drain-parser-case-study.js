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
      heading: 'Why this exists',
      paragraphs: [
        `Operational logs are written as text because text is easy for humans and application developers. A service can emit "Failed login for user 42 from 10.0.0.7" without designing a schema first. During an incident, that flexibility is useful: engineers can search the exact message, grep a file, or paste the line into a ticket. But machines do not do well when every changing number, ID, path, or IP address creates a different event string.`,
        `The monitoring system usually wants stable event types. "Failed login for user 42" and "Failed login for user 91" are different strings but probably the same event. "Timeout calling payments after 800 ms" and "Timeout calling payments after 1200 ms" should often count together. If the system treats full log lines as metric labels, it creates cardinality noise. If it stores only raw strings, anomaly detection has to rediscover the same pattern again and again. If it relies entirely on hand-written regular expressions, coverage falls behind as services and libraries change.`,
        `Drain exists to turn raw log streams into templates online. A template such as "Failed login for user <*> from <*>" becomes an operational key. The platform can count it, alert when it appears for the first time, compare its rate before and after a deploy, join examples to traces, and keep a small set of representative raw lines for debugging. Drain is not trying to understand English or the full application grammar. It is a practical data structure for making log text usable at telemetry scale.`,
        {type: `callout`, text: `Drain turns unstable text into stable operational keys by indexing log shape before scoring templates.`},
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg`, alt: `Trie diagram showing shared prefixes for several short words.`, caption: `Trie example by Booyabazooka, based on Deco, with modifications by Superm401, Wikimedia Commons, public domain.`},
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        `The first tempting answer is a regex library maintained by the observability team. For a small system, this can work. You mask UUIDs, numbers, IP addresses, request IDs, and known paths; then you map the remaining messages to event names. The wall appears when logs come from many teams, languages, dependencies, and deployment versions. New messages appear during incidents, exactly when nobody wants to write a parser before investigating the failure. Regex rules also conflict: a broad rule may swallow a meaningful distinction, while a narrow rule may leave thousands of near-duplicate templates.`,
        `The second tempting answer is to let search handle everything. Store every line, index every token, and let engineers query later. Search is necessary, but it does not solve grouping. Alerting, dashboards, anomaly detection, and release comparison need a stable key. Counting every full line produces nonsense when IDs and timestamps vary. Counting only severity loses the failure shape. The system needs a middle layer between raw text and hand-modeled events.`,
        `Drain takes that middle path. It assumes many logs have stable tokens mixed with variable tokens. It indexes log shape cheaply, compares a new line only against plausible candidate templates, and generalizes token positions when examples show that the position varies. It gives operations teams useful structure without requiring every service to emit perfect structured events from day one.`,
      ],
    },
    {
      heading: 'Core insight and data structure',
      paragraphs: [
        `Drain uses a fixed-depth parse tree as an index over log shape. A raw line is first preprocessed and tokenized. Obvious variables may be masked before parsing: IP addresses, UUIDs, hex strings, timestamps, numbers, request IDs, emails, paths, or service-specific tokens. The parser then uses cheap structural properties, especially token count and selected token positions, to route the line into a small candidate group.`,
        `That fixed-depth tree is the key performance idea. A naive online parser would compare every incoming log line against every existing template. That becomes expensive as the number of templates grows. Drain instead asks coarse questions first. How many tokens does the line have? What stable token appears at a selected position? Which branch should this line follow? By the time it scores similarity, it is comparing against a much smaller set of templates.`,
        `A template is a sequence of tokens where some positions are constants and some are wildcards. Similarity is usually based on how many non-wildcard tokens match between the incoming line and a candidate template. If enough stable positions match, the line joins that template group. If a token differs in a position that was previously constant, the template may generalize that position to a wildcard. If no candidate is similar enough, the parser creates a new template group. That rejection path is important: new failure modes should remain visible instead of being forced into the nearest old pattern.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The fixed-depth-tree view starts with raw text and moves through tokenization. The length bucket is the first strong discriminator: lines with different token counts often cannot share an exact token-position template. Position branches then use selected tokens to narrow the candidate set. Those branches are not a semantic parse of the application. They are an index that keeps online matching cheap.`,
        `The similarity node is where the parser makes the operational decision. If the candidate template "Failed login user <*>" sees "Failed login user 91," the stable tokens match and the variable position is already a wildcard. If the current template is still "Failed login user 42," the new example may cause the last position to become <*>, producing the more general template. If the incoming line is "Disk full on node a," it should not be forced into the login group merely because one token overlaps.`,
        `The online-update view shows why Drain is a streaming algorithm rather than an offline clustering report. The template set evolves as logs arrive. Each accepted line can refine the template. Each rejected line can create a new group. Downstream systems then treat template IDs as event keys: count per service and version, flag newly created templates, attach raw examples, correlate with traces, and route noisy templates to review instead of alerting on every unique string.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Drain works because many production log statements are generated from format strings. A developer writes something like ` + "`logger.error(\"Failed login user {} from {}\", userId, ip)`" + `. The runtime emits many concrete lines, but the stable words remain in the same positions. Drain exploits that regularity. It does not need to infer arbitrary grammar; it needs to recover the rough shape of format strings from observed examples.`,
        `The fixed-depth tree also matches the online requirement. Logs arrive continuously. An observability pipeline cannot wait for a nightly clustering job before detecting a new error after a deploy. Drain can process each line, update templates, and emit a template ID immediately. The quality may improve as more examples arrive, but the system has a useful event key from the start.`,
        `The method is deliberately conservative compared with deep language understanding. Token equality and wildcards are easy to explain to operators. When a template changes, an engineer can inspect the old template, the incoming line, and the wildcarded position. That transparency matters during incident response. A clever opaque model that clusters logs better on average can still be hard to trust when it merges two rare failure modes during an outage.`,
      ],
    },
    {
      heading: 'Where it wins in a telemetry pipeline',
      paragraphs: [
        `A practical pipeline usually masks first, parses second, and enriches third. Masking removes obvious variables and sensitive values before they explode cardinality or leak into downstream stores. Parsing assigns a template ID and template text. Enrichment attaches service name, deployment version, severity, host, trace ID, span ID, route, region, customer tier, or other resource attributes. The result is a log event that can be counted and correlated without discarding raw context.`,
        `The template ID should not replace the raw line. Engineers still need examples, parameters, stack traces, and surrounding context. A good system stores representative raw events and keeps links from template counts back to sample lines. During an incident, the workflow is often: notice a new template after deploy, inspect its examples, jump to traces with the same trace ID, compare metrics for the affected service, and decide whether the template is a symptom or the root signal.`,
        `Templates also create governance hooks. A newly created template in a critical service may require review. A template whose count suddenly spikes can become an alert candidate. A template that contains unmasked emails, tokens, or customer identifiers can trigger a privacy fix. A template that changes every deploy may indicate unstable logging code. The parser is not only compression; it is a way to turn messy text into operational inventory.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Drain reduces online comparison cost by using a fixed-depth tree, but it does not make parsing free. The system still pays for preprocessing, tokenization, tree traversal, similarity scoring, template updates, template storage, and downstream cardinality. Those costs are usually small compared with full-text clustering, yet they matter at log-ingestion scale.`,
        `The main quality tradeoff is between merge and split errors. A low similarity threshold or aggressive wildcarding can merge distinct events into one template. A high threshold or weak masking can split one event into thousands of templates. The right setting depends on the operational use: security teams may prefer preserving distinctions, while high-volume platform dashboards may prefer stable aggregate keys.`,
        `There is also a latency and governance tradeoff. Online parsing gives immediate template IDs for new logs, but early templates may change as more examples arrive. If template IDs feed alerts, anomaly detection, or retention policy, the pipeline needs versioning and review rules so template churn does not create false operational history.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start with masking rules before tuning Drain itself. Mask timestamps, UUIDs, IP addresses, request IDs, numbers, hex strings, paths, emails, access tokens, and known service-specific identifiers. Do that before export to shared stores. A parser that learns to wildcard secrets after seeing examples has already leaked the first examples.`,
        `Keep template identity separate from template text. The text may generalize over time as constants become wildcards, but downstream systems need stable identifiers, creation time, version, service scope, parser configuration, and example lines. Store enough provenance to explain why a line matched a template during an incident.`,
        `Evaluate with labeled slices, not only aggregate template counts. Sample high-volume templates, newly created templates, templates that changed recently, and templates near alert thresholds. Check both over-wildcarding and under-wildcarding. Track template churn per service and deploy version; sudden churn is often a logging change, parser regression, or real incident signal.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Drain fails when shape is not enough. Two messages can share many tokens but mean different things. "Payment retry succeeded for order <*>" and "Payment retry failed for order <*>" differ by one critical token. An overly aggressive threshold or wildcard rule can hide that distinction. This is over-wildcarding: one vague template absorbs multiple event types and makes alerts less precise.`,
        `It also fails in the opposite direction. If request IDs, paths, numbers, hashes, or user-controlled strings are not masked before parsing, the parser may create too many templates. This is under-wildcarding: one event type fragments into many keys. The symptom is high template churn, noisy novelty alerts, and dashboards dominated by one-off strings. Better masking rules, tokenization, and threshold tuning are usually required.`,
        `Free-text parsing is the wrong tool when the application already emits good structured logs. If a JSON log has stable fields for event name, error code, tenant, route, and duration, the pipeline should extract those fields instead of pretending the message string is the source of truth. Drain is most useful for legacy logs, third-party text, mixed estates, and transitional systems where perfect instrumentation is not available.`,
        `Privacy is a separate requirement. Drain can wildcard a token after seeing variation, but that may happen after sensitive data has already entered the pipeline. Redaction and classification should happen before storage or export. Secrets, session tokens, emails, phone numbers, access keys, and customer IDs need controls that do not depend on the parser eventually learning a wildcard.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Suppose the stream begins with "Failed login user 42 from 10.0.0.7." Preprocessing masks the IP and maybe the number, producing tokens like ["Failed", "login", "user", "<*>", "from", "<*>"]. The parser routes the line by token count and selected positions. No candidate exists, so it creates a new template. Later it sees "Failed login user 91 from 10.0.0.8." The same length and stable positions lead to the same group, and the wildcard positions absorb the changing values.`,
        `Now a deploy introduces "Failed login user 91 because account locked." It may share the first few tokens but has a different length and different suffix. Depending on configuration, it should become a separate template because it represents a distinct event. If the parser merges it into the generic failed-login template, the security team may miss that account-lock failures are growing. If it splits every user into a new template, the team gets alert noise. The engineering work is tuning the parser so the operational distinction matches the incident distinction.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: the Drain publication page at https://pinjiahe.github.io/publication/2017-ICWS, the Drain paper PDF at https://netman.aiops.org/~peidan/ANM2023/6.LogAnomalyDetection/phe_icws2017_drain.pdf, the OpenTelemetry Logs Data Model at https://opentelemetry.io/docs/specs/otel/logs/data-model/, and the OpenTelemetry log data appendix at https://opentelemetry.io/docs/specs/otel/logs/data-model-appendix/. Use the original paper for the algorithm and current OpenTelemetry specifications for modern log-pipeline vocabulary.`,
        `Next, study Trie for prefix-index thinking, Finite State Machine for recognizing structured text, Count-Min Sketch and Heavy Hitters for noisy telemetry counts, OpenTelemetry Collector for ingestion pipelines, Distributed Tracing for correlation by trace ID, AIOps Incident Response for downstream use, Metric Label Cardinality Control for the cost of unbounded keys, and PII Redaction Token Span Pipeline for privacy controls that should happen before inferred templates are stored.`,
      ],
    },
  ],
};
