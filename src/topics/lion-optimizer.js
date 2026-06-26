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
    explanation: `Use the table as an AdamW contrast. Adam keeps direction memory m and scale memory v; ${topic.title} keeps only momentum-like direction state. Its update is the sign of a momentum blend, so gradient magnitude is mostly discarded before the learning rate and weight decay are applied. That makes ${topic.title} memory-light, but also changes the learning-rate scale.`,
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
    explanation: `The plot shows the price of sign updates. The SGD-like line changes smoothly with gradient size; ${topic.title} jumps to -1 or +1 once the blended direction crosses zero. This can keep motion decisive when gradients are small, but it can also make the effective update norm larger than an AdamW recipe expects. Smaller learning rates are usually not optional.`,
    invariant: `${topic.title} changes the optimizer geometry from adaptive magnitude to signed direction.`,
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
    explanation: `Follow the ${topic.title} update path: the current gradient refreshes momentum, momentum and the fresh gradient are blended, the sign turns that blend into a direction-only step, and the weights move. Framework details differ, but the stable mental model is ${topic.category} sign momentum plus decoupled weight decay.`,
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
    explanation: `The practical knobs are where ${topic.title} claims succeed or die. Retune learning rate and decoupled weight decay, account for batch size, and run enough seeds to see variance. A one-seed win over an untuned AdamW baseline is not evidence; ${topic.id} gains are usually recipe-level claims.`,
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
    explanation: `This graph is the meta-lesson. ${topic.title} was found by program search: generate optimizer rules, test them on proxy tasks, select and simplify the ones that transfer. That makes ${topic.title} both an optimizer and a warning about search. Proxy tasks can discover useful rules, but they can also reward shortcuts.`,
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
    explanation: `The ${topic.title} rule sketch is intentionally small: keep an EMA of gradients, form a sign direction, step weights. Its value is not just fewer lines of code. Sign momentum is a different inductive bias from Adam variance scaling, so it may prefer different schedules, batch sizes, and regularization.`,
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
    explanation: `Read this curve as a hypothesis from the paper, not a promise. Larger batches may make ${topic.title} more attractive because sign momentum has cleaner direction estimates and lower optimizer-state memory, but the trend can disappear under different data, schedules, or model sizes.`,
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
    explanation: `The safe conclusion is deliberately narrow. ${topic.title} is worth benchmarking when optimizer memory, large batches, or update simplicity matter. It is not a default replacement for AdamW until the full ${topic.id} recipe wins on quality, cost, and variance.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'Read the table and plot as an AdamW contrast. Active cells show that Lion keeps momentum and uses sign updates; compare cells show the AdamW variance state Lion removes. The safe inference is memory is saved, but step geometry changes.',
      {type: 'image', src: './assets/gifs/lion-optimizer.gif', alt: 'Animated walkthrough of the lion optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      {type: 'callout', text: 'Lion trades AdamW variance state for signed momentum, so memory falls but the learning-rate recipe becomes part of correctness.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Lion is an optimizer, a rule for changing neural-network weights after each training batch. AdamW normally stores two extra tensors per parameter, so very large models can spend gigabytes on optimizer state. Lion exists to test whether one momentum-like tensor can train well enough while using less memory.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Optimizers change every weight in a layered network, so optimizer state scales with parameter count rather than with batch count. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious choice is AdamW. It keeps a first moment for smoothed direction and a second moment for recent squared-gradient scale. That makes one learning-rate recipe work across coordinates with different magnitudes.',
      'This is reasonable because AdamW is stable across many deep-learning recipes. The cost is that every parameter carries extra state that must fit in memory, move through hardware, and be sharded in large training runs.',
    ]},
    { heading: 'The wall', paragraphs: [
      'The wall appears when optimizer state becomes a capacity limit. With 1 billion parameters and 16-bit state, one extra tensor is about 2 GB before framework overhead. AdamW usually needs two such tensors, while Lion needs one.',
      'The second wall is learning-rate transfer. AdamW can shrink or enlarge coordinate steps through adaptive scaling. Lion removes that denominator, so an AdamW learning rate can be too large for sign-sized coordinate moves.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Lion bets that persistent direction can be more valuable than exact local magnitude. It blends momentum and the current gradient, takes the sign, and applies a learning-rate-sized positive or negative step. The recipe around that step is part of the algorithm.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock optimization surface with a narrow curved valley', caption: 'Optimizer behavior matters most on curved loss surfaces where direction, step scale, and momentum interact. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
    ]},
    { heading: 'How it works', paragraphs: [
      'For each parameter, Lion stores momentum m. Given a new gradient g, it forms a beta-weighted blend, applies sign(blend), subtracts learning_rate times that sign, and refreshes m for the next batch. Decoupled weight decay shrinks weights separately from the raw gradient path.',
      'The arithmetic is small: moving averages, a sign operation, and one state write. There is no squared-gradient accumulator and no square-root denominator. That simplicity exposes the optimizer to tuning mistakes instead of hiding them behind adaptive scaling.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is about preserved information, not universal dominance. Momentum filters noisy batch gradients before the sign is taken, so the sign can represent a short history of direction rather than one mini-batch. If direction is stable, signed steps can make progress with less state.',
      'If direction flips or magnitude carries curvature information, Lion discards useful evidence. It is therefore correct as a sign-momentum rule, but its quality claim must be proven by fair workload-specific experiments.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Per parameter time is O(1), like AdamW, but memory is one optimizer tensor instead of two. When parameter count doubles, Lion optimizer memory doubles with one buffer while AdamW doubles with two. The practical value depends on whether optimizer state was the limiting resource.',
      'The hidden cost is tuning. Learning rate, weight decay, warmup, batch size, clipping, precision, and schedule need retesting. A memory saving that requires many extra sweeps is not free.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Lion is worth benchmarking when optimizer-state memory limits model size, batch size, or fine-tuning throughput. It is most plausible with large batches and stable directions. It also matters as a case study in machine-discovered algorithms that still need human evidence checks.',
      'Production use should compare the whole recipe, not only the optimizer name. Fair baselines, matched compute, multiple seeds, memory accounting, and final task quality decide whether Lion is actually better for a workload.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'Lion fails when coordinate magnitude matters or signs are unstable. Curved losses, small noisy batches, bad learning rates, and under-tuned weight decay can make direction-only steps worse than AdamW. It also fails as a cost win if optimizer memory is not the bottleneck.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Standard deviation bands under a normal curve', caption: 'Small optimizer gains need variance-aware evaluation; a mean improvement inside run-to-run spread has not earned a recipe change. Source: Wikimedia Commons, M. W. Toews, public domain.'},
    ]},
    { heading: 'Worked example', paragraphs: [
      'Take one parameter with learning rate 0.001 and momentum m = 0.06. The new gradient is g = 0.02, and the update blend is 0.9*m + 0.1*g = 0.056. Lion uses sign(0.056) = +1, so the parameter moves by -0.001 before weight decay.',
      'Another parameter with blend 2.4 also has sign +1 and moves by -0.001. AdamW would usually give these coordinates different step sizes after second-moment scaling. The example shows both the memory saving and the information Lion discards.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Start with Symbolic Discovery of Optimization Algorithms at https://arxiv.org/abs/2302.06675. Compare a Lion implementation with AdamW code so the missing second-moment buffer is concrete. Then inspect how learning rate and weight decay differ in published recipes.',
      'Study gradient descent, momentum, AdamW, weight decay, batch-size scaling, and benchmark variance. The next exercise is to compute one Lion update and one AdamW update for the same two gradients.',
    ]},
  ],
};
