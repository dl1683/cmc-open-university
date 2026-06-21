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
  const r2 = (v) => Math.round(v * 100) / 100;

  // --- 1. Dense baseline: all 16 cells active ---
  yield {
    state: matrixState({ title: 'Dense baseline: every token runs every expert-sized block', rows, columns: cols, values: ROUTER.map((r) => r.map(() => 1)), format: () => 'run' }),
    highlight: { active: rows.flatMap((r) => cols.map((c) => `${r.id}:${c.id}`)) },
    explanation: `A dense Transformer sends every token through the same feed-forward block. All ${TOKENS.length * EXPERTS.length} cells are active: ${TOKENS.length} tokens x ${EXPERTS.length} expert-sized blocks. Capacity and per-token compute grow together — to store more knowledge, you must also spend more FLOPs on every token.`,
  };

  // --- 2. Introduce the router: raw score matrix ---
  yield {
    state: matrixState({ title: 'The router: learned scores for each token-expert pair', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: {},
    explanation: `MoE replaces the single FFN with ${EXPERTS.length} expert FFNs plus a small router. The router is a linear layer: g(x) = softmax(W_g * x). Each cell shows the probability that a token should be sent to that expert. Higher scores mean a better match — but the model will only USE the top-${k}.`,
  };

  // Compute picks for each token
  const picks = ROUTER.map((row) => row
    .map((v, j) => ({ v, j }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k));

  // --- 3. Step through token "the" ---
  const theScores = ROUTER[0];
  const thePicks = picks[0];
  const theCells = thePicks.map(({ j }) => `t0:e${j}`);
  yield {
    state: matrixState({ title: `Routing "${TOKENS[0]}": router scores the 4 experts`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: theCells, visited: cols.map((c) => `t0:${c.id}`).filter((c) => !theCells.includes(c)) },
    explanation: `Token "${TOKENS[0]}" gets scores [${theScores.map(pct).join(', ')}]. Top-${k}: ${thePicks.map(({ j }) => `${EXPERTS[j]} (${pct(theScores[j])})`).join(' and ')}. ${k === 2 ? 'Two experts fire; the other two stay idle for this token.' : 'One expert fires; the other three stay idle.'}`,
  };

  // --- 4. Step through token "protein" ---
  const proteinScores = ROUTER[1];
  const proteinPicks = picks[1];
  const proteinCells = proteinPicks.map(({ j }) => `t1:e${j}`);
  yield {
    state: matrixState({ title: `Routing "${TOKENS[1]}": different experts selected`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: proteinCells, visited: theCells },
    explanation: `Token "${TOKENS[1]}" scores [${proteinScores.map(pct).join(', ')}]. Top-${k}: ${proteinPicks.map(({ j }) => `${EXPERTS[j]} (${pct(proteinScores[j])})`).join(' and ')}. Different content activates different experts — the router learns a soft partition of hidden-state space.`,
  };

  // --- 5. Step through token "folds" ---
  const foldsScores = ROUTER[2];
  const foldsPicks = picks[2];
  const foldsCells = foldsPicks.map(({ j }) => `t2:e${j}`);
  const prevCells = [...theCells, ...proteinCells];
  yield {
    state: matrixState({ title: `Routing "${TOKENS[2]}": which experts activate`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: foldsCells, visited: prevCells },
    explanation: `Token "${TOKENS[2]}" scores [${foldsScores.map(pct).join(', ')}]. Top-${k}: ${foldsPicks.map(({ j }) => `${EXPERTS[j]} (${pct(foldsScores[j])})`).join(' and ')}. Notice how the router distributes tokens across experts — no single expert dominates.`,
  };

  // --- 6. Step through token "quickly" ---
  const quicklyScores = ROUTER[3];
  const quicklyPicks = picks[3];
  const quicklyCells = quicklyPicks.map(({ j }) => `t3:e${j}`);
  const allPrevCells = [...prevCells, ...foldsCells];
  yield {
    state: matrixState({ title: `Routing "${TOKENS[3]}": completing the dispatch`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: quicklyCells, visited: allPrevCells },
    explanation: `Token "${TOKENS[3]}" scores [${quicklyScores.map(pct).join(', ')}]. Top-${k}: ${quicklyPicks.map(({ j }) => `${EXPERTS[j]} (${pct(quicklyScores[j])})`).join(' and ')}. All four tokens are now routed.`,
  };

  // --- 7. Full routing decision: all tokens with selected experts highlighted ---
  const allActiveCells = picks.flatMap((expertIdxs, i) => expertIdxs.map(({ j }) => `t${i}:e${j}`));
  const allInactiveCells = rows.flatMap((r) => cols.map((c) => `${r.id}:${c.id}`)).filter((c) => !allActiveCells.includes(c));
  yield {
    state: matrixState({ title: `Full routing decision: top-${k} per token`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: allActiveCells, removed: allInactiveCells },
    explanation: `The complete routing table: ${allActiveCells.length} of ${TOKENS.length * EXPERTS.length} expert runs are selected (${pct(allActiveCells.length / (TOKENS.length * EXPERTS.length))} of dense cost). Dimmed cells are experts that exist in memory but do zero work for that token. This is the core MoE tradeoff: large capacity, small per-token compute.`,
    invariant: `Per-token compute is fixed at ${k} expert${k === 1 ? '' : 's'}, regardless of total expert count.`,
  };

  // --- 8. Renormalize weights for top-2 (or show raw for top-1) ---
  const renormValues = ROUTER.map((row, i) => {
    const selected = picks[i];
    const sumSelected = selected.reduce((s, { v }) => s + v, 0);
    return row.map((v, j) => {
      const isSelected = selected.some(({ j: sj }) => sj === j);
      return isSelected ? r2(v / sumSelected) : 0;
    });
  });
  const renormFormat = (v) => v === 0 ? '-' : `${Math.round(v * 100)}%`;
  yield {
    state: matrixState({ title: k === 2 ? 'Renormalized blending weights for top-2' : 'Final routing weights (top-1: winner takes all)', rows, columns: cols, values: renormValues, format: renormFormat }),
    highlight: { active: allActiveCells },
    explanation: k === 2
      ? `After selecting top-2, the router renormalizes so weights sum to 1. For "${TOKENS[0]}": ${picks[0].map(({ v, j }) => `${EXPERTS[j]} raw ${pct(v)}`).join(', ')} -> renorm ${picks[0].map(({ v, j }) => { const s = picks[0].reduce((a, b) => a + b.v, 0); return `${EXPERTS[j]} ${pct(r2(v / s))}`; }).join(', ')}. The final output = w1 * Expert1(x) + w2 * Expert2(x).`
      : `With k=1, the winning expert handles the token alone — no blending. Each token's output is simply the selected expert's output, weighted at 100%.`,
  };

  // --- 9. Expert load distribution ---
  const expertLoads = EXPERTS.map((_, j) => picks.reduce((count, tokenPicks) => count + (tokenPicks.some(({ j: sj }) => sj === j) ? 1 : 0), 0));
  const loadRows = [{ id: 'load', label: 'tokens' }];
  const loadValues = [expertLoads.map((l) => l)];
  yield {
    state: matrixState({ title: 'Expert load distribution: tokens per expert', rows: loadRows, columns: cols, values: loadValues, format: (v) => `${v}` }),
    highlight: { active: expertLoads.map((l, j) => l > 0 ? `load:e${j}` : null).filter(Boolean) },
    explanation: `Load balance: ${EXPERTS.map((e, j) => `${e} serves ${expertLoads[j]} token${expertLoads[j] === 1 ? '' : 's'}`).join(', ')}. Ideal balance is ${r2(TOKENS.length * k / EXPERTS.length)} tokens per expert. ${Math.max(...expertLoads) - Math.min(...expertLoads) <= 1 ? 'This routing is well-balanced.' : 'Some imbalance exists — the auxiliary loss penalizes this during training.'}`,
  };

  // --- 10. Collapsed router failure mode ---
  const collapsedRouter = [[0.05, 0.85, 0.05, 0.05], [0.04, 0.88, 0.04, 0.04], [0.06, 0.84, 0.05, 0.05], [0.05, 0.86, 0.05, 0.04]];
  const collapsedPicks = collapsedRouter.map((row) => row
    .map((v, j) => ({ v, j }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k));
  const collapsedActive = collapsedPicks.flatMap((ep, i) => ep.map(({ j }) => `t${i}:e${j}`));
  const collapsedLoads = EXPERTS.map((_, j) => collapsedPicks.reduce((count, tp) => count + (tp.some(({ j: sj }) => sj === j) ? 1 : 0), 0));
  yield {
    state: matrixState({ title: 'Failure mode: collapsed router — E2 gets everything', rows, columns: cols, values: collapsedRouter, format: pct }),
    highlight: { swap: collapsedActive },
    explanation: `Router collapse: E2 receives scores of ${collapsedRouter.map((r) => pct(r[1])).join(', ')} across all tokens. Load: ${EXPERTS.map((e, j) => `${e}=${collapsedLoads[j]}`).join(', ')}. E2 bottlenecks the batch, gets most gradients, improves fastest, attracts even more tokens — a positive feedback loop. The other experts starve and their parameters become dead weight.`,
  };

  // --- 11. Balanced vs collapsed comparison ---
  yield {
    state: matrixState({ title: 'Balanced routing (healthy) vs collapsed routing (broken)', rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: allActiveCells, compare: collapsedActive },
    explanation: `Highlighted: the healthy routing from earlier — tokens spread across experts. Compared (outlined): the collapsed routing where E2 dominates. The auxiliary loss L_balance = alpha * sum(f_i * P_i) penalizes this by measuring the product of each expert's token fraction (f_i) and average routing probability (P_i). When one expert hogs tokens, f_i * P_i spikes, the loss rises, and gradients push the router to distribute more evenly.`,
    invariant: 'Load-balancing losses keep MoE from degenerating into a dense model with dead experts.',
  };

  // --- 12. Final summary: FLOPs saved, memory cost ---
  const denseOps = TOKENS.length * EXPERTS.length;
  const sparseOps = TOKENS.length * k;
  const savedPct = pct(1 - sparseOps / denseOps);
  yield {
    state: matrixState({ title: `Summary: top-${k} MoE at a glance`, rows, columns: cols, values: ROUTER, format: pct }),
    highlight: { active: allActiveCells },
    explanation: `Dense baseline: ${denseOps} expert runs. Top-${k} MoE: ${sparseOps} expert runs — ${savedPct} compute saved. But all ${EXPERTS.length} experts stay in memory (${EXPERTS.length}x the parameter footprint of one expert). At production scale (Mixtral 8x7B: 46.7B params, 13B active; DeepSeek-V3: 671B params, 37B active), MoE trades memory and communication cost for quality-per-FLOP. The router is the critical learned component: if it collapses, the model pays for capacity it cannot use.`,
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
      
        {type: 'image', src: './assets/gifs/mixture-of-experts.gif', alt: 'Animated walkthrough of the mixture of experts visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
