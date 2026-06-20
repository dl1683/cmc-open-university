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
      heading: 'Why This Exists',
      paragraphs: [
        'LongLoRA is a method for extending the context window of pretrained language models without paying the full cost of dense long-context fine-tuning. The practical problem is familiar: a model trained for a shorter context may fail or degrade when asked to use much longer sequences. Training it densely at the target length is expensive because attention cost grows quickly with sequence length.',
        'The method combines parameter-efficient tuning with shifted sparse attention during training. LoRA-style adapters reduce the number of trainable parameters. Shifted sparse attention reduces the cost of training on long sequences. The goal is not to invent a new serving architecture from scratch. The goal is to adapt an existing model to longer contexts at a more affordable training cost.',
        {type: 'callout', text: 'LongLoRA reduces long-context training cost, but serving cost and long-range evaluation remain separate gates.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Absolute_positional_encoding.png', alt: 'Heatmap visualization of absolute positional encoding values across token positions and embedding dimensions.', caption: 'Absolute positional encoding illustration by Nils Blumer, Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'The naive approaches and their walls',
      paragraphs: [
        'The first naive approach is to fine-tune with full dense attention at the desired context length. That preserves the cleanest training signal, but the cost can be prohibitive. Long sequences stress memory, reduce batch size, complicate parallelism, and make experimentation slow. The longer the target context, the more expensive this path becomes.',
        'The second naive approach is to apply positional scaling or context-extension tricks and hope the model generalizes. That may help, but it does not guarantee that the model learns to use long evidence. A model can accept a long prompt while still failing retrieval in the middle, losing short-context quality, or mishandling boundaries.',
        'The third naive approach is to tune only a small adapter and ignore the parts of the model most affected by context length. LongLoRA highlights that embeddings and normalization layers can matter for context extension. Parameter efficiency is useful, but it should not become a superstition that forbids touching sensitive components.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The attention trick is S2-Attn, or shifted sparse attention. During training, the long sequence is divided into local groups. Tokens attend densely within their group, which is cheaper than attending across the full sequence. A shifted grouping pattern then changes the group boundaries so information can cross neighboring regions. Local groups keep cost bounded; shifts keep chunks from becoming isolated islands.',
        'This is mainly a training-time cost reduction mechanism. The paper describes using sparse attention while fine-tuning, with the model able to use ordinary dense attention at inference. That distinction matters. LongLoRA can reduce the cost of adapting the model, but it does not automatically make long-context serving cheap.',
        'The tuning stack matters too. LoRA adapters provide parameter-efficient updates, but the method also pays attention to embeddings and normalization. Extending context changes positional distributions and activation behavior. If those layers cannot adapt, the model may technically run at longer length while using the extra context poorly.',
      ],
    },
    {
      heading: 'Why It Works and Correctness Boundaries',
      paragraphs: [
        'LongLoRA can work because long-context fine-tuning does not necessarily need every token pair to interact densely at every step. Many useful long-context behaviors can be learned from local regions plus shifted bridges. The sparse pattern gives the model enough cross-boundary exposure to adapt while avoiding the full cost of dense attention over the entire sequence.',
        'It can also work because the base model already contains substantial language and reasoning ability. Fine-tuning for longer context is partly about adapting positional use, attention behavior, and instruction following under long inputs. Parameter-efficient updates can be enough when the base model is strong and the target is adaptation rather than training from scratch.',
        'Correctness here means preserving the contract of the adapted model, not proving that every distant token can influence every answer. The training recipe is credible only when the adapted model still passes short-context controls, position-sweep retrieval, boundary tests, and task-specific long-document checks.',
        'The reason this is useful in practice is iteration speed. Long-context adaptation requires many experiments: data mixture, sequence length, positional scaling, adapter rank, which layers to tune, and evaluation slices. A cheaper training recipe lets teams run those experiments instead of spending the whole budget on one dense fine-tune.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'LongLoRA fits teams that have a pretrained model and want to adapt it to longer documents, conversations, code contexts, or domain corpora without full dense long-context training. A legal team might fine-tune on long contracts. A code team might train on larger repository windows. A research assistant might adapt to long reports with cross-section references.',
        'The method is especially useful as a curriculum bridge between LoRA and attention sparsity. LoRA teaches how to adapt a model with low-rank parameter updates. Sparse attention teaches how attention patterns control training cost. LongLoRA combines them for one concrete goal: context extension.',
        'It is not a replacement for retrieval or verification. A model that can accept 100k tokens may still fail exact clause retrieval, quote fidelity, or source attribution. Long-context fine-tuning can improve the model\'s ability to use long inputs, but high-stakes systems still need evidence selection, citation checks, and task-specific evaluation.',
      ],
    },
    {
      heading: 'Costs and failure modes',
      paragraphs: [
        'The main misconception is to confuse cheaper training with cheaper inference. If the adapted model uses dense attention at serving time, long prompts still create KV-cache and attention costs. Serving depends on FlashAttention, PagedAttention, KV-cache layout, batching, sequence parallelism, quantization, and workload shape. LongLoRA reduces one bottleneck, not all of them.',
        'Another failure mode is boundary weakness. Shifted sparse groups are meant to reduce isolation, but evaluation still needs to test facts that cross group boundaries and appear at many positions. A model can look good on synthetic long prompts while failing middle-position retrieval or exact copy tasks.',
        'Short-context regression is also possible. Extending context should not ruin the model\'s normal behavior. The release gate should include short instruction following, short QA, long retrieval, quote fidelity, multi-hop references, position sweeps, and latency and memory accounting under the real serving stack.',
      ],
    },
    {
      heading: 'A worked release gate',
      paragraphs: [
        'Suppose a team wants to adapt a 7B model for long legal contracts. The training plan uses LongLoRA with shifted sparse attention, adapters, and the context-sensitive layers the recipe calls out. The release gate should not ask only whether the model accepts a 64k or 100k prompt. It should ask whether the model can retrieve clauses at every position, preserve negations, follow definitions across sections, quote exact language, and still answer short legal questions as well as the base model.',
        'The cost gate is separate. The team should measure dense-inference memory, tokens per second, p95 latency, maximum batch size, and cost per analyzed contract. If the fine-tune improves long retrieval but makes serving unaffordable, the product may need retrieval, chunking, or a smaller context target rather than a larger advertised window.',
      ],
    },
    {
      heading: 'Practical Comparison Guidance',
      paragraphs: [
        'LongLoRA should be compared against several baselines: the base model with no context fine-tune, positional scaling methods, retrieval-augmented chunking, dense long-context fine-tuning when affordable, and other sparse or sequence-parallel training approaches. The comparison should report both quality and training cost, because the method is mainly about making context extension practical.',
        'The evaluation should also keep a short-context control set. Many context-extension demos focus only on long prompts, but a deployed assistant spends much of its time on ordinary short interactions. A model that becomes worse at common short tasks has paid an invisible tax for its longer window.',
        'A useful report also separates training-time savings from serving-time cost. If the method makes fine-tuning cheap but every production request becomes too expensive, the architecture is only a partial solution. If the long-window model is used selectively, the routing policy becomes part of the design.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'LongLoRA is best understood as an efficient adaptation recipe. It uses parameter-efficient tuning and shifted sparse attention to make long-context fine-tuning more practical. The sparse attention is part of training cost control; it should not be mistaken for a complete serving-cost solution.',
        'The deeper lesson is that context length is not one number. A system must preserve short behavior, use distant evidence, handle middle positions, keep inference affordable, and pass domain-specific tasks. A longer window is useful only when the model can actually use it.',
        'For course design, LongLoRA is a good place to teach the difference between architecture, fine-tuning recipe, evaluation protocol, and deployment economics. Those are often collapsed into one marketing phrase, but they fail independently.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LongLoRA at https://arxiv.org/abs/2309.12307 and the official implementation at https://github.com/dvlab-research/LongLoRA.',
        'Study LoRA, Attention Mechanism, RoPE, LongRoPE Non-Uniform RoPE Scaling, FlashAttention Case Study, RingAttention Sequence Parallelism, Lost in the Middle, KV Cache, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
