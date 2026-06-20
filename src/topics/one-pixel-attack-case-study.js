// One-pixel attack: a black-box evolutionary search can find a tiny image edit
// that flips a neural classifier.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'one-pixel-attack-case-study',
  title: 'One-Pixel Attack Case Study',
  category: 'Papers',
  summary: 'A robustness lesson from adversarial ML: one changed pixel, differential evolution, black-box queries, and misleading confidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pixel search', 'robustness metrics'], defaultValue: 'pixel search' },
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

function imageGrid(title, changedId = null) {
  const rows = [
    { id: 'r0', label: 'row 0' },
    { id: 'r1', label: 'row 1' },
    { id: 'r2', label: 'row 2' },
  ];
  const columns = [
    { id: 'c0', label: 'col 0' },
    { id: 'c1', label: 'col 1' },
    { id: 'c2', label: 'col 2' },
  ];
  const labels = [
    ['sky', 'sky', 'sky'],
    ['fur', changedId === 'r1:c1' ? 'red pixel' : 'fur', 'fur'],
    ['grass', 'grass', 'grass'],
  ];
  return labelMatrix(title, rows, columns, labels);
}

function* pixelSearch() {
  yield {
    state: imageGrid('Original image: classifier says cat'),
    highlight: { found: ['r1:c1'] },
    explanation: 'The grid starts from a correct prediction. The attack asks how close the decision boundary is: can one pixel edit move the model to another class while the human still sees the same object?',
  };

  yield {
    state: labelMatrix(
      'A candidate edit is five numbers',
      [
        { id: 'x', label: 'x position' },
        { id: 'y', label: 'y position' },
        { id: 'r', label: 'red' },
        { id: 'g', label: 'green' },
        { id: 'b', label: 'blue' },
      ],
      [
        { id: 'value', label: 'candidate value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['1', 'middle column'],
        ['1', 'middle row'],
        ['255', 'strong red'],
        ['20', 'low green'],
        ['20', 'low blue'],
      ],
    ),
    highlight: { active: ['x:value', 'y:value', 'r:value', 'g:value', 'b:value'] },
    explanation: 'The candidate is only five numbers: x, y, red, green, blue. Differential Evolution can optimize those numbers with model queries, so the attack works even when weights and gradients are hidden.',
    invariant: 'Black-box search can optimize model outputs without seeing model weights.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'query round', min: 0, max: 8 }, y: { label: 'target-class confidence', min: 0, max: 1 } },
      series: [
        { id: 'best', label: 'best candidate', points: [
          { x: 0, y: 0.05 }, { x: 1, y: 0.12 }, { x: 2, y: 0.18 }, { x: 3, y: 0.31 },
          { x: 4, y: 0.44 }, { x: 5, y: 0.61 }, { x: 6, y: 0.78 }, { x: 7, y: 0.86 },
        ] },
      ],
      markers: [
        { id: 'start', x: 0, y: 0.05, label: 'original' },
        { id: 'flip', x: 6, y: 0.78, label: 'class flips' },
      ],
    }),
    highlight: { active: ['best'], found: ['flip'], compare: ['start'] },
    explanation: 'The curve shows selection pressure. Each round keeps edits that raise target-class confidence, and the flip marker appears when the best candidate crosses the model boundary.',
  };

  yield {
    state: imageGrid('One pixel changed: classifier says frog', 'r1:c1'),
    highlight: { active: ['r1:c1'] },
    explanation: 'Only one cell changed, but the label flipped. The lesson is not that every image breaks this way; it is that the model boundary can be much closer than human perception suggests.',
  };
}

function* robustnessMetrics() {
  yield {
    state: labelMatrix(
      'The paper evaluated more than one number',
      [
        { id: 'success', label: 'success rate' },
        { id: 'confidence', label: 'confidence' },
        { id: 'targets', label: 'target classes' },
        { id: 'pairs', label: 'class pairs' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['how often does attack work?', 'base robustness signal'],
        ['how confident after flip?', 'detects brittle certainty'],
        ['how many targets reachable?', 'maps attack flexibility'],
        ['which source to target?', 'shows asymmetric weaknesses'],
      ],
    ),
    highlight: { found: ['success:asks', 'confidence:asks', 'targets:asks', 'pairs:asks'] },
    explanation: 'The metrics table shows why success rate is not enough. Confidence, reachable targets, source-target pairs, and query cost tell whether the vulnerability is broad, asymmetric, or expensive to exploit.',
  };

  yield {
    state: labelMatrix(
      'Why differential evolution fits',
      [
        { id: 'gradient', label: 'no gradients' },
        { id: 'dimension', label: 'tiny search vector' },
        { id: 'population', label: 'population search' },
        { id: 'queries', label: 'model queries' },
      ],
      [
        { id: 'attack property', label: 'attack property' },
        { id: 'advantage', label: 'advantage' },
      ],
      [
        ['black-box setting', 'works with probability outputs'],
        ['x, y, R, G, B', 'cheap candidate representation'],
        ['mutate and select', 'does not need smoothness'],
        ['ask classifier', 'simple fitness function'],
      ],
    ),
    highlight: { active: ['gradient:advantage', 'dimension:advantage', 'population:advantage'] },
    explanation: 'This is Evolutionary Search in miniature. Candidate edits mutate, the classifier supplies the fitness score, and selection keeps edits that move confidence toward the objective.',
    invariant: 'The evaluator defines the attack objective.',
  };

  yield {
    state: labelMatrix(
      'Defense lessons',
      [
        { id: 'advtrain', label: 'adversarial training' },
        { id: 'augment', label: 'data augmentation' },
        { id: 'certify', label: 'certified radius' },
        { id: 'monitor', label: 'monitoring' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['train on attacks', 'can overfit attack family'],
        ['corrupt images', 'not a proof'],
        ['prove small perturbation safety', 'often limited radius'],
        ['detect weird confidence', 'attacks may adapt'],
      ],
    ),
    highlight: { active: ['advtrain:move', 'augment:move', 'certify:move'], compare: ['monitor:limit'] },
    explanation: 'The defense table keeps the conclusion sober. Robustness needs adversarial examples, holdout attacks, and adaptive evaluation; augmentation or monitoring alone is not a proof.',
  };

  yield {
    state: labelMatrix(
      'Where this connects',
      [
        { id: 'conv', label: 'Convolution' },
        { id: 'adv', label: 'Adversarial Examples' },
        { id: 'saliency', label: 'Saliency Maps' },
        { id: 'privacy', label: 'surveillance' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question' },
      ],
      [
        ['image features', 'what did filters key on?'],
        ['decision boundary', 'how close is the flip?'],
        ['input sensitivity', 'which pixels matter?'],
        ['automated recognition', 'who controls robustness?'],
      ],
    ),
    highlight: { found: ['conv:question', 'adv:question', 'saliency:question', 'privacy:question'] },
    explanation: 'The connection table shows where to generalize the idea. Vision features, decision boundaries, saliency, and automated recognition all ask the same question: which small input changes can move a high-stakes decision?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pixel search') yield* pixelSearch();
  else if (view === 'robustness metrics') yield* robustnessMetrics();
  else throw new InputError('Pick a one-pixel attack view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'The one-pixel attack is a clean way to teach a disturbing fact about neural networks: a model can be highly accurate on normal images and still be sensitive to tiny, targeted input changes. The attack asks whether changing only one pixel can make an image classifier choose the wrong class.',
        'The point is not that all real attacks use one literal pixel. The point is that high-dimensional models can make brittle decisions, and the boundary between classes can pass surprisingly close to natural-looking inputs. One pixel is a microscope for studying that boundary.',
        'For learners, the constraint is useful because it removes excuses. The image is not covered with noise, the label is not changed by a human, and the attack budget is easy to inspect. If a model fails anyway, the failure has to be explained through model geometry, feature sensitivity, and search.',
        {type:'callout', text:'A one-pixel attack shows that robustness depends on decision-boundary geometry, not on whether an input change looks meaningful to humans.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious adversarial attack is gradient-based: compute how the loss changes with each input pixel, then push the image in the direction that increases the target class or decreases the true class. That works when the attacker has model internals and differentiability.',
        'The one-pixel setting is harder and more instructive because the search space is discrete and tiny in budget. The attacker must choose a pixel location and color values. It may not have gradients. A naive brute-force scan over every position and every RGB value is enormous even for small images.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to treat the attack as black-box optimization. A candidate is a small vector: x coordinate, y coordinate, and color channels. The evaluator is the model confidence after applying that pixel change. If a candidate raises the target class enough, the attack succeeds.',
        'Differential evolution is a natural fit because it does not need gradients. It keeps a population of candidate pixel edits, scores them by querying the classifier, and generates new candidates by recombining differences between existing candidates. The model is treated as a scoring oracle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an image and a trained classifier. Create a population of candidate one-pixel edits. Each candidate specifies where to edit and what RGB value to write. Apply the edit, run the classifier, and record either target-class confidence or loss of true-class confidence.',
        'Differential evolution mutates candidates by taking differences between population members and adding the scaled difference to another candidate. Coordinates and colors are clipped or rounded back into legal pixel ranges. A trial candidate replaces its parent if it scores better.',
        'The loop repeats until the attack succeeds or the query budget is exhausted. Success can mean untargeted misclassification, where any wrong label counts, or targeted misclassification, where the model must choose a specific label. Targeted attacks are usually harder.',
        'The candidate encoding matters. For one pixel on a color image, the vector might be [x, y, r, g, b]. For several pixels, the vector repeats that structure. This keeps the attack small enough for black-box search while still giving it a meaningful way to explore location and color together.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The pixel-search view proves that the attack is not randomly poking the image forever. The population keeps candidate edits that move the classifier toward failure. The highlighted pixel is the visible edit, but the real state is the population distribution over possible edits.',
        'The confidence chart proves why a tiny perturbation can matter. The model output is a decision surface over the input space. A one-pixel change is small to a human, but it can move the image across a boundary if the classifier relies on fragile local features or interactions.',
        'If the visual shows several failed candidates before one success, that is the lesson. Black-box attacks are search under feedback. The failed probes are not wasted if they reshape the population toward regions where the model is more uncertain or more confidently wrong.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The attack works when the classifier has nearby adversarial regions and the search algorithm can find one with limited queries. Deep networks often carve complex decision regions through image space. A small visible change can produce a large internal activation change when it hits a sensitive feature path.',
        'Black-box search also works because the attacker does not need to understand the model. It only needs feedback. Every classifier query tells the optimizer whether a candidate edit is more or less promising. Over many candidates, selection pressure turns those scores into directed search.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The dominant cost is model queries. If the population has 400 candidates and the attack runs for 100 generations, the attacker may need tens of thousands of evaluations. That can be easy against a local model and expensive or detectable against an API.',
        'The one-pixel constraint makes the attack interpretable but not always strong. Allowing more pixels, small norm-bounded perturbations, patches, or physical transformations gives the attacker more room. The case study is valuable because the constraint is extreme enough that success is surprising.',
        'For an API threat model, query monitoring matters as much as model training. A black-box optimizer leaves a behavioral trace: repeated near-identical images, changing one small region, and probing confidence. Rate limits and anomaly detection can raise the cost of search even when they do not make the classifier intrinsically robust.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This attack is useful as an educational benchmark for adversarial robustness, black-box optimization, and model sensitivity. It makes the vulnerability concrete: one changed coordinate and one changed color can be enough for some images and models.',
        'It also belongs in safety evaluation. A model that fails dramatically under tiny search-budget attacks may need adversarial training, input preprocessing, confidence calibration, abstention behavior, or deployment guardrails. The attack is a probe, not a complete threat model.',
        'It can also reveal class-specific weakness. If certain labels are much easier to induce, the problem may be tied to dataset artifacts, overconfident features, or poorly separated representations. Aggregate success rate matters, but the per-class pattern often teaches more.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The attack can fail when the model is robust around the image, when the target class is too far away, when query budgets are low, or when input preprocessing removes the perturbation. Failure on one image does not prove broad robustness; success on one image does not prove every deployment is unsafe.',
        'Another failure is overreading the result. A one-pixel digital attack does not automatically translate to a physical-world attack. Cameras, compression, lighting, scaling, and sensor noise change the input. Physical attacks need a separate evaluation setup.',
        'Defenses can also give a false sense of security. Simple smoothing, compression, or clipping may stop one attack configuration while leaving the model vulnerable to a better search, a different norm budget, or an adaptive attacker. Robustness claims need an attack suite, not one demo.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Adversarial Examples for the broader threat model, Evolutionary Search for the optimizer, Gradient Descent for white-box contrast, Saliency Maps for model sensitivity, Model Inversion and Data Leakage for other ML security failures, and Robustness Evaluation for how to turn attacks into useful evidence instead of isolated demos.',
        'A useful exercise is to run the attack on images that succeed and images that fail, then compare confidence trajectories. Ask whether failure came from the model being genuinely stable, the query budget being too small, or the optimizer searching a poor candidate representation.',
        'Then vary the budget: one pixel, three pixels, five pixels, and a small patch. The curve from budget to success rate is more informative than a single yes-or-no result because it shows how quickly robustness degrades.',
      ],
    },
  ],
};
