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
  const r2 = (v) => Math.round(v * 100) / 100;
  const r4 = (v) => Math.round(v * 10000) / 10000;

  const logitMax = Math.max(...logits);
  const logitMin = Math.min(...logits);
  const topIdx = logits.indexOf(logitMax);
  const botIdx = logits.indexOf(logitMin);
  yield {
    state: matrixState({
      title: 'Raw logits — the model\'s un-normalized scores',
      rows: [{ id: 'logits', label: 'logits' }],
      columns,
      values: [logits],
    }),
    highlight: { active: [`w${topIdx}`] },
    explanation: `A language model finishing "The cute little ___" outputs a raw SCORE (a logit) for every candidate: ${CANDIDATES.map((c, i) => `"${c}" = ${r2(logits[i])}`).join(', ')}. "${CANDIDATES[topIdx]}" leads at ${r2(logitMax)}, "${CANDIDATES[botIdx]}" trails at ${r2(logitMin)} — a gap of ${r2(logitMax - logitMin)}. But these aren't probabilities: they can be negative, and their sum (${r2(logits.reduce((a, b) => a + b, 0))}) is meaningless. Softmax fixes that.`,
  };

  // Show the exponentiation step explicitly
  const shifted = logits.map((x) => x - logitMax);
  const exps = shifted.map((x) => Math.exp(x));
  const expSum = exps.reduce((a, b) => a + b, 0);
  yield {
    state: matrixState({
      title: 'exp(logit - max) — exponentiation step',
      rows: [{ id: 'exps', label: 'exp(z-max)' }],
      columns,
      values: [exps],
    }),
    highlight: {},
    explanation: `First, subtract the max (${r2(logitMax)}) for numerical safety: shifted logits = [${shifted.map(r2).join(', ')}]. Then exponentiate: ${CANDIDATES.map((c, i) => `exp(${r2(shifted[i])}) = ${r4(exps[i])}`).join(', ')}. All values are now positive. Their sum = ${r2(expSum)} — dividing each by this sum gives us probabilities.`,
    invariant: `Subtracting the max changes nothing mathematically — the constant cancels in the ratio — but prevents overflow for large logits.`,
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
    explanation: `Dividing each exp by ${r2(expSum)}: ${CANDIDATES.map((c, i) => `"${c}" = ${r4(exps[i])}/${r2(expSum)} = ${pct(base[i])}`).join(', ')}. "${CANDIDATES[argmax]}" leads at ${pct(base[argmax])}. Every value is positive and the row sums to exactly 100%. Now the model can SAMPLE — roll a weighted die — instead of robotically picking the max.`,
    invariant: 'Softmax output always sums to 100%, whatever the logits are.',
  };

  // Entropy at T=1
  const entropy1 = -base.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const maxEntropy = Math.log2(CANDIDATES.length);
  yield {
    state: matrixState({
      title: 'Entropy of the T=1 distribution',
      rows: [{ id: 't1', label: 'T = 1' }],
      columns,
      values: [base],
      format: pct,
    }),
    highlight: {},
    explanation: `How "spread out" is this distribution? Shannon entropy = -sum(p * log2(p)) = ${r2(entropy1)} bits. Maximum possible entropy for ${CANDIDATES.length} candidates is log2(${CANDIDATES.length}) = ${r2(maxEntropy)} bits (uniform distribution). Ratio: ${r2(entropy1)}/${r2(maxEntropy)} = ${Math.round((entropy1 / maxEntropy) * 100)}% of maximum — the distribution is ${entropy1 / maxEntropy < 0.5 ? 'fairly concentrated' : entropy1 / maxEntropy < 0.8 ? 'moderately spread' : 'quite spread out'}. Temperature reshapes this.`,
  };

  const temps = [
    { t: 0.5 },
    { t: 2.0 },
    { t: 0.1 },
  ];

  const rows = [{ id: 't1', label: 'T = 1' }];
  const values = [base];
  for (const { t } of temps) {
    const scaled = logits.map((x) => x / t);
    const probs = softmax(scaled);
    const probArgmax = probs.indexOf(Math.max(...probs));
    const entropy = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
    rows.push({ id: `t${String(t).replace('.', '_')}`, label: `T = ${t}` });
    values.push(probs);

    let tempNote;
    if (t < 1) {
      tempNote = `Dividing logits by T=${t} ${t === 0.5 ? 'DOUBLES' : `multiplies by ${r2(1 / t)}x`} them: scaled = [${scaled.map(r2).join(', ')}]. The gap between "${CANDIDATES[topIdx]}" and "${CANDIDATES[botIdx]}" widens from ${r2(logitMax - logitMin)} to ${r2(scaled[topIdx] - scaled[botIdx])}. Result: "${CANDIDATES[probArgmax]}" dominates at ${pct(probs[probArgmax])}, entropy drops to ${r2(entropy)} bits (${Math.round((entropy / maxEntropy) * 100)}% of max). ${t <= 0.1 ? 'Nearly greedy — the model always picks its favorite.' : 'Low temperature = confident, repetitive, almost-greedy output.'}`;
    } else {
      tempNote = `Dividing by T=${t} HALVES the logits: scaled = [${scaled.map(r2).join(', ')}]. The gap shrinks from ${r2(logitMax - logitMin)} to ${r2(scaled[topIdx] - scaled[botIdx])}. Now "${CANDIDATES[botIdx]}" rises to ${pct(probs[botIdx])} — a live option. Entropy climbs to ${r2(entropy)} bits (${Math.round((entropy / maxEntropy) * 100)}% of max). High temperature = diverse, surprising, riskier output.`;
    }

    yield {
      state: matrixState({
        title: 'softmax(logits / T) at different temperatures',
        rows: rows.map((r) => ({ ...r })),
        columns,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [rows[rows.length - 1].id] },
      explanation: tempNote,
    };
  }

  // Show all temperatures side by side with entropy comparison
  const allEntropies = values.map((probs) => -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0));
  yield {
    state: matrixState({
      title: 'softmax(logits / T) at different temperatures',
      rows: rows.map((r) => ({ ...r })),
      columns,
      values: values.map((v) => [...v]),
      format: pct,
    }),
    highlight: {},
    explanation: `Same logits [${logits.map(r2).join(', ')}], four temperatures, four personalities. Entropy: ${rows.map((r, i) => `${r.label} = ${r2(allEntropies[i])} bits`).join(', ')}. The "temperature" slider in every LLM API is EXACTLY this division. T->0 collapses to argmax (greedy); T=1 is the model's honest distribution; higher T trades reliability for variety. Same equation powers attention's softmax too — same row-sums-to-100% guarantee.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The top row shows logits, which are raw model scores before they are probabilities. Each later row divides the same logits by a temperature T and applies softmax, the function that turns real-valued scores into positive values that sum to 1.',
        {type: 'callout', text: 'Temperature scales logit gaps before exponentiation, so it changes confidence without changing the rank order.'},
        'The active row is the distribution just computed. Compare the percentages across rows, not only the largest label. The safe rule is that positive temperature changes concentration, not rank order.',
        {type: 'image', src: './assets/gifs/softmax-temperature.gif', alt: 'Animated walkthrough of the softmax temperature visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A classifier or language model often ends with one score per class or token. Those scores can be negative and do not sum to anything useful, so they cannot be sampled as probabilities.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Softmax usually sits at the end of a network, converting final logits into a usable distribution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'Softmax converts logits into a probability distribution. Temperature adds a scale knob before that conversion, so one model can behave more greedily or more diffusely at decoding time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is linear normalization: divide each score by the sum. Scores [2, 1, 0.5] sum to 3.5, giving fractions about [0.571, 0.286, 0.143].',
        'That fails for ordinary logits. Scores [-1, 2, 0.5] include a negative value, so linear normalization can produce a negative probability. It also has no clean knob for sharpness.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that raw scores are not probabilities. They can be any real numbers, and adding the same constant to every score should not change the model preference.',
        'Generation also needs controlled uncertainty. Deterministic extraction, ordinary chat, and brainstorming should not use the same distribution shape. The score-to-probability function needs a stable concentration control.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Exponentiation turns score gaps into odds ratios. A logit advantage of 1 gives about exp(1) = 2.718 times the unnormalized weight, while an advantage of 2 gives about exp(2) = 7.389 times.',
        'Temperature changes the gap before exponentiation. T = 0.5 doubles gaps and sharpens the winner; T = 2 halves gaps and leaves more mass on weaker candidates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Softmax with temperature computes p_i = exp(z_i / T) / sum_j exp(z_j / T), where z_i is one logit and T is positive. Exponentiation makes every numerator positive, and division by the total makes the outputs sum to 1.',
        'Production code subtracts the maximum scaled logit before exponentiation. The largest exponent becomes exp(0) = 1, which avoids overflow. The subtraction changes nothing because the same factor cancels from numerator and denominator.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The output is a valid distribution because every exp(x) is positive and the denominator is the sum of the same positive terms. Dividing every term by that sum makes the total exactly 1, apart from floating-point rounding.',
        'Rank order is preserved for positive T. If z_a > z_b, then z_a / T > z_b / T, so exp(z_a / T) > exp(z_b / T). Normalization divides both by the same positive denominator.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For C candidates, softmax is O(C): find the max, compute exponentials and their sum, then divide by the sum. Doubling the vocabulary roughly doubles this final normalization work.',
        'In a language model, C may be 32,000 to 128,000 tokens, but the transformer forward pass usually dominates. Inside attention, softmax is applied row by row, and kernels such as FlashAttention fuse it to improve memory behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Classification uses softmax to turn class logits into a distribution. The top probability gives a label, while the full distribution supports thresholds, ranking, and calibration checks.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with softmax between scores and weighted values', caption: 'Attention uses the same normalization idea row by row: scores become weights before values are mixed. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'Language-model decoding uses temperature to tune sampling. Knowledge distillation uses high-temperature teacher outputs so a smaller model can learn which wrong answers were close to right.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Softmax probability is not guaranteed calibration. A model can output 99 percent and still be wrong more often than 1 percent on real data.',
        'Temperature cannot repair bad logits. If the highest score is a false claim, lowering T makes that false claim more stable. Practical decoders combine temperature with filtering, constraints, penalties, or verification.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use logits [2.0, 1.0, 0.1]. At T = 1, subtract max 2.0 to get [0, -1.0, -1.9]. Exponentials are [1.000, 0.368, 0.150], sum = 1.518, so probabilities are [0.659, 0.242, 0.099].',
        'At T = 0.5, scaled logits are [4.0, 2.0, 0.2]. After subtracting 4.0, exponentials are [1.000, 0.135, 0.022], sum = 1.157, and probabilities are [0.864, 0.117, 0.019].',
        'At T = 2, scaled logits are [1.0, 0.5, 0.05]. After subtracting 1.0, exponentials are [1.000, 0.607, 0.387], sum = 1.994, and probabilities are [0.501, 0.304, 0.194]. The rank order stayed the same.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Bridle on probabilistic neural-network outputs, Hinton, Vinyals, and Dean on knowledge distillation, Guo et al. on calibration by temperature scaling, and the Transformer paper for attention softmax.',
        'Next study Cross-Entropy Loss, Activation Functions, Attention, Calibration Curves, Knowledge Distillation, Constrained Decoding, and FlashAttention.',
      ],
    },
  ],
};
