// AI engineering stack primer: diagnose ML systems through data, model,
// compute, evaluation, and serving rather than treating the model as the system.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-engineering-stack-five-parts-primer',
  title: 'AI Engineering Stack: Five Parts Primer',
  category: 'Systems',
  summary: 'A primer for diagnosing AI systems through data, model, compute, evaluation, and serving constraints, with links into MLOps and LLM serving topics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['five-part map', 'constraint triage'], defaultValue: 'five-part map' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'data', label: 'data', x: 0.7, y: 3.7, note: 'rows+labels' },
      { id: 'model', label: 'model', x: 2.4, y: 3.7, note: 'function' },
      { id: 'compute', label: 'compute', x: 4.1, y: 3.7, note: 'budget' },
      { id: 'eval', label: 'eval', x: 5.8, y: 3.7, note: 'score' },
      { id: 'serving', label: 'serving', x: 7.5, y: 3.7, note: 'API+p99' },
      { id: 'feedback', label: 'feedback', x: 9.2, y: 3.7, note: 'new data' },
    ],
    edges: [
      { id: 'e-data-model', from: 'data', to: 'model' },
      { id: 'e-model-compute', from: 'model', to: 'compute' },
      { id: 'e-compute-eval', from: 'compute', to: 'eval' },
      { id: 'e-eval-serving', from: 'eval', to: 'serving' },
      { id: 'e-serving-feedback', from: 'serving', to: 'feedback' },
      { id: 'e-feedback-data', from: 'feedback', to: 'data' },
    ],
  }, { title });
}

function triageGraph(title) {
  return graphState({
    nodes: [
      { id: 'symptom', label: 'symptom', x: 0.7, y: 3.7, note: 'what broke?' },
      { id: 'data', label: 'data', x: 2.8, y: 1.5, note: 'quality' },
      { id: 'model', label: 'model', x: 2.8, y: 2.8, note: 'fit' },
      { id: 'compute', label: 'compute', x: 2.8, y: 4.3, note: 'resource' },
      { id: 'eval', label: 'eval', x: 2.8, y: 5.8, note: 'proxy' },
      { id: 'serving', label: 'serving', x: 5.0, y: 3.7, note: 'runtime' },
      { id: 'fix', label: 'fix', x: 7.3, y: 3.7, note: 'small move' },
      { id: 'measure', label: 'measure', x: 9.2, y: 3.7, note: 'rerun' },
    ],
    edges: [
      { id: 'e-symptom-data', from: 'symptom', to: 'data' },
      { id: 'e-symptom-model', from: 'symptom', to: 'model' },
      { id: 'e-symptom-compute', from: 'symptom', to: 'compute' },
      { id: 'e-symptom-eval', from: 'symptom', to: 'eval' },
      { id: 'e-data-serving', from: 'data', to: 'serving' },
      { id: 'e-model-serving', from: 'model', to: 'serving' },
      { id: 'e-compute-serving', from: 'compute', to: 'serving' },
      { id: 'e-eval-serving', from: 'eval', to: 'serving' },
      { id: 'e-serving-fix', from: 'serving', to: 'fix' },
      { id: 'e-fix-measure', from: 'fix', to: 'measure' },
    ],
  }, { title });
}

function* fivePartMap() {
  yield {
    state: stackGraph('AI systems have five moving parts'),
    highlight: { active: ['data', 'model', 'compute', 'eval', 'serving'], found: ['feedback'] },
    explanation: 'The local learning notes frame AI as an engineering stack: data, model, compute, evaluation, and serving. The model is only one part. Most production failures happen at the boundaries.',
    invariant: 'Ask which part changed before asking which algorithm is fashionable.',
  };

  yield {
    state: labelMatrix(
      'Five-part failure map',
      [
        { id: 'data', label: 'data' },
        { id: 'model', label: 'model' },
        { id: 'compute', label: 'compute' },
        { id: 'eval', label: 'eval' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['datasets', 'leak/skew'],
        ['weights', 'overfit'],
        ['GPU/jobs', 'OOM/slow'],
        ['scores', 'bad proxy'],
        ['API', 'p99/cost'],
      ],
    ),
    highlight: { active: ['data:failure', 'eval:failure', 'serving:failure'], found: ['compute:failure'] },
    explanation: 'A useful mental model starts with artifacts. Data has datasets and labels. Models have weights and configs. Compute has jobs and memory. Evals have scores and cases. Serving has APIs, latency, and cost.',
  };

  yield {
    state: labelMatrix(
      'Artifacts to keep',
      [
        { id: 'data', label: 'data card' },
        { id: 'run', label: 'run log' },
        { id: 'model', label: 'model card' },
        { id: 'eval', label: 'eval report' },
        { id: 'deploy', label: 'deploy log' },
      ],
      [
        { id: 'records', label: 'records' },
        { id: 'debugs', label: 'debugs' },
      ],
      [
        ['source+time', 'label drift'],
        ['config+seed', 'repro'],
        ['weights+hash', 'rollback'],
        ['cases+slices', 'bad proxy'],
        ['route+p99', 'user harm'],
      ],
    ),
    highlight: { found: ['data:records', 'run:records', 'eval:records', 'deploy:records'] },
    explanation: 'This is where MLOps becomes concrete. You cannot debug what you did not record: source windows, run configs, model hashes, eval slices, deployment routes, and p99 behavior.',
  };

  yield {
    state: stackGraph('Serving feeds the next data distribution'),
    highlight: { active: ['serving', 'feedback', 'data', 'e-serving-feedback', 'e-feedback-data'], compare: ['model', 'eval'] },
    explanation: 'Serving is not the end of the system. Product changes, routing, UI, cache behavior, and model outputs change what users do next, which changes the future training distribution.',
  };

  yield {
    state: labelMatrix(
      'First diagnostic question',
      [
        { id: 'flat', label: 'loss flat' },
        { id: 'oom', label: 'OOM' },
        { id: 'p99', label: 'p99 high' },
        { id: 'online', label: 'online drop' },
        { id: 'stale', label: 'stale truth' },
      ],
      [
        { id: 'suspect', label: 'suspect' },
        { id: 'read', label: 'read next' },
      ],
      [
        ['data/model', 'Loss'],
        ['compute', 'ZeRO'],
        ['serving', 'Tail p99'],
        ['skew', 'Feature Store'],
        ['labels', 'MLOps'],
      ],
    ),
    highlight: { active: ['online:suspect', 'p99:suspect', 'oom:suspect'], found: ['online:read'] },
    explanation: 'The five-part map is a routing table for debugging. A plateau, memory fault, p99 regression, online/offline gap, or label delay points to a different next investigation.',
  };
}

function* constraintTriage() {
  yield {
    state: plotState({
      axes: { x: { label: 'relative cost', min: 0, max: 100 }, y: { label: 'task quality', min: 0, max: 100 } },
      series: [
        { id: 'bigger', label: 'bigger model', points: [{ x: 15, y: 55 }, { x: 35, y: 68 }, { x: 75, y: 76 }, { x: 95, y: 78 }] },
        { id: 'betterdata', label: 'better data', points: [{ x: 15, y: 55 }, { x: 25, y: 67 }, { x: 38, y: 76 }, { x: 52, y: 82 }] },
        { id: 'serving', label: 'serving fix', points: [{ x: 15, y: 55 }, { x: 22, y: 58 }, { x: 30, y: 61 }, { x: 38, y: 63 }] },
      ],
      markers: [
        { id: 'knee', x: 52, y: 82, label: 'good trade' },
      ],
    }),
    highlight: { active: ['betterdata', 'knee'], compare: ['bigger'], found: ['serving'] },
    explanation: 'Constraints are the curriculum. More model can be the wrong move if data quality, eval proxy, p99 latency, or serving cost is the real bottleneck.',
  };

  yield {
    state: labelMatrix(
      'Constraint triage',
      [
        { id: 'data', label: 'data' },
        { id: 'model', label: 'model' },
        { id: 'compute', label: 'compute' },
        { id: 'eval', label: 'eval' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'small move', label: 'small move' },
      ],
      [
        ['right rows?', 'audit slices'],
        ['too complex?', 'simple base'],
        ['fits budget?', 'profile'],
        ['right proxy?', 'human audit'],
        ['p99 ok?', 'canary'],
      ],
    ),
    highlight: { active: ['data:small move', 'eval:small move', 'serving:small move'], compare: ['model:question'] },
    explanation: 'The best next move is often small: audit slices, build a baseline, profile memory, inspect eval failures, or canary serving behavior. These moves improve judgment before adding complexity.',
  };

  yield {
    state: triageGraph('Triage starts from the observed symptom'),
    highlight: { active: ['symptom', 'data', 'model', 'compute', 'eval', 'serving'], found: ['fix', 'measure'] },
    explanation: 'Treat a bad result as a systems incident. Split the symptom across the five parts, choose the smallest reversible intervention, and rerun the same measurement.',
  };

  yield {
    state: labelMatrix(
      'Role-specific lens',
      [
        { id: 'manager', label: 'manager' },
        { id: 'mle', label: 'MLE' },
        { id: 'researcher', label: 'researcher' },
      ],
      [
        { id: 'focus', label: 'focus' },
        { id: 'question', label: 'question' },
      ],
      [
        ['ROI + risk', 'what fails?'],
        ['tradeoffs', 'what changed?'],
        ['new method', 'what proof?'],
      ],
    ),
    highlight: { found: ['manager:question', 'mle:question', 'researcher:question'] },
    explanation: 'The same map helps different roles. Product leaders need risk and ROI. Engineers need tradeoffs and reproducibility. Researchers need proof that a method improves the real bottleneck.',
  };

  yield {
    state: labelMatrix(
      'When to add complexity',
      [
        { id: 'data', label: 'new data' },
        { id: 'feature', label: 'new feature' },
        { id: 'model', label: 'new model' },
        { id: 'infra', label: 'new infra' },
      ],
      [
        { id: 'good sign', label: 'good sign' },
        { id: 'bad sign', label: 'bad sign' },
      ],
      [
        ['fills gap', 'unclear source'],
        ['known signal', 'leaks label'],
        ['wins slices', 'only avg win'],
        ['cuts p99', 'tool fashion'],
      ],
    ),
    highlight: { active: ['data:good sign', 'model:good sign', 'infra:good sign'], compare: ['feature:bad sign'] },
    explanation: 'Complexity should buy a known thing: missing coverage, a real signal, slice wins, lower p99, lower cost, or better rollback. Otherwise it becomes hidden technical debt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'five-part map') yield* fivePartMap();
  else if (view === 'constraint triage') yield* constraintTriage();
  else throw new InputError('Pick an AI engineering stack view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The five-part AI engineering stack is a diagnostic map: data, model, compute, evaluation, and serving. It is deliberately simple because it forces the right question: which part of the system is actually constraining progress? A model upgrade does not fix stale labels, a bad proxy metric, GPU memory pressure, training-serving skew, or p99 latency.',
        'The local learning notes frame constraints as the curriculum. GPU memory, latency, flaky data, cost, label delay, and deployment friction are not distractions from AI engineering; they are where engineering judgment forms. This primer makes that judgment explicit and links each part to deeper topics in the repo.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Data is the rows, labels, sources, timestamps, ownership, and leakage boundary. Model is the function family, loss, weights, calibration, and failure slices. Compute is training time, memory, accelerators, kernels, batching, and budget. Evaluation is the proxy you trust before launch: held-out sets, golden cases, rubrics, confidence intervals, and human audit. Serving is the runtime path: API, p99, cache, feature lookups, rollback, cost, monitoring, and feedback into future data.',
        'The loop matters. Serving decisions change user behavior and therefore future data. Evaluation cases can get overfit. Compute limits push smaller models or better features. Data quality can dominate model choice. A mature team moves around the loop intentionally instead of treating training as the whole job.',
      ],
    },
    {
      heading: 'Diagnostic workflow',
      paragraphs: [
        'Start from the symptom. If the loss plateaus, inspect data slices, labels, baseline model behavior, and objective shape. If memory fails, inspect model size, sequence length, batch size, activation storage, optimizer state, and inference KV cache. If offline metrics rise but online metrics drop, inspect feature skew, delayed labels, traffic slices, and serving code. If p99 latency rises, inspect batching, cache misses, model route, retrieval, and tail amplification.',
        'Then choose the smallest reversible move. Add a data audit before retraining. Add a simple baseline before changing architecture. Profile memory before buying GPUs. Add a slice eval before trusting an average. Canary a serving change before full rollout. This is the engineering version of scientific method: isolate one bottleneck, change one thing, measure again.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Google Rules of Machine Learning emphasizes robust end-to-end pipelines, simple first models, metrics, and infrastructure before complex algorithms: https://developers.google.com/machine-learning/guides/rules-of-ml. That aligns with the five-part map: a reliable pipeline teaches more than a fashionable model that cannot be debugged.',
        'TFX describes production ML as an end-to-end pipeline with components for scalable ML tasks and deployment: https://www.tensorflow.org/tfx. The ML Test Score paper frames production readiness around testing and monitoring needs, not only model accuracy: https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/. Hidden Technical Debt in Machine Learning Systems warns that ML adds system-level maintenance risks beyond ordinary code: https://research.google/pubs/hidden-technical-debt-in-machine-learning-systems/.',
      ],
    },
    {
      heading: 'Common failure patterns',
      paragraphs: [
        'A data failure looks like leakage, stale labels, missing negatives, bad joins, drift, or an unrepresentative training slice. A model failure looks like overfit, underfit, miscalibration, brittle slices, shortcut learning, or a loss that optimizes the wrong behavior. A compute failure looks like OOM, slow iteration, expensive inference, memory bandwidth limits, or low utilization. An eval failure looks like a bad proxy, benchmark overfit, missing slices, or high variance. A serving failure looks like p99 latency, cost blowups, cache errors, stale features, rollback gaps, or user feedback loops.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'For data, study Feature Store, Point-in-Time Feature Join Index, Training-Serving Skew Replay Diff, and Data Leakage & Contamination. For models, study Loss Landscapes, Calibration Curves, Benchmark Variance & Model Selection, Scaling as Local Optimum Case Study, and Regularization. For compute, study Activation Checkpointing, ZeRO Optimizer, Transformer Inference Roofline, and LLM Inference Cost Stack. For evaluation, study Cross-Validation, A/B Testing, LLM Evaluation Harness, RAG Evaluation, and AI Audit Evidence Packet Case Study. For serving, study Tail Latency, Feature Flag Control Plane, Distributed Tracing, Semantic Cache for LLMs, and On-Device LLM Inference Cost Crossover.',
      ],
    },
  ],
};
