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
  const modelRows = [
    { id: 'chars', label: 'C' },
    { id: 'bpe', label: 'BPE' },
    { id: 'bytes', label: 'BLT' },
  ];
  yield {
    state: labelMatrix(
      'Three ways to feed language into a model',
      modelRows,
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
    explanation: `Byte Latent Transformer starts from raw UTF-8 bytes instead of a fixed BPE vocabulary. Comparing ${modelRows.length} approaches, the naive byte baseline is universal but too long. BLT keeps byte coverage, then groups bytes into dynamic patches so the expensive global transformer runs on fewer steps.`,
  };

  const cutMarkers = [
    { id: 'cut1', x: 3, y: 0.55, label: 'cut' },
    { id: 'cut2', x: 9, y: 0.62, label: 'cut' },
    { id: 'cut3', x: 16, y: 0.44, label: 'cut' },
  ];
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
      markers: cutMarkers,
    }),
    highlight: { active: ['entropy'], found: ['cut1', 'cut2', 'cut3'] },
    explanation: `Read the peaks as uncertainty. With ${cutMarkers.length} cut points placed at high-entropy positions, predictable byte spans can be packed into longer patches; high-entropy spans get shorter patches and more local modeling. The patch policy is a compute allocation rule, not a linguistic tokenizer.`,
    invariant: 'Low entropy gets longer patches; high entropy gets more local resolution.',
  };

  const bltState = bltGraph('BLT separates local byte modeling from global patch reasoning');
  const bltNodes = bltState.graph.nodes;
  yield {
    state: bltState,
    highlight: { active: ['entropy', 'patches', 'global'], found: ['localEnc', 'localDec'] },
    explanation: `The local encoder and decoder handle byte-level detail across ${bltNodes.length} pipeline stages. The global latent transformer reasons over patch states. That separation is the core architecture: keep byte universality without paying full transformer cost at every byte position.`,
  };

  const scalingRows = [
    { id: 'vocab', label: 'vocabulary' },
    { id: 'rare', label: 'rare text' },
    { id: 'compute', label: 'compute' },
    { id: 'robust', label: 'robustness' },
  ];
  yield {
    state: labelMatrix(
      'Why patches can scale better than tokens',
      scalingRows,
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
    explanation: `The paper reports that byte-level models can match tokenized LLM performance at scale while improving inference efficiency and long-tail robustness. Across ${scalingRows.length} dimensions (${scalingRows.map(r => r.label).join(', ')}), the important systems lesson is dynamic granularity: compute should follow information density.`,
  };
}

function* fastByteGeneration() {
  const genRows = [
    { id: 'byteAR', label: 'byte-by-byte AR' },
    { id: 'patchAR', label: 'patch autoreg' },
    { id: 'draft', label: 'draft+verify' },
    { id: 'diffuse', label: 'block diffusion' },
  ];
  yield {
    state: labelMatrix(
      'The generation bottleneck',
      genRows,
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
    explanation: `The May 2026 Fast BLT paper targets the serving bottleneck across ${genRows.length} generation strategies: byte-level models avoid tokenizer edge cases, but one full forward pass per byte is too slow for generation. The rest of this view is about reducing expensive passes per output span.`,
  };

  const variantNodes = [
    { id: 'context', label: 'byte context', x: 0.8, y: 3.8, note: 'prefix' },
    { id: 'bltD', label: 'BLT-D', x: 3.0, y: 2.2, note: 'diffusion' },
    { id: 'bltS', label: 'BLT-S', x: 3.0, y: 3.8, note: 'self-spec' },
    { id: 'bltDV', label: 'BLT-DV', x: 3.0, y: 5.4, note: 'diffuse+verify' },
    { id: 'verify', label: 'verify', x: 5.7, y: 3.8, note: 'full model' },
    { id: 'bytes', label: 'next bytes', x: 8.2, y: 3.8, note: 'output block' },
  ];
  yield {
    state: graphState({
      nodes: variantNodes,
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
    explanation: `Fast BLT introduces ${variantNodes.filter(n => n.id.startsWith('blt')).length} variants — diffusion-style block generation and speculative-style verification. The shared idea is to generate or draft multiple bytes per expensive model step, then control quality with verification.`,
  };

  const costSeries = [
    { id: 'byteAR', label: 'byte autoregressive', points: [
      { x: 16, y: 16 }, { x: 32, y: 32 }, { x: 64, y: 64 }, { x: 128, y: 128 },
    ] },
    { id: 'block', label: 'block generation', points: [
      { x: 16, y: 5 }, { x: 32, y: 9 }, { x: 64, y: 17 }, { x: 128, y: 33 },
    ] },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'output bytes', min: 0, max: 128 }, y: { label: 'full-model forwards', min: 0, max: 128 } },
      series: costSeries,
    }),
    highlight: { active: ['block'], compare: ['byteAR'] },
    explanation: `The toy curve compares ${costSeries.length} strategies — at 128 output bytes, block generation needs only ${costSeries[1].points[3].y} forwards versus ${costSeries[0].points[3].y} for byte-autoregressive. The Fast BLT paper reports estimated memory-bandwidth cost reductions for generation tasks.`,
    invariant: 'Generation speed improves when each full-model pass validates more output bytes.',
  };

  const auditRows = [
    { id: 'quality', label: 'quality' },
    { id: 'cost', label: 'cost' },
    { id: 'tails', label: 'long tail' },
    { id: 'stack', label: 'serving stack' },
  ];
  yield {
    state: labelMatrix(
      'What to audit before believing a tokenizer-free win',
      auditRows,
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
    explanation: `A tokenizer-free architecture must be judged across ${auditRows.length} audit dimensions (${auditRows.map(r => r.label).join(', ')}). The architecture win and the systems win are inseparable.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable from the dropdown. "Dynamic byte patches" walks through how BLT converts raw UTF-8 bytes into variable-length patches using an entropy signal, then routes those patches through the three-tier architecture (local encoder, global transformer, local decoder). "Fast byte generation" shows the serving bottleneck and the three Fast BLT strategies that reduce forward passes per output span. Each frame highlights the active data structure or pipeline stage. Step through slowly the first time; the entropy plot and patch-boundary cuts are the key frames.',
        {type: 'image', src: './assets/gifs/byte-latent-transformer.gif', alt: 'Animated walkthrough of the byte latent transformer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Colors encode roles: active nodes are the current operation, found nodes are outputs or downstream consumers, and compare nodes show the baseline being replaced. The matrix views compare BLT against tokenized models dimension by dimension. Read them as scorecards, not rankings.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every large language model today chops text into tokens before processing it. Byte Latent Transformer (BLT), introduced by Meta in the December 2024 paper "Byte Latent Transformer: Patches Scale Better Than Tokens," asks whether that chopping step can be removed entirely. Instead of a fixed subword vocabulary, BLT feeds raw UTF-8 bytes into the model. A byte is the smallest addressable unit of text encoding: the letter "A" is byte 0x41, the emoji flag sequence for Japan is 12 bytes. By operating on bytes, BLT has no out-of-vocabulary token and no tokenizer-dependent behavior.',
        {
          type: 'callout',
          text: 'BLT keeps byte universality but spends global transformer compute on dynamic patches instead of every byte.',
        },
        'The motivation is not aesthetic. Tokenizers leak into every layer of a deployed LLM system: context-window accounting, safety filters, billing, prompt engineering, evaluation harnesses, and multilingual coverage all inherit the vocabulary\'s blind spots. A model that starts from bytes eliminates that dependency. The challenge is cost: a byte sequence is 3-4x longer than its BPE token sequence, and running a full transformer step at every byte position is prohibitively expensive. BLT\'s answer is to group bytes into variable-length patches and run the expensive global transformer over those patches, not over individual bytes.',
        'The research lineage is short but direct. ByT5 (2021) showed byte-level models could work but were slow. MegaByte (2023) introduced the idea of splitting byte sequences into fixed-size patches with a local-global architecture. BLT replaces fixed patches with dynamic, entropy-driven patches and introduces the three-tier encoder-transformer-decoder structure that makes the idea practical at scale.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard approach to feeding text into a transformer is subword tokenization. Byte-pair encoding (BPE) is the dominant method: start with individual characters, count the most frequent adjacent pair in a training corpus, merge that pair into a new token, and repeat for 32k-256k merge operations. The result is a fixed vocabulary where common words like "the" become single tokens while rare words like "Pneumonoultramicroscopicsilicovolcanoconiosis" split into several pieces.',
        'BPE works well in practice. It compresses English text by roughly 4x compared to raw bytes (a 1,000-byte sentence becomes about 250 tokens), which means the transformer\'s self-attention operates on a sequence 4x shorter. Training is faster, KV cache is smaller, and serving throughput is higher. The tokenizer is trained once, the vocabulary is frozen, and every downstream component speaks the same token language. This is not a bad system. It is a proven one.',
        'Character-level and byte-level models are the other obvious family. ByT5 processed raw UTF-8 bytes and showed competitive quality on many tasks, but sequences were long and training was slow. MegaByte chunked bytes into fixed-size patches (e.g., every 8 bytes becomes one patch) and used a large global model over patches plus a small local model over bytes within each patch. Fixed patches are simple but wasteful: splitting "the_cat" at byte 4 produces two patches that each need global attention, even though "the_" is entirely predictable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall for tokenized models is brittleness. A BPE vocabulary is frozen before model training and cannot adapt to the input. The word "ChatGPT" might tokenize as ["Chat", "G", "PT"] in one tokenizer and ["Ch", "at", "GP", "T"] in another. Neither segmentation reflects linguistic structure. Rare words, code identifiers, URLs, multilingual text, and adversarial inputs all suffer from fragmentation: they produce many tokens, each carrying little meaning, and the model must burn attention reassembling them.',
        'This brittleness propagates beyond quality. Context windows are measured in tokens, so a user sending Hindi text (which fragments more than English under a BPE vocabulary trained mostly on English) gets fewer effective words per context window. Safety filters that operate on token boundaries can miss adversarial byte sequences that split across tokens. Billing by token count penalizes languages with less BPE coverage. Evaluation benchmarks that report per-token perplexity are not comparable across vocabularies. The tokenizer is supposed to be invisible preprocessing, but it shapes the product.',
        'The wall for byte-level models is cost. A 1,000-token prompt is roughly 4,000 bytes. Self-attention cost scales quadratically with sequence length (or linearly with efficient attention, but still proportional to length). A byte-level transformer processing 4,000 positions instead of 1,000 spends 4x the compute per layer in the linear case and 16x in the quadratic case. Generation is worse: autoregressive decoding emits one byte per forward pass, so producing a 500-byte response requires 500 full model evaluations instead of roughly 125 token-level evaluations. Neither wall alone is fatal, but together they explain why neither pure tokenization nor pure byte processing has won.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'BLT\'s core insight is that not every byte deserves the same amount of global computation. In the string "the_cat_sat", the bytes for "the_" are almost entirely predictable from context. A small local model can handle them. But the first byte of "cat" after a space is genuinely uncertain: it could be any word. That byte deserves global transformer attention. BLT formalizes this intuition by measuring next-byte entropy (the uncertainty of predicting the next byte given prior bytes) and placing patch boundaries where entropy is high.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:bcyxCsIwEADQPV9xP9BfEIy2ONRJtyNDDGdSOHLhciX490LBzfUN780yUolq8PTujKsMoGoq7QO9xRpgmk7gcZWaoUVLJTh_2AUXGqSQWV6RoRu1HtwVb1suf4oZH0XUfsd84IJ3UQKWFBmUuvBum9TwBQ',
          alt: 'Low entropy byte spans become long patches, while high entropy spans become short patches.',
          caption: 'Dynamic granularity spends global steps where uncertainty is high and compresses predictable spans into longer patches. Source: https://mermaid.ink/svg/pako:bcyxCsIwEADQPV9xP9BfEIy2ONRJtyNDDGdSOHLhciX490LBzfUN780yUolq8PTujKsMoGoq7QO9xRpgmk7gcZWaoUVLJTh_2AUXGqSQWV6RoRu1HtwVb1suf4oZH0XUfsd84IJ3UQKWFBmUuvBum9TwBQ',
        },
        'A patch, in BLT\'s terminology, is a contiguous span of bytes that gets compressed into a single latent vector before being fed to the global transformer. Patch boundaries are placed where next-byte entropy exceeds a threshold. Low-entropy spans (predictable continuations) get grouped into long patches. High-entropy spans (surprising transitions) get short patches, sometimes just one or two bytes. The result is a variable-length segmentation that adapts to the information density of the input, not to the frequency statistics of a training corpus.',
        'This is a compute allocation strategy, not a linguistic theory. BLT does not claim its patches are morphemes or words. It claims that the number of global transformer steps should be proportional to the information content of the input, and that entropy is a good proxy for information content. A 100-byte span of predictable English might become 5 patches. A 20-byte span of dense code might also become 5 patches. The global transformer sees the same number of units in both cases, but each unit represents a different number of raw bytes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BLT has three tiers. Tier 1 is a lightweight entropy model that reads the raw byte stream and estimates next-byte entropy at each position. When entropy exceeds a threshold, a patch boundary is placed. This model is small (the paper uses a single-layer transformer or n-gram model) because it runs at every byte position and must be cheap. Its output is a set of boundary indices that partition the byte stream into patches of varying length.',
        'Tier 2 is the local encoder. For each patch, the local encoder processes the bytes within that patch and produces a single latent vector (the patch embedding). This encoder is a small transformer that sees only the bytes within its patch plus cross-attention to the previous patch\'s representation. It compresses byte-level detail into a fixed-dimensional vector. If a patch contains 12 bytes, the local encoder reads those 12 bytes and outputs one vector. If a patch contains 3 bytes, it reads 3 bytes and outputs one vector of the same dimension.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:LY5BCoMwEADvecV-wHtPhWqiF6FQ7CnksMYVCzErcaXk96Uh1xkGZg389RsmgfGlHvY99c0N5ix0OmiaO7TWREl8ZNh5oeBUW3BndY64fzwcKH6j06muCG1H9hiAoueFklO6YGOHwDMGkITxXDntf2eK62uyUE36ggf7vOS4pN78AA',
          alt: 'Byte Latent Transformer pipeline from UTF-8 bytes through entropy patching, local encoders, global transformer, and local decoder.',
          caption: 'The architecture separates byte-level detail at the edges from expensive global reasoning over latent patch states. Source: https://mermaid.ink/svg/pako:LY5BCoMwEADvecV-wHtPhWqiF6FQ7CnksMYVCzErcaXk96Uh1xkGZg389RsmgfGlHvY99c0N5ix0OmiaO7TWREl8ZNh5oeBUW3BndY64fzwcKH6j06muCG1H9hiAoueFklO6YGOHwDMGkITxXDntf2eK62uyUE36ggf7vOS4pN78AA',
        },
        'Tier 3 is the global latent transformer. It receives the sequence of patch embeddings and runs standard self-attention over them. This is the expensive part of the model: the large parameter count, deep layers, and full attention. But because it operates on patches (not bytes), the sequence length is much shorter. If a 4,000-byte input produces 800 patches, the global transformer sees 800 positions instead of 4,000. After global processing, the local decoder reverses the process: it takes each global patch representation and autoregressively generates the bytes within that patch, using a small decoder model.',
        'During training, the entropy model, local encoder, global transformer, and local decoder are trained jointly end-to-end. The patch boundaries are determined by the entropy model but the gradient flows through all components. At inference time for generation, the process is autoregressive at the patch level: generate a patch embedding from the global model, decode the bytes within that patch using the local decoder, compute entropy on the new bytes to determine the next patch boundary, encode the new patch, and feed it back to the global model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BLT works because entropy-based patching concentrates global compute where it matters. Consider the sentence "The quick brown fox jumps over the lazy dog." The bytes for "The_quick_brown_" are highly predictable once you have seen English text: each next byte within a common word has low entropy. A BPE tokenizer would assign these words 4-5 tokens. BLT might assign them 2-3 patches covering 15+ bytes each. The global transformer saves 2-3 positions compared to BPE. Conversely, a rare proper name like "Krzyzewski" has high per-byte entropy: the global transformer gets more positions for the same number of bytes, giving it more capacity to model the difficult part.',
        'The correctness argument rests on an information-theoretic claim: the number of latent states a model needs to represent a byte span should scale with the information content of that span, not with its length. Predictable bytes carry little information and can be reconstructed from a compact representation. Unpredictable bytes carry substantial information and need richer representation. Entropy is the standard measure of information content, so using it to set patch boundaries is well-motivated. The BLT paper validates this empirically: at 8B parameters, BLT matches Llama 3 (a BPE model) on standard benchmarks while using fewer global transformer FLOPs per byte.',
        'A secondary reason BLT works is that it eliminates tokenizer-induced information loss. A BPE tokenizer that segments "unhappiness" as ["un", "happiness"] and "unhappy" as ["unhappy"] creates inconsistent representations for morphologically related words. BLT sees the shared byte prefix "unhapp" in both cases and can learn shared sub-word structure through the local encoder. This matters most for morphologically rich languages (Turkish, Finnish) and for code, where identifier structure carries meaning that tokenizers often destroy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BLT\'s cost has three components. The entropy model runs at every byte position: for a 4,000-byte input, that is 4,000 evaluations of a small model. The paper uses a model with roughly 100M parameters here, so the per-byte cost is small. The local encoder runs once per patch: if 4,000 bytes produce 800 patches, that is 800 local encoder calls, each processing an average of 5 bytes. The global transformer runs once over the 800 patch positions. Total FLOPs are dominated by the global transformer, but the sequence length it sees (800) is shorter than what a BPE model would see (roughly 1,000 tokens for 4,000 bytes).',
        'The paper introduces a scaling law. Fix the total inference FLOPs budget. A BPE model spends all FLOPs on a single transformer of size N over T tokens. BLT can split the budget: make the global transformer larger (say, 1.5x N parameters) but run it over fewer positions (say, 0.5x T patches). The paper shows that for the same total FLOPs, the BLT configuration can match or exceed BPE model quality, because a larger model over fewer positions can be more expressive than a smaller model over more positions.',
        'Memory cost follows a different pattern. The KV cache stores one key-value pair per position per layer. A BPE model with 1,000 tokens and 32 layers stores 32,000 KV pairs. BLT with 800 patches stores 25,600 KV pairs in the global model, but also maintains local encoder/decoder state and entropy model state. In practice, the global KV cache dominates, so BLT\'s cache is 20% smaller for this example. But the local decoder must also cache state during generation, partially offsetting the saving.',
        'Generation cost is the critical bottleneck. A BPE model generates one token (3-4 bytes on average) per forward pass. Naive BLT generates one byte per local decoder step within a patch, then one patch embedding per global forward pass. If patches average 5 bytes, BLT needs one global forward pass per 5 bytes (comparable to BPE) plus 5 local decoder steps per patch. The local decoder is small, so the wall-clock cost depends on whether the global forward pass or the local decoding dominates. The May 2026 "Fast BLT" paper addresses this with three strategies: block diffusion (generate all bytes in a patch simultaneously), self-speculation (draft bytes beyond patch boundaries with the local model, verify with the global model), and diffusion-plus-verification (combine both). These reduce full-model forward passes by 3-4x in reported experiments.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BLT is most valuable where tokenizer fragmentation causes real damage. Multilingual applications are the clearest case: a BPE vocabulary trained primarily on English assigns far more tokens per word in Hindi, Arabic, or Thai, which means those languages consume context window faster and produce lower-quality outputs. BLT treats all languages as byte streams, so a Hindi sentence and an English sentence of similar information content produce similar numbers of patches.',
        'Code processing is another strong case. Source code contains identifiers, operators, whitespace patterns, and string literals that tokenizers handle inconsistently. The identifier "getUserProfileById" might become 4-6 BPE tokens with boundaries that do not align with camelCase structure. BLT\'s entropy model would place patch boundaries at the low-entropy-to-high-entropy transitions (roughly at capital letters and word boundaries within the identifier), producing patches that align better with the semantic structure of the name.',
        'Robustness applications also benefit. Adversarial attacks that exploit tokenizer behavior (inserting invisible Unicode characters, using homoglyph substitutions, or crafting inputs that tokenize differently than intended) are less effective against byte-level models because there is no tokenizer to exploit. OCR outputs, noisy web scrapes, and user-generated content with typos and unconventional formatting are all represented faithfully as bytes without the distortion that comes from forcing them through a fixed vocabulary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BLT fails when the systems integration cost exceeds the quality benefit. Every production LLM stack today assumes token-level interfaces: API billing counts tokens, context windows are measured in tokens, KV cache management is indexed by token position, safety classifiers operate on token embeddings, RLHF reward models expect token sequences, and evaluation benchmarks report per-token metrics. Switching to bytes changes all of these interfaces. Even if BLT produces better outputs, the migration cost for a deployed system can be prohibitive.',
        'The architecture also fails when the entropy model is wrong. If the entropy estimate is too low across a span, it gets packed into a long patch and the global transformer under-represents it. If entropy is too high, the span gets many short patches and BLT loses its compression advantage. Entropy estimates are trained on the training distribution and may not transfer well to out-of-distribution inputs. A legal document with unusual formatting, a programming language not well-represented in training, or heavily code-switched multilingual text could all produce poor patch boundaries.',
        'Generation quality under Fast BLT variants is another failure mode. Block diffusion generates all bytes in a patch simultaneously, which means it cannot condition later bytes on earlier bytes within the same patch. Self-speculation relies on the local decoder producing good drafts, but the local decoder is intentionally small and may draft poorly on difficult spans. Verification catches bad drafts, but each rejection wastes a forward pass. In adversarial or highly unpredictable text, the rejection rate can be high enough that Fast BLT is slower than standard autoregressive generation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider processing the 28-byte input string "The cat sat on the mat." through BLT. In UTF-8, each character here is one byte, so we have 28 bytes total. The entropy model scans each byte position and produces next-byte entropy estimates. After "The_" (bytes 0-3), entropy is low (around 0.15 nats) because spaces after common words are predictable. At byte 4, the start of "cat", entropy jumps to 0.7 nats because many words could follow "The_". The model places a patch boundary at byte 4.',
        'Continuing: "cat_sat_" (bytes 4-11) has moderate entropy within words but spikes at word boundaries. Suppose the model places boundaries at bytes 4, 12, and 20, producing 4 patches: [0-3] "The_" (4 bytes), [4-11] "cat_sat_" (8 bytes), [12-19] "on_the_m" (8 bytes), [20-27] "at." (3 bytes, assuming the period triggers a boundary because sentence endings are high-entropy). A BPE tokenizer like Llama\'s would produce about 7 tokens for this sentence. BLT produces 4 patches, so the global transformer processes 4 positions instead of 7.',
        'The local encoder processes each patch independently. Patch 0 reads 4 bytes and outputs a 4096-dimensional vector. Patch 1 reads 8 bytes and outputs a 4096-dimensional vector. Same dimension regardless of byte count. The global transformer runs self-attention over the 4 patch vectors. Self-attention cost is proportional to 4^2 = 16 pairwise comparisons (versus 7^2 = 49 for the BPE model). After global processing, the local decoder takes each output patch vector and generates the bytes within it. For patch 1, it autoregressively generates "c", "a", "t", "_", "s", "a", "t", "_" using a small 8-step local decoding process.',
        'Now scale up. A 4,000-byte document might produce roughly 600-1,000 patches depending on content complexity. English prose averages about 6-8 bytes per patch. Dense code averages 3-4 bytes per patch. The global transformer sees 600-1,000 positions versus roughly 1,000-1,200 BPE tokens. BLT\'s advantage grows on predictable text (fewer patches) and shrinks on dense text (more patches, approaching byte-level cost). At 8B parameters with an average patch size of 6 bytes, the BLT paper reports matching Llama 3 8B on MMLU, HellaSwag, and ARC while using 50% fewer global transformer FLOPs per byte of input.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is the BLT paper: "Byte Latent Transformer: Patches Scale Better Than Tokens" (December 2024, https://arxiv.org/abs/2412.09871). The Meta AI publication page is at https://ai.meta.com/research/publications/byte-latent-transformer-patches-scale-better-than-tokens/ and the official code is at https://github.com/facebookresearch/blt. The follow-up "Fast Byte Latent Transformer" paper (May 2026, https://arxiv.org/abs/2605.08044) addresses the generation bottleneck with diffusion and speculative decoding strategies.',
        'Prerequisites for understanding BLT: byte-pair encoding (the baseline it replaces), UTF-8 encoding (how bytes map to characters), self-attention and transformer architecture (the global model), information entropy (the patching signal), and KV cache mechanics (why sequence length matters for serving). Related architectures worth studying: ByT5 (byte-level sequence-to-sequence), MegaByte (fixed-patch predecessor), Perceiver IO (latent bottleneck architecture), and speculative decoding (the generation acceleration strategy that Fast BLT adapts). The broader lesson is dynamic granularity: the best unit of computation is a learned span whose size tracks information density, not a fixed vocabulary item or a raw symbol.',
      ],
    },
  ],
};
