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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a search over position-encoding behavior. Active cells are candidate scale choices, visited cells are choices already tested or ruled out, and found cells are settings that survive both long-context and short-context checks.',
        'RoPE means rotary position embedding: the model represents position by rotating query and key dimensions by position-dependent angles. A safe inference is that changing the scale changes the geometry the attention layer sees; it does not create new knowledge by itself.',
        {type:"callout", text:"LongRoPE treats context length as a searched position-encoding table, not a single multiplier or product knob."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LongRoPE exists because many transformer models were trained with a shorter context window than users later want. A model trained around 4k or 8k tokens may be asked to read 128k tokens, but its position encoding was not learned for that range.',
        'Long context is useful for codebase review, legal discovery, long chats, log analysis, and multi-document research. The difficulty is that accepting the tokens is not the same as using them accurately across the whole window.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is uniform interpolation. If an 8k model must handle 128k tokens, divide positions by 16 so the new positions map back into the old range.',
        'That approach is cheap and easy to deploy because it changes the position math rather than the whole model. It is a reasonable first attempt, especially when the team cannot afford full long-context pretraining.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that RoPE dimensions do different jobs. High-frequency dimensions help distinguish nearby positions, while low-frequency dimensions carry slower changes over long spans.',
        'One uniform scale can protect one behavior while damaging another. Compress too much and local ordering gets blurry; compress too little and far positions leave the range the model learned.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is non-uniform scaling. LongRoPE searches different scaling factors across RoPE dimensions and position regions instead of using one global multiplier.',
        'That turns context extension into a small optimization problem over the frequency ladder. Some dimensions can stretch more to support distance, while others stay closer to the original behavior to preserve short-range precision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the original RoPE-based model and a target context length. The method searches candidate rescaling factors, evaluates them, adapts the model, and then performs a short-context readjustment so normal prompts do not degrade.',
        'The extension is staged rather than a single jump. A model can first adapt to a large intermediate window and then stretch farther, which gives the training process a smoother path than moving directly from 8k to a million-token target.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation of useful angle relationships. RoPE makes attention depend on relative angular differences, so scaling is acceptable only when those differences remain interpretable for both nearby and distant tokens.',
        'Non-uniform search works better than one multiplier because it preserves more constraints at once. The method is trustworthy only when evaluation shows long-position retrieval, middle-position use, and short-context quality at the same time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The scaling table is small compared with model weights, so the direct memory cost is minor. The real cost is search, fine-tuning, and evaluation across many positions and tasks.',
        'Serving cost does not disappear. If the model uses full attention over 128k tokens, KV-cache memory and prefill work still grow with context length, even though the position encoding can represent the longer range.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LongRoPE fits long-document assistants, code tools, research systems, and agents that need a native long window without replacing the base model. It is most useful when the team wants to preserve an existing model family and extend its position behavior.',
        'It is also a useful baseline against retrieval systems. Retrieval can foreground evidence and reduce serving cost, while LongRoPE tries to make the model itself tolerate a larger native prompt.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when a benchmark only proves that tokens fit into memory. The hard test is whether facts at different positions are used with stable accuracy under distractors and ordinary short prompts.',
        'It also fails when long-context serving economics are ignored. A position-scaling method can make a 128k prompt legal while the prefill latency, cache memory, and batch interference make it unattractive in production.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an 8k RoPE model is extended to 128k. Uniform interpolation uses a scale of 16, so position 128,000 is treated like position 8,000 in the old range.',
        'Now split the frequency bands conceptually. A high-frequency band might use a smaller effective stretch to preserve local order over nearby tokens, while a low-frequency band stretches more to represent long distance. The release test then checks a fact at 2k, 64k, and 120k, plus a normal 4k prompt, because all four cases can fail differently.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: LongRoPE at https://arxiv.org/abs/2402.13753. Study the project materials and compare against RoPE interpolation, YaRN, NTK-aware scaling, LongLoRA, Lost in the Middle, and KV Cache.',
        'Study next by role: RoPE for the position geometry, Attention Mechanism for why query-key angles matter, LongLoRA for training-time sparsity, FlashAttention for prefill cost, and RAG Context Packing Token Budget for an alternative that reduces the prompt instead of stretching it.',
      ],
    },
  ],
};