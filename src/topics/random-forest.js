// Random forest: many shallow decision trees, each trained on a different
// view of the data, voting. Individually mediocre, collectively strong.

import { treeState, InputError } from '../core/state.js';

export const topic = {
  id: 'random-forest',
  title: 'Random Forest',
  category: 'AI & ML',
  summary: 'Three different decision trees classify the same animal — then vote. Ensembles beat soloists.',
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
    root: ['legs ≥ 4?', (s) => s.legs >= 4,
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
    explanation: `One decision tree is easy to read but easy to fool — it overfits whatever quirks its training data had. A RANDOM FOREST trains many trees, each on a random resample of the data (bagging) considering random subsets of features, then lets them VOTE. We'll classify ${input.sample} with a 3-tree forest.`,
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
        explanation: `${tree.name}: "${node.value}" → ${answer ? 'YES' : 'NO'} for our ${input.sample.split(' ')[0]}. Each internal node asks one cheap question about one feature; the answer picks a branch.`,
      };
      id = answer ? node.left : node.right;
    }
    const verdict = nodes.get(id).value;
    votes.push(verdict);
    yield {
      state: all(),
      highlight: { found: [id], visited: path.slice(0, -1) },
      explanation: `${tree.name} reaches a leaf: votes "${verdict}". ${verdict === sample.truth ? 'Correct.' : `WRONG (it is a ${sample.truth}) — this tree's features gave it a blind spot. Alone, that's an error; in a forest, it's just one bad vote.`}`,
      invariant: 'Trees never confer — their errors are independent-ish, which is what voting exploits.',
    };
  }

  const tally = votes.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  yield {
    state: treeState([], null),
    highlight: {},
    explanation: `The vote: ${votes.map((v, i) => `Tree ${i + 1} says ${v}`).join(', ')} → majority: "${winner[0]}" (${winner[1]} of 3)${winner[0] === sample.truth ? ' — correct!' : ''}. That is the entire trick: individually shallow, biased trees, made collectively accurate by averaging away their independent mistakes. Random forests still win on tabular data (spreadsheets, fraud features, medical records) where deep learning often isn't worth the cost — and their cousin, gradient-boosted trees (XGBoost), wins Kaggle competitions to this day.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A random forest is an ensemble of decision trees. One tree is easy to interpret but unstable: a small change in training data can change its splits and predictions. A forest reduces that variance by training many trees on different bootstrap samples and random feature subsets, then averaging their votes. Leo Breiman introduced the method in 2001, extending his earlier bagging work from 1996.`,
        `The central bet is diversity. If every tree makes the same mistake, voting does nothing. If trees make partly independent mistakes, the majority vote is more reliable than any one tree. For classification the forest votes; for regression it averages numeric predictions. The demo's three trees are tiny, but production forests often use hundreds of trees.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For each tree, sample n training rows with replacement from the n-row dataset. About 63.2% of unique rows appear in that bootstrap sample; about 36.8% are left out and can estimate out-of-bag error. At every split, consider only a random subset of features, commonly sqrt(p) features for classification when p total features exist. Pick the split that best reduces impurity, such as Gini impurity or entropy.`,
        `Trees are usually grown deep unless constrained by max depth, minimum leaf size, or pruning-like settings. Deep individual trees can overfit, but averaging many decorrelated trees controls variance. This differs from Gradient Boosting, where trees are added sequentially to fix the previous ensemble's residual errors. Forests parallelize naturally; boosting is more order-dependent.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A rough balanced-tree training cost is O(T * n * m_try * log n) after accounting for T trees, n rows, and m_try candidate features per split, though exact cost depends on sorting, split search, depth, and implementation. Prediction costs O(T * depth) decisions per example. Memory stores every split in every tree, so very large forests can be heavy even when each split is cheap. In scikit-learn, 100 to 500 trees is common; more trees reduce variance but eventually hit diminishing returns.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Random forests are strong tabular baselines for fraud detection, credit risk, churn prediction, medical triage, remote-sensing land cover, bioinformatics, and feature-importance analysis. They handle nonlinear interactions, mixed feature scales, and missing-ish tabular signals better than many linear models. Naive Bayes (Spam Filter) is simpler and faster for bag-of-words text; Gradient Boosting usually wins modern tabular leaderboards; forests remain valuable because they are robust, parallel, and relatively low-tuning.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A forest is not automatically interpretable just because each tree is. Hundreds of trees are harder to reason about than one tree, and impurity-based feature importance can favor high-cardinality features. Use permutation importance, partial dependence, and held-out metrics. Cross-Validation & Honest Evaluation matters because out-of-bag error is useful but not a replacement for a final untouched test set.`,
        `Another trap is using forests on raw images, audio, or long text and expecting deep-learning performance. They work best after feature engineering or on structured tables. For imbalanced problems, optimize Precision, Recall & the Confusion Matrix and thresholds, not just accuracy. Regularization: L1 & L2 is not how trees regularize; tree depth, leaf size, feature subsampling, and tree count are the relevant controls.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Gradient Boosting to see sequential tree ensembles, Cross-Validation & Honest Evaluation to measure generalization, and Precision, Recall & the Confusion Matrix for imbalanced classification. Dropout gives a neural-network analogy for averaging thinned predictors. K-Means Clustering provides a contrasting unsupervised method where there are no labels and no votes.`,
      ],
    },
  ],
};