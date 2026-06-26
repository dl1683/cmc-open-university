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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each answer sentence as a source of smaller claims. A claim is one checkable fact, such as a date, number, permission, exception, or causal statement.',
        'The ledger rows are the real control surface. A row ties one claim to one source span, a corpus version, a support label, and an action such as keep, repair, block, refresh, or escalate.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, gives a model retrieved documents before it answers. That does not guarantee the answer is supported, because a citation can be related to a topic while failing to prove the sentence next to it.',
        'A support ledger exists to lower the unit of judgment from response to claim. It asks whether each factual claim is supported, contradicted, stale, inaccessible, over-strong, or missing from the evidence.',
        {type:'callout', text:'A support ledger turns RAG citation quality into claim level release control by binding each fact to the exact source span, corpus version, access scope, label, and required action.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to retrieve documents, generate an answer, attach the top citations, and trust the reader or a global score. That is acceptable for casual exploration where the user expects to inspect sources.',
        'It fails for support, legal, medical, finance, security, and enterprise workflows. In those settings, the system needs to decide before release whether each claim is allowed to ship.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is granularity. A paragraph can contain one supported date, one contradicted number, one inaccessible source, and one claim that is merely related to the citation.',
        'A single faithfulness score hides those differences. The product needs different actions for contradiction, missing evidence, stale evidence, access-control failure, and wording that says more than the source warrants.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Support is a relation between a claim and an exact source span under a specific corpus version and access scope. The checker should not ask whether the claim sounds plausible; it should ask what the cited evidence licenses.',
        'The ledger turns that relation into a release gate. Supported claims can stay, contradicted claims must block or be replaced, stale claims need refresh, and over-strong claims need weaker wording.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline first splits the answer into atomic claims. It then links each claim to candidate spans with document id, quote text, offset, version, retrieval query, freshness metadata, and access scope.',
        'A checker labels the relation using exact quote checks, entailment models, LLM judges, rule checks, search, or human review depending on risk. The final row stores claim id, source span id, support label, issue type, checker path, threshold, action, latency, and trace id.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local. If every shipped factual claim has a current accessible source span that warrants exactly that claim, then the answer is supportable as the conjunction of checked rows.',
        'This does not prove the answer is complete or universally true. It proves the narrower product contract: the answer did not state more than its cited corpus, access scope, and source version support.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost grows with claims, not just with answers. If one answer has 18 claims and each claim needs 3 candidate spans checked, the verifier may run 54 claim-span comparisons before generation is considered releasable.',
        'Latency and review volume become behavior controls. A strict threshold may send 20 percent of answers to human audit, while a loose threshold may reduce cost but let unsupported claims pass.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Support ledgers fit customer-support assistants, internal policy bots, legal research tools, medical knowledge bases, finance disclosure assistants, and technical-documentation copilots. They are strongest where the corpus is controlled and the answer must be replayable.',
        'They also help evaluation. Teams can track supported-claim rate, contradiction rate, missing-span rate, stale-source rate, repair success, p95 latency, and cost by product slice instead of relying on one hallucination number.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails if claim extraction is unstable. If equivalent answers split into different claim sets, metrics become noisy and release decisions become hard to reproduce.',
        'It also fails if the verifier cannot see the exact quote, document version, and access-control state. A true claim supported by a restricted document may still be illegal to reveal to the current user.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support bot says: All orders are guaranteed refunds for 30 days, and restocking fees never apply. The policy span says eligible orders may be refunded within 30 days, while a fee table says opened hardware has a 15 percent restocking fee.',
        'The ledger creates four rows. The 30-day date is supported, all orders is a scope overclaim, guaranteed is a modality overclaim, and restocking fees never apply is contradicted; the repair becomes: Eligible orders may be refunded within 30 days, and opened hardware may carry a 15 percent restocking fee.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FActScore for atomic fact checking, RefChecker for claim-triplet checking, SAFE and LongFact for search-augmented factuality, and ClaimVer for claim-level attribution labels. These works all point at the same lesson: response-level judging is too coarse.',
        'Study RAG citation span indexes, RAG context packing, cross-encoder reranking, LLM judge calibration, access-control filters, and retrieval evaluation next. The support ledger depends on every upstream layer preserving evidence identity.',
      ],
    },
  ],
};
