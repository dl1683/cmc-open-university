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
      heading: 'Why this exists',
      paragraphs: [
        `RAG evaluation exists because a retrieval-augmented answer can fail in several places while still sounding plausible. The retriever may miss the needed source. The ranker may bury it below irrelevant chunks. The generator may ignore the source and invent a claim. The answer may be faithful to the context but not to the user's question. A single "good answer" score cannot tell the team which part to fix.`,
        `RAGAS, ARES, and the RAG Triad are useful because they turn that blended judgment into component questions. RAGAS popularized reference-free metrics such as context precision, context recall, faithfulness, and response or answer relevance. ARES evaluates context relevance, answer faithfulness, and answer relevance with synthetic data, lightweight judges, and a small human-labeled set. The RAG Triad frames the same pressure as context relevance, groundedness, and answer relevance.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to sample a few answers, ask a human whether they look right, and track a thumbs-up rate in production. That is not useless. It catches embarrassing failures and gives product teams a rough sense of whether users are satisfied. The problem is that it mixes retrieval quality, answer writing, citation behavior, user intent, and judge taste into one bucket.`,
        `Another common approach is exact match against reference answers. That works for closed tasks with short answers, but many RAG systems answer policy, support, medical, legal, engineering, or enterprise-knowledge questions where several phrasings can be correct and a fluent answer can be dangerously unsupported. A model can match the reference theme while citing nothing, or cite the right passage while answering the wrong question.`,
        `The failure is diagnosis and overfitting. If the final score drops after an embedding-model upgrade, the team needs to know whether recall fell, precision fell, answer style changed, or the judge drifted. Reusing the same visible examples for every prompt, chunking, and reranking change also turns the eval set into training data. A development win can disappear on fresh user questions and high-risk slices.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to evaluate the RAG pipeline at the same boundaries where the system can be changed. Retrieval metrics ask whether the needed evidence entered the context. Ranking metrics ask whether useful evidence appeared high enough to matter. Grounding metrics ask whether generated claims are supported by retrieved evidence. Relevance metrics ask whether the answer addressed the question.`,
        `That decomposition turns scores into engineering actions. Low context recall points toward query rewriting, corpus coverage, embedding quality, index freshness, or hybrid retrieval. Low context precision points toward deduplication, filters, reranking, top-k tuning, and context packing. Low faithfulness points toward claim extraction, citation constraints, answer planning, or generation model behavior. Low answer relevance points toward intent classification and response structure.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A serious eval case stores the user question, retrieved chunks, chunk ranks, generated answer, citations, expected supporting facts when available, corpus version, retriever version, top-k, reranker version, model, prompt, and risk slice. The scorer then asks separate questions over the same record. Did the retrieved context contain the needed evidence? Were relevant chunks ranked above irrelevant chunks? Are answer claims supported by the retrieved context? Did the answer respond to the user's actual request?`,
        `RAGAS can run many of these checks with LLM-based or reference-free metrics. ARES adds a different pattern: generate synthetic training data, fine-tune lightweight judges for component judgments, and use a smaller human-labeled set with prediction-powered inference to estimate evaluation results. The lesson is not that one framework is enough. The lesson is that an evaluation suite needs reusable cases, explicit metric definitions, calibration against human labels, and separate development and holdout queues.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The graph view proves that evaluation is not attached only to the final answer. It sits beside retrieval, ranking, generation, claim extraction, and judging. A failure at an earlier layer constrains every later layer. A faithful generator cannot quote evidence that never entered the context window, and a high-quality retriever still cannot guarantee a grounded answer if generation ignores the evidence.`,
        `The top-k plot proves the recall-precision trade. Adding chunks usually gives the answerer more chances to see the right fact, but it also adds distractors, stale policy, duplicate passages, and token cost. The diagnosis table proves why the metric matrix should point to a fix. Low recall, low precision, low faithfulness, and low answer relevance are different failures, not four names for bad output.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Layered evaluation works because each component has a partial contract. The retriever's contract is to return enough relevant evidence. The ranker's contract is to order useful evidence before noise. The generator's contract is to answer with claims supported by the context. The judge's contract is to measure the intended property rather than reward fluency. When those contracts are scored separately, the system can fail loudly at the boundary that caused the regression.`,
        `Holdout discipline works for the same reason it works in ordinary machine learning. A development set supports rapid iteration. A holdout set estimates whether changes generalize. Production failure queues keep the benchmark from freezing around yesterday's mistakes. Slice reporting protects rare but important cases, such as low-resource languages, long documents, conflicting policies, tables, scanned PDFs, or regulated advice.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `RAG evaluation is expensive because it can replay retrieval, regenerate answers, call one or more judges, sample humans, synthesize questions, and run across many corpus and prompt versions. The cost should be staged. Deterministic checks catch broken citations, empty contexts, stale corpus versions, and schema errors cheaply. Judge calls handle ambiguous quality judgments. Human labels calibrate the judges and protect high-stakes slices.`,
        `The tradeoff is measurement noise. LLM judges have variance, position bias, verbosity bias, and domain blind spots. Synthetic questions can be too easy or too close to the corpus. Human labels can disagree because the policy itself is ambiguous. A good evaluation suite reports confidence, sample counts, slice sizes, and known judge weaknesses instead of pretending that a score with two decimal places is ground truth.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Layered RAG evals win in systems with multiple knobs: chunking, embedding model, sparse retrieval, dense retrieval, hybrid fusion, reranking, context packing, prompt templates, generation models, citation rules, and safety filters. If a policy assistant regresses after an embedding upgrade, component metrics can show that recall improved but precision fell because outdated near-duplicates moved into the top-k. The fix is then corpus tombstones, freshness filters, reranking, or deduplication, not a vague instruction to the generator.`,
        `They also win when teams need release gates. A deployment can require no holdout regression on faithfulness, no drop in recall for critical slices, no increase in unsupported claims, and acceptable p95 latency and judge cost. That gate is more useful than a single average score because it blocks changes that improve common easy questions while harming rare dangerous ones.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The largest failure is collapsing everything back into one score. High answer relevance can hide unsupported claims. High context recall can hide context stuffing. High faithfulness can still answer the wrong question if the retrieved context was irrelevant. Another failure is judge laundering: a team treats the LLM judge as truth because it is cheaper than labels. Judges should be audited, calibrated, and periodically challenged with adversarial and fresh production examples.`,
        `Multimodal and adaptive RAG add more surfaces. A page can be retrieved while the wrong region is cited. A table can be visible in a PDF while cell extraction fails. A Self-RAG-style system can incorrectly decide not to retrieve. Those systems need page recall, region grounding, modality attribution, retrieval necessity, and answer faithfulness as separate checks.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study RAG Pipeline for the basic retrieval-generation flow, ANN Recall-Latency Pareto Ledger for retriever operating points, Cross-Encoder Reranker for precision control, Reciprocal Rank Fusion for hybrid retrieval, RAG Claim Verification Support Ledger for claim-level grounding, Query Expansion HyDE RAG Fusion for recall repair, Self-RAG Adaptive Retrieval and Critique for retrieval decisions, LLM Judge Calibration and Drift Monitor for evaluator reliability, and Benchmark Variance and Model Selection for confidence intervals and release gates.`,
      ],
    },
  ],
};
