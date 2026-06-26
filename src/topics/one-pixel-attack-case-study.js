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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats an image classifier as a scoring function. A classifier maps an input image to class probabilities. A one-pixel attack changes one coordinate and its color values, then checks whether the classifier now prefers the wrong class.',
        'Active nodes are candidate edits being tested. Compare nodes are candidates whose model scores are being ranked. Found nodes are edits that force the target error. Removed nodes are candidates that failed to improve the objective.',
        'The important state is not the visible pixel alone. The search population stores many possible edits, and each model query teaches which location and color choices move the image closer to misclassification.',
        {type:'callout', text:'A one-pixel attack shows that robustness depends on decision-boundary geometry, not on whether an input change looks meaningful to humans.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The one-pixel attack exists to expose a mismatch between human perception and model geometry. A human sees a tiny local edit. A neural network sees a high-dimensional input vector whose internal activations may cross a decision boundary.',
        'An adversarial example is an input changed on purpose so a model gives a wrong answer. The one-pixel version uses an extreme budget: one coordinate in the image and its channel values. That makes the attack easy to inspect and hard to dismiss as obvious visual corruption.',
        'The case study is useful even when real attackers use larger budgets. It shows that accuracy on clean test data does not prove local stability around those inputs. Robustness is a property of neighborhoods, not only of points.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious attack is white-box gradient ascent. If the attacker can see model internals, it can compute how each pixel changes the loss and move the image in the direction that increases the wrong class score. This is efficient because gradients point to sensitive directions.',
        'That approach assumes access the attacker may not have. A deployed classifier may expose only labels or confidence scores through an API. The one-pixel setting also has a discrete search shape: choose x, y, red, green, and blue values.',
        'A brute-force search is too large. A 32 by 32 RGB image has 1,024 positions and 256 choices for each color channel. Exhaustively testing every one-pixel edit would require 1,024 times 256 cubed, about 17.2 billion model queries.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is sparse black-box search. The attacker has a tiny edit budget, no gradients, and a huge candidate space. Randomly trying pixels wastes queries because most locations and colors do not move the model enough.',
        'The wall is also evaluation cost. Against a local model, 20,000 queries may be cheap. Against a hosted API, the same search is slow, detectable, and expensive. The attack is therefore a study of model sensitivity and query behavior at the same time.',
        'A failed search does not prove the image is robust. It may mean the search representation, population size, mutation rate, or query budget was weak. Robustness claims need a stronger attack suite than one run of one optimizer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the attack as black-box optimization over a small vector. For one RGB pixel, a candidate can be written as [x, y, r, g, b]. The model is an oracle that returns a score for that candidate after the edit is applied.',
        'Differential evolution fits this shape because it does not need gradients. It keeps a population of candidates, mutates them by combining differences between existing candidates, and keeps trials that improve the target score. Selection pressure turns classifier feedback into directed search.',
        'The attack succeeds when a candidate crosses the decision boundary. The changed pixel may not look meaningful to a human, but it can change internal features enough to make the classifier prefer a different class.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the original image and a target objective. In an untargeted attack, any wrong class counts. In a targeted attack, the optimizer must raise one chosen class above the true class, which is usually harder.',
        'Create a population of candidate edits. For each candidate, write the proposed RGB value at the proposed coordinate, run the classifier, and record the score. The score may be target-class probability, true-class loss, or a margin between classes.',
        'For each generation, differential evolution builds trial candidates from current candidates, clips coordinates and colors into legal ranges, and evaluates the trials. A trial replaces its parent only if it scores better. The loop stops when the model is fooled or the query budget is exhausted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is modest because this is a heuristic attack, not an exact algorithm. If a one-pixel adversarial edit exists in the searched space and the optimizer samples enough useful directions, selection can move the population toward it.',
        'Differential evolution preserves the best candidates seen so far while exploring nearby and combined edits. That gives the search memory. A purely random search forgets where the model was already sensitive.',
        'The model geometry explains why success is possible. Deep classifiers can have decision regions that pass close to natural images. A small input change can have a large effect if it activates a fragile feature path or changes an important local pattern.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is model queries. With a population of 400 candidates and 75 generations, the attack uses about 30,000 evaluations. Doubling the population or generations roughly doubles query cost.',
        'The candidate dimension grows with the pixel budget. One RGB pixel uses five numbers. Five pixels use 25 numbers, which gives the optimizer more power but makes the search harder and less interpretable.',
        'Defender cost is behavioral. Rate limits, confidence hiding, anomaly detection, preprocessing, and abstention can raise attack cost, but they do not prove intrinsic robustness. Adversarial training and stronger evaluation are needed when the model must be stable under input changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The attack is useful as an educational benchmark for adversarial robustness. It makes the failure concrete: one coordinate and one color can be enough for some models and images.',
        'It is also useful in safety evaluation as a cheap probe. If a model fails under a tiny black-box budget, teams should test larger budgets, white-box attacks, patch attacks, physical transformations, and adaptive attacks before claiming robustness.',
        'The per-class pattern can teach more than the average success rate. If one target class is easy to induce, the model may rely on dataset artifacts or poorly separated features for that class.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The attack can fail when the decision boundary is not close to the image under the one-pixel constraint. It can also fail when preprocessing, resizing, compression, or input normalization removes the effect of the edited pixel.',
        'It does not automatically transfer to the physical world. Camera noise, lighting, focus, scale, print quality, and sensor processing can erase or alter a one-pixel digital perturbation. Physical attacks need a separate setup.',
        'It can be overread. Success on one image does not show that every deployment is unsafe. Failure on one image does not show that the model is robust. The result is a probe, not a full security proof.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 32 by 32 image of a frog is classified as frog with probability 0.82 and truck with probability 0.04. The attacker wants a targeted truck result. One candidate is [12, 7, 250, 10, 10], which writes a red pixel at column 12 and row 7.',
        'The first population has 400 candidates. After scoring them, the best candidate raises truck probability to 0.18. After 30 generations, a candidate at [9, 21, 5, 240, 80] raises truck probability to 0.47 while frog falls to 0.41.',
        'At generation 52, the best candidate reaches truck 0.61 and frog 0.22, so the targeted attack succeeds after about 20,800 queries. The image still looks like a frog to a human. The model has crossed a boundary in its input space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Su, Vargas, and Sakurai on one-pixel attacks, Goodfellow et al. on adversarial examples, and Storn and Price on differential evolution. Use robustness benchmarks and adaptive attack papers to avoid treating one attack as a complete evaluation.',
        'Study Adversarial Examples for the broader threat model, Evolutionary Search for the optimizer, Gradient Descent for the white-box contrast, Saliency Maps for sensitivity, and Robustness Evaluation for turning attacks into evidence.',
      ],
    },
  ],
};
