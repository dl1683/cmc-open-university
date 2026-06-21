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
  const stackParts = ['data', 'model', 'compute', 'eval', 'serving'];
  const partCount = stackParts.length;
  const stackNodeCount = 6; // includes feedback
  const stackEdgeCount = 6;
  const artifactRows = ['data card', 'run log', 'model card', 'eval report', 'deploy log'];
  const diagnosticSymptoms = ['loss flat', 'OOM', 'p99 high', 'online drop', 'stale truth'];

  yield {
    state: stackGraph('AI systems have five moving parts'),
    highlight: { active: ['data', 'model', 'compute', 'eval', 'serving'], found: ['feedback'] },
    explanation: `The local learning notes frame AI as an engineering stack with ${partCount} parts: ${stackParts.join(', ')}. The model is only one of ${stackNodeCount} nodes (the sixth, ${'feedback'}, closes the loop). Most production failures happen at the ${stackEdgeCount} boundaries.`,
    invariant: `Ask which of the ${partCount} parts changed before asking which algorithm is fashionable.`,
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
    explanation: `A useful mental model starts with artifacts across ${partCount} rows. ${'Data'} has datasets and labels. ${'Models'} have weights and configs. ${'Compute'} has jobs and memory. ${'Evals'} have scores and cases. ${'Serving'} has APIs, latency, and cost.`,
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
    explanation: `This is where MLOps becomes concrete across ${artifactRows.length} artifact types (${artifactRows.join(', ')}). You cannot debug what you did not record: source windows, run configs, model hashes, eval slices, deployment routes, and p99 behavior.`,
  };

  yield {
    state: stackGraph('Serving feeds the next data distribution'),
    highlight: { active: ['serving', 'feedback', 'data', 'e-serving-feedback', 'e-feedback-data'], compare: ['model', 'eval'] },
    explanation: `${'Serving'} is not the end of the ${stackNodeCount}-node system. Product changes, routing, UI, cache behavior, and model outputs change what users do next, feeding ${'feedback'} back to ${'data'} via ${stackEdgeCount} connecting edges.`,
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
    explanation: `The ${partCount}-part map is a routing table for debugging across ${diagnosticSymptoms.length} symptoms. A ${diagnosticSymptoms[0]}, ${diagnosticSymptoms[1]}, ${diagnosticSymptoms[2]} regression, ${diagnosticSymptoms[3]}, or ${diagnosticSymptoms[4]} each points to a different next investigation.`,
  };
}

function* constraintTriage() {
  const seriesLabels = ['bigger model', 'better data', 'serving fix'];
  const seriesCount = seriesLabels.length;
  const pointsPerSeries = 4;
  const triageNodeCount = 8;
  const triageEdgeCount = 10;
  const roles = ['manager', 'MLE', 'researcher'];
  const roleCount = roles.length;
  const complexityTypes = ['new data', 'new feature', 'new model', 'new infra'];
  const triageParts = ['data', 'model', 'compute', 'eval', 'serving'];

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
    explanation: `Constraints are the curriculum. The plot compares ${seriesCount} strategies (${seriesLabels.join(', ')}) across ${pointsPerSeries} cost points. More model can be the wrong move if data quality, eval proxy, p99 latency, or serving cost is the real bottleneck — the ${'good trade'} marker at quality ${82} shows where ${'better data'} wins.`,
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
    explanation: `The best next move is often small across ${triageParts.length} rows: audit slices for ${'data'}, build a baseline for ${'model'}, profile memory for ${'compute'}, inspect failures for ${'eval'}, or canary for ${'serving'}. These moves improve judgment before adding complexity.`,
  };

  yield {
    state: triageGraph('Triage starts from the observed symptom'),
    highlight: { active: ['symptom', 'data', 'model', 'compute', 'eval', 'serving'], found: ['fix', 'measure'] },
    explanation: `Treat a bad result as a systems incident routed through ${triageNodeCount} nodes and ${triageEdgeCount} edges. Split the ${'symptom'} across the ${triageParts.length} parts, choose the smallest reversible ${'fix'}, and rerun the same ${'measure'}.`,
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
    explanation: `The same map helps ${roleCount} roles (${roles.join(', ')}). Product leaders need risk and ROI. Engineers need tradeoffs and reproducibility. Researchers need proof that a method improves the real bottleneck.`,
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
    explanation: `Complexity should buy a known thing across ${complexityTypes.length} dimensions (${complexityTypes.join(', ')}): missing coverage, a real signal, slice wins, lower p99, lower cost, or better rollback. Otherwise it becomes hidden technical debt.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/ai-engineering-stack-five-parts-primer.gif', alt: 'Animated walkthrough of the ai engineering stack five parts primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI systems are easy to discuss as if the model is the system. That hides most engineering failures. Stale labels, bad joins, weak evals, GPU memory pressure, p99 latency, serving cost, and rollback gaps can dominate model choice.',
        'The five-part AI engineering stack is a diagnostic map: data, model, compute, evaluation, and serving. It exists to force the right question: which part is actually constraining progress?',
        {type: 'callout', text: 'The five-part stack prevents teams from solving data, eval, compute, or serving failures with a bigger model.'},
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The wrong answer is to reach for a larger model whenever quality is bad. More model can be the most expensive way to avoid the real bottleneck: missing labels, leakage, a bad proxy metric, retrieval errors, a serving timeout, or an evaluation set that no longer represents the task.',
        'Another wrong answer is to treat infrastructure as separate from AI work. GPU memory, latency, flaky data, cost, delayed labels, and deployment friction are not distractions from AI engineering. They are the curriculum.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Data is rows, labels, sources, timestamps, ownership, and leakage boundaries. Model is function family, loss, weights, calibration, and failure slices. Compute is training time, memory, accelerators, kernels, batching, and budget. Evaluation is the proxy trusted before launch: held-out sets, golden cases, rubrics, confidence intervals, and human audit. Serving is the runtime path: API, p99, cache, feature lookups, rollback, cost, monitoring, and feedback into future data.',
        'The loop matters. Serving decisions change user behavior and future data. Evaluation cases can get overfit. Compute limits push smaller models or better features. Data quality can dominate architecture. A mature team moves around the loop intentionally instead of treating training as the whole job.',
        {type: 'image', src: 'https://www.tensorflow.org/static/tfx/guide/images/prog_fin.png', alt: 'TFX pipeline diagram from example generation through validation and serving.', caption: 'TFX makes the ML system visible as a pipeline rather than a standalone model file. (Source: tensorflow.org)'},
      ],
    },
    {
      heading: 'How to use the map',
      paragraphs: [
        'The five-part map is a routing table for debugging. A loss plateau points toward data, labels, baseline model behavior, and objective shape. An OOM points toward model size, sequence length, batch size, activation storage, optimizer state, or KV cache. An online drop after offline improvement points toward feature skew, delayed labels, traffic slices, and serving code.',
        'The constraint-triage view is the method: start from the symptom, split it across the five parts, choose the smallest reversible intervention, and rerun the same measurement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the symptom, not the preferred solution. If quality is low, inspect data coverage, label quality, baseline behavior, calibration, and failure slices before assuming the architecture is too small. If training is slow, inspect sequence length, batch size, memory, kernel efficiency, and checkpointing before buying more hardware.',
        'Then choose the smallest reversible intervention. Clean one bad slice, add one baseline, refresh one evaluation set, profile one hot path, or canary one serving change. The stack is useful because it turns vague "model is bad" discussion into a sequence of evidence-producing moves.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The map works because AI outcomes are coupled systems outcomes. A model trained on stale or leaking data can look strong offline and fail online. A model with good offline metrics can lose value if p99 latency makes users abandon the workflow. A serving cache can change the data distribution that future training sees.',
        'Separating the five parts prevents premature optimization. It lets a team ask whether the bottleneck is information, function class, compute budget, measurement, or runtime delivery. Each answer implies a different intervention and a different proof of improvement.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support-ticket classifier performs well in a notebook and poorly after launch. A model-first team tries a larger architecture. A stack-first team traces the failure: new product lines are missing from the training data, the eval set overrepresents old tickets, and the serving path uses a stale feature snapshot.',
        'The fix is not one grand rewrite. Refresh the data slice, add golden cases for the new product line, repair point-in-time feature lookup, rerun calibration, and canary the updated model. Only after those changes should the team decide whether a larger model is needed.',
        'The same method works for generative systems. If a RAG assistant hallucinates, the stack map asks separate questions: did retrieval find the right source, did the model ignore it, did the evaluation reward fluency over support, did context packing drop the key passage, or did serving use a stale index? Each answer sends work to a different team.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This map helps curriculum builders, managers, MLEs, researchers, and product teams talk about the same system without collapsing everything into model quality. It gives each role a better first question: what changed, what failed, what evidence proves it, and what is the smallest move worth trying?',
        'Google Rules of Machine Learning, TFX, the ML Test Score paper, and Hidden Technical Debt in ML Systems all point in the same direction: robust end-to-end pipelines, simple baselines, testing, monitoring, and infrastructure matter before clever algorithms can be trusted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The map is a diagnostic aid, not a substitute for measurement. A data failure can look like model underfit. A serving failure can look like model drift. An eval failure can make a bad model look good. The point is to route investigation, not to label the incident from a distance.',
        'The common failure patterns are concrete: leakage, stale labels, missing negatives, bad joins, overfit, miscalibration, OOM, slow iteration, bad proxy metrics, benchmark overfit, p99 latency, stale features, cache errors, and rollback gaps.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'For data, track freshness, coverage, join correctness, leakage checks, label delay, and slice balance. For models, track baseline deltas, calibration, failure clusters, and regression slices. For compute, track cost per run, memory headroom, utilization, and iteration time.',
        'For evaluation, track benchmark age, human disagreement, confidence intervals, and production correlation. For serving, track p99, error rate, cost per task, rollback time, cache hit rate, feature freshness, and drift by traffic slice. These signals make the five-part map measurable instead of decorative.',
        'Governance also belongs here. Each part needs an owner, an artifact, and a rollback story. Data has lineage and contracts. Models have checkpoints and cards. Compute has budgets. Evaluation has score packets. Serving has deploy records and incidents. Without ownership, the five-part map becomes a diagram nobody can execute.',
        {type: 'image', src: 'https://www.tensorflow.org/static/tfx/guide/images/libraries_components.png', alt: 'TensorFlow Extended component and library architecture.', caption: 'Production ML depends on reusable data, validation, training, evaluation, and serving components. (Source: tensorflow.org)'},
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'The AI engineering stack is a way to avoid wasting time. It says: do not solve a data problem with a bigger model, an evaluation problem with more training, or a serving problem with a new loss function.',
        'For course design, make students diagnose failures through all five parts before proposing a fix. That habit is more valuable than memorizing tool names because the tools change while the failure modes repeat.',
      ],
    },
    {
      heading: 'Curriculum path',
      paragraphs: [
        'A useful course can use the five parts as the spine. Start with data because every downstream choice inherits its defects. Move to simple models and baselines so students learn what signal exists before adding complexity. Add compute only when the experiment loop is understood.',
        'Then teach evaluation as a discipline, not a scoreboard. Students should learn slice analysis, leakage checks, confidence intervals, and production correlation. Finish with serving because deployment turns a model into a user-facing system with p99, rollback, monitoring, and cost.',
        'The article should leave readers with a habit: when something fails, name the stack part, name the evidence, and name the smallest reversible change. That is the difference between AI engineering and cargo-cult model swapping.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'For data, study Feature Store, Point-in-Time Feature Join Index, Training-Serving Skew Replay Diff, and Data Leakage & Contamination. For models, study Loss Landscapes, Calibration Curves, Benchmark Variance & Model Selection, Scaling as Local Optimum Case Study, and Regularization. For compute, study Activation Checkpointing, ZeRO Optimizer, Transformer Inference Roofline, and LLM Inference Cost Stack. For evaluation, study Cross-Validation, A/B Testing, LLM Evaluation Runners, RAG Evaluation, and AI Audit Evidence Packet Case Study. For serving, study Tail Latency, Feature Flag Control Plane, Distributed Tracing, Semantic Cache for LLMs, and On-Device LLM Inference Cost Crossover.',
      ],
    },
  ],
};
