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
    explanation: 'Use the table as an AdamW contrast. Adam keeps direction memory m and scale memory v; Lion keeps only momentum-like direction state. Its update is the sign of a momentum blend, so gradient magnitude is mostly discarded before the learning rate and weight decay are applied. That makes Lion memory-light, but also changes the learning-rate scale.',
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
    explanation: 'The plot shows the price of sign updates. The SGD-like line changes smoothly with gradient size; Lion jumps to -1 or +1 once the blended direction crosses zero. This can keep motion decisive when gradients are small, but it can also make the effective update norm larger than an AdamW recipe expects. Smaller learning rates are usually not optional.',
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
    explanation: 'Follow the update path: the current gradient refreshes momentum, momentum and the fresh gradient are blended, the sign turns that blend into a direction-only step, and the weights move. Framework details differ, but the stable mental model is sign momentum plus decoupled weight decay.',
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
    explanation: 'The practical knobs are where Lion claims succeed or die. Retune learning rate and decoupled weight decay, account for batch size, and run enough seeds to see variance. A one-seed win over an untuned AdamW baseline is not evidence; optimizer gains are usually recipe-level claims.',
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
    explanation: 'This graph is the meta-lesson. Lion was found by program search: generate optimizer rules, test them on proxy tasks, select and simplify the ones that transfer. That makes Lion both an optimizer and a warning about search. Proxy tasks can discover useful rules, but they can also reward shortcuts.',
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
    explanation: 'The rule sketch is intentionally small: keep an EMA of gradients, form a sign direction, step weights. Its value is not just fewer lines of code. Sign momentum is a different inductive bias from Adam variance scaling, so it may prefer different schedules, batch sizes, and regularization.',
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
    explanation: 'Read this curve as a hypothesis from the paper, not a promise. Larger batches may make Lion more attractive because sign momentum has cleaner direction estimates and lower optimizer-state memory, but the trend can disappear under different data, schedules, or model sizes.',
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
    explanation: 'The safe conclusion is deliberately narrow. Lion is worth benchmarking when optimizer memory, large batches, or update simplicity matter. It is not a default replacement for AdamW until the full recipe wins on quality, cost, and variance.',
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
      heading: 'Why Lion Exists',
      paragraphs: [
        `Lion is an optimizer for neural-network training. The name comes from EvoLved Sign Momentum, because the rule was found by symbolic program search and then simplified into a small human-readable update. It keeps a momentum-like running average of gradients, forms a blend of that momentum and the current gradient, takes the sign of that blend, and moves each parameter by a learning-rate-scaled positive or negative step. Unlike AdamW, it does not keep a second-moment buffer that estimates gradient variance.`,
        `That design matters because optimizer state is not a footnote in modern training. AdamW usually stores two extra tensors per parameter: first moment and second moment. On very large models, those buffers can be a major share of memory. Lion stores only one momentum-like tensor, so the optimizer can be lighter. The tradeoff is that Lion throws away most gradient magnitude information before applying the step. It is not a cheaper AdamW clone. It is a different optimizer geometry.`,
      ],
    },
    {
      heading: 'The Wall It Answers',
      paragraphs: [
        `The obvious optimizer progression is easy to understand. Start with gradient descent: move weights opposite the gradient. Add momentum: smooth noisy gradients over time. Add Adam: normalize each coordinate by an estimate of recent squared gradients so coordinates with different scales can be trained under one recipe. Add AdamW: decouple weight decay so regularization does not get tangled with adaptive scaling. This progression works well enough that AdamW became the default for many deep-learning recipes.`,
        `The wall is that AdamW's convenience costs memory and sometimes does more coordinate-level bookkeeping than the workload needs. If the most important information is direction, and if batch size is large enough to make that direction stable, then a sign-based optimizer may be enough. Lion explores that possibility. It asks whether a model can train well with momentum for direction, sign for the update, decoupled weight decay for regularization, and no second-moment variance state.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `Lion's core insight is that a neural-network update can be made decisive without trusting the raw gradient magnitude. After momentum has accumulated a direction, Lion uses only the sign of a blended direction. A coordinate with a small positive blended signal and a coordinate with a large positive blended signal both receive a positive step of the same base size. The learning rate controls that base size, and weight decay is usually applied in the decoupled AdamW style.`,
        `This is why Lion often needs a lower learning rate than AdamW. AdamW can shrink or enlarge effective coordinate steps through its adaptive denominator. Lion's sign operation makes every active coordinate step similar before global scaling. That can help when raw magnitudes are noisy or poorly calibrated. It can hurt when magnitude was carrying useful information about curvature, uncertainty, or coordinate scale. The optimizer is making an explicit bet: persistent direction is more useful than exact local magnitude.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A practical Lion step has three pieces. First, the optimizer maintains a momentum buffer, usually an exponential moving average of gradients. Second, it creates an update direction from a blend of the current gradient and the momentum buffer. Third, it applies the sign of that blended update to the parameters, scaled by the learning rate. After that, it refreshes momentum for the next step. Implementations differ in exact ordering and beta placement, but the mental model is stable: sign momentum plus decoupled weight decay.`,
        `The update path is deliberately small. There is no per-coordinate variance estimate, no square root of a second moment, and no adaptive denominator. The optimizer state is one tensor per parameter instead of two. The update itself is cheap: exponential moving averages and sign operations. That simplicity is part of the appeal. It also means the optimizer's behavior is exposed. If the learning rate is too high, there is no adaptive denominator to soften the step. If the sign direction is wrong, the update still moves at full base strength.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Suppose one parameter has recent gradients that mostly point positive: 0.02, 0.05, 0.03, and 0.04. AdamW would keep a first-moment estimate and a second-moment estimate, then scale the step by the ratio between them. Lion keeps a momentum-like direction estimate. If the blend is positive, the update for that coordinate is positive regardless of whether the blended value is 0.01 or 0.10. With a learning rate of 0.0001, the coordinate moves by roughly that learning-rate-sized unit in the negative optimization direction, plus whatever decoupled weight decay contributes.`,
        `Now compare a second coordinate with a very large but noisy gradient: 3.0, -2.5, 2.8, -2.7. AdamW's second moment notices large magnitude. Lion's momentum may hesitate because the direction keeps flipping. If the blended direction changes sign often, Lion changes update direction often. That example shows both sides. Lion can ignore unhelpful magnitude spikes, but it depends heavily on momentum producing a meaningful sign. The optimizer is strongest when direction is persistent and weakest when sign is unstable or magnitude should matter.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Sign-based updates are not new. SignSGD and related methods already showed that direction-only optimization can be useful, especially in noisy or distributed settings. Lion's extra ingredient is momentum. Momentum filters the batch-to-batch gradient noise before the sign is taken, so the sign is not just the current mini-batch's opinion. It is a short history of direction. That can make the optimizer robust to magnitude noise while preserving enough directional memory to keep training moving.`,
        `The program-search story is also important. Lion was not derived from one clean theorem that says sign momentum must dominate AdamW. The authors searched a space of symbolic optimizer programs on proxy tasks, selected candidates, simplified them, and then evaluated transfer. That makes Lion a useful example of machine-assisted algorithm design. The result is simple enough to inspect, but the discovery route warns you to be careful. A proxy task can reveal a real pattern, or it can overfit the search process.`,
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        `The AdamW-versus-Lion table is the first contrast to hold in your head. AdamW keeps direction memory and scale memory. Lion keeps direction memory only. The sign plot then shows the consequence: an SGD-like update changes smoothly with gradient size, while Lion jumps to a fixed positive or negative direction once the blended signal crosses zero. The animation is not saying that fixed-size coordinate steps are always better. It is showing exactly what information Lion keeps and what it discards.`,
        `The discovery view teaches a second lesson: the optimizer rule and the evidence for the rule are separate objects. Program search can produce a compact candidate, but the candidate still needs fair baselines, retuned learning rates, retuned weight decay, multiple seeds, and end-to-end cost accounting. A one-seed gain over a copied AdamW recipe is not enough. Optimizers live inside recipes. The only honest claim is that the full Lion recipe wins under the tested conditions.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `Lion's clearest cost advantage is optimizer-state memory. Replacing AdamW's first and second moments with one momentum-like buffer can save substantial memory in large training runs. The arithmetic is also simple. But training cost is not just optimizer arithmetic. Activations, communication, parameter precision, checkpointing, and data pipeline overhead may dominate. If optimizer state is not the bottleneck, Lion's memory saving may not change the actual training budget much.`,
        `The largest practical cost is tuning. Learning rate, weight decay, warmup, batch size, schedule, gradient clipping, and precision settings cannot be copied blindly from AdamW. Lion usually wants a smaller learning rate because sign updates change the effective step norm. It may also interact differently with large batches, where direction estimates are cleaner, and with regularization, where decoupled weight decay has to do more visible work. Treat Lion as a new recipe, not a drop-in flag.`,
      ],
    },
    {
      heading: 'Where It Wins And Fails',
      paragraphs: [
        `Lion is worth trying when optimizer-state memory matters, when large batches make direction estimates stable, when AdamW's second-moment state is expensive, or when a team can afford a serious optimizer sweep. The paper reports strong results across image classification, vision-language contrastive learning, diffusion models, language modeling, fine-tuning, and a production search ads CTR model. Those reports make Lion credible enough to benchmark, not automatic enough to install everywhere.`,
        `Lion is a poor fit when the workload depends strongly on adaptive coordinate scaling, when gradients are extremely sign-unstable, when the team cannot retune the schedule, or when memory savings do not matter. It is also easy to misuse in small experiments where variance is high. If the measured improvement is smaller than run-to-run noise, the optimizer has not earned a production change. For language models especially, recipe details can swamp optimizer differences. The baseline must be strong and tuned.`,
      ],
    },
    {
      heading: 'Pitfalls And Misconceptions',
      paragraphs: [
        `The first misconception is that Lion is simply AdamW with less memory. It is not. Removing the second moment changes how coordinates are scaled, how learning rate behaves, and how sensitive training is to sign errors. The second misconception is that sign updates are crude and therefore cannot work. That is also too simple. Momentum can make sign direction meaningful, and many deep networks do not require every local gradient magnitude to be trusted equally.`,
        `The third trap is benchmark optimism. Optimizer papers often report small percentage gains, and small gains are fragile. Retune both optimizers. Use the same compute budget. Run enough seeds. Compare validation quality, wall-clock time, memory, stability, and final task performance. If Lion saves memory but needs many extra sweeps to reach the same quality, that tuning cost is real. If it wins only because AdamW was under-tuned, the result is not an optimizer discovery in your workload.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Primary sources: Symbolic Discovery of Optimization Algorithms at https://arxiv.org/abs/2302.06675 and the Google AutoML Lion implementation at https://github.com/google/automl/tree/master/lion. Read those alongside an AdamW implementation so the missing second-moment buffer is concrete, not just a slogan. The most important exercise is to write one Lion update by hand for a two-parameter vector and compare it to one AdamW update under the same gradients.`,
        `Study Gradient Descent, Momentum, Adam Optimizer, Learning-Rate Schedules and Warmup, Batch Size Scaling, Weight Decay, Benchmark Variance and Model Selection, and Muon Optimizer next. Lion becomes easier to judge once you can separate three questions: what information the optimizer stores, what geometry the update applies, and what evidence would prove the full recipe is better than the baseline.`,
      ],
    },
  ],
};
