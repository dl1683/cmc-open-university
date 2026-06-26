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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a constrained sparsity pattern. Sparsity means some weights in a neural network are zero, and N:M sparsity means exactly N weights are kept inside each group of M weights. Active groups show where the pruning rule is being applied.',
        'Removed weights are zeros created by the pruning policy. Found markers show groups that satisfy the hardware-readable pattern. The safe inference is that 2:4 sparsity is not arbitrary compression; each group of 4 must keep exactly 2 nonzero weights for the accelerator path to apply.',
        {type:"callout", text:"N:M sparsity wins by constraining pruning into hardware-regular groups instead of chasing arbitrary zero patterns."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png", alt:"Black nonzero entries scattered across a mostly empty sparse matrix.", caption:"Sparse matrix pattern from a finite-element problem; Oleg Alexandrov, public domain, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large neural networks spend most inference time in matrix multiplication. If many weights are zero, a machine could skip multiply-add work. The hard part is making the zeros predictable enough for hardware to exploit without destroying model quality.',
        'N:M structured pruning exists as a compromise. It gives the model some freedom to choose which weights survive while giving the accelerator a regular pattern. The result is less flexible than arbitrary sparsity but much easier to execute efficiently.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is magnitude pruning: remove the smallest weights wherever they appear. It is intuitive because small weights often matter less, and it can create high global sparsity. The result, however, is an irregular pattern.',
        'Irregular sparsity is expensive to use. The accelerator needs indexes, gathers, masks, and branchy control to skip zeros. At moderate sparsity, that overhead can erase the saved math. A 50 percent sparse matrix is not automatically twice as fast.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hardware behavior. Dense matrix units are fast because memory access and arithmetic are regular. Random zero positions break that regularity. The machine may spend more time discovering what to skip than it saves by skipping.',
        'The training wall is accuracy. Forcing zeros after training can damage important channels or attention projections. A practical method must prune, fine-tune, and sometimes train with masks so the remaining weights absorb lost capacity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Constrain sparsity locally. In 2:4 sparsity, every consecutive group of 4 weights keeps 2 and prunes 2. The hardware can assume the same density in every group and use compact metadata to identify which two positions survive.',
        'The invariant is group legality. Every pruned tensor region that claims 2:4 acceleration must satisfy the 2 kept, 2 removed rule for each aligned group. If one group keeps 3 or 1, the advertised sparse kernel cannot treat the tensor as valid 2:4 input.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pruning pass divides each eligible weight tensor into aligned groups of M weights along the hardware-supported dimension. For each group, it scores weights, often by absolute magnitude or a learned importance measure. It keeps the N best weights and sets the rest to zero.',
        'Fine-tuning then updates the remaining weights while the mask stays fixed or changes under a schedule. During inference, the sparse kernel reads the compact nonzero values plus metadata and performs only the supported operations. Layers that are sensitive or unsupported may stay dense.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness has two parts. Numerically, the sparse model computes the same function as the dense model with the pruned weights set to zero; fine-tuning tries to make that function accurate. Structurally, every group obeys the N:M rule, so the sparse kernel and metadata agree about which positions exist.',
        'The speed argument works only if the structure matches the accelerator. Regular groups let the hardware schedule sparse matrix multiply without general sparse indexing. The model gives up arbitrary zero placement in exchange for predictable execution.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Pruning itself is O(number of weights) for scoring and masking, plus fine-tuning cost. If a 1 billion weight model uses 2:4 sparsity on eligible weights, it stores roughly half of those values plus metadata, not zero cost. Doubling the model doubles the pruning scan and roughly doubles sparse storage.',
        'Inference speed depends on kernel support, layer shapes, batch size, memory bandwidth, and metadata overhead. The theoretical math reduction for 2:4 is 50 percent on eligible operations. End-to-end latency improves less because embedding, normalization, softmax, attention memory traffic, and unsupported layers remain.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Structured sparsity is used when the deployment hardware has explicit support for the pattern. NVIDIA Ampere and later tensor cores popularized 2:4 sparse acceleration for some matrix operations. The best fit is large linear layers where matrix multiply dominates.',
        'It is also useful for compression experiments and serving-cost studies. A team can compare dense, quantized, sparse, and sparse-plus-quantized models under the same accuracy target. The useful result is end-to-end tokens per second or cost per request, not just parameter sparsity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails without matching kernels. A CPU or GPU path that treats the tensor as ordinary dense data will still multiply by zeros. A general sparse library may be slower than dense for small matrices or low batch sizes.',
        'It also fails when the model quality drop is too large. Some layers, heads, or projections carry information that a rigid group rule damages. Fine-tuning may recover accuracy, but the recovery cost and evaluation burden are part of the method.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take one group of 4 weights: [-0.10, 0.70, 0.05, -0.40]. Under 2:4 magnitude pruning, keep 0.70 and -0.40 because they have the largest absolute values. The group becomes [0, 0.70, 0, -0.40], and metadata records positions 1 and 3.',
        'For a matrix with 4096 by 4096 weights, there are 16,777,216 weights. 2:4 keeps 8,388,608 values and prunes 8,388,608 values before metadata. In fp16, values fall from about 32 MB to 16 MB, but metadata, alignment, unsupported layers, and activation movement determine the real memory and latency win.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with NVIDIA Ampere structured sparsity at https://developer.nvidia.com/blog/accelerating-inference-with-sparsity-using-ampere-and-tensorrt/. Then read NVIDIA cuSPARSELt at https://docs.nvidia.com/cuda/cusparselt/ and the Lottery Ticket Hypothesis paper at https://arxiv.org/abs/1803.03635 for pruning context.',
        'Study Sparse Matrix Formats for general sparsity and Quantization for lower precision. Then connect Matrix Multiplication Tiling, Knowledge Distillation, and Model Serving Roofline to the actual latency and quality tradeoff.',
      ],
    },
  ],
};
