// Cross-encoder reranking: score query-document pairs jointly after a cheap
// first-stage retriever has narrowed the candidate set.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cross-encoder-reranker',
  title: 'Cross-Encoder Reranker',
  category: 'AI & ML',
  summary: 'A retrieval cascade pattern: retrieve cheaply, then score query-document pairs jointly with a slower but more precise Transformer.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pair scoring', 'retrieval cascade'], defaultValue: 'pair scoring' },
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

function pairGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 4.5, note: 'tokens' },
      { id: 'doc', label: 'chunk', x: 0.7, y: 2.2, note: 'tokens' },
      { id: 'pair', label: 'pair', x: 2.8, y: 3.4, note: 'q + chunk' },
      { id: 'transformer', label: 'cross-attn', x: 5.2, y: 3.4, note: 'joint tokens' },
      { id: 'head', label: 'score', x: 7.4, y: 3.4, note: 'relevance' },
      { id: 'rank', label: 'rank', x: 9.2, y: 3.4, note: 'top-k' },
    ],
    edges: [
      { id: 'e-query-pair', from: 'query', to: 'pair' },
      { id: 'e-doc-pair', from: 'doc', to: 'pair' },
      { id: 'e-pair-transformer', from: 'pair', to: 'transformer' },
      { id: 'e-transformer-head', from: 'transformer', to: 'head' },
      { id: 'e-head-rank', from: 'head', to: 'rank' },
    ],
  }, { title });
}

function cascadeGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.5, note: 'user' },
      { id: 'bm25', label: 'BM25', x: 2.2, y: 1.8, note: 'cheap' },
      { id: 'ann', label: 'ANN', x: 2.2, y: 5.2, note: 'cheap' },
      { id: 'fusion', label: 'fusion', x: 4.1, y: 3.5, note: 'top 100' },
      { id: 'batch', label: 'batch pairs', x: 5.9, y: 3.5, note: 'GPU/CPU' },
      { id: 'ce', label: 'cross-encoder', x: 7.8, y: 3.5, note: 'precise' },
      { id: 'context', label: 'context', x: 9.4, y: 3.5, note: 'top 5' },
    ],
    edges: [
      { id: 'e-query-bm25', from: 'query', to: 'bm25' },
      { id: 'e-query-ann', from: 'query', to: 'ann' },
      { id: 'e-bm25-fusion', from: 'bm25', to: 'fusion' },
      { id: 'e-ann-fusion', from: 'ann', to: 'fusion' },
      { id: 'e-fusion-batch', from: 'fusion', to: 'batch' },
      { id: 'e-batch-ce', from: 'batch', to: 'ce' },
      { id: 'e-ce-context', from: 'ce', to: 'context' },
    ],
  }, { title });
}

function* pairScoring() {
  yield {
    state: pairGraph('A cross-encoder reads query and chunk together'),
    highlight: { active: ['query', 'doc', 'pair', 'e-query-pair', 'e-doc-pair'], compare: ['rank'] },
    explanation: 'Read this as moving from cheap separate embeddings to expensive joint reading. The cross-encoder scores one query-candidate pair because the tokens can attend across the boundary.',
  };

  yield {
    state: labelMatrix(
      'One query, four candidate chunks',
      [
        { id: 'a', label: 'refund policy' },
        { id: 'b', label: 'billing FAQ' },
        { id: 'c', label: 'cancel annual plan' },
        { id: 'd', label: 'login help' },
      ],
      [
        { id: 'first_stage', label: 'retriever rank' },
        { id: 'ce_score', label: 'cross score' },
        { id: 'reranked', label: 'new rank' },
      ],
      [
        ['1', '0.68', '2'],
        ['2', '0.42', '3'],
        ['3', '0.91', '1'],
        ['4', '0.08', 'drop'],
      ],
    ),
    highlight: { active: ['c:ce_score', 'c:reranked'], compare: ['a:first_stage', 'a:reranked'], removed: ['d:reranked'] },
    explanation: 'The reranker is the precision layer. It can reorder candidates when a lower-ranked chunk actually answers the query better, but it can only choose from what retrieval already found.',
    invariant: 'A reranker can only reorder candidates it receives; it cannot recover evidence missing from the candidate pool.',
  };

  yield {
    state: pairGraph('The score head turns joint attention into relevance'),
    highlight: { active: ['transformer', 'head', 'rank', 'e-transformer-head', 'e-head-rank'], found: ['pair'] },
    explanation: 'The Transformer produces contextual representations over the combined query-document sequence. A small classification or ranking head converts that representation into a relevance score.',
  };

  yield {
    state: labelMatrix(
      'Architecture tradeoff',
      [
        { id: 'bi', label: 'bi-encoder' },
        { id: 'colbert', label: 'ColBERT' },
        { id: 'cross', label: 'cross-encoder' },
        { id: 'llm', label: 'LLM reranker' },
      ],
      [
        { id: 'interaction', label: 'interaction' },
        { id: 'cost', label: 'cost' },
        { id: 'role', label: 'best role' },
      ],
      [
        ['vector dot product', 'low', 'first-stage recall'],
        ['late token MaxSim', 'medium', 'precision layer'],
        ['full joint attention', 'high', 'top-k rerank'],
        ['prompted list judgment', 'very high', 'ambiguous final set'],
      ],
    ),
    highlight: { active: ['cross:interaction', 'cross:role'], compare: ['bi:cost', 'llm:cost'], found: ['colbert:role'] },
    explanation: 'Cross-encoders sit at the expensive end of the retrieval cascade. They are usually too slow for millions of documents, but strong on tens or hundreds of candidates.',
  };
}

function* retrievalCascade() {
  yield {
    state: cascadeGraph('Retrieve broadly, rerank narrowly'),
    highlight: { active: ['query', 'bm25', 'ann', 'fusion', 'e-query-bm25', 'e-query-ann'], compare: ['ce'] },
    explanation: 'The first stage is optimized for recall and speed. BM25, HNSW, metadata filters, and rank fusion create a candidate pool that is small enough for the expensive reranker.',
  };

  yield {
    state: cascadeGraph('Batch the pairs before scoring'),
    highlight: { active: ['fusion', 'batch', 'ce', 'e-fusion-batch', 'e-batch-ce'], found: ['context'] },
    explanation: 'Serving cost depends on candidate count, sequence length, model size, and batching. A query with 100 candidates means 100 Transformer forward passes unless the system batches pairs efficiently.',
  };

  yield {
    state: labelMatrix(
      'Rerank budget ledger',
      [
        { id: 'top20', label: 'top 20' },
        { id: 'top100', label: 'top 100' },
        { id: 'top500', label: 'top 500' },
        { id: 'listwise', label: 'listwise LLM' },
      ],
      [
        { id: 'quality', label: 'quality chance' },
        { id: 'latency', label: 'latency' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['medium', 'low', 'missed evidence if recall shallow'],
        ['strong', 'medium', 'batch pressure'],
        ['stronger', 'high', 'serving cost explodes'],
        ['depends', 'very high', 'prompt order bias'],
      ],
    ),
    highlight: { active: ['top100:quality', 'top100:latency'], compare: ['top500:latency', 'top20:risk'], removed: ['listwise:risk'] },
    explanation: 'The depth table is the main serving knob. Shallow reranking is cheap but brittle; deep reranking protects recall but can become the p95 latency bottleneck.',
  };

  yield {
    state: labelMatrix(
      'Evaluation layers',
      [
        { id: 'candidate', label: 'candidate recall' },
        { id: 'rerank', label: 'rerank nDCG/MRR' },
        { id: 'answer', label: 'answer faithfulness' },
        { id: 'cost', label: 'cost and p95' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure if ignored', label: 'failure if ignored' },
      ],
      [
        ['did retrieval find support?', 'reranker blamed unfairly'],
        ['did reranker order support high?', 'context packed poorly'],
        ['did generator use support?', 'pleasant hallucination'],
        ['can it serve traffic?', 'offline metric wins only'],
      ],
    ),
    highlight: { found: ['candidate:question', 'rerank:question', 'answer:question', 'cost:question'] },
    explanation: 'Reranking is not a final-answer metric by itself. Measure candidate recall, ranking quality, generated answer faithfulness, and serving latency separately.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pair scoring') yield* pairScoring();
  else if (view === 'retrieval cascade') yield* retrievalCascade();
  else throw new InputError('Pick a cross-encoder reranker view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Cross-Encoder Reranker. A retrieval cascade pattern: retrieve cheaply, then score query-document pairs jointly with a slower but more precise Transformer..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cross-encoder reranker is a precision stage in a retrieval system. A first-stage retriever finds a manageable set of candidate documents or passages. The cross-encoder then scores each query-candidate pair jointly by placing the query and the candidate text into one Transformer input. Query tokens and document tokens can attend to one another inside the model, so the score can reflect exact relationships, negation, order, and context that a simple vector distance may miss.',
        'The word reranker matters. A cross-encoder is usually not responsible for searching the whole corpus. It is responsible for reordering a candidate set that was found cheaply by BM25, dense vectors, metadata filters, ColBERT, or rank fusion. In a RAG system, that reordered set decides which chunks enter the prompt. In a search product, it decides which results the user sees first. Its job is to spend expensive model attention only where it can change the final ranking.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious retrieval approach is to compute reusable document embeddings and search by dot product or nearest-neighbor distance. That gives excellent serving properties because document vectors are precomputed and indexed. It also has a clear limitation: the query and document do not read each other. A bi-encoder can know that two texts are semantically close, but it may miss whether a passage actually answers a specific condition such as "after the renewal invoice" or "except for enterprise plans."',
        'The opposite obvious approach is to run a powerful Transformer over every possible query-document pair. That would give rich interaction, but it is not a search engine. A corpus with ten million passages would require ten million forward passes per query. Even a small candidate pool can become expensive when chunks are long, the model is large, or traffic is spiky. The practical wall is latency and cost. Cross-encoder reranking solves only the narrowed problem: use cheap retrieval for recall, then use joint reading for precision.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that retrieval quality is a cascade, not a single model choice. Early stages should optimize for recall under tight latency and memory budgets. Later stages should optimize for precision on a smaller set. A cross-encoder belongs late because it can notice details that early stages deliberately ignore. It can compare the query condition against the candidate wording, resolve whether a passage is about the same entity, and punish passages that contain related words but miss the requested relation.',
        'The constraint is just as important as the capability. A reranker cannot recover evidence it never receives. If the first-stage retriever fails to include the supporting passage, the cross-encoder can only choose among wrong candidates. This makes candidate recall the foundation of reranking. The best systems measure retrieval depth, candidate diversity, and slice recall before celebrating reranker gains. The reranker is a precision instrument, not a replacement for a broad candidate generator.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The model input commonly has the shape `[CLS] query [SEP] passage [SEP]` for BERT-style encoders, or a comparable paired-input format for T5-style rankers. The Transformer runs self-attention over the combined sequence. A score head converts the final representation into a relevance score. At serving time, the system creates one input per candidate, batches those inputs, runs the model, then sorts candidates by score. The output is a ranked list, not a generated answer.',
        'The surrounding data structures matter as much as the model. The candidate pool may come from inverted lists, HNSW neighborhoods, product-quantized vector indexes, metadata filters, or a fused heap of several retrievers. The reranker service needs pair builders, truncation rules, batching queues, timeout policies, score caches, and a top-k heap. It also needs passage identifiers and authorization metadata so sensitive documents are filtered before scoring or before insertion into a prompt.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because full cross-attention lets the model judge relevance at the token-relation level. A query about whether a customer can cancel after a renewal invoice is not just a bag of billing terms. The answer may depend on whether "after renewal" is allowed, whether the plan is annual, whether a refund window has closed, and whether an exception applies. A cross-encoder can compare those pieces inside one sequence and assign a higher score to the passage that actually resolves the question.',
        'It also works because the first stage has already reduced the problem. Running a reranker on the top 100 candidates is expensive but plausible. Running it on every document is not. The cascade makes the cost proportional to candidate depth, sequence length, model size, and traffic rather than corpus size. That gives engineers concrete knobs: retrieve 50 or 200 candidates, cap passage length, choose a smaller or larger model, batch across requests, or fall back to cheaper ranking under load.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cross-encoder rerankers are useful when the first-stage retriever finds plausible candidates but orders them poorly. Support policy search, legal retrieval, biomedical search, financial documents, developer documentation, and internal knowledge bases often have this shape. Many passages are topically related, but only a few answer the condition in the user question. A reranker can move the truly responsive passage above generic background pages and improve the context supplied to an answer generator.',
        'They are also useful as evaluation aids. A strong reranker can provide a better offline ranking baseline for candidate sets, expose weak retrieval depth, and help build golden examples for RAG testing. In production, it often works with Multi-Index RAG: lexical search catches exact terms, vector search catches paraphrases, metadata filters enforce scope, fusion keeps diversity, and the cross-encoder makes the final ordering more sensitive to the actual query wording.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The main failure is missing candidate recall. If the supporting passage is absent, reranking cannot help. A second failure is cost blowup. Doubling candidate depth, passage length, or model size can push p95 latency beyond the product budget. Reranking can also make duplicate chunks more dominant if near-identical passages all receive high scores. Without diversity controls, the final context may contain five versions of the same evidence and omit a necessary second source.',
        'A reranker score is not the same as proof. The model predicts relevance under its training distribution. It can be fooled by passages that contain query terms but contradict the answer, by outdated documents, by inaccessible documents, or by chunks whose context was lost during splitting. It may also have calibration drift across languages, tenants, document genres, or query types. A high score should decide ordering; it should not replace source verification, permission checks, or answer-level faithfulness evaluation.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Evaluate the cascade in layers. First measure candidate recall: did the first-stage retriever include a supporting passage at depth 20, 50, 100, or 200? Then measure reranking quality with MRR, nDCG, precision@k, and pairwise preference accuracy. Finally measure downstream answer quality: did the generator use the ranked evidence, cite it correctly, and avoid unsupported claims? These are separate questions. A reranker can improve nDCG while the final prompt still fails because context packing or answer generation is weak.',
        'Operational signals should include candidate depth, average and maximum sequence length, batch size, queue delay, model latency, timeout rate, p95 and p99 end-to-end latency, cost per thousand queries, score distributions, and fallback usage. Quality dashboards should slice by query class, language, tenant, document source, recency, and rare entity frequency. A useful canary compares the production depth with a deeper rerank depth. If deeper reranking often changes answers, the system may be running too shallow.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the BERT passage reranking work by Nogueira and Cho, then multi-stage ranking systems such as monoBERT, duoBERT, monoT5, duoT5, and RankT5. In this curriculum, connect the topic to Attention Mechanism and The Transformer Block to understand why joint token interaction is expensive and expressive. Then study Embeddings and Similarity, HNSW, Product Quantization, ColBERT Late-Interaction Retrieval, and Multi-Index RAG to understand the candidate-generation stages that make reranking possible.',
        'The practical takeaway is to deploy reranking as an explicit budgeted stage. Choose the candidate depth based on recall curves, not habit. Batch pairs deliberately. Keep authorization and metadata filters outside the model score. Evaluate final answer quality separately from reranker ranking quality. A cross-encoder is one of the most useful tools in modern retrieval, but only when the system around it protects recall, controls cost, and treats the score as a ranking signal rather than a source of truth.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Cross-Encoder Reranker moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
],
};

