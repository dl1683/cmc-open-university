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
    explanation: 'Traditional RAG usually extracts text, chunks it, and embeds the chunks. Visual document retrieval also embeds rendered pages, so layout, figures, tables, formulas, checkboxes, and typography can become retrieval evidence.',
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
    explanation: 'ColPali uses a vision-language model to produce multi-vector page embeddings, then uses a late-interaction scoring pattern similar to ColBERT. Query tokens can match different visual page patches.',
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
    explanation: 'Different multimodal questions need different first moves. A chart question should not start and end with OCR. A table-cell question should not depend only on page-level similarity.',
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
      heading: 'What it is',
      paragraphs: [
        'Multimodal RAG extends Retrieval-Augmented Generation beyond plain text chunks. A real knowledge base often contains PDFs, tables, slide decks, diagrams, screenshots, forms, images, audio, and video. If the pipeline extracts only text, it can lose the structure that carries the answer: table alignment, chart shape, checkbox state, page layout, handwriting, figure captions, and cross-page references.',
        'The core data-structure change is that evidence is no longer one list of text chunks. It becomes a collection of linked surfaces: OCR tokens, page images, table cells, chart objects, embeddings, regions, metadata, and graph edges. Retrieval then becomes a fusion problem across modalities, not a single vector search.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A multimodal RAG pipeline renders or ingests document pages, extracts text where useful, embeds page images or regions with a vision-language model, stores structured tables separately, and keeps metadata such as document version, page number, region coordinates, and permissions. A user question can fan out to OCR/BM25, text embeddings, image-page retrieval, table lookup, and entity-graph expansion before a reranker builds a small grounded context.',
        'CLIP-style contrastive learning is the foundation for shared image-text spaces: https://arxiv.org/abs/2103.00020. ColPali adapts the late-interaction idea from ColBERT to visually rich document retrieval by embedding page images with a vision-language model and scoring with multi-vector interaction: https://arxiv.org/abs/2407.01449. The associated ViDoRe benchmark and model releases are available through the project page at https://huggingface.co/vidore.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is higher than text-only RAG. Page images are larger than text chunks, vision encoders are expensive, multi-vector indexes are larger than single-vector indexes, and region grounding requires extra metadata. Product Quantization for Vector Search, late-interaction compression, batching, and careful top-k limits become necessary when the corpus has millions of pages.',
        'The benefit is that the system can answer questions text-only RAG mishandles: "Which checkbox is selected?", "What does the chart show after Q3?", "What number is in row B, column 7?", or "Which image matches this part number?" A Survey of Multimodal Retrieval-Augmented Generation reviews the broader design space, datasets, metrics, and limitations: https://arxiv.org/abs/2504.08748. Ask in Any Modality offers another broad survey: https://arxiv.org/abs/2502.08826.',
      ],
    },
    {
      heading: 'Complete case study: visually rich policy PDFs',
      paragraphs: [
        'Consider an enterprise benefits assistant over thousands of policy PDFs. The answer to a coverage question may live in a table with merged cells, a footnote, and a diagram that says which plan tier applies. OCR may extract the words but lose the row and column relationship. A multimodal pipeline can retrieve the page image, use table extraction for cells, preserve coordinates, and send the relevant crop to a vision-language model for final grounding.',
        'A strong design is layered. Multi-Index RAG finds candidates from text, vector, metadata, and graph indexes. ColPali-style retrieval catches visually rich pages. Cross-Encoder Reranker or a multimodal reranker chooses the final evidence. Cache Invalidation & Versioning tracks document versions. Zanzibar Authorization Case Study prevents retrieving pages the user cannot view.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume multimodal means "send the whole PDF to a vision model." That is slow, expensive, and hard to audit. Retrieval should narrow the evidence first. Do not assume OCR is obsolete either; exact terms, IDs, and citations often still need text indexes. The right architecture combines modalities and records which modality supported each answer.',
        'The hardest failure mode is false grounding. A model may answer correctly from prior knowledge while citing the wrong page, or cite a page that contains the right words but not the right visual relationship. Evaluation should separately score page recall, region grounding, modality attribution, and answer faithfulness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CLIP at https://arxiv.org/abs/2103.00020, ColPali at https://arxiv.org/abs/2407.01449, the ViDoRe/ColPali project at https://huggingface.co/vidore, Multimodal RAG survey at https://arxiv.org/abs/2504.08748, Ask in Any Modality survey at https://arxiv.org/abs/2502.08826, and RAG-Anything at https://arxiv.org/abs/2510.12323. Study Embeddings & Similarity, Contrastive Learning: SimCLR, RAG Pipeline, Multi-Index RAG, ColBERT Late-Interaction Retrieval, Cross-Encoder Reranker, Product Quantization, and GraphRAG Community Summary Case Study next.',
      ],
    },
  ],
};
