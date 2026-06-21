// Mixture of Experts: a router sends each token to a few small specialist
// networks instead of one giant one. The model gets high capacity while
// each token pays for only a small slice of it.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mixture-of-experts',
  title: 'Mixture of Experts (MoE)',
  category: 'AI & ML',
  summary: 'A router picks top-k experts per token, giving large parameter capacity while each token runs only a small part of the model.',
  controls: [
    { id: 'topk', label: 'Experts per token (k)', type: 'select', options: ['1', '2'], defaultValue: '2' },
  ],
  run,
};

const TOKENS = ['the', 'protein', 'folds', 'quickly'];
const EXPERTS = ['E1', 'E2', 'E3', 'E4'];
// Learned router probabilities: which expert should process each token.
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
    state: matrixState({ title: 'The dense way: one giant FFN, every token pays full price', rows, columns: cols, values: ROUTER.map((r) => r.map(() => 1)), format: () => 'run' }),
    highlight: { active: rows.flatMap((r) => cols.map((c) => `${r.id}:${c.id}`)) },
    explanation: 'A dense Transformer sends every token through the same feed-forward block. In this toy matrix, 4 tokens touch 4 expert-sized blocks each, so capacity and per-token compute grow together.',
  };

  yield {
    state: matrixState({ title: 'The router scores which expert suits each token', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: {},
    explanation: 'MoE replaces one large feed-forward block with several expert blocks plus a small router. Each row is a token, each column is an expert score, and the top scores decide where that token will spend compute.',
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
    explanation: `Each token activates only its top-${k} expert${k === 1 ? '' : 's'}: ${activeCells.length} of 16 possible expert runs (${pct(activeCells.length / 16)} of the dense toy cost)${k === 2 ? ', with the selected outputs blended by router weight' : ''}. Unchosen experts stay loaded but do not run for that token.`,
    invariant: 'Per-token expert compute is fixed by k, not by the total number of experts.',
  };

  yield {
    state: matrixState({ title: 'The failure mode: a collapsed router', rows, columns: cols, values: [[0.05, 0.85, 0.05, 0.05], [0.04, 0.88, 0.04, 0.04], [0.06, 0.84, 0.05, 0.05], [0.05, 0.86, 0.05, 0.04]], format: pct }),
    highlight: { swap: rows.map((r) => `${r.id}:e1`) },
    explanation: 'The main training hazard is router collapse. If most tokens go to E2, that expert bottlenecks the batch while the other experts receive little gradient. Load-balancing losses and capacity limits keep routing useful.',
  };

  yield {
    state: matrixState({ title: 'Top-2 routing at production scale', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: activeCells },
    explanation: 'At scale, adding experts can raise total parameters while active parameters per token stay bounded. The bill moves to memory, all-to-all communication, routing balance, and overflow handling. Sparse FLOPs are not the same thing as simple serving.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'MoE is sparse compute: the router scores many experts, but each token pays for only the top-k paths.'},
        `The matrix shows a router score table. Each row is a token, each column is an expert (a small feed-forward network). Cell values are the router's learned preference for sending that token to that expert. Highlighted cells are the top-k experts selected for each token — only those experts actually run.`,
        `The first frame shows the dense baseline: every token activates every expert-sized block, so capacity and compute grow together. The second frame reveals the router scores. The third frame applies top-k selection — most cells go dark because those experts skip that token entirely. The fourth frame shows the failure mode: a collapsed router where all tokens crowd into one expert.`,
        `Watch for three things at each step. Which experts light up (where the token spends compute). How many stay dark (the compute saved). And in the collapse frame, how routing degenerates when balancing fails.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The layer diagram grounds the dense baseline that MoE replaces with routed expert blocks. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        `Jacobs et al. introduced Mixture of Experts in 1991: instead of one monolithic network, train several specialist networks and a gating function that picks which specialist handles each input. The original motivation was supervised learning with heterogeneous data — different regions of input space benefit from different learned functions.`,
        `The idea became urgent at Transformer scale. GPT-3 has 175 billion parameters, and every token pays for all of them. If a model needs more capacity — more stored knowledge, more specialized circuits — the only dense option is to make the feed-forward layers wider or deeper, which raises cost per token proportionally. MoE breaks that proportionality: total parameters (capacity) can grow independently of active parameters per token (compute).`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Make the model bigger. Add layers, widen the feed-forward blocks, increase the embedding dimension. Every token can use the extra parameters. Training is straightforward — regular dense matrix multiplies with well-understood parallelism — and inference has uniform tensor shapes that hardware likes.`,
        `A second obvious approach is hand-routed specialization: train a code model, a medical model, a math model, and pick at the application level. This avoids the cost of a single giant model but is brittle, cannot share a backbone, and routes at document granularity rather than token granularity.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Dense scaling ties capacity to per-token compute. A 1-trillion-parameter dense model needs roughly 1 trillion multiply-adds for every token, whether that token is a period, a common preposition, or a rare multilingual technical term. The compute budget, the energy bill, and the inference latency all scale with total parameters.`,
        `Hand-routed specialization fails differently. It cannot share representations across domains, it cannot learn routing from data, and it cannot specialize at the token level — the router granularity is the entire request, not the individual hidden state.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Sparse activation. Replace the single feed-forward block in each Transformer layer with N parallel expert feed-forward blocks and a small gating network (the router). The router scores each token's hidden state against all N experts, selects the top-k, and runs only those k experts. The outputs are combined using the router's scores as weights.`,
        `The invariant: per-token compute is proportional to k, not to N. A layer with 64 experts and k = 2 runs two expert forward passes per token regardless of how many experts exist. Adding more experts increases total stored parameters (capacity) and memory, but not per-token FLOPs.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Routing is a directed dispatch graph: token states choose expert paths, and selected outputs merge back into the layer. Source: Wikimedia Commons, David W., public domain.'},
        `The router is a learned linear projection from the token hidden state to N logits, followed by softmax: g(x) = softmax(W_g * x). This produces a probability distribution over experts. The system takes the top-k entries.`,
        `Dispatch groups tokens by their selected experts. Each expert is a standard two-layer FFN (up-projection, activation, down-projection) with its own parameters. After the selected experts process their assigned tokens, the outputs are weighted by the corresponding router scores and summed back into the token's hidden state. The rest of the Transformer block — attention, layer norm, residual connections — continues unchanged.`,
        `Training requires a load-balancing auxiliary loss. Without it, the router collapses: a few experts receive most tokens, get most gradients, improve fastest, attract even more tokens, and the remaining experts starve. The auxiliary loss penalizes uneven routing by encouraging each expert to receive roughly 1/N of the tokens. A capacity factor caps how many tokens each expert can accept per batch; overflow is dropped or rerouted.`,
        `In distributed training and serving, experts are placed across devices using expert parallelism. Tokens must be sent to the device that owns their selected expert (all-to-all dispatch), processed, and returned (all-to-all combine). This communication cost can dominate when batches are small, routing is uneven, or interconnect bandwidth is limited.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Different token hidden states represent different kinds of information — syntactic structure, factual recall, arithmetic, code logic, multilingual mappings. A single FFN must handle all of them with one set of weights. Multiple experts can specialize: the router learns a soft partition of hidden-state space, and each expert receives tokens with related structure. This lets the model store more specialized functions without paying for all of them on every token.`,
        `The combine step keeps the layer differentiable. Router scores flow gradients to both the gating network and the selected experts. The auxiliary loss provides a gradient signal to underused experts, preventing the collapse that would otherwise make sparse routing degenerate into a dense model with wasted parameters.`,
        `For a fixed model, the output is deterministic: the router scores determine which experts run and with what weights. Correctness risk is not mathematical ambiguity but operational mismatch — if the capacity policy or overflow handling differs between training and inference, the model sees a different effective computation graph.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many repeated compute blocks', caption: 'MoE saves active FLOPs, but all experts still need memory residency and fast accelerator interconnects. Source: Wikimedia Commons, Nvidia, public domain.'},
        `Mixtral 8x7B (Mistral, 2024) has 8 experts per MoE layer with roughly 7B parameters each, totaling 46.7B parameters. With top-2 routing, only about 13B parameters are active per token. The compute cost per token matches a dense 13B model, but the memory footprint is 46.7B parameters — roughly 94 GB in FP16. MoE trades memory for quality-per-FLOP.`,
        `Communication is the second cost. Expert parallelism places experts on different accelerators. Each MoE layer requires an all-to-all exchange: tokens travel to their expert's device, get processed, and travel back. In Mixtral with 8 GPUs (one expert per GPU), every MoE layer does two all-to-all rounds. With small batches or slow interconnects, this communication can exceed the compute time it saved.`,
        `Load balancing is the third cost. The auxiliary loss pushes for uniform routing, but the data may genuinely need some experts more than others. Too little balancing creates hot experts and wasted capacity. Too much balancing forces tokens to suboptimal experts, hurting quality. Tuning the balance coefficient is an active research problem.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Mixtral 8x7B (Mistral, 2024): 8 experts, top-2 routing, 46.7B total / 13B active parameters. Matches or exceeds LLaMA 2 70B on most benchmarks at roughly 1/5 the inference compute. First widely deployed open-weight MoE language model.`,
        `Switch Transformer (Fedus et al., 2022): pushed k down to 1 — each token visits exactly one expert. Simpler routing, lower communication cost, 7x faster pretraining than T5-Base at comparable quality. Demonstrated that MoE scales to trillions of parameters.`,
        `GShard (Lepikhin et al., 2021): scaled a 600B-parameter MoE Transformer for multilingual translation across 2048 TPU v3 cores. Introduced the capacity factor and top-2 gating with auxiliary balancing loss that became standard.`,
        `DeepSeek-V2 (2024) and DeepSeek-V3 (2024): use fine-grained MoE with 160 small experts and top-6 routing, plus shared experts that process every token. DeepSeek-V3 has 671B total parameters with 37B active. The fine-grained design reduces the granularity mismatch between expert size and token diversity.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Expert collapse: without careful auxiliary loss tuning, the router converges to sending most tokens to one or two experts. The remaining experts receive too few tokens to learn useful functions, and the model degenerates into an expensive dense model with dead weight. The collapsed-router frame in the animation shows this directly.`,
        `Memory pressure: a model with 8 experts needs all 8 in memory even though only 2 run per token. Mixtral 8x7B needs roughly 94 GB in FP16, compared to 26 GB for a dense 13B model with similar per-token compute. On consumer GPUs with 24 GB VRAM, MoE models require aggressive quantization or offloading that dense models of equivalent active size do not.`,
        `Fine-tuning instability: updating a pretrained MoE model can disrupt the learned routing. Experts that specialized during pretraining may receive mismatched data during fine-tuning, and the router may need to relearn dispatch patterns. LoRA and other parameter-efficient methods help but add complexity.`,
        `Wall-clock latency: a smaller dense model on a single GPU can be faster than a larger MoE model spread across multiple devices, especially at low batch sizes where communication overhead dominates. Sparse FLOPs are a cost metric, not a latency guarantee.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `4 experts (E0 through E3), each a 2-layer FFN with hidden dimension 512. Top-2 routing. A token embedding x enters the MoE layer.`,
        `The router computes g(x) = softmax(W_g * x) and produces scores [0.40, 0.10, 0.35, 0.15]. Top-2 selects E0 (score 0.40) and E2 (score 0.35). The other two experts do zero work for this token.`,
        `Renormalize the selected scores: weight for E0 = 0.40 / (0.40 + 0.35) = 0.533. Weight for E2 = 0.35 / (0.40 + 0.35) = 0.467. Final output = 0.533 * E0(x) + 0.467 * E2(x).`,
        `The model has 4x the feed-forward capacity of a single expert, but each token pays for only 2 expert forward passes. E1 and E3 remain in memory — they will serve other tokens whose hidden states route differently — but they contribute zero FLOPs for this token.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Jacobs et al. 1991, Adaptive Mixtures of Local Experts — the original MoE idea. Shazeer et al. 2017, Outrageously Large Neural Networks (https://arxiv.org/abs/1701.06538) — sparsely-gated MoE at scale. Lepikhin et al. 2021, GShard (https://arxiv.org/abs/2006.16668) — capacity factor and 600B MoE. Fedus et al. 2022, Switch Transformers (https://arxiv.org/abs/2101.03961) — k=1 routing to trillion parameters. Jiang et al. 2024, Mixtral of Experts (https://arxiv.org/abs/2401.04088). DeepSeek-V3, 2024 (https://arxiv.org/abs/2412.19437) — fine-grained MoE with shared experts.`,
        `Prerequisite: Transformer Block (where MoE replaces the FFN), Softmax and Temperature (the gating function). Extensions: MoE Expert Capacity and All-To-All Routing Ledger (dispatch mechanics), Mixture-of-Depths Token Routing (routing tokens across layers instead of experts). Related systems: Tensor Parallelism and GPU Allreduce (the communication primitives MoE relies on), KV Cache (unaffected by MoE — attention caching is orthogonal to expert routing).`,
      ],
    },
  ],
};
