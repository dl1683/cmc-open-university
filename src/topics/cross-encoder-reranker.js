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
  const pipelineNodes = ['query', 'doc', 'pair', 'transformer', 'head', 'rank'];
  yield {
    state: pairGraph('A cross-encoder reads query and chunk together'),
    highlight: { active: ['query', 'doc', 'pair', 'e-query-pair', 'e-doc-pair'], compare: ['rank'] },
    explanation: `Read this ${pipelineNodes.length}-stage pipeline as moving from cheap separate embeddings to expensive joint reading. The cross-encoder scores one query-candidate pair because the tokens can attend across the boundary.`,
  };

  const candidates = [
    { id: 'a', label: 'refund policy' },
    { id: 'b', label: 'billing FAQ' },
    { id: 'c', label: 'cancel annual plan' },
    { id: 'd', label: 'login help' },
  ];
  const scoreCols = [
    { id: 'first_stage', label: 'retriever rank' },
    { id: 'ce_score', label: 'cross score' },
    { id: 'reranked', label: 'new rank' },
  ];
  yield {
    state: labelMatrix(
      'One query, four candidate chunks',
      candidates,
      scoreCols,
      [
        ['1', '0.68', '2'],
        ['2', '0.42', '3'],
        ['3', '0.91', '1'],
        ['4', '0.08', 'drop'],
      ],
    ),
    highlight: { active: ['c:ce_score', 'c:reranked'], compare: ['a:first_stage', 'a:reranked'], removed: ['d:reranked'] },
    explanation: `The reranker scores ${candidates.length} candidates across ${scoreCols.length} columns. It can reorder candidates when a lower-ranked chunk like "${candidates[2].label}" actually answers the query better, but it can only choose from what retrieval already found.`,
    invariant: `A reranker can only reorder the ${candidates.length} candidates it receives; it cannot recover evidence missing from the candidate pool.`,
  };

  yield {
    state: pairGraph('The score head turns joint attention into relevance'),
    highlight: { active: ['transformer', 'head', 'rank', 'e-transformer-head', 'e-head-rank'], found: ['pair'] },
    explanation: `The Transformer at stage "${pipelineNodes[3]}" produces contextual representations over the combined query-document sequence. The "${pipelineNodes[4]}" stage converts that representation into a relevance score.`,
  };

  const architectures = [
    { id: 'bi', label: 'bi-encoder' },
    { id: 'colbert', label: 'ColBERT' },
    { id: 'cross', label: 'cross-encoder' },
    { id: 'llm', label: 'LLM reranker' },
  ];
  yield {
    state: labelMatrix(
      'Architecture tradeoff',
      architectures,
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
    explanation: `${architectures.length} architectures compared (${architectures.map(a => a.label).join(', ')}). Cross-encoders sit at the expensive end of the retrieval cascade -- too slow for millions of documents, but strong on tens or hundreds of candidates.`,
  };
}

function* retrievalCascade() {
  const cascadeNodes = ['query', 'bm25', 'ann', 'fusion', 'batch', 'ce', 'context'];
  const retrievers = ['bm25', 'ann'];
  yield {
    state: cascadeGraph('Retrieve broadly, rerank narrowly'),
    highlight: { active: ['query', 'bm25', 'ann', 'fusion', 'e-query-bm25', 'e-query-ann'], compare: ['ce'] },
    explanation: `The first stage fans the query to ${retrievers.length} retrievers (${retrievers.join(', ')}) optimized for recall and speed. Rank fusion creates a candidate pool small enough for the expensive reranker across ${cascadeNodes.length} cascade stages.`,
  };

  yield {
    state: cascadeGraph('Batch the pairs before scoring'),
    highlight: { active: ['fusion', 'batch', 'ce', 'e-fusion-batch', 'e-batch-ce'], found: ['context'] },
    explanation: `Serving cost depends on candidate count, sequence length, model size, and batching across the ${cascadeNodes.length}-node cascade. A query with 100 candidates means 100 Transformer forward passes unless the system batches pairs efficiently.`,
  };

  const depthTiers = [
    { id: 'top20', label: 'top 20' },
    { id: 'top100', label: 'top 100' },
    { id: 'top500', label: 'top 500' },
    { id: 'listwise', label: 'listwise LLM' },
  ];
  yield {
    state: labelMatrix(
      'Rerank budget ledger',
      depthTiers,
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
    explanation: `${depthTiers.length} depth tiers (${depthTiers.map(t => t.label).join(', ')}) form the main serving knob. Shallow reranking is cheap but brittle; deep reranking protects recall but can become the p95 latency bottleneck.`,
  };

  const evalLayers = [
    { id: 'candidate', label: 'candidate recall' },
    { id: 'rerank', label: 'rerank nDCG/MRR' },
    { id: 'answer', label: 'answer faithfulness' },
    { id: 'cost', label: 'cost and p95' },
  ];
  yield {
    state: labelMatrix(
      'Evaluation layers',
      evalLayers,
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
    explanation: `Reranking is not a final-answer metric by itself. Measure all ${evalLayers.length} evaluation layers (${evalLayers.map(l => l.label).join(', ')}) separately.`,
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
        'The "pair scoring" view traces a single query through the cross-encoder pipeline: query and chunk tokens are concatenated into a pair, fed through joint cross-attention, converted to a relevance score, then ranked. The matrix frame shows four candidate chunks with their first-stage retriever rank, cross-encoder score, and final reranked position. Watch the "cancel annual plan" chunk jump from retriever rank 3 to reranked position 1 -- that promotion is the reranker doing its job. The architecture-comparison frame lays out four scoring approaches (bi-encoder, ColBERT, cross-encoder, LLM reranker) so you can see where cross-encoders sit on the cost-precision tradeoff.',
        {
          type: 'callout',
          text: 'A cross-encoder reranker is expensive because it reads query and passage together, so it must sit after a cheap recall stage.',
        },
        'The "retrieval cascade" view shows the full pipeline: the query fans out to BM25 and ANN retrievers, rank fusion narrows to a candidate pool (~100), pairs are batched, the cross-encoder scores them, and the top 5 become context. The budget ledger frame shows how rerank depth trades quality for latency. The evaluation layers frame breaks measurement into four independent questions -- candidate recall, rerank quality, answer faithfulness, and cost. Track each layer separately; improving one does not guarantee improving the others.',
        {type: 'image', src: './assets/gifs/cross-encoder-reranker.gif', alt: 'Animated walkthrough of the cross encoder reranker visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search and retrieval-augmented generation (RAG) systems face a precision problem. A first-stage retriever -- BM25, a vector index, or both -- can scan millions of documents in milliseconds, but it ranks by shallow signals: term overlap or embedding distance. That is fast, but it misses nuance. A query like "can I cancel after the renewal invoice?" matches many billing-related passages by keyword or embedding similarity, but only one or two actually answer the specific condition about post-renewal cancellation. The retriever finds the neighborhood; it does not reliably pick the best house.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png',
          alt: 'Transformer architecture diagram with encoder and decoder stacks',
          caption: 'Transformer architecture, the model family used for full pair scoring in many cross-encoders. Source: https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png',
        },
        'A cross-encoder reranker exists to fix that ordering. It takes the candidate set from the retriever, concatenates each candidate with the query into a single Transformer input, and scores the pair using full cross-attention. Because query tokens and passage tokens can attend to each other inside the model, the score reflects exact word relationships, negation, temporal conditions, and entity resolution that a dot product between independent embeddings cannot capture. The "re" in reranker is load-bearing: this model does not search the corpus. It reorders a small set that was already found cheaply.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing teams try is a bi-encoder: embed each document once, store the vectors, and at query time embed the query and find nearest neighbors by dot product or cosine similarity. This scales beautifully -- document embeddings are precomputed and indexed with HNSW or product quantization, so searching 10 million documents takes single-digit milliseconds. The problem is that the query and document never read each other. The bi-encoder encodes the query in isolation and the document in isolation, then compares the two fixed vectors. It knows the two texts are "close" in embedding space, but it cannot check whether the passage actually satisfies a specific condition in the query.',
        'The opposite extreme is to run a full Transformer over every query-document pair in the corpus. That gives maximum interaction -- every query token attends to every document token -- but it is not a search engine. A 10-million-document corpus would require 10 million forward passes per query. At 5ms per pass, that is 50,000 seconds. The practical wall is not model quality; it is cost and latency. Cross-encoder reranking solves the narrowed version of this problem: use cheap retrieval for recall, then spend expensive joint attention only on the small set where it can change the final answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic cost in the wrong dimension. A Transformer\'s self-attention is O(n^2) in sequence length, where n is the combined length of query plus passage tokens. A cross-encoder must run a separate forward pass for every query-candidate pair because the query tokens must attend to that specific passage\'s tokens. If you have k candidates of average length L and query length q, the total cost is k forward passes, each over a sequence of length (q + L). Doubling k doubles the number of passes. Doubling L roughly quadruples the attention cost per pass. There is no precomputation shortcut: unlike a bi-encoder, you cannot cache the passage side because the passage representation depends on the query.',
        'This means a cross-encoder is unusable as a first-stage retriever. It must sit behind a cheap recall stage that narrows the candidate set from millions to tens or hundreds. The cascade architecture is not optional -- it is the only way to make the cross-encoder\'s cost tractable. The engineering challenge shifts to deciding how many candidates to pass through (rerank depth) and how to batch them efficiently.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Retrieval quality is a cascade, not a single model choice. Each stage in the cascade has a different job. Early stages (BM25, ANN vector search) optimize for recall under tight latency budgets -- find every plausibly relevant passage, even if the ordering is rough. Later stages optimize for precision on the narrowed set -- promote the passages that actually answer the question above the ones that merely share vocabulary. A cross-encoder belongs late in the cascade because it can detect fine-grained relevance signals that early stages deliberately ignore.',
        'The constraint matters as much as the capability. A reranker cannot recover evidence it never received. If the first-stage retriever missed the supporting passage, the cross-encoder can only choose among wrong candidates -- it will pick the least-wrong one and score it highly, which is worse than returning nothing. This makes candidate recall the foundation of the entire system. The best deployments measure recall at different depths (did the relevant passage appear in the top 20? top 100? top 200?) before tuning the reranker. Reranking is a precision instrument that amplifies good recall; it cannot substitute for bad recall.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Input construction: for a BERT-style cross-encoder, the input is [CLS] query tokens [SEP] passage tokens [SEP]. For T5-style rankers (monoT5, RankT5), the input is a text-to-text format like "Query: ... Document: ... Relevant:". The Transformer runs full self-attention over the combined sequence, so every query token attends to every passage token and vice versa. A classification or regression head on top of the [CLS] representation (or the decoder output) produces a single relevance score.',
        'Serving pipeline: the system receives a query and a candidate list from the retriever. It constructs one input per candidate, truncating passages that exceed the model\'s max sequence length (typically 512 tokens for BERT-base). These inputs are batched (commonly 16-64 pairs per GPU batch), run through the model, and the output scores are collected. The system sorts candidates by score descending and returns the top-k. The output is a reordered list with scores -- not a generated answer.',
        'Infrastructure around the model matters as much as the model itself. The reranker service needs truncation rules (what to cut when a passage exceeds the limit), batching queues (to amortize GPU overhead across concurrent queries), timeout policies (to prevent one slow batch from blocking the pipeline), and passage metadata (document IDs, access permissions, timestamps) so the downstream system can filter or cite correctly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Full cross-attention lets the model judge relevance at the token-relation level, not just the document-topic level. Consider the query "can I cancel after the renewal invoice?" A bi-encoder embeds "cancel," "renewal," and "invoice" into a single query vector and finds passages about billing and cancellation. But the answer depends on whether the passage says cancellation is allowed after renewal, not just that it mentions both concepts. A cross-encoder reads the query and passage together. The attention mechanism can align "after the renewal invoice" in the query with "cancellation requests received after the billing cycle" in the passage and assign a high score, while giving a low score to a passage that says "cancellation must be requested before renewal." That word-level conditional matching is what bi-encoders sacrifice for speed.',
        'The cascade structure makes the cost manageable. A cross-encoder on 100 candidates with 256-token passages requires ~100 forward passes of a BERT-base model, which takes roughly 200-500ms on a single GPU depending on batching. That is expensive compared to a vector dot product (sub-millisecond for 100 candidates) but feasible as a second stage. The cascade converts a corpus-scale problem (millions of documents) into a batch-scale problem (tens to hundreds of pairs), which is where the cross-encoder\'s precision advantage pays off.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is k * T_forward, where k is the number of candidates reranked and T_forward is the time for one forward pass over a (query + passage) sequence. For BERT-base (110M parameters) with 256-token inputs on an A10 GPU, T_forward is roughly 3-5ms. Reranking 100 candidates serially would take 300-500ms; batching in groups of 32 brings wall-clock time to ~50-80ms. Doubling the candidate count doubles the cost linearly. Doubling the sequence length roughly quadruples the per-pass cost (due to O(n^2) attention) and doubles the memory.',
        'Memory cost is also significant. Each forward pass allocates attention matrices of size (q + L)^2 per layer per head. With batch size 32, sequence length 512, and 12 layers with 12 heads, the attention matrices alone consume ~3.6 GB of GPU memory. This limits how large the batch can be and how many concurrent queries a single GPU can serve. Production systems often run multiple smaller model replicas rather than one large model to stay within memory budgets.',
        'Latency has a hard floor set by the model\'s forward-pass time, but the practical bottleneck is often queuing delay under load. If queries arrive faster than the GPU can process batches, requests queue up and p95 latency spikes. Common mitigations: adaptive batch sizing, load-aware routing, fallback to bi-encoder scores under high load, and caching scores for repeated query-passage pairs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RAG pipelines are the largest deployment surface. In a typical setup, BM25 and/or dense retrieval produce 50-200 candidate chunks, the cross-encoder reranks them, and the top 5-10 chunks are packed into the LLM prompt as context. The reranker\'s job is to ensure the most relevant chunks appear first, since LLMs are sensitive to context ordering and have finite context windows. Cohere Rerank, Jina Reranker, and the open-source cross-encoder models on Hugging Face (e.g., ms-marco-MiniLM) are commonly used in this role.',
        'Enterprise search products use reranking for support ticket routing, legal document retrieval, biomedical literature search, and internal knowledge bases. These domains have many topically similar documents where the distinction between a relevant passage and a merely related one depends on fine-grained conditions. A reranker can promote the passage that answers "does this policy apply to contracts signed before 2023?" above a passage that merely discusses the policy in general.',
        'Rerankers also serve as offline evaluation tools. A strong cross-encoder can produce pseudo-relevance labels for training bi-encoders (knowledge distillation), provide a ranking baseline for measuring retrieval quality, and help build golden test sets for RAG evaluation pipelines.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Missing recall: if the first-stage retriever did not include the correct passage in its candidate set, the reranker cannot conjure it. The reranker will rank the best available candidate highly, which may give a confident-looking but wrong answer downstream. This failure is invisible unless you measure recall at the retrieval stage independently from reranker quality.',
        'Cost blowup: doubling rerank depth, doubling passage length, or upgrading to a larger model can push p95 latency past the product\'s budget. In a RAG system serving interactive queries, the reranker is often the latency bottleneck. Without adaptive depth control (rerank fewer candidates under load) or tiered models (fast model for easy queries, large model for hard ones), cost can become uncontrollable.',
        'Duplicate dominance: if the corpus contains near-identical passages (common in enterprise knowledge bases with versioned documents), the reranker may score all copies highly, filling the top-k with redundant evidence. Without diversity controls (maximal marginal relevance, deduplication by content hash), the final context misses a necessary second source. Score miscalibration is also common: scores from different query types or languages may not be comparable, so a threshold-based cutoff ("drop everything below 0.5") fails silently when calibration drifts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: a user queries a support knowledge base with "can I get a refund after my annual plan renews?" The BM25 retriever returns 100 candidate chunks, ranked by term overlap. The top 4 are: (1) "Refund Policy Overview" -- general refund terms, (2) "Billing FAQ" -- how invoices work, (3) "Cancel Annual Plan" -- steps to cancel with a paragraph about post-renewal refund windows, (4) "Login Help" -- unrelated. The retriever ranked them by keyword density, so the general refund overview is first.',
        'Scoring: the cross-encoder constructs 4 inputs: [CLS] can I get a refund after my annual plan renews? [SEP] <chunk text> [SEP] for each chunk. It runs BERT-base on all 4 (batched, ~15ms total on GPU). Scores: "Refund Policy Overview" = 0.68, "Billing FAQ" = 0.42, "Cancel Annual Plan" = 0.91, "Login Help" = 0.08. The cross-encoder scored "Cancel Annual Plan" highest because that chunk contains the sentence "refund requests submitted within 14 days of annual renewal are eligible for a prorated refund" -- a direct answer to the query condition "after my annual plan renews."',
        'Reranked output: [1] Cancel Annual Plan (0.91), [2] Refund Policy Overview (0.68), [3] Billing FAQ (0.42), [4] Login Help (dropped, score below threshold). The RAG system packs chunks 1-3 into the LLM prompt. The correct passage is now first, where the retriever had it third. That promotion is the reranker\'s entire contribution -- and it is the difference between a correct answer and a generic one.',
        'What if the retriever had missed the "Cancel Annual Plan" chunk entirely? The reranker would have scored the remaining 3 candidates, promoted "Refund Policy Overview" to rank 1 with score 0.68, and the LLM would have generated a generic answer about refund policies without addressing the post-renewal condition. The reranker would have looked like it was working fine (it returned a ranked list with a reasonable top score), but the answer would have been wrong. This is why recall must be measured independently.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational work is Nogueira and Cho, "Passage Re-ranking with BERT" (2019, https://arxiv.org/abs/1901.04085), which showed that fine-tuning BERT as a cross-encoder on MS MARCO passage ranking dramatically improved reranking quality over traditional features. The multi-stage extensions monoBERT/duoBERT and monoT5/duoT5/RankT5 by Nogueira, Cho, and Lin explore pointwise, pairwise, and listwise scoring with different Transformer architectures. For ColBERT (late interaction as a middle ground), see Khattab and Zaharia, "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT" (2020, https://arxiv.org/abs/2004.12832).',
        'Prerequisite topics: study Attention Mechanism and The Transformer Block to understand why joint token interaction is both expensive and expressive. Study Embeddings and Similarity to understand the bi-encoder baseline that reranking improves upon. Study HNSW and Product Quantization to understand the first-stage retrieval indexes that produce candidate sets. Extension topics: ColBERT Late-Interaction Retrieval sits between bi-encoders and cross-encoders on the cost-precision spectrum. Multi-Index RAG covers the full pipeline architecture including fusion and context packing.',
        'A good exercise: take a set of 10 query-passage pairs from a domain you know (support docs, API references, course materials). Score them yourself on a 1-5 relevance scale, noting which ones require reading the query condition against the passage condition (not just topic matching). Then predict which pairs a bi-encoder would get wrong and a cross-encoder would get right. The cases where you need to compare specific conditions across the two texts are exactly the cases where cross-encoding pays for itself.',
      ],
    },
  ],
};

