// RAG claim verification: split an answer into checkable claims, bind each
// claim to source spans, classify support, and repair overclaims before release.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-claim-verification-support-ledger-case-study',
  title: 'RAG Claim Verification Support Ledger',
  category: 'AI & ML',
  summary: 'A claim-level RAG verifier: atomic facts, citation spans, support labels, force-gap repairs, freshness gates, and human audit queues.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['claim split', 'verify ledger', 'repair loop'], defaultValue: 'claim split' },
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

function verifyGraph(title) {
  return graphState({
    nodes: [
      { id: 'answer', label: 'answer', x: 0.7, y: 3.6, note: 'draft' },
      { id: 'split', label: 'split', x: 2.0, y: 3.6, note: 'facts' },
      { id: 'claims', label: 'claims', x: 3.4, y: 2.1, note: 'ids' },
      { id: 'spans', label: 'spans', x: 3.4, y: 5.1, note: 'cites' },
      { id: 'check', label: 'check', x: 5.1, y: 3.6, note: 'NLI/LLM' },
      { id: 'ledger', label: 'ledger', x: 6.8, y: 3.6, note: 'labels' },
      { id: 'repair', label: 'repair', x: 8.3, y: 2.2, note: 'weaken' },
      { id: 'gate', label: 'gate', x: 8.3, y: 5.2, note: 'ship?' },
      { id: 'audit', label: 'audit', x: 9.8, y: 3.6, note: 'queue' },
    ],
    edges: [
      { id: 'e-answer-split', from: 'answer', to: 'split', weight: 'parse' },
      { id: 'e-split-claims', from: 'split', to: 'claims', weight: 'atom' },
      { id: 'e-split-spans', from: 'split', to: 'spans', weight: 'cites' },
      { id: 'e-claims-check', from: 'claims', to: 'check', weight: 'claim' },
      { id: 'e-spans-check', from: 'spans', to: 'check', weight: 'evid' },
      { id: 'e-check-ledger', from: 'check', to: 'ledger', weight: 'label' },
      { id: 'e-ledger-repair', from: 'ledger', to: 'repair', weight: 'fix' },
      { id: 'e-ledger-gate', from: 'ledger', to: 'gate', weight: 'block' },
      { id: 'e-repair-audit', from: 'repair', to: 'audit', weight: 'diff' },
      { id: 'e-gate-audit', from: 'gate', to: 'audit', weight: 'trace' },
    ],
  }, { title });
}

function forceGraph(title) {
  return graphState({
    nodes: [
      { id: 'span', label: 'span', x: 0.8, y: 3.6, note: 'only ev' },
      { id: 'cal', label: 'valid', x: 2.7, y: 2.1, note: 'licensed' },
      { id: 'strong', label: 'strong', x: 2.7, y: 5.2, note: 'too much' },
      { id: 'axis', label: 'axis', x: 4.7, y: 3.6, note: 'force' },
      { id: 'repair', label: 'repair', x: 6.7, y: 3.6, note: 'weaken' },
      { id: 'ship', label: 'ship', x: 8.6, y: 2.1, note: 'ok' },
      { id: 'block', label: 'block', x: 8.6, y: 5.2, note: 'no cite' },
    ],
    edges: [
      { id: 'e-span-cal', from: 'span', to: 'cal', weight: 'supports' },
      { id: 'e-span-strong', from: 'span', to: 'strong', weight: 'relevant' },
      { id: 'e-cal-axis', from: 'cal', to: 'axis', weight: 'lower' },
      { id: 'e-strong-axis', from: 'strong', to: 'axis', weight: 'higher' },
      { id: 'e-axis-repair', from: 'axis', to: 'repair', weight: 'restore' },
      { id: 'e-repair-ship', from: 'repair', to: 'ship', weight: 'warrant' },
      { id: 'e-strong-block', from: 'strong', to: 'block', weight: 'gap' },
    ],
  }, { title });
}

function* claimSplit() {
  yield {
    state: verifyGraph('Verification starts by splitting answer claims'),
    highlight: { active: ['answer', 'split', 'claims', 'e-answer-split', 'e-split-claims'], compare: ['spans'], found: ['ledger'] },
    explanation: 'The first split lowers the unit of judgment. A fluent sentence can contain supported, contradicted, and overclaimed facts, so the verifier works claim by claim.',
  };

  yield {
    state: labelMatrix(
      'Claim split ledger',
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
        { id: 'c5', label: 'c5' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'obj', label: 'obj' },
        { id: 'span', label: 'span' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['date', '30d', 's1', 'med'],
        ['fee', 'restock', 's2', 'low'],
        ['scope', 'EU', 's3', 'high'],
        ['num', '15%', 's4', 'high'],
        ['cause', 'refund', '', 'high'],
      ],
    ),
    highlight: { active: ['c1:span', 'c2:span', 'c3:risk'], compare: ['c5:span'], found: ['c4:obj'] },
    explanation: 'The split record keeps a small fact id, a compact normalized object, the candidate source span, and a risk label. Missing span handles are not style problems; they are unsupported claims until proven otherwise.',
    invariant: 'Check claims, not paragraphs.',
  };

  yield {
    state: verifyGraph('Citation spans become the evidence pool'),
    highlight: { active: ['spans', 'check', 'e-spans-check'], found: ['ledger'], compare: ['answer'] },
    explanation: 'This module builds on the citation span index. The checker should see the exact quoted source span, document version, access scope, freshness metadata, and answer context. A nearby chunk is not enough.',
  };

  yield {
    state: labelMatrix(
      'Granularity tradeoff',
      [
        { id: 'resp', label: 'resp' },
        { id: 'sent', label: 'sent' },
        { id: 'atom', label: 'atom' },
        { id: 'trip', label: 'triplet' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['cheap', 'blurry'],
        ['simple', 'mixed'],
        ['precise', 'many'],
        ['clean rel', 'extract err'],
      ],
    ),
    highlight: { active: ['atom:good', 'trip:good'], compare: ['resp:bad', 'sent:bad'] },
    explanation: 'FActScore uses atomic facts; RefChecker uses claim-triplets. Both move evaluation below sentence level because one fluent sentence can mix supported, contradicted, and overclaimed facts.',
  };
}

function* verifyLedger() {
  yield {
    state: labelMatrix(
      'Support ledger',
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
        { id: 'c5', label: 'c5' },
      ],
      [
        { id: 'span', label: 'span' },
        { id: 'label', label: 'label' },
        { id: 'issue', label: 'issue' },
        { id: 'act', label: 'act' },
      ],
      [
        ['s1', 'sup', 'none', 'keep'],
        ['s2', 'sup', 'none', 'keep'],
        ['s3', 'weak', 'scope', 'weaken'],
        ['s4', 'contra', 'num', 'block'],
        ['', 'miss', 'retr', 'retry'],
      ],
    ),
    highlight: { active: ['c1:label', 'c2:label'], compare: ['c3:issue'], removed: ['c4:act'], found: ['c5:act'] },
    explanation: 'The ledger row is the operational object. It stores the claim, span, support label, issue type, action, checker path, threshold, and trace id so release decisions are replayable.',
  };

  yield {
    state: verifyGraph('Use a checker cascade, not one magic judge'),
    highlight: { active: ['claims', 'spans', 'check', 'ledger', 'e-claims-check', 'e-spans-check', 'e-check-ledger'], found: ['audit'] },
    explanation: 'A production checker can cascade: deterministic source checks first, a cheap NLI or entailment model for easy labels, an LLM judge for ambiguous cases, and a human queue for high-risk unresolved claims.',
  };

  yield {
    state: labelMatrix(
      'Label taxonomy',
      [
        { id: 'sup', label: 'sup' },
        { id: 'contra', label: 'contra' },
        { id: 'extra', label: 'extra' },
        { id: 'force', label: 'force' },
        { id: 'stale', label: 'stale' },
        { id: 'acl', label: 'ACL' },
      ],
      [
        { id: 'meaning', label: 'means' },
        { id: 'action', label: 'act' },
      ],
      [
        ['warrant', 'keep'],
        ['refutes', 'block'],
        ['weak', 'cite'],
        ['over', 'weaken'],
        ['old ver', 'refresh'],
        ['hidden', 'redact'],
      ],
    ),
    highlight: { active: ['sup:action', 'force:action', 'stale:action'], removed: ['contra:action'], compare: ['extra:meaning'] },
    explanation: 'ClaimVer-style labels distinguish attribution from contradiction and extrapolation. RAG products also need freshness and access-control labels because a true claim can still be unusable for this user or this corpus version.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'threshold', min: 0, max: 1 }, y: { label: 'claim rate', min: 0, max: 1 } },
      series: [
        { id: 'auto', label: 'auto pass', points: [{ x: 0.25, y: 0.82 }, { x: 0.45, y: 0.69 }, { x: 0.65, y: 0.54 }, { x: 0.85, y: 0.32 }] },
        { id: 'human', label: 'audit', points: [{ x: 0.25, y: 0.07 }, { x: 0.45, y: 0.12 }, { x: 0.65, y: 0.21 }, { x: 0.85, y: 0.38 }] },
        { id: 'miss', label: 'missed bad', points: [{ x: 0.25, y: 0.18 }, { x: 0.45, y: 0.10 }, { x: 0.65, y: 0.05 }, { x: 0.85, y: 0.03 }] },
      ],
      markers: [
        { id: 'gate', x: 0.65, y: 0.54, label: 'ship' },
      ],
    }),
    highlight: { active: ['auto', 'gate'], compare: ['human', 'miss'] },
    explanation: 'The threshold controls the tradeoff between automation, human-review volume, and missed unsupported claims. Track this by risk slice instead of setting one universal number.',
  };
}

function* repairLoop() {
  yield {
    state: forceGraph('Relevant evidence can still be too weak'),
    highlight: { active: ['span', 'cal', 'strong', 'axis', 'e-span-cal', 'e-span-strong'], compare: ['block'], found: ['repair'] },
    explanation: 'A common cited-RAG failure is not a totally wrong citation. The citation is relevant, but the answer states a stronger relation, broader scope, firmer modality, newer time claim, or sharper number than the span warrants.',
  };

  yield {
    state: labelMatrix(
      'Force-gap axes',
      [
        { id: 'rel', label: 'rel' },
        { id: 'mod', label: 'modal' },
        { id: 'scope', label: 'scope' },
        { id: 'time', label: 'time' },
        { id: 'num', label: 'num' },
      ],
      [
        { id: 'over', label: 'over' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['assoc->cause', 'say assoc'],
        ['may->must', 'add may'],
        ['one->all', 'bound it'],
        ['2024->now', 'as of'],
        ['about->exact', 'approx'],
      ],
    ),
    highlight: { active: ['rel:fix', 'mod:fix', 'scope:fix', 'time:fix'], compare: ['num:over'] },
    explanation: 'ForceBench-style checks ask a local question: what does this displayed citation license? The repair should restore the weaker wording that the source actually supports.',
    invariant: 'Relevant is not the same as warranted.',
  };

  yield {
    state: verifyGraph('Repair feeds a new answer, not a hidden note'),
    highlight: { active: ['ledger', 'repair', 'gate', 'e-ledger-repair', 'e-ledger-gate'], found: ['audit'], compare: ['answer'] },
    explanation: 'The repair arrow must change the user-facing answer or block it. A hidden log entry is not a repair if the unsupported sentence still ships.',
  };

  yield {
    state: labelMatrix(
      'Release gate',
      [
        { id: 'support', label: 'sup' },
        { id: 'conflict', label: 'conf' },
        { id: 'fresh', label: 'fresh' },
        { id: 'acl', label: 'ACL' },
        { id: 'lat', label: 'lat' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['all', 'miss'],
        ['none', 'block'],
        ['cur', 'stale'],
        ['vis', 'leak'],
        ['p95 ok', 'slow'],
        ['cap ok', 'over'],
      ],
    ),
    highlight: { active: ['support:gate', 'fresh:gate', 'acl:gate'], removed: ['conflict:fail'], compare: ['lat:fail', 'cost:fail'] },
    explanation: 'The verifier is part of serving, so it needs product gates too. A perfect checker that doubles p95 latency may belong in async audit; high-risk or regulated answers may need synchronous blocking.',
  };

  yield {
    state: forceGraph('Complete case: refund policy answer'),
    highlight: { active: ['span', 'strong', 'axis', 'repair', 'ship'], removed: ['block'] },
    explanation: 'Case study: the retrieved policy says refunds are available within 30 days for eligible orders. The answer says all orders are guaranteed refunds for 30 days. The verifier marks a scope force gap and repairs the answer to include eligibility instead of shipping an overclaim.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'claim split') yield* claimSplit();
  else if (view === 'verify ledger') yield* verifyLedger();
  else if (view === 'repair loop') yield* repairLoop();
  else throw new InputError('Pick a RAG claim verification view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG systems are often judged by whether they show citations, but citations are only handles. A cited document can be on-topic while failing to support the sentence beside it. A support ledger exists to answer a narrower question: for each claim in the answer, what exact source span supports it, contradicts it, weakly relates to it, is stale for it, or is missing entirely?',
        'This matters because generated answers mix facts. One paragraph can contain a supported date, an over-broad scope claim, a contradicted number, and a cause statement that no source proves. Response-level scores blur those cases. A claim verification ledger lowers the unit of judgment until each fact can be checked and routed to keep, repair, block, retry, redact, or audit.',
        {type:'callout', text:'A support ledger turns RAG citation quality into claim level release control by binding each fact to the exact source span, corpus version, access scope, label, and required action.'},
      ],
    },
    {
      heading: 'The naive approach and wall',
      paragraphs: [
        'The reasonable first attempt is to retrieve documents, generate an answer, attach the top citations, and trust the reader to inspect them. This works for lightweight exploration because citations give a path back to sources. It fails when the answer must be released automatically, used by a support agent, shown in a regulated workflow, or audited after a dispute.',
        'The wall is granularity. A citation attached to a paragraph does not say which clause it supports. A semantic similarity score can mark a source as relevant while the answer states a stronger relation than the source warrants. A single LLM judge score can hide the difference between unsupported, contradicted, stale, inaccessible, and over-force claims. The system needs a row for each claim, not a vague confidence label for the whole answer.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that support is a relation between a claim and a source span under a specific corpus version and access scope. The claim is not checked against general world knowledge unless the product explicitly asks for web fact checking. It is checked against the evidence the answer claims to rely on.',
        'That relation needs a label and an action. Supported claims can stay. Contradicted claims block or force replacement. Missing claims trigger retrieval or audit. Stale claims refresh. Inaccessible claims redact. Force-gap claims weaken their wording until the source actually warrants them. The ledger is useful because it turns evidence quality into a release decision.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The claim-split view shows the first move: the answer is decomposed into small facts with ids, normalized objects, candidate span handles, and risk labels. Missing span handles are not formatting gaps. They mean the system has no evidence for that claim yet.',
        'The verification view shows why the output is a ledger rather than a score. Each claim receives a support label, issue type, checker path, threshold, trace id, and action. The repair view shows a common cited-RAG failure: relevant evidence that is too weak for the statement. The animation proves that the verifier is not asking whether a citation looks related. It asks what the citation licenses.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'The pipeline starts with claim decomposition. FActScore breaks long-form generations into atomic facts and measures how many are supported by reliable sources: https://arxiv.org/abs/2305.14251. RefChecker uses claim-triplets, then checks those triplets against references: https://arxiv.org/abs/2405.14486. The engineering lesson is stable across both approaches: response-level and sentence-level judgments are too coarse for mixed factual prose.',
        'After decomposition, each claim is paired with source spans. The checker should see the exact quote, document id, document version, retrieval query, access scope, freshness metadata, answer context, and risk label. It may use deterministic quote checks, NLI or entailment models, an LLM judge, knowledge-graph triples, search-augmented fact checking, or human review. SAFE and LongFact show a search-augmented route for long-form factuality: https://arxiv.org/abs/2403.18802. ClaimVer shows claim-level attribution with explainable evidence labels: https://aclanthology.org/2024.findings-emnlp.795/.',
        'The result is a dense row: answer id, claim id, normalized claim text, source span id, document version, quote hash, support label, issue axis, checker model, threshold, rationale pointer, action, latency, and trace id. That same row can drive UI highlights, evaluator metrics, regression dashboards, release gates, and incident review.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local. If every shipped claim has a current, accessible source span that warrants exactly that claim, then the final answer is supportable as the conjunction of those checked claims. If a claim lacks that relation, the ledger forces an action before release.',
        'This does not prove the answer is globally complete or that the retrieved corpus contains every truth. It proves a narrower and more auditable property: the answer did not state more than its cited evidence, access scope, and corpus version allow. That narrow property is exactly what citation-based RAG products usually promise.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is latency, money, and annotation complexity. Claim splitting can over-split or under-split. Entailment models and LLM judges can disagree. Human review is expensive. Thresholds that are too strict flood the audit queue; thresholds that are too loose let unsupported statements pass. The plot in the animation shows this tradeoff: higher confidence thresholds reduce missed bad claims but increase human-review volume.',
        'Deployment should follow risk. Low-risk exploratory answers can run fast checks inline and send uncertain rows to async audit. Policy, medical, legal, finance, security, and enterprise-support workflows often need synchronous blocking or forced repair for unsupported and contradicted claims. An AWS hallucination-detection walkthrough surveys practical detector choices such as LLM prompting, semantic similarity, BERT-style checking, and token similarity while comparing cost and latency: https://aws.amazon.com/blogs/machine-learning/detect-hallucinations-for-rag-based-systems/. The ledger lets these detectors compose instead of replacing one another.',
      ],
    },
    {
      heading: 'Complete case',
      paragraphs: [
        'A customer-support assistant answers: "All orders are guaranteed refunds for 30 days, and restocking fees never apply." The retrieved policy span says eligible orders may be refunded within 30 days. A separate fee table says some opened hardware has a 15 percent restocking fee. A citation-only UI can look convincing because both citations are relevant to refunds.',
        'The ledger splits the answer. The 30-day date is supported. The word guaranteed is a modality overclaim. All orders is a scope overclaim. The restocking-fee sentence is contradicted. The repair loop edits the answer to: "Eligible orders may be refunded within 30 days; opened hardware may carry a restocking fee." The ledger stores before and after claim ids, source spans, issue labels, and the release decision.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins when answers must be traceable to a controlled corpus: customer support, internal policy assistants, legal and compliance research, medical knowledge bases, financial disclosures, enterprise search, and technical documentation. It also helps teams debug retrieval quality because missing or stale claim rows reveal whether the failure came from retrieval, generation, citation attachment, or verification.',
        'It is useful for evaluation too. Instead of reporting one hallucination score, a team can track supported-claim rate, contradiction rate, force-gap rate, stale-source rate, inaccessible-source rate, repair success, human-review volume, and latency by risk slice. Those numbers explain what changed after a retriever update or model rollout.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not let the model invent citation ids. Do not verify against the whole web when the answer claimed support from a specific internal source. Do not collapse related and supported. Do not hide repaired wording in a log while the unsupported answer still ships. Do not tune thresholds only on easy public examples; keep risk-slice holdouts and human-audited failures.',
        'The ledger can also fail when claim extraction is unstable. If two equivalent answers split into incompatible claim sets, metrics become noisy. If the checker cannot see the exact quote and document version, a pass is hard to replay. If access-control labels are missing, the system can reveal that a claim is true using evidence the user was not allowed to see.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Start with a strict row schema before tuning models. Store claim id, normalized claim text, source span id, document version, quote hash, support label, issue axis, checker path, threshold, action, and trace id. If any of those fields is missing, the team cannot replay why a sentence shipped or why it was blocked.',
        'Run cheap checks first and reserve expensive judgment for the rows that need it. Exact quote and document-version checks should happen before NLI or LLM judges. Tune thresholds by answer risk, not by one global score. A refund-policy bot, a medical assistant, and an internal code-search helper should not share the same release gate.',
        'Make repair observable. The user-facing answer must change, or the answer must be blocked. Track supported-claim rate, contradiction rate, force-gap rate, missing-span rate, repair success, audit volume, p95 latency, and cost by product slice. Those counters tell whether retrieval, generation, citation attachment, or verification is failing.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study next by layer. For evidence storage, read RAG Citation Span Index Case Study and Claim Graph and Source Ledger. For retrieval quality, read RAG Context Packing Token Budget, RAG Index Lifecycle and Alias Swap, and Cross-Encoder Reranker. For evaluation, read RAG Evaluation: RAGAS, ARES, and the RAG Triad, LLM Evaluation Harnesses, LLM Judge Calibration and Drift Monitor, and Benchmark Variance and Model Selection. For safety, read Prompt Injection Threat Model and LLM Guardrail Policy Engine.',
      ],
    },
  ],
};
