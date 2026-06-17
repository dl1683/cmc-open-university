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
    explanation: 'Byte Latent Transformer starts from raw UTF-8 bytes instead of a fixed BPE vocabulary. The naive byte baseline is universal but too long. BLT keeps byte coverage, then groups bytes into dynamic patches so the expensive global transformer runs on fewer steps.',
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
    explanation: 'Read the peaks as uncertainty. Predictable byte spans can be packed into longer patches; high-entropy spans get shorter patches and more local modeling. The patch policy is a compute allocation rule, not a linguistic tokenizer.',
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
    explanation: 'The May 2026 Fast BLT paper targets the serving bottleneck: byte-level models avoid tokenizer edge cases, but one full forward pass per byte is too slow for generation. The rest of this view is about reducing expensive passes per output span.',
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
      heading: 'Why BLT exists',
      paragraphs: [
        'Byte Latent Transformer, or BLT, is a tokenizer-free language-model architecture from Byte Latent Transformer: Patches Scale Better Than Tokens. It starts from raw UTF-8 bytes instead of a fixed subword vocabulary. That removes a large design dependency from the model stack. There is no out-of-vocabulary token. Messy Unicode, rare identifiers, code, spelling variation, and multilingual text are all represented as bytes.',
        'The obvious problem is length. A byte sequence is much longer than a BPE token sequence. Running a full transformer step at every byte position would make training and generation expensive. BLT keeps byte universality but groups bytes into dynamically sized patches. The expensive global transformer works over patch states rather than individual bytes, while local modules preserve byte-level detail.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious approach is subword tokenization. BPE and related tokenizers compress common strings into reusable units, keep sequence length manageable, and fit well with existing transformer serving systems. They are not a mistake. They are one reason modern language models became efficient enough to train and serve at scale.',
        'The wall is that a fixed tokenizer is a brittle interface. Token boundaries are chosen before model training and cannot adapt to each context. Common strings receive compact units while rare strings fragment. Some languages, code patterns, byte sequences, or noisy user inputs are represented awkwardly. Tokenization also leaks into product behavior: context accounting, safety filters, evaluation, sampling, and APIs often inherit tokenizer quirks. A byte model avoids that vocabulary boundary, but it must solve the compute problem that tokenizers were hiding.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is dynamic granularity. Not every byte deserves the same amount of global computation. Predictable spans can be packed into larger patches. High-entropy spans need shorter patches and more local resolution. BLT estimates next-byte uncertainty and uses that signal to decide patch boundaries. Compute follows information density rather than a fixed tokenizer vocabulary.',
        'This changes the basic unit of modeling. The model still sees bytes, but the global transformer reasons over learned latent patch representations. Local encoders and decoders handle the byte details inside a patch. The global model spends its capacity on fewer, richer units. The invariant is that the raw byte sequence remains recoverable and modelable, while expensive global attention is paid per patch rather than per byte.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'A BLT implementation needs a byte stream, an entropy or patching policy, local byte encoders, patch state buffers, a global latent transformer, local byte decoders, and metadata that maps byte positions to patch positions. The patching policy is the data-structure hinge. It decides which bytes become one latent unit and which spans should be split more finely.',
        'The global transformer is expensive because attention cost grows with the number of global units. The local modules are cheaper and closer to the raw bytes. This separation resembles other bottleneck architectures: detailed input lives at the edge, and a smaller latent sequence carries the information that deserves global reasoning. The design avoids a fixed vocabulary, but it introduces new state that tokenized systems do not have: patch boundaries, local decode state, byte-to-patch maps, and entropy-model behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BLT works when the patching policy preserves the useful local detail while reducing the number of expensive global steps. Low-entropy bytes are often predictable from nearby context. Spending a global transformer state on every one of them is wasteful. High-entropy spans are where the model needs more representational attention. Entropy-based patching gives those spans more resolution.',
        'The correctness argument is again architectural rather than exact. A tokenizer-based model assumes a fixed segmentation is a good compression of text for all contexts. BLT assumes segmentation should be learned or computed from uncertainty. If that uncertainty signal aligns with real modeling difficulty, the global model gets a better quality-cost tradeoff. The BLT paper reports that byte-level models can match tokenized models at scale while improving inference efficiency and robustness under controlled comparisons.',
      ],
    },
    {
      heading: 'Generation bottleneck',
      paragraphs: [
        'Training over byte patches is only half the story. Generation is the serving wall. A naive byte-level autoregressive model can require too many forward passes because it emits very small units. Even if the global model operates over patches, serving has to produce exact bytes in order. Decode is often memory-bandwidth bound, so reducing expensive forward passes per output span can matter as much as reducing FLOPs.',
        'The May 2026 Fast Byte Latent Transformer paper targets this bottleneck. BLT Diffusion trains a block-wise diffusion objective so the decoder can generate multiple future bytes in parallel. BLT Self-speculation lets the local decoder draft beyond normal patch boundaries and verifies the draft with the full model. BLT Diffusion plus Verification combines diffusion drafts with an autoregressive verification step. The shared mechanism is draft or generate more bytes per expensive pass, then use verification or training design to control quality loss.',
      ],
    },
    {
      heading: 'Cost behavior',
      paragraphs: [
        'BLT trades tokenizer complexity for model and runtime complexity. It removes a fixed vocabulary, but it adds local models, patching policy, patch metadata, and byte-level serving logic. The original BLT result is important because it studies fixed inference cost: larger patches can reduce the number of global steps, and the saved compute can be spent on a larger or stronger latent transformer. That creates a scaling dimension tokenized models do not have in the same way.',
        'The operational cost must be measured by phase. Prefill cost depends on how many patch states represent the input. Decode cost depends on how many full-model passes are needed per output bytes. KV cache residency, batching, patch-boundary variance, memory bandwidth, verification overhead, and safety filters all matter. A tokenizer-free model that improves long-tail robustness but streams too slowly may still lose in production.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'BLT is useful where tokenization is a real source of error or cost. Multilingual text, mixed scripts, code, URLs, identifiers, hashes, biomedical strings, legal citations, noisy OCR, spelling-sensitive tasks, and adversarial text can all expose subword quirks. Byte coverage is a clean promise: any text is representable because bytes are the base alphabet.',
        'It is also useful as a systems lesson. BLT shows that the input unit of a model is not just a preprocessing choice. It is a data structure that controls compute, robustness, cache behavior, and product semantics. The same idea appears in Perceiver-style latent arrays, adaptive token banks, retrieval systems, and image patching. Choose the unit poorly and the model spends work in the wrong places.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BLT is not automatic replacement for tokenized LLMs. Tokenizers are deeply integrated into deployed stacks. Rate limits, context windows, billing, safety filters, evaluation harnesses, prompt tooling, and model APIs all assume token units. A byte model changes those contracts. Even if quality is strong, the migration cost can be high.',
        'The architecture can also fail if the patching policy is wrong. Overly long patches can hide distinctions that matter. Overly short patches give back the byte-length cost. Entropy estimates can be noisy on rare domains. Fast generation variants can trade quality for speed if drafts are weak or verification is too loose. The system needs honest compute-controlled comparisons, not claims based on one favorable phase of inference.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track bytes per patch, patch-count distribution, entropy thresholds, prefill latency, decode bytes per full-model pass, KV cache memory, verification acceptance rate, memory-bandwidth cost, p50 and p99 latency, quality by language and script, code-task accuracy, rare-string behavior, and safety-filter compatibility. Good dashboards should show when text becomes many small patches, because that is where cost can surprise operators.',
        'Evaluation should compare BLT against strong tokenized baselines at matched training FLOPs, matched inference cost, and matched serving constraints. Include long-tail text, clean common text, multilingual samples, code, structured strings, and generation latency. The claim to test is not that bytes are more elegant. The claim is that dynamic byte patches produce better robustness and efficiency under the same budget.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources are the BLT paper at https://arxiv.org/abs/2412.09871, the Meta AI publication page at https://ai.meta.com/research/publications/byte-latent-transformer-patches-scale-better-than-tokens/, the official code at https://github.com/facebookresearch/blt, and Fast Byte Latent Transformer at https://arxiv.org/abs/2605.08044.',
        'Study byte-pair encoding, Unicode and UTF-8, attention, transformer inference rooflines, KV cache layout, PagedAttention, speculative decoding, block diffusion language models, Perceiver IO, and adaptive token banks next. The bigger lesson is dynamic granularity: the best unit of computation is often not the raw symbol and not a fixed vocabulary item, but a learned or computed span whose size follows information density.',
      ],
    },
  ],
};
