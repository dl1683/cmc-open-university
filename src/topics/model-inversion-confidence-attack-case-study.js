// Model inversion: optimize unknown attributes or prototypes against a model's
// exposed confidence signal, then reduce the signal surface before release.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'model-inversion-confidence-attack-case-study',
  title: 'Model Inversion Confidence Attack Case Study',
  category: 'AI & ML',
  summary: 'Recover sensitive attributes or class prototypes from model confidence outputs, then map the API controls that reduce inversion risk.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['confidence inversion', 'defense surface'], defaultValue: 'confidence inversion' },
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

function inversionGraph(title) {
  return graphState({
    nodes: [
      { id: 'known', label: 'known x', x: 0.7, y: 3.5, note: 'partial' },
      { id: 'unknown', label: 'unknown', x: 2.2, y: 5.2, note: 'search' },
      { id: 'query', label: 'query', x: 3.7, y: 3.5, note: 'candidate' },
      { id: 'model', label: 'model', x: 5.2, y: 3.5, note: 'API' },
      { id: 'score', label: 'score', x: 6.8, y: 2.0, note: 'conf' },
      { id: 'opt', label: 'optimizer', x: 6.8, y: 5.2, note: 'update' },
      { id: 'recon', label: 'recon', x: 8.8, y: 3.5, note: 'guess' },
    ],
    edges: [
      { id: 'e-known-query', from: 'known', to: 'query' },
      { id: 'e-unknown-query', from: 'unknown', to: 'query' },
      { id: 'e-query-model', from: 'query', to: 'model' },
      { id: 'e-model-score', from: 'model', to: 'score' },
      { id: 'e-score-opt', from: 'score', to: 'opt' },
      { id: 'e-opt-unknown', from: 'opt', to: 'unknown' },
      { id: 'e-opt-recon', from: 'opt', to: 'recon' },
    ],
  }, { title });
}

function* confidenceInversion() {
  yield {
    state: inversionGraph('Confidence turns the API into an objective'),
    highlight: { active: ['known', 'unknown', 'query', 'model', 'score', 'e-query-model', 'e-model-score'], compare: ['recon'] },
    explanation: 'Read the loop as optimization through an API. Known fields stay fixed, unknown sensitive fields are varied, the model returns a confidence signal, and the optimizer moves toward guesses that score higher.',
    invariant: 'The model is not revealing rows directly; it is revealing a search direction.',
  };

  yield {
    state: labelMatrix(
      'Confidence leaks more than a label',
      [
        { id: 'label', label: 'hard label' },
        { id: 'round', label: 'rounded prob' },
        { id: 'full', label: 'full probs' },
        { id: 'embed', label: 'embedding' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['one bit', 'lower'],
        ['coarse slope', 'medium'],
        ['fine slope', 'higher'],
        ['rich geometry', 'highest'],
      ],
    ),
    highlight: { active: ['full:signal', 'embed:signal'], compare: ['label:risk', 'round:risk'] },
    explanation: 'The table is the output-surface ladder. A hard label gives little slope. Rounded probabilities give some signal. Full probabilities and embeddings expose geometry an attacker can search.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'query round', min: 0, max: 6 }, y: { label: 'target confidence', min: 0, max: 1 } },
      series: [
        { id: 'search', label: 'search path', points: [{ x: 0, y: 0.19 }, { x: 1, y: 0.31 }, { x: 2, y: 0.48 }, { x: 3, y: 0.63 }, { x: 4, y: 0.76 }, { x: 5, y: 0.82 }, { x: 6, y: 0.84 }] },
      ],
      markers: [
        { id: 'start', x: 0, y: 0.19, label: 'start' },
        { id: 'best', x: 6, y: 0.84, label: 'best' },
      ],
    }),
    highlight: { active: ['search'], found: ['best'], compare: ['start'] },
    explanation: 'Each query asks whether the candidate got warmer. Gradient-free search, hill climbing, or learned priors can all use that feedback when the API exposes enough precision and allows repeated probes.',
  };

  yield {
    state: labelMatrix(
      'Inversion target shapes',
      [
        { id: 'attr', label: 'attribute' },
        { id: 'face', label: 'prototype' },
        { id: 'text', label: 'phrase' },
        { id: 'cluster', label: 'cluster' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'prior', label: 'prior' },
      ],
      [
        ['infer field', 'tabular stats'],
        ['class image', 'image prior'],
        ['recover phrase', 'LM prior'],
        ['infer cohort', 'embedding map'],
      ],
    ),
    highlight: { found: ['attr:goal', 'face:goal', 'text:goal'], compare: ['face:prior'] },
    explanation: 'The recovered object depends on the model and prior. A tabular model may reveal a sensitive attribute. A face recognizer may reveal a class prototype. A language model can reveal memorized text through a related extraction loop.',
  };

  yield {
    state: labelMatrix(
      'Case study decision record',
      [
        { id: 'api', label: 'API' },
        { id: 'attack', label: 'attack' },
        { id: 'impact', label: 'impact' },
        { id: 'release', label: 'release' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['full conf', 'too much'],
        ['field found', 'confirmed'],
        ['sensitive attr', 'high risk'],
        ['cap outputs', 'gate ship'],
      ],
    ),
    highlight: { active: ['api:evidence', 'attack:evidence'], removed: ['api:decision'], found: ['release:decision'] },
    explanation: 'A release gate should store the inversion evidence. If confidence precision makes a sensitive field recoverable, the API contract must change before release.',
  };
}

function* defenseSurface() {
  yield {
    state: graphState({
      nodes: [
        { id: 'model', label: 'model', x: 0.8, y: 3.5, note: 'trained' },
        { id: 'policy', label: 'policy', x: 2.5, y: 3.5, note: 'who sees' },
        { id: 'round', label: 'round', x: 4.2, y: 1.8, note: 'precision' },
        { id: 'rate', label: 'rate', x: 4.2, y: 5.2, note: 'queries' },
        { id: 'audit', label: 'audit', x: 6.0, y: 3.5, note: 'patterns' },
        { id: 'dp', label: 'DP', x: 7.5, y: 1.8, note: 'train' },
        { id: 'gate', label: 'gate', x: 8.8, y: 3.5, note: 'release' },
      ],
      edges: [
        { id: 'e-model-policy', from: 'model', to: 'policy' },
        { id: 'e-policy-round', from: 'policy', to: 'round' },
        { id: 'e-policy-rate', from: 'policy', to: 'rate' },
        { id: 'e-round-audit', from: 'round', to: 'audit' },
        { id: 'e-rate-audit', from: 'rate', to: 'audit' },
        { id: 'e-dp-gate', from: 'dp', to: 'gate' },
        { id: 'e-audit-gate', from: 'audit', to: 'gate' },
      ],
    }, { title: 'Reduce output signal and query leverage' }),
    highlight: { active: ['policy', 'round', 'rate', 'audit'], found: ['gate'], compare: ['dp'] },
    explanation: 'Inversion defense is a surface-area problem. Limit who can query, how precise outputs are, how fast search can proceed, and how much one record can influence the model.',
  };

  yield {
    state: labelMatrix(
      'Controls and tradeoffs',
      [
        { id: 'hard', label: 'hard labels' },
        { id: 'round', label: 'round probs' },
        { id: 'topk', label: 'top-k only' },
        { id: 'limits', label: 'query limits' },
        { id: 'dp', label: 'DP training' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['less slope', 'less UX'],
        ['less precision', 'coarser risk'],
        ['less classes', 'debug pain'],
        ['slower search', 'ops burden'],
        ['less influence', 'accuracy cost'],
      ],
    ),
    highlight: { active: ['round:helps', 'limits:helps', 'dp:helps'], compare: ['hard:cost'] },
    explanation: 'Every mitigation changes the API or training system. Hard labels reduce leakage but can break legitimate ranking use cases. Differential privacy is stronger but moves cost into training quality and accounting.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'output detail', min: 0, max: 4 }, y: { label: 'utility / leakage', min: 0, max: 100 } },
      series: [
        { id: 'utility', label: 'utility', points: [{ x: 0, y: 45 }, { x: 1, y: 62 }, { x: 2, y: 76 }, { x: 3, y: 88 }, { x: 4, y: 94 }] },
        { id: 'leakage', label: 'leakage', points: [{ x: 0, y: 8 }, { x: 1, y: 18 }, { x: 2, y: 37 }, { x: 3, y: 65 }, { x: 4, y: 91 }] },
      ],
      markers: [{ id: 'tier', x: 2, y: 76, label: 'tiered API' }],
    }),
    highlight: { active: ['utility', 'leakage'], found: ['tier'] },
    explanation: 'Output detail has a privacy-utility frontier. A tiered API can give trusted internal evaluators richer outputs while exposing coarse outputs to public or low-trust callers.',
  };

  yield {
    state: labelMatrix(
      'Audit signals',
      [
        { id: 'sweep', label: 'sweep' },
        { id: 'near', label: 'near probes' },
        { id: 'rare', label: 'rare class' },
        { id: 'embed', label: 'embed pulls' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'response', label: 'response' },
      ],
      [
        ['many variants', 'rate limit'],
        ['local search', 'cooldown'],
        ['sens target', 'review'],
        ['bulk geometry', 'scope cap'],
      ],
    ),
    highlight: { active: ['sweep:response', 'near:response', 'rare:response'], compare: ['embed:pattern'] },
    explanation: 'Inversion attacks often look like repeated local probes around one target. The audit log should detect query patterns, not just individual policy violations.',
  };

  yield {
    state: labelMatrix(
      'What not to confuse',
      [
        { id: 'cal', label: 'calibration' },
        { id: 'explain', label: 'explain API' },
        { id: 'auth', label: 'auth' },
        { id: 'dp', label: 'DP' },
      ],
      [
        { id: 'falseBelief', label: 'false belief' },
        { id: 'betterView', label: 'better view' },
      ],
      [
        ['honest=safe', 'still leaks'],
        ['debug=safe', 'debug leaks'],
        ['login solves', 'scope output'],
        ['magic switch', 'budgeted'],
      ],
    ),
    highlight: { removed: ['cal:falseBelief', 'explain:falseBelief'], found: ['auth:betterView', 'dp:betterView'] },
    explanation: 'Calibration, explanations, and embeddings are useful product features, but they can increase the attacker signal. Treat them as privileged outputs, not free metadata.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'confidence inversion') yield* confidenceInversion();
  else if (view === 'defense surface') yield* defenseSurface();
  else throw new InputError('Pick a model-inversion view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a model inversion attack, where an attacker uses model outputs to infer hidden attributes or training-like inputs. Confidence means the probability or score the model reports for a class, and that score can guide a search even when the raw training data is never exposed.',
        'Active nodes show the attacker query or defense control being used, compare marks the confidence difference that guides the next guess, and found marks a recovered attribute or blocked leakage path. The safe inference rule is this: if confidence changes predictably with a hidden feature, confidence is a signal, not harmless metadata.',
        {type:'callout', text:'Model inversion risk comes from treating confidence as harmless metadata when it can act as a search signal over hidden data.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many ML services expose more than a label. They return confidence scores, ranked classes, embeddings, explanations, similarity scores, or repeated query access because product teams want better user experience and debugging.',
        'Model inversion exists because those outputs can carry information about sensitive inputs or training distributions. The attacker does not need database access if the model can be queried like an oracle that rewards guesses close to hidden data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious product approach is to return the full prediction vector. If a medical classifier says disease A is 0.61 and disease B is 0.36, the user gets nuance and the developer gets better logs.',
        'That approach feels safe because no row from the training set is returned. The mistake is assuming that a score about the model output cannot become evidence about model inputs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is adaptive querying. An attacker can vary candidate attributes, submit many nearby inputs, and keep the changes that raise confidence for a target class.',
        'Small score differences accumulate. If age, zip code, medication, or a face feature moves the confidence in a consistent direction, the attacker can climb toward a private attribute one query at a time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A confidence value can be an optimization objective. Instead of guessing the hidden input in one step, the attacker searches the input space and uses the model score as feedback.',
        'The attack is strongest when the model is overfit, the output is precise, the query budget is large, and the target class is tightly tied to a sensitive feature. Defenses work by breaking one of those conditions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The attacker starts with a target, such as "recover likely attributes for a person classified as disease positive." They generate candidate records, query the model, observe confidence, and keep candidates that increase the target score.',
        'For image models, the candidates may be pixels or latent vectors; for tabular models, they may be age, income, diagnosis, or location fields. The search ends when further edits stop improving confidence or when the candidate becomes plausible enough to use.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument for the attacker is directional, not absolute. If the model learned a real correlation between hidden attribute x and target class y, and if the output score is monotone enough around the target, then score-improving edits tend to move candidates toward attributes associated with y.',
        'The attack is not guaranteed to recover one exact training row. It can still be harmful when it recovers sensitive attributes, class prototypes, or membership-like evidence that narrows the privacy set.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Attack cost behaves with query budget and search dimension. If the attacker tests 20 candidate edits for each of 30 fields over 5 rounds, the attack uses 3000 model queries before any validation step.',
        'Defense cost is product cost. Rounding scores, returning top-1 labels, adding rate limits, monitoring query patterns, applying differential privacy, and reducing overfitting can lower leakage, but each can also reduce debugging value, personalization, or model accuracy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This risk matters in medical models, face recognition, financial risk scoring, education analytics, genomics, recommender systems, and any hosted classifier trained on sensitive populations. The access pattern is repeated black-box querying with informative outputs.',
        'It also matters for internal tools. A dashboard that exposes exact confidence to many employees can leak attributes even if the underlying database remains access-controlled.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The attack weakens when outputs are coarse, query budgets are low, models generalize well, targets are not tied to sensitive attributes, or input validation blocks unrealistic probes. A random-looking confidence surface gives the attacker little useful direction.',
        'Defenses fail when they only hide labels while leaving another gradient-like signal open. Similarity scores, explanations, embeddings, nearest-neighbor lists, and latency differences can replace confidence as the search reward.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a tabular health model returns disease confidence. A baseline candidate has score 0.42; changing age from 35 to 55 raises it to 0.51, adding medication M raises it to 0.64, and changing zip group lowers it to 0.39, so the attacker keeps age 55 and medication M but rejects that zip change.',
        'After 8 rounds with 15 edits per round, the attacker has spent 120 queries and found a candidate with score 0.88. That candidate may not be the exact person, but it can reveal that the target class strongly implies medication M and an older age range.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fredrikson, Jha, and Ristenpart on model inversion attacks; Shokri and coauthors on membership inference; and differential privacy literature for training-time leakage bounds. Use privacy attack surveys for broader threat models.',
        'Study next: membership inference, shadow models, differential privacy accounting, calibration, confidence rounding, rate-limit design, query anomaly detection, and privacy-preserving evaluation.',
      ],
    },
  ],
};
