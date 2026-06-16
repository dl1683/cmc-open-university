// Activation-aware quantization: calibration samples, channel statistics,
// scaling decisions, packed checkpoints, and serving gates for low-bit LLMs.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'activation-aware-quantization-calibration-ledger-case-study',
  title: 'Activation-Aware Quantization Calibration Ledger',
  category: 'AI & ML',
  summary: 'A post-training quantization case study: collect calibration activations, protect outlier channels, choose AWQ/GPTQ/SmoothQuant-style transforms, pack low-bit weights, and gate serving quality.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['calib ledger', 'method map', 'serve gate'], defaultValue: 'calib ledger' },
  ],
  run,
};

const CHANNELS = [
  { id: 'c0', label: 'c0' },
  { id: 'c1', label: 'c1' },
  { id: 'c2', label: 'c2' },
  { id: 'c3', label: 'c3' },
  { id: 'c4', label: 'c4' },
  { id: 'c5', label: 'c5' },
];

const ROWS = [
  { id: 'abs', label: '|w|max' },
  { id: 'act', label: 'act p99' },
  { id: 'score', label: 'score' },
  { id: 'scale', label: 'scale' },
  { id: 'bits', label: 'bits' },
];

const WEIGHT_MAX = [0.52, 0.28, 0.91, 0.35, 0.18, 0.64];
const ACT_P99 = [0.8, 3.7, 0.9, 1.4, 5.2, 1.1];
const SCORE = WEIGHT_MAX.map((w, i) => w * ACT_P99[i]);
const SCALE = [1.0, 1.55, 1.0, 1.0, 1.8, 1.0];
const BITS = [4, 4, 4, 4, 4, 4];

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

function methodGraph(title) {
  return graphState({
    nodes: [
      { id: 'ckpt', label: 'ckpt', x: 0.8, y: 3.7, note: 'fp16' },
      { id: 'calib', label: 'calib', x: 2.4, y: 3.7, note: 'samples' },
      { id: 'rtn', label: 'RTN', x: 4.1, y: 1.4, note: 'round' },
      { id: 'gptq', label: 'GPTQ', x: 4.1, y: 2.9, note: 'H approx' },
      { id: 'awq', label: 'AWQ', x: 4.1, y: 4.5, note: 'act scale' },
      { id: 'smooth', label: 'SmoothQ', x: 4.1, y: 6.1, note: 'W8A8' },
      { id: 'scales', label: 'scales', x: 6.2, y: 3.0, note: 'group' },
      { id: 'pack', label: 'pack', x: 6.2, y: 5.0, note: 'int4' },
      { id: 'kernel', label: 'kernel', x: 8.0, y: 4.0, note: 'legal?' },
      { id: 'eval', label: 'eval', x: 9.4, y: 2.8, note: 'slices' },
      { id: 'serve', label: 'serve', x: 9.4, y: 5.2, note: 'flag' },
    ],
    edges: [
      { id: 'e-ckpt-calib', from: 'ckpt', to: 'calib' },
      { id: 'e-calib-rtn', from: 'calib', to: 'rtn' },
      { id: 'e-calib-gptq', from: 'calib', to: 'gptq' },
      { id: 'e-calib-awq', from: 'calib', to: 'awq' },
      { id: 'e-calib-smooth', from: 'calib', to: 'smooth' },
      { id: 'e-gptq-scales', from: 'gptq', to: 'scales' },
      { id: 'e-awq-scales', from: 'awq', to: 'scales' },
      { id: 'e-smooth-scales', from: 'smooth', to: 'scales' },
      { id: 'e-scales-pack', from: 'scales', to: 'pack' },
      { id: 'e-pack-kernel', from: 'pack', to: 'kernel' },
      { id: 'e-kernel-eval', from: 'kernel', to: 'eval' },
      { id: 'e-kernel-serve', from: 'kernel', to: 'serve' },
    ],
  }, { title });
}

function* calibLedger() {
  yield {
    state: matrixState({
      title: 'Calibration sees activation outlier channels',
      rows: ROWS.slice(0, 3),
      columns: CHANNELS,
      values: [WEIGHT_MAX, ACT_P99, SCORE],
      format: (value) => value.toFixed(2),
    }),
    highlight: { active: ['act:c1', 'act:c4', 'score:c1', 'score:c4'], compare: ['abs:c2'] },
    explanation: 'Round-to-nearest quantization looks only at weight values. Activation-aware quantization also records which channels become large on representative prompts. AWQ argues that salient channels are better found from activation distribution than from weights alone.',
    invariant: 'The calibration packet is part of the compressed model artifact.',
  };

  yield {
    state: matrixState({
      title: 'AWQ-style protection scales salient channels',
      rows: ROWS,
      columns: CHANNELS,
      values: [WEIGHT_MAX, ACT_P99, SCORE, SCALE, BITS],
      format: (value) => value.toFixed(2),
    }),
    highlight: { active: ['scale:c1', 'scale:c4', 'score:c1', 'score:c4'], found: ['bits:c1', 'bits:c4'], compare: ['scale:c2'] },
    explanation: 'Instead of mixing precisions, AWQ uses an equivalent scaling transform to protect a small set of salient channels while still packing the layer into a hardware-friendly low-bit format. The ledger needs channel score, scale, bit width, group size, and calibration hash.',
  };

  yield {
    state: labelMatrix(
      'Packed int4 group record',
      [
        { id: 'g0', label: 'g0' },
        { id: 'g1', label: 'g1' },
        { id: 'g2', label: 'g2' },
        { id: 'g3', label: 'g3' },
      ],
      [
        { id: 'q0', label: 'q0' },
        { id: 'q1', label: 'q1' },
        { id: 'q2', label: 'q2' },
        { id: 'q3', label: 'q3' },
        { id: 'scale', label: 'scale' },
        { id: 'zp', label: 'zp' },
        { id: 'fmt', label: 'fmt' },
      ],
      [
        ['7', '-2', '1', '-6', '0.09', '0', 'int4'],
        ['-1', '6', '-5', '1', '0.07', '0', 'int4'],
        ['8', '-3', '2', '0', '0.13', '0', 'int4'],
        ['-4', '1', '5', '-3', '0.08', '0', 'int4'],
      ],
    ),
    highlight: { active: ['g0:q0', 'g0:q1', 'g0:scale', 'g1:scale'], found: ['g0:fmt', 'g1:fmt', 'g2:fmt', 'g3:fmt'] },
    explanation: 'The checkpoint is not just smaller floats. It is packed integer payloads plus scale and zero-point metadata, usually per group or per channel. Formats such as compressed-tensors and inference runtimes must agree on this layout before serving.',
  };

  yield {
    state: labelMatrix(
      'Calibration ledger',
      [
        { id: 'data', label: 'data' },
        { id: 'stat', label: 'stat' },
        { id: 'group', label: 'group' },
        { id: 'algo', label: 'algo' },
        { id: 'pack', label: 'pack' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['sample ids', 'hash', 'bad mix', 'resample'],
        ['act p99', 'drift', 'outlier', 'slice'],
        ['128 ch', 'shape', 'bad pack', 'rekey'],
        ['AWQ/GPTQ', 'version', 'overfit', 'holdout'],
        ['int4 fmt', 'kernel', 'no speed', 'fallback'],
        ['tasks', 'stress', 'cliff', 'block'],
      ],
    ),
    highlight: { active: ['data:stores', 'stat:stores', 'algo:stores', 'pack:stores'], found: ['pack:check', 'eval:check'], compare: ['eval:risk'] },
    explanation: 'A reproducible quantization artifact needs more than a bit width. Store the calibration data identity, activation stats, group size, method version, packed format, kernel target, and evaluation slices.',
  };
}

function* methodMap() {
  yield {
    state: methodGraph('Post-training quantization methods choose different evidence'),
    highlight: { active: ['ckpt', 'calib', 'rtn', 'gptq', 'awq', 'smooth', 'e-ckpt-calib'], compare: ['scales'] },
    explanation: 'Post-training quantization starts from a frozen checkpoint. RTN rounds directly. GPTQ uses approximate second-order reconstruction. AWQ uses activation-aware channel scaling. SmoothQuant migrates activation outlier difficulty into weights for W8A8 execution.',
  };

  yield {
    state: methodGraph('GPTQ optimizes layer reconstruction'),
    highlight: { active: ['gptq', 'scales', 'pack', 'e-gptq-scales', 'e-scales-pack'], compare: ['rtn'], found: ['eval'] },
    explanation: 'GPTQ treats quantization as a layer-wise reconstruction problem using approximate second-order information. Its promise is strong one-shot weight quantization for very large GPT-family models at 3 or 4 bits.',
  };

  yield {
    state: methodGraph('AWQ protects activation-salient channels'),
    highlight: { active: ['awq', 'scales', 'pack', 'e-awq-scales', 'e-scales-pack'], compare: ['rtn'], found: ['kernel'] },
    explanation: 'AWQ keeps the packed weight-only path hardware-friendly while scaling channels that matter most under calibration activations. That is why calibration sample choice becomes a first-class data structure.',
  };

  yield {
    state: methodGraph('SmoothQuant targets W8A8 kernels'),
    highlight: { active: ['smooth', 'scales', 'kernel', 'e-smooth-scales', 'e-pack-kernel'], found: ['serve'], compare: ['awq'] },
    explanation: 'SmoothQuant is aimed at quantizing both weights and activations to INT8. It smooths activation outliers by an equivalent transform, making all matrix multiplications friendlier to efficient W8A8 kernels.',
  };

  yield {
    state: labelMatrix(
      'Method selection table',
      [
        { id: 'rtn', label: 'rtn' },
        { id: 'gptq', label: 'gptq' },
        { id: 'awq', label: 'awq' },
        { id: 'smooth', label: 'sq' },
        { id: 'nvfp4', label: 'fp4' },
      ],
      [
        { id: 'uses', label: 'evid' },
        { id: 'target', label: 'path' },
        { id: 'risk', label: 'risk' },
        { id: 'artifact', label: 'out' },
      ],
      [
        ['W', 'base', 'loss', 'scales'],
        ['H', 'W4', 'time', 'qW'],
        ['act', 'W4', 'calib', 's-map'],
        ['out', 'W8A8', 'drift', 's'],
        ['blk', 'FP4', 'hw', '2scale'],
      ],
    ),
    highlight: { active: ['gptq:uses', 'awq:uses', 'smooth:uses'], found: ['awq:artifact', 'smooth:artifact'], compare: ['rtn:risk'] },
    explanation: 'The point is not method fandom. The control plane chooses based on target hardware, desired bit width, calibration budget, activation behavior, supported checkpoint format, and serving kernel.',
  };
}

function* serveGate() {
  yield {
    state: plotState({
      axes: { x: { label: 'bits/w', min: 2, max: 16 }, y: { label: 'quality drop', min: 0, max: 0.22 } },
      series: [
        { id: 'rtn', label: 'RTN', points: [{ x: 16, y: 0 }, { x: 8, y: 0.01 }, { x: 4, y: 0.11 }, { x: 3, y: 0.19 }] },
        { id: 'awq', label: 'AWQ', points: [{ x: 16, y: 0 }, { x: 8, y: 0.005 }, { x: 4, y: 0.035 }, { x: 3, y: 0.08 }] },
        { id: 'gptq', label: 'GPTQ', points: [{ x: 16, y: 0 }, { x: 8, y: 0.006 }, { x: 4, y: 0.03 }, { x: 3, y: 0.07 }] },
      ],
      markers: [
        { id: 'gate', x: 4, y: 0.04, label: 'ship gate' },
      ],
    }),
    highlight: { active: ['awq', 'gptq', 'gate'], compare: ['rtn'] },
    explanation: 'The useful plot is a quality frontier by method and bit width. Four-bit is not one thing: RTN, GPTQ, AWQ, group size, scales, zero-points, calibration data, and kernel packing all change the result.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'packed bytes', min: 0, max: 1.1 }, y: { label: 'speedup', min: 0.8, max: 4.0 } },
      series: [
        { id: 'fp16', label: 'fp16', points: [{ x: 1.0, y: 1.0 }] },
        { id: 'int8', label: 'int8', points: [{ x: 0.5, y: 1.3 }] },
        { id: 'int4', label: 'int4', points: [{ x: 0.25, y: 2.2 }] },
        { id: 'bad', label: 'bad pack', points: [{ x: 0.25, y: 0.95 }] },
      ],
      markers: [
        { id: 'kern', x: 0.25, y: 2.2, label: 'kernel ok' },
      ],
    }),
    highlight: { active: ['int4', 'kern'], compare: ['bad'], found: ['int8'] },
    explanation: 'Compression and speed are separate gates. A quarter-sized weight file can still run slowly if the runtime unpacks poorly, falls back to fp16, or uses a layout the accelerator cannot consume directly.',
  };

  yield {
    state: labelMatrix(
      'Serving gate',
      [
        { id: 'lm', label: 'lm' },
        { id: 'math', label: 'math' },
        { id: 'code', label: 'code' },
        { id: 'safe', label: 'safe' },
        { id: 'lat', label: 'lat' },
        { id: 'fmt', label: 'fmt' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'gate', label: 'gate' },
        { id: 'fail', label: 'fail' },
        { id: 'action', label: 'act' },
      ],
      [
        ['ppl', 'delta', 'jump', 'block'],
        ['GSM', 'flat', 'drop', 'retry'],
        ['HEval', 'flat', 'syntax', 'guard'],
        ['policy', 'stable', 'unsafe', 'undo'],
        ['p50/99', 'faster', 'tail', 'fallback'],
        ['loader', 'same', 'mismatch', 'reject'],
      ],
    ),
    highlight: { active: ['lm:gate', 'math:gate', 'code:gate', 'lat:gate'], found: ['fmt:gate'], compare: ['safe:fail'] },
    explanation: 'A quantized model should not ship on perplexity alone. The gate includes task slices, safety behavior, latency, p99, memory, and loader compatibility with the exact packed checkpoint format.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'calib', label: 'calib' },
        { id: 'group', label: 'group' },
        { id: 'out', label: 'outlier' },
        { id: 'pack', label: 'pack' },
        { id: 'slice', label: 'slice' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'cause', label: 'cause' },
        { id: 'log', label: 'log' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['weird text', 'bad data', 'data id', 'resample'],
        ['quality drop', 'too wide', 'g size', 'smaller'],
        ['rare cliff', 'hidden act', 'chan id', 'protect'],
        ['no speed', 'layout', 'fmt id', 'repack'],
        ['avg ok', 'slice miss', 'eval id', 'add set'],
      ],
    ),
    highlight: { active: ['calib:fix', 'out:fix', 'pack:fix', 'slice:fix'], compare: ['slice:symptom'], found: ['pack:log'] },
    explanation: 'When quantization fails, the fix should be traceable: change calibration data, shrink group size, protect an outlier channel, repack for the correct loader, or add a missing evaluation slice.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'calib ledger') yield* calibLedger();
  else if (view === 'method map') yield* methodMap();
  else if (view === 'serve gate') yield* serveGate();
  else throw new InputError('Pick an activation-aware quantization view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Activation-aware post-training quantization compresses a frozen LLM by using calibration activations to choose scales, protected channels, group sizes, and packed formats. The simple Quantization page shows rounding weights into small integers. This case study explains the production ledger around that operation: calibration data, activation outliers, group metadata, checkpoint packing, kernel compatibility, and evaluation gates.',
        'The main lesson is that low-bit quantization is a data-structure problem. A 4-bit model is not just a model with smaller numbers. It is quantized payloads plus scales, zero-points or equivalent transforms, grouping rules, outlier handling, method version, loader metadata, and serving evidence.',
      ],
    },
    {
      heading: 'Methods',
      paragraphs: [
        'GPTQ uses approximate second-order information to quantize large GPT-family models layer by layer while preserving outputs: https://arxiv.org/abs/2210.17323. AWQ finds activation-salient channels and protects them through scaling while keeping a low-bit weight-only path friendly to hardware: https://arxiv.org/abs/2306.00978. SmoothQuant targets W8A8 execution by migrating activation-outlier difficulty into weights through an equivalent transform: https://arxiv.org/abs/2211.10438.',
        'Those methods answer different questions. GPTQ asks how to reconstruct layer behavior after quantization. AWQ asks which weight channels matter under real activations. SmoothQuant asks how to make activation quantization efficient enough for INT8 matrix multiplication. Round-to-nearest is the baseline because it shows how much the evidence side table buys.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team wants to ship a 7B model on desktop and mobile GPUs. They freeze the fp16 checkpoint, collect calibration prompts from real task slices, record activation p99s and channel scores, choose AWQ for a 4-bit weight-only path, and pack weights into group records with scales. A separate loader test verifies the compressed-tensors metadata and runtime kernel agree on layout.',
        'The rollout gate checks perplexity, coding, math, policy behavior, p50/p99 latency, memory, and exact loader compatibility. If code completion regresses, the team can inspect which calibration slices and channels were used. If latency does not improve, they inspect pack format and kernel route. The ledger turns a failed quantization run into a debuggable artifact instead of a mystery checkpoint.',
      ],
    },
    {
      heading: 'Formats and serving',
      paragraphs: [
        'Serving systems need a shared representation for compressed weights. LLM Compressor documents compression schemes such as WNA16, GPTQ, AWQ, and newer low-bit formats in terms of weights, activations, calibration, symmetry, strategy, and dynamic behavior: https://docs.vllm.ai/projects/llm-compressor/en/latest/guides/compression_schemes/. Hugging Face compressed-tensors extends safetensors-style checkpoints to store quantized and packed tensor metadata: https://huggingface.co/docs/transformers/en/quantization/compressed_tensors.',
        'This is where Accelerator Kernel Compatibility Matrix matters. A model can be accurately quantized and still serve poorly if the loader unpacks on the CPU, the GPU lacks the expected low-bit kernel, group sizes do not match the runtime, or activation quantization forces a fallback.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Calibration data can overfit or miss the task slice that matters. Group size can hide outliers. A format can load but route to a slow fallback. A headline bit width can hide different scale strategies. Average perplexity can miss code, math, multilingual, refusal, or tool-call regressions. Treat every quantized checkpoint as a new model variant, not a harmless storage optimization.',
        'Activation-aware quantization also composes with Structured Pruning and N:M Sparsity, Knowledge Distillation, KV Cache Quantization & Compression, and On-Device LLM Inference Cost Crossover. The right stack depends on whether the bottleneck is model bytes, KV bytes, p99 latency, battery, or quality.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Quantization first for the basic scale-and-round recipe. Then read Structured Pruning and N:M Sparsity for mask-and-kernel compression, Transformer Inference Roofline for why byte savings must change the bottleneck, Accelerator Kernel Compatibility Matrix for legal dispatch, KV Cache Quantization & Compression for request-state compression, On-Device LLM Inference Cost Crossover for edge deployment, and Benchmark Variance Model Selection before trusting a single quantized benchmark.',
      ],
    },
  ],
};
