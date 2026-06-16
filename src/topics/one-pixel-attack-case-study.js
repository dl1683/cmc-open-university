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
    explanation: 'The original image is classified correctly. The one-pixel attack asks an extreme question: can a black-box search change only one pixel and make the classifier choose another class?',
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
    explanation: 'Differential Evolution treats one pixel edit as a tiny vector: location plus RGB value. The attack does not need gradients. It only needs to query the model confidence for candidate edits.',
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
    explanation: 'The population keeps edits that raise the target-class confidence. A few model queries are enough in this toy trace to cross the decision boundary, even though the visible image barely changed.',
  };

  yield {
    state: imageGrid('One pixel changed: classifier says frog', 'r1:c1'),
    highlight: { active: ['r1:c1'] },
    explanation: 'The payoff is disturbing: the human still sees the same object, but the classifier prediction flips. The attack exposes a gap between human perception and the model boundary.',
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
    explanation: 'The local note correctly emphasizes evaluation design. Success rate alone is incomplete. Confidence, target reachability, and source-target pairs explain how broad and asymmetric the vulnerability is.',
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
    explanation: 'This is the bridge to Evolutionary Search: candidate edits mutate, the classifier supplies fitness, and selection pressure keeps edits that push confidence in the target direction.',
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
    explanation: 'The right lesson is not panic over one pixel. It is that robustness needs explicit evaluation, adversarial examples, and defenses measured against adaptive attacks.',
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
    explanation: 'The one-pixel attack is a compact case study that links vision models, black-box optimization, robustness, interpretability, and the social stakes of automated image recognition.',
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
      heading: 'What it is',
      paragraphs: [
        'The one-pixel attack is an adversarial machine-learning case study. It asks whether a trained image classifier can be fooled by changing only one pixel. Su, Vargas, and Kouichi showed that a tiny, black-box perturbation can flip predictions on standard image datasets. The attack is visually memorable, but the deeper lesson is about model boundaries: a classifier can be extremely sensitive in directions humans barely notice.',
        'The attack uses Differential Evolution, a population-based black-box optimizer. A candidate is simply the pixel coordinate and color value. The model is queried, the candidate score is the target-class confidence or misclassification objective, and the population evolves toward edits that fool the classifier. No gradient access is required.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a targeted attack, the search tries to make the model predict a specific wrong class. For a non-targeted attack, it only needs the model to stop predicting the original class. Each candidate edit changes one pixel, runs the classifier, and records the resulting class probabilities. Evolutionary Search mutates and recombines better candidates until the score crosses the decision boundary.',
        'This connects to Convolution because image classifiers build features from local pixel patterns. It connects to Adversarial Examples because the semantic object remains the same for humans while the model boundary changes. It connects to Saliency Maps because input sensitivity is the central question: which tiny changes can move the output dramatically?',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The striking part is the low resource requirement. The search space is small compared with full-image perturbations, and the attack needs only probability outputs. That makes it useful as a black-box robustness probe. However, the attack is not a universal guarantee that every image can be fooled with one pixel. Its success depends on dataset, model architecture, target class, confidence threshold, image resolution, and query budget.',
        'Robust evaluation should report success rate, confidence, target reachability, source-target asymmetries, and query cost. A defense should be tested against adaptive variants, not only the exact original attack. Data augmentation and adversarial training can help, but robustness claims need holdout attacks and realistic threat models.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'One-pixel style attacks are mainly research probes, but the lesson reaches surveillance, medical imaging, autonomous systems, content moderation, OCR, and face recognition. The local note highlights both sides: tiny perturbations can expose unsafe classifiers, and they can also suggest ways people might resist unwanted automated recognition. In high-stakes systems, robustness is not an aesthetic property; it is part of the safety contract.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not overread the literal pixel count. A one-pixel success on low-resolution images does not mean the same edit works on every real camera image. Do not underread it either. The paper demonstrates that confident neural classifiers can have surprising decision boundaries under black-box search. The important takeaway is to evaluate models under adversarial, corrupted, and distribution-shifted inputs before trusting headline accuracy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: One Pixel Attack for Fooling Deep Neural Networks at https://arxiv.org/abs/1710.08864. The provided local corpus note emphasizes differential evolution, low-cost evaluation, and metric design. Study Adversarial Examples, Evolutionary Search, Convolution, Saliency Maps, Logistic Regression, and Contrastive Learning: SimCLR next.',
      ],
    },
  ],
};
