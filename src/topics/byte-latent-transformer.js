// Byte Latent Transformer: train directly on bytes, group them into dynamic
// patches, and run the expensive global transformer over patches instead of tokens.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'byte-latent-transformer',
  title: 'Byte Latent Transformer',
  category: 'Papers',
  summary: 'A tokenizer-free LLM architecture: bytes become dynamic entropy-based patches, and the global transformer spends compute where the data is complex.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dynamic byte patches', 'fast byte generation'], defaultValue: 'dynamic byte patches' },
  ],
  run,
};

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

function bltGraph(title) {
  return graphState({
    nodes: [
      { id: 'bytes', label: 'UTF-8 bytes', x: 0.7, y: 3.8, note: 'raw text' },
      { id: 'entropy', label: 'entropy model', x: 2.4, y: 3.8, note: 'patch cuts' },
      { id: 'localEnc', label: 'local encoder', x: 4.1, y: 2.5, note: 'byte detail' },
      { id: 'patches', label: 'patch states', x: 5.8, y: 3.8, note: 'latent units' },
      { id: 'global', label: 'global transformer', x: 7.6, y: 3.8, note: 'expensive' },
      { id: 'localDec', label: 'local decoder', x: 9.2, y: 5.0, note: 'bytes out' },
    ],
    edges: [
      { id: 'e-bytes-entropy', from: 'bytes', to: 'entropy', weight: '' },
      { id: 'e-entropy-localEnc', from: 'entropy', to: 'localEnc', weight: '' },
      { id: 'e-localEnc-patches', from: 'localEnc', to: 'patches', weight: '' },
      { id: 'e-patches-global', from: 'patches', to: 'global', weight: '' },
      { id: 'e-global-localDec', from: 'global', to: 'localDec', weight: '' },
    ],
  }, { title });
}

function* dynamicBytePatches() {
  yield {
    state: labelMatrix(
      'Three ways to feed language into a model',
      [
        { id: 'chars', label: 'C' },
        { id: 'bpe', label: 'BPE' },
        { id: 'bytes', label: 'BLT' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'cost', label: 'issue' },
      ],
      [
        ['char', 'long'],
        ['subword', 'vocab'],
        ['patch', 'policy'],
      ],
    ),
    highlight: { active: ['bytes:unit', 'bytes:cost'], compare: ['bpe:cost'] },
    explanation: 'Byte Latent Transformer starts from raw UTF-8 bytes instead of a fixed BPE vocabulary. The problem is that bytes are too many time steps, so BLT groups them into dynamic patches and runs the expensive global transformer less often.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'byte position', min: 0, max: 20 }, y: { label: 'next-byte entropy', min: 0, max: 1.0 } },
      series: [
        { id: 'entropy', label: 'entropy signal', points: [
          { x: 0, y: 0.18 }, { x: 1, y: 0.15 }, { x: 2, y: 0.20 }, { x: 3, y: 0.55 }, { x: 4, y: 0.78 },
          { x: 5, y: 0.70 }, { x: 6, y: 0.22 }, { x: 7, y: 0.18 }, { x: 8, y: 0.16 }, { x: 9, y: 0.62 },
          { x: 10, y: 0.81 }, { x: 11, y: 0.74 }, { x: 12, y: 0.36 }, { x: 13, y: 0.20 }, { x: 14, y: 0.18 },
          { x: 15, y: 0.17 }, { x: 16, y: 0.44 }, { x: 17, y: 0.68 }, { x: 18, y: 0.30 }, { x: 19, y: 0.18 },
        ] },
      ],
      markers: [
        { id: 'cut1', x: 3, y: 0.55, label: 'cut' },
        { id: 'cut2', x: 9, y: 0.62, label: 'cut' },
        { id: 'cut3', x: 16, y: 0.44, label: 'cut' },
      ],
    }),
    highlight: { active: ['entropy'], found: ['cut1', 'cut2', 'cut3'] },
    explanation: 'BLT segments bytes based on next-byte entropy. Predictable spans can become longer patches; high-entropy regions get shorter patches and more compute. This is a data-dependent compute allocation rule.',
    invariant: 'Low entropy gets longer patches; high entropy gets more local resolution.',
  };

  yield {
    state: bltGraph('BLT separates local byte modeling from global patch reasoning'),
    highlight: { active: ['entropy', 'patches', 'global'], found: ['localEnc', 'localDec'] },
    explanation: 'The local encoder and decoder handle byte-level detail. The global latent transformer reasons over patch states. That separation is the core architecture: keep byte universality without paying full transformer cost at every byte position.',
  };

  yield {
    state: labelMatrix(
      'Why patches can scale better than tokens',
      [
        { id: 'vocab', label: 'vocabulary' },
        { id: 'rare', label: 'rare text' },
        { id: 'compute', label: 'compute' },
        { id: 'robust', label: 'robustness' },
      ],
      [
        { id: 'token model', label: 'token model' },
        { id: 'BLT', label: 'BLT' },
      ],
      [
        ['fixed subwords', 'raw bytes'],
        ['splits oddly', 'no OOV token'],
        ['per token', 'per patch'],
        ['tokenizer quirks', 'byte coverage'],
      ],
    ),
    highlight: { found: ['vocab:BLT', 'rare:BLT', 'compute:BLT'], compare: ['vocab:token model'] },
    explanation: 'The paper reports that byte-level models can match tokenized LLM performance at scale while improving inference efficiency and long-tail robustness. The important systems lesson is dynamic granularity: compute should follow information density.',
  };
}

function* fastByteGeneration() {
  yield {
    state: labelMatrix(
      'The generation bottleneck',
      [
        { id: 'byteAR', label: 'byte-by-byte AR' },
        { id: 'patchAR', label: 'patch autoreg' },
        { id: 'draft', label: 'draft+verify' },
        { id: 'diffuse', label: 'block diffusion' },
      ],
      [
        { id: 'step shape', label: 'step shape' },
        { id: 'bottleneck', label: 'bottleneck' },
      ],
      [
        ['one byte', 'many forwards'],
        ['one patch', 'patch boundary'],
        ['many draft bytes', 'verification'],
        ['parallel block', 'quality control'],
      ],
    ),
    highlight: { active: ['byteAR:bottleneck'], found: ['draft:step shape', 'diffuse:step shape'] },
    explanation: 'The May 2026 Fast BLT paper targets a practical problem: byte-level language models avoid tokenization, but naive byte-by-byte autoregressive generation is slow.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'context', label: 'byte context', x: 0.8, y: 3.8, note: 'prefix' },
        { id: 'bltD', label: 'BLT-D', x: 3.0, y: 2.2, note: 'diffusion' },
        { id: 'bltS', label: 'BLT-S', x: 3.0, y: 3.8, note: 'self-spec' },
        { id: 'bltDV', label: 'BLT-DV', x: 3.0, y: 5.4, note: 'diffuse+verify' },
        { id: 'verify', label: 'verify', x: 5.7, y: 3.8, note: 'full model' },
        { id: 'bytes', label: 'next bytes', x: 8.2, y: 3.8, note: 'output block' },
      ],
      edges: [
        { id: 'e-context-bltD', from: 'context', to: 'bltD', weight: '' },
        { id: 'e-context-bltS', from: 'context', to: 'bltS', weight: '' },
        { id: 'e-context-bltDV', from: 'context', to: 'bltDV', weight: '' },
        { id: 'e-bltD-verify', from: 'bltD', to: 'verify', weight: '' },
        { id: 'e-bltS-verify', from: 'bltS', to: 'verify', weight: '' },
        { id: 'e-bltDV-verify', from: 'bltDV', to: 'verify', weight: '' },
        { id: 'e-verify-bytes', from: 'verify', to: 'bytes', weight: '' },
      ],
    }, { title: 'Fast BLT variants reduce forward passes per output span' }),
    highlight: { active: ['bltD', 'bltS', 'bltDV'], found: ['bytes'] },
    explanation: 'Fast BLT introduces diffusion-style block generation and speculative-style verification variants. The shared idea is to generate or draft multiple bytes per expensive model step, then control quality with verification.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'output bytes', min: 0, max: 128 }, y: { label: 'full-model forwards', min: 0, max: 128 } },
      series: [
        { id: 'byteAR', label: 'byte autoregressive', points: [
          { x: 16, y: 16 }, { x: 32, y: 32 }, { x: 64, y: 64 }, { x: 128, y: 128 },
        ] },
        { id: 'block', label: 'block generation', points: [
          { x: 16, y: 5 }, { x: 32, y: 9 }, { x: 64, y: 17 }, { x: 128, y: 33 },
        ] },
      ],
    }),
    highlight: { active: ['block'], compare: ['byteAR'] },
    explanation: 'The toy curve shows the systems pressure: reduce the number of expensive forward passes per output byte. The Fast BLT paper reports estimated memory-bandwidth cost reductions for generation tasks.',
    invariant: 'Generation speed improves when each full-model pass validates more output bytes.',
  };

  yield {
    state: labelMatrix(
      'What to audit before believing a tokenizer-free win',
      [
        { id: 'quality', label: 'quality' },
        { id: 'cost', label: 'cost' },
        { id: 'tails', label: 'long tail' },
        { id: 'stack', label: 'serving stack' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'related topic', label: 'read next' },
      ],
      [
        ['same FLOPs?', 'Roofline'],
        ['prefill/decode?', 'KV Cache'],
        ['rare bytes?', 'BPE'],
        ['batching works?', 'PagedAttention'],
      ],
    ),
    highlight: { found: ['quality:question', 'cost:question', 'stack:question'] },
    explanation: 'A tokenizer-free architecture must be judged under controlled compute, generation latency, memory bandwidth, long-tail robustness, and serving integration. The architecture win and the systems win are inseparable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dynamic byte patches') yield* dynamicBytePatches();
  else if (view === 'fast byte generation') yield* fastByteGeneration();
  else throw new InputError('Pick a Byte Latent Transformer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Byte Latent Transformer (BLT) is a tokenizer-free LLM architecture introduced in "Byte Latent Transformer: Patches Scale Better Than Tokens." Instead of committing to a fixed BPE or SentencePiece vocabulary, BLT trains directly on raw UTF-8 bytes. To avoid the obvious cost problem - byte sequences are much longer than token sequences - it groups bytes into dynamically sized patches and runs the expensive global transformer over those patches.',
        'The patch boundaries are based on next-byte entropy. Predictable spans can be represented with longer patches; difficult spans get shorter patches and more local resolution. That makes BLT a concrete example of adaptive computation: spend more model capacity where the data is information-dense and less where it is predictable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BLT separates local byte modeling from global patch reasoning. A local encoder turns byte spans into patch representations. A global latent transformer reasons over those patch states. A local decoder produces bytes again. The architecture keeps the universality of bytes while avoiding a full transformer step for every byte position.',
        'The 2026 Fast Byte Latent Transformer follow-up attacks generation speed. Byte-level autoregressive generation can be slow if it emits one byte per forward pass. Fast BLT variants use block-wise diffusion objectives, self-speculation, and diffusion-plus-verification to generate or draft multiple bytes per expensive pass. This connects directly to Speculative Decoding and Transformer Inference Roofline: fewer memory-bound decode passes can matter as much as model quality.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BLT trades tokenizer complexity for architecture complexity. It removes a fixed vocabulary and the weird edge cases of subword segmentation, but it introduces entropy-based patching, local byte encoders and decoders, and serving questions around patch boundaries. For fixed inference cost, the original paper reports better scaling trends than tokenization-based architectures by growing both patch size and model size.',
        'The serving cost must be measured by phase. Prefill, decode, KV cache residency, batch size, and memory bandwidth all matter. A byte model that improves long-tail text handling but streams too slowly may be unattractive. A fast byte model that drafts several bytes per pass but loses quality needs verification. The architecture belongs in the same mental bucket as Transformer Inference Roofline, KV Cache, LLM Continuous Batching, and PagedAttention.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tokenizer-free models are attractive for multilingual text, code, rare strings, messy Unicode, URLs, identifiers, spelling-sensitive tasks, and long-tail generalization. They avoid out-of-vocabulary behavior because every text is bytes. The hard question is whether dynamic patches can keep training and inference efficient enough to compete with heavily optimized token-based stacks. Perceiver IO is a useful companion study because it attacks the adjacent interface problem: how huge raw inputs can be read into a fixed latent memory before task-specific decoding.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'BLT does not mean tokenization instantly disappears from production. Tokenizers are deeply integrated with serving APIs, context accounting, sampling, safety filters, and evaluation harnesses. BLT also does not make language easier by itself; it changes the units of computation and the inductive bias. The right comparison is compute-controlled quality, latency, memory traffic, robustness, and operational simplicity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Byte Latent Transformer at https://arxiv.org/abs/2412.09871, the official code at https://github.com/facebookresearch/blt, and Fast Byte Latent Transformer at https://arxiv.org/abs/2605.08044. Study Tokenization (BPE), The Transformer Block, Attention Mechanism, Perceiver IO Latent Array Bottleneck, KV Cache, Transformer Inference Roofline, Speculative Decoding, and LLM Serving: PagedAttention next.',
      ],
    },
  ],
};
