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
        'The visualization has two views. The five-part map shows the cycle: data flows into model, model needs compute, compute produces eval scores, eval gates serving, and serving generates feedback that reshapes future data. The constraint triage view starts from a symptom and fans out to the five parts, then converges on the smallest fix and a rerun of the same measurement.',
        'Watch which nodes light up at each step. The highlighted node is the active bottleneck; the compared nodes are what people mistakenly blame instead. Step through slowly the first time to build the routing intuition.',
        {type: 'image', src: './assets/gifs/ai-engineering-stack-five-parts-primer.gif', alt: 'Animated walkthrough of the ai engineering stack five parts primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most ML teams treat the model as the system. When quality drops, they reach for a bigger architecture. But production AI failures are rarely model failures alone. Stale labels, leaking features, bad proxy metrics, GPU OOM, p99 spikes, and stale serving caches each masquerade as "the model is bad."',
        'The five-part AI engineering stack -- data, model, compute, evaluation, serving -- is a diagnostic map that forces a better question: which part is actually constraining progress right now? It comes from the same lineage as Google\'s Rules of Machine Learning and Sculley et al.\'s Hidden Technical Debt paper, both of which found that the model is typically a small fraction of the real system.',
        {type: 'callout', text: 'The five-part stack prevents teams from solving data, eval, compute, or serving failures with a bigger model.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach to improving an ML system is to improve the model. Swap in a larger architecture, train longer, add more parameters. This is the path of least organizational resistance because it does not require coordinating with data owners, platform teams, or product managers.',
        'A related temptation is to treat infrastructure -- GPUs, serving latency, feature pipelines -- as someone else\'s problem. This mental separation between "AI work" and "systems work" is where most production failures hide. The engineer who only thinks about model accuracy will be blindsided by the engineer who ships a stale feature cache.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'You hit the wall when a bigger model stops helping. Loss plateaus but the training data has label noise nobody audited. Offline metrics look great but online quality craters because the eval set no longer represents real traffic. The model fits on a single GPU in the notebook but OOMs in production because the serving path packs longer sequences.',
        'These failures are invisible if you only look at the model. Each one lives in a different part of the stack, requires a different investigation, and has a different fix. Without a map, teams thrash between random interventions and learn nothing about which constraint actually moved.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every ML system is five coupled subsystems, not one. Data is rows, labels, freshness, joins, ownership, and leakage boundaries. Model is function family, loss, weights, calibration, and failure slices. Compute is training time, memory budget, accelerator utilization, and iteration speed. Evaluation is the proxy you trust before launch: held-out sets, golden cases, rubrics, confidence intervals. Serving is the runtime path: API, latency, cache, feature lookups, rollback, cost, and monitoring.',
        'The key is the feedback loop. Serving changes user behavior, which changes future data, which changes what the model learns next. Evaluation cases can drift. Compute limits force architecture compromises. A mature team navigates this loop deliberately rather than treating training as the whole job.',
        {type: 'image', src: 'https://www.tensorflow.org/static/tfx/guide/images/prog_fin.png', alt: 'TFX pipeline diagram from example generation through validation and serving.', caption: 'TFX makes the ML system visible as a pipeline rather than a standalone model file. (Source: tensorflow.org)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start from the symptom, not from a preferred solution. If quality is low, inspect data coverage, label quality, baseline behavior, calibration, and failure slices before concluding the architecture is too small. If training is slow, profile sequence length, batch size, memory, kernel efficiency, and checkpointing before requisitioning more hardware.',
        'Once you identify the likely part, choose the smallest reversible intervention. Clean one bad data slice. Add one baseline model. Refresh one eval set. Profile one serving hot path. Canary one deployment change. Then rerun the exact same measurement to see if the constraint moved. The stack turns vague "model is bad" conversations into a sequence of evidence-producing moves.',
        'The constraint-triage view formalizes this: symptom fans out to five suspect parts, each suspect converges on a serving-aware fix, and the fix feeds a measurement rerun. This is incident-response thinking applied to ML quality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because AI outcomes are coupled systems outcomes, and coupled systems require differential diagnosis. A model trained on leaking data looks strong offline and fails online. A model with great accuracy loses value if p99 latency makes users abandon the workflow. A serving cache that changes the data distribution silently degrades future training quality.',
        'Separating the five parts prevents premature optimization. Instead of guessing, a team asks: is the bottleneck information (data), function class (model), budget (compute), measurement quality (eval), or runtime delivery (serving)? Each answer implies a different intervention and a different proof that the intervention worked. Without this separation, teams optimize the wrong thing and cannot tell.',
        {type: 'image', src: 'https://www.tensorflow.org/static/tfx/guide/images/libraries_components.png', alt: 'TensorFlow Extended component and library architecture.', caption: 'Production ML depends on reusable data, validation, training, evaluation, and serving components. (Source: tensorflow.org)'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The stack itself has zero computational cost -- it is a diagnostic framework, not software. The cost is organizational: someone must own each part, maintain its artifacts, and track its signals. Data needs lineage and contracts. Models need checkpoints and cards. Compute needs budgets and utilization tracking. Eval needs score packets and human audit schedules. Serving needs deploy records, incident logs, and rollback runbooks.',
        'The payoff is avoiding the most expensive mistake in ML engineering: running a large, slow experiment that optimizes the wrong constraint. A two-hour data audit that reveals label noise saves the two-week training run that would have learned the noise. A one-day eval refresh that catches a stale benchmark prevents a false "improvement" that regresses in production.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google\'s TFX pipeline is the five-part stack made concrete: ExampleGen and Transform handle data, Trainer handles model and compute, Evaluator handles eval, and Pusher plus InfraValidator handle serving. Each component has typed artifacts and validation gates. You cannot push a model that fails data validation or eval thresholds.',
        'The same structure appears in RAG systems. Data is the retrieval corpus and its freshness. Model is the generator plus any reranker. Compute is embedding indexing and inference budget. Eval is retrieval recall, answer faithfulness, and hallucination rate. Serving is the API, context window packing, and cache hit rate. When a RAG system hallucinates, the stack map tells you whether retrieval failed, the model ignored the context, or the eval rewarded fluency over factual grounding.',
        'Recommendation systems follow the same pattern. Data is user-item interactions and feature freshness. Model is the ranking function. Compute is training throughput. Eval is offline metrics versus online A/B lifts. Serving is latency, cold-start handling, and exploration-exploitation balance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The map is a diagnostic routing tool, not a diagnosis. Symptoms cross boundaries: a data failure (label noise) looks like model underfit, a serving failure (stale features) looks like model drift, and an eval failure (bad proxy metric) makes a broken model look good. The five parts help you investigate faster, but the investigation itself still requires measurement.',
        'The framework also struggles with novel research. If nobody knows what the right architecture is, the model part of the stack dominates and the others are premature to formalize. The stack is most valuable for systems that have passed the research phase and entered the "make it work reliably" phase.',
        'Finally, organizational politics can defeat any framework. If the data team, model team, and platform team do not share a common incident process, the five-part map becomes a diagram that each team interprets to blame the others.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support-ticket classifier works well in a notebook but fails after launch. The model-first team reaches for a larger architecture. The stack-first team runs the diagnostic. Data: new product lines added after the training cut. The classifier has never seen these tickets. Eval: the test set overrepresents legacy categories. The 94% accuracy is real but irrelevant to current traffic. Serving: the feature pipeline uses a stale snapshot from a batch job that runs nightly, so real-time features diverge from training-time features.',
        'The fix is three small moves, not one big rewrite. First, refresh the data slice to include the new product lines and add golden cases for them. Second, rebuild the eval set to match current traffic proportions. Third, repair the feature pipeline to use point-in-time joins so serving features match training features. After these three changes, the original model recovers most of its quality. Only then does it make sense to ask whether a larger model would help further.',
        'Notice what the stack-first team avoided: a two-week training run on a bigger model that would have learned the same stale features and been evaluated on the same unrepresentative test set. The stack diagnosis took two days and identified three concrete fixes instead of one expensive guess.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational papers are Sculley et al., "Hidden Technical Debt in Machine Learning Systems" (NIPS 2015), which identified that the model is a small box inside a large system, and Zinkevich, "Rules of Machine Learning" (Google, 2017), which codified the practice of starting simple and diagnosing systematically. The TFX paper (Baylor et al., KDD 2017) operationalized the pipeline into reusable components with typed artifacts.',
        'For data, study Feature Store, Point-in-Time Feature Join Index, Training-Serving Skew, and Data Leakage. For models, study Loss Landscapes, Calibration Curves, and Scaling Laws. For compute, study Activation Checkpointing, ZeRO Optimizer, and the Transformer Inference Roofline. For evaluation, study Cross-Validation, A/B Testing, and RAG Evaluation. For serving, study Tail Latency, Distributed Tracing, Semantic Cache for LLMs, and On-Device Inference Cost Crossover.',
      ],
    },
  ],
};
