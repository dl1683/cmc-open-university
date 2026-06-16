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
    explanation: 'Model inversion uses the model confidence as a search objective. Keep known fields fixed, vary unknown sensitive fields, query the model, and move toward candidates that maximize the target score.',
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
    explanation: 'The more detailed the output, the better the attack objective. Full confidence vectors and embeddings expose much more geometry than a hard label or a coarsely rounded probability.',
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
    explanation: 'Each round asks: did this candidate make the model more confident? Gradient-free search, hill climbing, or learned priors can all use that feedback when the API exposes enough precision.',
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
      heading: 'What it is',
      paragraphs: [
        'Model inversion attacks use model outputs to infer sensitive attributes, prototypes, or training-distribution details. The attack does not always recover an exact row. It may recover the hidden field most compatible with the model confidence, or a recognizable class prototype.',
        'Fredrikson, Jha, and Ristenpart introduced model inversion attacks that exploit confidence information in machine-learning APIs: https://dl.acm.org/doi/10.1145/2810103.2813677. A public PDF is available at https://rist.tech.cornell.edu/papers/mi-ccs.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The attacker fixes known attributes, guesses unknown attributes, queries the model, and observes confidence. If a guess increases the target confidence, the optimizer keeps moving in that direction. With a useful prior over faces, text, tabular records, or embeddings, the confidence signal becomes an objective function for reconstruction.',
        'The data structure behind the defense is an output-surface policy: caller tier, allowed output fields, probability precision, top-k class count, embedding access, explanation access, query rate, and audit trigger. Each output field should have a reason to exist because every field can become attack signal.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An organization exposes a classifier through an API that returns full confidence vectors. A red team holds some public attributes fixed and searches over a sensitive field. Confidence rises sharply near the true value, making the hidden field recoverable. The release gate changes the contract: public callers receive hard labels or rounded scores, high-detail explanations require an internal scope, repeated local probes trigger rate limits, and the training team evaluates DP-SGD for the next version.',
        'This differs from Membership Inference. Membership asks whether a record was in training. Model inversion asks what sensitive value or prototype the model output makes recoverable. Both attacks are amplified by overfitting and rich outputs.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not assume authentication alone solves inversion. An authorized user can still receive too much confidence detail. Do not assume calibration makes outputs safe; calibrated probabilities can be honest and still revealing. Do not treat embeddings, explanations, and logits as harmless debug artifacts. Do not remove useful outputs blindly either; measure the privacy-utility frontier and tier access by need.',
        'Study Membership Inference, LLM Training Data Extraction, Differential Privacy SGD, Calibration Curves, LLM Guardrail Policy Engine, Agent Tool Permission Lattice, Rate Limiter, Distributed Tracing, and PII Redaction Token Span Pipeline next.',
      ],
    },
  ],
};
