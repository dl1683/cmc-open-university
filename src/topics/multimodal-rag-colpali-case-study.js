// Multimodal RAG and visual document retrieval: retrieve page images, tables,
// charts, and layout-aware evidence instead of relying only on OCR text chunks.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'multimodal-rag-colpali-case-study',
  title: 'Multimodal RAG & ColPali Case Study',
  category: 'AI & ML',
  summary: 'How multimodal RAG retrieves page images, tables, charts, and layout-aware evidence with CLIP-style encoders and ColPali late interaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['visual document retrieval', 'fusion and evaluation'], defaultValue: 'visual document retrieval' },
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

function visualPipeline(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.65, note: 'text ask' },
      { id: 'qenc', label: 'T enc', x: 2.45, y: 4.15, note: 'tokens' },
      { id: 'pages', label: 'pages', x: 0.9, y: 1.7, note: 'images' },
      { id: 'venc', label: 'V enc', x: 2.65, y: 2.2, note: 'patches' },
      { id: 'late', label: 'late int', x: 4.8, y: 2.7, note: 'MaxSim' },
      { id: 'rank', label: 'rank', x: 6.4, y: 2.7, note: 'page top-k' },
      { id: 'crop', label: 'crop', x: 7.9, y: 1.6, note: 'evidence' },
      { id: 'answer', label: 'answer', x: 9.1, y: 3.6, note: 'grounded' },
    ],
    edges: [
      { id: 'e-query-qenc', from: 'query', to: 'qenc' },
      { id: 'e-pages-venc', from: 'pages', to: 'venc' },
      { id: 'e-qenc-late', from: 'qenc', to: 'late' },
      { id: 'e-venc-late', from: 'venc', to: 'late' },
      { id: 'e-late-rank', from: 'late', to: 'rank' },
      { id: 'e-rank-crop', from: 'rank', to: 'crop' },
      { id: 'e-rank-answer', from: 'rank', to: 'answer' },
      { id: 'e-crop-answer', from: 'crop', to: 'answer' },
    ],
  }, { title });
}

function fusionGraph(title) {
  return graphState({
    nodes: [
      { id: 'text', label: 'OCR', x: 1.0, y: 1.8, note: 'words' },
      { id: 'vision', label: 'vision', x: 1.0, y: 3.4, note: 'layout' },
      { id: 'tables', label: 'tables', x: 1.0, y: 5.0, note: 'cells' },
      { id: 'entity', label: 'graph', x: 3.0, y: 5.0, note: 'links' },
      { id: 'fusion', label: 'fusion', x: 4.9, y: 3.4, note: 'merge' },
      { id: 'rerank', label: 'rerank', x: 6.7, y: 3.4, note: 'judge' },
      { id: 'prompt', label: 'prompt', x: 8.6, y: 3.4, note: 'citations' },
    ],
    edges: [
      { id: 'e-text-fusion', from: 'text', to: 'fusion' },
      { id: 'e-vision-fusion', from: 'vision', to: 'fusion' },
      { id: 'e-tables-entity', from: 'tables', to: 'entity' },
      { id: 'e-entity-fusion', from: 'entity', to: 'fusion' },
      { id: 'e-fusion-rerank', from: 'fusion', to: 'rerank' },
      { id: 'e-rerank-prompt', from: 'rerank', to: 'prompt' },
    ],
  }, { title });
}

function* visualDocumentRetrieval() {
  yield {
    state: visualPipeline('Visual document retrieval embeds page images'),
    highlight: { active: ['query', 'qenc', 'pages', 'venc'], compare: ['late'] },
    explanation: 'Read this as expanding the evidence surface. Text chunks catch words, but rendered pages preserve layout, tables, marks, figures, and visual relationships that OCR can flatten.',
  };

  yield {
    state: labelMatrix(
      'Why OCR-only retrieval misses evidence',
      [
        { id: 'table', label: 'pricing table' },
        { id: 'chart', label: 'trend chart' },
        { id: 'form', label: 'checkbox form' },
        { id: 'layout', label: 'two-column PDF' },
      ],
      [
        { id: 'ocr', label: 'text chunk' },
        { id: 'visual', label: 'visual page' },
      ],
      [
        ['cell order breaks', 'rows and columns visible'],
        ['caption only', 'shape carries answer'],
        ['labels detached', 'mark and label aligned'],
        ['reading order wrong', 'page geometry preserved'],
      ],
    ),
    highlight: { active: ['table:visual', 'chart:visual', 'form:visual'], compare: ['layout:ocr'] },
    explanation: 'The core problem is not that OCR is useless. It is that documents communicate through geometry. A page image preserves relationships that text extraction can scramble or omit.',
    invariant: 'Multimodal RAG should preserve evidence layout until the answer is grounded.',
  };

  yield {
    state: visualPipeline('ColPali adapts late interaction to page images'),
    highlight: { active: ['venc', 'late', 'rank', 'e-venc-late', 'e-qenc-late', 'e-late-rank'], found: ['crop'] },
    explanation: 'The ColPali frame mirrors ColBERT in visual space: a query can match different page patches, so a table, label, checkbox, or figure can contribute to the page score.',
  };

  yield {
    state: labelMatrix(
      'Document retriever spectrum',
      [
        { id: 'ocr', label: 'OCR + BM25' },
        { id: 'dense', label: 'OCR + dense' },
        { id: 'colpali', label: 'ColPali page' },
        { id: 'vlm', label: 'full VLM read' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['exact text', 'low'],
        ['semantic text', 'medium'],
        ['layout-aware retrieval', 'medium-high'],
        ['rich reasoning', 'high'],
      ],
    ),
    highlight: { active: ['colpali:strength', 'colpali:cost'], compare: ['ocr:strength', 'vlm:cost'] },
    explanation: 'A practical stack uses cheaper retrieval to find candidate pages, then spends expensive vision-language reasoning on a small evidence set instead of every page.',
  };
}

function* fusionAndEvaluation() {
  yield {
    state: fusionGraph('Multimodal RAG fuses several evidence surfaces'),
    highlight: { active: ['text', 'vision', 'tables', 'entity', 'fusion', 'e-text-fusion', 'e-vision-fusion', 'e-entity-fusion'], found: ['prompt'] },
    explanation: 'Production multimodal RAG is usually hybrid. OCR text handles exact words. Vision embeddings handle page layout. Table extraction gives structured cells. Entity graphs preserve cross-document references.',
  };

  yield {
    state: labelMatrix(
      'Fusion policy by evidence type',
      [
        { id: 'caption', label: 'caption question' },
        { id: 'cell', label: 'cell lookup' },
        { id: 'chart', label: 'visual trend' },
        { id: 'cross', label: 'cross-page fact' },
      ],
      [
        { id: 'first', label: 'first retriever' },
        { id: 'second', label: 'second check' },
      ],
      [
        ['text/BM25', 'page visual'],
        ['table parser', 'page crop'],
        ['vision retriever', 'VLM answer'],
        ['entity graph', 'multimodal rerank'],
      ],
    ),
    highlight: { active: ['cell:first', 'chart:first', 'cross:first'], found: ['caption:second'] },
    explanation: 'The routing table is the practical lesson. A chart question, table-cell question, and exact-ID question should not all take the same retrieval path.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'retrieved pages inspected', min: 0, max: 20 }, y: { label: 'answer success', min: 0, max: 1.0 } },
      series: [
        { id: 'ocr', label: 'OCR-only', points: [{ x: 1, y: 0.34 }, { x: 5, y: 0.50 }, { x: 10, y: 0.58 }, { x: 20, y: 0.61 }] },
        { id: 'multi', label: 'multimodal', points: [{ x: 1, y: 0.47 }, { x: 5, y: 0.68 }, { x: 10, y: 0.77 }, { x: 20, y: 0.79 }] },
      ],
    }),
    highlight: { active: ['multi'], compare: ['ocr'] },
    explanation: 'Multimodal retrieval should be judged end to end: did the system retrieve the right page or region, did the model inspect it, and did the final answer cite the right evidence?',
  };

  yield {
    state: labelMatrix(
      'Evaluation checklist',
      [
        { id: 'page', label: 'page recall' },
        { id: 'region', label: 'region grounding' },
        { id: 'modality', label: 'modality attribution' },
        { id: 'answer', label: 'answer faithfulness' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'failure', label: 'failure found' },
      ],
      [
        ['was right page found?', 'retrieval miss'],
        ['was right crop used?', 'weak grounding'],
        ['text/table/image?', 'wrong tool path'],
        ['does answer follow evidence?', 'hallucination'],
      ],
    ),
    highlight: { found: ['page:asks', 'region:asks', 'answer:asks'], active: ['modality:failure'] },
    explanation: 'A benchmark that only grades final answer text can hide retrieval failures. Multimodal systems need page, region, modality, and answer-level evidence so teams know which layer failed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'visual document retrieval') yield* visualDocumentRetrieval();
  else if (view === 'fusion and evaluation') yield* fusionAndEvaluation();
  else throw new InputError('Pick a multimodal RAG view.');
}

export const article = {
  sections: [
    {
      heading: 'Why multimodal RAG exists',
      paragraphs: [
        'Multimodal RAG exists because many documents do not store their meaning as plain paragraphs. Policies, invoices, scientific papers, medical forms, engineering drawings, slides, dashboards, and regulatory exhibits communicate through layout, tables, figures, checkboxes, visual marks, captions, row and column alignment, and page position. A text-only RAG pipeline can extract words from those documents and still lose the fact that mattered. The answer may be encoded by a tick mark next to a label, a trend line crossing a threshold, a table cell under a grouped header, or a figure referenced from a footnote.',
        'The core data-structure change is that evidence is no longer one list of text chunks. A robust system keeps linked surfaces: OCR tokens, page images, image patches, table cells, chart regions, bounding boxes, captions, document metadata, permissions, embeddings, and cross-page references. Retrieval becomes a fusion problem over multiple evidence types. The system is not trying to make vision replace text. It is trying to preserve the original document geometry long enough for the final answer to be grounded in the actual evidence.',
      ],
    },
    {
      heading: 'What OCR-only retrieval misses',
      paragraphs: [
        'The naive design is familiar: run OCR, split extracted text into chunks, embed each chunk, and retrieve by vector similarity or BM25. This works for clean prose. It fails when document structure is the carrier of meaning. OCR can flatten a pricing table so the row label, column header, and value become neighbors without preserving their relationship. It can detach a checkbox from the label it modifies. It can extract a chart caption but not the slope, peak, or outlier shown in the plot. It can scramble two-column PDFs or footnotes into the wrong reading order.',
        'The opposite naive design is to send every page image to a vision-language model at answer time. That is too expensive, too slow, and too hard to audit at scale. A thousand-page document library cannot be reread visually for every question. Multimodal RAG is the middle path: retrieve cheaply and broadly across text, layout, tables, and vision; narrow the candidate set; then spend expensive visual reasoning on a small number of pages or regions. The retrieval layer must therefore know which modality is likely to carry the answer.',
      ],
    },
    {
      heading: 'The ColPali mechanism',
      paragraphs: [
        'ColPali adapts the late-interaction idea from ColBERT to visually rich document retrieval. In ColBERT, a passage is represented as many token vectors instead of one pooled vector, and each query token finds its best matching passage token. ColPali moves that idea into page-image retrieval. Pages are rendered and encoded by a vision-language model into multiple patch-level or token-level representations. A text query is also encoded as multiple query vectors. Scoring uses multi-vector interaction, so different parts of the question can match different visual regions on the page.',
        'This matters because a page is not a sentence. A query about a deductible table may need one query token to match the table title, another to match the plan tier, and another to match the dollar amount region. A single pooled page vector can blur those signals. A full vision-language read of every page is too costly. Late interaction preserves reusable page computation while still letting query terms seek fine-grained support. CLIP-style contrastive learning established shared image-text representation as a foundation: https://arxiv.org/abs/2103.00020. ColPali applies this retrieval shape to document pages: https://arxiv.org/abs/2407.01449.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The visual document retrieval pipeline proves that the evidence surface has expanded. The query is text, but the candidate evidence can be OCR text, page images, patches, tables, or regions. The page image branch preserves layout that text extraction can destroy. The late-interaction node is the key scoring step: it allows the query to find support across multiple visual patches rather than forcing the page into one global embedding. The crop node reminds us that the final answer should inspect and cite the relevant region, not merely name a document.',
        'The fusion view proves that multimodal RAG is a routing problem. A caption question should start with text. A table-cell lookup should start with a table parser and verify against a page crop. A trend question should favor visual retrieval. A cross-page entity question may need a graph or metadata index before a reranker. The evaluation table proves that final answer accuracy is not enough. A system can answer correctly while citing the wrong region, retrieve the right page but miss the crop, or choose the wrong modality and accidentally succeed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because documents often contain redundant evidence across modalities. The phrase in a heading, the position of a value in a table, the caption under a chart, and the region selected by a visual retriever can reinforce one another. Text retrieval supplies exact terms and identifiers. Vision retrieval supplies layout and visual similarity. Table extraction supplies structured cells. Entity graphs supply cross-document links. A reranker can combine these signals and ask which candidate actually supports the question.',
        'The architecture also works economically. Vision-language models are expensive, but retrieval can make their use targeted. A ColPali-style page index or hybrid retriever can find the top pages, then a smaller final context can include crops, OCR spans, table cells, and coordinates. This gives the answer model enough evidence without forcing it to read the whole corpus visually. The design resembles other multi-stage retrieval systems: cheap recall first, more expensive precision later, and answer generation only after evidence has been narrowed.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is higher than text-only RAG. Page images are larger than text chunks. Vision encoders are slower than text encoders. Multi-vector indexes are larger than single-vector indexes. Region grounding requires coordinate metadata and often image crops. Updating a corpus requires rerendering, re-embedding, reindexing, and invalidating stale page versions. Product quantization, residual compression, batching, caching, and careful top-k limits become necessary when a corpus reaches millions of pages.',
        'The operational tradeoff is also harder. Text chunks are easy to quote. Visual evidence needs page numbers, bounding boxes, crop images, and sometimes table coordinates. Authorization must be enforced at the document, page, and region level. Evaluation data is more expensive because labels may need page, region, modality, and answer annotations. Latency budgets must decide when to use OCR-only retrieval, when to add ColPali-style visual retrieval, when to invoke a full vision-language model, and when to fall back to a human review flow.',
      ],
    },
    {
      heading: 'Evaluation and grounding',
      paragraphs: [
        'A useful benchmark separates the pipeline into page recall, region recall, evidence attribution, answer faithfulness, and citation quality. If the system retrieves the right PDF but not the right crop, the retrieval layer still failed for a visual question. If it answers correctly from prior knowledge while citing an unrelated region, the answer layer failed even though the final string looked right.',
        'Production systems should store evidence objects, not just answer text. A good evidence object contains document id, page number, crop coordinates, OCR spans, table coordinates when available, modality source, retriever score, reranker score, permissions, and version. That record lets reviewers see where the answer came from and lets engineers debug whether a miss was caused by OCR, visual retrieval, fusion, ranking, or generation.',
      ],
    },
    {
      heading: 'Where it helps and where it fails',
      paragraphs: [
        'Multimodal RAG is useful for benefits policies, contracts with exhibits, medical forms, insurance claims, financial statements, slide decks, product manuals, scanned archives, compliance packets, scientific papers, and customer-support screenshot libraries. It is especially strong when the question asks about a visual relationship: which box is selected, which line crosses a threshold, which row and column intersect, which diagram part is labeled, or which page region proves a claim.',
        'It fails when teams treat vision as a substitute for retrieval discipline. Sending whole PDFs to a model is expensive and can hide unsupported answers. OCR is still necessary for exact names, IDs, citations, and keyword filters. Visual retrievers can overmatch pages that look similar but contain the wrong value. Table extraction can hallucinate structure from messy scans. A model may answer from prior knowledge while citing the wrong page. The benchmark must expose these layers separately: page recall, region grounding, modality attribution, citation correctness, and final answer faithfulness.',
        'Study Embeddings and Similarity, RAG Pipeline, ColBERT Late-Interaction Retrieval, Cross-Encoder Reranker, Product Quantization, Block-Max WAND Top-K Retrieval, Query Expansion, RAG Citation Span Index, RAG Claim Verification Support Ledger, GraphRAG Community Summary, Table Extraction, and Authorization Graphs next. The durable lesson is to keep the evidence object rich enough that the system can explain not only what it answered, but which modality and which region justified the answer.',
      ],
    },
  ],
};
