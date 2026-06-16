// Membership inference: infer whether one candidate record was part of a
// model's training set by measuring the model's confidence, loss, and
// overfitting fingerprints.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'membership-inference-shadow-model-case-study',
  title: 'Membership Inference Shadow Model Case Study',
  category: 'AI & ML',
  summary: 'A privacy attack primer: train shadow models, learn train-vs-holdout confidence fingerprints, and audit leakage before release.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shadow attack', 'leakage audit'], defaultValue: 'shadow attack' },
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

function attackGraph(title) {
  return graphState({
    nodes: [
      { id: 'candidate', label: 'record x', x: 0.8, y: 3.5, note: 'unknown' },
      { id: 'target', label: 'target', x: 2.7, y: 3.5, note: 'API' },
      { id: 'scores', label: 'scores', x: 4.5, y: 2.0, note: 'prob vec' },
      { id: 'features', label: 'features', x: 4.5, y: 5.0, note: 'loss gap' },
      { id: 'attack', label: 'attack', x: 6.5, y: 3.5, note: 'in/out' },
      { id: 'decision', label: 'decision', x: 8.5, y: 3.5, note: 'member?' },
    ],
    edges: [
      { id: 'e-record-target', from: 'candidate', to: 'target' },
      { id: 'e-target-scores', from: 'target', to: 'scores' },
      { id: 'e-scores-features', from: 'scores', to: 'features' },
      { id: 'e-features-attack', from: 'features', to: 'attack' },
      { id: 'e-attack-decision', from: 'attack', to: 'decision' },
    ],
  }, { title });
}

function shadowGraph(title) {
  return graphState({
    nodes: [
      { id: 'sameDist', label: 'same dist', x: 0.9, y: 3.5, note: 'public/synth' },
      { id: 'split', label: 'split', x: 2.4, y: 3.5, note: 'in/out' },
      { id: 'shadowA', label: 'shadow A', x: 4.0, y: 2.0, note: 'train' },
      { id: 'shadowB', label: 'shadow B', x: 4.0, y: 5.0, note: 'train' },
      { id: 'traces', label: 'outputs', x: 5.8, y: 3.5, note: 'labeled' },
      { id: 'attack', label: 'attack clf', x: 7.6, y: 3.5, note: 'learns' },
      { id: 'target', label: 'target', x: 9.0, y: 3.5, note: 'query' },
    ],
    edges: [
      { id: 'e-dist-split', from: 'sameDist', to: 'split' },
      { id: 'e-split-a', from: 'split', to: 'shadowA' },
      { id: 'e-split-b', from: 'split', to: 'shadowB' },
      { id: 'e-a-traces', from: 'shadowA', to: 'traces' },
      { id: 'e-b-traces', from: 'shadowB', to: 'traces' },
      { id: 'e-traces-attack', from: 'traces', to: 'attack' },
      { id: 'e-attack-target', from: 'attack', to: 'target' },
    ],
  }, { title });
}

function* shadowAttack() {
  yield {
    state: attackGraph('Black-box membership inference asks one question'),
    highlight: { active: ['candidate', 'target', 'scores', 'e-record-target', 'e-target-scores'], compare: ['decision'] },
    explanation: 'The attacker starts with a candidate record and query access to a trained model. The private question is not the label; it is whether this exact record helped train the model.',
    invariant: 'The attack target is participation in training, not only a wrong prediction.',
  };

  yield {
    state: labelMatrix(
      'Train records often look too easy',
      [
        { id: 'r1', label: 'train A' },
        { id: 'r2', label: 'train B' },
        { id: 'h1', label: 'holdout A' },
        { id: 'h2', label: 'holdout B' },
      ],
      [
        { id: 'top', label: 'top prob' },
        { id: 'loss', label: 'loss' },
        { id: 'gap', label: 'top gap' },
      ],
      [
        ['0.98', '0.02', '0.91'],
        ['0.94', '0.06', '0.82'],
        ['0.67', '0.40', '0.29'],
        ['0.59', '0.53', '0.13'],
      ],
    ),
    highlight: { active: ['r1:top', 'r2:top'], compare: ['h1:top', 'h2:top'], found: ['r1:loss', 'r2:loss'] },
    explanation: 'Overfit models tend to be more confident and lower-loss on training records than on holdout records. A single score is weak evidence, but a pattern over many records can become a privacy attack.',
  };

  yield {
    state: shadowGraph('Shadow models manufacture labeled attack data'),
    highlight: { active: ['sameDist', 'split', 'shadowA', 'shadowB', 'traces', 'attack'], found: ['target'] },
    explanation: 'Shokri-style shadow attacks train models on data drawn from a similar distribution. Because the attacker knows which shadow records were in or out, each shadow model output becomes labeled attack training data.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'candidate loss', min: 0, max: 1.2 }, y: { label: 'attack score', min: 0, max: 1 } },
      series: [
        { id: 'members', label: 'known in', points: [{ x: 0.04, y: 0.95 }, { x: 0.08, y: 0.91 }, { x: 0.14, y: 0.86 }, { x: 0.20, y: 0.78 }] },
        { id: 'nonmembers', label: 'known out', points: [{ x: 0.46, y: 0.35 }, { x: 0.58, y: 0.26 }, { x: 0.72, y: 0.18 }, { x: 0.96, y: 0.08 }] },
      ],
      markers: [
        { id: 'x', x: 0.11, y: 0.88, label: 'x' },
        { id: 'cut', x: 0.30, y: 0.55, label: 'risk cut' },
      ],
    }),
    highlight: { active: ['members', 'nonmembers'], found: ['x'], compare: ['cut'] },
    explanation: 'The attack classifier turns model behavior into a membership score. Low loss, high confidence, low entropy, and a large top-class gap often move the point toward member.',
  };

  yield {
    state: labelMatrix(
      'Attack reports need base rates',
      [
        { id: 'prec', label: 'precision' },
        { id: 'recall', label: 'recall' },
        { id: 'auc', label: 'attack AUC' },
        { id: 'base', label: 'base rate' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'trap', label: 'trap' },
      ],
      [
        ['claims true?', 'rare base rate'],
        ['members found?', 'miss risk'],
        ['ranking skill', 'not one cutoff'],
        ['prior odds', 'changes impact'],
      ],
    ),
    highlight: { active: ['prec:meaning', 'recall:meaning', 'auc:meaning'], compare: ['base:trap'] },
    explanation: 'Membership inference is evaluated like a classifier. Precision, recall, ROC-AUC, and the population base rate all matter. A high attack score can be alarming in a clinic dataset and less meaningful in a huge public corpus.',
  };
}

function* leakageAudit() {
  yield {
    state: labelMatrix(
      'Leakage fingerprints before release',
      [
        { id: 'gap', label: 'train gap' },
        { id: 'conf', label: 'confidence' },
        { id: 'cal', label: 'calibration' },
        { id: 'rare', label: 'rare slice' },
        { id: 'dupes', label: 'duplicates' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['train gap', 'shadow attack'],
        ['sharp probs', 'entropy check'],
        ['overconfident', 'reliability'],
        ['small groups', 'slice attack'],
        ['near twins', 'dedupe first'],
      ],
    ),
    highlight: { active: ['gap:audit', 'conf:audit', 'dupes:audit'], compare: ['rare:symptom'] },
    explanation: 'A release audit looks for the conditions that make membership attacks work: overfitting, overconfident outputs, rare examples, duplicated records, and weak train/test separation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch', min: 0, max: 10 }, y: { label: 'score', min: 0, max: 1 } },
      series: [
        { id: 'test', label: 'test acc', points: [{ x: 1, y: 0.62 }, { x: 3, y: 0.72 }, { x: 5, y: 0.77 }, { x: 7, y: 0.78 }, { x: 9, y: 0.78 }] },
        { id: 'train', label: 'train acc', points: [{ x: 1, y: 0.66 }, { x: 3, y: 0.82 }, { x: 5, y: 0.92 }, { x: 7, y: 0.97 }, { x: 9, y: 0.99 }] },
        { id: 'attack', label: 'attack AUC', points: [{ x: 1, y: 0.52 }, { x: 3, y: 0.58 }, { x: 5, y: 0.66 }, { x: 7, y: 0.74 }, { x: 9, y: 0.81 }] },
      ],
      markers: [{ id: 'stop', x: 5, y: 0.77, label: 'stop' }],
    }),
    highlight: { active: ['train', 'test', 'attack'], found: ['stop'] },
    explanation: 'Attack success often rises as the model keeps memorizing after validation quality has plateaued. Early stopping is not just a quality tool; it can be a privacy control.',
  };

  yield {
    state: labelMatrix(
      'Mitigations by attack lever',
      [
        { id: 'overfit', label: 'overfit' },
        { id: 'outputs', label: 'outputs' },
        { id: 'records', label: 'records' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['reg + stop', 'may lower fit'],
        ['cap probs', 'less API value'],
        ['group split', 'data work'],
        ['DP accountant', 'utility cost'],
      ],
    ),
    highlight: { found: ['overfit:control', 'outputs:control', 'budget:control'], compare: ['budget:cost'] },
    explanation: 'Defenses attack different links in the chain. Regularization reduces memorization. Output limits reduce attack signal. Data hygiene removes easy twins. Differential privacy limits individual influence.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'model', label: 'model', x: 0.8, y: 3.5, note: 'candidate' },
        { id: 'shadow', label: 'shadow', x: 2.6, y: 2.0, note: 'attack' },
        { id: 'canary', label: 'canary', x: 2.6, y: 5.0, note: 'known' },
        { id: 'dp', label: 'DP acct', x: 4.4, y: 2.0, note: 'epsilon' },
        { id: 'slices', label: 'slices', x: 4.4, y: 5.0, note: 'rare' },
        { id: 'gate', label: 'gate', x: 6.4, y: 3.5, note: 'release' },
        { id: 'report', label: 'report', x: 8.2, y: 3.5, note: 'evidence' },
      ],
      edges: [
        { id: 'e-model-shadow', from: 'model', to: 'shadow' },
        { id: 'e-model-canary', from: 'model', to: 'canary' },
        { id: 'e-shadow-gate', from: 'shadow', to: 'gate' },
        { id: 'e-canary-gate', from: 'canary', to: 'gate' },
        { id: 'e-dp-gate', from: 'dp', to: 'gate' },
        { id: 'e-slices-gate', from: 'slices', to: 'gate' },
        { id: 'e-gate-report', from: 'gate', to: 'report' },
      ],
    }, { title: 'A privacy release gate is an evaluation pipeline' }),
    highlight: { active: ['shadow', 'canary', 'dp', 'slices', 'gate'], found: ['report'] },
    explanation: 'A serious deployment treats membership inference as a release test. The gate stores shadow-attack results, canary exposure, DP budget, slice risk, and the decision rationale.',
  };

  yield {
    state: labelMatrix(
      'Hospital model case study',
      [
        { id: 'risk', label: 'risk' },
        { id: 'audit', label: 'audit' },
        { id: 'fix', label: 'fix' },
        { id: 'ship', label: 'ship gate' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['in train?', 'sensitive fact'],
        ['AUC high?', 'measure it'],
        ['reduce signal', 'DP + cap'],
        ['residual risk?', 'documented'],
      ],
    ),
    highlight: { active: ['risk:answer', 'audit:answer'], found: ['fix:answer', 'ship:answer'] },
    explanation: 'In a hospital discharge model, membership can itself reveal a sensitive condition. The case study is not abstract: a model API can become a training-set participation oracle unless the release process measures and reduces leakage.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shadow attack') yield* shadowAttack();
  else if (view === 'leakage audit') yield* leakageAudit();
  else throw new InputError('Pick a membership-inference view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Membership inference asks whether a specific record was part of a model training set. The attacker does not need to recover the record. In sensitive domains, participation alone can reveal private information: being in a hospital-discharge training set, a fraud-investigation set, or a therapy-chat corpus can be the secret.',
        'The classic black-box attack is from Shokri, Stronati, Song, and Shmatikov, Membership Inference Attacks against Machine Learning Models: https://arxiv.org/abs/1610.05820. It showed that model outputs can leak train-vs-holdout fingerprints, especially when models overfit and expose rich confidence vectors.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The attack queries the target model with a candidate record and converts the prediction vector into features: top probability, entropy, loss under the true label, class margin, and sometimes calibration residuals. Training examples often look easier to the model than non-members. A shadow attack trains separate models on data from a similar distribution, labels their outputs as in or out, and trains an attack classifier on those labeled outputs.',
        'The important data structure is a leakage audit table. For each candidate model version, store train/test loss gaps, attack AUC, attack precision at high-risk thresholds, rare-slice results, output precision policy, dedupe status, and DP accounting. That table lets the release gate compare privacy risk against model utility instead of relying on vibes.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A hospital trains a readmission classifier on discharge records. The model API returns a full probability vector for each input. A red team trains shadow models on a similar public clinical dataset, collects outputs for known in/out records, and learns that very low loss plus a wide top-class margin predicts membership. The attack AUC is high for rare diagnosis slices. The team responds by deduplicating patient episodes, using grouped splits, stopping earlier, rounding outputs for low-trust callers, and testing a DP-SGD variant for the most sensitive deployment.',
        'This connects directly to Data Leakage & Contamination. Leakage asks whether the evaluation saw information it should not have. Membership inference asks whether the trained model leaks information about who it saw. Both require split discipline, provenance, and explicit release evidence.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not report only attack accuracy. Base rates, precision, recall, ROC-AUC, and threshold choice all matter. Do not assume that hiding labels hides membership; confidence, entropy, and loss can still leak. Do not assume federated learning is enough; client updates can leak too unless secure aggregation, differential privacy, and robust evaluation are added. Do not tune defenses only on global averages because rare slices can leak first.',
        'Study Differential Privacy SGD, Federated Learning & Secure Aggregation, Data Leakage & Contamination, Calibration & Reliability Diagrams, ROC Curves & AUC, Precision/Recall, Threshold Optimization, Influence Functions, Model Inversion Confidence Attack, and LLM Training Data Extraction next.',
      ],
    },
  ],
};
