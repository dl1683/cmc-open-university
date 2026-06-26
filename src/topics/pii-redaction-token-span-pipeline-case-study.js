// PII redaction pipeline: detect sensitive token spans, resolve overlaps,
// transform by policy, and keep a lineage ledger for release review.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'pii-redaction-token-span-pipeline-case-study',
  title: 'PII Redaction Token Span Pipeline Case Study',
  category: 'Security',
  summary: 'Detect sensitive spans, resolve overlapping recognizers, transform by policy, and keep redaction lineage for logs, datasets, and model training.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['span detection', 'release gate'], defaultValue: 'span detection' },
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

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'ingest', label: 'ingest', x: 0.7, y: 3.5, note: 'text/log' },
      { id: 'tokens', label: 'tokens', x: 2.1, y: 3.5, note: 'offsets' },
      { id: 'detect', label: 'detect', x: 3.6, y: 1.8, note: 'spans' },
      { id: 'rules', label: 'rules', x: 3.6, y: 5.2, note: 'regex/NLP' },
      { id: 'resolve', label: 'resolve', x: 5.3, y: 3.5, note: 'overlap' },
      { id: 'policy', label: 'policy', x: 6.9, y: 3.5, note: 'action' },
      { id: 'export', label: 'export', x: 8.6, y: 2.0, note: 'clean' },
      { id: 'ledger', label: 'ledger', x: 8.6, y: 5.2, note: 'audit' },
    ],
    edges: [
      { id: 'e-ingest-tokens', from: 'ingest', to: 'tokens' },
      { id: 'e-tokens-detect', from: 'tokens', to: 'detect' },
      { id: 'e-rules-detect', from: 'rules', to: 'detect' },
      { id: 'e-detect-resolve', from: 'detect', to: 'resolve' },
      { id: 'e-resolve-policy', from: 'resolve', to: 'policy' },
      { id: 'e-policy-export', from: 'policy', to: 'export' },
      { id: 'e-policy-ledger', from: 'policy', to: 'ledger' },
    ],
  }, { title });
}

function* spanDetection() {
  yield {
    state: pipelineGraph('Redaction is a span pipeline, not a regex trick'),
    highlight: { active: ['ingest', 'tokens', 'detect', 'rules', 'e-ingest-tokens', 'e-tokens-detect', 'e-rules-detect'], compare: ['export'] },
    explanation: 'A production redaction pipeline preserves offsets, labels detected spans, resolves conflicts, applies policy, and writes lineage. A regex-only scrubber loses too much evidence and misses context.',
    invariant: 'Keep raw input access restricted; export only policy-approved transforms.',
  };

  yield {
    state: labelMatrix(
      'Detected token spans',
      [
        { id: 'name', label: 'Ava Li' },
        { id: 'email', label: 'email' },
        { id: 'acct', label: 'acct id' },
        { id: 'city', label: 'city' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'span', label: 'span' },
        { id: 'score', label: 'score' },
      ],
      [
        ['PERSON', '0..6', '0.91'],
        ['EMAIL', '18..31', '0.99'],
        ['ACCOUNT', '45..52', '0.94'],
        ['LOCATION', '61..67', '0.71'],
      ],
    ),
    highlight: { active: ['name:type', 'email:type', 'acct:type'], compare: ['city:score'] },
    explanation: 'Each recognizer returns a typed span: start offset, end offset, entity type, confidence, recognizer name, and sometimes context. The type matters because masking an email, hashing an account id, and generalizing a city are different policies.',
  };

  yield {
    state: labelMatrix(
      'Overlap resolution',
      [
        { id: 'phone', label: 'phone' },
        { id: 'acct', label: 'acct' },
        { id: 'addr', label: 'addr' },
        { id: 'zip', label: 'zip' },
      ],
      [
        { id: 'span', label: 'span' },
        { id: 'winner', label: 'winner' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['12..24', 'PHONE', 'higher score'],
        ['18..24', 'drop', 'inside phone'],
        ['40..58', 'ADDRESS', 'longer span'],
        ['53..58', 'merge', 'part of addr'],
      ],
    ),
    highlight: { active: ['phone:winner', 'addr:winner'], removed: ['acct:winner'], compare: ['zip:winner'] },
    explanation: 'Detectors overlap. A resolver applies deterministic precedence rules: higher severity, higher confidence, longer span, or context-specific type. Without this step, transforms can corrupt text or leave partial identifiers behind.',
  };

  yield {
    state: labelMatrix(
      'Transform policy',
      [
        { id: 'email', label: 'email' },
        { id: 'acct', label: 'account' },
        { id: 'name', label: 'person' },
        { id: 'loc', label: 'location' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'why', label: 'why' },
      ],
      [
        ['replace', 'no contact'],
        ['salted hash', 'joinable'],
        ['mask', 'readable'],
        ['coarsen', 'analytics'],
      ],
    ),
    highlight: { active: ['email:action', 'acct:action', 'loc:action'], compare: ['name:why'] },
    explanation: 'Redaction is not always deletion. Some workflows need stable salted hashes for joins, coarse geography for analysis, replacement tokens for readability, or full suppression for high-risk fields.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'detector threshold', min: 0.4, max: 1.0 }, y: { label: 'rate', min: 0, max: 1 } },
      series: [
        { id: 'recall', label: 'recall', points: [{ x: 0.45, y: 0.96 }, { x: 0.60, y: 0.91 }, { x: 0.75, y: 0.82 }, { x: 0.90, y: 0.61 }] },
        { id: 'precision', label: 'precision', points: [{ x: 0.45, y: 0.70 }, { x: 0.60, y: 0.81 }, { x: 0.75, y: 0.90 }, { x: 0.90, y: 0.96 }] },
      ],
      markers: [{ id: 'review', x: 0.75, y: 0.90, label: 'review tier' }],
    }),
    highlight: { active: ['recall', 'precision'], found: ['review'] },
    explanation: 'Thresholds trade missed PII against over-redaction. High-risk exports usually favor recall and send ambiguous spans to review. Low-risk internal logs may accept more masking to keep the pipeline simple.',
  };
}

function* releaseGate() {
  yield {
    state: graphState({
      nodes: [
        { id: 'raw', label: 'raw', x: 0.8, y: 3.5, note: 'vault' },
        { id: 'spans', label: 'spans', x: 2.4, y: 2.0, note: 'typed' },
        { id: 'clean', label: 'clean', x: 2.4, y: 5.0, note: 'export' },
        { id: 'lineage', label: 'lineage', x: 4.2, y: 3.5, note: 'offsets' },
        { id: 'risk', label: 'risk', x: 6.0, y: 2.0, note: 'review' },
        { id: 'policy', label: 'policy', x: 6.0, y: 5.0, note: 'purpose' },
        { id: 'gate', label: 'gate', x: 8.0, y: 3.5, note: 'allow' },
        { id: 'audit', label: 'audit', x: 9.2, y: 5.0, note: 'trace' },
      ],
      edges: [
        { id: 'e-raw-spans', from: 'raw', to: 'spans' },
        { id: 'e-spans-clean', from: 'spans', to: 'clean' },
        { id: 'e-spans-lineage', from: 'spans', to: 'lineage' },
        { id: 'e-clean-lineage', from: 'clean', to: 'lineage' },
        { id: 'e-lineage-risk', from: 'lineage', to: 'risk' },
        { id: 'e-policy-gate', from: 'policy', to: 'gate' },
        { id: 'e-risk-gate', from: 'risk', to: 'gate' },
        { id: 'e-gate-audit', from: 'gate', to: 'audit' },
      ],
    }, { title: 'The release gate needs lineage, not just clean text' }),
    highlight: { active: ['lineage', 'risk', 'policy', 'gate'], found: ['audit'], compare: ['raw'] },
    explanation: 'The gate needs to know what was removed, what was transformed, which policy applied, and why the result is allowed for this purpose. Clean text without lineage is hard to trust.',
  };

  yield {
    state: labelMatrix(
      'Release model choices',
      [
        { id: 'raw', label: 'raw access' },
        { id: 'pseudo', label: 'pseudo' },
        { id: 'deid', label: 'de-id' },
        { id: 'dp', label: 'DP aggregate' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'control', label: 'control' },
      ],
      [
        ['debug vault', 'strict ACL'],
        ['joins needed', 'salt policy'],
        ['research copy', 'risk review'],
        ['public stats', 'epsilon budget'],
      ],
    ),
    highlight: { active: ['pseudo:control', 'deid:control', 'dp:control'], removed: ['raw:use'] },
    explanation: 'NIST SP 800-188 frames de-identification as a release-model decision. Publishing records, publishing synthetic data, and exposing a DP query interface are different products with different risks.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'miss', label: 'missed span' },
        { id: 'partial', label: 'partial mask' },
        { id: 'link', label: 'linkability' },
        { id: 'logs', label: 'raw logs' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['PII escapes', 'recall eval'],
        ['id remains', 'overlap rules'],
        ['hash links', 'salt rotation'],
        ['bypass path', 'collector gate'],
      ],
    ),
    highlight: { active: ['miss:fix', 'partial:fix', 'logs:fix'], compare: ['link:symptom'] },
    explanation: 'The worst failures are usually operational: a detector misses context, a partial mask leaves enough identifier to link, or an alternate log path bypasses the redaction processor.',
  };

  yield {
    state: labelMatrix(
      'Telemetry export case',
      [
        { id: 'before', label: 'before' },
        { id: 'otel', label: 'collector' },
        { id: 'after', label: 'after' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['raw attrs', 'email in span'],
        ['redaction proc', 'allow list'],
        ['masked attrs', 'no PII'],
        ['sample audit', 'stored diff'],
      ],
    ),
    highlight: { active: ['otel:state', 'after:state'], found: ['proof:evidence'], removed: ['before:evidence'] },
    explanation: 'Observability data is a common leak path. The OpenTelemetry Collector is the right place to enforce attribute allowlists and redaction before telemetry leaves the environment.',
  };

  yield {
    state: labelMatrix(
      'Redaction is not a proof',
      [
        { id: 'remove', label: 'remove IDs' },
        { id: 'quasi', label: 'quasi IDs' },
        { id: 'infer', label: 'inference' },
        { id: 'govern', label: 'governance' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'stillNeed', label: 'still need' },
      ],
      [
        ['direct PII', 'risk model'],
        ['links remain', 'k-anon/DP'],
        ['facts leak', 'release review'],
        ['process', 'auditable gate'],
      ],
    ),
    highlight: { active: ['remove:helps'], compare: ['quasi:stillNeed', 'infer:stillNeed'], found: ['govern:stillNeed'] },
    explanation: 'Removing direct identifiers is necessary but not sufficient. Quasi-identifiers, linkability, and inference can still disclose individuals. Redaction must sit inside a governed release process.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'span detection') yield* spanDetection();
  else if (view === 'release gate') yield* releaseGate();
  else throw new InputError('Pick a PII-redaction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipeline from raw text to released output. Active nodes are the stage currently transforming evidence, found nodes are approved clean output or audit records, and compare nodes are raw or risky paths that must stay inside the trust boundary.',
        'PII means personally identifiable information, and a span is a start and end offset over text. The safe inference rule is that output is trustworthy only when each transformed byte can be traced to typed spans, conflict resolution, and a release policy.',
        {type:'callout', text:'A redaction pipeline becomes auditable when every released byte traces back to typed spans, deterministic conflict resolution, and purpose specific policy.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sensitive text spreads through logs, traces, tickets, search indexes, analytics exports, training corpora, and incident bundles. Once raw identifiers leave the original trust boundary, cleanup becomes slow and hard to prove.',
        'A token-span redaction pipeline creates one controlled transformation point. It detects sensitive ranges, resolves overlaps, applies purpose-specific actions, and writes a ledger that reviewers can inspect later.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a set of regex replacements. Emails, phone numbers, credit-card-like strings, and IP addresses have recognizable syntax, so a simple scrubber catches common cases.',
        'That is a useful first filter for narrow logs. It is not enough for names, addresses, account ids, device ids, rare identifiers, or context where the same token is harmless in one field and sensitive in another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is context and evidence. After regex replacement, the system may not know which detector fired, which version it used, whether a partial identifier remains, or which policy justified the released text.',
        'Overlaps create another wall. A phone recognizer may claim characters 12 through 24 while an account recognizer claims 18 through 24, and independent replacement can leave a linkable fragment behind.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use an interval set over the original text. Each candidate span stores start offset, end offset, entity type, confidence, recognizer name, detector version, context, and suggested action.',
        'Then separate detection from release policy. The resolver creates a stable non-overlapping span set, and policy maps each span type and release purpose to replace, mask, hash, generalize, suppress, or review.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline tokenizes or indexes the raw text while preserving source offsets. Recognizers propose spans using regex, checksums, dictionaries, named-entity models, field names, allowlists, and context rules.',
        'The resolver sorts candidates and applies precedence such as higher severity before lower severity, validated structured identifier before generic entity, and larger address span before contained zip span. The transformer applies actions from the end of the string backward so earlier edits do not shift later offsets.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with coverage: every export path must pass through the processor or an explicitly forbidden alternative. A good detector in the web request path does not protect data if a batch dump or telemetry collector bypasses it.',
        'Transform correctness is interval correctness. If resolved spans are non-overlapping and replacements are applied against original offsets, the pipeline avoids partial edits that corrupt the text or expose parts of identifiers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is latency, detector maintenance, evaluation data, salt management, ledger storage, reviewer tools, and policy drift. High recall catches more PII but increases false positives and manual review.',
        'Behavior changes with thresholds. Raising a detector threshold from 0.70 to 0.90 may improve precision from 0.85 to 0.96, but if recall drops from 0.94 to 0.70, a public export becomes much riskier.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits log pipelines, support tickets, trace attributes, data warehouse exports, search indexing, model-training datasets, and governed internal debugging. The access pattern is controlled release of text that still needs some utility.',
        'It also fits observability collectors. Redacting before telemetry leaves the environment is stronger than asking every service team to remember which attributes might contain customer identifiers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a proof of anonymity. Quasi-identifiers such as age, zip code, employer, timestamp, and incident details can still identify a person when joined with outside data.',
        'It also fails through bypasses. A service may redact application logs but forget traces, debug dumps, object-store exports, screenshots, or base64 payloads that carry the same sensitive text.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support log says: Ava Li reported account 88319 from Boston. Email ava@example.com failed login twice. Detectors propose PERSON for offsets 0..6, ACCOUNT for 24..29, LOCATION for 35..41, and EMAIL for 49..64.',
        'For a training export, policy replaces the email with [EMAIL], masks the name as A***, hashes account 88319 with a training-scope salt, and generalizes Boston to Northeast. The ledger stores original offsets, detector versions, scores, actions, and policy id train-v4.',
        'For an internal incident export, the account hash may remain stable for 30 days so engineers can join events. That different purpose needs a different salt scope, retention period, and approval record.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study NIST SP 800-122 at https://csrc.nist.gov/pubs/sp/800/122/final, NIST SP 800-188 at https://csrc.nist.gov/pubs/sp/800/188/final, Microsoft Presidio at https://microsoft.github.io/presidio/, and OpenTelemetry sensitive-data guidance at https://opentelemetry.io/docs/security/handling-sensitive-data/. Read them for PII definitions, de-identification risk, detector/anonymizer separation, and telemetry enforcement.',
        'Next, study OpenTelemetry Collector Case Study, Log Template Drain Parser, OPA Rego Policy Decision Graph, Claim Graph and Source Ledger, Differential Privacy SGD, Membership Inference and Model Inversion, and LLM Training Data Extraction. These topics show how redaction, policy, lineage, and residual disclosure risk connect.',
      ],
    },
  ],
};