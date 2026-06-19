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
        "Read the animation as the execution trace for RAG Citation Span Index Case Study. Store document ids, offsets, quoted spans, and claim links so cited RAG answers can be audited below the chunk level..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Retrieval-augmented generation exists because a model\'s parameters are a poor place to store every fact a product needs. A RAG system retrieves documents at answer time, places relevant context in the prompt, and asks the model to generate from that evidence. That reduces some hallucination risk and makes knowledge updates possible without retraining the model.`,
        `The citation problem starts after retrieval succeeds. A generated answer can include a citation marker that looks trustworthy while pointing only to a chunk id, a page, or a broad document. That may be enough for a demo, but it is not enough for a product where users, evaluators, auditors, and support engineers need to inspect exactly which sentence, table row, clause, code range, or transcript interval supports each claim.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is to cite the retrieved chunks. The retriever already returns ids. The generator already saw those chunks. The UI can show a superscript beside a sentence and open the source document when the user clicks it. This is simple, cheap, and often good enough for a prototype.`,
        `The wall is that a chunk is a retrieval unit, not an evidence unit. A chunk may contain several claims, stale text, contradictory exceptions, boilerplate, or a paragraph that is topically related but does not entail the answer sentence. If the answer says "refunds are allowed within 30 days", a citation to a full policy page does not prove the number, the condition, the date, or the absence of a hidden exception.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A citation is a data structure, not a decorative footnote. The system should store a stable pointer from an answer claim to a source span with enough metadata to replay the evidence path. A practical record includes document id, document version, corpus snapshot, section path, offset range, quote text or hash, access scope, extraction method, freshness state, and a support label such as direct, summary, contradiction, or unsupported.`,
        `This separates three jobs that are often blurred together. Retrieval finds candidate context. Generation writes claims. Attribution binds those claims to exact spans that can be checked. Once those jobs are separate, a citation can fail for a precise reason: no visible source, stale document, missing quote, wrong span, weak entailment, or generated claim with no support.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The index starts at ingestion, before any user asks a question. A parser turns documents into normalized text plus structure: pages, headings, paragraphs, tables, cells, figures, transcript timestamps, or code ranges. Retrieval chunks are created for search, but attribution spans are stored separately. They may be sentence-level for prose, row-level for tables, page-region-level for PDFs, or interval-level for audio transcripts.`,
        `Each span receives a stable handle. A byte offset is useful, but offsets alone are brittle because OCR, markdown conversion, and parser upgrades can move text around. Production systems usually pair coordinates with content hashes, document versions, section paths, source URIs, and corpus snapshot ids. That way a span can be revalidated after reindexing instead of silently drifting to a nearby paragraph.`,
        `At query time, retrieval returns chunks plus the span handles allowed for those chunks. The generator can be instructed to attach factual claims only to handles it received. A postprocessor can then extract claims, resolve the cited handles, compare the generated sentence against the quoted span, and mark the support relation. The point is not to make the model honest by prompt alone. The point is to give the system something concrete to verify.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The useful invariant is claim-to-span replayability. For every cited factual claim, the system should be able to answer four questions without rerunning the model: which source span was cited, what text was visible to the user, which corpus version supplied it, and what kind of support relation was asserted. If any of those answers is missing, the citation is not auditable.`,
        `This does not prove the answer is true in a philosophical sense. It proves a narrower and more useful property: the product can inspect whether the answer is grounded in the indexed corpus under the user\'s permissions and under the active document versions. That is enough to debug most RAG failures. A bad answer becomes traceable to ingestion, retrieval, ranking, context packing, generation, citation formatting, or support verification.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The storage cost is usually modest compared with embeddings and raw documents. Span records are mostly ids, ranges, hashes, short quotes, and metadata. The real cost is lifecycle discipline. Every parser change, document update, permission rule, re-chunking job, and alias swap can break provenance if the span ledger is treated as an afterthought.`,
        `There is also runtime cost. Claim extraction and support checks add latency if they run synchronously. Entailment models can be expensive and imperfect. Very small spans may need surrounding context to verify a clause; very large spans make verification weak. Tables, OCR noise, images, formulas, footnotes, and legal cross-references all complicate the idea of an exact supporting span.`,
        `The behavior scales with the number of cited claims, not only with the number of retrieved chunks. A short answer with two factual claims is cheap to audit. A long report with hundreds of assertions needs batching, sampling, caching, and a source ledger that can explain partial support instead of forcing every sentence into a binary pass or fail.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a customer-support assistant answering refund questions from policy PDFs, FAQ pages, release notes, and internal macros. The old refund policy allowed 45 days. The current policy allows 30 days. A chunk-only system may retrieve both because they share the same vocabulary. The generator may answer from the stale chunk and cite it cleanly.`,
        `A span-indexed system can keep both documents while marking their versions and freshness states. The 45-day sentence remains a real span, but it is stale under the active corpus alias. The 30-day sentence is current. When the answer claims "refunds are available for 30 days", the support map can point to the exact current sentence. If the answer says 45 days, the audit can say the citation exists but fails the freshness gate.`,
        `This improves both product UX and engineering diagnosis. A user who clicks the citation lands on the highlighted sentence, not a broad page. An evaluator who flags the answer can see whether retrieval missed the current span, ranking placed it below the stale one, prompt packing dropped it, the generator ignored it, or the support checker was too permissive. The fix becomes targeted instead of a vague prompt rewrite.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Citation span indexes are strongest in domains where provenance is part of the product contract: support automation, legal research, policy assistants, enterprise search, scientific review, incident reports, medical documentation workflows, financial research, and deep research agents. In these systems, the answer is not useful merely because it sounds plausible. It must show where each important claim came from.`,
        `They also help evaluation. Metrics such as faithfulness, context precision, and answer correctness become easier to reason about when the evaluator can inspect claim-level support. The span ledger becomes shared infrastructure for user citations, offline scoring, regression tests, source freshness checks, and operational debugging.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A span index is not useful when the system cannot define a stable source. Some answers are based on computation, synthesis across many weak signals, private reasoning traces, or data that the user is not allowed to see directly. In those cases, a citation span can mislead by pretending there is one decisive quote.`,
        `It also fails if the product treats support labels as decoration. A citation should distinguish direct evidence from a summary, a related passage, a contradiction, and missing support. If every marker renders the same in the UI, users learn the wrong lesson. They start trusting citation shape instead of evidence quality.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks at https://arxiv.org/abs/2005.11401 and RAGAs: Automated Evaluation of Retrieval Augmented Generation at https://aclanthology.org/2024.eacl-demo.16/. Study RAG Pipeline for the retrieval-generation loop, Multi-Index RAG for source fusion, RAG Evaluation for faithfulness metrics, Claim Graph & Source Ledger for assertion provenance, RAG Index Lifecycle and Alias Swap for version-safe reindexing, and Lost in the Middle for context-position failures that a citation ledger cannot fix by itself.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for rag-citation-span-index-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

