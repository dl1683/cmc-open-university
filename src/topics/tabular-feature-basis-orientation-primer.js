// Tabular feature-basis orientation: why raw columns, rotations, ratios, and
// irrelevant features change the inductive bias of trees and neural nets.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tabular-feature-basis-orientation-primer',
  title: 'Tabular Feature-Basis Orientation Primer',
  category: 'AI & ML',
  summary: 'A visual primer on tabular feature orientation: axis-aligned tree splits, rotated feature bases, irrelevant columns, engineered ratios, and fair diagnostics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['axis splits', 'diagnostic protocol'], defaultValue: 'axis splits' },
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

function basisGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw cols', x: 0.8, y: 3.6, note: 'meaning' },
      { id: 'rotate', label: 'rotate', x: 2.6, y: 1.8, note: 'mix' },
      { id: 'ratio', label: 'ratios', x: 2.6, y: 3.6, note: 'domain' },
      { id: 'noise', label: 'noise', x: 2.6, y: 5.4, note: 'junk' },
      { id: 'tree', label: 'tree', x: 5.0, y: 2.6, note: 'split' },
      { id: 'net', label: 'net', x: 5.0, y: 4.6, note: 'mix' },
      { id: 'score', label: 'score', x: 7.2, y: 3.6, note: 'slices' },
      { id: 'diag', label: 'diagnose', x: 9.0, y: 3.6, note: 'basis' },
    ],
    edges: [
      { id: 'e-raw-rotate', from: 'raw', to: 'rotate' },
      { id: 'e-raw-ratio', from: 'raw', to: 'ratio' },
      { id: 'e-raw-noise', from: 'raw', to: 'noise' },
      { id: 'e-rotate-tree', from: 'rotate', to: 'tree' },
      { id: 'e-ratio-tree', from: 'ratio', to: 'tree' },
      { id: 'e-noise-tree', from: 'noise', to: 'tree' },
      { id: 'e-rotate-net', from: 'rotate', to: 'net' },
      { id: 'e-ratio-net', from: 'ratio', to: 'net' },
      { id: 'e-noise-net', from: 'noise', to: 'net' },
      { id: 'e-tree-score', from: 'tree', to: 'score' },
      { id: 'e-net-score', from: 'net', to: 'score' },
      { id: 'e-score-diag', from: 'score', to: 'diag' },
    ],
  }, { title });
}

function* axisSplits() {
  yield {
    state: basisGraph('Raw column orientation is part of the model'),
    highlight: { active: ['raw', 'ratio', 'tree', 'e-raw-ratio', 'e-ratio-tree'], compare: ['rotate', 'net'], found: ['score'] },
    explanation: 'Tabular columns often already mean something: age, balance, utilization, claims count, lab value, days since signup. A tree split can use those axes directly. A rotation mixes columns into synthetic directions, which may remove the threshold shape the tree was exploiting.',
    invariant: 'The feature basis is not neutral when the model uses axis-aligned splits.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'raw feature A', min: 0, max: 10 }, y: { label: 'target risk', min: 0, max: 1 } },
      series: [
        { id: 'tree', label: 'tree split', points: [{ x: 0, y: 0.18 }, { x: 3.9, y: 0.18 }, { x: 4.0, y: 0.72 }, { x: 10, y: 0.72 }] },
        { id: 'smooth', label: 'smooth fit', points: [{ x: 0, y: 0.15 }, { x: 2, y: 0.28 }, { x: 4, y: 0.45 }, { x: 6, y: 0.62 }, { x: 10, y: 0.78 }] },
      ],
      markers: [
        { id: 'cut', x: 4, y: 0.72, label: 'cut' },
      ],
    }),
    highlight: { active: ['tree', 'cut'], compare: ['smooth'] },
    explanation: 'The simplest table signal is a threshold. A decision tree gets a cheap discontinuity. A smooth neural fit can approximate it, but usually needs more data, more capacity, or more tuning.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'rotated basis', min: 0, max: 10 }, y: { label: 'target risk', min: 0, max: 1 } },
      series: [
        { id: 'mixed', label: 'mixed signal', points: [{ x: 0, y: 0.30 }, { x: 2, y: 0.55 }, { x: 4, y: 0.38 }, { x: 6, y: 0.74 }, { x: 8, y: 0.42 }, { x: 10, y: 0.80 }] },
        { id: 'tree', label: 'tree path', points: [{ x: 0, y: 0.32 }, { x: 3, y: 0.32 }, { x: 3.1, y: 0.56 }, { x: 7, y: 0.56 }, { x: 7.1, y: 0.66 }, { x: 10, y: 0.66 }] },
      ],
      markers: [
        { id: 'mix', x: 5, y: 0.74, label: 'mixed' },
      ],
    }),
    highlight: { active: ['mixed', 'mix'], compare: ['tree'] },
    explanation: 'After rotation, one original threshold may be smeared across several coordinates. This is why a representation that helps one model family can hurt another. PCA-like transforms are useful tools, but they are not harmless preprocessing.',
  };

  yield {
    state: labelMatrix(
      'Feature-basis choices',
      [
        { id: 'raw', label: 'raw cols' },
        { id: 'scaled', label: 'scaled' },
        { id: 'rotated', label: 'rotated' },
        { id: 'ratio', label: 'ratios' },
        { id: 'embed', label: 'embeds' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'hurts', label: 'hurts' },
      ],
      [
        ['tree splits', 'unit drift'],
        ['NN training', 'outliers'],
        ['linear nets', 'tree axes'],
        ['domain rules', 'leak risk'],
        ['entities', 'small data'],
      ],
    ),
    highlight: { active: ['raw:helps', 'ratio:helps', 'scaled:helps'], compare: ['rotated:hurts'] },
    explanation: 'Preprocessing has model-specific consequences. Scaling is often required for neural nets. Rotation can help linear or neural models but harm tree axes. Ratios can expose domain rules, but only if they are leakage-safe.',
  };

  yield {
    state: basisGraph('Noise columns test whether the model can ignore junk'),
    highlight: { active: ['noise', 'tree', 'net', 'score', 'e-noise-tree', 'e-noise-net'], compare: ['ratio'] },
    explanation: 'The local notes emphasize uninformative features: adding random columns often hurts MLP-like neural nets more than trees. The useful diagnostic is controlled noise injection: add junk columns, tune both models fairly, then plot degradation by model family.',
  };
}

function* diagnosticProtocol() {
  yield {
    state: labelMatrix(
      'Orientation diagnostics',
      [
        { id: 'raw', label: 'raw' },
        { id: 'scaled', label: 'scaled' },
        { id: 'rotated', label: 'rotated' },
        { id: 'noise', label: 'noise add' },
        { id: 'drop', label: 'drop weak' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'learns', label: 'learns' },
      ],
      [
        ['baseline', 'true start'],
        ['normalize', 'scale need'],
        ['random mix', 'basis need'],
        ['junk cols', 'robustness'],
        ['feature trim', 'signal'],
      ],
    ),
    highlight: { active: ['raw:test', 'rotated:test', 'noise:test', 'drop:test'], found: ['scaled:learns'] },
    explanation: 'The protocol is a small experiment grid. Compare raw, scaled, rotated, noise-injected, and feature-trimmed versions under the same tuning budget. The result tells you whether the model needs the original basis, clean features, scaling, or representation learning.',
    invariant: 'A preprocessing step is not neutral until the benchmark proves it.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'random noise cols', min: 0, max: 100 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'gbdt', label: 'GBDT', points: [{ x: 0, y: 90 }, { x: 20, y: 88 }, { x: 50, y: 86 }, { x: 100, y: 82 }] },
        { id: 'mlp', label: 'MLP', points: [{ x: 0, y: 88 }, { x: 20, y: 79 }, { x: 50, y: 66 }, { x: 100, y: 48 }] },
      ],
      markers: [
        { id: 'gap', x: 50, y: 66, label: 'gap opens' },
      ],
    }),
    highlight: { active: ['gbdt', 'mlp', 'gap'] },
    explanation: 'This conceptual plot mirrors the paper lesson. Trees can skip bad features at split time. MLP-like nets still receive every input coordinate and may spend capacity learning around irrelevant or noisy columns.',
  };

  yield {
    state: basisGraph('A basis audit becomes a model-selection record'),
    highlight: { active: ['raw', 'rotate', 'ratio', 'noise', 'score', 'diag', 'e-score-diag'], found: ['tree', 'net'] },
    explanation: 'Store the result like a model-selection record: dataset version, split policy, preprocessing transform, tuning budget, model family, slice metrics, and cost. Otherwise the team only remembers that one model won, not why it won.',
  };

  yield {
    state: labelMatrix(
      'Actionable outcomes',
      [
        { id: 'treewin', label: 'tree wins' },
        { id: 'netwin', label: 'net wins' },
        { id: 'tie', label: 'tie' },
        { id: 'unstable', label: 'unstable' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'move', label: 'move' },
      ],
      [
        ['axis bias', 'ship GBDT'],
        ['rep learns', 'audit cost'],
        ['no big diff', 'simpler wins'],
        ['slice drift', 'fix data'],
      ],
    ),
    highlight: { active: ['treewin:move', 'netwin:move', 'tie:move', 'unstable:move'] },
    explanation: 'A diagnostic is useful only when it changes the decision. If tree wins on raw and loses after rotation, preserve the raw basis. If neural wins only after heavy tuning, include cost. If the result is unstable, fix splits and leakage before arguing architecture.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'axis splits') yield* axisSplits();
  else if (view === 'diagnostic protocol') yield* diagnosticProtocol();
  else throw new InputError('Pick a tabular feature-basis view.');
}

export const article = {
  sections: [
    {
      heading: `Why This Exists`,
      paragraphs: [
        `Tabular data looks simple because it arrives as rows and columns. That appearance is misleading. The columns usually have units, rules, and business meaning: account age, utilization, claims count, lab value, inventory age, payment delay, distance, salary, or days since signup. The coordinate system is already a domain model.`,
        `Feature-basis orientation matters because model families use that coordinate system differently. A tree can split directly on utilization > 0.40. A linear model sees weighted sums. A neural network can mix coordinates, but it must learn the useful mixtures from data and optimization. A rotation, scaling choice, ratio, embedding, or noise column can change which family looks strong.`,
        `This primer exists to stop a common mistake: treating preprocessing as a neutral prelude to model selection. The representation is part of the model comparison. If it is changed casually, the benchmark may reward the transform rather than the model family.`,
      ],
    },
    {
      heading: `The Obvious Approach and the Wall`,
      paragraphs: [
        `The obvious approach is to choose one feature pipeline, run several models, and declare the winner. The pipeline might scale numeric features, one-hot encode categories, compute embeddings, add ratios, or rotate the numeric matrix with PCA. That is convenient, but it hides the question of which representation each model needed.`,
        `The wall is that the same transform can help one family and hurt another. Scaling often helps gradient-based models. Axis-aligned trees often do not need it. Rotating features can help smooth or linear methods find directions, but it can hide a simple threshold that a tree would otherwise capture in one split. Adding many weak columns may barely affect a strong tree but can consume neural capacity and increase overfitting risk.`,
        `A fair comparison must separate model ability from representation fit. Otherwise the team may conclude that deep learning lost when the real issue was a weak neural preprocessing pipeline, or that a neural model won when it was given engineered features that the tree baseline never received.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `Treat the feature basis as an experimental variable. Raw columns, scaled columns, rotated columns, engineered ratios, target encodings, categorical embeddings, feature selection, and injected noise are different interfaces between data and model. They are not cosmetic alternatives.`,
        `The core invariant is comparison discipline. When you change the basis, record what changed, which model family used it, how it was tuned, which data split was used, which leakage guards were applied, and how the result behaved by slice. A model-selection result without that record is hard to trust and hard to reproduce.`,
        `This is not an argument that trees always beat neural nets or that raw columns are always best. It is an argument that the coordinate system is part of the inductive bias. The right question is: which representation makes the true signal easiest for this model family to learn without leaking future information or overfitting noise?`,
      ],
    },
    {
      heading: `Axis-Aligned Splits`,
      paragraphs: [
        `Decision trees and gradient-boosted trees build rules from thresholds on individual features. If a medical risk changes sharply after a lab value crosses a clinical boundary, or credit risk jumps after utilization passes a threshold, a tree can express that rule cheaply. The split aligns with the raw column.`,
        `That strength depends on the basis. If a rotation mixes utilization, income, age, and payment history into synthetic coordinates, the original threshold still exists mathematically, but it no longer sits on one axis. A tree may need many splits to approximate what used to be one split.`,
        `This is why domain features and ratios often matter in tabular work. A debt-to-income ratio, utilization ratio, distance-per-delivery, or claims-per-month feature can create an axis that matches a business rule. The model did not become smarter; the basis made the rule easier to express.`,
      ],
    },
    {
      heading: `Neural and Linear Models`,
      paragraphs: [
        `Neural networks and linear models interact with basis in a different way. Scaling matters because gradient descent is sensitive to feature magnitude. If one column ranges from 0 to 1 and another ranges from 0 to 1,000,000, the optimizer may spend effort dealing with scale rather than learning useful structure.`,
        `Neural models can learn feature interactions, but the phrase "can learn" is not a guarantee. They may need more data, regularization, embedding design, normalization, architecture tuning, and training time. On small or medium tabular datasets with strong axis-aligned rules, a boosted tree can be a hard baseline to beat.`,
        `Linear models can benefit from rotations or engineered interactions because their decision surface is simple. A rotation can reveal a direction that a linear classifier uses cleanly. But the same rotation may make a tree less efficient. That is the central orientation tradeoff.`,
      ],
    },
    {
      heading: `Noise and Irrelevant Features`,
      paragraphs: [
        `Irrelevant columns are not harmless. A tree can often ignore a weak feature by never selecting it for a split, although enough noise can still waste search budget and increase variance. A neural model receives every coordinate at the input layer, so junk features can consume capacity, distort gradients, and invite overfitting.`,
        `Noise injection is a useful diagnostic. Add random columns under controlled conditions and watch how each model family degrades. If a neural model collapses as noise grows while the tree degrades slowly, the issue may be feature selection, regularization, or input representation rather than a deep truth about the dataset.`,
        `The point is not to sabotage the model. The point is to measure robustness. Production tables often gain columns over time, some useful and some weak. A model that is fragile to irrelevant features needs a stronger feature gate before deployment.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A basis-orientation diagnostic starts with a clean data split, usually time-safe for business data. Train a strong tree baseline, a linear baseline, and a neural or tabular deep-learning baseline under documented tuning budgets. Then vary one representation choice at a time.`,
        `A compact grid might include raw columns, scaled columns, rotated numeric columns, leakage-safe domain ratios, categorical encodings, noise-injected variants, and feature-trimmed variants. Each row in the grid should keep the target, split policy, evaluation metric, and tuning budget explicit.`,
        `The output is a basis ledger. For each run, store dataset version, split, transform, leakage guard, model family, hyperparameter budget, aggregate metric, slice metrics, calibration, training cost, inference cost, and feature availability at serving time. The ledger explains the result instead of leaving only a leaderboard.`,
      ],
    },
    {
      heading: `Animation Notes`,
      paragraphs: [
        `The axis-splits view shows raw columns flowing into rotations, ratios, noise, trees, neural models, and score slices. The important contrast is between a domain-aligned feature that gives a tree a clean threshold and a rotated basis that spreads the same information across coordinates.`,
        `The threshold plot separates a step-like rule from a smooth fit. The rotated-basis plot shows why a once-simple rule can become jagged for a tree after mixing coordinates. The diagnostic protocol view treats each preprocessing choice as a benchmark arm rather than a harmless setup detail.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The diagnostic works because it converts vague model arguments into controlled comparisons. If the tree wins on raw columns but loses after rotation, the tree was using axis alignment. If the neural model improves mainly after scaling and embeddings, the original neural baseline was underprepared. If both models fail on a time-safe split, the problem may be data drift rather than architecture.`,
        `It also catches fake improvements. A ratio feature may look brilliant because it leaks the future. A target encoding may work because validation rows influenced the encoding table. A neural model may win by a small amount after ten times the tuning budget and three times the inference cost. The ledger forces those facts into the decision.`,
        `Most importantly, it changes the conversation from "which model is best?" to "which representation and model pair is reliable for this task?" That is the question production systems actually need answered.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Suppose a credit-risk table contains utilization, income, account age, missed payments, region, device type, bureau fields, and several weak vendor features. A boosted tree finds a strong split near utilization > 0.40 and another split on recent missed payments. It mostly ignores the weak vendor columns.`,
        `Now rotate the numeric features. The utilization threshold is no longer aligned with one coordinate, so the tree needs several splits to approximate the same rule. Add a leakage-safe debt-to-income ratio and the tree recovers because the useful domain axis is restored. The raw basis and ratio basis made the tree efficient; the rotated basis made it work harder.`,
        `A neural model tells a different story. It improves after scaling, stable categorical embeddings, and stronger regularization. It degrades when many weak vendor columns are added. On aggregate score it may be close to the tree, but on high-utilization thin-file borrowers it may be worse calibrated. The useful conclusion is not "always use trees" or "always use neural nets." The useful conclusion is which representation each family needs and which slices remain risky.`,
      ],
    },
    {
      heading: `Evaluation Discipline`,
      paragraphs: [
        `Fairness starts with comparable budgets. A default gradient-boosted tree against a heavily tuned neural network says little. A default neural network against a carefully engineered GBDT pipeline says little. Set a search budget, document it, and avoid changing preprocessing and model search at the same time unless the whole bundle is what you intend to compare.`,
        `Use multiple views of quality. Average accuracy, AUC, or loss can hide calibration problems, rare-category failures, temporal drift, and high-value customer slices. Tabular systems often make business decisions, so slice metrics and calibration can matter more than a small aggregate win.`,
        `Keep serving constraints in the evaluation. A feature that exists in training but arrives late in production is not a real online feature. A target encoding that cannot be updated safely is operational debt. A neural model that needs heavy preprocessing and GPU serving may not beat a simpler tree once latency and cost are included.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Build the diagnostic as a reproducible experiment table, not as a notebook memory. Each run should have a stable id, data version, transform code, split seed or time window, model settings, metric output, and artifact path. If a model wins, future engineers should be able to rerun the reason it won.`,
        `Guard leakage at every transform. Ratios are usually safe when they use only contemporaneous inputs. Target encodings, aggregations, rolling features, and customer histories need stricter rules. Compute them inside the training fold or with time-aware windows so validation and future information do not leak backward.`,
        `Use ablations. Add ratios without rotation. Rotate without ratios. Add noise without feature trimming. Drop weak columns without changing the model. These small comparisons reveal whether the win came from the basis, the model family, the tuning budget, or an accidental leak.`,
        `Record feature availability. A strong offline feature can still fail at serving time if it is late, expensive, or inconsistent. The basis ledger should say which features are online-safe, batch-only, customer-specific, shared, derived from labels, or subject to privacy constraints.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `This diagnostic is most useful in credit, insurance, healthcare, fraud, pricing, churn, ranking, supply chain, advertising, and operations data. These domains have meaningful columns, nonlinear thresholds, categorical effects, and business slices where average metrics can mislead.`,
        `It is also useful when a team is deciding between gradient-boosted trees, random forests, logistic regression, generalized linear models, MLP-style tabular nets, transformer-style tabular models, and hybrid systems that combine feature stores with learned embeddings.`,
        `The method gives teams a practical language for model choice. Instead of saying one family is generally better, the team can say raw axes matter, ratio features help, rotation hurts tree efficiency, neural models need scaling and feature selection, and serving requires these exact transforms.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `The diagnostic fails when the split is wrong. If validation randomly mixes future and past in a time-dependent problem, every representation may look better than it is. Time leakage can overpower the basis lesson.`,
        `It fails when the comparison is underpowered. Small datasets, unstable labels, and high metric variance can make representation effects look like noise. Use repeated splits or confidence intervals when the decision is expensive.`,
        `It fails when teams read it as a universal law. A result on one dataset does not prove that trees always win or neural networks always lose. It proves how model family, basis, tuning, and data quality interacted on that task under that evaluation protocol.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Tabular Deep Learning vs GBDT Case Study, Gradient Boosting, Random Forest, Logistic Regression, PCA, SVD, Feature Hashing Signed Projection Primer, Data Leakage, Cross Validation, Calibration Curves, Benchmark Variance Model Selection, and Feature Store.`,
        `For research context, read work comparing tree-based models and deep learning on tabular data, especially studies that examine dataset size, irrelevant features, rotations, categorical handling, and hyperparameter budgets. Use those papers as prompts for better diagnostics, not as substitutes for measuring your own table.`,
      ],
    },
  ],
};
