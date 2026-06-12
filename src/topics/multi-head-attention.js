// Multi-head attention: run several attentions side by side, each with its
// own learned projections, each free to track a DIFFERENT relationship —
// then concatenate. Why one attention pattern was never going to be enough.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-head-attention',
  title: 'Multi-Head Attention',
  category: 'AI & ML',
  summary: 'Two heads, two different attention patterns, one concatenated answer — parallel relationship detectors.',
  controls: [
    { id: 'view', label: 'Inspect', type: 'select', options: ['both heads', 'head 1 only', 'head 2 only'], defaultValue: 'both heads' },
  ],
  run,
};

const TOKENS = ['the', 'cat', 'sat', 'here'];

// Attention patterns produced by two heads' learned Wq/Wk projections in a
// trained toy model. Head 1 learned a POSITIONAL habit (look at the previous
// token); head 2 learned a SEMANTIC one (find the noun). Each row sums to 1.
const HEAD1 = [
  [0.88, 0.04, 0.04, 0.04],
  [0.80, 0.10, 0.05, 0.05],
  [0.06, 0.80, 0.08, 0.06],
  [0.05, 0.07, 0.80, 0.08],
];
const HEAD2 = [
  [0.10, 0.74, 0.08, 0.08],
  [0.06, 0.80, 0.07, 0.07],
  [0.07, 0.78, 0.08, 0.07],
  [0.08, 0.72, 0.10, 0.10],
];

// Each head has its own 2-dimensional value space (4 dims split across 2 heads).
function valueVector(word, headIndex) {
  return Array.from({ length: 2 }, (_, j) => {
    let h = j + 3 * (headIndex + 1);
    for (let i = 0; i < word.length; i += 1) h = (h * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    return (h / 1009) * 2 - 1;
  });
}

const pct = (v) => `${Math.round(v * 100)}%`;
const rows = TOKENS.map((t, i) => ({ id: `q${i}`, label: t }));
const cols = TOKENS.map((t, i) => ({ id: `k${i}`, label: t }));

export function* run(input) {
  const view = String(input.view);
  if (!['both heads', 'head 1 only', 'head 2 only'].includes(view)) throw new InputError('Pick a view.');

  yield {
    state: matrixState({ title: 'One head = one pattern = one kind of relationship', rows, columns: cols, values: HEAD1, format: pct }),
    highlight: {},
    explanation: 'The Attention Mechanism produces ONE pattern: one matrix of who-looks-at-whom. But "the cat sat here" carries several relationships at once — word order, subject-ness, adjacency — and a single softmax can only express one mixture. The fix is almost comically direct: run SEVERAL attentions in parallel, each with its own learned Wq/Wk/Wv, and let each specialize. Each parallel copy is called a HEAD.',
  };

  if (view !== 'head 2 only') {
    yield {
      state: matrixState({ title: 'Head 1: a positional specialist', rows, columns: cols, values: HEAD1, format: pct }),
      highlight: { active: ['q2:k1', 'q3:k2'] },
      explanation: 'Head 1\'s projections learned a POSITIONAL habit: read the rows — "sat" puts 80% of its attention on "cat", "here" on "sat": almost every token looks at its PREDECESSOR. Heads like this really exist in trained models (they help copy and continue sequences — the famous "induction heads" are their sophisticated cousins).',
      invariant: 'Each head\'s rows are a softmax: every row sums to 100%.',
    };
  }

  if (view !== 'head 1 only') {
    yield {
      state: matrixState({ title: 'Head 2: a semantic specialist', rows, columns: cols, values: HEAD2, format: pct }),
      highlight: { active: ['q0:k1', 'q2:k1', 'q3:k1'] },
      explanation: 'Head 2, SAME tokens, completely different worldview: every row pours its attention onto "cat" — this head learned to find the NOUN, the thing the sentence is about. Same input, same mechanism, different learned projections → different relationship extracted. Neither head is wrong; they answer different questions simultaneously.',
    };
  }

  const out1 = HEAD1.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 0)[d], 0)));
  const out2 = HEAD2.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 1)[d], 0)));
  const concat = TOKENS.map((_, i) => [...out1[i], ...out2[i]]);
  const dimCols = ['h1·d0', 'h1·d1', 'h2·d0', 'h2·d1'].map((label, j) => ({ id: `d${j}`, label }));

  yield {
    state: matrixState({ title: 'Concatenate: each head contributes its slice of the output', rows, columns: dimCols, values: concat }),
    highlight: { active: ['q2:d0', 'q2:d1'], compare: ['q2:d2', 'q2:d3'] },
    explanation: 'Each head computes its weighted mix of (its own) value vectors — real arithmetic on the patterns you just saw — and the outputs are CONCATENATED side by side: head 1 fills the first dimensions, head 2 the rest. Look at "sat"\'s row: its left half encodes "what came before me" (head 1), its right half "the noun I relate to" (head 2). One final learned matrix (W_O) then blends the slices. The accounting trick: each head works in dims/heads dimensions, so 8 heads cost the SAME total compute as one full-width head — diversity is free.',
  };

  yield {
    state: matrixState({ title: 'Scale: 96 heads × 96 layers', rows, columns: dimCols, values: concat }),
    highlight: {},
    explanation: 'GPT-3 runs 96 heads in every one of its 96 layers — nine thousand specialists. Interpretability researchers have found heads that track syntax, coreference ("her" → who?), induction (repeat what followed last time), even rare-token detectors; pruning studies show many heads are redundant (an ensemble\'s redundancy — compare Random Forest). Multi-head is the production form of attention: The Transformer Block you\'ve seen uses exactly this in its first sublayer, served by the KV Cache per head.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Multi-head attention runs several independent attention mechanisms in parallel, each with its own learned projection matrices Wq, Wk, Wv. Instead of one pattern describing all relationships in a sentence, you get multiple patterns from the same input — think of it as a small ensemble. The outputs are concatenated and blended through a final learned matrix W_O. You saw this directly: Head 1 focused on position (every token looks at its predecessor), while Head 2 found semantics (every token looks at the noun). Same input, completely different outputs, same architecture.`,
        `This feels wasteful at first — why not just make attention wider? The genius is that each head operates in lower dimensions (total dims divided by number of heads), so a 96-head model with 96 dimensions per head costs the same compute as one 96-dimensional head, but captures 96 different relationship types simultaneously. Redundancy emerges naturally: some heads specialize, others duplicate — that's fine. The architecture lets diversity emerge without forcing it.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each head independently computes the standard attention pattern: Qi = Wq·Xi, Ki = Wk·Xi, Vi = Wv·Xi, then softmax(Qi · Ki^T / sqrt(d_head)) · Vi. The only difference is that Wq, Wk, Wv are head-specific and project into a smaller space (dims/heads dimensions). All heads run simultaneously because they don't interact until the end.`,
        `Once each head has produced its weighted value vectors, you concatenate them side by side (token 1 gets [head_1_output || head_2_output || ... || head_n_output], token 2 gets its own concatenation, and so on). This concatenated tensor is then multiplied by W_O, a learned matrix that can blend the heads — one head's position-tracking output might be scaled down or up relative to another. W_O decides which heads' signals matter most for downstream layers. The beauty is that each head is free to ignore W_O's blending; some heads become specialized while others stay general-purpose.`,
        `The math ensures efficiency: if you have 96 heads and 96 dimensions total, each head works in 1 dimension internally. Modern hardware loves this because matrix operations parallelize across heads trivially — GPUs can run all 96 heads in one batch operation, then concatenate the results.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Multi-head has no asymptotic cost advantage over a single wider attention head — they both compute softmax(Q·K^T)·V. The total floating-point operations stay identical; you're just distributing the work across heads instead of putting it in one. The trade-off is architectural clarity: more parameters are trained (you now have separate Wq, Wk, Wv, W_O for each head), and hardware must parallelize effectively to avoid slowdown. In practice, modern GPUs handle this perfectly — a 96-head model often runs faster than you'd naively expect because parallelization is so efficient.`,
        `Memory scales linearly: each head's attention pattern is a separate matrix you store (especially important for KV Cache in inference). For a sequence of length N with H heads, the memory footprint is H · N^2 for the attention weights. This is why long-context models struggle: attention memory grows quadratically with sequence length, and multiple heads make it worse proportionally.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `GPT-3 uses 96 heads in every layer of its 96 layers. Other models adjust the ratio: GPT-4 uses fewer, deeper layers with more heads per layer. BERT uses 12 heads over 12 layers, a much lighter design for task-specific finetuning. The pattern is universal: any serious transformer uses multi-head attention. Even single-head models (purely educational) are rare in production.`,
        `Interpretability research has decoded what real heads do: some track syntax (grammatical structure), others find coreference ("her" resolving to the right noun), others implement induction (when I saw "X Y" before, I'll look for "Y" after "X" again). The most famous are induction heads, discovered in 2021 — heads that implement a simple copying algorithm (use attention to find a prior instance of your current token, then look at what followed it). This wasn't explicitly trained; it emerged because it was useful. Researchers also found that pruning redundant heads barely hurts performance, confirming the ensemble theory: many heads are insurance, not essential.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Myth: more heads are always better. Reality: you hit diminishing returns fast. Beyond a certain point (often 8-16 heads for small models), adding heads doesn't improve performance; you're just training more redundant specialists. This shows up in pruning: if you randomly disable 50% of heads in a trained model, performance drops only slightly. It's similar to overfitting in ensemble learning — too many weak learners stop improving the final answer.`,
        `Pitfall: assuming each head does one clear job. In practice, many heads are polysemantic (they do multiple things) or almostalmost inert (they barely participate). Real interpretability is messy. A head's learned Wq, Wk, Wv can look nothing like what it ends up doing when combined with downstream layers — the full picture requires looking at the entire stack, not one head in isolation.`,
        `Misconception: heads are "attention heads." They are not. Each head is an independent weighted average of value vectors, controlled by an independent softmax pattern. The term "attention" is attached to the whole mechanism, not individual heads. Calling them "heads" just means they're parallel copies; "attention" describes what they compute.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Attention Mechanism to see the single-head case that multi-head parallelizes. Then study The Transformer Block, which combines multi-head attention with feedforward layers. If you want to go deeper on speed and inference, KV Cache shows how multi-head attention stores history efficiently. For the big picture on redundancy, Random Forest illustrates the ensemble principle in decision trees — heads often behave like weak learners. Finally, Mixture of Experts (MoE) is the next step: instead of parallel heads with identical compute, use parallel experts with learned routing, so only a few specialists activate per token.`,
      ],
    },
  ],
};

