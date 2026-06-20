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
        'The span ledger view traces how a document moves from ingestion to a citable span record. The answer audit view traces how a generated claim is checked against those records.',
        {type:'callout', text:'Span-level citation makes provenance a replayable data structure rather than a decorative link to a retrieved chunk.'},
        {
          type: 'bullets',
          items: [
            'Active nodes are the document, index, or claim being processed right now.',
            'Found nodes are records whose provenance is confirmed -- the span exists, the version is current, the support label is assigned.',
            'Compare nodes are claims or spans awaiting verification -- not yet accepted, not yet rejected.',
            'Removed nodes are citations that failed an audit gate: stale source, missing quote, wrong tenant, or no entailment.',
          ],
        },
        {
          type: 'note',
          text: 'The matrix views show the span ledger and claim-to-span support map as structured records. Each row is one span or one claim. Each column is a field the system must populate for the citation to be auditable.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG solved the knowledge-freshness problem: retrieve documents at query time instead of baking facts into model weights. But retrieval created a new problem -- attribution. A generated answer can attach a citation marker to a chunk id, a page number, or a document title, and the result looks trustworthy without being verifiable.',
        {
          type: 'quote',
          text: 'Attribution requires that the generated output is supported by the identified source -- not merely that a source was retrieved or that the output sounds plausible.',
          attribution: 'Rashkin et al., "Measuring Attribution in Natural Language Generation Models" (ACL 2023)',
        },
        'The gap is between retrieval and evidence. A retrieved chunk is a search result. A cited span is a claim about which specific text supports which specific sentence in the answer. Without that second layer, the citation is a gesture at a neighborhood, not a pointer to a fact.',
        {
          type: 'table',
          headers: ['System layer', 'What it proves', 'What it does NOT prove'],
          rows: [
            ['Retrieval', 'Relevant chunks exist in the corpus', 'Which sentence supports which claim'],
            ['Generation', 'The answer uses retrieved context', 'The answer faithfully represents the source'],
            ['Chunk citation', 'The answer points to a chunk id', 'The quoted text exists, is current, or entails the claim'],
            ['Span citation', 'A specific offset range in a versioned document supports a labeled claim', 'The claim is true in the world (only that it is grounded in the corpus)'],
          ],
        },
        'Span-level citation indexes exist because the products that need RAG most -- legal research, medical documentation, enterprise policy assistants, financial analysis -- are exactly the products where "trust me, it came from somewhere in this PDF" is not acceptable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is to cite the chunks the retriever already returns. The retriever has ids. The generator saw those chunks in its context window. The UI can render a superscript that opens the source document on click.',
        {
          type: 'code',
          language: 'json',
          text: [
            '// Chunk-level citation: what most RAG prototypes ship',
            '{',
            '  "answer": "Refunds are available within 30 days.",',
            '  "citations": [',
            '    { "chunk_id": "refund-policy-chunk-7", "score": 0.91 }',
            '  ]',
            '}',
          ].join('\n'),
          label: 'A chunk-level citation points to a retrieval unit, not an evidence unit',
        },
        'This works in demos. The chunk id resolves to a document. The user sees a link. The citation feels real.',
        {
          type: 'note',
          text: 'Chunk-level citation is not stupid. It is the correct first step. The problem is that teams ship it as the last step and then discover its failure modes in production, where the cost of a wrong citation is measured in user trust, not benchmark points.',
        },
        'The failure modes are structural, not cosmetic:',
        {
          type: 'bullets',
          items: [
            'A 512-token chunk may contain five distinct claims. The citation points to all of them and none of them.',
            'Two document versions may share the same vocabulary but disagree on the number. The retriever returns both; the generator picks one; the citation does not distinguish which.',
            'A chunk may be topically related without entailing the answer sentence. "Our return policy covers electronics" does not prove "laptops can be returned within 30 days."',
            'The chunk text may have drifted after reindexing. The id is the same, but the offset range now points to a different paragraph.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a chunk is a retrieval unit optimized for recall, not an evidence unit optimized for verification. These two jobs have different granularity, different stability requirements, and different correctness criteria.',
        {
          type: 'diagram',
          text: [
            '  Query: "What is the refund window?"',
            '',
            '  Retriever returns chunk-7 (512 tokens):',
            '  +--------------------------------------------------+',
            '  | Our return policy was updated in January 2024.    |',
            '  | Electronics may be returned within 30 days.       |  <-- actual evidence',
            '  | Clothing returns require original tags.           |',
            '  | Gift cards are non-refundable.                    |',
            '  | See section 4.2 for international orders.         |',
            '  +--------------------------------------------------+',
            '',
            '  Generator writes: "Refunds are available within 30 days." [chunk-7]',
            '',
            '  Citation points to 512 tokens.',
            '  Evidence lives in 1 sentence.',
            '  The other 4 sentences are noise that passed the retrieval threshold.',
          ].join('\n'),
          label: 'A chunk citation gestures at a neighborhood; a span citation points to a sentence',
        },
        'The invariant that breaks: chunk-level citation cannot answer "which sentence in the chunk supports this specific claim?" Without that answer, auditing is manual, freshness checks operate at document granularity instead of statement granularity, and entailment verification cannot distinguish the supporting sentence from its neighbors.',
        {
          type: 'table',
          headers: ['Audit question', 'Chunk citation answer', 'Span citation answer'],
          rows: [
            ['Which sentence supports this claim?', 'Somewhere in this 512-token block', 'Bytes 847-902 of refund-policy-v4.pdf'],
            ['Is the source current?', 'The document was last indexed Tuesday', 'This sentence is in version 4; version 3 said 45 days'],
            ['Does the source entail the claim?', 'The chunk is topically related', 'NLI score 0.94 between claim and quoted span'],
            ['Can the user see this source?', 'The document is in their tenant', 'The span is in section 3.1, which their role can access'],
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A citation is a data structure with fields, not a decorative footnote with a number. The system needs a stable pointer from an answer claim to a source span, carrying enough metadata to replay the entire evidence path without rerunning the model.',
        {
          type: 'code',
          language: 'json',
          text: [
            '{',
            '  "span_id": "sp-refund-v4-s3p2",',
            '  "doc_id": "refund-policy",',
            '  "doc_version": 4,',
            '  "corpus_snapshot": "snap-2024-06-01",',
            '  "section_path": ["3. Returns", "3.1 Timeframes"],',
            '  "offset": { "start": 847, "end": 902 },',
            '  "quote": "Electronics may be returned within 30 days.",',
            '  "content_hash": "sha256:a1b2c3...",',
            '  "acl_scope": "support-tier-1",',
            '  "freshness": "current",',
            '  "extraction": "sentence-split",',
            '  "support_label": "direct"',
            '}',
          ].join('\n'),
          label: 'A span record: every field exists so a specific audit question can be answered',
        },
        'This record separates three jobs that chunk-level citation blurs together:',
        {
          type: 'table',
          headers: ['Job', 'Responsible component', 'Output'],
          rows: [
            ['Find candidates', 'Retriever', 'Chunk ids ranked by relevance'],
            ['Write claims', 'Generator', 'Answer sentences with cited span handles'],
            ['Verify support', 'Attribution checker', 'Support labels: direct, summary, contradiction, unsupported'],
          ],
        },
        'Once these jobs are separate, a citation can fail for a precise, actionable reason: stale document version, missing quote text, wrong ACL scope, weak entailment, invented span handle, or no span handle at all. Each failure type has a different fix. Conflating them into "bad citation" makes debugging impossible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The span index is built at ingestion, before any user asks a question.',
        {
          type: 'diagram',
          text: [
            '  INGESTION                    QUERY TIME                  AUDIT',
            '',
            '  doc --> parser --> chunks     query --> retriever         claim --> resolve',
            '                |               |           |               span handle',
            '                +--> spans      chunks + span handles       |',
            '                     |          |                          compare quote',
            '                     v          v                          vs. source',
            '                  span index    generator                   |',
            '                                |                          support label',
            '                                claims + cited handles      |',
            '                                |                          audit record',
            '                                attribution checker',
          ].join('\n'),
          label: 'Spans are created at ingestion, carried through retrieval, and verified after generation',
        },
        'Step 1: Parse. The ingestion pipeline turns each document into normalized text plus structure. A PDF yields pages, sections, paragraphs. A knowledge base yields articles, headings, body text. A transcript yields timestamped intervals. A table yields rows and cells. The parser preserves coordinates: byte offsets, page numbers, section paths, timestamps.',
        'Step 2: Span. The parser emits attribution spans alongside retrieval chunks. Chunks are sized for embedding and recall (typically 256-512 tokens). Spans are sized for evidence (typically a sentence, a table row, a clause, or a labeled region). One chunk may contain multiple spans. One span may cross a chunk boundary.',
        {
          type: 'table',
          headers: ['Source type', 'Chunk granularity', 'Span granularity', 'Span coordinate'],
          rows: [
            ['Prose document', '~512 tokens, paragraph-aligned', 'Sentence', 'Byte offset + section path'],
            ['PDF with tables', 'Page region', 'Table row or cell', 'Page + bounding box + row index'],
            ['FAQ / knowledge base', 'Question-answer pair', 'Answer sentence', 'Article id + paragraph index'],
            ['Audio transcript', '30-second window', 'Speaker turn or utterance', 'Timestamp interval'],
            ['Code repository', 'Function or class block', 'Statement or docstring line', 'File path + line range'],
          ],
        },
        'Step 3: Handle. Each span gets a stable identifier that survives reindexing. A bare byte offset is brittle -- OCR corrections, markdown normalization, and parser upgrades shift text. Production systems pair coordinates with content hashes, document version numbers, and corpus snapshot ids. When a document is reingested, the system can detect whether a span handle still points to the same text or has drifted.',
        'Step 4: Retrieve. At query time, the retriever returns chunks ranked by relevance plus the span handles mapped to each chunk. The generator receives chunk text for context but is constrained to cite only the span handles it was given.',
        {
          type: 'code',
          language: 'json',
          text: [
            '// Retriever output: chunks carry their allowed span handles',
            '{',
            '  "chunks": [',
            '    {',
            '      "chunk_id": "refund-policy-chunk-7",',
            '      "text": "Our return policy was updated...",',
            '      "spans": ["sp-refund-v4-s3p1", "sp-refund-v4-s3p2", "sp-refund-v4-s3p3"]',
            '    }',
            '  ]',
            '}',
          ].join('\n'),
          label: 'Each chunk carries its span handles so the generator can only cite real sources',
        },
        'Step 5: Attribute. A postprocessor extracts claims from the generated answer, resolves each cited span handle, retrieves the quoted text, and runs a support check. The support check can be a simple string match, an NLI model, or a rule-based comparator depending on the domain. The output is a support label per claim-span pair: direct, summary, partial, contradiction, or unsupported.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The useful invariant is claim-to-span replayability. For every cited factual claim in the answer, the system can answer four questions without rerunning the model:',
        {
          type: 'bullets',
          items: [
            'Which source span was cited? (span handle resolves to offset, document, version)',
            'What text did the user see as the quote? (stored quote or content hash)',
            'Which corpus version supplied it? (corpus snapshot id and document version)',
            'What support relation was asserted? (direct, summary, contradiction, unsupported)',
          ],
        },
        'If any of those answers is missing, the citation is not auditable. It may still be displayed, but no automated system can verify it and no human debugger can trace a failure.',
        {
          type: 'note',
          text: 'This does not prove the answer is true in the world. It proves a narrower and more useful property: the answer is grounded in the indexed corpus, under the user\'s permissions, under the active document versions. That is enough to debug most RAG failures and enough for most compliance requirements.',
        },
        'The replayability invariant turns a vague "bad answer" into a precise fault location:',
        {
          type: 'table',
          headers: ['Fault location', 'What the span audit reveals', 'Targeted fix'],
          rows: [
            ['Ingestion', 'Span was never created for the relevant sentence', 'Fix parser or span-splitting logic'],
            ['Retrieval', 'Correct span exists but was not in the top-k chunks', 'Tune retriever, add metadata filters, adjust chunk size'],
            ['Ranking', 'Correct chunk was retrieved but ranked below a stale one', 'Add freshness signal to reranker'],
            ['Context packing', 'Correct chunk was retrieved but truncated before the span', 'Adjust packing strategy or context window budget'],
            ['Generation', 'Correct span was in context but the model ignored or misread it', 'Adjust prompt, temperature, or model'],
            ['Attribution', 'Model cited a span handle it was not given', 'Constrain generation to received handles; filter invalid ids'],
            ['Freshness', 'Cited span exists but belongs to a superseded document version', 'Apply version gate or corpus alias filter'],
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Span records are small: ids, offsets, hashes, short quotes, and metadata. Storage cost is modest compared with embeddings and raw documents.',
        {
          type: 'table',
          headers: ['Cost center', 'What scales with', 'Typical magnitude'],
          rows: [
            ['Span storage', 'Number of source sentences across all documents', '~100 bytes per span record'],
            ['Content hashing', 'Ingestion volume', 'SHA-256 per span, negligible CPU'],
            ['Claim extraction', 'Number of answer sentences per query', '1 NLI call per claim-span pair, ~50ms each'],
            ['Support verification', 'Claims x candidate spans', 'Batch NLI or string match; 100-500ms per answer'],
            ['Lifecycle maintenance', 'Document update frequency', 'Re-hash and version-bump affected spans on each update'],
          ],
        },
        'The real cost is not storage or compute. It is lifecycle discipline. Every parser change, document update, permission rule, re-chunking job, and corpus alias swap can break provenance if the span ledger is treated as a side effect.',
        {
          type: 'note',
          text: 'Claim extraction and NLI verification add latency. For synchronous flows, budget 200-800ms per answer depending on claim count and model choice. For async flows (email, report generation, batch evaluation), the latency is invisible. Design the pipeline to run attribution as a post-step that can be async without blocking the answer.',
        },
        'Span granularity is a design tradeoff. Very small spans (sub-sentence clauses) increase precision but may lack context for NLI verification. Very large spans (full paragraphs) are easy to extract but provide weak evidence. Sentence-level spans are the pragmatic default for prose; row-level for tables; utterance-level for transcripts.',
        'The behavior scales with the number of cited claims, not with corpus size. A short answer with two factual claims is cheap to audit. A long research report with 200 assertions needs batching, sampling, tiered verification, and a source ledger that can express partial support.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A customer-support assistant answers refund questions from policy PDFs, FAQ pages, release notes, and internal macros. The old refund policy (v3) allowed 45 days. The current policy (v4) allows 30 days.',
        {
          type: 'diagram',
          text: [
            '  Corpus state:',
            '  +-- refund-policy-v3.pdf  (stale, superseded 2024-01-15)',
            '  |     L12-L16: "Returns accepted within 45 calendar days"',
            '  |',
            '  +-- refund-policy-v4.pdf  (current, effective 2024-01-15)',
            '  |     L14-L18: "Returns accepted within 30 calendar days"',
            '  |',
            '  +-- fees-v2.pdf  (current)',
            '  |     L40-L44: "A 15% restocking fee applies to opened electronics"',
            '  |',
            '  +-- faq-v7.html  (current, derived from policy)',
            '        Q8: "How long do I have to return an item?" -> summary of v4',
          ].join('\n'),
          label: 'Two policy versions coexist in the corpus with overlapping vocabulary',
        },
        'A chunk-level system retrieves both policy versions because they share vocabulary. The generator picks the stale chunk and writes: "Refunds are available within 45 days." The citation points to refund-policy-chunk-12. The answer looks correct. The citation looks real. Both are wrong.',
        'A span-indexed system stores four span records:',
        {
          type: 'table',
          headers: ['Span', 'Document', 'Range', 'Quote', 'Freshness'],
          rows: [
            ['sp-refund-v4-s3p2', 'refund-policy-v4', 'L14-L18', 'Returns accepted within 30 calendar days', 'current'],
            ['sp-refund-v3-s3p2', 'refund-policy-v3', 'L12-L16', 'Returns accepted within 45 calendar days', 'stale'],
            ['sp-fees-v2-s5p1', 'fees-v2', 'L40-L44', 'A 15% restocking fee applies to opened electronics', 'current'],
            ['sp-faq-v7-q8', 'faq-v7', 'Q8', 'You have 30 days to return most items', 'current (derived)'],
          ],
        },
        'When the generator writes "Refunds are available within 30 days" and cites sp-refund-v4-s3p2, the audit confirms: the span exists, the quote matches, the document is current, the support label is direct. If the generator instead writes "45 days" and cites sp-refund-v3-s3p2, the audit catches it: the span exists but fails the freshness gate.',
        {
          type: 'code',
          language: 'json',
          text: [
            '// Claim-to-span support map after attribution check',
            '{',
            '  "claims": [',
            '    {',
            '      "text": "Refunds are available within 30 days.",',
            '      "span_id": "sp-refund-v4-s3p2",',
            '      "support": "direct",',
            '      "freshness": "current",',
            '      "audit": "PASS"',
            '    },',
            '    {',
            '      "text": "A restocking fee of 15% applies.",',
            '      "span_id": "sp-fees-v2-s5p1",',
            '      "support": "direct",',
            '      "freshness": "current",',
            '      "audit": "PASS"',
            '    },',
            '    {',
            '      "text": "International returns follow the same policy.",',
            '      "span_id": null,',
            '      "support": "unsupported",',
            '      "freshness": null,',
            '      "audit": "FAIL -- no span handle cited"',
            '    }',
            '  ]',
            '}',
          ].join('\n'),
          label: 'Each claim in the answer gets a concrete audit result, not a vague confidence score',
        },
        'The third claim -- "International returns follow the same policy" -- has no span handle. The system flags it as unsupported. An evaluator or product rule can decide whether to suppress it, flag it for human review, or let it through with a warning. The decision is informed, not blind.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Span-level citation indexes earn their complexity in domains where provenance is part of the product contract, not an optional feature.',
        {
          type: 'table',
          headers: ['Domain', 'Why span-level citation matters', 'What breaks without it'],
          rows: [
            ['Legal research', 'Attorneys need the exact statute, subsection, and clause', 'Citing "Title 17" instead of "17 USC 107(1)" is professionally useless'],
            ['Medical documentation', 'Clinical decision support must trace to specific guidelines', 'A wrong dosage citation can cause patient harm'],
            ['Enterprise policy assistants', 'HR and compliance answers must cite the current policy version', 'Stale policy citations create liability'],
            ['Financial analysis', 'SEC filings, earnings transcripts must be cited to the specific line', 'Vague citations fail regulatory audit'],
            ['Support automation', 'Customers clicking a citation should see the exact sentence', 'Landing on page 1 of a 40-page PDF erodes trust'],
            ['Deep research agents', 'Multi-hop synthesis across dozens of sources needs provenance per claim', 'Without span-level tracking, the research chain is not reproducible'],
          ],
        },
        'Span indexes also serve evaluation infrastructure. Metrics like faithfulness, context precision, and answer correctness become concrete when the evaluator can inspect claim-level support rather than scoring an entire answer against an entire context window.',
        {
          type: 'note',
          text: 'The span ledger is shared infrastructure. The same records serve user-facing citations, offline evaluation scoring, regression test suites, source freshness checks, access control audits, and production debugging. Building it once pays off across all these surfaces.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A span index is the wrong tool when the system cannot define a stable source text.',
        {
          type: 'table',
          headers: ['Situation', 'Why spans fail', 'Better alternative'],
          rows: [
            ['Computed answers (math, aggregation)', 'No source sentence to cite -- the answer comes from computation', 'Show the computation trace, not a fake quote'],
            ['Synthesis across many weak signals', 'No single span is the evidence; the aggregate is', 'Show the top contributing spans as partial support, not proof'],
            ['Reasoning traces', 'The model\'s chain of thought is not a source document', 'Distinguish reasoning from citation; do not conflate them'],
            ['Redacted or classified sources', 'The user cannot see the cited text', 'Show the support label and metadata without the quote'],
            ['Rapidly changing data (stock prices, live feeds)', 'The span is stale by the time the user reads it', 'Timestamp the span and show staleness explicitly'],
          ],
        },
        'The deeper failure mode is treating support labels as decoration. If every citation renders the same superscript regardless of whether support is direct, summary, contradicted, or missing, users learn to trust the shape of a citation instead of the quality of the evidence.',
        {
          type: 'bullets',
          items: [
            'Direct support should look different from a summary in the UI.',
            'Contradicted sources should be flagged, not hidden.',
            'Unsupported claims should be visually distinct from supported ones.',
            'Stale citations should carry a warning, not just a date buried in metadata.',
          ],
        },
        {
          type: 'quote',
          text: 'A citation that cannot be wrong is not a citation. It is a decoration.',
          attribution: 'Design principle for auditable RAG systems',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Covers'],
          rows: [
            ['Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (NeurIPS 2020)', 'The RAG architecture that created the citation problem'],
            ['Rashkin et al., "Measuring Attribution in Natural Language Generation Models" (ACL 2023)', 'Formal definition of attribution and the AIS (Attributable to Identified Sources) framework'],
            ['Es et al., "RAGAs: Automated Evaluation of Retrieval Augmented Generation" (EACL 2024)', 'Faithfulness, context precision, and answer correctness metrics that depend on source-level grounding'],
            ['Gao et al., "ALCE: Evaluating Attribution in Large Language Models" (2023)', 'Benchmark for fine-grained citation quality in LLM outputs'],
            ['Liu et al., "Lost in the Middle" (2023)', 'Context-position effects that span-level tracking cannot fix alone'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: RAG Pipeline -- understand the retrieval-generation loop before adding attribution on top.',
            'Extension: RAG Evaluation -- faithfulness and context precision metrics use span-level grounding.',
            'Related: Multi-Index RAG -- fusing sources from multiple indexes makes span provenance harder and more important.',
            'Deeper: Claim Graph and Source Ledger -- assertion-level provenance across multi-hop reasoning chains.',
            'Contrast: RAG Index Lifecycle and Alias Swap -- version-safe reindexing that keeps span handles stable.',
            'Failure mode: Lost in the Middle -- context-position effects that make the generator ignore correctly retrieved spans.',
          ],
        },
      ],
    },
  ],
};

