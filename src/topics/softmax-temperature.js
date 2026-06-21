// Softmax and temperature: how an LLM turns raw scores into a probability
// distribution, and what the "temperature" knob actually does to it.

import { matrixState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'softmax-temperature',
  title: 'Softmax & Temperature',
  category: 'AI & ML',
  summary: 'How raw model scores become probabilities — and how temperature reshapes them from greedy to creative.',
  controls: [
    { id: 'logits', label: 'Logits for the candidates', type: 'number-list', defaultValue: '2.0, 1.0, 0.2, -0.5, 1.5' },
  ],
  run,
};

// The model is predicting the next word of: "The cute little ___"
const CANDIDATES = ['puppy', 'kitten', 'robot', 'cloud', 'banana'];

const softmax = (xs) => {
  const peak = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - peak));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / total);
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function* run(input) {
  const logits = parseNumberList(input.logits, { min: 5, max: 5, label: 'logits' });
  const columns = CANDIDATES.map((word, i) => ({ id: `w${i}`, label: word }));

  yield {
    state: matrixState({
      title: 'Raw logits — the model\'s un-normalized scores',
      rows: [{ id: 'logits', label: 'logits' }],
      columns,
      values: [logits],
    }),
    highlight: {},
    explanation: 'A language model finishing "The cute little ___" doesn\'t output a word — it outputs a raw SCORE (a logit) for every candidate. Bigger means more plausible, but these aren\'t probabilities: they can be negative, and they don\'t sum to anything meaningful. Softmax fixes that.',
  };

  const base = softmax(logits);
  const argmax = base.indexOf(Math.max(...base));
  yield {
    state: matrixState({
      title: 'softmax(logits) — now a probability distribution',
      rows: [{ id: 't1', label: 'T = 1' }],
      columns,
      values: [base],
      format: pct,
    }),
    highlight: { active: [`w${argmax}`] },
    explanation: `Softmax exponentiates every logit and divides by the total: every value becomes positive, and the row sums to exactly 100%. "${CANDIDATES[argmax]}" leads at ${pct(base[argmax])}. Now the model can SAMPLE — roll a weighted die — instead of robotically picking the max.`,
    invariant: 'Softmax output always sums to 100%, whatever the logits are.',
  };

  const temps = [
    { t: 0.5, note: (p) => `Dividing logits by T=0.5 DOUBLES them before softmax — gaps between scores get amplified, so the distribution SHARPENS: "${CANDIDATES[argmax]}" jumps to ${pct(p[argmax])}. Low temperature → confident, repetitive, almost-greedy output. Good for code and facts.` },
    { t: 2.0, note: (p) => `Dividing by T=2 HALVES the logits — differences shrink, the distribution FLATTENS, and longshots like "banana" become live options (${pct(p[4])}). High temperature → diverse, surprising, riskier output. Good for brainstorming, dangerous for facts.` },
  ];

  const rows = [{ id: 't1', label: 'T = 1' }];
  const values = [base];
  for (const { t, note } of temps) {
    const probs = softmax(logits.map((x) => x / t));
    rows.push({ id: `t${String(t).replace('.', '_')}`, label: `T = ${t}` });
    values.push(probs);
    yield {
      state: matrixState({
        title: 'softmax(logits / T) at different temperatures',
        rows: rows.map((r) => ({ ...r })),
        columns,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [rows[rows.length - 1].id] },
      explanation: note(probs),
    };
  }

  yield {
    state: matrixState({
      title: 'softmax(logits / T) at different temperatures',
      rows: rows.map((r) => ({ ...r })),
      columns,
      values: values.map((v) => [...v]),
      format: pct,
    }),
    highlight: {},
    explanation: 'Same model, same logits — three different personalities, controlled by one number. The "temperature" slider in every LLM API and playground is EXACTLY this division. T→0 collapses to always-pick-the-max (greedy decoding); T=1 is the model\'s honest distribution; higher T trades reliability for variety. Softmax also appears inside the attention mechanism — same equation, same row-sums-to-100% guarantee.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first frame shows raw logits -- the model\'s un-normalized scores for five candidate words completing "The cute little ___." Each subsequent frame divides those same logits by a different temperature T and applies softmax, producing a new row of probabilities. The highlighted row is the one just computed; earlier rows remain for side-by-side comparison.',
        {type: 'callout', text: 'Temperature scales logit gaps before exponentiation, so it changes confidence without changing the rank order.'},
        'Watch two things as you step through. First, the percentage values: at T=1 the model\'s preferences pass through directly; at T=0.5 the winner\'s share jumps because halving T doubles the logit gaps before exponentiation; at T=2 the gaps halve and probability leaks toward weaker candidates. Second, the ranking: it never changes. If candidate A has a higher logit than candidate B, A keeps a higher probability at every positive temperature. Temperature controls concentration, not preference.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A neural network finishing a classification or next-token prediction produces one raw score per candidate. These scores are called logits. They can be negative, arbitrarily large, and they do not sum to anything meaningful. A model that scores "puppy" at 2.0, "kitten" at 1.0, and "banana" at -0.5 has expressed a preference ordering, but you cannot sample from it or interpret the numbers as confidence.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Softmax usually sits at the end of a network, converting final logits into a usable distribution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'Softmax converts that raw score vector into a probability distribution: every value becomes positive, and the values sum to exactly 1. A classifier can report the top probability as its prediction. A language model can roll a weighted die over the vocabulary. An attention layer can use row-wise softmax to weight key-value pairs for each query.',
        'The name "softmax" comes from statistical mechanics. The Boltzmann distribution gives the probability of a system occupying energy state E_i at temperature T as proportional to exp(-E_i / kT). Softmax is the same equation with logits replacing negative energies. Bridle (1990) brought it into neural networks as the canonical output activation for classifiers, and the sharpness parameter inherited the name "temperature" from physics rather than being called "scale" or "gain."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest way to turn scores into fractions is linear normalization: divide each score by the sum. For logits [2.0, 1.0, 0.1], the sum is 3.1, giving [0.645, 0.323, 0.032]. That works until a logit is negative. Scores [-1.0, 2.0, 0.5] sum to 1.5, and -1.0 / 1.5 = -0.667, which is not a probability.',
        'Even when all logits happen to be positive, linear normalization treats equal additive gaps as equal confidence gaps. A 10-point lead over a 5-point score feels more decisive than a 1-point lead over 0.5, but linear normalization cannot express that difference. It also provides no way to control sharpness -- no temperature knob.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Linear normalization fails on two fronts: it cannot handle negative inputs, and it has no mechanism to control how peaked or flat the output distribution is. Without a sharpness control, the only decoding options are argmax (always pick the top score, losing all diversity) or raw sampling from the linear fractions (which cannot be tuned between greedy and exploratory).',
        'Language generation needs something in between. Always picking the maximum makes text repetitive and brittle. Sampling with no sharpness control means the system cannot distinguish "confident factual answer" from "creative brainstorming" -- both get the same distribution shape. The wall is the need for a function that (a) maps any real-valued vector to a valid probability distribution and (b) exposes a single knob to move continuously between deterministic and uniform.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Softmax with temperature computes: softmax(z_i / T) = exp(z_i / T) / sum_j(exp(z_j / T)). Three things happen in sequence. First, every logit is divided by temperature T (at T=1 this is a no-op). Second, exponentiation maps each scaled logit to a positive number -- exp(x) > 0 for all real x, so negatives are handled. Third, dividing by the sum of all exponentials forces the outputs to sum to 1.',
        'Exponentiation turns additive logit gaps into multiplicative odds. A 1-point logit advantage means about e^1 = 2.72 times the unnormalized weight. A 2-point advantage means e^2 = 7.39 times. A 5-point advantage means e^5 = 148 times. Small-looking logit differences create large probability gaps.',
        'Temperature scales those gaps before exponentiation amplifies them. At T=0.5, dividing by T doubles every gap: a 1-point advantage becomes 2 points, producing 7.4x the unnormalized weight instead of 2.7x. The winner dominates and sampling approaches greedy decoding. At T=2, dividing halves the gaps: a 1-point advantage shrinks to 0.5 points, and the distribution flattens toward uniform. T approaching 0 collapses to argmax. T approaching infinity pushes toward equal probabilities for all candidates.',
        'The max-subtraction trick is required for numerical safety. Before exponentiating, subtract the maximum logit from every element: compute exp(z_i - max(z)) instead of exp(z_i). The largest exponent becomes exp(0) = 1, and every other exponent is safely below 1. Without this, logits like 1000 produce exp(1000) which overflows to infinity. The trick changes nothing mathematically because the subtracted constant cancels between numerator and denominator: exp(z_i - c) / sum(exp(z_j - c)) = exp(z_i) / sum(exp(z_j)). Every production implementation does this.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Two invariants hold unconditionally. First, every output is positive because exp(x) > 0 for all real x. Second, the outputs sum to 1 because the denominator is the sum of the same exponentials that appear in the numerators. These two properties make the output a valid probability distribution for any real-valued input, no exceptions.',
        'Ranking is preserved for all positive temperatures. If z_a > z_b, then z_a/T > z_b/T for any T > 0, so exp(z_a/T) > exp(z_b/T), so p_a > p_b after normalization. Temperature cannot swap the ordering -- it can only control how much probability mass separates adjacent ranks.',
        'Shift invariance follows from algebra: exp(z_i + c) / sum(exp(z_j + c)) = exp(c) * exp(z_i) / (exp(c) * sum(exp(z_j))) = exp(z_i) / sum(exp(z_j)). The constant cancels. This is why softmax([102, 101, 100]) produces the same result as softmax([2, 1, 0]), and why the max-subtraction trick is safe.',
        'The gradient has a clean form: d(softmax_i)/d(z_j) = softmax_i * (delta_ij - softmax_j), where delta_ij is 1 when i=j and 0 otherwise. Paired with cross-entropy loss, the combined gradient simplifies to (predicted probability - target), which is why softmax + cross-entropy dominates classification training: the gradient is just the error.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Softmax is O(C) for C candidates: one pass to find the max, one pass to exponentiate shifted values and accumulate the sum, one pass to divide. Temperature adds one scalar division per logit, also O(C). For a language model\'s final layer, C is the vocabulary size -- typically 32k to 128k tokens. That linear scan is negligible next to the transformer forward pass. Doubling the vocabulary doubles the softmax cost but barely changes total inference time.',
        'Inside attention, softmax is applied per query over all keys. The cost is absorbed into the O(n_seq^2 * d) attention budget. Flash attention fuses softmax into a single memory-efficient kernel, computing log-sum-exp incrementally so the full score matrix never materializes in HBM. The arithmetic is the same; the memory behavior drops from O(n_seq^2) to O(n_seq).',
        'Numerically, the only real concern is the max-subtraction trick. Skip it and large logits overflow float32/float64. With it, the largest exponent is 1 and everything works. The cost of finding the max is one extra pass -- negligible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Neural network output layer: every classifier (image, text, medical, spam) ends with softmax over class logits. The argmax is the predicted label; the full distribution provides confidence signals for downstream decisions.',
        'Attention weights: every transformer layer applies softmax row-wise over query-key dot products. Scaled dot-product attention divides by sqrt(d_k) before softmax -- this acts as an implicit temperature, preventing the dot products from growing large enough to push softmax into near-argmax territory as embedding dimension increases.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with softmax between scores and weighted values', caption: 'Attention uses the same normalization idea row by row: scores become weights before values are mixed. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'Language model decoding: the "temperature" slider in every LLM API is exactly softmax(logits/T). T near 0 for deterministic code completion and factual extraction. T = 0.7-1.0 for conversational fluency. T > 1 for brainstorming. The knob controls output personality without retraining.',
        'Knowledge distillation (Hinton et al., 2015): a teacher model produces soft targets at high temperature (T = 5 to 20), revealing which wrong answers it considers close to right -- "dark knowledge." A student network trains to match these soft targets, learning richer structure than hard argmax labels provide.',
        'Reinforcement learning (Boltzmann exploration): an agent selects actions by sampling from softmax(Q-values / T). Low T exploits learned values; high T explores uncertain actions. Temperature annealing -- starting high and decreasing -- balances exploration and exploitation over training.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Overconfident predictions: softmax probabilities are not calibrated confidence. A classifier can output 99% and be wrong far more often than 1% of the time. Temperature scaling (fitting a single T on a validation set to improve calibration) helps, but it is a post-hoc patch. Low generation temperature does not make an answer more trustworthy -- it makes the model more likely to commit to its favorite continuation, including hallucinated ones.',
        'Large vocabularies: for vocabulary sizes in the hundreds of thousands, the linear softmax pass becomes noticeable. Hierarchical softmax (decomposing the vocabulary into a tree) and sampled softmax (approximating the denominator with a subset) reduce this cost during training. At inference, top-k or nucleus filtering avoids computing probabilities for the entire vocabulary tail.',
        'Multi-label problems: softmax forces outputs to compete -- raising one probability lowers others. When multiple labels can be simultaneously correct (an image containing both a cat and a dog), independent sigmoids per label are the right tool. Softmax is for mutually exclusive classification.',
        'Temperature cannot fix bad logits. If the model assigns the highest score to a false claim, lowering T makes the false claim more stable. Raising T may surface alternatives, but it spreads mass to all candidates, not just correct ones. Practical systems combine temperature with top-k filtering, nucleus sampling, repetition penalties, constrained decoding, and post-generation judges. Temperature is one knob in a pipeline.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Logits: [2.0, 1.0, 0.1] for three classes.',
        'T = 1 (standard softmax): subtract max (2.0) for stability, giving [0, -1.0, -1.9]. Exponentiate: [1.000, 0.368, 0.150]. Sum = 1.518. Divide: [0.659, 0.242, 0.099]. Class 0 leads at 65.9%, class 1 is a distant second at 24.2%, class 2 has under 10%. The ranking matches the logit ranking, and the probabilities sum to 1.',
        'T = 0.5 (sharper): divide logits by 0.5 first, giving [4.0, 2.0, 0.2]. Subtract max (4.0): [0, -2.0, -3.8]. Exponentiate: [1.000, 0.135, 0.022]. Sum = 1.157. Probabilities: [0.864, 0.117, 0.019]. Class 0 jumps from 65.9% to 86.4%. Class 2 drops from 9.9% to 1.9%, nearly eliminated. Halving T doubled the logit gaps, so the dominant class absorbed almost all the mass. This is approaching argmax.',
        'T = 2.0 (flatter): divide logits by 2, giving [1.0, 0.5, 0.05]. Subtract max (1.0): [0, -0.5, -0.95]. Exponentiate: [1.000, 0.607, 0.387]. Sum = 1.994. Probabilities: [0.501, 0.304, 0.194]. Class 0 dropped from 65.9% to 50.1%. Class 2 rose from 9.9% to 19.4%. All three classes are live sampling options. Uniform would be 33.3% each -- doubling T pushed the distribution halfway there. The ranking never changed across any temperature; only the concentration of mass.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Boltzmann (1868): the Boltzmann distribution in statistical mechanics, where probability of energy state E at temperature T is proportional to exp(-E/kT). Bridle (1990), "Probabilistic Interpretation of Feedforward Classification Network Outputs": introduced softmax as the canonical neural network output activation. Hinton, Vinyals, and Dean (2015), "Distilling the Knowledge in a Neural Network": high-temperature softmax for knowledge distillation.',
        'Cross-entropy loss: softmax\'s training partner. The combined gradient simplifies to (predicted - target), which is why this pairing dominates classification and language modeling.',
        'Attention mechanism: softmax applied row-wise over query-key dot products inside every transformer layer. The 1/sqrt(d_k) scaling is an implicit temperature -- understanding softmax temperature explains why attention heads sometimes sharpen to near-argmax and sometimes diffuse broadly.',
        'Knowledge distillation: temperature as a training technique rather than a decoding knob. Temperature scaling: fitting one T on a validation set for probability calibration (Guo et al., 2017).',
        'Activation functions: sigmoid, ReLU, and tanh shape signals inside a network; softmax is reserved for the final layer where a full probability distribution is needed. With two classes, softmax reduces to sigmoid.',
      ],
    },
  ],
};
