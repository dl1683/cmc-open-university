// RAG context packing: select, compress, order, and cite evidence under a
// fixed token budget instead of dumping raw top-k chunks into the prompt.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-context-packing-token-budget-case-study',
  title: 'RAG Context Packing Token Budget',
  category: 'AI & ML',
  summary: 'A post-retrieval case study: select evidence under a token budget, compress noisy chunks, place anchors carefully, and preserve citation spans.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['select evidence', 'place and compress'], defaultValue: 'select evidence' },
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

function packingGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.6, note: 'intent' },
      { id: 'pool', label: 'pool', x: 2.0, y: 3.6, note: 'top 80' },
      { id: 'score', label: 'score', x: 3.5, y: 2.2, note: 'utility' },
      { id: 'budget', label: 'budget', x: 3.5, y: 5.0, note: 'tokens' },
      { id: 'select', label: 'select', x: 5.2, y: 3.6, note: 'knapsack' },
      { id: 'compress', label: 'compress', x: 6.7, y: 5.0, note: 'prune' },
      { id: 'order', label: 'order', x: 6.7, y: 2.2, note: 'place' },
      { id: 'prompt', label: 'prompt', x: 8.3, y: 3.6, note: 'packed' },
      { id: 'answer', label: 'answer', x: 9.6, y: 3.6, note: 'cited' },
    ],
    edges: [
      { id: 'e-query-pool', from: 'query', to: 'pool' },
      { id: 'e-pool-score', from: 'pool', to: 'score' },
      { id: 'e-pool-budget', from: 'pool', to: 'budget' },
      { id: 'e-score-select', from: 'score', to: 'select' },
      { id: 'e-budget-select', from: 'budget', to: 'select' },
      { id: 'e-select-compress', from: 'select', to: 'compress' },
      { id: 'e-select-order', from: 'select', to: 'order' },
      { id: 'e-compress-prompt', from: 'compress', to: 'prompt' },
      { id: 'e-order-prompt', from: 'order', to: 'prompt' },
      { id: 'e-prompt-answer', from: 'prompt', to: 'answer' },
    ],
  }, { title });
}

function* selectEvidence() {
  yield {
    state: packingGraph('Context packing is a bounded-selection problem'),
    highlight: { active: ['pool', 'score', 'budget', 'select', 'e-pool-score', 'e-pool-budget'], compare: ['prompt'] },
    explanation: 'Retrieval returns candidates. Context packing decides what the model actually sees. The packer balances relevance, token cost, redundancy, source diversity, citation needs, and instruction space under a fixed context budget.',
  };

  yield {
    state: labelMatrix(
      'Candidate ledger',
      [
        { id: 'policy', label: 'policy' },
        { id: 'fees', label: 'fees' },
        { id: 'renew', label: 'renewal' },
        { id: 'dupe', label: 'dupe' },
        { id: 'legal', label: 'legal' },
        { id: 'faq', label: 'FAQ' },
      ],
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'utility', label: 'utility' },
        { id: 'role', label: 'role' },
        { id: 'keep', label: 'keep?' },
      ],
      [
        ['360', '0.96', 'rule', 'yes'],
        ['220', '0.78', 'fee', 'yes'],
        ['260', '0.73', 'date', 'yes'],
        ['340', '0.90', 'repeat', 'no'],
        ['520', '0.69', 'risk', 'maybe'],
        ['180', '0.62', 'plain', 'yes'],
      ],
    ),
    highlight: { active: ['policy:keep', 'fees:keep', 'renew:keep', 'faq:keep'], removed: ['dupe:keep'], compare: ['legal:keep'] },
    explanation: 'A raw top-k list is not a prompt. Each candidate has token cost, expected utility, role, freshness, citation span, and redundancy. The duplicate may score high but wastes budget.',
    invariant: 'The objective is useful evidence per budgeted token, not rank position alone.',
  };

  yield {
    state: labelMatrix(
      'Selection strategies',
      [
        { id: 'rank', label: 'top rank' },
        { id: 'density', label: 'density' },
        { id: 'knap', label: 'knapsack' },
        { id: 'mmr', label: 'MMR' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['keep order', 'dup flood'],
        ['utility/tok', 'miss long fact'],
        ['best budget', 'needs scores'],
        ['diversify', 'can drift'],
      ],
    ),
    highlight: { active: ['knap:move', 'mmr:move'], compare: ['rank:risk', 'density:risk'] },
    explanation: 'There are several useful approximations. Top-rank is simple. Density greedily favors compact chunks. Knapsack-style selection optimizes value under a budget. MMR adds a redundancy penalty.',
  };

  yield {
    state: packingGraph('Citation spans constrain compression'),
    highlight: { active: ['select', 'compress', 'prompt', 'e-select-compress', 'e-compress-prompt'], found: ['answer'] },
    explanation: 'The packer can trim boilerplate, keep only relevant sentences, or summarize low-risk context, but cited evidence needs stable span handles. Compression should not destroy the coordinates needed for audit.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'prompt tokens used', min: 0, max: 4000 }, y: { label: 'answer support', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw top-k', points: [{ x: 900, y: 46 }, { x: 1800, y: 62 }, { x: 3200, y: 66 }] },
        { id: 'packed', label: 'packed', points: [{ x: 900, y: 61 }, { x: 1800, y: 78 }, { x: 3200, y: 82 }] },
        { id: 'compress', label: 'compressed', points: [{ x: 650, y: 58 }, { x: 1300, y: 75 }, { x: 2400, y: 80 }] },
      ],
    }),
    highlight: { found: ['packed', 'compress'], compare: ['raw'] },
    explanation: 'This plot is conceptual. Better packing can raise support without increasing token count because the model sees less repetition and more answer-bearing evidence.',
  };
}

function* placeAndCompress() {
  yield {
    state: packingGraph('Ordering is part of the data structure'),
    highlight: { active: ['order', 'prompt', 'e-order-prompt'], found: ['answer'], compare: ['pool'] },
    explanation: 'After selection, the packer must place evidence. Long-context models may use beginning and ending evidence more reliably than middle evidence, so the highest-value spans should not be buried accidentally.',
  };

  yield {
    state: labelMatrix(
      'Prompt placement plan',
      [
        { id: 'lead', label: 'lead' },
        { id: 'nearq', label: 'near query' },
        { id: 'middle', label: 'middle' },
        { id: 'tail', label: 'tail' },
      ],
      [
        { id: 'content', label: 'content' },
        { id: 'why', label: 'why' },
      ],
      [
        ['key rule', 'primacy'],
        ['question', 'focus'],
        ['supporting', 'lower risk'],
        ['cites', 'recency'],
      ],
    ),
    highlight: { active: ['lead:content', 'nearq:content', 'tail:content'], compare: ['middle:why'] },
    explanation: 'A simple placement policy puts the most important rule early, keeps the user question near the evidence, and repeats citation handles or summary anchors near the end. Lower-risk background can sit in the middle.',
  };

  yield {
    state: labelMatrix(
      'Compression actions',
      [
        { id: 'boiler', label: 'boiler' },
        { id: 'sentence', label: 'sentence' },
        { id: 'table', label: 'table' },
        { id: 'quote', label: 'quote' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['drop', 'safe'],
        ['keep best', 'span ids'],
        ['row slice', 'headers'],
        ['verbatim', 'cite'],
      ],
    ),
    highlight: { active: ['sentence:action', 'table:action', 'quote:action'], removed: ['boiler:action'] },
    explanation: 'Compression is not one operation. Boilerplate can be dropped. Relevant sentences can be kept with span IDs. Tables need headers and row context. Direct quotes should remain verbatim with citation handles.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'position in prompt', min: 0, max: 100 }, y: { label: 'use probability', min: 0, max: 100 } },
      series: [
        { id: 'flat', label: 'ideal flat', points: [{ x: 5, y: 82 }, { x: 25, y: 82 }, { x: 50, y: 82 }, { x: 75, y: 82 }, { x: 95, y: 82 }] },
        { id: 'bias', label: 'pos bias', points: [{ x: 5, y: 90 }, { x: 25, y: 68 }, { x: 50, y: 45 }, { x: 75, y: 67 }, { x: 95, y: 88 }] },
      ],
    }),
    highlight: { found: ['bias'], compare: ['flat'] },
    explanation: 'Lost-in-the-middle results motivate placement tests. The exact curve depends on model and task, but packing should assume position can matter and evaluate accordingly.',
  };

  yield {
    state: packingGraph('Complete case: refund answer prompt pack'),
    highlight: { active: ['select', 'compress', 'order', 'prompt', 'answer'], found: ['score', 'budget'] },
    explanation: 'Case study: a refund answer gets one current policy span, one fee exception, one renewal date rule, and one plain-language FAQ. The stale duplicate is dropped. The table row is sliced with headers. Citation handles stay attached.',
  };

  yield {
    state: labelMatrix(
      'What to test',
      [
        { id: 'recall', label: 'support' },
        { id: 'order', label: 'order' },
        { id: 'compress', label: 'compress' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'bad', label: 'bad sign' },
      ],
      [
        ['claim support', 'missing fact'],
        ['pos sweep', 'middle fail'],
        ['span check', 'bad cite'],
        ['tokens+p95', 'slow answer'],
      ],
    ),
    highlight: { found: ['recall:metric', 'order:metric', 'compress:metric', 'cost:metric'] },
    explanation: 'Evaluate the prompt pack itself: claim support, position robustness, citation validity after compression, token count, and p95 latency. The packer is a ranking system and needs its own tests.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'select evidence') yield* selectEvidence();
  else if (view === 'place and compress') yield* placeAndCompress();
  else throw new InputError('Pick a RAG context packing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RAG context packing is the post-retrieval layer that decides which evidence enters the model prompt, how much of each chunk survives, where the evidence is placed, and which citation handles remain attached. Retrieval builds a candidate pool. Packing turns that pool into a bounded prompt.',
        'The core data-structure problem is a budgeted selection problem. Each candidate has value, token cost, redundancy, source role, freshness, permission state, and citation spans. The packer must produce a small ordered set that maximizes useful support while preserving auditability.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple packer starts with reranked candidates, removes blocked or stale chunks, collapses duplicates, estimates utility per chunk, and selects evidence under a token budget. More careful systems add MMR-style diversity, source-role quotas, knapsack-style optimization, sentence extraction, table row slicing, and citation-span preservation.',
        'After selection, ordering matters. Lost-in-the-middle experiments showed that model performance can drop when relevant evidence is placed in the middle of long contexts. Packing policies therefore need position tests, not just retrieval scores. Critical evidence, the question, and citation handles should be placed deliberately rather than left in arbitrary rank order.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support assistant answers, "Can I cancel after a renewal invoice?" Retrieval returns the current refund policy, a stale duplicate, a fee exception table, a renewal date rule, a general billing FAQ, and a long legal page. Raw top-k stuffing wastes tokens on the duplicate and buries the fee table.',
        'The packer keeps the current policy span, the fee table row with headers, the renewal date rule, and a plain FAQ explanation. It drops boilerplate and the stale duplicate, compresses the legal page into a warning sentence with a citation span, places the key rule early, and keeps citation handles next to the claims. The final answer has fewer tokens and stronger source coverage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Packing adds computation after retrieval: pairwise redundancy checks, token counting, sentence scoring, table slicing, citation validation, and sometimes a compression model. That cost is usually smaller than generation cost, but it can still affect p95 latency. A production packer needs fallbacks when compression is slow or citation validation fails.',
        'The hard part is avoiding silent damage. Compression can remove the exception that makes the answer correct. Ordering can bury the only relevant span. A summary can detach from its source. A budget heuristic can prefer short but weak chunks over longer decisive evidence. These failure modes require held-out questions and span-level audits.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume a larger context window removes the need for packing. More tokens can add distraction, latency, and position sensitivity. Do not treat top-k retrieval order as prompt order. Do not compress citation-bearing evidence without preserving coordinates. Do not optimize for token count alone; missing one legal exception can be worse than spending another 200 tokens.',
        'Context packing is also not a replacement for retrieval. If the candidate pool never contains the support, no packer can recover it. Packing belongs after Multi-Index RAG, Reciprocal Rank Fusion, filtered retrieval, dedup, and reranking.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lost in the Middle at https://arxiv.org/abs/2307.03172 and https://aclanthology.org/2024.tacl-1.9/, LLMLingua at https://arxiv.org/html/2310.05736v2 and https://aclanthology.org/2023.emnlp-main.825/, LongLLMLingua at https://arxiv.org/abs/2310.06839 and Microsoft Research overview at https://www.microsoft.com/en-us/research/project/llmlingua/longllmlingua/.',
        'Study Maximal Marginal Relevance, Multi-Index RAG, RAG Citation Span Index Case Study, RAG Claim Verification Support Ledger, RAG Dedup, MinHash, and Chunk Canonicalization, Lost in the Middle: Long-Context Failure Modes, Sliding-Window Attention Context Policy, Chain of Draft Reasoning Token Budget Case Study, On-Device LLM Inference Cost Crossover, Cross-Encoder Reranker, and RAG Evaluation next.',
      ],
    },
  ],
};
