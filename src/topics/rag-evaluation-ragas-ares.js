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
  const metricCount = 4; // recall, precision, faithfulness, relevance
  const pipelineStages = 7; // nodes in the eval pipeline graph
  const maxTopK = 20; // max x-axis in the plot

  yield {
    state: evalPipeline('RAG evals split the pipeline into layers'),
    highlight: { active: ['query', 'retriever', 'ranker', 'generator', 'judge'], found: ['matrix'] },
    explanation: `A RAG answer can fail at any of ${pipelineStages} pipeline stages because retrieval missed evidence, ranking buried it, generation ignored it, or the judge misread it. Component metrics keep those ${metricCount} failure dimensions separate.`,
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
    explanation: `RAGAS-style evaluation separates retriever quality from generator quality across ${metricCount} metrics. That matters because fixing the wrong layer wastes time and can make the product worse.`,
    invariant: `A faithful answer cannot cite evidence that retrieval never found — ${metricCount} metrics exist precisely to isolate which layer broke.`,
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
    explanation: `Adding more chunks (up to ${maxTopK}) can improve recall while lowering precision. The right top-k is a context-budget decision, not a universal constant.`,
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
    explanation: `The score matrix should point to action across all ${metricCount} dimensions. Low recall is an index problem. Low precision is a ranking/context-packing problem. Low faithfulness is a grounding or generator problem.`,
  };
}

function* judgeAndHoldout() {
  const judgeDesigns = 4; // RAGAS, ARES, RAG Triad, human
  const holdoutQueues = 4; // dev, holdout, fresh, slices
  const monitorSignals = 4; // recall proxy, faith proxy, latency, cost

  yield {
    state: evalPipeline('Automated judges need calibration and holdouts'),
    highlight: { active: ['judge', 'matrix', 'e-judge-matrix'], compare: ['claims'], found: ['query'] },
    explanation: `All ${judgeDesigns} judge designs (RAGAS, ARES, RAG Triad, human) make automated evaluation faster, but a judge score is not truth. Calibrate it against human labels and keep a holdout set that prompt changes do not train on.`,
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
    explanation: `The ${judgeDesigns} frameworks differ, but the decomposition is similar: judge context relevance, answer support, and answer usefulness separately rather than relying on a single pleasantness score.`,
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
    explanation: `RAG systems overfit evals too. Maintain ${holdoutQueues} separate queues so that every prompt tweak is not optimized against the same public examples, turning the score into a training artifact.`,
    invariant: `Keep all ${holdoutQueues} queues (dev, holdout, fresh failures, risk slices) separate — leaking between them destroys generalization evidence.`,
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
    explanation: `Offline evals catch known failures. ${monitorSignals} production monitor signals catch drift: corpus changes, user-language shifts, embedding upgrades, retriever outages, and slow rerankers.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a diagnostic path for retrieval-augmented generation, or RAG, where a model answers using retrieved documents. Each highlighted stage is a separate place the answer can fail before the final text appears.',
        {type: 'image', src: './assets/gifs/rag-evaluation-ragas-ares.gif', alt: 'Animated walkthrough of the rag evaluation ragas ares visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that one final answer score does not identify the broken component. A low groundedness score points at unsupported claims, while a low context-relevance score points at retrieval or ranking before generation even starts.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG evaluation exists because fluent answers can hide broken evidence chains. The retriever may miss the source, the ranker may bury it, the generator may ignore it, or the judge may reward text that sounds correct.',
        {type: 'callout', text: 'RAG evaluation is useful only when it names the broken layer: retrieval, ranking, grounding, answer relevance, or judge reliability.'},
        'Frameworks such as RAGAS and ARES turn that blended judgment into component tests. The goal is not a prettier dashboard; it is knowing which layer to fix when users receive a wrong answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to grade the final answer against a reference answer. That works for small exams because the expected answer is known and the grader can compare surface meaning.',
        'A second approach is manual review by subject experts. It catches subtle failures, but it is slow, expensive, and too sparse to guide every retrieval, chunking, ranking, and prompt change.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is attribution. If answer accuracy drops from 86 percent to 72 percent after a retriever change, the final score does not say whether the new retriever lost evidence, added distractors, or changed the generator context window.',
        'Reference answers also age badly in live systems. A company policy, product price, or legal rule can change, so a static gold answer may punish the system for using newer evidence or reward stale behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to evaluate the evidence path, not only the final sentence. A RAG example has a query, retrieved chunks, generated claims, and a judgment, and each edge in that chain needs its own test.',
        'RAGAS emphasizes metrics such as context precision, context recall, faithfulness, and answer relevance. ARES adds trained or lightweight judges calibrated with a smaller human-labeled set, so evaluation can scale while staying tied to human judgments.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each query, the evaluator stores the retrieved contexts and the generated answer. It checks whether relevant evidence was retrieved, whether irrelevant chunks polluted the context, whether answer claims are supported by the context, and whether the answer addresses the question.',
        {type: 'image', src: 'https://www.tensorflow.org/static/tfx/guide/images/prog_fin.png', alt: 'Machine learning pipeline diagram from data ingestion through validation and serving', caption: 'Pipeline diagrams make component boundaries explicit, which is exactly what RAG evaluation needs for retrieval, ranking, generation, and judging. Source: TensorFlow documentation.'},
        'A good evaluation run separates development cases from holdout cases. Teams can tune chunking and prompts on the development queue, but the holdout queue protects against optimizing to the evaluator instead of improving the product.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A RAG eval record is a directed evidence path from query to context to claims to judgment, not a single answer score. Source: Wikimedia Commons, David W., public domain.'},
        'Correctness comes from decomposition. If each answer claim must be supported by retrieved context, unsupported claims can be identified even when the final answer is fluent.',
        'The method is trustworthy only when the judges are calibrated. Human labels, adversarial cases, and disagreement audits test whether the metric actually tracks the failure it names.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost grows with examples, retrieved chunks, generated claims, and judge calls. If 1,000 queries retrieve 8 chunks each and a judge call costs 2,000 tokens, one full evaluation can consume millions of tokens before any model serving cost is counted.',
        'When top-k doubles from 5 to 10, recall may rise because the right chunk has more chances to appear, but precision and latency often fall because the generator must read more distractors. Evaluation cost behaves like a pipeline tax: every extra candidate multiplies later comparison and judgment work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RAG evaluation is useful for search assistants, support agents, legal research tools, internal knowledge bases, and medical or financial copilots where the source matters as much as the answer. It helps teams decide whether to tune retrieval, reranking, chunking, prompting, or citation policy.',
        'It also belongs in regression testing. A release should not ship only because the average answer score improved if faithfulness fell on high-risk slices.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the judge is treated as ground truth. A language-model judge can miss domain facts, prefer verbose answers, or reward citation-looking text that does not support the claim.',
        'It also fails when metrics collapse into one score. A high average can hide a dangerous slice, and a reference-free faithfulness check cannot prove the retrieved source itself is true.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 100 policy questions are tested and each query retrieves 5 chunks. The system answers 78 questions acceptably, but context recall is 0.62 and faithfulness is 0.91, which means many answers are grounded when the source appears but the retriever often misses the needed source.',
        'After changing chunking, recall rises to 0.81 while faithfulness drops to 0.76 because longer chunks add stale policy text. The right fix is not a stronger generator; it is a retrieval and chunking pass that improves recall without feeding contradictory context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the RAGAS paper, the ARES paper, and documentation for the RAG Triad framing from TruLens. Focus on metric definitions, judge calibration, and how each framework separates retrieval quality from generation quality.',
        'Study information retrieval evaluation, precision and recall, reranking, calibration, data leakage, benchmark variance, and human evaluation design next. These topics explain why a RAG score is a measurement system, not a magic label.',
      ],
    },
  ],
};
