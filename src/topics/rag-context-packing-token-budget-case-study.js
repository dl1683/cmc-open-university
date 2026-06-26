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
    explanation: 'Read the packer as the prompt budget allocator. Retrieval returns possibilities; packing decides which evidence, citations, and instructions actually reach the model.',
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
    explanation: 'The table is a budget ledger. A high-ranked duplicate can still be a bad prompt item if it spends tokens without adding new support, freshness, or citation value.',
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
    explanation: 'Selection is not the end. The placement frame shows that important spans can lose influence if they are buried in the middle of a long prompt.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each candidate chunk as evidence with a value and a token cost. The packer is not asking which chunk ranked first; it is asking which set of evidence best fits the prompt budget.',
        'The placement view matters because long-context models do not use every position equally. A chunk can be selected and still be wasted if the controlling sentence is buried where the model underuses it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG retrieval returns candidate evidence, but the model receives a fixed context window. That window must hold instructions, the user request, selected evidence, citation handles, tool results, and sometimes prior conversation.',
        'Context packing exists because raw top-k retrieval wastes tokens on duplicates, stale pages, boilerplate, and passages that are related but not answer-bearing. The packer turns a retrieval pool into a compact evidence packet.',
        {type:'callout', text:'Context packing is retrieval budgeting: every included token must earn its place by adding useful, nonredundant, auditable evidence to the prompt.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/fd/Knapsack.svg', alt:'Knapsack problem illustration with boxes of different weights and values.', caption:'Knapsack problem illustration. Context packing has the same budget shape: choose the highest-value evidence that fits within a fixed token limit. Source: Wikimedia Commons, Dake, CC BY-SA 2.5.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is top-k stuffing. Retrieve the highest-ranked chunks and paste them into the prompt until the token limit is reached.',
        'That works when the answer is in one short chunk and the corpus is clean. It breaks when high-ranked chunks are redundant, long, stale, permission-restricted, or missing the specific exception the answer needs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that relevance is not the same as prompt value. A 900-token policy page can rank highly while only one 40-token exception sentence matters.',
        'A larger context window does not remove the problem. More tokens can increase latency, cost, distraction, and position sensitivity, so the packer still has to choose and place evidence deliberately.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Context packing is constrained selection. Each candidate has utility, token cost, redundancy, source role, freshness, permission state, and citation spans.',
        'The best packet is not always the top-ranked packet. A lower-ranked chunk with the missing exception can be more valuable than a duplicate of the top result.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple packer starts with reranked candidates, removes blocked or stale chunks, deduplicates near copies, scores utility per token, and selects evidence under a budget. More careful systems add diversity penalties, source-role quotas, sentence extraction, table row slicing, and citation-span preservation.',
        'Compression must be typed. Boilerplate can be dropped, table rows need headers, direct quotes should preserve coordinates, and answer-bearing claims need citation handles that survive trimming.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is evidence coverage under budget. If every necessary claim has at least one preserved source span in the packet, and unsupported or stale spans are excluded, the generator has the material needed to answer without inventing support.',
        'Packing cannot create evidence that retrieval missed. Its guarantee is narrower: given a candidate pool, it spends the context window on distinct, current, allowed, citation-preserving evidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Packing adds token counting, redundancy checks, metadata filters, sentence scoring, citation validation, and sometimes a compression model. If generation costs 800 ms and packing costs 60 ms, that overhead may be worth it when it prevents a wrong or uncited answer.',
        'The dominant cost changes with corpus shape. A clean FAQ may need only top-k plus light dedup, while a policy corpus with tables, stale copies, and access controls may need heavier validation before any chunk enters the prompt.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Context packing fits customer support, policy assistants, legal research, code search, medical knowledge bases, and any RAG workflow where the prompt budget is smaller than the useful retrieval pool. It is most valuable when evidence has exceptions, dates, permissions, or citations that must stay attached.',
        'It also helps evaluation. Teams can test claim support, citation validity after compression, token count, position robustness, p95 latency, and failure behavior when the decisive source is long or tabular.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Packing fails when it optimizes the wrong objective. Minimizing tokens can remove the exception that makes the answer correct, and maximizing rank can fill the prompt with repeated versions of the same fact.',
        'It also fails when compression breaks provenance. A summary detached from its source span may read well, but it is no longer auditable evidence for a citation-sensitive answer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A renewal-cancellation query has a 1200-token prompt budget for evidence. Retrieval returns a 700-token current policy worth 70 points, a 650-token stale duplicate worth 50, a 180-token fee table row worth 35, a 120-token renewal date rule worth 30, and a 250-token FAQ worth 25.',
        'Top-k stuffing may spend 1350 tokens on the current policy and stale duplicate, then drop the fee row. A packer keeps 350 extracted tokens from the current policy, the 180-token fee row with headers, the 120-token date rule, and the 250-token FAQ for 900 tokens with better answer coverage.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lost in the Middle for position sensitivity, LLMLingua and LongLLMLingua for prompt compression, and maximal marginal relevance for diversity-aware selection. These are the core ideas behind budgeted evidence construction.',
        'Study multi-index RAG, RAG deduplication, citation span indexes, cross-encoder reranking, chain-of-draft token budgets, and RAG evaluation next. Packing sits between retrieval and generation, so both sides affect it.',
      ],
    },
  ],
};
