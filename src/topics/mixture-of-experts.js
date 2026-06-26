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
        'Each row is a token, which is one text unit represented as a hidden-state vector inside the model. Each column is an expert, meaning a separate feed-forward network that can process the token. A highlighted cell means the router selected that expert for that token.',
        'The dense baseline lights every cell because every token pays for every expert-sized block. In the MoE frames, top-k means only the k highest-scoring experts run for each token. The safe inference rule is that inactive experts add memory capacity but spend zero forward-pass compute for that token.',
        {type: 'callout', text: 'MoE is sparse compute: the router scores many experts, but each token pays for only the top-k paths.'},
        {type: 'image', src: './assets/gifs/mixture-of-experts.gif', alt: 'Animated walkthrough of the mixture of experts visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dense neural networks tie capacity to compute. If a model has more feed-forward parameters, every token usually runs through all of them. That raises training cost, inference latency, and energy even when a token needs only a small part of the stored knowledge.',
        'Mixture of Experts, or MoE, separates total parameters from active parameters. The model stores many expert networks but activates only a few per token. This lets capacity grow faster than per-token FLOPs, at the cost of routing, memory, and communication complexity.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The layer diagram grounds the dense baseline that MoE replaces with routed expert blocks. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to make one dense model larger. Add layers, widen the feed-forward block, or increase hidden dimension. Hardware likes the regular matrix multiplications, and training behavior is easier to reason about than dynamic routing.',
        'Another approach is product-level specialization. Run a code model for code, a math model for math, and a general model for everything else. That can work, but routing happens at request level and the models do not share fine-grained token-level specialization inside one forward pass.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dense scaling makes every token pay for all capacity. A rare technical word, a comma, and a common word all traverse the same full feed-forward block. If total feed-forward parameters double, per-token feed-forward compute roughly doubles.',
        'Request-level specialization is too coarse. A single sentence can contain ordinary grammar, code identifiers, math notation, and domain facts. Choosing one external model for the whole request cannot route different hidden states to different learned functions inside the same layer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace one feed-forward block with many expert feed-forward blocks plus a learned router. The router scores the token hidden state against all experts, selects the top k, and combines only those expert outputs. The rest of the Transformer layer stays mostly unchanged.',
        'The invariant is sparse activation. With 64 experts and top-2 routing, each token runs two experts, not 64. Adding experts increases stored capacity and memory, but the selected compute per token remains tied to k.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Routing is a directed dispatch graph: token states choose expert paths, and selected outputs merge back into the layer. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each token hidden state x, the router computes scores over experts, often with a linear projection followed by softmax. The system keeps the top-k scores and drops the rest. The selected experts process x, and their outputs are weighted by the selected router probabilities.',
        'Training needs load balancing. If one expert gets most tokens, it receives most gradient updates and becomes even more attractive, while other experts starve. Auxiliary load losses and capacity limits push traffic toward a usable distribution.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for one forward pass is defined by the computation graph chosen by the router. Given fixed weights, router scores, top-k policy, capacity policy, and combine rule, the output is deterministic. The layer is not approximating dense execution; it is a different sparse layer.',
        'The learning argument is that different regions of hidden-state space can use different functions. Tokens with related structure tend to route to similar experts, so experts can specialize. The combine step keeps gradients flowing to selected experts and to the router scores that selected them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per-token expert compute is proportional to k times expert size, not total expert count. If a layer has 8 experts and top-2 routing, the token runs 2 expert networks, or 25 percent of the expert blocks. Dense attention and non-MoE parts still run normally.',
        'Memory scales with total experts, and communication can dominate latency when experts are sharded across devices. When the number of experts doubles and k stays fixed, active FLOPs can stay similar while memory and routing table size grow. When k doubles, active compute and dispatch usually grow directly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many repeated compute blocks', caption: 'MoE saves active FLOPs, but all experts still need memory residency and fast accelerator interconnects. Source: Wikimedia Commons, Nvidia, public domain.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MoE is used in large language models and translation systems where parameter capacity helps quality but dense compute is too expensive. Switch Transformer showed top-1 routing at very large scale, while GShard used routed experts for multilingual translation. Open-weight MoE models such as Mixtral made the tradeoff visible to practitioners.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Router collapse is the first failure. If most tokens choose one expert, that expert becomes a bottleneck and other experts stop learning useful functions. The model pays memory for experts that contribute little behavior.',
        'MoE can also be slower than a dense model with similar active FLOPs. Small batches, uneven routing, limited interconnect, CPU offload, and expert cache misses can erase sparse-compute savings. A single-GPU dense model may beat a multi-device MoE on wall-clock latency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four experts E0, E1, E2, and E3 with top-2 routing. For token "protein", suppose the router scores are [0.05, 0.78, 0.10, 0.07]. The selected experts are E1 and E2 because they have the two largest scores.',
        'Renormalize selected weights over the selected experts. E1 gets 0.78 / (0.78 + 0.10) = 0.886, and E2 gets 0.10 / 0.88 = 0.114. The output for that token is 0.886 * E1(x) + 0.114 * E2(x).',
        'The dense baseline with four expert-sized blocks would run four blocks for the token. Top-2 MoE runs two, so expert compute is cut in half for this layer. The other two experts still occupy memory and may process different tokens in the same batch.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Jacobs et al. for adaptive mixtures of local experts, Shazeer et al. for sparsely gated MoE, GShard for large multilingual routing, Switch Transformer for top-1 routing, and Mixtral for an open-weight MoE design. Focus on router policy, capacity factor, load balancing, and expert parallelism rather than headline parameter counts.',
        'Study Transformer Block and Feed-Forward Network first, then Softmax Temperature for router scoring. After that, study GPU Allreduce, All-to-All Routing, Tensor Parallelism, and KV Cache so the model-side idea connects to the serving cost.',
      ],
    },
  ],
};
