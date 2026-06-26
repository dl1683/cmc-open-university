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
    { heading: 'How to read the animation', paragraphs: [
        'Read theta as the hidden state, where theta means the parameters of a small inner model carried across tokens. Active nodes show the current token being read, the local loss being formed, or the inner parameters being updated.',
        'The safe inference rule is that history is retained only if the update changes theta in a useful direction. A passive cache stores token records, but a test-time training layer stores adaptation, so the animation should be read as online learning inside a sequence model.',
        {type:'callout', text:'TTT turns hidden state from a passive cache into an updateable model, so long context is represented by learned adaptation rather than token retention.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'Test-Time Training, or TTT, exists because long-context models face a memory problem. Full attention keeps key-value records for past tokens, which gives exact access but makes serving memory grow with sequence length, batch size, layer count, and precision.',
        'A recurrent model has bounded memory because it carries a fixed hidden state from token to token. The problem is capacity: a fixed vector can forget rare names, numbers, code identifiers, or contradictions that become important much later.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to keep every past token available through attention. That works well for exact recall because the current token can compare against each earlier token in the context window.',
        'Another obvious approach is to compress the whole prefix into one recurrent state. That gives predictable memory and linear scanning, and it is attractive when the model must process long streams without storing every token.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is that exact memory and cheap memory pull in opposite directions. Attention keeps detail but pays for resident key-value cache, while fixed recurrence is cheap but can blur information that needs to survive thousands of steps.',
        'A naive TTT implementation also hits a systems wall. If every token triggers a small Python optimizer step, accelerator throughput collapses because the computation becomes a serial training loop instead of a fused tensor program.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to make the hidden state an updateable model. Instead of carrying only an activation vector, the layer carries parameters theta_t, uses the current token stream to form a self-supervised loss, and updates theta_t into theta_t+1.',
        'This turns long context into a learned adaptation problem. The model does not remember every token; it changes a compact predictor so future tokens can benefit from what the prefix taught it.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'For each token, the layer builds features, reads the current inner model theta_t, computes an output, and forms a local training target from the same sequence. It measures prediction error, takes a gradient step, and carries the updated theta_t+1 forward.',
        'Efficient TTT layers batch the inner updates so hardware sees blocks and scans rather than one optimizer call per token. The paper uses formulations such as TTT-Linear and TTT-MLP, where the inner hidden model is either a linear map or a small multilayer perceptron.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is not that TTT perfectly remembers the past. The invariant is weaker: after each token, theta contains the result of applying the specified update rule to all tokens processed so far in order.',
        'If the local objective teaches a useful predictive feature, later tokens can read that feature through theta. If the objective is poorly aligned, the layer still follows the update rule correctly, but the learned state may not store the facts the downstream task needs.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'TTT aims for linear sequence cost: doubling tokens roughly doubles the number of update steps rather than creating an all-pairs attention table. Space is bounded by the inner model parameters plus block working memory, not by one key-value record for every past token.',
        'The cost is hidden in the update. A two-layer inner MLP with 1024 input features and 4096 hidden features stores millions of parameters, so memory bandwidth and fused update kernels can dominate latency even when asymptotic sequence length looks favorable.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'TTT is useful as a research direction for long-context language modeling, time-series streams, code streams, and any sequence where the prefix teaches a local pattern that will be useful later. It belongs near Mamba, RWKV, RetNet, linear attention, and KV-cache compression because all of them ask what state should represent history.',
        'It is also useful for systems thinking. Serving teams can ask whether they want to pay for token retention, fixed recurrence, or online adaptation, then compare latency, memory, kernel complexity, and recall behavior under the same context length.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'TTT fails when the local self-supervised objective does not capture what the task will need later. A name, legal clause, or exact code identifier can be important even if it did not produce a large useful update at the time it appeared.',
        'It also fails as an easy serving drop-in when the kernels are not optimized. Online updates create training-like work during inference, so batching, scans, precision choices, and memory movement decide whether the idea is practical.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose the inner model is a linear map with 4 input features and 2 output features, so theta is a 2 by 4 matrix with 8 weights. A token produces key k = [1, 0, 2, 1] and target v = [3, 1], while current theta predicts [2, 2].',
        'The error is prediction minus target, so e = [-1, 1] if we define target minus prediction for the update direction. With learning rate 0.1, the outer-product update changes theta by 0.1 times e times k, which adds [-0.1, 0, -0.2, -0.1] to the first row and [0.1, 0, 0.2, 0.1] to the second row.',
        'The next token reads the revised theta. The cost of this step is proportional to the feature dimension and output dimension, while attention over 100000 prior tokens would also need to keep and scan a much larger token-level memory.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary source: Learning to Learn at Test Time at https://arxiv.org/abs/2407.04620. Read it for the hidden-state-as-model framing, TTT-Linear, TTT-MLP, and the systems work needed to make recurrent online learning run on accelerators.',
        'Study KV Cache, Transformer Attention, Mamba Selective State Space, RWKV, linear attention, prefix scans, online gradient descent, and inference roofline analysis next. The key comparison is not only accuracy; it is how each design spends memory, bandwidth, and compute as context length grows.',
      ],
    },
  ],
};
