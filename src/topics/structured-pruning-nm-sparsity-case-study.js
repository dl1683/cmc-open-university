// Structured pruning and N:M sparsity: turn model compression into a mask,
// packing, kernel-compatibility, and rollout-ledger problem.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'structured-pruning-nm-sparsity-case-study',
  title: 'Structured Pruning and N:M Sparsity',
  category: 'AI & ML',
  summary: 'A model-compression case study: score weights, build N:M masks, pack sparse operands, verify sparse kernels, and roll out only when quality gates hold.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mask ledger', 'kernel path', 'quality gate'], defaultValue: 'mask ledger' },
  ],
  run,
};

const ROWS = [
  { id: 'r0', label: 'q0' },
  { id: 'r1', label: 'q1' },
  { id: 'r2', label: 'ff0' },
  { id: 'r3', label: 'ff1' },
];

const COLS = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, label: `w${i}` }));

const WEIGHTS = [
  [0.62, -0.15, 0.08, -0.48, 0.21, -0.06, 0.39, -0.33],
  [-0.10, 0.52, -0.44, 0.09, 0.31, -0.25, 0.04, 0.18],
  [0.73, -0.22, 0.17, -0.04, -0.55, 0.12, 0.28, -0.36],
  [-0.41, 0.06, 0.34, -0.29, 0.15, -0.47, 0.09, 0.24],
];

const ACT = [0.7, 1.5, 0.9, 1.1, 1.4, 0.6, 1.2, 0.8];
const SCORES = WEIGHTS.map((row) => row.map((weight, c) => Math.abs(weight) * ACT[c]));
const MASK = SCORES.map((row) => {
  const mask = Array(row.length).fill(0);
  for (let start = 0; start < row.length; start += 4) {
    row
      .slice(start, start + 4)
      .map((score, offset) => ({ score, index: start + offset }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .forEach(({ index }) => { mask[index] = 1; });
  }
  return mask;
});

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function maskedWeights() {
  return WEIGHTS.map((row, r) => row.map((weight, c) => (MASK[r][c] ? weight : 0)));
}

function compressedRows() {
  const rows = [];
  const labels = [];
  for (let r = 0; r < WEIGHTS.length; r += 1) {
    const rowLabels = [];
    for (let g = 0; g < 2; g += 1) {
      const start = g * 4;
      const kept = [];
      for (let c = start; c < start + 4; c += 1) {
        if (MASK[r][c]) kept.push({ local: c - start, value: WEIGHTS[r][c] });
      }
      rowLabels.push(kept[0].value.toFixed(2));
      rowLabels.push(kept[1].value.toFixed(2));
      rowLabels.push(kept.map((item) => item.local).join(','));
    }
    rows.push({ id: ROWS[r].id, label: ROWS[r].label });
    labels.push([...rowLabels, '2/4']);
  }
  return { rows, labels };
}

function kernelGraph(title) {
  return graphState({
    nodes: [
      { id: 'model', label: 'model', x: 0.7, y: 3.8, note: 'dense W' },
      { id: 'calib', label: 'calib', x: 2.3, y: 1.3, note: 'samples' },
      { id: 'scores', label: 'scores', x: 4.0, y: 1.3, note: '|w|xact' },
      { id: 'mask', label: 'mask', x: 5.7, y: 1.3, note: 'N:M' },
      { id: 'pack', label: 'pack', x: 7.4, y: 1.3, note: 'vals+idx' },
      { id: 'reg', label: 'registry', x: 6.3, y: 4.0, note: 'legal?' },
      { id: 'sparse', label: 'sparse TC', x: 8.4, y: 2.8, note: 'fast' },
      { id: 'dense', label: 'dense fb', x: 8.4, y: 5.2, note: 'safe' },
      { id: 'shadow', label: 'shadow', x: 2.6, y: 6.2, note: 'compare' },
      { id: 'canary', label: 'canary', x: 4.6, y: 6.2, note: '1 pct' },
      { id: 'serve', label: 'serve', x: 9.7, y: 4.0, note: 'gated' },
    ],
    edges: [
      { id: 'e-model-calib', from: 'model', to: 'calib' },
      { id: 'e-calib-scores', from: 'calib', to: 'scores' },
      { id: 'e-scores-mask', from: 'scores', to: 'mask' },
      { id: 'e-mask-pack', from: 'mask', to: 'pack' },
      { id: 'e-pack-reg', from: 'pack', to: 'reg' },
      { id: 'e-reg-sparse', from: 'reg', to: 'sparse', weight: '2:4' },
      { id: 'e-reg-dense', from: 'reg', to: 'dense', weight: 'miss' },
      { id: 'e-sparse-serve', from: 'sparse', to: 'serve' },
      { id: 'e-dense-serve', from: 'dense', to: 'serve' },
      { id: 'e-model-shadow', from: 'model', to: 'shadow' },
      { id: 'e-shadow-canary', from: 'shadow', to: 'canary' },
      { id: 'e-canary-serve', from: 'canary', to: 'serve' },
    ],
  }, { title });
}

function* maskLedger() {
  yield {
    state: matrixState({
      title: 'Start with dense trained weights',
      rows: ROWS,
      columns: COLS,
      values: WEIGHTS,
      format: (value) => value.toFixed(2),
    }),
    highlight: { active: ['r0:c0', 'r0:c3', 'r1:c1', 'r2:c0', 'r3:c5'], compare: ['r0:c1', 'r2:c3'] },
    explanation: 'Pruning starts with a normal trained matrix. The question is not simply which weights are small. The production question is which weights can be removed while preserving outputs, matching a hardware-supported mask pattern, and leaving a sparse operand that kernels can actually execute faster.',
    invariant: 'A pruned model still has the same layer shape; only selected connections become zero or are packed away.',
  };

  yield {
    state: matrixState({
      title: 'Score each weight with activation context',
      rows: ROWS,
      columns: COLS,
      values: SCORES,
      format: (value) => value.toFixed(2),
    }),
    highlight: { active: ['r0:c0', 'r0:c3', 'r1:c1', 'r2:c0', 'r3:c5'], compare: ['r0:c1', 'r2:c3'] },
    explanation: 'Wanda-style one-shot pruning scores a weight by combining its magnitude with activation statistics from calibration data. That changes the data structure: the mask is derived from weight values plus a small activation ledger, not from the weight tensor alone.',
  };

  yield {
    state: matrixState({
      title: 'Apply a 2:4 mask in every group of four',
      rows: ROWS,
      columns: COLS,
      values: MASK,
      format: (value) => (value ? 'keep' : 'zero'),
    }),
    highlight: { active: ['r0:c0', 'r0:c3', 'r1:c1', 'r1:c2', 'r2:c0', 'r2:c2', 'r3:c2', 'r3:c5'], removed: ['r0:c1', 'r0:c2', 'r1:c0', 'r1:c3'] },
    explanation: 'N:M sparsity is a local constraint. In the common 2:4 pattern, each group of four stores two nonzero weights and two zeros. This is less flexible than unstructured pruning, but the regularity gives hardware a predictable packed layout.',
    invariant: 'Every four-weight block has exactly two kept entries.',
  };

  yield {
    state: matrixState({
      title: 'Masked tensor keeps the original layer shape',
      rows: ROWS,
      columns: COLS,
      values: maskedWeights(),
      format: (value) => (value === 0 ? '0' : value.toFixed(2)),
    }),
    highlight: { active: ['r0:c0', 'r0:c3', 'r1:c1', 'r1:c2'], removed: ['r0:c1', 'r0:c2', 'r1:c0', 'r1:c3'] },
    explanation: 'Frameworks often materialize the masked tensor first because it is easy to compare against dense outputs. This is the debug form. It proves which weights are gone, but it does not yet guarantee a speedup.',
  };

  const packed = compressedRows();
  yield {
    state: labelMatrix(
      'Packed operand stores values plus indices',
      packed.rows,
      [
        { id: 'g0a', label: 'g0a' },
        { id: 'g0b', label: 'g0b' },
        { id: 'g0i', label: 'g0i' },
        { id: 'g1a', label: 'g1a' },
        { id: 'g1b', label: 'g1b' },
        { id: 'g1i', label: 'g1i' },
        { id: 'guard', label: 'guard' },
      ],
      packed.labels,
    ),
    highlight: { active: ['r0:g0a', 'r0:g0b', 'r0:g0i', 'r1:g0i', 'r2:g1a'], found: ['r0:guard', 'r1:guard', 'r2:guard', 'r3:guard'] },
    explanation: 'The serving artifact is a compact sparse operand: two kept values per group plus tiny metadata telling the kernel where those values came from. NVIDIA cuSPARSELt exposes exactly this kind of prune, check, compress, and matmul workflow for 2:4 structured sparsity.',
  };

  yield {
    state: labelMatrix(
      'Pruning ledger fields',
      [
        { id: 'pattern', label: 'pat' },
        { id: 'score', label: 'scorer' },
        { id: 'calib', label: 'calib' },
        { id: 'pack', label: 'pk' },
        { id: 'kernel', label: 'kern' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
        { id: 'link', label: 'link' },
      ],
      [
        ['2:4', 'block ok', 'bad fit', 'kern'],
        ['score', 'hash', 'bad data', 'calib'],
        ['samples', 'slice ok', 'slice miss', 'eval'],
        ['v+idx', 'check', 'layout', 'kern'],
        ['dtype', 'compat', 'no speed', 'route'],
        ['tasks', 'stress', 'regress', 'flag'],
      ],
    ),
    highlight: { active: ['pattern:stores', 'score:stores', 'calib:stores', 'kernel:stores', 'eval:stores'], found: ['pattern:check', 'kernel:check', 'eval:check'], compare: ['kernel:risk', 'eval:risk'] },
    explanation: 'The important data structure is the ledger around the mask. It records pattern, scorer, calibration sample, packed layout, kernel target, evaluation slices, and rollback criteria. Without that ledger, pruning is an unrepeatable checkpoint mutation.',
  };
}

function* kernelPath() {
  yield {
    state: kernelGraph('Calibration creates the score side table'),
    highlight: { active: ['model', 'calib', 'scores', 'e-model-calib', 'e-calib-scores'], compare: ['mask'] },
    explanation: 'A pruning pass should start by freezing the dense model and collecting calibration activations. SparseGPT uses a layer-wise reconstruction view; Wanda uses weight magnitude times activation statistics. Either way, the mask depends on a reproducible calibration packet.',
  };

  yield {
    state: kernelGraph('The mask must satisfy the target pattern'),
    highlight: { active: ['scores', 'mask', 'e-scores-mask'], found: ['pack'], compare: ['dense'] },
    explanation: 'Unstructured pruning can delete any individual weight, but often fails to speed up dense accelerators. N:M pruning trades freedom for a regular pattern that can be validated block by block before packing.',
    invariant: 'Mask legality is separate from model quality.',
  };

  yield {
    state: kernelGraph('Packing turns zeros into a sparse operand'),
    highlight: { active: ['mask', 'pack', 'e-mask-pack'], found: ['reg'], compare: ['model'] },
    explanation: 'The packed representation is not just the dense tensor with zeros. It is values plus metadata in a layout expected by the sparse GEMM library. If the layout, alignment, dtype, or shape bucket is wrong, the model can be sparse and still run through a dense fallback.',
  };

  yield {
    state: kernelGraph('Compatibility chooses sparse kernel or fallback'),
    highlight: { active: ['pack', 'reg', 'sparse', 'dense', 'e-pack-reg', 'e-reg-sparse', 'e-reg-dense'], compare: ['serve'] },
    explanation: 'The sparse operand now enters the kernel compatibility matrix. A 2:4 fp16 path may be legal on Ampere-and-newer NVIDIA GPUs through Sparse Tensor Cores, while another device or shape falls back to dense math.',
  };

  yield {
    state: kernelGraph('Shadow, canary, then serve'),
    highlight: { active: ['shadow', 'canary', 'serve', 'e-model-shadow', 'e-shadow-canary', 'e-canary-serve'], found: ['sparse'], compare: ['dense'] },
    explanation: 'Promotion is an evaluation workflow. Shadow compares dense and pruned outputs, canary watches real latency and task regressions, and production keeps a dense fallback. Sparse checkpoints are not safe just because perplexity moved little on one benchmark.',
  };

  yield {
    state: labelMatrix(
      'Complete deployment packet',
      [
        { id: 'ckpt', label: 'ckpt' },
        { id: 'mask', label: 'mask' },
        { id: 'calib', label: 'data' },
        { id: 'kernel', label: 'kernel' },
        { id: 'bench', label: 'bench' },
        { id: 'flag', label: 'flag' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'check', label: 'check' },
        { id: 'why', label: 'why' },
        { id: 'exit', label: 'exit' },
      ],
      [
        ['dense ref', 'diff', 'replay', 'keep'],
        ['N:M map', 'valid', 'audit', 'hash'],
        ['data hash', 'slice', 'drift', 'freeze'],
        ['arch key', 'compat', 'legal', 'route'],
        ['slices', 'stress', 'quality', 'pass'],
        ['rollback', 'flag', 'ops', 'ready'],
      ],
    ),
    highlight: { active: ['ckpt:artifact', 'mask:artifact', 'calib:artifact', 'kernel:artifact', 'bench:artifact', 'flag:artifact'], found: ['mask:check', 'kernel:check', 'bench:check', 'flag:exit'] },
    explanation: 'A complete pruning deployment packet contains the dense reference checkpoint, mask map, calibration hash, kernel target, benchmark evidence, and feature flag. The data structure lets the team answer what was removed, why, where it runs, and how to reverse it.',
  };
}

function* qualityGate() {
  yield {
    state: plotState({
      axes: { x: { label: 'sparsity', min: 0, max: 0.75 }, y: { label: 'quality drop', min: 0, max: 0.16 } },
      series: [
        { id: 'mag', label: 'magnitude', points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.02 }, { x: 0.5, y: 0.09 }, { x: 0.6, y: 0.15 }] },
        { id: 'wanda', label: 'Wanda', points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.01 }, { x: 0.5, y: 0.035 }, { x: 0.6, y: 0.08 }] },
        { id: 'sgpt', label: 'SparseGPT', points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.008 }, { x: 0.5, y: 0.02 }, { x: 0.6, y: 0.05 }] },
      ],
      markers: [
        { id: 'gate', x: 0.5, y: 0.04, label: 'ship gate' },
      ],
    }),
    highlight: { active: ['wanda', 'sgpt', 'gate'], compare: ['mag'] },
    explanation: 'The first quality gate is a frontier, not a single score. Magnitude pruning is the baseline. Wanda and SparseGPT-style methods use more information to keep the loss curve lower at the same sparsity, but every product still needs its own task slices.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sparsity', min: 0, max: 0.75 }, y: { label: 'speedup', min: 0.8, max: 2.1 } },
      series: [
        { id: 'dense', label: 'dense', points: [{ x: 0, y: 1.0 }, { x: 0.75, y: 1.0 }] },
        { id: 'unstruct', label: 'unstruct', points: [{ x: 0, y: 1.0 }, { x: 0.5, y: 1.05 }, { x: 0.75, y: 1.08 }] },
        { id: 'nm', label: '2:4', points: [{ x: 0, y: 1.0 }, { x: 0.5, y: 1.45 }, { x: 0.6, y: 1.55 }] },
      ],
      markers: [
        { id: 'kernel', x: 0.5, y: 1.45, label: 'kernel ok' },
      ],
    }),
    highlight: { active: ['nm', 'kernel'], compare: ['unstruct', 'dense'] },
    explanation: 'Unstructured sparsity can reduce parameter count without reducing wall-clock latency, because dense GEMM pipelines still see irregular work. Structured 2:4 sparsity is valuable because libraries and hardware can skip work predictably when the kernel path is legal.',
  };

  yield {
    state: labelMatrix(
      'Slice gate before rollout',
      [
        { id: 'ppl', label: 'ppl' },
        { id: 'math', label: 'math' },
        { id: 'code', label: 'code' },
        { id: 'safety', label: 'safe' },
        { id: 'lat', label: 'lat' },
        { id: 'mem', label: 'memory' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'gate', label: 'gate' },
        { id: 'fail', label: 'fail' },
        { id: 'action', label: 'action' },
      ],
      [
        ['held out', 'delta ok', 'ppl jump', 'block'],
        ['reasoning', 'no cliff', 'math drop', 'retry'],
        ['syntax', 'no cliff', 'code drop', 'protect'],
        ['refusals', 'no drift', 'unsafe', 'rollback'],
        ['p50+p99', 'faster', 'tail up', 'fallback'],
        ['GB/token', 'lower', 'no save', 'repack'],
      ],
    ),
    highlight: { active: ['math:gate', 'code:gate', 'safety:gate', 'lat:gate'], found: ['mem:gate'], compare: ['safety:fail', 'lat:fail'] },
    explanation: 'Average perplexity is not enough. Pruning can hurt narrow capabilities first: code, math, safety classifiers, rare languages, long-context recall, or tool-use schemas. The gate should combine quality slices with p50, p99, and memory evidence.',
  };

  yield {
    state: labelMatrix(
      'Choose the compression stack',
      [
        { id: 'distill', label: 'distill' },
        { id: 'prune', label: 'prune' },
        { id: 'quant', label: 'quant' },
        { id: 'kernel', label: 'kernel' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'changes', label: 'changes' },
        { id: 'checks', label: 'checks' },
        { id: 'pairs', label: 'pairs' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['model', 'skill loss', 'before', 'student'],
        ['mask', 'slice drop', 'after', 'mask map'],
        ['bits', 'outliers', 'after', 'scales'],
        ['layout', 'real speed', 'after', 'kernel'],
        ['traffic', 'fallbacks', 'always', 'route log'],
      ],
    ),
    highlight: { active: ['distill:changes', 'prune:changes', 'quant:changes'], found: ['kernel:checks', 'route:checks'], compare: ['route:artifact'] },
    explanation: 'Distillation, pruning, and quantization attack different redundancy. A good inference stack may use all three, but the order matters: train or distill the behavior, prune a legal mask, quantize with calibration, then prove the kernel and route actually improve serving.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'mask', label: 'bad mask' },
        { id: 'calib', label: 'bad calib' },
        { id: 'kernel', label: 'no kernel' },
        { id: 'metric', label: 'avg metric' },
        { id: 'drift', label: 'data drift' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
        { id: 'log', label: 'log' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        ['skill loss', 'slice eval', 'mask id', 'dense'],
        ['tail hurt', 'data hash', 'calib id', 'rescore'],
        ['no speed', 'compat key', 'route id', 'dense'],
        ['hidden cliff', 'stress set', 'slice id', 'block'],
        ['regress', 'shadow run', 'flag id', 'off'],
      ],
    ),
    highlight: { active: ['mask:control', 'kernel:control', 'metric:control', 'drift:control'], found: ['mask:rollback', 'kernel:rollback', 'drift:rollback'], compare: ['metric:symptom'] },
    explanation: 'Most pruning failures are not mysterious. They come from an illegal or low-quality mask, calibration data that misses real traffic, a dense fallback hiding behind the sparse checkpoint, or a benchmark average that masks capability cliffs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mask ledger') yield* maskLedger();
  else if (view === 'kernel path') yield* kernelPath();
  else if (view === 'quality gate') yield* qualityGate();
  else throw new InputError('Pick a structured-pruning view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Structured pruning removes model weights under a pattern that serving hardware and kernels can exploit. Ordinary pruning asks which connections can be deleted. Production N:M pruning adds a stricter data-structure question: can each small group of weights satisfy a legal mask, can that mask be packed into the layout expected by the sparse matrix library, and can the resulting route beat the dense fallback without quality loss?',
        'This belongs between Knowledge Distillation, Quantization, Activation-Aware Quantization Calibration Ledger, Transformer Inference Roofline, and Accelerator Kernel Compatibility Matrix. Distillation trains a smaller behavior, quantization stores numbers with fewer bits, and pruning deletes or packs connections. The methods combine well, but each changes a different artifact and has a different failure mode.',
      ],
    },
    {
      heading: 'Mask data structure',
      paragraphs: [
        'The mask is the core structure. For unstructured pruning, it can be a bit per weight. For 2:4 sparsity, every group of four weights must contain exactly two zeros and two kept entries. The compressed operand then stores the kept values plus compact metadata for their positions. This regularity is why a sparse Tensor Core or sparse GEMM implementation can skip work predictably.',
        'The scoring side table matters as much as the final mask. Magnitude pruning ranks weights by absolute value. Wanda ranks by weight magnitude multiplied by activation statistics gathered from calibration data. SparseGPT uses a layer-wise reconstruction objective designed for large GPT-family models. The mask therefore depends on weight tensor, score rule, calibration sample, grouping rule, and target kernel layout.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a team wants to compress the feed-forward and projection matrices of a production LLM for Ampere-class GPUs. The dense checkpoint is frozen as the rollback reference. A calibration set is selected from real prompt slices, and activation statistics are recorded with data hashes. The pruning job scores each target layer, enforces a 2:4 mask inside every four-weight group, writes a mask map, and emits a packed values-plus-indices artifact.',
        'The artifact is then checked against the kernel compatibility matrix: architecture, dtype, layout, alignment, shape bucket, and sparse GEMM support. Shadow traffic compares dense and sparse outputs. Canary traffic measures p50, p99, memory, fallback rate, perplexity, domain tasks, code, math, safety, and long-context slices. Only after those gates pass does the feature flag ramp. The dense checkpoint and dense route remain available until the sparse path has operational history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Pruning saves memory only when zeros are represented compactly or packed away. It saves time only when the execution path uses kernels that exploit the pattern. A model with 50% zeros can still run at dense speed if the runtime stores it as a dense tensor or falls back to dense matmul. N:M sparsity is less flexible than arbitrary sparsity, but it is easier for hardware to schedule.',
        'Quality cost is workload-dependent. Some layers, channels, languages, or capabilities are more fragile than others. A small average loss can hide a large regression on code generation, math reasoning, refusal behavior, or rare-domain labels. That is why the pruning artifact needs an evaluation ledger instead of a single benchmark number.',
      ],
    },
    {
      heading: 'Sources and concrete systems',
      paragraphs: [
        'Primary sources: NVIDIA cuSPARSELt structured sparsity workflow and 2:4 sparse Tensor Core discussion at https://developer.nvidia.com/blog/exploiting-ampere-structured-sparsity-with-cusparselt/ and https://docs.nvidia.com/cuda/cusparselt/. NVIDIA describes the A100 2:4 pattern as requiring at least two zeros in every four-element group for the sparse operand, then compressing values with metadata for sparse matrix multiply.',
        'SparseGPT shows one-shot pruning for GPT-family models and reports pruning large OPT and BLOOM models with 50% or higher sparsity: https://arxiv.org/abs/2301.00774 and code at https://github.com/IST-DASLab/sparsegpt. Wanda introduces a simple activation-aware score for LLM pruning: https://arxiv.org/abs/2306.11695. The Lottery Ticket Hypothesis is the classic sparse-subnetwork lens: https://arxiv.org/abs/1803.03635. PyTorch documents semi-structured 2:4 training support at https://pytorch.org/blog/accelerating-neural-network-training/, and LLM Compressor exposes Wanda with N:M mask structures at https://docs.vllm.ai/projects/llm-compressor/en/0.8.1/reference/llmcompressor/modifiers/pruning/wanda/.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse parameter sparsity with latency improvement. Unstructured sparsity can reduce checkpoint size while increasing runtime overhead. Do not confuse legal mask with safe model behavior; the mask can be hardware-valid and still damage rare skills. Do not reuse a generic calibration set blindly; activation-aware pruning is only as representative as the activations it sees.',
        'The strongest mental model is checkpoint surgery with a control plane. The surgery removes connections, but the control plane records score rule, mask legality, packed layout, kernel target, benchmark slices, canary results, and rollback route. That is what turns pruning from a paper result into a maintainable serving optimization.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Knowledge Distillation for behavior compression, Quantization for bit-width compression, Activation-Aware Quantization Calibration Ledger for calibration-aware scale and packing decisions, MatMul-Free Language Modeling for a more radical operation-level redesign, Transformer Inference Roofline for why sparsity only helps when it changes the bottleneck, Inference Kernel Fusion & CUDA Graphs for serving fast paths, Accelerator Kernel Compatibility Matrix for legal dispatch, Benchmark Variance Model Selection for evaluation gates, and Heterogeneous AI Compute Workload Router for rollout and fallback policy.',
      ],
    },
  ],
};
