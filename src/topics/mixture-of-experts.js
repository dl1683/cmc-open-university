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
// The router's learned probabilities: which expert should process each token.
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
      heading: 'Why this exists',
      paragraphs: [
        `Mixture of Experts exists because dense model scaling ties capacity to per-token compute. If a standard Transformer feed-forward network gets larger, every token pays for the larger block. That can improve quality, but it also raises training cost, inference cost, and latency for easy and hard tokens alike.`,
        `MoE breaks that tie. The model owns many expert feed-forward networks, but a small router sends each token to only a few of them. Total parameters can grow while the number of active parameters per token stays much smaller than the whole model.`,
        `This is conditional computation. It is the neural version of a familiar systems idea: do not touch every shard when the input only needs one or two. The hard part is making the routing trainable, balanced, and efficient on real accelerators.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is a larger dense model. Add width, layers, or feed-forward hidden dimension, and every token can use the extra parameters. Training is straightforward compared with sparse routing, and serving has regular tensor shapes.`,
        `The wall is cost. Dense scaling spends the same compute on punctuation, boilerplate, rare facts, code, math, and everything else. It also forces the serving system to run the whole block even when only a small part of the learned capacity would help the token.`,
        `A hand-written specialist switch is another tempting approach: route code to a code model and medical text to a medical model. That is brittle. MoE learns the routing inside the model, at token granularity, during training.`,
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        `The core insight is sparse activation. The parameter set can be large, but the compute graph for one token can be small. A token representation is scored against all experts, the top-k experts run, and their outputs are combined using router weights.`,
        `The invariant is per-token expert compute equals k expert calls, not N expert calls. If a layer has 64 experts and k is 2, a token runs two experts. Increasing N increases capacity and memory footprint, but it does not automatically increase feed-forward FLOPs for that token.`,
        `The invariant is only useful if load stays balanced. A routed layer must also keep expert capacity, overflow policy, and device placement under control. Otherwise the theoretical FLOP saving turns into a hot expert, dropped tokens, or a slow all-to-all exchange.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Inside a Transformer block, the dense feed-forward sublayer is replaced by an MoE sublayer. The router takes each token hidden state and produces scores over N experts, usually through a learned linear projection followed by softmax. The system selects the top-k experts for each token.`,
        `Dispatch groups tokens by selected expert. Each expert is an ordinary feed-forward network with its own parameters. The selected expert outputs are weighted by the router scores and combined back into the original token order. The rest of the Transformer block can continue as usual.`,
        `Training adds two pieces that are easy to miss. First, the router needs a load-balancing objective so all experts receive work and gradients. Second, the layer needs a capacity rule: each expert can accept only so many tokens in a batch. Overflow can be dropped, rerouted, delayed, or handled by a backup path depending on the design.`,
        `Distributed serving adds an all-to-all communication step when experts live on different devices. Tokens must travel to the device that owns their expert and then return after expert computation. That communication can dominate if batches are small, routing is uneven, or the network is slow.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `MoE works when many useful functions can share the same attention backbone but use different feed-forward parameters. The router learns a soft partition of token states. Related token states tend to visit related experts, so each expert receives repeated structure rather than random noise.`,
        `The combine step keeps the layer differentiable. Router scores affect which experts are selected and how their outputs are weighted. Auxiliary losses push the router away from collapse, so unused experts get enough examples to learn.`,
        `Correctness at inference is a guarded execution rule: for a fixed model, router, k, and capacity policy, the output is defined by the selected experts and combine weights. The danger is not mathematical ambiguity. The danger is bad routing, overloaded experts, or serving code that changes overflow behavior between training and inference.`,
      ],
    },
    {
      heading: 'What the routing readout shows',
      paragraphs: [
        `The matrix shows the router score table. Rows are tokens, columns are experts, and each cell is the router preference for that token-expert pair. Top-k routing turns that score table into a sparse dispatch plan.`,
        `The dense frame is the baseline: every token pays for every block. The top-k frame shows the algorithmic change: most cells become inactive for that token. This explains active parameter count, not total memory footprint.`,
        `The collapsed-router frame is the limit case. If all rows choose the same column, sparse activation still exists on paper, but the batch bottlenecks on one expert and the other experts stop learning useful functions.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `MoE reduces active FLOPs, but it does not make capacity free. All expert weights must be stored somewhere. If a model has 47B total parameters and 13B active parameters per token, the serving stack still has to place, load, shard, quantize, or page the larger parameter set.`,
        `Communication is the second cost. Expert parallelism often sends token activations across devices. A dense layer may run as regular tensor math, while an MoE layer must sort, dispatch, execute uneven expert batches, and combine results. That can hurt latency even when arithmetic drops.`,
        `Load balancing is the third cost. The router is trained to choose useful experts, but the system also wants equal device work. Those goals can conflict. Too little balancing causes hot experts. Too much balancing can force tokens away from the expert that would have produced the best representation.`,
        `Evaluation cost also rises. Quality must be checked by language, domain, token length, and rare task slice. A sparse model can improve average scores while one expert becomes weak for a small but valuable segment.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `MoE wins when model quality benefits from more parameters but the product cannot afford dense per-token compute. It is especially natural for large language models, multilingual models, code and text mixtures, recommender systems, and workloads where different input regions need different learned functions.`,
        `It also wins when the serving platform can keep expert weights resident and has enough batch size or network bandwidth to make routing overhead small relative to expert computation. A well-run MoE system can deliver higher quality per active FLOP than a comparable dense model.`,
        `Open systems such as Mixtral and research systems such as Switch Transformer, GShard, and DeepSeekMoE make the pattern concrete: sparse feed-forward compute can scale total capacity beyond what a dense layer would spend on every token.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `MoE can fail during training through router collapse, expert starvation, unstable load-balancing loss, or overflow behavior that drops too many tokens. It can fail during serving through hot experts, slow all-to-all communication, memory pressure, or a mismatch between training capacity policy and inference capacity policy.`,
        `It is not always faster in wall-clock terms. A smaller dense model on one GPU can beat a larger sparse model if the sparse model needs several devices, pays high communication cost, or cannot batch enough tokens. Sparse FLOPs are a cost signal, not a latency guarantee.`,
        `More experts do not automatically mean better quality. Past a point, experts may be undertrained, duplicated, poorly balanced, or too expensive to keep resident. The useful question is not how many experts exist; it is whether routing gives better quality, cost, and latency on the measured workload.`,
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        `When studying or deploying MoE, always separate total parameters, active parameters, memory footprint, and delivered latency. The marketing number is usually total parameters. The compute number is active parameters. The hardware bill often follows memory footprint and communication.`,
        `Track token count per expert, overflow rate, dropped-token rate, router entropy, top-k margin, per-expert latency, all-to-all time, expert memory footprint, device utilization, and quality by input slice. These signals show whether the router learned useful specialization or only moved the bottleneck.`,
        `Use MoE after the team can run dense Transformer baselines well. Sparse routing adds enough failure modes that it should be justified by a measured capacity need, not by novelty.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Shazeer et al., Outrageously Large Neural Networks at https://arxiv.org/abs/1701.06538; GShard at https://arxiv.org/abs/2006.16668; Switch Transformer at https://arxiv.org/abs/2101.03961; Mixtral 8x7B at https://arxiv.org/abs/2401.04088; DeepSeekMoE at https://arxiv.org/abs/2401.06066; and DeepSeek-V3 at https://arxiv.org/abs/2412.19437.`,
        `Study Transformer Block, Neural Network Forward Pass, Softmax and Temperature, Load Balancer, GPU Allreduce, Tensor Parallelism, MoE Expert Capacity and All-To-All Routing Ledger, Mixture-of-Depths Token Routing, KV Cache, and Transformer Inference Roofline next.`,
      ],
    },
  ],
};
