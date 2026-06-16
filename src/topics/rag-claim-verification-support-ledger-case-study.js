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
    explanation: 'A sentence can contain several factual claims. The verifier first turns prose into a ledger of atomic claims or claim-triplets, then checks each one against the citation spans the answer actually used.',
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
    explanation: 'The verification ledger stores one row per claim: span, support label, issue type, action, checker version, threshold, and trace id. It separates supported claims from contradictions, missing evidence, stale citations, and weak warrants.',
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
    explanation: 'Repairs should edit the answer text or block release. Do not bury verification failures in logs while shipping the same unsupported sentence to the user.',
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
      heading: 'What it is',
      paragraphs: [
        'A RAG claim verification support ledger is the layer between citation storage and evaluation scores. It decomposes an answer into checkable claims, binds each claim to source spans, classifies support, records the checker path, and decides whether the answer can ship, must be repaired, or needs human audit.',
        'This is stricter than showing citations. A citation can be on-topic while failing to support the exact sentence. The ledger makes support granular: supported, contradicted, extrapolatory, under-warranted, stale, missing, or inaccessible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline starts with claim decomposition. FActScore breaks long-form generations into atomic facts and measures the percentage supported by a reliable source: https://arxiv.org/abs/2305.14251. RefChecker uses claim-triplets, then checks those triplets against references: https://arxiv.org/abs/2405.14486. The engineering lesson is the same: response-level and sentence-level judgments are too coarse for mixed factual prose.',
        'The checker then evaluates each claim against the retrieved source span, not against vague world knowledge. It may use deterministic span existence checks, NLI, an LLM judge, KG triplets, search-augmented fact checking, or human review. SAFE/LongFact shows a search-augmented route for long-form factuality: https://arxiv.org/abs/2403.18802. ClaimVer shows a claim-level attribution pattern with explainable labels and evidence: https://aclanthology.org/2024.findings-emnlp.795/.',
      ],
    },
    {
      heading: 'Data structure',
      paragraphs: [
        'The core record is small but dense: answer id, claim id, normalized claim text, source span id, document version, evidence quote hash, support label, issue axis, checker model, threshold, rationale pointer, action, latency, and trace id. That row can drive UI highlights, evaluator metrics, regression dashboards, and incident review.',
        'A useful label set includes supported, contradicted, extrapolatory, force gap, stale, inaccessible, and missing evidence. Force gaps are especially important in cited RAG because the evidence can be relevant but too weak. The ForceBench paper frames this as evidence-force calibration across relation, modality, scope, temporal, and numeric axes: https://arxiv.org/abs/2605.28044.',
      ],
    },
    {
      heading: 'Complete case study: refund policy verifier',
      paragraphs: [
        'A customer-support assistant answers: "All orders are guaranteed refunds for 30 days, and restocking fees never apply." The retrieved policy span says eligible orders may be refunded within 30 days, and a separate fee table says some opened hardware has a 15 percent restocking fee. A citation-only UI might look convincing because both citations are topically relevant.',
        'The verification ledger splits the answer into claims. The 30-day date is supported. The guarantee is a modality and scope overclaim. The restocking-fee sentence is contradicted. The repair loop edits the answer to "Eligible orders may be refunded within 30 days; opened hardware may carry a restocking fee." The support ledger stores the before/after claim ids, source spans, issue labels, and release decision.',
      ],
    },
    {
      heading: 'Cost and deployment',
      paragraphs: [
        'Synchronous verification belongs only where the risk justifies the latency. For ordinary low-risk answers, the product might run fast span checks inline and route uncertain claims to async audit. For policy, medical, legal, finance, security, or enterprise-support workflows, unsupported or contradicted claims should block release or force repair.',
        'An AWS RAG hallucination detection walkthrough highlights practical detector choices such as LLM prompting, semantic similarity, BERT-style checking, and token similarity while comparing cost and latency tradeoffs: https://aws.amazon.com/blogs/machine-learning/detect-hallucinations-for-rag-based-systems/. The support ledger is the structure that lets those detectors compose instead of replacing one another.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not let the model invent citation ids. Do not verify against the whole web when the answer claimed support from a specific internal source. Do not collapse "related" and "supported." Do not hide repaired wording from the user-facing answer. Do not tune thresholds only on easy public examples; keep risk-slice holdouts and human-audited failures.',
        'Study RAG Citation Span Index Case Study, RAG Evaluation: RAGAS, ARES, and the RAG Triad, Claim Graph & Source Ledger, RAG Context Packing Token Budget, RAG Index Lifecycle and Alias Swap, Cross-Encoder Reranker, LLM Evaluation Harnesses, LLM Judge Calibration & Drift Monitor, Benchmark Variance & Model Selection, Prompt Injection Threat Model, and LLM Guardrail Policy Engine next.',
      ],
    },
  ],
};
