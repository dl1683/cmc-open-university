// LongLoRA: extend context with parameter-efficient tuning and shifted sparse
// attention during training.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'longlora-shifted-sparse-attention-case-study',
  title: 'LongLoRA Shifted Sparse Attention Case Study',
  category: 'Papers',
  summary: 'LongLoRA extends context windows by combining LoRA-style tuning with shifted sparse attention and trainable embedding/normalization layers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shifted groups', 'tuning stack', 'risk ledger'], defaultValue: 'shifted groups' },
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

function shiftedGraph(title) {
  return graphState({
    nodes: [
      { id: 'chunk0', label: 'group 0', x: 1.1, y: 2.4, note: 'tokens 0-2k' },
      { id: 'chunk1', label: 'group 1', x: 3.2, y: 2.4, note: '2k-4k' },
      { id: 'chunk2', label: 'group 2', x: 5.3, y: 2.4, note: '4k-6k' },
      { id: 'chunk3', label: 'group 3', x: 7.4, y: 2.4, note: '6k-8k' },
      { id: 'shift0', label: 'shift 0.5', x: 2.2, y: 5.1, note: 'overlap' },
      { id: 'shift1', label: 'shift 0.5', x: 4.3, y: 5.1, note: 'bridge' },
      { id: 'shift2', label: 'shift 0.5', x: 6.4, y: 5.1, note: 'bridge' },
      { id: 'train', label: 'train', x: 9.0, y: 3.8, note: 'sparse local' },
    ],
    edges: [
      { id: 'e-chunk0-shift0', from: 'chunk0', to: 'shift0' },
      { id: 'e-chunk1-shift0', from: 'chunk1', to: 'shift0' },
      { id: 'e-chunk1-shift1', from: 'chunk1', to: 'shift1' },
      { id: 'e-chunk2-shift1', from: 'chunk2', to: 'shift1' },
      { id: 'e-chunk2-shift2', from: 'chunk2', to: 'shift2' },
      { id: 'e-chunk3-shift2', from: 'chunk3', to: 'shift2' },
      { id: 'e-shift0-train', from: 'shift0', to: 'train' },
      { id: 'e-shift1-train', from: 'shift1', to: 'train' },
      { id: 'e-shift2-train', from: 'shift2', to: 'train' },
    ],
  }, { title });
}

function* shiftedGroups() {
  yield {
    state: shiftedGraph('Shifted sparse attention bridges neighboring groups'),
    highlight: { active: ['chunk0', 'chunk1', 'shift0', 'e-chunk0-shift0', 'e-chunk1-shift0'], found: ['train'] },
    explanation: 'LongLoRA uses shifted sparse attention during training. Tokens first learn from dense local groups, then shifted groups overlap neighboring ranges so boundary tokens are not trapped inside one chunk.',
    invariant: 'Training is cheaper because it avoids full dense attention over the entire long sequence.',
  };

  yield {
    state: labelMatrix(
      'Training attention schedule',
      [
        { id: 'dense', label: 'dense long' },
        { id: 'local', label: 'local groups' },
        { id: 'shift', label: 'shifted groups' },
        { id: 'infer', label: 'inference' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'link', label: 'cross-group link' },
      ],
      [
        ['high', 'full'],
        ['low', 'weak'],
        ['low', 'neighbor'],
        ['dense possible', 'full model'],
      ],
    ),
    highlight: { active: ['shift:cost', 'shift:link'], compare: ['dense:cost', 'local:link'] },
    explanation: 'The sparse pattern is a training-time cost control. It lowers fine-tuning memory and compute, but it does not by itself lower the cost of serving long prompts after the model is adapted.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 2048, max: 100000 }, y: { label: 'relative attention training cost', min: 0, max: 1.0 } },
      series: [
        { id: 'dense', label: 'dense fine-tune', points: [
          { x: 2048, y: 0.04 }, { x: 8192, y: 0.16 }, { x: 32768, y: 0.50 }, { x: 65536, y: 0.78 }, { x: 100000, y: 1.0 },
        ] },
        { id: 'shifted', label: 'shifted sparse', points: [
          { x: 2048, y: 0.04 }, { x: 8192, y: 0.07 }, { x: 32768, y: 0.12 }, { x: 65536, y: 0.20 }, { x: 100000, y: 0.29 },
        ] },
      ],
      markers: [
        { id: 'extend', x: 100000, y: 0.29, label: 'context extension' },
      ],
    }),
    highlight: { active: ['shifted', 'extend'], compare: ['dense'] },
    explanation: 'The paper motivation is simple: dense long-context fine-tuning gets expensive quickly. Sparse shifted groups reduce the training bill enough to make context extension practical.',
  };

  yield {
    state: labelMatrix(
      'Boundary behavior',
      [
        { id: 'inside', label: 'inside group' },
        { id: 'boundary', label: 'boundary' },
        { id: 'far', label: 'far apart' },
        { id: 'global', label: 'global task' },
      ],
      [
        { id: 'works', label: 'works' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['cheap', 'local bias'],
        ['shift helps', 'edge cases'],
        ['not direct', 'retrieval tasks'],
        ['evaluate', 'false pass'],
      ],
    ),
    highlight: { active: ['boundary:works', 'far:watch', 'global:watch'], found: ['inside:works'] },
    explanation: 'Shifted groups help adjacent chunks communicate, but they are not a proof that the model learned every long-range dependency. Boundary, middle-position, and far-retrieval tasks still need direct evaluation.',
  };
}

function* tuningStack() {
  yield {
    state: graphState({
      nodes: [
        { id: 'base', label: 'base LLM', x: 0.8, y: 3.8, note: 'frozen mostly' },
        { id: 'lora', label: 'LoRA', x: 2.7, y: 2.5, note: 'low rank' },
        { id: 'embed', label: 'embed', x: 2.7, y: 5.1, note: 'train' },
        { id: 'norm', label: 'norms', x: 4.8, y: 5.1, note: 'train' },
        { id: 's2', label: 'S2-Attn', x: 4.8, y: 2.5, note: 'shift sparse' },
        { id: 'long', label: 'long ctx', x: 7.0, y: 3.8, note: 'extend' },
        { id: 'eval', label: 'eval', x: 9.0, y: 3.8, note: 'short + long' },
      ],
      edges: [
        { id: 'e-base-lora', from: 'base', to: 'lora' },
        { id: 'e-base-embed', from: 'base', to: 'embed' },
        { id: 'e-embed-norm', from: 'embed', to: 'norm' },
        { id: 'e-lora-s2', from: 'lora', to: 's2' },
        { id: 'e-norm-long', from: 'norm', to: 'long' },
        { id: 'e-s2-long', from: 's2', to: 'long' },
        { id: 'e-long-eval', from: 'long', to: 'eval' },
      ],
    }, { title: 'LongLoRA is more than ordinary LoRA' }),
    highlight: { active: ['lora', 'embed', 'norm', 's2'], found: ['long', 'eval'] },
    explanation: 'LongLoRA combines parameter-efficient adapters with trainable embeddings and normalization layers. The paper argues those extra trainable pieces matter for context extension.',
  };

  yield {
    state: labelMatrix(
      'Trainable parts',
      [
        { id: 'backbone', label: 'backbone' },
        { id: 'lora', label: 'LoRA adapters' },
        { id: 'embed', label: 'embedding' },
        { id: 'norm', label: 'normalization' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'why', label: 'why' },
      ],
      [
        ['mostly frozen', 'cost control'],
        ['train', 'task/context adapt'],
        ['train', 'position shift'],
        ['train', 'stability'],
      ],
    ),
    highlight: { active: ['lora:policy', 'embed:policy', 'norm:policy'], compare: ['backbone:policy'] },
    explanation: 'This is the case-study detail many summaries miss: long-context extension stresses embeddings and normalization, not only low-rank task adapters.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'trainable parameter budget', min: 0, max: 1 }, y: { label: 'context-extension quality', min: 0.4, max: 1 } },
      series: [
        { id: 'plain', label: 'LoRA only', points: [
          { x: 0.10, y: 0.50 }, { x: 0.20, y: 0.58 }, { x: 0.40, y: 0.64 }, { x: 0.80, y: 0.68 },
        ] },
        { id: 'longlora', label: 'LongLoRA recipe', points: [
          { x: 0.10, y: 0.58 }, { x: 0.20, y: 0.72 }, { x: 0.40, y: 0.83 }, { x: 0.80, y: 0.89 },
        ] },
      ],
      markers: [
        { id: 'recipe', x: 0.40, y: 0.83, label: 'adapters + embed/norm' },
      ],
    }),
    highlight: { active: ['longlora', 'recipe'], compare: ['plain'] },
    explanation: 'This stylized chart captures the recipe lesson: the same adapter budget works better when the long-context-sensitive layers are included in the tuning plan.',
  };

  yield {
    state: labelMatrix(
      'Compatible systems',
      [
        { id: 'flash', label: 'FlashAttention' },
        { id: 'rope', label: 'RoPE scaling' },
        { id: 'eval', label: 'Long eval' },
        { id: 'serve', label: 'Serving' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'question', label: 'question' },
      ],
      [
        ['kernel', 'does S2 fit?'],
        ['positions', 'stable at length?'],
        ['gate', 'copy and retrieval?'],
        ['dense attention', 'cost acceptable?'],
      ],
    ),
    highlight: { found: ['flash:role', 'rope:role', 'eval:role'], active: ['serve:question'] },
    explanation: 'LongLoRA is a training technique, not a serving optimizer. After fine-tuning, dense long-context inference can still be expensive, so serving cost remains a separate problem.',
  };
}

function* riskLedger() {
  yield {
    state: labelMatrix(
      'Risk ledger',
      [
        { id: 'short', label: 'short quality' },
        { id: 'long', label: 'long quality' },
        { id: 'boundary', label: 'boundaries' },
        { id: 'data', label: 'data' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['original tasks', 'short regression'],
        ['needle + QA', 'fake extension'],
        ['chunk edges', 'local overfit'],
        ['long corpus', 'format bias'],
      ],
    ),
    highlight: { active: ['short:test', 'long:test', 'boundary:test'], found: ['data:failure'] },
    explanation: 'Context extension can look successful while damaging short-context ability or overfitting to synthetic long data. The release gate needs both short and long evaluations.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'claim', label: '100k ctx', x: 0.8, y: 3.8, note: 'headline' },
        { id: 'short', label: 'short eval', x: 2.8, y: 2.5, note: 'preserve' },
        { id: 'needle', label: 'needle eval', x: 2.8, y: 5.1, note: 'retrieve' },
        { id: 'cost', label: 'serve cost', x: 5.0, y: 3.8, note: 'dense?' },
        { id: 'compare', label: 'baseline', x: 7.0, y: 3.8, note: 'full tune?' },
        { id: 'ship', label: 'ship?', x: 9.0, y: 3.8, note: 'evidence' },
      ],
      edges: [
        { id: 'e-claim-short', from: 'claim', to: 'short' },
        { id: 'e-claim-needle', from: 'claim', to: 'needle' },
        { id: 'e-short-cost', from: 'short', to: 'cost' },
        { id: 'e-needle-cost', from: 'needle', to: 'cost' },
        { id: 'e-cost-compare', from: 'cost', to: 'compare' },
        { id: 'e-compare-ship', from: 'compare', to: 'ship' },
      ],
    }, { title: 'A context-extension claim needs a full ledger' }),
    highlight: { active: ['short', 'needle', 'cost', 'compare'], found: ['ship'] },
    explanation: 'A context-extension claim is incomplete without the ledger. You need to know what was trained, what attention pattern was used, whether short quality held, and what inference cost remains afterward.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'position in context', min: 0, max: 100000 }, y: { label: 'retrieval accuracy', min: 0, max: 1 } },
      series: [
        { id: 'weak', label: 'weak extension', points: [
          { x: 1000, y: 0.92 }, { x: 25000, y: 0.78 }, { x: 50000, y: 0.50 }, { x: 75000, y: 0.32 }, { x: 100000, y: 0.20 },
        ] },
        { id: 'strong', label: 'validated extension', points: [
          { x: 1000, y: 0.91 }, { x: 25000, y: 0.86 }, { x: 50000, y: 0.80 }, { x: 75000, y: 0.74 }, { x: 100000, y: 0.70 },
        ] },
      ],
      markers: [
        { id: 'sweep', x: 75000, y: 0.74, label: 'position sweep' },
      ],
    }),
    highlight: { active: ['strong', 'sweep'], compare: ['weak'] },
    explanation: 'A long-context model should be tested across positions. A model can look fine near the beginning and end while failing in the middle or at chunk boundaries.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'lora', label: 'LoRA' },
        { id: 'rope', label: 'RoPE' },
        { id: 'flash', label: 'FlashAttn' },
        { id: 'lost', label: 'Lost middle' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'next', label: 'next' },
      ],
      [
        ['adapter tuning', 'parameter budget'],
        ['position scaling', 'LongRoPE'],
        ['training kernel', 'S2 attention'],
        ['evaluation', 'position sweep'],
      ],
    ),
    highlight: { found: ['lora:next', 'rope:next', 'lost:next'], active: ['flash:connection'] },
    explanation: 'LongLoRA is the bridge between LoRA and long-context systems. It only makes sense when read with position encoding, attention kernels, and long-context evaluation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shifted groups') yield* shiftedGroups();
  else if (view === 'tuning stack') yield* tuningStack();
  else if (view === 'risk ledger') yield* riskLedger();
  else throw new InputError('Pick a LongLoRA view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the shifted-groups view as a training schedule, not as the final serving path. Active group nodes show which tokens can attend during the current sparse pass, and the shifted nodes show the bridge that lets neighboring groups exchange signal.',
        'A safe inference is local: if two tokens fall inside one active group, dense attention can connect them during that pass. If they are far apart, the animation has not proven a direct path; it has only shown that shifted groups reduce boundary isolation.',
        {type: 'callout', text: 'LongLoRA reduces long-context training cost, but serving cost and long-range evaluation remain separate gates.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Absolute_positional_encoding.png', alt: 'Heatmap visualization of absolute positional encoding values across token positions and embedding dimensions.', caption: 'Absolute positional encoding illustration by Nils Blumer, Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LongLoRA exists because long-context fine-tuning is expensive before it is useful. A transformer with full attention compares every token with every other token, so an 8k training window has about 64 million pairwise attention positions per layer while a 64k window has about 4.1 billion.',
        'The goal is context adaptation, not a new base model. A team may already like a pretrained 7B model but need it to read long contracts, repositories, or reports without spending the budget of dense long-context training.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to fine-tune the model with dense attention at the target length. That gives every token a direct route to every other token and keeps the training objective simple.',
        'A cheaper obvious approach is ordinary LoRA, or Low-Rank Adaptation, where the base weights stay mostly frozen and small low-rank matrices learn the task update. That reduces trainable parameters, but by itself it does not solve the attention cost of training on very long sequences.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic attention cost. If sequence length grows from 8k to 64k, length grows 8x but the attention matrix grows 64x, so memory and compute can collapse batch size and slow every experiment.',
        'There is also an evaluation wall. A model can accept a 64k prompt and still fail to use a fact in the middle, preserve a boundary condition, or keep short-context behavior intact. A bigger window is only capacity until tests prove recall and reasoning across position.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that long-context adaptation does not need dense global attention at every training step. LongLoRA uses shifted sparse attention, called S2-Attn in the paper, so tokens attend densely inside local groups and then attend inside shifted groups that overlap neighboring boundaries.',
        'LoRA supplies the small trainable update, while the sparse schedule cuts the cost of exposing the model to long examples. The method also treats embeddings and normalization layers as context-sensitive parts of the recipe instead of assuming adapters alone can absorb the whole extension.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split a long training sequence into groups. In one pass, each token attends within its group; in another pass, the group boundary shifts so tokens near an old boundary share a group with tokens from the neighbor region.',
        'During fine-tuning, LoRA adapters learn low-rank deltas for selected weights while the shifted sparse schedule lowers attention memory. At inference, the adapted model may still use dense attention, so the training shortcut should not be confused with a serving shortcut.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a coverage argument, not a proof of perfect recall. Local dense groups preserve rich token interaction where most short-range syntax and discourse live, and shifted groups prevent every boundary from becoming a hard wall.',
        'The base model already contains language ability, so fine-tuning mainly teaches it how to use longer positional regimes and domain examples. The release is justified only if short-context controls, boundary probes, middle-position retrieval, and domain tasks all stay inside tolerance.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Dense attention over n tokens costs O(n^2) attention scores per layer. If a sparse group has size g and the sequence has n tokens, group attention behaves closer to O(n*g), so keeping g fixed makes the attention work grow roughly linearly with n during that training pass.',
        'The saved cost becomes more experiments: adapter rank, training data mixture, context length, and layer policy can be tested instead of spending everything on one dense run. The tax is that implementation has more moving parts and serving a long dense prompt still pays KV-cache memory and attention cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LongLoRA fits teams adapting an existing model to long legal documents, large code files, extended conversations, or research reports. The access pattern is many long examples during training and a need to keep the base model mostly intact.',
        'It is also useful as a comparison point for RoPE scaling, retrieval-augmented generation, FlashAttention, RingAttention, and sequence-parallel training. Each attacks a different bottleneck, so a real system may combine several of them.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the sparse training path is mistaken for evidence that all long-range dependencies were learned. Shifted groups help adjacent regions, but they do not prove exact retrieval of a clause 40k tokens away.',
        'It also fails as a deployment story if inference cost is ignored. A 100k-token prompt can still dominate latency, memory, batching, and cost per request even if the fine-tune was cheap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a team extends an 8k model to 64k for contract review. Dense training attention grows from 8,192 * 8,192 = 67,108,864 score positions to 65,536 * 65,536 = 4,294,967,296 per layer, a 64x jump.',
        'With 2,048-token groups, sparse group attention needs about 65,536 * 2,048 = 134,217,728 score positions per pass, before accounting for the shifted pass. That is far below dense 64k attention, but the release gate still asks whether facts at 4k, 32k, and 60k are retrieved correctly and whether ordinary 2k prompts regressed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LongLoRA at https://arxiv.org/abs/2309.12307 and the official implementation at https://github.com/dvlab-research/LongLoRA.',
        'Study LoRA, Attention Mechanism, RoPE, LongRoPE Non-Uniform RoPE Scaling, FlashAttention Case Study, RingAttention Sequence Parallelism, Lost in the Middle, KV Cache, and Benchmark Variance and Model Selection next.',
      ],
    },
  ],
};