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
        `A Random Forest is an ensemble of decision trees that vote. Instead of training one tree to memorize your data (which overfits), you train many shallow trees on different random slices of the data—each sees a random subset of features and a bootstrap sample of rows. Trees disagree where they are biased; their mistakes are independent-ish. Vote on the majority and the errors cancel.`,
        `This visualization shows three hand-rolled trees: Tree 1 splits on cover (fur → mammal), Tree 2 on legs (4+ legs → mammal), and Tree 3 on weight (weak signal). Alone, Tree 3 might guess wrong; together, the forest votes correctly.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build T trees (commonly 50–500). For each tree: bootstrap a random sample of rows (random sampling with replacement), pick a random subset of features, and greedily split on whichever feature reduces impurity best. Stop early to keep trees shallow. Each tree is biased to its random view.`,
        `At prediction time: run your input through all T trees. For classification, count votes and return the majority. For regression (predicting numbers), average the tree outputs. No coordination between trees—they are trained in parallel, scored in parallel.`,
        `The magic: independence of errors. Tree 1 might mistake a goldfish for a bird (bad feature weighting); Tree 2 catches it. They agree on hard cases. The ensemble error is a fraction of the single-tree error.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training time: O(T × log N × D × F_try) — T trees, each needing O(log N) to recurse D levels, considering F_try random features per split. With N rows, D ≈ 4–10, F_try = sqrt(F), and T = 100, this is fast on tabular data. Prediction: O(T × D) — linear in tree count and depth, sub-millisecond.`,
        `Memory: O(T × log N × F_try) at train time, minimal at serve (one copy of all trees).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Scikit-learn's RandomForestClassifier and RandomForestRegressor are starter defaults for tabular problems: credit defaults, customer churn, medical diagnosis, fraud detection. Every Kaggle tabular competition has a random forest baseline.`,
        `Production databases (Cassandra, DynamoDB) use tree-like routing heuristics inspired by ensemble ideas. XGBoost, LightGBM, and CatBoost (gradient boosting variants) dominate industry—they're refined forests that correct each new tree toward the residual error of prior trees, winning faster and more efficiently than vanilla random forests.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `"Random forests need many trees." — True: 10 trees is often underfitting; 100–500 is typical. But diminishing returns kick in—adding tree 500 helps less than tree 50. Use out-of-bag error (rows not in a given bootstrap) to estimate accuracy without a held-out test set.`,
        `"Deeper trees are better." — Wrong. Deep trees overfit. Random forests keep trees shallow (depth ≈ log N), which is the whole point. Deep forests are just stacking noise.`,
        `"Random forests work on images." — Wrong. They need tabular features. For images, CNN or vision transformers are the right move. Random forests win on spreadsheets, not pixels.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Explore Decision Trees to understand the building block. Then learn Gradient Boosting to see how chaining trees beats averaging them. For ensemble theory, read up on K-Means Clustering and understand how aggregating independent guesses reduces variance. Finally, jump to neural networks with Attention Mechanism if you want to see how deep learning trades tree interpretability for raw performance on unstructured data.`,
      ],
    },
  ],
};

