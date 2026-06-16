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
    explanation: 'LongLoRA uses shifted sparse attention during training. Tokens attend locally within groups, then shifted groups overlap neighboring ranges so information can cross group boundaries.',
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
    explanation: 'The trick is temporary. Shifted sparse attention makes fine-tuning cheaper, while the resulting model can still use ordinary dense attention at inference time.',
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
    explanation: 'Shifted groups help adjacent chunks communicate, but they are not a complete replacement for global attention during every training step. Long-context eval still matters.',
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
    explanation: 'The phrase "extends context" is incomplete. You need to know what was trained, what attention pattern was used, whether short quality held, and what inference cost is afterward.',
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
      heading: 'What it is',
      paragraphs: [
        'LongLoRA is an efficient fine-tuning method for extending the context window of pretrained language models. It combines a LoRA-style parameter-efficient tuning setup with shifted sparse attention during training. The point is to make long-context fine-tuning affordable while preserving the original model architecture.',
        'The core attention trick is S2-Attn, shifted sparse attention. During training, the long sequence is split into local groups, and shifted groupings overlap neighboring regions so information can cross group boundaries without paying full dense attention cost on every step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A dense long-context fine-tune has expensive attention cost. LongLoRA trains with local sparse groups and shifted overlaps. The model can later use dense attention at inference, so S2-Attn is mainly a training-time cost reduction mechanism.',
        'The tuning recipe also matters. The paper revisits parameter-efficient fine-tuning and emphasizes training embeddings and normalization layers along with LoRA adapters. Those layers are sensitive to context extension and positional distribution shifts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'LongLoRA reduces training cost, not serving cost. A model fine-tuned to 100k context may still be expensive to run with dense attention. Serving still depends on KV cache, FlashAttention, PagedAttention, sequence parallelism, routing, and workload shape.',
        'The method also introduces evaluation obligations. Sparse training can hide boundary artifacts, and context extension can degrade short-context performance. The release gate needs short tasks, long retrieval, copy fidelity, middle-position sweeps, and cost accounting.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Suppose a team wants a 7B model to read long legal contracts. A full dense fine-tune at the target context is expensive. LongLoRA trains adapters, embeddings, and norms while using shifted sparse attention. The result is checked on short legal QA, long clause retrieval, cross-section references, and inference cost under the target serving stack.',
        'If the model passes only synthetic long prompts but fails exact clause retrieval, the context extension is not production-ready. The method reduces one bottleneck; it does not remove the need for retrieval, citations, and verification.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not confuse training-time sparse attention with free dense inference. Do not evaluate only at the maximum context length. Also avoid treating adapter-only tuning as sufficient by default; LongLoRA specifically calls out embeddings and normalization as important for context extension.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: LongLoRA at https://arxiv.org/abs/2309.12307 and the official implementation at https://github.com/dvlab-research/LongLoRA.',
        'Study LoRA, Attention Mechanism, RoPE, LongRoPE Non-Uniform RoPE Scaling, FlashAttention Case Study, RingAttention Sequence Parallelism, Lost in the Middle, KV Cache, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
