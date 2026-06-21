// Test-Time Training layers: make the recurrent hidden state a small model
// that updates itself with self-supervised gradient steps while reading context.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'test-time-training-layer-case-study',
  title: 'Test-Time Training Layer Case Study',
  category: 'Papers',
  summary: 'TTT layers replace a fixed recurrent hidden vector with a trainable hidden model, updated online by self-supervised loss over the current sequence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hidden model', 'mini-batch scan', 'serving fit'], defaultValue: 'hidden model' },
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

function hiddenModelGraph(title) {
  return graphState({
    nodes: [
      { id: 'token', label: 'x_t', x: 0.8, y: 3.7, note: 'token' },
      { id: 'feat', label: 'features', x: 2.4, y: 3.7, note: 'embed' },
      { id: 'model', label: 'theta', x: 4.2, y: 3.7, note: 'model state' },
      { id: 'read', label: 'pred', x: 6.0, y: 2.4, note: 'read' },
      { id: 'target', label: 'target', x: 6.0, y: 5.0, note: 'local' },
      { id: 'loss', label: 'loss', x: 7.6, y: 5.0, note: 'error' },
      { id: 'grad', label: 'step', x: 7.6, y: 3.7, note: 'grad' },
      { id: 'next', label: "theta'", x: 9.2, y: 3.7, note: 'carry' },
    ],
    edges: [
      { id: 'e-token-feat', from: 'token', to: 'feat' },
      { id: 'e-feat-model', from: 'feat', to: 'model' },
      { id: 'e-model-read', from: 'model', to: 'read' },
      { id: 'e-feat-target', from: 'feat', to: 'target' },
      { id: 'e-read-loss', from: 'read', to: 'loss' },
      { id: 'e-target-loss', from: 'target', to: 'loss' },
      { id: 'e-loss-grad', from: 'loss', to: 'grad' },
      { id: 'e-grad-next', from: 'grad', to: 'next' },
      { id: 'e-next-model', from: 'next', to: 'model', weight: 'carry' },
    ],
  }, { title });
}

function* hiddenModel() {
  yield {
    state: hiddenModelGraph('A TTT hidden state is a trainable model'),
    highlight: { active: ['token', 'feat', 'model', 'e-token-feat', 'e-feat-model'], found: ['read'] },
    explanation: 'A normal RNN carries a vector. A TTT layer carries parameters theta_t for a tiny model. The current token is encoded, the hidden model is read, and the next output is produced.',
    invariant: 'The hidden state is not a passive cache. It is a model that can be trained during the forward pass.',
  };

  yield {
    state: hiddenModelGraph('The sequence itself supplies the update signal'),
    highlight: { active: ['read', 'target', 'loss', 'grad', 'e-read-loss', 'e-target-loss', 'e-loss-grad'], found: ['next'] },
    explanation: 'The update is self-supervised. The layer forms a local target from the token stream, measures loss, takes a gradient step, and carries theta_(t+1) forward.',
  };

  yield {
    state: labelMatrix(
      'Long-context memory choices',
      [
        { id: 'kv', label: 'KV cache' },
        { id: 'ssm', label: 'SSM' },
        { id: 'tttl', label: 'TTT-Linear' },
        { id: 'tttm', label: 'TTT-MLP' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'update', label: 'update' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['token list', 'append', 'memory cost'],
        ['fixed vector', 'scan', 'capacity'],
        ['linear model', 'grad step', 'kernel fit'],
        ['small MLP', 'grad step', 'I/O cost'],
      ],
    ),
    highlight: { active: ['tttl:state', 'tttm:update'], compare: ['kv:state', 'ssm:risk'] },
    explanation: 'TTT sits between exact token memory and compact recurrent state. It keeps a richer state than a vector by letting that state be a learned predictor.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context tokens', min: 0, max: 32768 }, y: { label: 'relative loss', min: 0.45, max: 1.05 } },
      series: [
        { id: 'mamba', label: 'fixed recurrent state', points: [
          { x: 1024, y: 0.96 }, { x: 4096, y: 0.82 }, { x: 8192, y: 0.75 }, { x: 16384, y: 0.73 }, { x: 32768, y: 0.72 },
        ] },
        { id: 'transformer', label: 'attention', points: [
          { x: 1024, y: 0.98 }, { x: 4096, y: 0.78 }, { x: 8192, y: 0.67 }, { x: 16384, y: 0.58 }, { x: 32768, y: 0.52 },
        ] },
        { id: 'ttt', label: 'TTT layer', points: [
          { x: 1024, y: 0.97 }, { x: 4096, y: 0.77 }, { x: 8192, y: 0.65 }, { x: 16384, y: 0.56 }, { x: 32768, y: 0.50 },
        ] },
      ],
      markers: [
        { id: 'morectx', x: 32768, y: 0.50, label: 'keeps using context' },
      ],
    }),
    highlight: { active: ['ttt', 'morectx'], compare: ['mamba', 'transformer'] },
    explanation: 'The TTT paper frames the promise this way: linear-time recurrent execution, but a hidden state expressive enough to keep benefiting from longer context.',
  };
}

function* miniBatchScan() {
  yield {
    state: labelMatrix(
      'Inner-loop update ledger',
      [
        { id: 't1', label: 'tok 1' },
        { id: 't2', label: 'tok 2' },
        { id: 't3', label: 'tok 3' },
        { id: 't4', label: 'tok 4' },
      ],
      [
        { id: 'read', label: 'read' },
        { id: 'loss', label: 'loss' },
        { id: 'grad', label: 'grad' },
        { id: 'carry', label: 'carry' },
      ],
      [
        ['theta0', 'local', 'g1', 'theta1'],
        ['theta1', 'local', 'g2', 'theta2'],
        ['theta2', 'local', 'g3', 'theta3'],
        ['theta3', 'local', 'g4', 'theta4'],
      ],
    ),
    highlight: { active: ['t1:grad', 't2:grad', 't3:grad', 't4:grad'], found: ['t4:carry'] },
    explanation: 'The naive mental model is an online optimizer running once per token. That is clear, but raw per-token gradient descent would be a poor accelerator workload.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'stream', label: 'tokens', x: 0.8, y: 3.7, note: 'sequence' },
        { id: 'batch', label: 'mini batch', x: 2.5, y: 3.7, note: 'block' },
        { id: 'dual', label: 'dual form', x: 4.4, y: 3.7, note: 'parallel' },
        { id: 'scan', label: 'scan', x: 6.2, y: 3.7, note: 'prefix' },
        { id: 'state', label: 'theta state', x: 7.9, y: 3.7, note: 'updated' },
        { id: 'out', label: 'outputs', x: 9.3, y: 3.7, note: 'all tokens' },
      ],
      edges: [
        { id: 'e-stream-batch', from: 'stream', to: 'batch' },
        { id: 'e-batch-dual', from: 'batch', to: 'dual' },
        { id: 'e-dual-scan', from: 'dual', to: 'scan' },
        { id: 'e-scan-state', from: 'scan', to: 'state' },
        { id: 'e-state-out', from: 'state', to: 'out' },
      ],
    }, { title: 'Systems work turns online learning into a scan' }),
    highlight: { active: ['batch', 'dual', 'scan', 'e-batch-dual', 'e-dual-scan'], found: ['state', 'out'] },
    explanation: 'The implementation challenge is to recover accelerator-friendly batching. The TTT work uses mini-batch and dual-form views so the layer behaves more like a parallel scan than a slow Python optimizer loop.',
    invariant: 'The algorithmic object is an online learner; the systems object must still be a fused tensor program.',
  };

  yield {
    state: labelMatrix(
      'TTT implementation checkpoints',
      [
        { id: 'math', label: 'math' },
        { id: 'kernel', label: 'kernel' },
        { id: 'state', label: 'state' },
        { id: 'quality', label: 'quality' },
      ],
      [
        { id: 'must', label: 'must hold' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['same update order', 'wrong recurrence'],
        ['batch efficiently', 'launch overhead'],
        ['bounded memory', 'hidden blowup'],
        ['long-context eval', 'toy win only'],
      ],
    ),
    highlight: { active: ['kernel:must', 'state:must', 'quality:must'], compare: ['math:failure'] },
    explanation: 'A TTT layer is only interesting if the math, kernel, memory footprint, and long-context quality all survive together. Missing any one of those turns the idea into a demo.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens per block', min: 1, max: 512 }, y: { label: 'relative throughput', min: 0, max: 1.0 } },
      series: [
        { id: 'token', label: 'per-token update', points: [
          { x: 1, y: 0.12 }, { x: 16, y: 0.18 }, { x: 64, y: 0.22 }, { x: 256, y: 0.23 }, { x: 512, y: 0.22 },
        ] },
        { id: 'block', label: 'mini-batch TTT', points: [
          { x: 1, y: 0.14 }, { x: 16, y: 0.42 }, { x: 64, y: 0.67 }, { x: 256, y: 0.86 }, { x: 512, y: 0.91 },
        ] },
      ],
      markers: [
        { id: 'fuse', x: 256, y: 0.86, label: 'fused block' },
      ],
    }),
    highlight: { active: ['block', 'fuse'], compare: ['token'] },
    explanation: 'The performance story is about grain size. Bigger blocks expose enough work to fuse operations, but too much batching can delay state updates and change the model design.',
  };
}

function* servingFit() {
  yield {
    state: graphState({
      nodes: [
        { id: 'req', label: 'request', x: 0.8, y: 3.8, note: 'long doc' },
        { id: 'prefill', label: 'prefill', x: 2.4, y: 2.6, note: 'scan context' },
        { id: 'theta', label: 'theta cache', x: 4.2, y: 2.6, note: 'state' },
        { id: 'decode', label: 'decode', x: 6.0, y: 3.8, note: 'answer' },
        { id: 'kv', label: 'KV cache', x: 4.2, y: 5.1, note: 'maybe smaller' },
        { id: 'gate', label: 'quality gate', x: 7.8, y: 3.8, note: 'eval' },
        { id: 'ship', label: 'serve', x: 9.3, y: 3.8, note: 'if stable' },
      ],
      edges: [
        { id: 'e-req-prefill', from: 'req', to: 'prefill' },
        { id: 'e-prefill-theta', from: 'prefill', to: 'theta' },
        { id: 'e-theta-decode', from: 'theta', to: 'decode' },
        { id: 'e-kv-decode', from: 'kv', to: 'decode' },
        { id: 'e-decode-gate', from: 'decode', to: 'gate' },
        { id: 'e-gate-ship', from: 'gate', to: 'ship' },
      ],
    }, { title: 'Serving asks whether theta can replace some token memory' }),
    highlight: { active: ['prefill', 'theta', 'decode', 'e-prefill-theta', 'e-theta-decode'], compare: ['kv'], found: ['gate'] },
    explanation: 'Production serving would treat the learned hidden state as a cache artifact. The question is whether theta_t carries enough context to reduce exact KV pressure without breaking answers.',
  };

  yield {
    state: labelMatrix(
      'Where TTT could fit',
      [
        { id: 'agent', label: 'agent traces' },
        { id: 'code', label: 'codebase' },
        { id: 'video', label: 'video' },
        { id: 'chat', label: 'chat' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['long dependencies', 'drift'],
        ['names and APIs', 'exact recall'],
        ['temporal stream', 'latency'],
        ['history summary', 'safety'],
      ],
    ),
    highlight: { found: ['agent:pattern', 'code:watch', 'video:pattern'] },
    explanation: 'The best workloads are long, structured streams where the model can learn useful context regularities as it reads. Exact quoting and compliance still need external memory or verification.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 100000 }, y: { label: 'state memory', min: 0, max: 1.0 } },
      series: [
        { id: 'kv', label: 'full KV', points: [
          { x: 0, y: 0.02 }, { x: 25000, y: 0.27 }, { x: 50000, y: 0.52 }, { x: 75000, y: 0.76 }, { x: 100000, y: 1.0 },
        ] },
        { id: 'ttt', label: 'TTT state', points: [
          { x: 0, y: 0.10 }, { x: 25000, y: 0.12 }, { x: 50000, y: 0.13 }, { x: 75000, y: 0.14 }, { x: 100000, y: 0.15 },
        ] },
      ],
      markers: [
        { id: 'trade', x: 75000, y: 0.14, label: 'compressed' },
      ],
    }),
    highlight: { active: ['ttt', 'trade'], compare: ['kv'] },
    explanation: 'This is the serving promise in one picture: full KV grows with token count, while a learned hidden model can be bounded. The missing question is what it forgets.',
  };

  yield {
    state: labelMatrix(
      'Release gate',
      [
        { id: 'needles', label: 'needles' },
        { id: 'copy', label: 'copy' },
        { id: 'math', label: 'math' },
        { id: 'p99', label: 'p99' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['position sweep', 'long recall'],
        ['exact spans', 'compression risk'],
        ['multi-step', 'state update'],
        ['batch mix', 'serving truth'],
      ],
    ),
    highlight: { active: ['needles:test', 'copy:reason', 'p99:test'], found: ['math:reason'] },
    explanation: 'A credible case study would not stop at perplexity. It would test exact retrieval, copy fidelity, reasoning, tail latency, and interactions with batching.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hidden model') yield* hiddenModel();
  else if (view === 'mini-batch scan') yield* miniBatchScan();
  else if (view === 'serving fit') yield* servingFit();
  else throw new InputError('Pick a TTT layer view.');
}

export const article = {
  sections: [
    {
      heading: 'Why TTT layers exist',
      paragraphs: [
        'Test-Time Training layers exist because long-context sequence models face an uncomfortable choice. Full attention stores a growing KV cache of token-level memory. That is accurate and flexible, but the cache grows with context length, batch size, layers, KV heads, and precision. Recurrent and state-space models keep bounded state and scan efficiently, but a small fixed vector or state can forget exact details. TTT layers propose a different hidden state: instead of carrying only a vector, the layer carries a small model that can be trained while reading the sequence.',
        'The idea comes from Learning to Learn at Test Time, where the hidden state is treated as parameters theta_t of an inner model rather than a passive activation: https://arxiv.org/abs/2407.04620. As tokens arrive, the layer builds a self-supervised local objective, updates theta_t by gradient descent, and carries the updated parameters forward. TTT-Linear uses a linear hidden model. TTT-MLP uses a small multilayer perceptron. The promise is linear-time recurrent execution with a hidden state more expressive than a fixed vector.',
        {type:'callout', text:'TTT turns hidden state from a passive cache into an updateable model, so long context is represented by learned adaptation rather than token retention.'},
      ],
    },
    {
      heading: 'The naive answers fail',
      paragraphs: [
        'The naive attention answer is to keep every relevant token in the KV cache and let later tokens attend back to it. That is strong for exact recall, but it makes serving memory grow linearly with context and concurrency. A 100k-token request is not just a prompt; it is a resident memory commitment during decoding. Compression, eviction, sliding windows, grouped-query attention, and paged cache allocators help, but the basic cost remains tied to token history.',
        'The naive recurrent answer is to compress history into a fixed state and update it once per token. That gives predictable memory and fast scans, but the state may blur rare names, numbers, code identifiers, or contradictions. A third naive version of TTT would literally run a tiny optimizer step in Python for every token. That captures the concept but destroys accelerator throughput. A useful TTT layer has to satisfy both sides: it must behave like online learning over the sequence and still compile into large, fused tensor operations.',
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        'A token enters the layer and is converted into features. The hidden model theta_t is read to produce an output for the token stream. The layer also forms a local self-supervised target from the same stream, computes a loss, takes a gradient step, and carries theta_(t+1) to the next position. In data-structure terms, the hidden state is an updateable object with read, score, gradient, write, and carry operations. It is not simply a cache entry or a vector register.',
        'The paper introduces systems tricks so the inner learning process is not a serial optimizer loop. Mini-batch formulations group tokens so the update can be expressed as block tensor work. Dual-form views make some updates more parallelizable. Prefix-scan structure preserves the recurrence order while exposing enough work for accelerators. This is why TTT belongs beside Mamba, RWKV, RetNet, linear attention, and KV-cache compression in the curriculum. All of them ask what kind of state should represent long history, but TTT makes the state itself a trainable predictor.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The hidden-model view proves the conceptual shift. The node labeled theta is the hidden state, but it is also a model with parameters. The read path produces an output. The target and loss path creates an update signal from the current sequence. The gradient step produces the next hidden model. That picture is the difference between ordinary recurrence and TTT: the state is not only carried forward; it is trained during the forward pass.',
        'The mini-batch scan view proves why the idea is partly a systems problem. The clear mathematical story is one online update after another. The efficient hardware story needs blocks, scans, and fused kernels. The serving-fit view proves the product question: a bounded theta cache is useful only if it replaces enough exact token memory without forgetting facts the answer needs. The plot contrasting KV growth with bounded TTT state is not a free-lunch claim. It is a tradeoff curve whose missing axis is what information the compressed state lost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'TTT can work when a long sequence contains patterns that are useful to learn locally. A repository trace may repeat file names, APIs, style conventions, error messages, and build-system patterns. A long video or sensor stream may contain stable local dynamics. A long conversation may contain recurring entities and preferences. If the hidden model can adapt to these regularities as it reads, later tokens can consult a context-specialized predictor rather than a generic fixed state.',
        'The design is also attractive because it separates exact token memory from learned context memory. Not every piece of history needs to be recalled verbatim. Some history is better represented as a local model of the current stream. Attention can still be used elsewhere in a hybrid architecture, and external retrieval or verification can handle exact facts. TTT is strongest as a candidate memory representation, not as a universal replacement for all attention.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The first cost is compute. A hidden model update includes loss computation and gradient-like work inside the forward path. Even if the state is bounded, the update has to be implemented efficiently enough to compete with optimized attention and state-space kernels. TTT-Linear is simpler and more kernel-friendly. TTT-MLP can represent richer transformations but carries more memory traffic and arithmetic. If operations are too small or unfused, the layer can lose despite having an elegant asymptotic story.',
        'The second cost is reliability. A learned compressed state can forget or distort exact spans, numbers, citations, code symbols, or safety instructions. Test-time adaptation also changes the debugging surface. Engineers need visibility into the state update path, not just the prompt and final output. A bad local target, unstable learning rate, precision issue, or batching approximation can change behavior across long contexts. Quality gates must include exact-copy tasks, needle sweeps, long multi-step reasoning, and adversarial cases where a compressed state is tempted to summarize away the decisive fact.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Evaluate a TTT layer by the information it preserves, not only by its asymptotic memory curve. The checklist should include exact-copy spans, rare identifiers, late contradictions, long-range dependency tasks, latency under mixed batch sizes, and failure behavior when the inner update becomes unstable.',
        'A serving design also needs state observability. If theta is a cache artifact, the system should know which model version produced it, which context prefix trained it, whether it can be reused, and when it must be discarded. Otherwise the hidden model becomes an opaque source of quality drift.',
      ],
    },
    {
      heading: 'Where it helps and where it fails',
      paragraphs: [
        'Promising workloads are long, structured streams where local adaptation can absorb repeated regularities: agent traces, codebase reading, scientific logs, video, robotics trajectories, and conversations with stable local entities. These are settings where a context-specific predictor may be more useful than a generic recurrent vector. In serving, the attraction is a state object that can be cached after prefill and reused during decode with less growth than full KV memory.',
        'TTT fails when the task requires exact recall that the hidden model did not preserve, when the kernel path is immature, when batching changes the intended update semantics, or when aggregate perplexity hides failures on exact long-context tasks. It is also not a replacement for external memory, retrieval, citation checks, or verifiers. A credible deployment plan would compare against full attention, sliding-window attention, state-space models, recurrent transformers, hybrid attention, and KV compression at the same latency and memory budget.',
        'Primary sources: Learning to Learn at Test Time at https://arxiv.org/abs/2407.04620 and the official implementation at https://github.com/test-time-training/ttt-lm-jax. Study Backpropagation, Gradient Flow, KV Cache, Transformer Inference Roofline, Selective State Space Models: Mamba, RWKV Recurrent Transformer, RetNet Retention State Case Study, Hybrid Attention State Budget Case Study, Titans Test-Time Neural Memory, Activation Checkpointing, and Benchmark Variance and Model Selection next. The durable habit is to treat hidden state as a data structure with semantics, costs, and failure modes.',
      ],
    },
  ],
};
