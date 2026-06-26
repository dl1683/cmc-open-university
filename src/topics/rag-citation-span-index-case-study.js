// Citation span indexes: bind generated claims back to exact document offsets
// so RAG answers can be audited below the chunk level.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-citation-span-index-case-study',
  title: 'RAG Citation Span Index Case Study',
  category: 'AI & ML',
  summary: 'Store document ids, offsets, quoted spans, and claim links so a cited RAG answer can be inspected instead of merely trusted.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['span ledger', 'answer audit'], defaultValue: 'span ledger' },
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

function citationGraph(title) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.8, y: 3.2, note: 'source' },
      { id: 'parse', label: 'parse', x: 2.2, y: 3.2, note: 'sections' },
      { id: 'chunk', label: 'chunk', x: 3.7, y: 2.1, note: 'text' },
      { id: 'span', label: 'span', x: 3.7, y: 4.35, note: 'offset' },
      { id: 'index', label: 'index', x: 5.2, y: 3.2, note: 'id map' },
      { id: 'claim', label: 'claim', x: 6.8, y: 2.35, note: 'answer' },
      { id: 'cite', label: 'cite', x: 6.8, y: 4.15, note: 'span id' },
      { id: 'audit', label: 'audit', x: 8.5, y: 3.2, note: 'support' },
    ],
    edges: [
      { id: 'e-doc-parse', from: 'doc', to: 'parse' },
      { id: 'e-parse-chunk', from: 'parse', to: 'chunk' },
      { id: 'e-parse-span', from: 'parse', to: 'span' },
      { id: 'e-chunk-index', from: 'chunk', to: 'index' },
      { id: 'e-span-index', from: 'span', to: 'index' },
      { id: 'e-index-claim', from: 'index', to: 'claim' },
      { id: 'e-index-cite', from: 'index', to: 'cite' },
      { id: 'e-claim-audit', from: 'claim', to: 'audit' },
      { id: 'e-cite-audit', from: 'cite', to: 'audit' },
    ],
  }, { title });
}

function* spanLedger() {
  yield {
    state: citationGraph('Citation spans start at ingestion'),
    highlight: { active: ['doc', 'parse'], found: ['chunk', 'span'] },
    explanation: 'Read the span record as the missing layer beneath a citation. A chunk helps retrieval; exact coordinates let the product show and audit the sentence, row, page region, or timestamp that supports a claim.',
  };

  yield {
    state: labelMatrix(
      'Ledger record per evidence span',
      [
        { id: 's1', label: 'span 1' },
        { id: 's2', label: 'span 2' },
        { id: 's3', label: 'span 3' },
        { id: 's4', label: 'span 4' },
      ],
      [
        { id: 'doc', label: 'doc' },
        { id: 'range', label: 'range' },
        { id: 'quote', label: 'quote' },
        { id: 'state', label: 'state' },
      ],
      [
        ['refund-v4', 'L14-L18', '30 day rule', 'current'],
        ['refund-v3', 'L12-L16', '45 day rule', 'stale'],
        ['fees-v2', 'L40-L44', 'restock fee', 'current'],
        ['faq-v7', 'L08-L10', 'summary', 'derived'],
      ],
    ),
    highlight: { active: ['s1:range', 's1:quote', 's1:state'], removed: ['s2:state'] },
    explanation: 'The span ledger is smaller than the corpus but richer than a vector id. It lets the application reject stale documents, show the quoted sentence, and distinguish direct evidence from summaries or derived notes.',
    invariant: 'Every cited claim must point to a stable source span, not just a chunk rank.',
  };

  yield {
    state: citationGraph('Retrieval returns chunks plus span handles'),
    highlight: { active: ['index', 'chunk', 'span'], compare: ['claim'], found: ['cite'] },
    explanation: 'The important handoff is chunk text plus allowed span handles. The generator can cite only handles it received, which prevents polished but invented citation IDs.',
  };

  yield {
    state: labelMatrix(
      'Claim-to-span support map',
      [
        { id: 'c1', label: 'claim A' },
        { id: 'c2', label: 'claim B' },
        { id: 'c3', label: 'claim C' },
        { id: 'c4', label: 'claim D' },
      ],
      [
        { id: 'span', label: 'span id' },
        { id: 'match', label: 'match' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['s1', 'direct', 'low'],
        ['s3', 'direct', 'low'],
        ['s4', 'summary', 'med'],
        ['none', 'missing', 'high'],
      ],
    ),
    highlight: { found: ['c1:match', 'c2:match'], compare: ['c3:risk'], removed: ['c4:match', 'c4:risk'] },
    explanation: 'The support map is the bridge between RAG Evaluation and the UI. It records which answer claims are directly supported, merely summarized, contradicted, or unsupported.',
  };

  yield {
    state: citationGraph('Audit replays the evidence path'),
    highlight: { active: ['claim', 'cite', 'audit'], found: ['span'], compare: ['doc'] },
    explanation: 'A complete audit can replay the path from answer claim to citation id, source span, document version, and corpus snapshot. That makes regressions debuggable: a bad answer can be traced to ingestion, retrieval, ranking, prompt packing, or generation.',
  };
}

function* answerAudit() {
  yield {
    state: labelMatrix(
      'Answer audit checklist',
      [
        { id: 'scope', label: 'scope' },
        { id: 'quote', label: 'quote' },
        { id: 'support', label: 'support' },
        { id: 'fresh', label: 'fresh' },
        { id: 'acl', label: 'ACL' },
      ],
      [
        { id: 'question', label: 'asks' },
        { id: 'pass', label: 'pass if' },
        { id: 'fail', label: 'fail if' },
      ],
      [
        ['right corpus?', 'tenant ok', 'wrong tenant'],
        ['shown text?', 'exact span', 'chunk only'],
        ['claim true?', 'entails', 'near text'],
        ['latest doc?', 'current', 'tombstone'],
        ['allowed?', 'visible', 'leaked'],
      ],
    ),
    highlight: { active: ['quote:pass', 'support:pass', 'fresh:pass'], removed: ['scope:fail', 'acl:fail'] },
    explanation: 'The audit frame shows four separate checks: access, quote existence, claim support, and freshness. A pretty citation fails if any one of those checks fails.',
  };

  yield {
    state: citationGraph('Complete case: refund answer with citations'),
    highlight: { active: ['doc', 'span', 'index', 'claim', 'cite'], found: ['audit'] },
    explanation: 'Case study: a support assistant answers a refund question. The old policy said 45 days; the current policy says 30. The span index keeps both source versions visible, but the freshness field and corpus snapshot let the audit reject the stale citation.',
  };

  yield {
    state: labelMatrix(
      'Failure modes caught by spans',
      [
        { id: 'stale', label: 'stale doc' },
        { id: 'drift', label: 'chunk drift' },
        { id: 'middle', label: 'middle miss' },
        { id: 'wrong', label: 'wrong quote' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'span fix', label: 'span fix' },
      ],
      [
        ['old answer', 'version gate'],
        ['offset moved', 'content hash'],
        ['claim skipped', 'claim map'],
        ['nice cite', 'entail check'],
      ],
    ),
    highlight: { active: ['stale:span fix', 'drift:span fix', 'wrong:span fix'], compare: ['middle:symptom'] },
    explanation: 'Many bad citations look plausible on the surface. Span records give the system something concrete to verify: exact text, hash, version, page, section, and claim relation.',
    invariant: 'A citation is a data structure, not a decorative footnote.',
  };

  yield {
    state: labelMatrix(
      'Where the span index links',
      [
        { id: 'rag', label: 'RAG' },
        { id: 'multi', label: 'multi idx' },
        { id: 'eval', label: 'RAG eval' },
        { id: 'claims', label: 'claims' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'lesson', label: 'study next' },
      ],
      [
        ['retr spans', 'RAG Pipeline'],
        ['fuse srcs', 'Multi RAG'],
        ['scores support', 'RAG Evaluation'],
        ['audits claims', 'Claim Graph'],
      ],
    ),
    highlight: { found: ['rag:role', 'eval:role', 'claims:role'] },
    explanation: 'The same span index feeds user citations, evaluator grounding checks, provenance graphs, and production debugging. It is one of the cheapest ways to make RAG outputs inspectable.',
  };

  yield {
    state: citationGraph('Span-level citations become product UX'),
    highlight: { active: ['cite', 'span', 'doc'], found: ['audit'], compare: ['claim'] },
    explanation: 'When the user clicks a citation, the product can open the exact sentence, page region, table row, or transcript timestamp. That interaction is only possible if the data structure preserved coordinates through ingestion, retrieval, generation, and rendering.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'span ledger') yield* spanLedger();
  else if (view === 'answer audit') yield* answerAudit();
  else throw new InputError('Pick a citation span view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a provenance pipeline. Provenance means the stored evidence trail that lets a person replay where a claim came from. Active nodes are documents, spans, answer claims, and audit rows as each one receives a stable identity.',
        'The safe inference rule is that a generated claim is not cited until it points to a specific source span in a specific document version. A retrieved chunk is only a candidate. A span citation becomes evidence only when the quote, offsets, version, access scope, and support label all agree.',
        {type:'callout', text:'Span-level citation makes provenance a replayable data structure rather than a decorative link to a retrieved chunk.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, retrieves documents at answer time and places them in the model context. That helps freshness, but it does not prove attribution. A citation marker beside a sentence can point to a document that is merely related, not to the text that supports the sentence.',
        'A span-level citation index exists because many products need claim-level evidence. Legal research, support automation, medical documentation, and financial analysis all need more than a document title. They need to know which characters, sentence, row, or clause licensed the answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to cite the chunks returned by the retriever. The retriever already has chunk ids, scores, and source document ids. The answer UI can attach superscript links to those chunks with little extra infrastructure.',
        'That is a reasonable prototype. If the answer says the refund window is 30 days and the retrieved chunk contains the refund policy, the link may help a reader. The trouble starts when the chunk has several claims, old and new versions, or related text that does not entail the answer sentence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A chunk is a retrieval unit, not an evidence unit. A 512-token chunk can contain five facts, two exceptions, one stale paragraph, and a footer. Pointing to the whole chunk does not answer which sentence supports which generated claim.',
        'The wall is auditability. If a customer disputes an answer six weeks later, the system must replay the exact quote and version used at answer time. A chunk id without offsets, hash, version, and access scope cannot prove that replay.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A citation is a data structure, not a footnote. It should bind an answer claim to a source span with a document id, document version, offset range, quote hash, access-control scope, freshness state, and support label. Each field answers a concrete audit question.',
        'The useful invariant is that every displayed citation can be resolved without rerunning the model. If the corpus changes, the old answer still points to the old span version. If access rules change, the system can tell whether the user is allowed to see the evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At ingestion time, the system parses documents, creates chunks for retrieval, and also extracts smaller spans that can be cited. A span might be a sentence, table row with headers, statute clause, or paragraph slice. The span record stores text coordinates and a content hash so later checks can detect drift.',
        'At query time, retrieval brings back candidates, the generator writes an answer, and an attribution step maps answer claims to span ids. A verifier then checks whether the span directly supports, summarizes, contradicts, or fails to support the claim. The citation shown to the user is the accepted span handle, not just the retriever hit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local. If each answer claim is paired with a current, accessible span whose text entails that claim, then the answer is supportable as a set of checked claim-span relations. The system is not proving the whole world is true; it is proving the answer did not outrun its cited corpus.',
        'Versioning preserves that proof over time. A future reindex can change chunk boundaries and embeddings, but the old answer still has the original span version and hash. That makes evidence replay possible even after the live index has moved on.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Span indexing adds storage and checks. If a 100-page policy becomes 400 chunks and 2,000 citable spans, the vector index may stay near 400 records while the provenance store tracks 2,000 span records plus hashes and version metadata. The storage cost is small compared with model inference, but the schema discipline is real.',
        'Runtime cost depends on verification depth. Exact quote lookup is cheap, entailment checking may add tens or hundreds of milliseconds, and human review is slow but sometimes required. When answer volume doubles, the expensive part is usually claim-to-span verification, not span lookup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Span indexes fit products where citations are part of the contract. A legal assistant should cite the exact clause. A support bot should highlight the exact policy sentence. A compliance system should prove that the user had permission to see the cited source.',
        'They also improve evaluation. Faithfulness, citation precision, stale-source rate, and unsupported-claim rate become measurable when the evaluator sees claim-to-span rows. Without spans, teams often score an answer against a whole context window and miss the unsupported sentence inside an otherwise relevant response.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Span citation fails when the answer comes from computation rather than source text. If the system sums invoices or calculates a date, the evidence should be a computation trace, not a fake quote. It also fails when the source is live data that changes before the reader sees it unless the timestamp is part of the span.',
        'The system can still misuse spans. A topically related span is not direct support. A hidden span can leak information through an answer even if the quote is not shown. A stale span can look authoritative unless version and freshness are visible to the release gate.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A refund policy document version 4 contains the sentence from byte 847 to byte 902: Electronics may be returned within 30 days. The generated answer says, Refunds are available within 30 days for electronics. The citation row stores doc_id refund-policy, version 4, start 847, end 902, the quote hash, and support direct.',
        'Now add a second answer sentence: International returns follow the same policy. No span in version 4 says that. The verifier marks that claim unsupported, so the product can remove it, ask retrieval for more evidence, or send it to review instead of displaying a neat but false citation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lewis et al. on RAG at https://arxiv.org/abs/2005.11401, Rashkin et al. on attribution at https://aclanthology.org/2023.acl-long.134/, RAGAS at https://aclanthology.org/2024.eacl-demo.16/, and ALCE at https://arxiv.org/abs/2305.14627. These sources separate retrieval relevance from attribution quality.',
        'Study RAG pipelines first, then chunking, embeddings, claim verification, access-control filtering, and index lifecycle. The next practical step is to design the span schema before tuning the model, because weak provenance cannot be repaired by prettier answer text.',
      ],
    },
  ],
};
