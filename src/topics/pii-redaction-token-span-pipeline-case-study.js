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
      heading: 'Why this exists',
      paragraphs: [
        'PII leaks because useful systems copy text everywhere. Logs, traces, tickets, analytics exports, search indexes, training corpora, support tools, and incident bundles all want the same raw events. Once direct identifiers spread into those surfaces, cleanup becomes slow, incomplete, and hard to prove.',
        'A token-span redaction pipeline creates one controlled transformation point before data leaves a trust boundary. It detects sensitive ranges, resolves conflicts, applies purpose-specific policy, and writes evidence that reviewers can inspect later. The data structure at the center is the span: start offset, end offset, type, confidence, recognizer, transform, and lineage.',
        'The goal is not to make text harmless by magic. The goal is to turn a messy release decision into a recorded series of small decisions: what was found, which finding won when detectors disagreed, what action policy required, what output was released, and what risk remains.',
        {type:'callout', text:'A redaction pipeline becomes auditable when every released byte traces back to typed spans, deterministic conflict resolution, and purpose specific policy.'},
      ],
    },
    {
      heading: 'The obvious regex approach and its wall',
      paragraphs: [
        'The obvious approach is a pile of regex replacements. Remove anything that looks like an email, phone number, credit card, IP address, or account number. That catches some high-syntax identifiers and is often enough for a demo or a narrow log format.',
        'The wall appears as soon as the text becomes free-form. Names, addresses, locations, patient references, employee ids, device ids, and incident notes do not always have rigid syntax. A number can be an order id in one field and harmless telemetry in another. A city can be safe in aggregate and sensitive inside a small population record.',
        'Regex-only scrubbing also loses evidence. After replacement, it may be impossible to answer which detector fired, whether a partial span was left behind, which policy applied, and why a release was approved. That lack of lineage turns redaction into trust-me text rewriting.',
      ],
    },
    {
      heading: 'Core model and invariants',
      paragraphs: [
        'The core model is an interval set over the original text. Each candidate span has offsets, type, score, detector name, context, and suggested action. The resolved span set is the non-overlapping set that policy will transform. The ledger records the bridge from raw text to clean text.',
        'The first invariant is boundary control: raw input stays restricted, and only policy-approved transforms cross the boundary. Every released byte should be explainable from a resolved span set and a release policy. If output cannot be tied back to typed spans and decisions, it is hard to audit and hard to improve.',
        'The second invariant is deterministic overlap handling. Two recognizers may claim the same characters. The pipeline must choose, merge, split, or drop spans by stable rules before applying transforms. Otherwise one run may mask a whole phone number while another masks only the last four digits and leaves a linkable prefix.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The span-detection view is a left-to-right contract. Ingest preserves the raw text inside the restricted zone. Tokenization preserves offsets. Detectors propose spans. The resolver turns overlapping proposals into a stable set. Policy decides whether each resolved span becomes a replacement token, mask, salted hash, generalized value, or full suppression.',
        'The detected-span table teaches why type and confidence matter. An email, account id, person name, and location often need different actions. The overlap table teaches why intervals must be resolved before text is edited. A contained span may be dropped, merged, or replaced by a larger structured entity.',
        'The release-gate view shows that clean text and ledger are both outputs. Clean text alone is not enough. The gate needs the raw-to-clean mapping, residual risk, release purpose, detector versions, policy ids, and audit trail. The telemetry frame is a warning: collectors and background exporters often become bypass paths unless redaction runs before export.',
      ],
    },
    {
      heading: 'Span detection mechanics',
      paragraphs: [
        'The pipeline first normalizes input into tokens or character ranges while preserving source offsets. Offset preservation is not bookkeeping trivia. It lets the system transform the original text exactly and lets auditors compare raw and clean views without guessing which characters were changed.',
        'Recognizers propose spans from regular expressions, checksum validators, dictionaries, named-entity models, field metadata, allowlists, deny lists, and context rules. A strong span record includes detector name, detector version, entity type, score, supporting context, and source field. Without that metadata, later review cannot separate detector failure from policy failure.',
        'Good detectors also use negative evidence. An allowlisted service account should not be treated like a customer email. A known test phone number should not pollute privacy metrics. A field named `customer_email` should raise confidence for email-like text, while a field named `build_sha` should lower confidence for hex-looking strings.',
      ],
    },
    {
      heading: 'Overlap resolution and policy',
      paragraphs: [
        'Candidate spans often overlap. A phone recognizer may claim characters 12..24 while an account recognizer claims 18..24. An address recognizer may claim a whole address while a zip-code recognizer claims the final five characters. Applying transforms independently can corrupt text or leave partial identifiers behind.',
        'A resolver sorts spans and applies precedence. Common rules include severity before confidence, longer span before contained span, structured entity before generic entity, and domain type before broad named-entity type. Some overlaps should merge, such as a street address plus zip code. Others should drop, such as a generic number inside a validated phone number.',
        'Policy maps resolved entity type and release purpose to action. An email in a public export may become `[EMAIL]`. An account id in an internal debugging export may become a salted hash. A location in analytics may become a region. A high-risk note may be suppressed. Redaction is not always deletion; it is controlled transformation.',
      ],
    },
    {
      heading: 'Why it works and governance',
      paragraphs: [
        'Correctness starts with coverage. Every export path must go through the processor or through an explicit allowlisted alternative. A strong detector in the application path does not protect data if background jobs, log collectors, trace exporters, database dumps, or support scripts ship raw attributes around it.',
        'Transform correctness is interval correctness. Apply transforms to the resolved span set, preserve offsets in the ledger, and avoid producing partial identifiers by masking only the middle of a larger entity. Many implementations apply replacements from the end of the string backward so earlier edits do not shift later offsets.',
        'Governance adds a release model. NIST SP 800-122 gives practical guidance for identifying and protecting PII: https://csrc.nist.gov/pubs/sp/800/122/final. NIST SP 800-188 frames de-identification as a disclosure-risk decision, not a single algorithm: https://csrc.nist.gov/pubs/sp/800/188/final.',
        'A release gate should know purpose, audience, retention period, allowed entity types, detector thresholds, review requirements, and residual risk. The same clean text may be acceptable for internal debugging and unacceptable for public release. Purpose is part of the contract.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main tradeoff is recall versus utility. High recall reduces the chance that direct identifiers escape, but it can remove useful text and increase reviewer workload. High precision preserves more utility, but missed spans become privacy incidents. High-risk releases usually bias toward recall and manual review for ambiguous spans.',
        'The operational cost includes latency, detector maintenance, multilingual support, evaluation datasets, salt management, ledger storage, reviewer tooling, and policy drift. Redaction also changes downstream analytics: hashes preserve joins, replacement tokens preserve rough shape, suppression reduces leakage but can bias measurements.',
        'Threshold tuning must be tied to the release product. A public dataset should usually accept more over-redaction and more review. A narrow internal operational log may need stable pseudonyms for incident response. A dashboard may need only aggregate counts and should not receive record-level text at all.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support log says: `Ava Li reported account 88319 from Boston. Email ava@example.com failed login twice.` Detectors propose PERSON for `Ava Li`, ACCOUNT for `88319`, LOCATION for `Boston`, and EMAIL for `ava@example.com`. A context recognizer may also label the login failure as sensitive security context.',
        'For a model-training export, policy might replace the email, mask the person name, hash the account id with a training-scope salt, and generalize Boston to a region. The clean text and ledger leave together: output text for training, span records for audit, detector scores for evaluation, and policy ids for later review.',
        'For a debugging export inside the production trust boundary, policy may keep the salted account hash stable so engineers can join events across services. That is a different release product, so it needs a different policy, retention period, and reviewer expectation. Reusing the model-training policy would either remove too much operational value or preserve too much for training.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins for logs, support tickets, trace attributes, search indexing, dataset preparation, and governed internal exports where text must remain useful but direct identifiers should not spread. It gives teams a shared vocabulary: candidate span, resolved span, action, release purpose, ledger, and residual risk.',
        'It also helps evaluation. False negatives can be traced to detector gaps. False positives can be traced to type rules or thresholds. Partial masks can be traced to overlap logic. Policy surprises can be traced to purpose mapping. The pipeline makes improvement local instead of turning every redaction issue into a full-system mystery.',
        'Microsoft Presidio is a practical reference for separating detection from anonymization: https://microsoft.github.io/presidio/. OpenTelemetry documents sensitive-data handling for telemetry pipelines: https://opentelemetry.io/docs/security/handling-sensitive-data/.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'A span pipeline is not a complete privacy proof. It can miss contextual PII, nicknames, rare names, unusual address formats, multilingual text, screenshots, identifiers embedded in base64 blobs, or sensitive facts that do not look like identifiers. It can also over-mask so aggressively that the resulting data is not useful.',
        'Linkage risk remains after many direct identifiers are removed. A record with age, zip code, employer, timestamp, and incident details may still identify a person when joined with outside data. Stable salted hashes preserve joins, which is useful, but they also preserve linkability inside the salt scope. Salt rotation and purpose-scoped salts are policy tools, not proof of anonymity.',
        'Operational bypasses are often worse than detector errors. A service may redact application logs but forget trace attributes. A batch export may bypass the collector. A debug dump may store raw payloads in object storage. A reviewer may approve a sample but miss a long-tail format. Coverage tests need to include every path that can move text across a boundary.',
        'Formal releases may need aggregation, differential privacy, synthetic-data evaluation, k-anonymity style risk checks, secure query interfaces, or legal review instead of record-level redacted text. The pipeline reduces risk and records decisions; it does not erase all disclosure risk.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Start by mapping data flows. List every place raw text can leave the trust boundary: API responses, queues, logs, traces, metrics attributes, tickets, search indexes, warehouse tables, model-training files, and incident bundles. Put the processor before each exit or document why an exit is forbidden.',
        'Build a gold dataset with real edge cases, not only obvious emails. Include names without capitalization, addresses split across fields, non-English text, internal ids, false positives, and overlapping spans. Track recall, precision, partial-redaction rate, bypass coverage, and reviewer disagreement.',
        'Treat the ledger as sensitive. It may contain offsets, entity types, hashes, and enough information to reconstruct risk. Store it with access controls, retention limits, detector versions, policy versions, and sampling rules. The audit path should be useful without becoming a new leak path.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study OpenTelemetry Collector Case Study for telemetry enforcement, Log Template Drain Parser for structured log extraction, LLM Guardrail Policy Engine for policy-time blocking, OPA Rego Policy Decision Graph for explicit authorization, Claim Graph & Source Ledger for audit lineage, Differential Privacy SGD for formal noise-based protection, Membership Inference and Model Inversion for residual attack paths, and LLM Training Data Extraction for why raw training text is dangerous.',
      ],
    },
  ],
};
