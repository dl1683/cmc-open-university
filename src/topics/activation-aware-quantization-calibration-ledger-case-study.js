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
    explanation: 'The highlighted channels are not the largest weights; they are the channels that become large under representative activations. Round-to-nearest sees only weights. Activation-aware quantization keeps calibration evidence so it can protect channels that matter at runtime.',
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
    explanation: 'The bad-pack point separates storage from serving speed. A quarter-sized weight file can still run slowly if the runtime unpacks poorly, falls back to fp16, or uses a layout the accelerator cannot consume directly.',
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

const activationAwareQuantizationArticleSections = [
  {
    heading: 'Why This Exists',
    paragraphs: [
      'Basic quantization asks how many bits are needed to store a model. Activation-aware quantization asks a harder production question: which low-bit representation preserves behavior on the prompts the model will actually see, and can the serving stack execute that representation quickly? Large language models are often limited by weight memory, memory bandwidth, and device RAM. A 4-bit checkpoint can make a model fit where fp16 cannot. The danger is that a bit-width label hides the evidence that created the checkpoint. Two int4 models can differ in calibration data, group size, protected channels, scale rules, zero-points, packing layout, and kernel support. This case study exists because production quantization is not just compression. It is a ledger of measurements and decisions.',
    ],
  },
  {
    heading: 'The Obvious Approach',
    paragraphs: [
      'The obvious baseline is round-to-nearest. Pick a scale for a tensor or group, divide each weight by that scale, round to the closest small integer, and store the result. This is not a foolish baseline. It is simple, fast, and gives a clear first measurement of how much error the model tolerates. If the weights are well behaved and the target precision is moderate, RTN can be surprisingly strong. The baseline also teaches the important failure mode. It sees weights but not how those weights are used. A channel with modest weights can dominate runtime behavior if real activations make it large. A channel with a large isolated weight can force a coarse scale that damages many smaller values.',
    ],
  },
  {
    heading: 'The Wall',
    paragraphs: [
      'The wall is activation outliers. Transformers often contain channels that are quiet on average but large on important prompts. A weight-only view can miss them, and a global scale can spend too much numeric range on one outlier while collapsing useful small weights toward zero. The serving wall is separate. A checkpoint can be accurate in an offline script and still be useless if the runtime cannot load the packed format, if the group size does not match the kernel, or if dequantization erases the expected speedup. Evaluation adds a third wall. Average perplexity can look fine while code, math, tool calling, refusal behavior, or a narrow customer domain regresses. The ledger exists to keep these failures inspectable.',
    ],
  },
  {
    heading: 'Core Insight',
    paragraphs: [
      'The core insight is that calibration evidence must travel with the compressed model. Activation-aware methods collect representative samples, record activation statistics, identify salient channels, choose transforms or reconstruction rules, and then pack the low-bit weights with metadata that the loader can verify. AWQ protects activation-salient channels through an equivalent scaling transform while keeping a hardware-friendly weight-only path. GPTQ treats quantization as a layer-wise reconstruction problem using approximate second-order information. SmoothQuant targets W8A8 execution by migrating activation-outlier difficulty into weights with an equivalent transform. These methods differ, but they share the same operational lesson: a quantized checkpoint is a data structure, not just a smaller tensor file.',
    ],
  },
  {
    heading: 'How It Works',
    paragraphs: [
      'A production run starts from a frozen fp16 or bf16 checkpoint. The team selects calibration prompts that represent the deployment workload, then records sample ids or hashes so the run can be reproduced. During a forward pass, the quantizer collects per-channel activation statistics such as p99 or max values. It combines those statistics with weight magnitudes, reconstruction estimates, or method-specific scores. The method chooses scales, group sizes, zero-points or equivalent transforms, and sometimes protected channels. The weights are then quantized and packed into records the runtime understands: integer payloads plus scale metadata, group layout, format id, and method version. A loader test verifies that the exact serving kernel can consume the artifact. An evaluation gate checks task slices and latency before the model ships.',
    ],
  },
  {
    heading: 'What The Visual Proves',
    paragraphs: [
      'The calibration matrix proves why looking only at weight magnitude is incomplete. The highlighted channels are important because their activations become large under representative inputs, not because their raw weights are the largest. The AWQ-style table shows the control move: salient channels receive scaling protection while the layer still packs into a uniform low-bit format. The packed int4 group record proves that the checkpoint is not smaller floats. It is integer nibbles plus scale and zero-point metadata. The method map shows that RTN, GPTQ, AWQ, and SmoothQuant consume different evidence. The serve-gate plots prove the last point: quality drop, packed bytes, speedup, p99 latency, and loader compatibility are separate axes. A quarter-sized file is not a deployment win if it routes through a slow fallback.',
    ],
  },
  {
    heading: 'Why It Works',
    paragraphs: [
      'Activation-aware quantization works when calibration statistics predict which numeric errors will matter at inference. If a channel is often amplified by real activations, small weight error in that channel can cause large output error. Protecting that channel can reduce downstream damage more than spending equal precision everywhere. Equivalent transforms preserve the mathematical function before quantization: scale one side of a multiplication and compensate on the other side, then quantize the easier representation. GPTQ uses a different argument, trying to minimize layer reconstruction error after quantization so the layer output stays close on calibration inputs. The correctness is empirical rather than absolute. The ledger protects the claim by tying every scale and pack decision to data identity, method version, target kernel, and evaluation slices.',
    ],
  },
  {
    heading: 'Cost And Tradeoffs',
    paragraphs: [
      'The cost starts with calibration. More samples can reveal rare activation outliers, but they increase quantization time and can overfit if the set is narrow. Smaller groups reduce outlier damage because each scale covers fewer weights, but they add metadata and can reduce kernel efficiency. Four-bit weight-only quantization saves memory bandwidth, but activations may still be fp16 or bf16. W8A8 paths can accelerate matrix multiplication more directly, but activation quantization is often harder and more sensitive to outliers. The serving system must track p50 and p99 latency, memory, tokens per second, fallback rate, loader format, and quality by slice. The headline bit width is only the starting point. The tax is operational complexity.',
    ],
  },
  {
    heading: 'Where It Wins',
    paragraphs: [
      'Activation-aware quantization wins when weights or memory bandwidth are the bottleneck and the model has enough redundancy to tolerate low-bit storage. It is especially useful for on-device inference, desktop GPUs with limited VRAM, edge deployments, and high-throughput serving where moving fewer bytes changes the roofline. AWQ-style weight-only paths are attractive when the runtime has efficient int4 kernels and activation quantization would be too risky. SmoothQuant-style W8A8 paths are attractive when the hardware has strong int8 matrix multiplication and activation outliers can be smoothed safely. The ledger is useful even when the chosen method fails, because it tells the team whether to resample calibration data, shrink group size, protect different channels, repack for the loader, or block rollout.',
    ],
  },
  {
    heading: 'Where It Fails',
    paragraphs: [
      'The method fails when the calibration set does not match deployment. A customer may use legal documents, code, math, multilingual text, or long prompts that never appeared in the calibration packet. It also fails when average benchmarks hide fragile slices. Some errors appear only in rare safety decisions, structured output, or exact arithmetic. Kernel mismatch is another common failure: the model may load but silently dequantize to fp16, expand weights on the CPU, or use a layout the accelerator cannot consume efficiently. Overcompression can push the model past a cliff where no scale trick recovers behavior. Treat every quantized checkpoint as a new model variant with its own evidence, not as a harmless storage optimization.',
    ],
  },
  {
    heading: 'Study Next',
    paragraphs: [
      'Study the basic Quantization page first for scale, rounding, clipping, and error maps. Then read Transformer Inference Roofline to understand why fewer bytes only help when memory movement is the bottleneck. Accelerator Kernel Compatibility Matrix explains why a packed checkpoint needs a legal dispatch path. KV Cache Quantization & Compression covers request-state compression, which becomes the bottleneck for long contexts even after weights shrink. Structured Pruning and N:M Sparsity shows a different compression contract between masks and kernels. Knowledge Distillation explains how to train a smaller model before compressing it. Primary method sources are GPTQ, AWQ, and SmoothQuant; format sources include compressed-tensors and LLM Compressor compression schemes.',
    ],
  },
];

export const article = {
  sections: activationAwareQuantizationArticleSections,
};
