// LongRoPE: non-uniform RoPE rescaling and progressive context extension.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'longrope-nonuniform-rope-scaling-case-study',
  title: 'LongRoPE Non-Uniform RoPE Scaling Case Study',
  category: 'Papers',
  summary: 'LongRoPE extends context by searching non-uniform RoPE rescaling factors, progressively stretching context, and readjusting short-context behavior.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['nonuniform scaling', 'progressive extension', 'short recovery'], defaultValue: 'nonuniform scaling' },
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

function ropeGraph(title) {
  return graphState({
    nodes: [
      { id: 'rope', label: 'RoPE dims', x: 0.8, y: 3.8, note: 'frequency ladder' },
      { id: 'dim', label: 'dim factors', x: 2.8, y: 2.5, note: 'non-uniform' },
      { id: 'pos', label: 'pos factors', x: 2.8, y: 5.1, note: 'non-uniform' },
      { id: 'search', label: 'search', x: 4.9, y: 3.8, note: 'candidate scales' },
      { id: 'tune', label: 'fine-tune', x: 6.9, y: 3.8, note: '256k step' },
      { id: 'long', label: 'long ctx', x: 9.0, y: 3.8, note: 'extend' },
    ],
    edges: [
      { id: 'e-rope-dim', from: 'rope', to: 'dim' },
      { id: 'e-rope-pos', from: 'rope', to: 'pos' },
      { id: 'e-dim-search', from: 'dim', to: 'search' },
      { id: 'e-pos-search', from: 'pos', to: 'search' },
      { id: 'e-search-tune', from: 'search', to: 'tune' },
      { id: 'e-tune-long', from: 'tune', to: 'long' },
    ],
  }, { title });
}

function* nonuniformScaling() {
  yield {
    state: ropeGraph('LongRoPE searches non-uniform scaling factors'),
    highlight: { active: ['dim', 'pos', 'search', 'e-dim-search', 'e-pos-search'], found: ['long'] },
    explanation: 'LongRoPE starts from a key observation: RoPE dimensions and token positions do not need one uniform stretch factor. Some frequency bands and positions tolerate different scaling.',
    invariant: 'The data structure is a scaling table over dimensions and positions, not a single global context multiplier.',
  };

  yield {
    state: labelMatrix(
      'Scaling table intuition',
      [
        { id: 'low', label: 'low freq dims' },
        { id: 'mid', label: 'mid freq dims' },
        { id: 'high', label: 'high freq dims' },
        { id: 'tail', label: 'tail positions' },
      ],
      [
        { id: 'scale', label: 'scale' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['large', 'long range'],
        ['medium', 'balance'],
        ['small', 'local detail'],
        ['special', 'new range'],
      ],
    ),
    highlight: { active: ['low:scale', 'high:reason', 'tail:scale'], compare: ['mid:scale'] },
    explanation: 'A uniform stretch can damage local precision. Non-uniform scaling lets low-frequency dimensions carry long range while high-frequency dimensions preserve nearby order.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'RoPE dimension band', min: 0, max: 1 }, y: { label: 'scale factor', min: 0, max: 1 } },
      series: [
        { id: 'uniform', label: 'uniform scaling', points: [
          { x: 0, y: 0.55 }, { x: 0.25, y: 0.55 }, { x: 0.50, y: 0.55 }, { x: 0.75, y: 0.55 }, { x: 1, y: 0.55 },
        ] },
        { id: 'longrope', label: 'LongRoPE-style table', points: [
          { x: 0, y: 0.92 }, { x: 0.25, y: 0.78 }, { x: 0.50, y: 0.58 }, { x: 0.75, y: 0.36 }, { x: 1, y: 0.20 },
        ] },
      ],
      markers: [
        { id: 'local', x: 0.90, y: 0.24, label: 'local precision' },
      ],
    }),
    highlight: { active: ['longrope', 'local'], compare: ['uniform'] },
    explanation: 'This stylized curve shows why a table can beat one multiplier. The model can stretch long-range bands more while protecting local high-frequency bands.',
  };

  yield {
    state: labelMatrix(
      'Why search is needed',
      [
        { id: 'math', label: 'rotation math' },
        { id: 'data', label: 'long data' },
        { id: 'eval', label: 'eval' },
        { id: 'table', label: 'table' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['angles stable', 'phase chaos'],
        ['scarce', 'overfit'],
        ['position sweep', 'headline only'],
        ['non-uniform', 'bad scale'],
      ],
    ),
    highlight: { active: ['eval:constraint', 'table:constraint'], compare: ['math:failure'] },
    explanation: 'Context extension is fragile because new positions can create catastrophic rotations. LongRoPE treats scaling as a searched configuration, then validates it with fine-tuning and evaluation.',
  };
}

function* progressiveExtension() {
  yield {
    state: graphState({
      nodes: [
        { id: 'base', label: 'base ctx', x: 0.8, y: 3.8, note: '4k/8k' },
        { id: 'search1', label: 'search table', x: 2.6, y: 3.8, note: 'init' },
        { id: 'tune256', label: 'tune 256k', x: 4.6, y: 3.8, note: 'stage 1' },
        { id: 'interp2m', label: 'interp 2M', x: 6.8, y: 3.8, note: 'stage 2' },
        { id: 'eval', label: 'eval', x: 8.8, y: 3.8, note: 'long + short' },
      ],
      edges: [
        { id: 'e-base-search1', from: 'base', to: 'search1' },
        { id: 'e-search1-tune256', from: 'search1', to: 'tune256' },
        { id: 'e-tune256-interp2m', from: 'tune256', to: 'interp2m' },
        { id: 'e-interp2m-eval', from: 'interp2m', to: 'eval' },
      ],
    }, { title: 'Progressive extension avoids jumping straight to the target' }),
    highlight: { active: ['search1', 'tune256', 'interp2m'], found: ['eval'] },
    explanation: 'LongRoPE extends context progressively. First find a good scaling initialization and tune to an intermediate length, then interpolate again toward a much larger context.',
  };

  yield {
    state: labelMatrix(
      'Extension stages',
      [
        { id: 'base', label: 'base' },
        { id: 'search', label: 'search' },
        { id: 'stage1', label: 'stage 1' },
        { id: 'stage2', label: 'stage 2' },
      ],
      [
        { id: 'length', label: 'length' },
        { id: 'job', label: 'job' },
      ],
      [
        ['short', 'preserve'],
        ['8x possible', 'initialize'],
        ['256k', 'adapt'],
        ['2048k', 'stretch'],
      ],
    ),
    highlight: { active: ['search:job', 'stage1:length', 'stage2:length'], compare: ['base:job'] },
    explanation: 'The important algorithmic idea is staged search and adaptation. Huge context extension is easier when the model is not shocked with the final length in one move.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'extension stage', min: 0, max: 3 }, y: { label: 'usable context', min: 0, max: 2048 } },
      series: [
        { id: 'jump', label: 'one jump', points: [
          { x: 0, y: 8 }, { x: 1, y: 200 }, { x: 2, y: 380 }, { x: 3, y: 520 },
        ] },
        { id: 'progressive', label: 'progressive LongRoPE', points: [
          { x: 0, y: 8 }, { x: 1, y: 64 }, { x: 2, y: 256 }, { x: 3, y: 2048 },
        ] },
      ],
      markers: [
        { id: 'million', x: 3, y: 2048, label: '2M target' },
      ],
    }),
    highlight: { active: ['progressive', 'million'], compare: ['jump'] },
    explanation: 'This stylized path shows the point of progressive extension: build a stable intermediate model before stretching toward very large context lengths.',
  };

  yield {
    state: labelMatrix(
      'System implications',
      [
        { id: 'train', label: 'training' },
        { id: 'serve', label: 'serving' },
        { id: 'cache', label: 'KV cache' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'truth', label: 'truth' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['less than full target', 'data scarcity'],
        ['still costly', 'latency'],
        ['grows with tokens', 'memory'],
        ['position sweep', 'lost middle'],
      ],
    ),
    highlight: { active: ['serve:truth', 'cache:truth', 'eval:truth'], compare: ['train:watch'] },
    explanation: 'LongRoPE changes position encoding. It does not remove attention cost. A 2M-token context still needs serious serving and evaluation infrastructure.',
  };
}

function* shortRecovery() {
  yield {
    state: labelMatrix(
      'Short-context recovery',
      [
        { id: 'before', label: 'before extension' },
        { id: 'after', label: 'after stretch' },
        { id: 'readjust', label: 'readjust' },
        { id: 'release', label: 'release' },
      ],
      [
        { id: 'short', label: 'short task' },
        { id: 'long', label: 'long task' },
      ],
      [
        ['strong', 'limited'],
        ['risk', 'improved'],
        ['restore', 'keep'],
        ['both pass', 'both pass'],
      ],
    ),
    highlight: { active: ['readjust:short', 'release:short', 'release:long'], compare: ['after:short'] },
    explanation: 'A long-context extension can damage the original short-context behavior. LongRoPE includes a short-context readjustment step to recover short-window performance.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context position', min: 0, max: 2048 }, y: { label: 'accuracy', min: 0, max: 1 } },
      series: [
        { id: 'stretched', label: 'after stretch only', points: [
          { x: 4, y: 0.70 }, { x: 8, y: 0.72 }, { x: 128, y: 0.80 }, { x: 512, y: 0.78 }, { x: 2048, y: 0.66 },
        ] },
        { id: 'readjusted', label: 'after readjust', points: [
          { x: 4, y: 0.91 }, { x: 8, y: 0.92 }, { x: 128, y: 0.88 }, { x: 512, y: 0.82 }, { x: 2048, y: 0.70 },
        ] },
      ],
      markers: [
        { id: 'short', x: 8, y: 0.92, label: 'short restored' },
      ],
    }),
    highlight: { active: ['readjusted', 'short'], compare: ['stretched'] },
    explanation: 'This stylized curve separates two goals: extend the far end and keep the near end. A deployment needs both, because most requests are still short.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'longclaim', label: 'long claim', x: 0.8, y: 3.8, note: '2M' },
        { id: 'shortbench', label: 'short bench', x: 2.8, y: 2.5, note: 'regression?' },
        { id: 'longbench', label: 'long bench', x: 2.8, y: 5.1, note: 'position sweep' },
        { id: 'cost', label: 'cost model', x: 5.0, y: 3.8, note: 'attention + KV' },
        { id: 'router', label: 'router', x: 7.1, y: 3.8, note: 'use long only if needed' },
        { id: 'ship', label: 'ship', x: 9.1, y: 3.8, note: 'guarded' },
      ],
      edges: [
        { id: 'e-longclaim-shortbench', from: 'longclaim', to: 'shortbench' },
        { id: 'e-longclaim-longbench', from: 'longclaim', to: 'longbench' },
        { id: 'e-shortbench-cost', from: 'shortbench', to: 'cost' },
        { id: 'e-longbench-cost', from: 'longbench', to: 'cost' },
        { id: 'e-cost-router', from: 'cost', to: 'router' },
        { id: 'e-router-ship', from: 'router', to: 'ship' },
      ],
    }, { title: 'Long context should be routed, not blindly used' }),
    highlight: { active: ['shortbench', 'longbench', 'cost'], found: ['router', 'ship'] },
    explanation: 'Even if LongRoPE makes a model capable of huge context, the serving layer should route long-context mode only when the request needs it. Loading irrelevant context is still expensive.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'rope', label: 'RoPE' },
        { id: 'longlora', label: 'LongLoRA' },
        { id: 'lost', label: 'Lost middle' },
        { id: 'serve', label: 'Serving' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'next', label: 'next' },
      ],
      [
        ['rotation math', 'scaling table'],
        ['fine-tuning', 'context adapt'],
        ['eval failure', 'position sweep'],
        ['cost', 'routing'],
      ],
    ),
    highlight: { found: ['rope:next', 'longlora:next', 'lost:next'], active: ['serve:connection'] },
    explanation: 'LongRoPE is position-encoding surgery. It must be read with fine-tuning recipes, long-context evaluation, and serving cost, not as a standalone magic length knob.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nonuniform scaling') yield* nonuniformScaling();
  else if (view === 'progressive extension') yield* progressiveExtension();
  else if (view === 'short recovery') yield* shortRecovery();
  else throw new InputError('Pick a LongRoPE view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'LongRoPE is a context-extension method for RoPE-based language models. It extends context by searching non-uniform scaling factors for rotary position embeddings, then progressively stretching the model to longer windows while trying to preserve short-context performance.',
        'The key difference from simple position interpolation is that LongRoPE treats RoPE scaling as a table over frequency dimensions and positions, not one global multiplier.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'RoPE rotates query and key vectors by position-dependent angles. Extending context means the model will see positions and angles outside its training distribution. LongRoPE identifies non-uniformities across RoPE dimensions and token positions, searches better scaling factors, fine-tunes at an intermediate long length, then stretches further.',
        'The progressive strategy matters. Jumping directly from a short context to a huge context can create unstable rotations and poor quality. LongRoPE first adapts to a large but manageable context, then applies another interpolation step toward the target.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'LongRoPE changes the position-encoding side. It does not remove dense attention cost, KV cache growth, or lost-in-the-middle failure modes. A model with a very large context window can still be too expensive to serve naively.',
        'The release gate must test short-context regression, long-context retrieval, copy fidelity, middle-position accuracy, and cost. Most user requests are short, so preserving the original short behavior is not optional.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A team wants to adapt an 8k-context model to very long codebase analysis. LongRoPE provides the position scaling path. LongLoRA or continued pretraining adapts model weights. RingAttention or PagedAttention may be needed for training and serving. RAG is still needed when loading every file is wasteful or when exact citations matter.',
        'The final system should route short requests to short mode and reserve huge context for tasks that need it. Context length is a capability, not a default operating mode.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not treat a headline context length as proof of useful recall. A model can accept 2M tokens and still fail to use the middle. Also do not assume RoPE scaling recipes are interchangeable. Position interpolation, YaRN, NTK-aware scaling, and LongRoPE move the frequency ladder differently.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: LongRoPE at https://arxiv.org/abs/2402.13753 and the official Microsoft implementation at https://github.com/microsoft/LongRoPE.',
        'Study RoPE, Positional Encoding, Attention Mechanism, LongLoRA Shifted Sparse Attention, Lost in the Middle, KV Cache, RingAttention Sequence Parallelism, Transformer Inference Roofline, and RAG Context Packing next.',
      ],
    },
  ],
};
