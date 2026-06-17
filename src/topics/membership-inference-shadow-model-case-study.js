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
      heading: 'Why This Topic Exists',
      paragraphs: [
        'Membership inference asks a narrow question with serious privacy consequences: was this exact record in the training set of this model? The attacker does not need to steal the record, recover a label, or invert the model into a readable sample. Participation can be the secret. If the model was trained on hospital discharges, fraud investigations, genetic tests, therapy chats, or disciplinary records, proving that one person appears in the training data can reveal something sensitive even when every individual prediction looks ordinary.',
        'This topic exists because machine learning privacy is not only about encrypting datasets at rest. A trained model can become a side channel. The classic black-box result by Shokri, Stronati, Song, and Shmatikov showed that confidence vectors can leak train-versus-holdout fingerprints, especially when a model overfits and exposes rich probabilities. The case study here treats membership inference as both an attack and a release audit: if an outside party can learn participation from model behavior, the model is carrying private evidence out through its API.',
      ],
    },
    {
      heading: 'The Naive Privacy Story',
      paragraphs: [
        'The naive story says that privacy is safe because the model only returns predictions. In that story, the training set is hidden, the API does not display records, and the user sees only a label or a probability vector. That story fails because prediction behavior is evidence. A model may be unusually certain on records it saw during training. It may assign a lower loss to those records than to similar records it did not see. It may expose a large gap between the top class and the runner-up class. None of those signals is the raw record, but together they can become an in-or-out classifier.',
        'The second naive defense is to say that a single score is too weak to matter. It often is weak by itself. The problem is aggregation. An attacker can collect many examples from the same distribution, query repeatedly, compare losses, and learn thresholds. A release team can make the same mistake in reverse by reporting only global validation accuracy. Validation accuracy can be flat while train accuracy and attack success keep rising. Privacy risk can increase after product quality has stopped improving.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'Membership inference works when training leaves a behavioral fingerprint. Generalization means the model has learned a pattern that applies to unseen examples. Memorization means some records receive record-specific familiarity. The attack tries to detect that difference. It does not ask whether the prediction is correct. It asks whether the model behaves as if the candidate was part of the optimization history.',
        'Shadow models make that insight operational. The attacker lacks labels for the target model because they do not know which target examples were in training. So the attacker builds a miniature training world where membership is known. Data from a similar distribution is split into shadow train and shadow holdout sets. Shadow models are trained, queried, and their outputs are labeled as member or non-member. An attack classifier then learns the fingerprint and applies it to the target model.',
      ],
    },
    {
      heading: 'How The Attack Works',
      paragraphs: [
        'A black-box attack begins with a candidate record and query access to the target. The attacker sends the candidate through the target and collects whatever the API returns: a predicted class, a top probability, a full vector, or log probabilities. The richer the output, the easier the attack usually becomes. From that output the attacker derives features such as loss under the true label, entropy, top-class probability, probability margin, calibration residual, rank of the correct class, and sometimes changes under small perturbations.',
        'The shadow-model phase creates labeled training data for the attack. Suppose the attacker has public or synthetic data from the same source distribution. They train several shadow models, each with known train and holdout records. Every shadow output is converted into the same feature vector used for the target. The attack classifier learns that low loss plus high confidence may mean member, while higher loss and flatter confidence may mean non-member. The final target decision is just a classifier score over those features, interpreted with base rates and thresholds.',
      ],
    },
    {
      heading: 'What The Visual Is Proving',
      paragraphs: [
        'The first visual proves that the private question is separate from the prediction task. The candidate record enters the target, the target returns scores, and those scores become attack features. The attack classifier is not checking whether the model guessed the correct label. It is checking whether the score pattern resembles known training examples. That distinction is why a model can be accurate and still leak membership.',
        'The audit visual proves that privacy risk can be measured as a release property. If validation accuracy has flattened but train accuracy and attack AUC continue rising, extra training may be buying memorization instead of useful quality. The gate view turns privacy from a vague concern into a packet of evidence: shadow attack results, canary exposure, differential privacy accounting, rare-slice risk, output policy, and a documented decision.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The attack is strongest when the train distribution and the non-member distribution are not treated equally by the model. Overfitting creates a train-test loss gap. Duplicates and near-duplicates make some records appear easier than they should. Rare slices create examples that the model can memorize because there are not many similar cases to generalize from. Overconfident calibration turns small differences in familiarity into large differences in probability.',
        'The method also works because modern APIs often expose more information than the caller needs. A full probability vector is a detailed behavioral signature. Even a top probability can carry signal. If the attacker knows the true label, loss is especially useful. If the attacker does not know the true label, entropy and margin can still reveal unusual confidence. The shadow classifier collects weak clues and turns them into a ranking of membership likelihood.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The attack cost is compute, representative data, and careful evaluation. Training many shadow models can be expensive. If the shadow data does not match the target distribution, the learned boundary can fail. Attack reporting also needs base-rate discipline. A high AUC says the attack ranks members above non-members; it does not by itself say how many positive claims are true at a deployment threshold. Precision, recall, population prevalence, and the harm of false accusation all matter.',
        'The defense cost is not free either. Early stopping may reduce memorization but leave some utility on the table. Rounding or hiding probabilities can reduce API value for legitimate users. Deduplication and grouped splits require data engineering. Differential privacy gives a formal limit on individual influence, but it usually trades off with quality, training stability, and compute. A useful audit table records these costs beside the measured risk rather than pretending privacy is a single switch.',
      ],
    },
    {
      heading: 'Real Uses And Release Gates',
      paragraphs: [
        'Membership inference audits are used anywhere participation is sensitive: medical models, education platforms, financial risk systems, enterprise copilots, location datasets, biometric systems, and language models trained on private documents. A hospital readmission classifier is a simple example. The red team trains shadow models on related clinical data, finds that low loss and wide margins identify rare diagnosis records, and reports high attack AUC on that slice. The team responds with patient-level grouping, episode deduplication, earlier stopping, probability caps for low-trust callers, and a differential privacy experiment for the most sensitive deployment.',
        'The operational lesson is that membership inference belongs in the release process. Store train-test gaps, shadow attack metrics, canary exposure, rare-slice results, output precision rules, dedupe status, and privacy budget. Compare model versions on both utility and leakage. This connects directly to Data Leakage & Contamination: leakage asks whether evaluation saw information it should not have; membership inference asks whether the trained model reveals who it saw.',
      ],
    },
    {
      heading: 'Failure Modes And Limits',
      paragraphs: [
        'Do not report only attack accuracy. Accuracy can be misleading under rare base rates. Do not tune defenses only on global averages, because rare or duplicated slices may leak first. Do not assume that hiding the full vector removes the risk; top confidence, entropy, rank, and repeated queries may still carry signal. Do not assume federated learning solves the problem automatically; client updates can leak unless secure aggregation, differential privacy, and robust evaluation are part of the system.',
        'A failed attack is also hard to interpret. It may mean the model is genuinely robust, or it may mean the attacker used weak shadow data, poor thresholds, too few queries, or the wrong metric. A privacy audit should therefore test multiple attack families, include slice-level reporting, and document residual uncertainty. The goal is not to prove that no attack exists. The goal is to reduce known leakage paths and make the remaining risk explicit.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Differential Privacy SGD for a formal training-time defense, then Federated Learning & Secure Aggregation for distributed settings where updates themselves may leak. Study Calibration & Reliability Diagrams because overconfidence is a common attack signal. Study ROC Curves & AUC, Precision/Recall, and Threshold Optimization so attack reports do not collapse into one misleading number. Then study Influence Functions, Model Inversion Confidence Attack, Data Leakage & Contamination, and LLM Training Data Extraction to see how privacy risk appears across the full model lifecycle.',
      ],
    },
  ],
};
