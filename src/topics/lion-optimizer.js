// Lion optimizer: a discovered sign-momentum optimizer that stores only
// momentum and updates parameters by the sign of a momentum blend.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lion-optimizer',
  title: 'Lion Optimizer',
  category: 'AI & ML',
  summary: 'Evolved Sign Momentum: a memory-light optimizer discovered by program search, using momentum plus sign updates instead of Adam-style adaptive variance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sign momentum', 'discovered optimizer'], defaultValue: 'sign momentum' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* signMomentum() {
  yield {
    state: labelMatrix(
      'AdamW vs Lion',
      [
        { id: 'state', label: 'state' },
        { id: 'update', label: 'upd' },
        { id: 'lr', label: 'lr' },
        { id: 'memory', label: 'mem' },
      ],
      [
        { id: 'AdamW', label: 'Adam' },
        { id: 'Lion', label: 'Lion' },
      ],
      [
        ['m+v', 'm'],
        ['scaled', 'sign'],
        ['high', 'low'],
        ['2 buf', '1 buf'],
      ],
    ),
    highlight: { active: ['state:Lion', 'update:Lion', 'memory:Lion'], compare: ['state:AdamW'] },
    explanation: 'Lion keeps momentum but removes Adam-style second-moment variance tracking. Its update direction is the sign of a momentum blend, so each parameter step has the same magnitude before learning-rate and weight-decay scaling.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gradient signal', min: -3, max: 3 }, y: { label: 'update direction', min: -1.2, max: 1.2 } },
      series: [
        { id: 'sgd', label: 'SGD-like', points: [{ x: -3, y: -1 }, { x: -1, y: -0.33 }, { x: 0, y: 0 }, { x: 1, y: 0.33 }, { x: 3, y: 1 }] },
        { id: 'lion', label: 'Lion sign', points: [{ x: -3, y: -1 }, { x: -1, y: -1 }, { x: -0.1, y: -1 }, { x: 0.1, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 1 }] },
      ],
    }),
    highlight: { active: ['lion'], compare: ['sgd'] },
    explanation: 'The sign operation discards magnitude and keeps direction. That is why Lion often needs a smaller learning rate than AdamW: the update norm can be larger even when gradients are small.',
    invariant: 'Lion changes the optimizer geometry from adaptive magnitude to signed direction.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'grad', label: 'gradient g', x: 0.8, y: 3.8, note: 'batch' },
        { id: 'mom', label: 'momentum m', x: 2.8, y: 3.8, note: 'EMA' },
        { id: 'blend', label: 'blend', x: 4.8, y: 3.8, note: 'b1/b2' },
        { id: 'sign', label: 'sign', x: 6.6, y: 3.8, note: '+/-' },
        { id: 'param', label: 'weights', x: 8.6, y: 3.8, note: 'update' },
      ],
      edges: [
        { id: 'e-grad-mom', from: 'grad', to: 'mom', weight: '' },
        { id: 'e-mom-blend', from: 'mom', to: 'blend', weight: '' },
        { id: 'e-grad-blend', from: 'grad', to: 'blend', weight: '' },
        { id: 'e-blend-sign', from: 'blend', to: 'sign', weight: '' },
        { id: 'e-sign-param', from: 'sign', to: 'param', weight: '' },
      ],
    }, { title: 'Lion update path' }),
    highlight: { active: ['mom', 'blend', 'sign'], found: ['param'] },
    explanation: 'Lion first updates momentum, then applies a sign update computed from a blend of momentum and the current gradient. The exact implementation varies slightly by framework, but the mental model is stable.',
  };

  yield {
    state: labelMatrix(
      'Practical knobs',
      [
        { id: 'lr', label: 'LR' },
        { id: 'wd', label: 'decay' },
        { id: 'batch', label: 'batch' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['lower than Adam', 'sign norm'],
        ['decouple', 'AdamW lesson'],
        ['large helps', 'paper finding'],
        ['many seeds', 'small gains'],
      ],
    ),
    highlight: { found: ['lr:rule', 'batch:rule', 'eval:rule'] },
    explanation: 'Lion is not a drop-in miracle. Tune learning rate and weight decay, compare compute fairly, and report variance. The paper explicitly notes settings where gains are small or not statistically significant.',
  };
}

function* discoveredOptimizer() {
  yield {
    state: graphState({
      nodes: [
        { id: 'space', label: 'program space', x: 0.8, y: 3.8, note: 'optimizers' },
        { id: 'search', label: 'search', x: 2.8, y: 3.8, note: 'symbolic' },
        { id: 'proxy', label: 'proxy tasks', x: 4.8, y: 2.5, note: 'cheap' },
        { id: 'select', label: 'select+simplify', x: 4.8, y: 5.1, note: 'generalize' },
        { id: 'lion', label: 'Lion', x: 7.4, y: 3.8, note: 'simple rule' },
      ],
      edges: [
        { id: 'e-space-search', from: 'space', to: 'search', weight: '' },
        { id: 'e-search-proxy', from: 'search', to: 'proxy', weight: '' },
        { id: 'e-proxy-select', from: 'proxy', to: 'select', weight: '' },
        { id: 'e-select-lion', from: 'select', to: 'lion', weight: '' },
      ],
    }, { title: 'Optimizer discovery as program search' }),
    highlight: { active: ['search', 'proxy', 'select'], found: ['lion'] },
    explanation: 'The Lion paper is also a meta-lesson: the authors searched over optimizer programs, then selected and simplified rules that transferred from proxy tasks to real training.',
  };

  yield {
    state: labelMatrix(
      'Lion rule sketch',
      [
        { id: 'm', label: 'm' },
        { id: 'u', label: 'u' },
        { id: 'w', label: 'w' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'intuition', label: 'intuition' },
      ],
      [
        ['EMA of grads', 'direction memory'],
        ['sign(blend)', 'constant step'],
        ['w - lr*u', 'move weights'],
      ],
    ),
    highlight: { active: ['u:operation'], found: ['w:operation'] },
    explanation: 'Lion is interesting because the discovered rule is easy to explain. The sign update gives it a different inductive bias from Adam, not just fewer lines of code.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'batch size', min: 0, max: 4096 }, y: { label: 'relative gain over Adam', min: 0, max: 1.0 } },
      series: [
        { id: 'gain', label: 'reported trend shape', points: [
          { x: 128, y: 0.10 }, { x: 512, y: 0.24 }, { x: 1024, y: 0.40 }, { x: 2048, y: 0.62 }, { x: 4096, y: 0.72 },
        ] },
      ],
    }),
    highlight: { active: ['gain'] },
    explanation: 'The paper reports that Lion gains tend to grow with larger batch sizes. Treat this as a hypothesis to validate in your own recipe, not a universal law.',
  };

  yield {
    state: labelMatrix(
      'Where Lion fits',
      [
        { id: 'vision', label: 'vision' },
        { id: 'diffusion', label: 'diffusion' },
        { id: 'language', label: 'language' },
        { id: 'ads', label: 'ads CTR' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['strong results', 'retune LR'],
        ['compute savings', 'FID + seeds'],
        ['mixed results', 'fair budget'],
        ['production use', 'monitor drift'],
      ],
    ),
    highlight: { found: ['vision:lesson', 'diffusion:lesson', 'language:audit', 'ads:lesson'] },
    explanation: 'The safe conclusion: Lion is a serious optimizer to benchmark when memory and update simplicity matter, but optimizer claims live or die on recipe-level fairness.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sign momentum') yield* signMomentum();
  else if (view === 'discovered optimizer') yield* discoveredOptimizer();
  else throw new InputError('Pick a Lion optimizer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Lion is the optimizer discovered in "Symbolic Discovery of Optimization Algorithms." The name abbreviates EvoLved Sign Momentum. It keeps a momentum-like exponential moving average but does not keep Adam-style second-moment variance. The parameter update uses the sign of a momentum blend, so the update has constant per-parameter magnitude before learning rate and weight decay are applied.',
        'This makes Lion a useful contrast with Adam Optimizer. Adam adapts each coordinate by an estimate of gradient variance. Lion keeps less state and uses sign direction. The result can be more memory-efficient and faster in some recipes, but it also changes learning-rate sensitivity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The discovered rule can be summarized as: maintain momentum, form an update direction from momentum and current gradient, take sign(update), and move weights by learning-rate-scaled sign. Weight decay is usually decoupled, following the AdamW lesson. Because sign throws away magnitude, Lion often needs a smaller learning rate than AdamW.',
        'The paper is also about optimizer discovery. The authors search a symbolic program space on proxy tasks, then use selection and simplification to find rules that transfer. That makes Lion both an optimizer and a case study in algorithm search: an automated process found a simple rule that humans can inspect.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lion stores one momentum state per parameter rather than Adam-style first and second moments, so optimizer-state memory is lower. That matters for large models where optimizer state can dominate memory. The computational cost is also simple: exponential moving averages and sign operations. The harder cost is tuning. Learning rate, weight decay, batch size, warmup, and schedule cannot be copied blindly from AdamW.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The paper reports strong results on image classification, vision-language contrastive learning, diffusion models, language modeling, fine-tuning, and a production search ads CTR model. The practical use case is not "replace Adam everywhere." It is "include Lion in serious optimizer sweeps when memory, batch size, and training recipe make sign momentum plausible."',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Lion does not remove the need for benchmark discipline. Optimizers are notoriously recipe-sensitive. A small gain can vanish under different seeds, schedules, data order, or batch size. Also, memory savings from optimizer state may be irrelevant if activations or KV cache dominate your workload. Compare end-to-end cost, not only optimizer elegance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Symbolic Discovery of Optimization Algorithms at https://arxiv.org/abs/2302.06675 and the Google AutoML Lion implementation at https://github.com/google/automl/tree/master/lion. Study Adam Optimizer, Learning-Rate Schedules & Warmup, Gradient Descent, Batch Size Scaling, Benchmark Variance & Model Selection, and Muon Optimizer next.',
      ],
    },
  ],
};
