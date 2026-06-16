// LIME: when the model is a sealed black box — no weights, no gradients,
// just an API — poke it with nearby inputs, fit a tiny linear model to
// what comes back, and read THAT. Locally, every curve is a line.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lime',
  title: 'LIME: Explaining Black Boxes Locally',
  category: 'AI & ML',
  summary: 'No weights, no gradients, just an API? Sample around the input, fit a local line, read the line.',
  controls: [
    { id: 'view', label: 'Open', type: 'select', options: ['explaining one verdict locally', 'the fine print'], defaultValue: 'explaining one verdict locally' },
  ],
  run,
};

// The sealed black box: an interaction-only spam model, p = σ(0.5·x·y − 4).
// Globally curved (the boundary is the hyperbola x·y = 8) — no single
// linear story exists. LIME never sees this formula; it only calls it.
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const blackBox = (excl, caps) => sigmoid(0.5 * excl * caps - 4);

const neighborsOf = (cx, cy) => {
  const pts = [];
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) pts.push([cx + dx, cy + dy]);
  return pts;
};

// Weighted least squares: fit p ≈ b0 + b1·x + b2·y near (cx, cy).
function fitLocal(cx, cy) {
  const pts = neighborsOf(cx, cy);
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  for (const [x, y] of pts) {
    const w = Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / 2));
    const t = blackBox(x, y);
    const row = [1, x, y];
    for (let a = 0; a < 3; a++) {
      v[a] += w * row[a] * t;
      for (let b = 0; b < 3; b++) M[a][b] += w * row[a] * row[b];
    }
  }
  for (let c = 0; c < 3; c++) {
    const pivot = M[c][c];
    for (let b = c; b < 3; b++) M[c][b] /= pivot;
    v[c] /= pivot;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = M[r][c];
      for (let b = c; b < 3; b++) M[r][b] -= k * M[c][b];
      v[r] -= k * v[c];
    }
  }
  return { intercept: v[0], wExcl: v[1], wCaps: v[2] };
}

const AXES = { x: { label: 'exclamation marks', min: 0, max: 9 }, y: { label: 'ALL-CAPS words', min: 0, max: 9 } };
const HYPERBOLA = {
  id: 'boundary',
  label: 'p = 0.5 (x·y = 8)',
  points: Array.from({ length: 25 }, (_, i) => 1 + i * 0.33).map((x) => ({ x, y: 8 / x })).filter((p) => p.y <= 9),
};

function* explainLocally() {
  yield {
    state: plotState({
      axes: AXES,
      series: [HYPERBOLA],
      markers: [{ id: 'q', x: 4, y: 3, label: `p(spam) = ${blackBox(4, 3).toFixed(2)}` }],
    }),
    highlight: { active: ['q'], visited: ['boundary'] },
    explanation: 'A new spam filter — and this time the model is SEALED. It is a vendor\'s ensemble behind an API: no weights to read (Logistic Regression\'s luxury), no gradients to take (Saliency Maps\' tool). You can do exactly one thing: send an input, receive a score. It flags an email at 88% and the curved boundary betrays why global explanations fail here — the model has learned an INTERACTION (exclamations AND caps together), so no single set of feature weights describes it everywhere. LIME\'s wager: you do not need everywhere. You need HERE.',
  };

  const pts = neighborsOf(4, 3);
  yield {
    state: plotState({
      axes: AXES,
      series: [HYPERBOLA],
      markers: pts.map(([x, y], i) => ({ id: `s${i}`, x, y, label: blackBox(x, y).toFixed(2) })),
    }),
    highlight: { active: ['s4'], compare: pts.map((_, i) => `s${i}`).filter((_, i) => i !== 4) },
    explanation: 'Step 1 — PERTURB AND PROBE: generate neighbors of the email (one more exclamation mark, one fewer caps word…) and send every variant through the API, harvesting the black box\'s answer at each. The scores around our point run from 0.27 to 1.00 — the model\'s local terrain, surveyed by querying. Step 2 — WEIGHT BY CLOSENESS: a kernel makes near neighbors count heavily and far ones barely at all, because we are buying an explanation of THIS email, not of emails in general.',
    invariant: 'LIME needs only query access: f(x) in, score out — no internals, any model.',
  };

  const local = fitLocal(4, 3);
  yield {
    state: plotState({
      axes: AXES,
      series: [
        HYPERBOLA,
        {
          id: 'tangent',
          label: 'the local stand-in',
          points: [2.2, 5.8].map((x) => ({ x, y: 3 + (-(local.wExcl / local.wCaps)) * (x - 4) })),
        },
      ],
      markers: [{ id: 'q', x: 4, y: 3, label: '0.88' }],
    }),
    highlight: { found: ['tangent'], active: ['q'] },
    explanation: `Step 3 — FIT THE SURROGATE: weighted least squares finds the plane that best mimics the black box near (4,3): p ≈ ${local.intercept.toFixed(2)} + ${local.wExcl.toFixed(2)}·excl + ${local.wCaps.toFixed(2)}·caps. The line is the plane\'s decision direction laid over the curve — and near our email, the two are almost indistinguishable. That is the entire epistemology of LIME: a curve IS a line, if you stand close enough (calculus\'s founding bargain). The surrogate is interpretable not because the model is, but because we chose an interpretable species — linear — to do the impersonation.`,
  };

  yield {
    state: matrixState({
      title: 'The explanation: read the surrogate\'s weights',
      rows: [{ id: 'excl', label: 'exclamation marks' }, { id: 'caps', label: 'ALL-CAPS words' }],
      columns: [{ id: 'w', label: 'local weight' }, { id: 'verdict', label: 'reading' }],
      values: [[local.wExcl, 1], [local.wCaps, 2]],
      format: (v) => (v === 1 ? 'pushes spam-ward' : v === 2 ? 'pushes harder (~1.4×)' : v.toFixed(3)),
    }),
    highlight: { compare: ['excl:w', 'caps:w'] },
    explanation: 'Step 4 — REPORT: for THIS email, caps words pull about 1.4× harder than exclamation marks. Compare with Saliency Maps: the gradient there needed the model\'s internals and one backward pass; LIME reconstructed nearly the same arrow from the OUTSIDE with nine API calls. That is the trade in one sentence — gradients read the mechanism, LIME interrogates the behavior. When the mechanism is locked away (vendor models, regulation-bound systems, literal humans), interrogation is what remains.',
  };

  const far = fitLocal(1, 8);
  yield {
    state: matrixState({
      title: 'Same model, different email — the story flips',
      rows: [{ id: 'here', label: 'email at (4, 3)' }, { id: 'there', label: 'email at (1, 8)' }],
      columns: [{ id: 'excl', label: 'weight: excl' }, { id: 'caps', label: 'weight: caps' }],
      values: [[local.wExcl, local.wCaps], [far.wExcl, far.wCaps]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['here:caps', 'there:excl'] },
    explanation: `The locality bargain, exposed by running LIME twice. For our email, caps dominated. For a SHOUTY email with few exclamation marks — the point (1, 8) — the local weights flip: exclamations now pull ${(far.wExcl / far.wCaps).toFixed(0)}× harder than caps, because with caps already saturated at 8, the interaction term hands all marginal power to the other feature. Both explanations are TRUE; each is true only in its neighborhood. A model that learned interactions has no global story, and LIME never claimed otherwise — every explanation it produces is stamped "valid locally," and forgetting the stamp is the #1 misuse.`,
    invariant: 'Local fidelity, not global truth: each LIME explanation holds only near the input it explains.',
  };
}

function* finePrint() {
  yield {
    state: matrixState({
      title: 'Fine print 1 — instability: re-sample, re-explain',
      rows: [{ id: 'run1', label: 'sampling run A' }, { id: 'run2', label: 'sampling run B' }],
      columns: [{ id: 'excl', label: 'weight: excl' }, { id: 'caps', label: 'weight: caps' }],
      values: [[0.16, 0.23], [0.21, 0.18]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['run1:caps', 'run2:caps'] },
    explanation: 'Real LIME samples its neighbors RANDOMLY (our demo used a fixed grid for reproducibility — itself the fix in miniature). Different random draws → different fitted weights, and with few samples the top-ranked feature can swap between runs. An explanation that changes when you re-ask is testimony of limited value. Mitigations: more samples (slower), fixed seeds (reproducible but arbitrary), or averaging many runs and reporting the spread — the same honesty-about-noise discipline as Cross-Validation, applied to explanations.',
  };

  yield {
    state: matrixState({
      title: 'Fine print 2 — the scaffolding attack (Slack et al. 2020)',
      rows: [{ id: 'on', label: 'on real data' }, { id: 'off', label: 'on LIME\'s perturbed samples' }],
      columns: [{ id: 'behavior', label: 'model behaves…' }],
      values: [[1], [2]],
      format: (v) => ['', 'BIASED (uses a protected feature)', 'innocent (hides the feature)'][v],
    }),
    highlight: { removed: ['on:behavior'], found: ['off:behavior'] },
    explanation: 'Darker fine print: LIME\'s probes are DETECTABLE. Perturbed samples ("3.4 exclamation marks", images with gray rectangles) sit off the natural data manifold, and a hostile model can recognize them and behave differently under examination — biased on real inputs, innocent on LIME\'s synthetic ones. Slack et al. built exactly this scaffolding and fooled both LIME and SHAP. Moral for auditors: a model being EXAMINED knows it is being examined whenever your probes look synthetic; explanation tools assist scrutiny of cooperative models, they do not survive adversarial ones.',
    invariant: 'Off-manifold probes are distinguishable — a hostile model can answer them differently.',
  };

  yield {
    state: matrixState({
      title: 'The explanation toolbox, final form',
      rows: [
        { id: 'grad', label: 'gradient saliency' },
        { id: 'lime', label: 'LIME' },
        { id: 'shap', label: 'SHAP' },
      ],
      columns: [{ id: 'needs', label: 'needs' }, { id: 'cost', label: 'cost' }, { id: 'catch', label: 'catch' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      format: (v) => ['', 'model internals', '1 backward pass', 'local, gradient noise', 'API access only', '~1000s of queries', 'sampling instability', 'API access only', 'exponential → sampled', 'axioms, but slow + same attack'][v],
    }),
    highlight: { active: ['lime:needs'], compare: ['shap:catch'] },
    explanation: 'The toolbox, completed. SHAP — LIME\'s axiomatic sibling — distributes credit using Shapley values from game theory (every feature\'s average marginal contribution across all orderings): stronger guarantees, exponential cost tamed by sampling, and vulnerable to the same scaffolding. The selection logic: gradients when you own the model, LIME for a fast local read on anything, SHAP when the explanation must survive an audit committee. And carry both warning labels everywhere — every explanation is LOCAL unless proven otherwise, and every explanation is a HYPOTHESIS until verified by the deletion test from Saliency Maps. Tools point; verification convicts.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'explaining one verdict locally') yield* explainLocally();
  else if (view === 'the fine print') yield* finePrint();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `LIME explains black-box models — systems you can only query, with no access to weights or gradients. You send an input, get a prediction, and the internal machinery stays sealed. LIME's insight: to explain a single prediction, you need not understand the whole model — only the tiny neighborhood around that input. Locally, every curve is a line, and lines are interpretable.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `LIME has four steps. First, perturb and probe: generate nearby inputs (one more exclamation mark, one fewer caps word, etc.), query the model on each, and collect the scores. Our demo generates nine neighbors of (4, 3) and watches scores swing from 0.27 to 1.00 — the raw variation to explain. Second, weight by closeness: a kernel weights nearby points heavier (our demo uses weights 0.16 and 0.23 for closer neighbors). Third, fit a surrogate: weighted least squares fits a linear model p ≈ 0.71 + 0.16·excl + 0.23·caps to this local data. This plane is an imposter, not the real model, but interpretable. Fourth, report the surrogate's coefficients: caps (0.23) push 1.4× harder than exclamations (0.16) for this email. This matches Saliency Maps' gradient — but LIME did it from outside with nine API calls, no internals needed.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `LIME costs API calls: practice uses 1000–5000 perturbed samples to fit a stable linear model. For a critical decision (loan approval, content flag), thousands of queries to a fast API cost seconds — a reasonable trade-off for transparency. Fitting the surrogate is O(n³) via Gaussian elimination (n = features); for images, reduce to top-k regions first. Storage is minimal: one explanation per decision, no model training needed.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `LIME excels when models are locked away: vendor APIs, credit-scoring systems, medical devices, regulatory platforms. Banks use it to explain loan denials (income pushed yes, debt pushed no, net result: denied). It explains image classifiers via superpixel masking, NLP models via word perturbation, any structured-data classifier by varying one feature at a time. Warning: LIME's synthetic probes are detectable (Slack et al. 2020), so a hostile model can hide bias on LIME's queries while staying biased on real data. LIME audits cooperative systems, not adversarial ones.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Biggest trap: forgetting "local." Run LIME at (4, 3) and the weights hold only there. At (1, 8) the story flips: exclamations now dominate (0.52 vs 0.07 for caps), because the interaction x·y is saturated. Both truths are local; neither generalizes. Instability is another: re-sampling gives different weights (maybe 0.16 then 0.21). Mitigations: more samples, average runs with uncertainty bands. Finally, every explanation is a hypothesis. Verify via deletion: remove an important feature, re-query, confirm the score drops. If not, the explanation failed.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Sparse Autoencoder Feature Dictionary Case Study goes one layer deeper than LIME: instead of perturbing visible input features around a black-box prediction, it decomposes internal transformer activations into sparse feature IDs and then tests whether those features causally move behavior.`,
        `SHAP is LIME's axiomatic sibling, using Shapley values with formal guarantees but exponential cost (and same scaffolding vulnerability). When you own the model, Saliency Maps & Feature Attribution give gradients directly — faster, requiring internals. Logistic Regression shows why models learn interactions like x·y = 8. Adversarial Examples & FGSM teach input fooling — the flip side of explanation. Cross-Validation & Honest Evaluation measure if explanations generalize. Random Forest shows ensemble interpretability by design.`,
      ],
    },
  ],
};
