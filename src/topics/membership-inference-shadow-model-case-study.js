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
    explanation: 'Read the pipeline left to right. The attacker already has a candidate record and a target API; the private question is whether this exact record helped train the model, not whether the prediction is correct.',
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
    explanation: 'Shadow models create the labels the attacker lacks for the real target. Because the attacker knows which shadow records were in or out, each shadow output becomes training data for the attack classifier.',
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
    explanation: 'The curves show the release trap. Validation accuracy has mostly flattened, but training accuracy and attack AUC keep rising. Early stopping can be a privacy control, not only a regularization trick.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The shadow-attack view asks whether one candidate record was in a model training set. A member is a record used during training; a non-member is a similar record held out. Active nodes are model queries and feature extraction steps; found nodes are signals the attack can use.',
        {type:'callout', text:'Membership inference treats model confidence as behavioral evidence of training participation, so privacy must be audited as a release property.'},
        'The leakage-audit view compares model quality against privacy risk. Confidence means how strongly the model scores its predicted class. The safe inference is that high accuracy does not prove low leakage; a model can predict well and still reveal which records it saw.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Membership inference exists because participation can be private. If a model was trained on hospital visits, legal disputes, school discipline records, or private documents, proving that one person appears in the training set can reveal sensitive facts. The attacker does not need to reconstruct the record.',
        'A trained model can leak through behavior. It may assign lower loss, higher confidence, or sharper probability gaps to examples it memorized. The privacy question becomes a release question: does the deployed model carry evidence of its training set into the API?'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious privacy story is that hiding the raw data is enough. The API returns a class label or probabilities, not the training set. That story feels reasonable because no row is printed back to the caller.',
        'A second obvious defense is to look only at validation accuracy. If validation accuracy is good, the model seems to generalize. But validation accuracy can stay flat while train confidence keeps rising and membership leakage increases.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is overfitting. Overfitting means the model learned details that help on training records more than on new records. Those details can create a behavioral gap between members and non-members.',
        'The attacker usually does not know target membership labels, so it cannot directly train on the target model. It needs a substitute world where membership is known. Shadow models provide that substitute by imitating the training setup on related data.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat model outputs as evidence. The attack converts a prediction into features such as loss, top probability, entropy, and margin between the top two classes. These features are not the private record, but they can reveal familiarity.',
        'A shadow model is a model trained by the attacker on data from a similar distribution. The attacker knows which shadow records were in training and which were held out. That creates labeled examples for a separate attack classifier: output pattern in, member or non-member out.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The attacker gathers public, purchased, synthetic, or otherwise similar data. It trains several shadow models, each with a known train split and holdout split. It queries those models on both splits and records their output features.',
        'The attack classifier learns the member fingerprint from the shadow outputs. Low loss and high confidence may point toward member; flatter confidence may point toward non-member. The trained attack is then applied to target-model outputs for candidate records.',
        'A defender can run the same process as an audit. The release team trains shadow models or uses known train and holdout data, measures attack AUC and precision at deployment thresholds, and compares risk across model versions and data slices.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is statistical, not absolute. If training makes member outputs systematically different from non-member outputs, a classifier can learn that difference. The attack is valid when evaluation uses separate records and reports how well the learned boundary transfers to the target setting.',
        'Shadow models work when they approximate the target training distribution closely enough. They do not need to be identical to the target model; they need to expose a similar member-versus-non-member gap. When the gap disappears, the attack loses signal.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Attack cost grows with shadow training. Ten shadow models at 2 GPU-hours each cost 20 GPU-hours before the target is queried. Rich probability vectors reduce query count because each response carries more signal than a class label.',
        'Defense cost is also behavioral. Early stopping may lower leakage but reduce accuracy. Rounding probabilities may protect users but hurt legitimate calibration workflows. Differential privacy can bound individual influence, but it usually spends accuracy, compute, or tuning budget.',
        'Base rates matter. If only 1 percent of a population are members, an attack with impressive AUC can still produce many false accusations at a loose threshold. A release audit should report precision and recall at the threshold a real attacker would use.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Membership-inference audits belong in medical models, education systems, financial risk models, enterprise copilots, biometric systems, location models, and language models trained on private corpora. The common condition is that the training population itself is sensitive.',
        'The same thinking helps with data governance. Deduplication, grouped train-test splits, rare-slice reporting, confidence-output policy, and differential privacy accounting all become release artifacts. Privacy is measured beside utility instead of assumed from access control.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The attack fails when shadow data is poor, target outputs are too coarse, query access is limited, or the model genuinely treats members and non-members similarly. A failed attack is not a proof of safety. It may only show that this attack was weak.',
        'Audits fail when they report only aggregate accuracy. Rare slices, duplicates, and outliers can leak first. A model can pass a global privacy check while exposing a small group that the average hides.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a classifier has 10,000 known training records and 10,000 holdout records for audit. On members, average true-label loss is 0.18. On non-members, it is 0.42. A threshold of 0.25 flags 6,000 members and 1,500 non-members.',
        'Recall is 6,000 divided by 10,000, or 60 percent. Precision under the balanced audit set is 6,000 divided by 7,500, or 80 percent. The attack is learning a real behavior gap, not guessing labels.',
        'Now apply the same threshold in a population where only 1 percent are true members. Out of 1,000,000 candidates, there are 10,000 members and 990,000 non-members. The same 60 percent recall finds 6,000 members, but a 15 percent false positive rate flags 148,500 non-members. Precision falls to about 3.9 percent, which is why deployment reports must include base rates.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Shokri, Stronati, Song, and Shmatikov, Membership Inference Attacks Against Machine Learning Models, https://arxiv.org/abs/1610.05820. Study differential privacy SGD, calibration, ROC and AUC, precision and recall, data leakage, model inversion, and training-data extraction next.'
      ],
    },
  ],
};
