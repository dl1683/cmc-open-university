// Dual steering: treat softmax outputs as probability geometry instead of
// pretending every probe vector is an ordinary Euclidean displacement.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dual-steering-softmax-geometry-case-study',
  title: 'Dual Steering Softmax Geometry Case Study',
  category: 'Papers',
  summary: 'An interpretability case study: activation steering can leak probability mass when a probe covector is used as a Euclidean displacement instead of respecting softmax geometry.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['geometry mismatch', 'dual steering'], defaultValue: 'geometry mismatch' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function softmaxGraph(title) {
  return graphState({
    nodes: [
      { id: 'hidden', label: 'hidden h', x: 0.8, y: 3.6, note: 'state' },
      { id: 'probe', label: 'probe', x: 2.7, y: 1.8, note: 'covector' },
      { id: 'logits', label: 'logits', x: 2.7, y: 3.6, note: 'lambda' },
      { id: 'softmax', label: 'softmax', x: 4.7, y: 3.6, note: 'map' },
      { id: 'prob', label: 'prob dist', x: 6.7, y: 3.6, note: 'phi' },
      { id: 'behavior', label: 'behavior', x: 8.6, y: 3.6, note: 'tokens' },
      { id: 'naive', label: 'naive add', x: 4.7, y: 1.8, note: 'type mix' },
      { id: 'kl', label: 'KL cost', x: 6.7, y: 5.4, note: 'metric' },
    ],
    edges: [
      { id: 'e-hidden-logits', from: 'hidden', to: 'logits' },
      { id: 'e-probe-naive', from: 'probe', to: 'naive' },
      { id: 'e-naive-logits', from: 'naive', to: 'logits' },
      { id: 'e-logits-softmax', from: 'logits', to: 'softmax' },
      { id: 'e-softmax-prob', from: 'softmax', to: 'prob' },
      { id: 'e-prob-behavior', from: 'prob', to: 'behavior' },
      { id: 'e-prob-kl', from: 'prob', to: 'kl' },
    ],
  }, { title });
}

function* geometryMismatch() {
  yield {
    state: softmaxGraph('The probe is not automatically a direction to add'),
    highlight: { active: ['hidden', 'probe', 'naive', 'logits', 'e-probe-naive', 'e-naive-logits'], compare: ['softmax', 'prob'] },
    explanation: 'A linear probe is a covector: it scores a direction. Naive activation steering often treats that probe as if it were a displacement vector. The softmax-geometry argument is that this is a type error that can move probability mass in unintended ways.',
  };

  yield {
    state: labelMatrix(
      'Coordinate systems',
      [
        { id: 'hidden', label: 'hidden' },
        { id: 'lambda', label: 'lambda' },
        { id: 'phi', label: 'phi' },
        { id: 'kl', label: 'KL' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['activation', 'flat move'],
        ['raw logits', 'scale leak'],
        ['prob center', 'nonlinear'],
        ['distance', 'ignored'],
      ],
    ),
    highlight: { active: ['lambda:means', 'phi:means', 'kl:means'], compare: ['hidden:risk'] },
    explanation: 'Softmax gives two useful coordinate systems. Lambda coordinates are raw logits or natural parameters. Phi coordinates are probability-weighted expectation coordinates. KL divergence is the natural cost, not Euclidean distance in a hidden layer.',
    invariant: 'A small Euclidean move can be a large probabilistic move.',
  };

  yield {
    state: labelMatrix(
      'Probability leakage example',
      [
        { id: 'target', label: 'target' },
        { id: 'ally', label: 'ally' },
        { id: 'neutral', label: 'neutral' },
        { id: 'off', label: 'off target' },
      ],
      [
        { id: 'base', label: 'base' },
        { id: 'naive', label: 'naive' },
        { id: 'dual', label: 'dual' },
      ],
      [
        ['18%', '42%', '39%'],
        ['17%', '7%', '21%'],
        ['48%', '37%', '32%'],
        ['17%', '14%', '8%'],
      ],
    ),
    highlight: { active: ['target:naive', 'neutral:naive'], found: ['target:dual', 'ally:dual'], compare: ['off:dual'] },
    explanation: 'The stylized leakage pattern is the lesson: naive steering can raise the target while unexpectedly draining related probability mass or inflating neutral mass. Dual-aware steering tries to preserve the intended probability geometry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'target lift', min: 0, max: 1 }, y: { label: 'KL drift', min: 0, max: 1 } },
      series: [
        { id: 'naive', label: 'naive', points: [{ x: 0.10, y: 0.05 }, { x: 0.28, y: 0.22 }, { x: 0.46, y: 0.52 }, { x: 0.62, y: 0.88 }] },
        { id: 'dual', label: 'dual', points: [{ x: 0.09, y: 0.04 }, { x: 0.25, y: 0.12 }, { x: 0.40, y: 0.24 }, { x: 0.52, y: 0.40 }] },
      ],
      markers: [
        { id: 'budget', x: 0.40, y: 0.24, label: 'budget' },
      ],
    }),
    highlight: { active: ['dual', 'budget'], compare: ['naive'] },
    explanation: 'A steering controller should measure both target lift and distribution drift. If a stronger intervention buys little target lift but large KL movement, the control is not clean.',
  };
}

function* dualSteering() {
  yield {
    state: graphState({
      nodes: [
        { id: 'probe', label: 'probe', x: 0.8, y: 3.5, note: 'score' },
        { id: 'dualmap', label: 'dual map', x: 2.8, y: 3.5, note: 'phi' },
        { id: 'blend', label: 'blend', x: 4.8, y: 3.5, note: 'path' },
        { id: 'inverse', label: 'inverse', x: 6.6, y: 3.5, note: 'lambda' },
        { id: 'softmax', label: 'softmax', x: 8.2, y: 3.5, note: 'check' },
        { id: 'tokens', label: 'tokens', x: 9.6, y: 3.5, note: 'emit' },
      ],
      edges: [
        { id: 'e-probe-dualmap', from: 'probe', to: 'dualmap' },
        { id: 'e-dualmap-blend', from: 'dualmap', to: 'blend' },
        { id: 'e-blend-inverse', from: 'blend', to: 'inverse' },
        { id: 'e-inverse-softmax', from: 'inverse', to: 'softmax' },
        { id: 'e-softmax-tokens', from: 'softmax', to: 'tokens' },
      ],
    }, { title: 'Dual steering moves through probability coordinates' }),
    highlight: { active: ['dualmap', 'blend', 'inverse', 'e-dualmap-blend', 'e-blend-inverse'], found: ['softmax'] },
    explanation: 'Dual steering first reasons in the probability-weighted coordinate system, then maps back to logits. The point is not that every deployment should do this exactly, but that steering should respect the geometry of the distribution it is trying to control.',
  };

  yield {
    state: labelMatrix(
      'Primal versus dual interpolation',
      [
        { id: 'and', label: 'AND' },
        { id: 'or', label: 'OR' },
        { id: 'collapse', label: 'collapse' },
        { id: 'union', label: 'union' },
      ],
      [
        { id: 'primal', label: 'primal' },
        { id: 'dual', label: 'dual' },
      ],
      [
        ['overlap', 'weak'],
        ['weak', 'preserve'],
        ['likely', 'lower'],
        ['lower', 'likely'],
      ],
    ),
    highlight: { active: ['and:primal', 'or:dual', 'union:dual'], compare: ['collapse:primal'] },
    explanation: 'The local Dual Steering document highlights a useful intuition: primal interpolation behaves like an AND that can collapse to the overlap of concepts, while dual interpolation behaves more like an OR that preserves a union of likely regions.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: style steering at the output node',
      [
        { id: 'measure', label: 'measure' },
        { id: 'target', label: 'target' },
        { id: 'steer', label: 'steer' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'metric', label: 'metric' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['logits', 'base KL', 'slice'],
        ['concept set', 'lift', 'cap'],
        ['dual path', 'drift', 'rollback'],
        ['outputs', 'toxicity', 'holdout'],
      ],
    ),
    highlight: { active: ['measure:metric', 'steer:data', 'steer:guard'], found: ['audit:guard'] },
    explanation: 'The cleanest case is output-node control. Log the base distribution, define the concept target, steer along a bounded dual path, and audit both target lift and unintended behavior shifts.',
  };

  yield {
    state: labelMatrix(
      'Limitations checklist',
      [
        { id: 'layer', label: 'layer' },
        { id: 'map', label: 'map' },
        { id: 'probe', label: 'probe' },
        { id: 'safety', label: 'safety' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['exit only?', 'mid-layer gap'],
        ['invertible?', 'approx error'],
        ['causal?', 'correlate'],
        ['bounded?', 'jailbreak'],
        ['slices?', 'regression'],
      ],
    ),
    highlight: { found: ['layer:question', 'probe:question', 'safety:question', 'eval:question'] },
    explanation: 'A major practical limitation is that the clean math is easiest at the final softmax. Intermediate-layer steering still needs causal tests, safety gates, and independent evaluations before it should be trusted.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'geometry mismatch') yield* geometryMismatch();
  else if (view === 'dual steering') yield* dualSteering();
  else throw new InputError('Pick a Dual Steering view.');
}

export const article = {
  references: [
    { title: 'The Information Geometry of Softmax: Probing and Steering', url: 'https://arxiv.org/abs/2602.15293' },
    { title: 'Representation Engineering: A Top-Down Approach to AI Transparency', url: 'https://arxiv.org/abs/2310.01405' },
    { title: 'The Linear Representation Hypothesis and the Geometry of Large Language Models', url: 'https://arxiv.org/abs/2311.03658' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Dual Steering is a softmax-geometry lesson for interpretability and control. A probe vector can tell you that a feature is present, but steering by simply adding that probe to an activation assumes Euclidean geometry where the output distribution actually lives in softmax and KL geometry.',
        'The local Dual Steering notes emphasize the type mismatch: a linear probe is a covector, not automatically a displacement vector. The case study shows why that matters for probability leakage, concept mixing, and safety auditing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Softmax maps logits into a probability distribution. In information geometry, logits can be treated as natural coordinates, while probability-weighted expectations form dual coordinates. Moving directly in one coordinate system can produce unintuitive movement in the other.',
        'Dual-aware steering tries to move through probability coordinates, then map back to logits or interventions. The goal is not only to increase a target concept, but to control how much unrelated probability mass moves while doing it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose an assistant must make a response more cautious without turning every answer into a refusal. Naive steering adds a caution probe and watches the target words rise. A dual-aware controller also measures KL drift, related-token preservation, refusal-token inflation, and slice regressions across normal helpful tasks.',
        'The data structures are a base logit vector, a target concept set, a steering path, a probability distribution snapshot, a KL budget, and a rollback policy. That makes steering an auditable control loop instead of a one-line vector addition.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Output-node steering can be cheap because logits and probabilities already exist at decoding time. The complexity is conceptual and evaluative: define the target, choose a path, cap distribution drift, and monitor off-target behavior.',
        'Intermediate-layer steering is harder. The map from hidden activations to future output distributions is nonlinear and context dependent. That is why causal evaluation, activation patching, and held-out behavior tests matter more than a pretty probe direction.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse a high probe score with a safe intervention. A feature can be correlated with behavior without being a clean causal knob. Also, target lift is not enough. A control can increase the desired concept while breaking calibration, style, refusal behavior, or factuality.',
        'Another misconception is that this replaces policy and safety systems. It is a low-level control primitive. Production systems still need constrained decoding, refusal policies, eval harnesses, trace logging, and rollback.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Information Geometry of Softmax: Probing and Steering at https://arxiv.org/abs/2602.15293, Representation Engineering at https://arxiv.org/abs/2310.01405, and The Linear Representation Hypothesis at https://arxiv.org/abs/2311.03658. Study Softmax & Temperature, Sparse Autoencoder Feature Dictionary Case Study, Calibration Curves, Constrained Decoding, LLM Guardrail Policy Engine, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
