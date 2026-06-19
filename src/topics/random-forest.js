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
        "Read the animation as the execution trace for Random Forest. Three different decision trees classify the same animal — then vote. Ensembles beat soloists..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `A random forest is an ensemble of decision trees. Each tree learns a sequence of if-then splits over the input features and ends at a leaf prediction. A single tree is easy to inspect, but it is unstable. Change a few training rows, or allow a slightly different first split, and the whole downstream tree can change. A random forest turns that instability into a strength by training many trees on different views of the data and combining their predictions.`,
        `For classification, the forest usually predicts by majority vote. For regression, it averages numeric outputs. The word "random" refers to two sources of variation: each tree trains on a bootstrap sample of rows, and each split considers only a random subset of features. The word "forest" matters too. The model is not one carefully pruned explanation tree. It is a crowd of partly independent trees whose errors can cancel when they are not all wrong in the same way.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious approach is to train one decision tree. It can model nonlinear rules, interactions, thresholds, and mixed feature types without forcing the data into a linear equation. A tree can learn that income matters only after debt crosses a threshold, or that a medical risk score changes when age and a lab value interact. It is also readable: follow the path from root to leaf and you can explain one prediction as a series of feature tests.`,
        `The wall is variance. Decision trees are greedy. They choose a split, then choose the next split inside the partition created by the first one. Early choices are amplified. A small data perturbation can change the root split, which changes every later candidate split. Deep trees fit training data well but generalize poorly. Shallow trees have lower variance but higher bias. One tree often forces the practitioner to choose between a brittle accurate tree and a stable underfit tree.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is variance reduction through decorrelation. A deep tree is a high-variance estimator: it can fit complex structure, but it moves around when the sample changes. Averaging many high-variance estimators can be powerful if their errors are not perfectly correlated. If every tree sees the same rows and always considers the same strongest features, the trees will look similar and the vote will not help much. Random forests deliberately make trees different.`,
        `Bootstrap sampling changes the rows each tree sees. Feature subsampling changes which features can compete at each split. A dominant feature cannot always win immediately because it may not be available in that split's candidate set. Weaker but useful features get chances to shape some trees. The final forest combines many local opinions. This does not eliminate bias, but it can dramatically reduce the variance that makes a single tree unreliable.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Training begins with T, the number of trees. For each tree, sample n rows with replacement from the n-row training set. Some original rows appear multiple times; some do not appear at all. The omitted rows are the out-of-bag examples for that tree. They can estimate prediction error without a separate validation set, although a final untouched test set is still important. The tree then grows by repeatedly choosing splits that reduce impurity, such as Gini impurity or entropy for classification and squared error for regression.`,
        `At each split, the algorithm considers only m_try randomly selected features out of p total features. A common classification default is around sqrt(p), though the best value is empirical. Trees are often grown deep, subject to constraints such as maximum depth, minimum samples per leaf, minimum impurity decrease, or maximum leaf nodes. Prediction is simple: run the example down every tree, collect the votes or numeric predictions, and combine them. Training parallelizes naturally because trees do not depend on previous trees.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The cost is mostly tree count times tree size. Training grows many split structures, so runtime depends on rows, candidate features per split, split-search strategy, depth, and the number of trees. Prediction is usually fast per tree, but a forest with hundreds of deep trees still performs hundreds of root-to-leaf walks for every example. Memory stores every split threshold, feature index, child pointer, and leaf value. More trees reduce variance until the curve flattens, then they mostly add latency and memory.`,
        `The main tuning controls are number of trees, maximum depth, minimum samples per leaf, maximum features per split, bootstrap use, class weights, and the decision threshold applied after probability estimation. Random forests are forgiving, but they are not parameter-free. A small forest can be noisy. A very deep forest can memorize leakage. A huge forest can be too slow for online scoring.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Random forests work well on tabular data because many tabular relationships are thresholded, nonlinear, and interaction-heavy. A linear model needs explicit feature engineering to express "high risk only when feature A is large and feature B is small." A tree can express that kind of rule through splits. A forest can express many such rules and average across them. Feature scaling is usually not a problem because split thresholds depend on order, not Euclidean distance.`,
        `They also work because they are robust baselines. They need less hyperparameter tuning than many neural networks. They can handle mixtures of numeric, binary, ordinal, and encoded categorical variables. They can expose rough feature importance. They are less sensitive to monotonic transformations than models that depend on distances or dot products. On many structured problems, a random forest will not be the final leaderboard winner, but it gives a strong first answer that is hard to embarrass.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Use random forests for tabular classification and regression when you need a strong baseline quickly. Common domains include fraud detection, credit risk, churn prediction, insurance pricing, medical triage, remote-sensing land cover, manufacturing quality, bioinformatics, demand signals, and operational risk scoring. They are also useful when you want to inspect feature behavior before committing to a more specialized model.`,
        `They fit especially well when the data is medium-sized, structured, and not dominated by raw pixels, waveform samples, or long text. For text, Naive Bayes and linear models can be stronger simple baselines after bag-of-words features. For modern tabular competitions, Gradient Boosting often beats random forests because boosting corrects residual errors sequentially. Still, forests remain valuable because they are parallel, stable, relatively low-tuning, and resistant to some overfitting patterns that defeat one tree.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `A forest fails when its trees are too correlated. If the dataset has one overwhelmingly strong shortcut feature, many trees may split on it whenever it appears and inherit the same blind spot. If the training data has leakage, every tree can learn the leaked signal and the majority vote will look excellent offline while failing in production. If the task requires extrapolation beyond the range of observed data, tree methods struggle because they predict by partitioning known feature space rather than learning a smooth equation.`,
        `Interpretability is another common misconception. One small tree is interpretable. A forest with hundreds of deep trees is not automatically transparent. Impurity-based feature importance can favor high-cardinality or high-variance features. Correlated features can split importance in misleading ways. Use permutation importance, partial dependence, accumulated local effects, and slice-level metrics. For imbalanced problems, accuracy can be useless. Study Precision, Recall & the Confusion Matrix and tune thresholds against real costs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Evaluate a forest with out-of-bag error, cross-validation, and a final test set that was not used for model choice. Track accuracy, precision, recall, F1, ROC AUC, precision-recall AUC, calibration, regression error, and business cost depending on the task. Compare against a single decision tree, logistic regression or linear regression, Gradient Boosting, and any existing production baseline. Inspect performance by slice, not only in aggregate. Watch training time, prediction latency, memory size, tree depth, number of leaves, and stability of feature importance across folds.`,
        `Primary sources are Breiman's bagging paper at https://www.stat.berkeley.edu/~breiman/bagging.pdf and Random Forests at https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf. Study Decision Trees first if the split mechanics are not clear. Then study Gradient Boosting for sequential tree ensembles, Cross-Validation & Honest Evaluation for generalization measurement, Calibration & Reliability Diagrams for probability quality, Threshold Optimization for deployment decisions, Tabular Feature-Basis Orientation Primer for structured-data geometry, Causal Forest Uplift Policy for treatment effects, and Benchmark Variance & Model Selection before trusting one lucky score.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "One decision tree: split data recursively on the best feature and threshold. Simple, interpretable, but overfits badly. A deep tree memorizes training data and performs poorly on new data. Pruning helps but limits capacity.",
        "Bagging (Breiman 1996): train T trees on T bootstrap samples (sample N points with replacement from N). Average their predictions. Variance drops by roughly 1/T, bias stays the same. But if one feature dominates (e.g., income predicts spending), every tree splits on it first. The trees are correlated, so averaging does not help much.",
        "Random Forest (Breiman 2001): at each split, consider only m random features out of p total. Default: m = sqrt(p) for classification, m = p/3 for regression. This decorrelates the trees. Each tree is individually worse (higher bias), but the ensemble's variance drops dramatically. Result: one of the most reliable out-of-box classifiers. Kaggle competitions from 2010 to 2015 were dominated by random forests before gradient boosting took over.",
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        "2D data, 2 classes. Features: height, weight. Training: (170, 65, A), (180, 80, B), (160, 55, A), (175, 70, B), (165, 60, A), (185, 85, B).",
        "Tree 1 (features: {height}): split height <= 172.5 -> A, else B. Accuracy: 5/6. Tree 2 (features: {weight}): split weight <= 67.5 -> A, else B. Accuracy: 5/6. Tree 3 (bootstrap + {height}): (170,65,A) sampled twice, (185,85,B) missing. Split height <= 167.5 -> A, else B.",
        "For new point (172, 68): Tree1 -> B, Tree2 -> B, Tree3 -> B. Vote: B (unanimous). For (168, 66): Tree1 -> A, Tree2 -> A, Tree3 -> B. Vote: A (2-1). The majority vote smooths individual tree errors.",
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        "Feature importance: for each tree, track how much each feature reduces impurity (Gini or entropy) across all splits. Average across trees. Height might contribute 60% of total impurity reduction, weight 40%. This ranking is free — it comes from the training process.",
        "Out-of-bag (OOB) error: each bootstrap sample excludes roughly 37% of data points (1 - 1/e is approximately 0.368). Use excluded points as a free validation set for that tree. Average OOB error across all trees approximates test error. No need for a separate validation set.",
        "Gradient Boosted Trees (Friedman 2001, XGBoost/LightGBM): instead of averaging independent trees, build trees sequentially — each tree fits the residual errors of the ensemble so far. Less parallelizable but usually more accurate.",
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        "Breiman 2001 (Random Forests — the foundational paper). Breiman 1996 (Bagging Predictors — the bootstrap aggregation idea). Ho 1995 (Random Decision Forests — independent invention using random subspaces).",
        "Study next: Binary Search Tree (the recursive splitting structure), Naive Bayes (simpler classifier for comparison), Entropy / Cross-Entropy (the split criterion), A/B Testing (statistical validation of model performance), Gradient Descent (gradient boosting is the main competitor).",
      ],
    },
],
};

