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
      heading: 'Why this exists',
      paragraphs: [
        'Model inversion exists as a privacy problem because a model output can reveal more than the product team meant to expose. A classifier may not return a database row, but its confidence scores can still help infer a sensitive field, a class prototype, or a training-distribution pattern. The model becomes a compressed statistical object that answers questions about the data used to shape it.',
        'The risk is sharpest when an API returns rich signals: full probability vectors, logits, embeddings, explanations, nearest-neighbor style outputs, or high-resolution confidence scores. These signals are useful for ranking, debugging, calibration, and user experience. They can also give an attacker feedback about which guessed input is closer to the hidden value.',
        {type:'callout', text:'Model inversion risk comes from treating confidence as harmless metadata when it can act as a search signal over hidden data.'},
        'Fredrikson, Jha, and Ristenpart introduced model inversion attacks that exploit confidence information in machine-learning APIs: https://dl.acm.org/doi/10.1145/2810103.2813677. A public PDF is available at https://rist.tech.cornell.edu/papers/mi-ccs.pdf. The durable lesson is broader than one paper: output contracts are privacy decisions, not just interface design.',
      ],
    },
    {
      heading: 'The naive product instinct and the wall',
      paragraphs: [
        'The naive product instinct is generous output. If a label is useful, a confidence score seems more useful. If one score is useful, a full vector seems better. Embeddings help search and clustering. Explanations help support teams debug mistakes. None of these features are automatically wrong. They often make the system easier to operate.',
        'The wall is that detail creates a search surface. A hard label may reveal only which side of a decision boundary a query landed on. A rounded probability reveals a coarse direction. A full confidence vector reveals how several classes respond to a candidate. An embedding can reveal geometry. An attacker can use that feedback to ask "warmer or colder?" many times.',
        'This is why inversion is not answered by saying the API never exposes training records. The attack is usually iterative. The attacker fixes known attributes, varies unknown attributes, queries the model, and keeps candidates that improve the target score. If the API permits enough probes and returns enough precision, the model output acts like an objective function for guessing hidden information.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that confidence is not just a result; it is feedback. A model that returns "class A, 0.83" tells the caller more than "class A." The difference between 0.74 and 0.83 can steer a search. The search does not need gradients from the model internals. It can use black-box optimization, hill climbing, sampling, learned priors, or a separate generative model.',
        'The attack depends on two ingredients. The first is a signal that changes smoothly enough with the guessed hidden value. The second is a prior that keeps guesses realistic. For a tabular record, the prior may be public statistics and valid category ranges. For a face recognizer, it may be an image generator or a face manifold. For text, it may be a language model or constrained phrase space.',
        'The defense insight is symmetric: reduce the signal and reduce query advantage. Caller tiers, output precision, top-k limits, embedding access, explanation access, rate limits, anomaly detection, and differential privacy all control how much usable information flows out of the model and how cheaply an attacker can search.',
      ],
    },
    {
      heading: 'How the attack works',
      paragraphs: [
        'A typical inversion loop starts with partial knowledge. The attacker may know non-sensitive fields about a person, the target class of a recognizer, or the public context around a possible training example. Unknown fields become variables. The attacker builds a candidate input, queries the model, records the output signal, and updates the variables toward higher target confidence.',
        'The optimizer can be simple when the unknown space is small. If a hidden field has only a few values, repeated queries can enumerate candidates. If the space is continuous or high-dimensional, the attacker needs stronger structure: coordinate search, evolutionary search, Bayesian optimization, a differentiable surrogate, or a generative prior that proposes realistic candidates.',
        'The recovered object depends on the model and output. A medical dosage model might expose a sensitive attribute most compatible with the returned confidence. A face classifier might yield a recognizable class prototype rather than an exact training image. A language model extraction loop can recover memorized strings under different assumptions. Inversion is best understood as recoverability through model feedback, not always as literal record reconstruction.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The confidence-inversion graph proves the feedback loop. Known fields and guessed unknown fields form a candidate query. The model returns a score. The optimizer uses the score to change the unknown fields. The reconstruction node is not produced by one magic query; it is the result of repeated movement through the output surface.',
        'The output ladder proves why API detail changes risk. Hard labels give low-resolution feedback. Rounded probabilities give some slope. Full probabilities, logits, embeddings, and explanations can expose richer geometry. The same product feature that helps a benign user compare options can help an attacker rank guesses.',
        'The defense-surface view proves that mitigation is not one switch. Output precision, top-k size, embedding access, explanation access, caller authorization, query rate, audit rules, and training privacy all change the attack. The frontier plot shows the real product tension: detail often increases utility and leakage together, so a mature system tiers outputs rather than exposing the richest signal to every caller.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument for the attack is an optimization argument. If the model score is correlated with the hidden attribute, and if the attacker can generate plausible candidates, then repeated queries can move toward candidates that the model treats as more likely. The model does not need to be wrong. It only needs to encode enough information about the training distribution or learned class boundary for the score to guide search.',
        'Overfitting can amplify the problem because the model may respond too strongly to idiosyncratic training examples. Rich outputs amplify it because they reveal more of the response surface. Weak priors reduce it because unrealistic candidates waste queries. Small unknown domains increase it because enumeration is cheap. The risk is a joint property of training data, model behavior, output detail, and query policy.',
        'Model inversion differs from membership inference. Membership asks whether a particular record was in the training set. Inversion asks what hidden value, prototype, or sensitive structure can be inferred from the model output. The attacks can overlap in practice, and both become easier when a model overfits or exposes high-detail confidence signals.',
      ],
    },
    {
      heading: 'Defense surface and costs',
      paragraphs: [
        'The first defense is output minimization. Return the coarsest signal that satisfies the product need. Hard labels leak less than high-precision probabilities. Rounded scores leak less than full vectors. Top-k outputs leak less than full class distributions. Embeddings and explanations should be treated as privileged outputs, not harmless debug metadata.',
        'The second defense is query control. Rate limits help only when they slow the actual search pattern. A fixed per-minute quota may not stop a patient attack. Logs should detect local sweeps, repeated near-neighbor probes, rare-class targeting, bulk embedding pulls, and many variants around one individual. Response can include cooldown, additional review, output downgrade, or account investigation.',
        'The third defense is training-time privacy. Differential privacy can limit how much one record influences the learned model, but it has accuracy and accounting costs. Regularization, calibration, deduplication, and holdout audits can reduce risk, but they are not substitutes for an output policy. A release gate should store evidence: what outputs were tested, what inversion attempts were run, what was recoverable, and which API fields changed before launch.',
        'Every mitigation has product cost. Hard labels hurt ranking and triage. Rounding can damage calibration workflows. Hiding embeddings can break search features. Strict query limits can frustrate legitimate batch users. Tiered access is often the practical compromise: public callers get coarse outputs, internal evaluators get richer outputs with logging, and sensitive models face stricter reviews.',
      ],
    },
    {
      heading: 'Where risk is highest',
      paragraphs: [
        'Risk is highest when the model handles sensitive attributes, rare classes, small cohorts, biometric identity, medical facts, financial status, private text, or proprietary training data. It is also high when one record has large influence, when outputs are high precision, when callers can make many queries cheaply, and when there is a strong public prior over the unknown field.',
        'Risk is lower when outputs are coarse, the unknown space is large, the model is well regularized, records are not individually influential, query volume is limited by behavior-aware controls, and the sensitive attribute is weakly connected to the model response. Lower risk is not zero risk. It means the attack needs more queries, better priors, or richer access.',
        'Do not assume authentication solves inversion. An authorized user can still receive too much detail. Do not assume calibrated probabilities are safe; they can be honest and revealing at the same time. Do not remove useful outputs blindly either. Measure the privacy-utility frontier, document the tradeoff, and make output access an explicit API contract.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Membership Inference next to separate record-presence leakage from attribute or prototype recovery. Study LLM Training Data Extraction for generative-model variants, Differential Privacy SGD for training-time bounds, Calibration Curves for probability behavior, Rate Limiter and Distributed Tracing for query control, PII Redaction Token Span Pipeline for input and output hygiene, and Agent Tool Permission Lattice for access-control design. The implementation habit to keep is simple: every sensitive model should ship with an output-surface policy that says who can see hard labels, rounded scores, full probabilities, embeddings, explanations, logs, and bulk query access.',
      ],
    },
  ],
};
