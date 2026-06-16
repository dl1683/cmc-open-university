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
    explanation: 'A normal RAG index stores chunks. A citation-grade RAG index also stores exact source coordinates: document id, section path, byte or token offsets, page anchors, and the text span that can later be displayed to a reader.',
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
    explanation: 'At query time, the retriever can return chunk text for context and span handles for attribution. The generator should not invent citation ids. It chooses from the span handles it actually received.',
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
    explanation: 'Citation quality is not just formatting. The audit needs to prove the span was retrieved under the right access policy, that the quote exists, that it supports the claim, and that the document version is still valid.',
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
      heading: 'What it is',
      paragraphs: [
        'A citation span index is the provenance layer underneath a trustworthy RAG answer. Instead of treating a citation as a footnote string, it stores a stable pointer from an answer claim to the exact source span that supports it: document id, version, section, offset range, quote text, access scope, and corpus snapshot.',
        'This fills a gap between RAG Pipeline and Claim Graph & Source Ledger. RAG retrieves context; the claim graph organizes assertions; the citation span index binds those assertions to verifiable coordinates inside the source corpus. Without that binding, citations can look polished while pointing at the wrong paragraph, a stale document, or a chunk that does not actually support the claim.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At ingestion time, each parsed document produces chunks for retrieval and spans for attribution. A span may be a paragraph, sentence, table row, page region, transcript interval, or code range. The record stores source coordinates, a content hash, permissions, freshness metadata, and a normalized quote. Vector and lexical indexes may store the chunk id, but the application keeps a separate span ledger for audit and display.',
        'At generation time, the model receives retrieved context plus allowed span handles. A disciplined system asks the model to map each factual claim to one or more span handles, then checks whether the quote supports the claim. The evaluator can compute faithfulness and context precision more cleanly because it can inspect claim-level support rather than one blended answer score.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The storage overhead is modest compared with embeddings, but the engineering overhead is real. The index must survive re-chunking, document updates, OCR changes, table extraction, and access-control filtering. Byte offsets are brittle if text normalization changes, so production systems often pair offsets with content hashes, section paths, page anchors, and version ids.',
        'The payoff is operational. A bad answer can be traced to the specific source span, document version, retriever result, prompt context, and generated claim. That turns RAG debugging from subjective prompt reading into an evidence replay problem.',
      ],
    },
    {
      heading: 'Complete case study: policy assistant citations',
      paragraphs: [
        'A customer-support assistant answers refund questions from a corpus with policy PDFs, FAQ pages, and release notes. The old policy allows 45 days; the current policy allows 30. A chunk-only RAG system can retrieve both and cite whichever paragraph the generator happens to use. A span-indexed system marks the 45-day span as stale, keeps the 30-day span current, and records which answer claim cites which exact sentence.',
        'When a user challenges the answer, the UI opens the source sentence and document version. When an evaluator flags a hallucination, the support map shows whether retrieval missed the current span, ranking buried it, the generator used a stale span, or the claim had no supporting span at all. The fix can then target corpus freshness, rank fusion, reranking, context packing, index lifecycle, or generation rules instead of guessing.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A citation id is not proof. It must be checked for access scope, freshness, exact quote existence, and claim support. A source can be relevant to the topic while failing to support the sentence the answer wrote. A quote can support part of a claim while leaving a number, date, or exception unsupported.',
        'Another trap is making spans too large. A whole page citation is easy to store but hard to verify. Too-small spans can lose context, especially in tables and legal clauses. The practical design uses hierarchical coordinates: document, section, chunk, sentence, table cell, page region, or transcript interval, with links between levels.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the original RAG paper at https://arxiv.org/abs/2005.11401 and RAGAS evaluation at https://arxiv.org/abs/2309.15217. Connect this topic to RAG Claim Verification Support Ledger for claim-level support labels, RAG Evaluation: RAGAS, ARES, and the RAG Triad for faithfulness metrics, Claim Graph & Source Ledger for provenance modeling, Deep Research Agent Architecture for report synthesis, Multi-Index RAG for retrieval fusion, RAG Index Lifecycle and Alias Swap for version-safe reindexing, and Lost in the Middle for context-position failure modes.',
      ],
    },
  ],
};
