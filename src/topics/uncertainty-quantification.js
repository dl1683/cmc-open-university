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
      format: (v) => (v === 1 ? 'auto-accept âœ“' : v === 2 ? 'ESCALATE to human' : v.toFixed(2)),
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
    explanation: 'The toolbox, honestly priced: MC dropout is nearly free (one model, N forward passes) and decent; DEEP ENSEMBLES — train 5 networks from different random starts, let them vote — cost 5Ã— the training but remain the gold standard for spotting the unfamiliar; CONFORMAL PREDICTION wraps any model and converts scores into prediction SETS with a mathematical coverage guarantee. And the idea has gone mainstream in LLMs: sample the same question several times and measure agreement — self-consistency — which is exactly MC dropout\'s committee, wearing a chat interface. A model that cannot doubt is a model you cannot deploy anywhere that matters.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation separates two kinds of doubt. Aleatoric uncertainty is noise in the data itself, while epistemic uncertainty is missing knowledge because the model has not seen enough similar examples.',
        {
          type: 'callout',
          text: 'Uncertainty is useful only when it changes the decision: accept routine predictions, widen intervals for noise, and escalate inputs the model has not learned.',
        },
        'Active samples are repeated model outputs, and the spread between them is the signal. A narrow band means the model is stable on that input; a wide band means the system should widen the interval, collect data, or escalate.',
        {
          type: 'image',
          src: './assets/gifs/uncertainty-quantification.gif',
          alt: 'Animated walkthrough of the uncertainty quantification visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model prediction without uncertainty is just a number. A temperature estimate of 22 degrees inside the training range and a temperature estimate of 42 degrees far outside it may look equally precise unless the model reports doubt.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg',
          alt: 'Normal distribution with one, two, and three standard deviation intervals shaded',
          caption: 'Prediction bands are decision surfaces, not decoration: their width tells the system how much outcome range to reserve. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the model\'s own score. A classifier with softmax 0.97 looks confident, and a regression model returning one decimal place looks precise.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that confidence and familiarity are different questions. A model can be well calibrated on cat and dog images and still assign 0.99 dog to a truck, because the truck is outside the training distribution.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate uncertainty into what more data can fix and what more data cannot fix. Epistemic uncertainty comes from limited training coverage, while aleatoric uncertainty comes from irreducible noise in the measurement or outcome.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'MC dropout keeps dropout active at inference time. Dropout randomly turns off parts of the neural network, so repeated forward passes act like a small committee of related models.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg',
          alt: 'Layered neural network diagram with colored nodes and connections',
          caption: 'MC dropout samples many thinned versions of the same layered network; disagreement across those samples becomes an epistemic signal. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Where training data is dense, different dropout masks or ensemble members are constrained by many similar examples. Their predictions tend to agree, so the measured spread is small.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MC dropout costs T forward passes per prediction. If one pass takes 10 milliseconds and T = 30, the uncertainty estimate takes about 300 milliseconds before batching or hardware parallelism.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Selective prediction is the main use. The system accepts low-uncertainty cases automatically and routes high-uncertainty cases to a human, another model, or a conservative fallback.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MC dropout is an approximation, not a guaranteed confidence interval. It depends on architecture, dropout placement, dropout rate, and whether the sampled subnetworks actually disagree in unknown regions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For input 3.0, eight MC-dropout passes return 21.8, 22.1, 22.0, 21.9, 22.2, 22.0, 21.7, and 22.1, with mean about 22.0 and standard deviation about 0.16. The small spread says the model is stable inside the training range.',
        'For input 8.0, the passes return 24.1, 28.7, 31.2, 35.0, 38.2, 29.5, 33.1, and 26.4, with mean about 30.8 and standard deviation about 4.7. A rule that escalates above standard deviation 2.0 would send this case to review.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Gal and Ghahramani, Dropout as a Bayesian Approximation (2016), Lakshminarayanan, Pritzel, and Blundell on deep ensembles (2017), and Guo et al. on calibration (2017). Then study calibration curves, Brier score, conformal prediction, out-of-distribution detection, and selective prediction.',
      ],
    },
  ],
};
