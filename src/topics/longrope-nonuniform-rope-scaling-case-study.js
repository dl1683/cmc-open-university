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
      heading: 'Why LongRoPE exists',
      paragraphs: [
        'Long context is useful because many real tasks do not fit inside a small prompt. Codebase review, legal discovery, long conversation memory, repository migration, multi-document research, and video or log analysis can require hundreds of thousands of tokens. A short-window model can still solve those tasks with retrieval, chunking, and summarization, but those systems introduce their own failure modes. They may retrieve the wrong chunk, hide global structure, or lose exact ordering. A longer native context window gives the model a larger working surface.',
        'LongRoPE exists because extending a RoPE-based transformer is not the same as raising a maximum length constant. Rotary position embeddings encode token position by rotating query and key dimensions with position-dependent angles. The model learns to use those rotations inside the training window. Far outside that window, the same frequency ladder can produce angles the model has not learned to interpret. The result can be unstable attention, bad local ordering, weak retrieval, or impressive input length with poor use of the middle.',
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        'The simplest idea is uniform interpolation: compress every new position into the old position range with one scale factor. If an 8k model must accept 128k tokens, divide positions by a constant so the rotations stay closer to the original range. This is appealing because it is cheap and easy to explain. It also fails in a predictable way. All RoPE dimensions are not used in the same way. Low-frequency bands carry long-range information, while high-frequency bands help preserve nearby order. Stretching every band equally can damage local precision while still not giving enough useful long-range structure.',
        'Another naive idea is to train on a few long examples and assume the model will adapt. Long data is expensive, sparse, and often repetitive. Dense attention and KV cache memory become serious costs. Evaluation is also difficult because a model can pass shallow long-context tests while failing retrieval from the middle or confusing repeated facts. LongRoPE treats context extension as a position-encoding and adaptation problem, not as a benchmark headline.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is non-uniformity. LongRoPE does not use one global stretch factor for the whole RoPE system. It searches a table of scaling factors across RoPE dimensions and positions. Different frequency bands can be stretched by different amounts. Different position regions can also be handled differently, especially the new tail beyond the original context window. This gives the method more degrees of freedom than simple interpolation while keeping the change focused on position encoding rather than redesigning the whole transformer.',
        'The table matters because RoPE is a frequency ladder. A high-frequency dimension changes quickly with position and helps distinguish nearby tokens. A low-frequency dimension changes slowly and can represent longer spans. If every dimension is stretched equally, the model can lose the short-distance cues that make ordinary prompts work. Non-uniform scaling lets long-range bands absorb more of the extension while local bands are protected. The method is still constrained by the original model, but it gives the search procedure a better set of knobs.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'LongRoPE starts with a RoPE-based model and searches candidate scaling factors. The search objective is to find a non-uniform rescaling that keeps rotations useful across the target window. The paper describes scaling along dimensions and positions, then evaluating candidate choices before fine-tuning. The searched table becomes the initialization for extension. Instead of relying on a hand-picked constant, the method asks which bands and ranges should stretch more and which should remain closer to the original behavior.',
        'The extension is progressive. First, the model is adapted to a large intermediate context, such as a hundreds-of-thousands-token window. After that adaptation, another interpolation step stretches toward a much larger target. This staged path is important because it avoids shocking the model with the final length in one move. The method also includes short-context readjustment. That step matters because most production prompts are still short. A context extension that ruins normal 2k, 4k, or 8k behavior is not a usable upgrade.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The nonuniform-scaling visual is proving that the object being learned is a scaling table, not a marketing number. The uniform line shows the naive one-factor story. The LongRoPE-style curve shows the richer story: low-frequency dimensions can be stretched more, high-frequency dimensions can stay more local, and tail positions can receive special treatment. The visual is not claiming exact paper values. It is showing why a table can express a better compromise than one multiplier.',
        'The progressive-extension and short-recovery views are proving that long context is a release process. First the model receives a searched scaling initialization. Then it is tuned at an intermediate length. Then it is stretched farther. Then short-context performance is checked and repaired. The final graph with routing, benchmarks, and cost is the deployment lesson: a huge window should be available when needed, but it should not become the default path for every request.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The approach works when the original model already has useful language and reasoning behavior and the main mismatch is positional extrapolation. RoPE gives a smooth mathematical structure, so rescaling the angles can move new positions into a range that the model can learn to use. Non-uniform scaling preserves more local structure than blunt interpolation. Fine-tuning then teaches the weights how to operate with the adjusted positional geometry. The method does not invent long-context skill from nothing; it reduces the distance between the old positional regime and the new one.',
        'Progressive extension works for the same reason staged migrations work in systems. A smaller extension creates evidence about what breaks and gives the model a closer target. Once the model adapts, the next stretch starts from a better base. Short-context readjustment works because the extension changes behavior in the region users still hit most often. Restoring that region is not cosmetic. It protects the common case while preserving access to the rare long case.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'LongRoPE changes position encoding. It does not remove the cost of attention. If a model attends densely over a million tokens, prefill latency, KV cache memory, scheduling complexity, and GPU memory pressure are still central problems. Training or fine-tuning at long lengths also needs special infrastructure. Sequence parallelism, memory-efficient attention, checkpointing, and careful data construction may matter more than the scaling formula once the target length becomes very large.',
        'The method also increases evaluation cost. A team must test short tasks, long retrieval, multi-hop references, copy accuracy, code navigation, repeated facts, and middle-position recall. It must compare against retrieval-augmented generation, chunked summarization, and smaller routed contexts. The tradeoff is capability versus cost. A large native context can simplify some workflows, but using it blindly can be slower, more expensive, and sometimes less accurate than a smaller context with good retrieval.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Treat LongRoPE as a model change that needs a rollout plan. Keep the original short-context model or mode available until short-window regressions are measured. Record the base model, scaling table, target length, fine-tuning data, sequence length schedule, tokenizer, RoPE settings, attention implementation, and evaluation suite. If any of those move, rerun the long and short checks.',
        'Use traffic routing. Most requests do not need a huge context window, so route by task shape: short answers stay on the cheap path, medium document tasks use retrieval and packing, and only full-document or full-repository work uses the long-context path. Monitor prefill time, KV cache bytes, out-of-memory rate, truncation rate, middle-position accuracy, and answer citation quality. Long context should earn its bill on the workloads that actually need it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A practical use case is repository analysis. A team wants a model to inspect many files, follow definitions across directories, and reason about a migration plan. LongRoPE can help adapt a base model so it can accept far more source text. That does not eliminate retrieval. Exact file references, dependency graphs, and incremental loading are still valuable. The useful system often combines a long-context model, code-aware retrieval, context packing, and a router that decides when the large window is actually needed.',
        'Another use case is legal or compliance review, where order and cross-reference matter. Long context can keep a full contract set, deposition transcript, or policy bundle visible in one pass. Even there, the system should preserve citations and segment boundaries. The model should know which text came from which document. LongRoPE supplies a positional extension technique; a production product still needs document indexing, source tracking, permission checks, and cost controls.',
      ],
    },
    {
      heading: 'Concrete case',
      paragraphs: [
        'Imagine an 8k RoPE model that performs well on normal coding questions but fails when asked to reason over a 400k-token monorepo snapshot. The naive team raises the context limit with one interpolation factor, packs the whole repository, and sees mixed results: the model accepts the prompt, but it confuses duplicate helper names and misses a migration constraint buried near the middle.',
        'A LongRoPE-style path would search non-uniform scaling factors, tune at an intermediate length, test middle retrieval and local code edits, then readjust short-context behavior. The deployment would still keep a repository index and a context router. The win is not "put every file in every prompt." The win is that rare tasks needing a broad working set can use one, while ordinary tasks keep the cheaper path.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The main failure mode is confusing accepted length with usable memory. A model may accept two million tokens and still ignore the middle, overfocus on the start and end, or blend repeated facts. Lost-in-the-middle behavior is an evaluation problem, not only a model architecture problem. A second failure mode is short-context regression. If routine prompts become worse after extension, the longer window is a bad trade for most traffic.',
        'A third limit is portability. RoPE scaling recipes are not interchangeable across model families, training data, fine-tuning budgets, and target lengths. Position interpolation, NTK-aware scaling, YaRN, LongLoRA, and LongRoPE make different assumptions. A fourth limit is serving cost. When the prompt is short, routing to a huge context path wastes memory and latency. Long context is a tool for tasks that need it, not a default operating mode.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read the LongRoPE paper at https://arxiv.org/abs/2402.13753 and the Microsoft LongRoPE implementation at https://github.com/microsoft/LongRoPE. Then study RoPE, Positional Encoding, Attention Mechanism, LongLoRA Shifted Sparse Attention, YaRN and NTK-aware RoPE scaling, Lost in the Middle, KV Cache, RingAttention Sequence Parallelism, Transformer Inference Roofline, PagedAttention, RAG Context Packing, and evaluation methods for long-context retrieval. The right mental model is position-encoding surgery plus system-level routing, not unlimited memory.',
      ],
    },
  ],
};
