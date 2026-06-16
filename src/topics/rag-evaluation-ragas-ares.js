// RAG evaluation: split retrieval, ranking, grounding, and answer quality so a
// RAG pipeline can be debugged instead of judged by one blended score.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-evaluation-ragas-ares',
  title: 'RAG Evaluation: RAGAS, ARES, and the RAG Triad',
  category: 'AI & ML',
  summary: 'Evaluate RAG systems component by component: context recall, context precision, groundedness, answer relevance, judges, and holdouts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['component metrics', 'judge and holdout'], defaultValue: 'component metrics' },
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

function evalPipeline(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.4, note: 'case' },
      { id: 'retriever', label: 'retrieve', x: 2.4, y: 3.4, note: 'context' },
      { id: 'ranker', label: 'rank', x: 4.0, y: 3.4, note: 'top-k' },
      { id: 'generator', label: 'answer', x: 5.7, y: 3.4, note: 'LLM' },
      { id: 'claims', label: 'claims', x: 7.3, y: 2.6, note: 'facts' },
      { id: 'judge', label: 'judge', x: 7.3, y: 4.45, note: 'scores' },
      { id: 'matrix', label: 'matrix', x: 9.0, y: 3.4, note: 'slices' },
    ],
    edges: [
      { id: 'e-query-retriever', from: 'query', to: 'retriever' },
      { id: 'e-retriever-ranker', from: 'retriever', to: 'ranker' },
      { id: 'e-ranker-generator', from: 'ranker', to: 'generator' },
      { id: 'e-generator-claims', from: 'generator', to: 'claims' },
      { id: 'e-claims-judge', from: 'claims', to: 'judge' },
      { id: 'e-judge-matrix', from: 'judge', to: 'matrix' },
      { id: 'e-ranker-judge', from: 'ranker', to: 'judge' },
    ],
  }, { title });
}

function* componentMetrics() {
  yield {
    state: evalPipeline('RAG evals split the pipeline into layers'),
    highlight: { active: ['query', 'retriever', 'ranker', 'generator', 'judge'], found: ['matrix'] },
    explanation: 'A RAG answer can fail because retrieval missed evidence, ranking buried it, generation ignored it, or the judge misread it. Component metrics keep those failures separate.',
  };

  yield {
    state: labelMatrix(
      'Core RAG metrics',
      [
        { id: 'recall', label: 'context recall' },
        { id: 'precision', label: 'context precision' },
        { id: 'faith', label: 'faithfulness' },
        { id: 'relevance', label: 'answer relevance' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'debugs', label: 'debugs' },
      ],
      [
        ['did we retrieve needed facts?', 'missing evidence'],
        ['did we rank useful chunks high?', 'context noise'],
        ['are claims supported?', 'hallucination'],
        ['did answer address query?', 'off-target answer'],
      ],
    ),
    highlight: { active: ['recall:debugs', 'precision:debugs', 'faith:debugs', 'relevance:debugs'] },
    explanation: 'RAGAS-style evaluation separates retriever quality from generator quality. That matters because fixing the wrong layer wastes time and can make the product worse.',
    invariant: 'A faithful answer cannot cite evidence that retrieval never found.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'retrieved top-k', min: 1, max: 20 }, y: { label: 'score', min: 0, max: 1.0 } },
      series: [
        { id: 'recall', label: 'context recall', points: [{ x: 1, y: 0.38 }, { x: 5, y: 0.70 }, { x: 10, y: 0.82 }, { x: 20, y: 0.91 }] },
        { id: 'precision', label: 'context precision', points: [{ x: 1, y: 0.92 }, { x: 5, y: 0.73 }, { x: 10, y: 0.55 }, { x: 20, y: 0.33 }] },
      ],
    }),
    highlight: { active: ['recall'], compare: ['precision'] },
    explanation: 'Adding more chunks can improve recall while lowering precision. The right top-k is a context-budget decision, not a universal constant.',
  };

  yield {
    state: labelMatrix(
      'Layered diagnosis',
      [
        { id: 'lowrecall', label: 'low recall' },
        { id: 'lowprec', label: 'low precision' },
        { id: 'lowfaith', label: 'low faith' },
        { id: 'lowrel', label: 'low answer rel' },
      ],
      [
        { id: 'likely fix', label: 'likely fix' },
        { id: 'avoid', label: 'avoid' },
      ],
      [
        ['add retriever or labels', 'prompt-only fix'],
        ['rerank and dedupe', 'bigger top-k'],
        ['claim grounding rules', 'trust citations blindly'],
        ['answer planner', 'more context stuffing'],
      ],
    ),
    highlight: { found: ['lowrecall:likely fix', 'lowprec:likely fix', 'lowfaith:likely fix', 'lowrel:likely fix'] },
    explanation: 'The score matrix should point to action. Low recall is an index problem. Low precision is a ranking/context-packing problem. Low faithfulness is a grounding or generator problem.',
  };
}

function* judgeAndHoldout() {
  yield {
    state: evalPipeline('Automated judges need calibration and holdouts'),
    highlight: { active: ['judge', 'matrix', 'e-judge-matrix'], compare: ['claims'], found: ['query'] },
    explanation: 'RAGAS, ARES, and the RAG Triad all make automated evaluation faster, but a judge score is not truth. Calibrate it against human labels and keep a holdout set that prompt changes do not train on.',
  };

  yield {
    state: labelMatrix(
      'Judge designs',
      [
        { id: 'ragas', label: 'RAGAS' },
        { id: 'ares', label: 'ARES' },
        { id: 'triad', label: 'RAG Triad' },
        { id: 'human', label: 'human audit' },
      ],
      [
        { id: 'move', label: 'main move' },
        { id: 'risk', label: 'watch' },
      ],
      [
        ['reference-free metrics', 'judge variance'],
        ['trained lightweight judges', 'domain drift'],
        ['context, groundedness, relevance', 'coarse slices'],
        ['gold labels', 'cost and delay'],
      ],
    ),
    highlight: { active: ['ragas:move', 'ares:move', 'triad:move'], compare: ['human:risk'] },
    explanation: 'The frameworks differ, but the decomposition is similar: judge context relevance, answer support, and answer usefulness separately rather than relying on a single pleasantness score.',
  };

  yield {
    state: labelMatrix(
      'Holdout discipline',
      [
        { id: 'dev', label: 'dev eval' },
        { id: 'holdout', label: 'holdout' },
        { id: 'fresh', label: 'fresh failures' },
        { id: 'slices', label: 'risk slices' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'misuse', label: 'misuse' },
      ],
      [
        ['iterate quickly', 'claim final win'],
        ['confirm generalization', 'peek every day'],
        ['expand coverage', 'only count wins'],
        ['protect tails', 'average away harm'],
      ],
    ),
    highlight: { active: ['holdout:purpose', 'fresh:purpose', 'slices:purpose'], removed: ['holdout:misuse'] },
    explanation: 'RAG systems overfit evals too. If every prompt tweak is optimized against the same public examples, the score becomes a training artifact.',
    invariant: 'Keep separate dev, holdout, and production-failure queues.',
  };

  yield {
    state: labelMatrix(
      'Production monitor',
      [
        { id: 'recall', label: 'recall proxy' },
        { id: 'faith', label: 'faith proxy' },
        { id: 'latency', label: 'latency' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'alert', label: 'alert when' },
      ],
      [
        ['empty or low-score context', 'retriever drift'],
        ['unsupported claims', 'grounding regression'],
        ['p95 and p99', 'reranker or top-k change'],
        ['tokens and judge calls', 'eval too expensive'],
      ],
    ),
    highlight: { active: ['recall:alert', 'faith:alert', 'latency:alert'], found: ['cost:signal'] },
    explanation: 'Offline evals catch known failures. Production monitors catch drift: corpus changes, user-language shifts, embedding upgrades, retriever outages, and slow rerankers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'component metrics') yield* componentMetrics();
  else if (view === 'judge and holdout') yield* judgeAndHoldout();
  else throw new InputError('Pick a RAG evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RAG evaluation measures a retrieval-augmented generation system by layer. A final answer can look fluent while the retriever missed the source, the reranker buried the right chunk, the generator invented a claim, or the judge gave credit for style. The point of RAGAS, ARES, and the RAG Triad is to separate those failure modes so teams know what to fix.',
        'This is the measurement companion to RAG Pipeline, Multi-Index RAG, Cross-Encoder Reranker, Multimodal RAG & ColPali Case Study, and LLM Evaluation Harnesses. Architecture without evals only produces plausible demos. A serious RAG system needs held-out questions, known supporting evidence, component metrics, LLM Judge Calibration & Drift Monitor, and slice reporting.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A RAG eval case stores the user question, retrieved contexts, generated answer, expected facts or reference answer when available, and metadata such as domain, corpus version, retriever version, top-k, model, and risk slice. The scorer then asks separate questions: did retrieval find the needed facts, were the useful chunks ranked high, did the answer use only supported claims, and did it answer the user question?',
        'RAGAS introduced reference-free metrics for RAG pipelines, including context precision, context recall, faithfulness, and answer relevancy: https://arxiv.org/abs/2309.15217. The RAGAS docs define context precision as ranking relevant chunks above irrelevant ones: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/, and context recall as recovering needed relevant information: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_recall/.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RAG evaluation is expensive because it can require retrieval replay, generator calls, judge calls, synthetic data, human labels, and repeated runs across prompts, models, indexes, and rerankers. It is still cheaper than shipping blind. Use cheap deterministic checks first, then judge calls for ambiguous quality dimensions, then human audit for high-stakes slices.',
        'ARES takes another route: it generates synthetic training data, fine-tunes lightweight judges, and uses a small set of human annotations with prediction-powered inference to evaluate context relevance, answer faithfulness, and answer relevance: https://arxiv.org/abs/2311.09476. The Stanford FutureData implementation is at https://github.com/stanford-futuredata/ARES.',
      ],
    },
    {
      heading: 'Complete case study: policy assistant regression',
      paragraphs: [
        'A policy assistant ships a new embedding model and improves average answer helpfulness. Users still report wrong refund answers. Layered RAG evals reveal the split: context recall improved because the new model finds more semantically similar chunks, but context precision fell because near-duplicate outdated policy chunks now crowd the top-k. Faithfulness also fell because the generator cites the old chunk when the current chunk is present but lower-ranked.',
        'The fix is not "make the prompt stricter." The likely fixes are corpus tombstones, freshness filters, Reciprocal Rank Fusion, Maximal Marginal Relevance, and reranker training. Then the team reruns the dev set, checks the sealed holdout, and monitors production for low-score contexts and unsupported claims.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not collapse RAG quality into one score. High answer relevance can hide unsupported claims. High context recall can hide noisy context stuffing. High faithfulness can still answer the wrong question. Do not assume LLM judges are ground truth; they have bias and variance and should be calibrated against human labels. Do not repeatedly tune on the holdout set.',
        'Multimodal RAG adds more failure surfaces. A page may be retrieved correctly while the wrong region is cited. A table may be visually present but cell extraction fails. Adaptive systems such as Self-RAG add another surface: the model can decide not to retrieve when evidence was required. For those systems, track retrieval necessity, page recall, region grounding, modality attribution, and answer faithfulness separately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RAGAS at https://arxiv.org/abs/2309.15217, RAGAS metrics at https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/, ARES at https://arxiv.org/abs/2311.09476, ARES ACL paper at https://aclanthology.org/2024.naacl-long.20/, ARES implementation at https://github.com/stanford-futuredata/ARES, and the TruLens RAG Triad at https://www.trulens.org/getting_started/core_concepts/rag_triad/. Study RAG Pipeline, Multi-Index RAG, RAG Claim Verification Support Ledger, ANN Recall-Latency Pareto Ledger, Cross-Encoder Reranker, Multimodal RAG & ColPali Case Study, Self-RAG: Adaptive Retrieval and Critique, LLM Evaluation Harnesses, LLM Judge Calibration & Drift Monitor, Benchmark Variance & Model Selection, and Data Leakage & Contamination next.',
      ],
    },
  ],
};
