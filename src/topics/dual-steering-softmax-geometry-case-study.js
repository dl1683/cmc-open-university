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
      heading: 'Why this exists',
      paragraphs: [
        "Activation steering exists because we often find a direction or probe that appears to represent a concept, then want to use it as a control knob. If a model has a caution feature, a refusal feature, a sentiment feature, or a topic feature, it is tempting to add that vector and expect the behavior to move cleanly in that direction.",
        "The problem is that language-model behavior is not produced by Euclidean distance alone. The final object the user sees is a probability distribution over tokens. Softmax turns logits into that distribution, and small-looking changes can move probability mass sharply when the distribution is already peaked. Dual steering exists to ask a more careful question: how do we change a target concept while limiting damage to the rest of the distribution?",
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is linear probing followed by vector addition. Train a probe to detect a concept. Treat the probe direction as if it were a displacement. Add some multiple of it to the activation or logit state. Measure whether the target tokens, labels, or behaviors become more common.",
        "That approach is not foolish. Linear probes often reveal useful structure, and vector arithmetic can work surprisingly well in representation spaces. The wall is a type mismatch. A probe scores a state; it is a covector. A steering update moves a state; it needs a vector field or displacement. Treating the probe itself as the move can raise the target while draining related concepts, inflating unrelated tokens, or shifting the model into a less calibrated region.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is that softmax representations have their own geometry. Logits are natural coordinates for the distribution. Probabilities and probability-weighted expectations are dual coordinates. KL divergence is the natural way to measure how much the distribution changed, because it measures distributional drift rather than raw Euclidean movement.",
        "Dual steering uses that geometry. Instead of asking only for a large target-feature score, it asks for a controlled path through probability coordinates and then maps that path back to an intervention. The intended result is an update that changes the target concept while minimizing off-target movement. The method is easiest to state near the final softmax, where logits and probabilities are explicit.",
        "This also changes what counts as success. A clean intervention should move the concept and preserve nearby behavior that should remain available. If a caution update destroys helpful answers, or a sentiment update collapses topic diversity, the target moved but the control was not local enough.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Start with a base distribution. The model has logits, softmax converts them into probabilities, and those probabilities produce token behavior. A probe gives a score for a concept, but the steering controller must decide how to convert that score into a movement that respects the distribution.",
        "A dual-aware controller defines a target concept set or target statistic, chooses a bounded movement in the dual coordinate system, maps the result back toward logits or an activation intervention, and checks the resulting softmax distribution. The check matters. A steering update that raises the target by 5 points but moves the whole distribution by a large KL distance is not a clean control.",
        "In a practical loop, the data structures are a base logit snapshot, a target concept definition, a steering path, probability snapshots before and after the intervention, a KL budget, and slice-level evals. That makes steering auditable. The system can say not only that a target rose, but which other regions moved, which examples regressed, and when the update should be rolled back.",
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The first view proves the mismatch. Hidden states, probes, logits, softmax, probabilities, and behavior are different objects. The probe can be useful without being the right object to add. The coordinate matrix makes the point sharper: a movement that looks small in hidden-space coordinates can be large in probability space.",
        "The leakage table and KL plot prove why target lift is not enough. Naive steering can improve a target row while disturbing allies, neutral mass, or off-target behavior. The dual path is judged by two numbers at once: how much the target moved and how much the full distribution drifted. A good visual does not merely show arrows moving. It shows why a controller needs a budget and an audit.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The correctness argument is a geometry argument. Softmax maps logits to a point on the probability simplex. If the objective is behavioral control, the update should be judged by movement on that simplex, not only by movement in an arbitrary activation coordinate system. KL divergence gives a local notion of cost for changing one distribution into another.",
        "Dual steering works when the concept statistic is meaningful and the map between coordinates is modeled well enough for the intervention site. It does not need every hidden dimension to be semantically pure. It needs the controller to preserve the invariant that off-target distribution movement is penalized while target movement is rewarded. That is the invariant naive vector addition lacks.",
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "Output-layer steering can be cheap because logits and probabilities already exist during decoding. The added cost is mostly scoring, probability accounting, KL measurement, and evaluation. The hard part is deciding what target concept means and how much distribution drift is acceptable.",
        "Mid-layer steering is more expensive and less direct. A hidden-state change can affect many future layers before it reaches the softmax. The map is nonlinear, context dependent, and model specific. Causal tests, activation patching, ablations, and held-out evals are not optional polish. They are how you find out whether the intervention is a real knob or only a correlated probe.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "Dual steering fits cases where a system needs a small, measurable style or concept shift without broad behavioral damage. Examples include making an assistant slightly more cautious without turning routine answers into refusals, suppressing a known unsafe continuation family while preserving helpful alternatives, or studying how a concept appears in a model distribution.",
        "It is also useful as an interpretability discipline. Even if a production system never deploys the exact method, the dual-steering lens forces the right audit questions. What moved besides the target? Was the movement local? Did related concepts survive? Did calibration, factuality, refusal behavior, or toxicity change on slices that were not part of the target?",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "A high probe score is not a guarantee of causal control. A probe may detect a feature because it is correlated with the behavior, not because moving along it causes the behavior cleanly. Steering by that signal can create brittle changes that disappear under prompt shifts or become harmful on examples outside the calibration set.",
        "Another failure is hiding policy inside geometry. Dual steering is a low-level control primitive. It cannot replace refusal policies, constrained decoding, safety classifiers, red-team evals, trace logging, or rollback rules. It can also fail through bad target definitions, too-large step sizes, poor KL budgets, or evaluations that only measure the desired lift and ignore collateral movement.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Softmax & Temperature first, because this topic depends on how logits become probabilities and how sharp distributions amplify small logit changes. Then study Attention, Sparse Autoencoder Feature Dictionary Case Study, Representation Engineering, Calibration Curves, and LLM Guardrail Policy Engine.",
        "For contrast, study Constrained Decoding and Prompt Injection Threat Model. Constrained decoding controls the output surface directly. Guardrails and threat models handle policy and adversarial behavior. Dual steering belongs below those systems: it changes model behavior, but it still needs higher-level checks around it.",
      ],
    },
  ],
};
