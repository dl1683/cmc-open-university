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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first graph as a type check. Hidden states, probes, logits, probabilities, and behavior are different objects, so an arrow that is useful for scoring is not automatically a valid direction to add.',
        'Read the leakage table as a distribution audit. The safe inference rule is that target lift is not enough; a steering update is acceptable only when the full probability distribution stays within a measured drift budget.',
        {type: "callout", text: "Dual steering treats behavior control as movement on the softmax probability geometry, where target lift must be balanced against full-distribution drift."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Activation steering exists because models often contain directions that correlate with concepts such as caution, sentiment, topic, or refusal. Engineers then want to add a direction and make the behavior move in a controlled way.',
        'The output of a language model is not a point in ordinary Euclidean space. It is a probability distribution over tokens, created by softmax from logits, and small logit changes can move probability mass sharply when the distribution is peaked.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train a linear probe for a concept and add some multiple of that probe direction to an activation. A probe is a linear scoring rule, and it often reveals useful structure in the representation.',
        'This approach is attractive because it is simple to test. Increase the coefficient, measure whether the target behavior rises, and keep the setting that seems to work on examples.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a type mismatch. A linear probe is a covector because it scores states, while steering needs a displacement or vector field that changes states.',
        'Even when target behavior rises, probability mass can leak from related tokens or inflate unrelated tokens. A caution feature that raises refusal words but drains helpful alternatives is not a local control; it is a broad distribution shift.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Softmax gives the distribution its own geometry. Logits are natural coordinates, probabilities are expectation-like coordinates, and KL divergence measures distributional change more directly than raw Euclidean distance.',
        'Dual steering asks for a path that changes a target statistic while penalizing off-target distribution movement. The intervention is judged by both target lift and full-distribution drift.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a base distribution over tokens. Define a target concept set or target statistic, such as increasing helpful safety language without collapsing ordinary answer tokens.',
        'A dual-aware controller moves through probability-aware coordinates, maps the desired change back toward logits or an activation intervention, then recomputes softmax. The controller records target lift, KL drift, affected token groups, and slice-level behavior changes.',
        'The cleanest version is near the output layer because logits and probabilities are explicit there. Mid-layer steering needs extra causal tests because hidden-state movement must pass through later nonlinear layers before it becomes behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local and geometric. If behavior is sampled from the softmax distribution, then the intervention should be constrained by movement on that distribution rather than by distance in an arbitrary hidden coordinate system.',
        'The invariant is that off-target drift is measured and penalized while target movement is rewarded. Naive vector addition lacks that invariant, so it can win the target metric while damaging the rest of the distribution.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Output-layer control is relatively cheap because logits and probabilities already exist during decoding. The added cost is computing target statistics, KL drift, and policy checks before accepting the intervention.',
        'Mid-layer control is more expensive because the map from hidden move to output distribution is context-dependent. It needs activation patching, ablations, held-out slices, and safety evaluation to separate causal control from correlation.',
        'Cost also shows up as evaluation burden. A controller that changes 1,000 token probabilities needs more than one target score; it needs audits for calibration, factuality, refusal behavior, toxicity, and task performance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dual steering fits controlled style or safety shifts where broad behavior damage is unacceptable. Examples include making an assistant slightly more cautious, suppressing a known unsafe continuation family, or studying whether a concept is locally controllable.',
        'It is also useful as an interpretability discipline. Even when production uses guardrails or constrained decoding instead, the dual lens forces teams to ask what moved besides the target.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A high probe score does not prove causal control. The probe may detect a correlated feature, and moving along it can fail under prompt shifts or create behavior that was absent from calibration examples.',
        'The method also fails if policy is hidden inside geometry. Dual steering is a low-level intervention, so it still needs refusal policy, constrained decoding, red-team evaluation, trace logging, and rollback rules around it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the next-token distribution assigns 18 percent to target safety tokens, 17 percent to related helpful tokens, 48 percent to neutral task tokens, and 17 percent to off-target tokens. A naive intervention raises target safety tokens to 42 percent but drops helpful tokens to 7 percent and leaves KL drift at 0.52.',
        'A dual-aware intervention raises target safety tokens to 39 percent, keeps helpful tokens at 21 percent, lowers off-target tokens to 8 percent, and keeps KL drift at 0.24. The target gain is slightly smaller, but the distribution keeps more of the behavior that should survive.',
        'Correctness is not that the dual update is morally better by default. It is that the chosen objective includes a drift budget, so the accepted update satisfies the same behavioral constraint the animation is measuring.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study The Information Geometry of Softmax: Probing and Steering, Representation Engineering, and work on the linear representation hypothesis. Then read softmax and temperature material until logits, probabilities, entropy, and KL divergence are comfortable.',
        'Next study calibration curves, sparse autoencoder feature dictionaries, activation patching, constrained decoding, guardrail policy engines, and prompt-injection threat models. The transfer lesson is that a control knob must be judged in the space where behavior is produced.',
      ],
    },
  ],
};
