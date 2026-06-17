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
      heading: 'Problem',
      paragraphs: [
        'Large neural networks contain redundancy, but deleting weights is not automatically useful. A model can have many zeros and still run at dense speed if the accelerator, compiler, and matrix library cannot exploit those zeros. A compressed checkpoint can also be smaller while silently losing a narrow capability that the average benchmark does not expose.',
        'Structured pruning and N:M sparsity turn compression into a systems problem. The team must choose which weights to remove, enforce a mask pattern that kernels support, pack the remaining values into the expected layout, prove the sparse path actually dispatches, and roll out the result with quality and rollback gates. The topic is not only model surgery; it is mask data structure, kernel compatibility, and production evidence ledger.',
      ],
    },
    {
      heading: 'Naive pruning',
      paragraphs: [
        'The naive idea is magnitude pruning: sort weights by absolute value and set the smallest ones to zero. That often works as a first experiment because small weights can contribute less to the output than large weights. If the model is fine-tuned after pruning, some lost accuracy may recover.',
        'The naive idea breaks in two ways. First, small by magnitude does not always mean unimportant. A small weight connected to a high-activation feature can matter more than a larger weight connected to a quiet feature. Second, arbitrary zeros are irregular. Dense matrix multiplication pipelines do not become fast just because the tensor contains zeros at random positions.',
        'The other naive mistake is to stop at a masked dense tensor. A matrix with zeros still has the original shape. If the runtime stores it densely and launches dense GEMM, the hardware still reads and schedules those zero positions. Parameter sparsity and wall-clock speed are different claims.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that production pruning has three gates, and all three must pass. The mask must be legal for the target pattern. The model must still perform well on task slices. The serving stack must dispatch a sparse kernel that is actually faster for the shape, dtype, batch size, and device.',
        'These gates are independent. A legal 2:4 mask can damage code generation. A high-quality sparse checkpoint can miss the sparse kernel path and run as dense fallback. A sparse kernel can be faster at one batch shape and slower at another because metadata handling, alignment, memory bandwidth, or launch overhead dominates.',
        'That is why a pruning deployment needs a ledger. The ledger records dense checkpoint id, target layers, scoring rule, calibration data hash, grouping rule, N:M pattern, mask id, packed layout, kernel target, compatibility result, quality slices, latency evidence, fallback route, and rollback target. Without it, pruning becomes an unrepeatable checkpoint mutation.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to trade pruning freedom for regularity. Unstructured pruning can remove any weight, which gives the optimizer many choices but gives the hardware a messy pattern. N:M sparsity restricts each small group of M weights so that only N are kept. In a 2:4 pattern, every four-weight group keeps two entries and removes two.',
        'That local rule is the data-structure trick. Each group can be represented by kept values plus tiny position metadata. The kernel knows that every group has the same density, so it can schedule predictable sparse matrix work instead of chasing arbitrary indices. The price is that the pruning algorithm must choose the best legal pattern inside each group, not the best global set of weights.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A pruning pass begins with a frozen dense reference. The system chooses target tensors, usually large linear layers where matrix multiplication dominates runtime. It collects calibration activations from representative data. A scoring rule ranks candidate weights inside each group. Magnitude pruning uses absolute weight size. Activation-aware methods multiply or otherwise combine weight information with activation statistics. Reconstruction-style methods estimate output error layer by layer.',
        'The mask builder enforces the local pattern. For 2:4 sparsity, it inspects each consecutive group of four candidate weights and keeps the two best according to the scorer. The debug artifact may be a dense-shaped tensor where removed weights are zero. The serving artifact is different: packed kept values plus metadata that tells the sparse kernel which positions survived.',
        'After packing, the artifact enters a kernel compatibility matrix. Device architecture, dtype, layout, alignment, matrix dimensions, batch shape, and library support decide whether the sparse path is legal. Only then does benchmarking mean anything. A sparse checkpoint that goes through dense fallback should be treated as a quality experiment, not a serving-speed win.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take one row of weights split into two groups of four: [0.62, -0.15, 0.08, -0.48] and [0.21, -0.06, 0.39, -0.33]. A pure magnitude scorer would keep 0.62 and -0.48 in the first group, then 0.39 and -0.33 in the second group. An activation-aware scorer can change that decision if a smaller weight is attached to a much more active input channel.',
        'The mask for the first group might be [keep, zero, zero, keep]. The dense debug tensor becomes [0.62, 0, 0, -0.48]. The packed serving representation stores values [0.62, -0.48] and positions [0, 3]. The important point is that the original layer shape remains conceptually the same, but the operand handed to the kernel is no longer just a dense array with zeros.',
        'A complete deployment uses this process layer by layer. It freezes the dense model as rollback reference, writes a mask map, packs sparse operands, checks sparse kernel support, compares dense and sparse outputs under shadow traffic, then canaries the sparse route. The dense route stays available until quality and latency evidence are both stable.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The mask-ledger view starts with dense weights, then scores them with activation context, then applies a 2:4 mask. The key lesson is that the mask is not only a visualization of zeros. It is a legal object with a local invariant: every four-weight block has exactly two kept entries.',
        'The packed-operand frame shows the transition from mathematical sparsity to serving representation. Values and small indices are stored together because the kernel needs both. The pruning ledger frame adds the production metadata: pattern, scorer, calibration packet, packed layout, kernel, eval, and rollback gate.',
        'The kernel-path view separates legality from dispatch. A mask can be legal, but a device or shape can still miss the sparse path. The quality-gate view separates speed from behavior. The frontier plot and slice gate show that a model can be smaller and faster while failing a narrow capability test.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'N:M sparsity works when the removed weights were not essential for the target distribution and the regular pattern lets hardware skip enough work to matter. The local constraint gives the kernel a predictable density. The packed representation reduces the amount of useful data moved and multiplied, while the metadata tells the kernel where the surviving values belong.',
        'Activation-aware scoring works better than blind magnitude when calibration data resembles real traffic. A weight is not important in isolation; it is important when multiplied by the activations it usually sees. Reconstruction-style methods add another view by asking which removals least disturb layer outputs.',
        'The rollout works because it keeps the dense reference available. Pruning is a lossy optimization. Safe deployment means measuring the loss by slice and preserving the ability to route back to dense when quality, safety, latency, or compatibility gates fail.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Pruning cost has several layers. Calibration needs representative data and activation collection. Mask construction needs scoring and legality checks. Packing needs format conversion and validation. Benchmarking needs enough shape coverage to prove the sparse route is not a dense fallback. Rollout needs shadow, canary, and telemetry work.',
        'The quality tradeoff is uneven. Average perplexity can move little while code, math, refusal behavior, rare languages, tool-call schemas, or long-context recall degrade. Some layers are more fragile than others. Some capabilities rely on small weights that look unimportant under a weak scorer.',
        'The performance tradeoff is also uneven. Sparse kernels shine only when the pattern, dtype, matrix shape, batch size, and hardware align. Metadata handling and packing overhead can eat the benefit. In bandwidth-bound paths, the memory reduction can help; in launch-bound paths, it may not.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Structured N:M pruning wins when a large fraction of serving cost sits in compatible dense linear layers and the deployment hardware has fast sparse kernels for the chosen pattern. LLM feed-forward and projection layers are natural candidates because they contain large matrix multiplications and large parameter counts.',
        'It is especially useful when paired with other compression techniques. Distillation can move behavior into a more compressible student. Pruning can remove legal connections. Quantization can reduce bit width. Kernel fusion, CUDA graphs, batching, and routing can then make the serving path use the compressed artifact efficiently.',
        'The pattern also wins in operational environments that need explicit fallback. A dense reference, sparse route, compatibility registry, and feature flag allow the team to use sparse acceleration where it is legal while routing unsupported shapes or devices to dense.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the target hardware does not support the sparse pattern or when the serving shapes miss the sparse kernel. It fails when the calibration set is narrow and the model later sees different activation distributions. It fails when evaluation relies on one average score instead of task slices.',
        'It also fails when the compression stack is applied in the wrong order without revalidation. Quantization can change the effective importance of weights. Fine-tuning can change activation statistics. Distillation can change which layers are fragile. Any later change can invalidate a mask or at least invalidate the evidence behind it.',
        'A common operational failure is silent dense fallback. The team advertises a sparse model, but telemetry shows dense kernels doing the work. Another failure is irreversible checkpoint surgery: the dense reference is lost, the mask id is unknown, or nobody can reproduce the calibration packet. At that point rollback and diagnosis become guesswork.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Quantization for bit-width compression, Activation-Aware Quantization Calibration Ledger for calibration and packing decisions, Knowledge Distillation for behavior transfer, Transformer Inference Roofline for why sparsity only helps when it changes the bottleneck, Accelerator Kernel Compatibility Matrix for legal dispatch, Sparse Format Selection Compiler Lowering for layout choices, COO and CSC sparse tensor primers for sparse representation basics, Benchmark Variance Model Selection for quality gates, and Heterogeneous AI Compute Workload Router for dense fallback and device-aware serving policy.',
      ],
    },
  ],
};
