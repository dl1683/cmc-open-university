// Uncertainty quantification: teaching a model to say "I don't know."
// Two different kinds of doubt hide inside every prediction — and a trick
// involving dropout lets an ordinary network confess how lost it is.

import { plotState, matrixState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'uncertainty-quantification',
  title: 'Uncertainty: Teaching Models to Say "I Don\'t Know"',
  category: 'AI & ML',
  summary: 'Two kinds of doubt live in every prediction — and MC dropout makes a network confess which one it has.',
  controls: [
    { id: 'view', label: 'Meet', type: 'select', options: ['the two kinds of doubt', 'MC dropout in action'], defaultValue: 'the two kinds of doubt' },
  ],
  run,
};

// Sensor-calibration training data: readings only exist for x in [2, 5].
const TRAIN = [
  [2, 17.5], [2.3, 19.9], [2.8, 21.7], [3, 22.6], [3.4, 23.0],
  [3.8, 25.9], [4.2, 26.3], [4.6, 29.0], [5, 29.7],
];
const mean = (x) => 4 * x + 10;
// Aleatoric floor of ±1.5 inside the data; epistemic growth outside it.
const halfWidth = (x) => 1.5 + 1.8 * Math.max(0, x < 2 ? 2 - x : x - 5);
const GRID = Array.from({ length: 17 }, (_, i) => 1 + i * 0.5);

// MC dropout: the same input, 8 stochastic forward passes (scripted samples).
const PASSES_IN = [21.8, 22.1, 21.9, 22.3, 22.0, 21.7, 22.2, 22.0];
const PASSES_OOD = [31.2, 26.8, 35.0, 24.1, 29.5, 38.2, 27.7, 33.3];
const stats = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return { m, sd };
};

function* twoDoubts() {
  yield {
    state: plotState({
      axes: { x: { label: 'sensor reading', min: 1, max: 9 }, y: { label: 'true temperature °C' } },
      markers: TRAIN.map(([x, y], i) => ({ id: `d${i}`, x, y })),
    }),
    highlight: { active: ['d3', 'd4'] },
    explanation: 'A model calibrating a cheap sensor: 9 training pairs, all collected with readings between 2 and 5. Two facts about this data will become two different kinds of doubt. First: even at the SAME reading, temperatures scatter — the sensor is noisy, and no amount of extra data will un-scatter it. Second: nobody ever recorded a reading above 5 — the region to the right is simply unknown territory. Noise in the data, and absence of data: keep them separate in your head, because they demand opposite remedies.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sensor reading', min: 1, max: 9 }, y: { label: 'predicted temperature °C' } },
      series: [
        { id: 'upper', label: '', points: GRID.map((x) => ({ x, y: mean(x) + halfWidth(x) })) },
        { id: 'mean', label: 'prediction', points: GRID.map((x) => ({ x, y: mean(x) })) },
        { id: 'lower', label: 'band', points: GRID.map((x) => ({ x, y: mean(x) - halfWidth(x) })) },
      ],
      markers: TRAIN.map(([x, y], i) => ({ id: `d${i}`, x, y })),
    }),
    highlight: { active: ['mean'], compare: ['upper', 'lower'] },
    explanation: 'A good model reports a BAND, not a line. Inside the data (readings 2–5) the band is narrow but never zero — that residual ±1.5° is ALEATORIC uncertainty (from the Latin for dice): the sensor\'s own noise, the irreducible scatter we saw. Beyond reading 5 the band fans out fast — that growth is EPISTEMIC uncertainty (from the Greek for knowledge): the model has never seen this region and honestly does not know. At reading 8 the prediction is 42° give or take SEVEN degrees — technically an answer, practically a shrug.',
    invariant: 'Aleatoric uncertainty is a floor that more data never removes; epistemic uncertainty shrinks wherever data arrives.',
  };

  yield {
    state: matrixState({
      title: 'The taxonomy of doubt',
      rows: [{ id: 'alea', label: 'aleatoric' }, { id: 'epis', label: 'epistemic' }],
      columns: [{ id: 'src', label: 'source' }, { id: 'data', label: 'more data helps?' }, { id: 'act', label: 'right response' }],
      values: [[1, 0, 3], [2, 4, 5]],
      format: (v) => ['', 'noise in the world', 'gaps in experience', 'model the spread', 'YES — it shrinks', 'collect data / abstain'][v],
    }),
    highlight: { compare: ['alea:data', 'epis:data'] },
    explanation: 'Why the distinction earns its Greek and Latin: the two doubts demand OPPOSITE actions. Aleatoric high? The world is noisy — model the spread (predict a distribution, not a point) and make peace with it; more data sharpens nothing. Epistemic high? The model is ignorant — collect data there, or refuse to answer. A self-driving car in fog has aleatoric doubt (sensors degraded, slow down); the same car seeing its first kangaroo has epistemic doubt (never trained on this, hand over control). Confusing the two means fixing the wrong problem — and most models report NEITHER, which is the scandal the next view repairs.',
  };
}

function* mcDropout() {
  const inStats = stats(PASSES_IN);
  yield {
    state: arrayState(PASSES_IN.map((v) => v.toFixed(1))),
    highlight: { range: PASSES_IN.map((_, i) => `i${i}`) },
    explanation: 'The confession trick: take a normal trained network and keep DROPOUT switched ON at prediction time (the Dropout topic showed it randomly silencing neurons during training — everyone turns it off afterward; here we deliberately do not). Feed the SAME in-distribution input — sensor reading 3.0 — eight times. Each pass runs a different randomly-thinned sub-network, so each gives a slightly different answer. Eight answers, all between 21.7 and 22.3. The committee agrees.',
  };

  const oodStats = stats(PASSES_OOD);
  yield {
    state: arrayState(PASSES_OOD.map((v) => v.toFixed(1))),
    highlight: { compare: PASSES_OOD.map((_, i) => `i${i}`) },
    explanation: `Same trick, but the input is reading 8.0 — far outside the training data. The eight sub-networks now answer ${Math.min(...PASSES_OOD).toFixed(1)} to ${Math.max(...PASSES_OOD).toFixed(1)} — a spread of over 14 degrees. Why? Inside the data, training forced EVERY sub-network toward the same answer; out here, nothing ever constrained them, so each extrapolates its own way. The committee\'s DISAGREEMENT is the epistemic uncertainty made visible — this is MC (Monte Carlo) dropout, and it is an ensemble in disguise: one network impersonating dozens (the same reason Dropout works as a regularizer, now repurposed as a doubt-meter).`,
    invariant: 'Sub-networks agree where training data constrained them and scatter where it never did.',
  };

  yield {
    state: matrixState({
      title: 'The doubt-meter, read out',
      rows: [{ id: 'inD', label: 'reading 3.0 (seen)' }, { id: 'ood', label: 'reading 8.0 (unseen)' }],
      columns: [{ id: 'mean', label: 'mean' }, { id: 'sd', label: 'std dev' }, { id: 'call', label: 'decision' }],
      values: [[inStats.m, inStats.sd, 1], [oodStats.m, oodStats.sd, 2]],
      format: (v) => (v === 1 ? 'auto-accept ✓' : v === 2 ? 'ESCALATE to human' : v.toFixed(2)),
    }),
    highlight: { found: ['inD:call'], removed: ['ood:call'] },
    explanation: `Average the passes for the prediction; take their standard deviation for the doubt: 22.0 ± ${inStats.sd.toFixed(2)} versus ${oodStats.m.toFixed(1)} ± ${oodStats.sd.toFixed(2)}. Now wire the doubt into the decision: below a threshold, act automatically; above it, abstain and escalate — SELECTIVE PREDICTION, the production pattern for medical triage and loan approvals. Notice this catches what Calibration & Reliability Diagrams cannot: calibration audits probabilities on data LIKE the training set; the std-dev flags inputs UNLIKE it. You want both gauges on the dashboard.`,
  };

  yield {
    state: matrixState({
      title: 'The uncertainty toolbox',
      rows: [
        { id: 'mc', label: 'MC dropout' },
        { id: 'ens', label: 'deep ensembles' },
        { id: 'conf', label: 'conformal prediction' },
      ],
      columns: [{ id: 'cost', label: 'extra cost' }, { id: 'quality', label: 'doubt quality' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'N passes, one model', 'decent', 'train N models', 'gold standard', 'one calibration set', 'guaranteed coverage'][v],
    }),
    highlight: { active: ['ens:quality'] },
    explanation: 'The toolbox, honestly priced: MC dropout is nearly free (one model, N forward passes) and decent; DEEP ENSEMBLES — train 5 networks from different random starts, let them vote — cost 5× the training but remain the gold standard for spotting the unfamiliar; CONFORMAL PREDICTION wraps any model and converts scores into prediction SETS with a mathematical coverage guarantee. And the idea has gone mainstream in LLMs: sample the same question several times and measure agreement — self-consistency — which is exactly MC dropout\'s committee, wearing a chat interface. A model that cannot doubt is a model you cannot deploy anywhere that matters.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the two kinds of doubt') yield* twoDoubts();
  else if (view === 'MC dropout in action') yield* mcDropout();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Uncertainty quantification teaches a model to return more than a point estimate. The demo separates two doubts. Aleatoric uncertainty is noise in the world, such as sensor readings that scatter even inside the training range. Epistemic uncertainty is missing knowledge, such as readings beyond 5 when all training examples lie between 2 and 5. Calibration & Reliability Diagrams asks whether probabilities are honest on familiar data; uncertainty asks whether the model should answer at all.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The first view draws a prediction band. Inside readings 2 to 5, the band has a floor of about +/-1.5 degrees because the data itself is noisy. Beyond reading 5, the band fans out; at reading 8 it is roughly +/-7 degrees. More data cannot remove aleatoric noise, but it can shrink epistemic ignorance where the new data arrives.`,
        `The second view uses MC Dropout. Keep Dropout active at inference and run the same input eight times. At reading 3.0, the scripted passes cluster around 22.0 with standard deviation about 0.19. At reading 8.0, they range from 24.1 to 38.2, with standard deviation about 4.29. The sub-networks agree where training constrained them and disagree where they are extrapolating. That disagreement is not a proof of truth, but it is a useful warning light.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `MC dropout costs N forward passes through one model. Deep ensembles cost N separately trained models but usually give stronger epistemic signals. Conformal prediction uses a calibration set to return prediction sets with coverage guarantees. These methods complement ROC Curves & AUC and Picking a Threshold with Real Costs because they decide when the score itself is too uncertain to trust. The compute bill is usually acceptable for high-stakes decisions and too expensive for every low-latency request unless batched carefully.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Selective prediction wires uncertainty into action: auto-accept low-doubt cases, escalate high-doubt cases, or collect data in unknown regions. Medical triage, lending, industrial inspection, and autonomous systems all need abstention more than bravado. A/B Testing & p-values can then test whether the abstention policy improves outcomes after deployment. The goal is not a timid model; it is a model whose confidence controls the cost of its own mistakes.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Dropout standard deviation is not automatically a calibrated confidence interval. It is a useful signal that needs validation. High uncertainty is not failure; it can be the correct output. Adversarial Examples & FGSM can still fool uncertainty detectors if the attack adapts, and saliency maps explain different interpretability questions. Thompson Sampling and Multi-Armed Bandits show the positive use of uncertainty: explore when unsure, exploit when confident. Do not collapse all doubt into one number if the response to each kind of doubt differs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this, study probability calibration, thresholding, bandit exploration, and Early-Exit Transformer Layer Skipping. The useful deployment pattern is a dashboard with both gauges: one for whether a familiar score is calibrated, and one for whether the input is familiar enough to score at all.`,
        `For implementation, decide the action before choosing the uncertainty method. A warning banner, a human-review queue, a wider prediction interval, and an active-learning request are different products. The right uncertainty estimate is the one that supports the decision you will actually take.`,
        `Always validate the abstention threshold on held-out data. A model that refuses too often can be as unusable as one that guesses too boldly or slow to a crawl.`,
      ],
    },
  ],
};
