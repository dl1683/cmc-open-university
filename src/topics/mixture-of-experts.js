// Mixture of Experts: a router sends each token to a few small specialist
// networks instead of one giant one. The model gets huge capacity while
// each token pays for only a sliver of it.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mixture-of-experts',
  title: 'Mixture of Experts (MoE)',
  category: 'AI & ML',
  summary: 'A router picks top-k experts per token — trillion-parameter capacity at small-model compute.',
  controls: [
    { id: 'topk', label: 'Experts per token (k)', type: 'select', options: ['1', '2'], defaultValue: '2' },
  ],
  run,
};

const TOKENS = ['the', 'protein', 'folds', 'quickly'];
const EXPERTS = ['E1', 'E2', 'E3', 'E4'];
// The router's (learned) probabilities: which expert should process each token.
const ROUTER = [
  [0.70, 0.10, 0.12, 0.08],
  [0.05, 0.78, 0.10, 0.07],
  [0.08, 0.30, 0.55, 0.07],
  [0.12, 0.20, 0.18, 0.50],
];

const pct = (v) => `${Math.round(v * 100)}%`;
const rows = TOKENS.map((t, i) => ({ id: `t${i}`, label: t }));
const cols = EXPERTS.map((e, j) => ({ id: `e${j}`, label: e }));

export function* run(input) {
  const k = parseInt(String(input.topk), 10);
  if (![1, 2].includes(k)) throw new InputError('Pick k = 1 or 2.');

  yield {
    state: matrixState({ title: 'The dense way: one giant FFN, every token pays full price', rows, columns: cols, values: ROUTER.map((r) => r.map(() => 1)) , format: () => 'run' }),
    highlight: { active: rows.flatMap((r) => cols.map((c) => `${r.id}:${c.id}`)) },
    explanation: 'Inside a Transformer, after Attention Mechanism comes the feed-forward block (see Neural Network Forward Pass) — usually 2/3 of the parameters. In a DENSE model, EVERY token runs through ALL of it: 4 tokens × the whole network = 16 units of work here. Want a smarter model? Make the FFN bigger — and every token pays more. Capacity and compute are chained together.',
  };

  yield {
    state: matrixState({ title: 'The router\'s scores: which expert suits each token?', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: {},
    explanation: 'MoE breaks the chain: replace the one giant FFN with FOUR smaller expert FFNs plus a tiny ROUTER (a linear layer + softmax — see Softmax & Temperature) that scores each token-expert pairing. Read the rows: the router has learned that "protein" overwhelmingly suits E2, while "the" suits E1. Nobody assigned specialties — they EMERGE from training, and inspecting them is famously fun (experts for punctuation, code, numbers…).',
  };

  const picks = ROUTER.map((row) => row
    .map((v, j) => ({ v, j }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(({ j }) => j));
  const activeCells = picks.flatMap((expertIdxs, i) => expertIdxs.map((j) => `t${i}:e${j}`));

  yield {
    state: matrixState({ title: `Top-${k} routing: only the chosen experts run`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: activeCells },
    explanation: `Each token activates only its TOP-${k} expert${k === 1 ? '' : 's'} — ${activeCells.length} of 16 expert-runs (${pct(activeCells.length / 16)} of the dense cost)${k === 2 ? ', with each token\'s two outputs blended by the router\'s weights' : ''}. The other experts simply don't execute for that token. This is SPARSE ACTIVATION: the parameters exist (capacity!), but each token touches only a sliver (compute!).`,
    invariant: `Per-token compute is fixed at k experts, no matter how many experts exist in total.`,
  };

  yield {
    state: matrixState({ title: 'The failure mode: a collapsed router', rows, columns: cols, values: [[0.05, 0.85, 0.05, 0.05], [0.04, 0.88, 0.04, 0.04], [0.06, 0.84, 0.05, 0.05], [0.05, 0.86, 0.05, 0.04]], format: pct }),
    highlight: { swap: rows.map((r) => `${r.id}:e1`) },
    explanation: 'The classic training hazard: the router collapses, sending EVERYTHING to one expert — E2 overworks (and bottlenecks the batch) while E1, E3, E4 never see gradients and never improve. The fix is an auxiliary LOAD-BALANCING loss that rewards spreading tokens evenly — the Load Balancer\'s least-connections instinct, expressed as a training objective. Every production MoE trains with one.',
  };

  yield {
    state: matrixState({ title: 'Top-2 routing at production scale', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: activeCells },
    explanation: `Now scale the trick: Mixtral 8×7B holds 47B parameters but activates only ~13B per token (top-2 of 8 experts) — a 47B model's knowledge at a 13B model's speed. DeepSeek-V3 runs 256 experts activating 8; GPT-4 was widely reported to be MoE. Add experts and CAPACITY grows while per-token cost stays ~flat — the same conditional-computation bet as a Hash Table: don't touch everything, route to the part that matters. The bill comes as memory (all experts must be loaded) and engineering (balancing, communication) — capacity is never free, it just stops being paid in FLOPs.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Mixture of Experts (MoE) swaps the standard Transformer feed-forward network (FFN) for a learned router plus multiple smaller expert networks. Instead of every token running through one giant FFN (which eats 2/3 of the model's parameters), the router picks the top-k most suitable experts per token and only those experts activate. The model gains massive parameter capacity while each token pays compute only for a handful of experts.`,
        `The router is itself a tiny learned network: a linear projection followed by softmax (see Softmax & Temperature), scoring how well each expert fits each token. Because these scores are differentiable and learned end-to-end, experts develop emergent specializations — one becomes fluent in code, another in punctuation, another in factual retrieval — with zero explicit assignment. This automatic discovery is both fascinating and practical: you get the expertise of a trillion-parameter model using only the active compute of a much smaller one.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Inside each Transformer block, after the attention layer (see Attention Mechanism), sits the MoE layer. The router takes each token's representation and outputs a probability vector over all N experts via softmax. You then select the top-k (usually 2) and route the token's hidden state to those experts in parallel. Each expert is an independent FFN: two learned transformations with an activation function in between (see Neural Network Forward Pass). The expert outputs are blended using the router's softmax probabilities as weights. So if token i has router scores [0.70 for E1, 0.15 for E2, 0.10 for E3, 0.05 for E4] and k=2, the output is 0.70 × E1(token_i) + 0.15 × E2(token_i), and E3 and E4 never execute.`,
        `Training is where things become delicate. A naive router will collapse: it sends everything to one expert (usually the first to be adequately trained), starving the others of gradient updates. Production MoE systems add an auxiliary loss function that penalizes imbalanced token assignment, inspired by load balancer logic (see Load Balancer). This loss encourages the router to spread tokens evenly across experts. Without it, experts never specialize; with it, each expert learns to handle a different semantic niche, and you get both sparse activation AND emergent specialization.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The headline win is compute: with k=2 and 8 experts, each token touches only 2/8 = 25% of the FFN parameters. Mixtral 8×7B has 47 billion total parameters but activates roughly 13 billion per token. DeepSeek-V3 pushes it to 256 experts with 8 active, so each token sees ~3% of the FFN capacity. But the silent bill is memory and orchestration. All N experts must be loaded into GPU memory (or CPU, or distributed across devices), even if most are idle per token. Mixtral's 47B, not 13B, sits in memory. On multi-GPU systems, routing can create severe load imbalance: if the router sends many tokens to experts on GPU-0, you stall GPU-1. Communication and synchronization overheads become the real cost. Quantization helps, but experts still dominate memory. In production, you're trading compute efficiency for engineering complexity and memory footprint — a real trade, not a free win.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Mixtral 8×7B (Mistral AI, 2023) was the first open-weight MoE to ship at scale and proved the trick works: it beat larger dense models while costing less to inference. GPT-4, widely analyzed, is believed to use MoE internally for its vast capacity. DeepSeek-V3 (2024) raised the bar with 256 experts and a sophisticated balancing strategy, showing that extreme sparsity (8/256 active) can still converge and yield better long-context performance than denser rivals. The pattern: if you want a capable model cheaper than a trillion-parameter dense network, and you have the engineering chops for multi-expert orchestration, MoE is a go-to choice.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception one: more experts always scale better. Reality: expert count scales only with sophisticated load-balancing; a naive auxiliary loss leaves many experts dormant. Misconception two: MoE is always faster. Reality: it's cheaper in FLOPs (multiply-accumulate operations) but often slower in wall-clock time due to memory load, irregular access patterns, and communication. A 13B active model on a single GPU can outrun a Mixtral 8×7B if the system doesn't have enough GPU memory for all experts or inter-GPU bandwidth is bottlenecked.`,
        `The real pitfall: router collapse during training. Early iterations of MoE systems would watch helplessly as the router learned to dump 95% of tokens onto one expert, destroying all specialization and wasting most parameters. Modern systems attack this with auxiliary losses and careful initialization. Another silent killer: expert load variance. If some experts see 10× more tokens than others, those experts overfit and underfit respectively; load balancing must be aggressive enough to spread tokens fairly, but not so aggressive that it overrides the router's honest preference (a subtle optimization puzzle).`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into how the router actually scores tokens by learning Neural Network Forward Pass. Understand how softmax converts scores into probability weights (Softmax & Temperature). See how the load-balancing auxiliary loss works by studying Load Balancer principles. For deeper context, revisit Attention Mechanism to understand the full Transformer architecture. Finally, explore KV Cache to learn how real inference systems optimize memory access — a challenge MoE exacerbates, making memory efficiency techniques essential when deploying sparse expert models.`,
      ],
    },
  ],
};

