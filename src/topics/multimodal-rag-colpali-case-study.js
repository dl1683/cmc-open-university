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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each page as a stored evidence object, not as a paragraph with decoration. OCR means optical character recognition, the process that turns pixels into text; a page image keeps the layout, table lines, figures, and marks that OCR may flatten.',
        'The active path shows where the query is being encoded and compared. A safe inference is that a page can be promoted only when the retrieved visual region or text span can be tied back to a document id, page number, and crop.',
        {type:'callout', text:'Multimodal RAG works when retrieval preserves linked evidence surfaces instead of flattening every document into text chunks.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG means retrieval augmented generation: the system retrieves evidence and gives it to a model before the model answers. Text-only RAG breaks on documents where the answer lives in a chart shape, a checked box, a table coordinate, or the relation between a caption and a figure.',
        'ColPali exists because many business and research documents are page layouts first and text streams second. It indexes rendered pages so retrieval can use the visual document itself before a costly vision-language model reads a small candidate set.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run OCR on every page, split the text into chunks, embed each chunk, and retrieve the nearest chunks for a question. That works for clean prose because the answer remains in word order after extraction.',
        'A second obvious approach is to send every page image to a vision-language model at answer time. That preserves layout, but it makes every query pay the cost of visually reading the whole corpus.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'OCR can detach a value from the row and column that define it. A claim such as plan B deductible is 750 dollars can become a pile of nearby tokens where B, deductible, and 750 no longer have a reliable relation.',
        'Full visual reading hits a cost wall. If a corpus has 10,000 pages and a question needs 5 pages, reading all 10,000 pages burns latency and tokens on 9,995 pages that cannot affect the answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is late interaction over page images. Late interaction means the query and the document keep multiple vectors instead of one pooled vector, so different query terms can match different page patches.',
        'A page is then scored as a set of local matches. A deductible question can match the table title, the plan column, and the dollar cell separately, which is closer to how a reader uses the page.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each document page is rendered to an image and encoded into many visual token vectors. The query is encoded into query token vectors, and scoring compares each query vector with its best matching page vectors.',
        'The retriever returns top pages or regions, not a final answer. The answer model then sees a small evidence packet with page crops, OCR spans, coordinates, and source metadata.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is evidence preservation. If the index keeps page identity, visual layout, and crop coordinates, then a retrieved candidate can be checked against the original page instead of trusted as loose text.',
        'Late interaction is also monotonic in the useful sense that adding a relevant local match can raise a page score without forcing the whole page into one average vector. The answer is trustworthy only when the final citation points to the region that made the score meaningful.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is larger indexes and slower retrieval than plain text embeddings. If each page stores 1,024 visual vectors of 128 dimensions at 2 bytes per value, one page needs about 256 KB before compression; 100,000 pages need about 25.6 GB.',
        'Cost changes behavior. Teams add compression, page-level top-k limits, caching, and reranking because a visual index can improve recall while still becoming too expensive to scan broadly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This fits insurance forms, annual reports, scientific PDFs, slide decks, invoices, product manuals, and compliance packets. The common pattern is that the answer depends on a visual relation that text extraction alone cannot guarantee.',
        'It is also useful when auditability matters. A reviewer can inspect the cited crop and decide whether the model used the right row, figure, or checkbox instead of trusting a generated sentence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat page retrieval as proof. A visually similar page can have the wrong value, and a model can still answer from prior knowledge while citing the wrong crop.',
        'It is also the wrong first tool for clean text corpora. If the documents are plain HTML articles or normalized records, a text index is cheaper, easier to quote, and easier to secure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a benefits PDF has 400 pages and the user asks for the out-of-network deductible for plan B. OCR retrieval returns chunks from 20 pages because the words plan, deductible, and out-of-network appear everywhere.',
        'A ColPali-style index retrieves 6 candidate pages and the best crop is a table region where the plan B column intersects the out-of-network row. If the final model reads only those 6 pages, the visual read cost falls by about 98.5 percent while the evidence keeps the table coordinate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ColPali at https://arxiv.org/abs/2407.01449, ColBERTv2 at https://arxiv.org/abs/2112.01488, and CLIP at https://arxiv.org/abs/2103.00020. Study these to understand why multi-vector retrieval trades space for better matching.',
        'Study RAG Pipeline, Embeddings and Similarity, ColBERT Late-Interaction Retrieval, Cross-Encoder Reranker, Product Quantization, Table Extraction, and RAG Citation Span Index next. The key follow-up question is how to prove that a cited crop supports the generated claim.',
      ],
    },
  ],
};
