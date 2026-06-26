// Random forest: many shallow decision trees, each trained on a different
// view of the data, voting. Individually mediocre, collectively strong.

import { treeState, InputError } from '../core/state.js';

export const topic = {
  id: 'random-forest',
  title: 'Random Forest',
  category: 'AI & ML',
  summary: 'Three different decision trees classify the same animal, then vote. The ensemble reduces variance when trees make different mistakes.',
  controls: [
    { id: 'sample', label: 'Classify', type: 'select', options: ['cat (4kg, fur)', 'eagle (6kg, feathers)', 'goldfish (0.2kg, scales)'], defaultValue: 'eagle (6kg, feathers)' },
  ],
  run,
};

const SAMPLES = {
  'cat (4kg, fur)': { weight: 4, cover: 'fur', legs: 4, truth: 'mammal' },
  'eagle (6kg, feathers)': { weight: 6, cover: 'feathers', legs: 2, truth: 'bird' },
  'goldfish (0.2kg, scales)': { weight: 0.2, cover: 'scales', legs: 0, truth: 'fish' },
};

// Three hand-rolled trees, each "trained" on a different bootstrap sample
// and a different feature subset — which is exactly the randomness that
// makes a forest more than one tree repeated.
// Node: [question, test(s), left=yes, right=no] or a leaf string.
const TREES = [
  {
    name: 'Tree 1 (split on cover first)',
    root: ['cover = fur?', (s) => s.cover === 'fur',
      'mammal',
      ['cover = feathers?', (s) => s.cover === 'feathers', 'bird', 'fish'],
    ],
  },
  {
    name: 'Tree 2 (split on legs first)',
    root: ['legs â‰¥ 4?', (s) => s.legs >= 4,
      'mammal',
      ['legs = 2?', (s) => s.legs === 2, 'bird', 'fish'],
    ],
  },
  {
    name: 'Tree 3 (split on weight — a weaker view)',
    root: ['weight < 1kg?', (s) => s.weight < 1,
      'fish',
      ['weight < 5kg?', (s) => s.weight < 5, 'mammal', 'bird'],
    ],
  },
];

function build(node, nodes, specs) {
  const id = `n${nodes.size}`;
  if (typeof node === 'string') {
    nodes.set(id, { id, value: node, left: null, right: null });
    specs.set(id, node);
    return id;
  }
  const entry = { id, value: node[0], left: null, right: null };
  nodes.set(id, entry);
  specs.set(id, node);
  entry.left = build(node[2], nodes, specs);
  entry.right = build(node[3], nodes, specs);
  return id;
}

export function* run(input) {
  const sample = SAMPLES[String(input.sample)];
  if (!sample) throw new InputError('Pick one of the listed animals.');

  yield {
    state: treeState([], null),
    highlight: {},
    explanation: `One tree is easy to inspect but unstable: a small change in training rows or features can change its split path. A random forest trains several decorrelated trees and lets them vote, so one tree's blind spot is less likely to decide ${input.sample} alone.`,
  };

  const votes = [];
  for (const tree of TREES) {
    const nodes = new Map();
    const specs = new Map();
    const rootId = build(tree.root, nodes, specs);
    const all = () => treeState([...nodes.values()], rootId);

    let id = rootId;
    const path = [];
    while (true) {
      const node = nodes.get(id);
      path.push(id);
      const spec = specs.get(id);
      if (typeof spec === 'string') break;
      const answer = spec[1](sample);
      yield {
        state: all(),
        highlight: { active: [id], visited: path.slice(0, -1) },
        explanation: `${tree.name}: "${node.value}" -> ${answer ? 'YES' : 'NO'} for our ${input.sample.split(' ')[0]}. This tree commits to one local feature test; the forest relies on other trees seeing different features or rows.`,
      };
      id = answer ? node.left : node.right;
    }
    const verdict = nodes.get(id).value;
    votes.push(verdict);
    yield {
      state: all(),
      highlight: { found: [id], visited: path.slice(0, -1) },
      explanation: `${tree.name} reaches a leaf and votes "${verdict}". ${verdict === sample.truth ? 'This tree is right on this sample.' : `It misses the truth (${sample.truth}) because its feature view has a blind spot; the majority vote can still absorb that error.`}`,
      invariant: 'Trees never confer; voting helps only when their errors are not all the same.',
    };
  }

  const tally = votes.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  yield {
    state: treeState([], null),
    highlight: {},
    explanation: `The votes are ${votes.map((v, i) => `Tree ${i + 1}: ${v}`).join(', ')}. The majority class is "${winner[0]}" (${winner[1]} of 3)${winner[0] === sample.truth ? ', which matches the label.' : '.'} The structure works when random sampling and feature subsampling make mistakes decorrelated enough for averaging to reduce variance.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as one example moving through several decision trees. A decision tree is a model that asks feature-threshold questions until it reaches a leaf prediction.',
        { type: "callout", text: "A random forest reduces variance only when its trees make partly different mistakes; voting cannot fix identical blind spots." },
        {type: 'image', src: './assets/gifs/random-forest.gif', alt: 'Animated walkthrough of the random forest visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that the forest prediction is a vote, not a proof from one tree. If the trees make different errors, the majority can be steadier than any single path.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A random forest exists because one decision tree is flexible but unstable. Small changes in training rows can change the first split, and that change reshapes every decision below it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branches and leaf decisions', caption: 'A forest is built from many decision trees like this one, then aggregates their leaf predictions instead of trusting one path. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        'A forest trains many trees on different random views of the data and combines their predictions. For classification it usually votes, and for regression it averages numeric outputs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train one deep decision tree. It can capture thresholds, feature interactions, and nonlinear rules without scaling features or writing many transformations by hand.',
        'Pruning that tree makes it less brittle, but pruning also removes detail. The practitioner ends up choosing between a deep tree that memorizes noise and a shallow tree that misses real structure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is variance, which means sensitivity to the particular training sample. A tree that chooses age <= 42 at the root on one sample may choose income <= 61000 on another, sending later splits down a different path.',
        'Bagging reduces variance by training trees on bootstrap samples, which are samples drawn with replacement. If every tree still uses the same dominant feature first, the trees stay correlated and the vote helps less.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is variance reduction through partly independent trees. Random forests perturb both rows and split candidates, so each tree sees a bootstrap sample and each split considers only a random subset of features.',
        'This makes individual trees a little less greedy in the same direction. The forest wins when the errors are not identical, because averaging cancels some mistakes while preserving many useful threshold rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training chooses T trees. For each tree, it samples n rows with replacement from the n-row dataset, grows a decision tree, and at each split considers only m_try features out of p total features.',
        'Prediction sends the input through every tree. In classification, 70 votes for fraud and 30 votes for not fraud can become a 0.70 estimated probability before the team applies a business threshold.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is statistical rather than exact like a sorting algorithm. If each tree is better than random on the target distribution and their errors are not perfectly correlated, majority vote lowers the chance that the whole ensemble is wrong.',
        'The out-of-bag idea gives an internal check. About 36.8 percent of rows are omitted from any one bootstrap sample, so those rows can test that tree without being used to train it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost behaves like tree count times tree depth. If prediction through one tree takes 20 comparisons, a 500-tree forest may perform about 10,000 comparisons for one example before thresholding.',
        'When rows double, training each tree has more candidate split work, and deeper trees may grow unless constrained. Memory stores every feature index, threshold, child pointer, and leaf value, so more trees buy stability with latency and RAM.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Random forests are strong baselines for tabular classification and regression. They fit credit risk, fraud detection, churn prediction, manufacturing quality, and medical triage when features are structured fields rather than raw text or pixels.',
        'They are also useful for exploratory modeling. Feature importance and out-of-bag error can reveal whether the signal is stable enough to justify more specialized models.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A forest fails when all trees learn the same shortcut. Leakage, a dominant proxy feature, or biased sampling can make 500 trees confidently repeat one wrong rule.',
        'It also fails at extrapolation. Trees partition the observed feature space, so a forest usually cannot predict a trend beyond the range it saw during training the way a fitted equation might.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 100 trees classify loan applications, and one applicant receives 63 approve votes and 37 deny votes. With a deployment threshold of 0.70 for approval, the forest returns a 0.63 approve probability but the system still denies because the risk policy requires stronger support.',
        'Now compare a single tree that changed from approve to deny after 20 rows were resampled. If the forest vote moves only from 63 to 60 approvals, the ensemble absorbed that local instability instead of letting one root split control the outcome.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Breiman, Bagging Predictors, and Breiman, Random Forests. Ho, Random Decision Forests, is also useful for the random-subspace view.',
        'Study decision trees, entropy and Gini impurity, cross-validation, calibration, permutation importance, gradient boosting, and benchmark variance next. These topics separate a reliable forest from a lucky offline score.',
      ],
    },
  ],
};
