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
        'The animation has two views. "The two kinds of doubt" draws a prediction band over a sensor-calibration dataset: 9 training points between readings 2 and 5, then extrapolation beyond. Active markers are training data. The band\'s width IS the uncertainty -- narrow inside the data, flaring outside. Watch where the band stays flat (irreducible noise) versus where it grows (missing knowledge).',
        {type: 'callout', text: 'Uncertainty is useful only when it changes the decision: accept routine predictions, widen intervals for noise, and escalate inputs the model has not learned.'},
        '"MC dropout in action" runs the same input through one network eight times with dropout left on. Active cells are individual forward-pass outputs. When they cluster tightly, the model is stable. When they scatter, the model is guessing. The matrix view at the end maps scatter width to a decision: accept or escalate.',
        'At each frame, ask: is the doubt coming from noisy data or missing data? The answer determines whether the system should widen its interval or refuse to answer.',
      
        {type: 'image', src: './assets/gifs/uncertainty-quantification.gif', alt: 'Animated walkthrough of the uncertainty quantification visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model that returns a point estimate without a doubt score is dangerous. A sensor-calibration model predicting 42 degrees for a reading it has never seen looks identical to one predicting 22 degrees for a reading it trained on. Both are single numbers. One is trustworthy; the other is a guess dressed as a fact.',
        {
          type: 'quote',
          text: 'We show that a dropout network is mathematically equivalent to an approximation to a probabilistic deep Gaussian process. We develop tools for representing model uncertainty of existing dropout NNs -- extracting information that has been thrown away so far.',
          attribution: 'Yarin Gal and Zoubin Ghahramani, "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning" (2016)',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal distribution with one, two, and three standard deviation intervals shaded', caption: 'Prediction bands are decision surfaces, not decoration: their width tells the system how much outcome range to reserve. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'Uncertainty quantification exists because confidence must be actionable. A medical imaging model that flags "I am not sure about this scan" routes it to a specialist. A lending model that flags "this applicant is outside my training distribution" triggers manual review instead of an automated denial. Without a doubt signal, every prediction gets the same trust level, and the system cannot distinguish routine cases from dangerous ones.',
        'Two distinct problems hide under the word "uncertainty." Aleatoric uncertainty is noise in the world -- the sensor scatters even on inputs the model has seen thousands of times. Epistemic uncertainty is ignorance -- the model has never seen this region. The first cannot be fixed with more data. The second can. Conflating them means applying the wrong remedy.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use the model\'s own output as confidence. A softmax probability of 0.97 looks decisive. A regression model returning 42.0 with no error bar looks clean. For in-distribution inputs with well-calibrated models, this can work passably.',
        'The problem is that neural networks are not calibrated by default. Modern deep networks trained with cross-entropy tend to be overconfident -- softmax outputs cluster near 0 and 1 even on ambiguous inputs. Guo et al. (2017) showed that post-hoc temperature scaling can fix calibration on familiar data, but temperature scaling does nothing for out-of-distribution inputs. It rescales all logits uniformly; it cannot distinguish "this is a hard cat-vs-dog image" from "this is a chest X-ray fed to an animal classifier."',
        'A global confidence threshold compounds the problem. Setting "reject if softmax < 0.8" conflates two questions: is the score well-calibrated on data like the training set, and is this input similar enough to the training set to trust the score at all? Calibration answers the first. Epistemic uncertainty answers the second. One threshold cannot serve both.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that calibrated probabilities and epistemic uncertainty answer different questions, and no single scalar can answer both. A perfectly calibrated model -- one whose 0.7 predictions are correct exactly 70% of the time -- can still assign 0.95 to an out-of-distribution input it has never seen, because calibration is a property of the training distribution, not a detector for novelty.',
        'Concrete failure: train an image classifier on cats and dogs. Temperature-scale it until calibration error is near zero on a held-out test set of cats and dogs. Now feed it a picture of a truck. The softmax output can still be 0.99 "dog" because the network projects every input onto the learned classes. The calibration guarantee says nothing about trucks -- it only promises that among inputs that look like cats and dogs, the 0.99s are right 99% of the time.',
        'This is not a fixable bug in calibration. It is a structural limitation. Calibration conditions on the data distribution; epistemic uncertainty conditions on the model\'s coverage. You need both gauges on the dashboard, or the system will be confidently wrong on exactly the inputs where confidence matters most.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'MC dropout (Gal and Ghahramani, 2016) repurposes the dropout regularizer as a Bayesian approximation. During training, dropout randomly silences neurons to prevent co-adaptation. The standard practice is to turn dropout off at test time. MC dropout keeps it on. Each forward pass through the network uses a different random dropout mask, producing a different thinned sub-network. Run the same input T times, collect T outputs, and compute their mean (the prediction) and standard deviation (the uncertainty).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and connections', caption: 'MC dropout samples many thinned versions of the same layered network; disagreement across those samples becomes an epistemic signal. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        {
          type: 'code',
          language: 'python',
          text: '# MC Dropout inference: T stochastic forward passes\nmodel.train()  # keep dropout active\nT = 30\noutputs = torch.stack([model(x) for _ in range(T)])  # [T, batch, classes]\nmean_pred = outputs.mean(dim=0)        # prediction\nstd_pred  = outputs.std(dim=0)         # epistemic uncertainty\n# High std => model disagrees with itself => epistemic doubt\n# Route to human review if std > threshold',
        },
        'In the animation, reading 3.0 (inside training data) produces eight passes clustered between 21.7 and 22.3, standard deviation ~0.19. Reading 8.0 (far outside training data) produces passes scattered from 24.1 to 38.2, standard deviation ~4.29. The sub-networks agree where training constrained them and scatter where it never did. That scatter is epistemic uncertainty made visible.',
        'Deep ensembles (Lakshminarayanan et al., 2017) take the committee idea further: train M separate networks from different random initializations, each seeing the same data but learning a different function in the parts the data underdetermines. Their disagreement is a stronger epistemic signal than MC dropout because the diversity comes from different optimization trajectories, not just different dropout masks. The cost is M full training runs instead of one.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {
          type: 'diagram',
          label: 'Epistemic vs. aleatoric uncertainty decomposition',
          text: 'Total predictive uncertainty = Epistemic + Aleatoric\n\nEpistemic (model uncertainty)        Aleatoric (data uncertainty)\n-------------------------------      ----------------------------\nSource: limited training data         Source: noise in the world\nSignal: disagreement between          Signal: average predicted\n        ensemble members or                   variance across\n        MC dropout passes                     ensemble members\nFix:    more data, better coverage    Fix:    cannot be reduced;\n                                              model the spread\nAction: abstain, collect data,        Action: widen interval,\n        escalate to human                     risk-aware decision',
        },
        'MC dropout works because dropout during training implicitly builds an ensemble. Each dropout mask defines a sub-network, and training optimizes a weighted combination of exponentially many sub-networks. Where data is dense, gradient updates force all sub-networks toward the same function -- they agree. Where data is absent, no gradient ever constrained the sub-networks, so they extrapolate differently -- they disagree. The variance across masks approximates the posterior variance of a Gaussian process.',
        'Deep ensembles work because random initialization plus non-convex loss landscapes mean each network settles into a different local minimum. These minima agree in regions where the data strongly constrains the function and diverge elsewhere. Empirically, ensembles capture functional diversity better than MC dropout because different initializations explore the loss landscape more broadly than different dropout masks from a single optimum.',
        'Conformal prediction works by an entirely different mechanism. It makes no assumptions about the model\'s internals. Instead, it uses a held-out calibration set to convert any model\'s scores into prediction sets with a guaranteed coverage rate (e.g., "the true label is in this set at least 90% of the time"). The guarantee is distribution-free under exchangeability. It does not decompose uncertainty into epistemic and aleatoric, but it gives hard coverage guarantees that Bayesian methods do not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'MC dropout: one standard training run, T forward passes at inference, useful dropout-mask disagreement, post-hoc calibration still needed, approximate Bayesian interpretation.',
            'Deep ensembles: M full training runs and M forward passes, strong initialization diversity, often better calibrated, empirical rather than formal guarantees.',
            'Bayesian neural networks: variational overhead during training and sampled inference, principled posterior target, approximation quality can still underestimate uncertainty.',
            'Temperature scaling: one calibration pass and one forward pass, good in-distribution calibration, no out-of-distribution novelty signal.',
            'Conformal prediction: one model plus a calibration set, prediction-set construction at inference, finite-sample coverage under exchangeability.',
          ],
        },
        'MC dropout with T=30 passes costs 30x inference compute for one model. Deep ensembles with M=5 models cost 5x training and 5x inference. For a model that takes 10ms per forward pass, MC dropout adds 290ms per prediction; ensembles add 40ms but required 5 full training runs. Both are acceptable for medical imaging or loan decisions where a single mistake costs thousands. Both are expensive for real-time serving at millions of queries per second unless batched or distilled.',
        'Expected Calibration Error (ECE) measures how well predicted probabilities match observed frequencies. Bin predictions into groups by confidence, compute the gap between average confidence and average accuracy in each bin, and take the weighted average. ECE of 0.02 means predictions are off by 2 percentage points on average. Low ECE is necessary but not sufficient -- a model can have perfect ECE on familiar data and assign 0.99 to an out-of-distribution input.',
        'Evaluation requires held-out in-distribution data, deliberately shifted data, and out-of-distribution probes. Metrics: ECE, Brier score, AUROC for OOD detection (using uncertainty as the detector score), coverage at a given abstention rate, and cost-weighted error after selective prediction. If you cannot test on shifted data, you cannot trust the uncertainty estimate in production.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Selective prediction is the core production pattern. Wire uncertainty into the decision loop: auto-accept when doubt is below a threshold, escalate to a human when it is above. Medical imaging systems use this to route ambiguous scans to radiologists. Loan underwriting uses it to flag applicants who fall outside the training distribution for manual review. Autonomous vehicles use it to trigger conservative fallback behavior when perception uncertainty spikes.',
        'Out-of-distribution detection uses epistemic uncertainty as a novelty detector. If ensemble disagreement or MC dropout variance is high, the input is likely unlike anything the model trained on. This catches failure modes that calibration alone misses: the well-calibrated cat-vs-dog classifier that confidently labels a truck as a dog will show high ensemble disagreement on the truck if the ensemble members learned different extrapolation behaviors.',
        'Active learning uses epistemic uncertainty to choose which unlabeled examples to label next. Query the points where the model is most uncertain, label them, retrain -- and the epistemic uncertainty in that region drops. This is the direct operational consequence of epistemic vs. aleatoric separation: querying points with high aleatoric uncertainty wastes labeling budget because more labels cannot reduce noise.',
        'LLM systems apply the same principle as self-consistency: sample the same prompt multiple times, measure agreement across responses. High agreement suggests the model has a stable answer; low agreement suggests the model is uncertain. This is MC dropout\'s committee wearing a chat interface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MC dropout variance is not a calibrated confidence interval. It is a useful heuristic that correlates with epistemic uncertainty under certain assumptions (the network must have dropout layers, the dropout rate matters, and the approximation quality depends on architecture). For architectures without dropout (e.g., transformers using layer norm but no dropout), MC dropout is not directly applicable.',
        'Deep ensembles are expensive and still have failure modes. If all M models converge to the same region of function space (which happens on very large datasets), ensemble diversity collapses and epistemic uncertainty is underestimated. Adversarial examples can also fool ensembles: Carlini and Wagner (2017) showed that adversarial inputs can be crafted to produce low ensemble disagreement while being far from the training distribution.',
        'Conformal prediction guarantees coverage only under exchangeability -- the calibration set and test data must come from the same distribution. Under distribution shift, the guarantee breaks. Adaptive conformal methods (Gibbs and Candes, 2021) partially address this but add complexity.',
        {
          type: 'note',
          text: 'High uncertainty is not a failure of the model -- it is often the correct output. A model that says "I do not know" about an input it has never seen is more trustworthy than one that guesses. The failure is when uncertainty is high but the system ignores it and acts as if the prediction were confident.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Gal and Ghahramani, "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning" (ICML 2016) -- the foundational paper connecting dropout to approximate Bayesian inference.',
            'Lakshminarayanan, Pritzel, and Blundell, "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles" (NeurIPS 2017) -- introduced deep ensembles as a practical uncertainty method that outperforms MC dropout on most benchmarks.',
            'Guo et al., "On Calibration of Modern Neural Networks" (ICML 2017) -- showed that modern networks are miscalibrated and that temperature scaling is a simple fix for in-distribution calibration.',
            'Vovk, Gammerman, and Shafer, "Algorithmic Learning in a Random World" (2005) -- the foundational text on conformal prediction and distribution-free coverage guarantees.',
          ],
        },
        'Prerequisite: study Dropout (the regularizer this repurposes) and Calibration & Reliability Diagrams (the in-distribution gauge that uncertainty complements). Extension: study Conformal Prediction for guaranteed coverage sets and Bayesian Neural Networks for the full posterior treatment. Contrast: study Temperature Scaling to see what calibration alone can and cannot do.',
        'For production: study Selective Prediction and Abstention Policies to wire uncertainty into decisions. Study Thompson Sampling and Multi-Armed Bandits to see the positive use of uncertainty -- explore when unsure, exploit when confident. Study Adversarial Examples & FGSM to understand why uncertainty detectors can be fooled.',
        'The useful deployment pattern is a dashboard with two gauges: one for whether a familiar score is calibrated (ECE, reliability diagrams) and one for whether the input is familiar enough to score at all (ensemble disagreement, MC dropout variance, OOD detection). Uncertainty is useful only when it changes behavior.',
      ],
    },
  ],
};
