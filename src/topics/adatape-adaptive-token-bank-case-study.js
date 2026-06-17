// AdaTape: adapt compute by appending a variable number of learned or
// input-derived tape tokens, instead of changing model depth directly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'adatape-adaptive-token-bank-case-study',
  title: 'AdaTape Adaptive Token Bank',
  category: 'Papers',
  summary: 'Adaptive computation through elastic input sequences: select tape tokens from a bank, append them to the input, and spend more FLOPs only when needed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tape bank', 'elastic input'], defaultValue: 'tape bank' },
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

function tapeGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.6, y: 3.8, note: 'tokens' },
      { id: 'summary', label: 'summary', x: 2.2, y: 3.8, note: 'query' },
      { id: 'bank', label: 'tape bank', x: 3.9, y: 2.2, note: 'candidates' },
      { id: 'reader', label: 'ATR', x: 5.5, y: 3.8, note: 'select' },
      { id: 'chosen', label: 'tape toks', x: 7.2, y: 2.2, note: 'extra' },
      { id: 'append', label: 'append', x: 7.2, y: 5.1, note: 'elastic' },
      { id: 'xfmr', label: 'xfmr', x: 9.0, y: 3.8, note: 'shared' },
    ],
    edges: [
      { id: 'e-input-summary', from: 'input', to: 'summary', weight: 'pool' },
      { id: 'e-summary-reader', from: 'summary', to: 'reader', weight: 'query' },
      { id: 'e-bank-reader', from: 'bank', to: 'reader', weight: 'keys' },
      { id: 'e-reader-chosen', from: 'reader', to: 'chosen', weight: 'ids' },
      { id: 'e-input-append', from: 'input', to: 'append', weight: 'base' },
      { id: 'e-chosen-append', from: 'chosen', to: 'append', weight: 'extra' },
      { id: 'e-append-xfmr', from: 'append', to: 'xfmr', weight: 'sequence' },
    ],
  }, { title });
}

function* tapeBank() {
  yield {
    state: tapeGraph('AdaTape adapts the input length'),
    highlight: { active: ['bank', 'reader', 'chosen', 'append'], found: ['xfmr'] },
    explanation: 'AdaTape changes compute by changing how many extra tape tokens are appended to the input. Instead of asking a token to halt at a different depth, it gives hard examples a larger elastic input sequence.',
  };

  yield {
    state: labelMatrix(
      'Tape bank variants',
      [
        { id: 'inputBank', label: 'input bank' },
        { id: 'learnBank', label: 'learn bank' },
        { id: 'reader', label: 'ATR' },
        { id: 'append', label: 'append' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['from input', 'fine detail'],
        ['trainable', 'scratchpad'],
        ['query bank', 'pick tokens'],
        ['base+extra', 'elastic seq'],
      ],
    ),
    highlight: { active: ['inputBank:source', 'learnBank:source', 'reader:purpose'], found: ['append:purpose'] },
    explanation: 'The tape bank can be input-driven, where extra candidate tokens are extracted from the input, or learnable, where trainable vectors act like a reusable scratchpad. Adaptive Tape Reading chooses how many to attach.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'input complexity', min: 0, max: 10 }, y: { label: 'tape tokens', min: 0, max: 12 } },
      series: [
        { id: 'selected', label: 'selected', points: [
          { x: 1, y: 1 }, { x: 3, y: 2 }, { x: 5, y: 4 }, { x: 7, y: 7 }, { x: 9, y: 10 },
        ] },
        { id: 'fixed', label: 'fixed budget', points: [
          { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 },
        ] },
      ],
      markers: [
        { id: 'hard', x: 8, y: 9, label: 'hard case' },
      ],
    }),
    highlight: { active: ['selected', 'hard'], compare: ['fixed'] },
    explanation: 'A fixed transformer gives every example the same sequence length after tokenization. AdaTape can append few tape tokens for simple cases and many for complex cases, making input length a compute knob.',
  };

  yield {
    state: labelMatrix(
      'Runtime data structures',
      [
        { id: 'bank', label: 'tape bank' },
        { id: 'query', label: 'query vec' },
        { id: 'ids', label: 'token ids' },
        { id: 'mask', label: 'seq mask' },
        { id: 'budget', label: 'budget' },
        { id: 'stats', label: 'stats' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['candidates', 'stale bank'],
        ['input state', 'weak query'],
        ['chosen toks', 'bad order'],
        ['base+extra', 'leakage'],
        ['max length', 'cost spike'],
        ['tokens used', 'drift'],
      ],
    ),
    highlight: { active: ['bank:stores', 'ids:stores', 'mask:stores'], found: ['budget:risk', 'stats:risk'] },
    explanation: 'The implementation is a dynamic sequence-construction problem. The model needs a bank, a reader query, selected token ids, a sequence mask, a budget cap, and telemetry showing how many tape tokens each route consumes.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'patches', label: 'patches', x: 0.8, y: 2.6, note: 'base' },
        { id: 'fine', label: 'fine bank', x: 0.8, y: 5.0, note: 'detail' },
        { id: 'reader', label: 'ATR', x: 3.0, y: 3.8, note: 'read' },
        { id: 't1', label: 'tape 1', x: 5.0, y: 2.4, note: 'chosen' },
        { id: 't2', label: 'tape 2', x: 5.0, y: 3.8, note: 'chosen' },
        { id: 't3', label: 'tape 3', x: 5.0, y: 5.2, note: 'chosen' },
        { id: 'seq', label: 'elastic', x: 7.5, y: 3.8, note: 'input' },
      ],
      edges: [
        { id: 'e-patches-reader', from: 'patches', to: 'reader', weight: 'summary' },
        { id: 'e-fine-reader', from: 'fine', to: 'reader', weight: 'keys' },
        { id: 'e-reader-t1', from: 'reader', to: 't1', weight: 'rank 1' },
        { id: 'e-reader-t2', from: 'reader', to: 't2', weight: 'rank 2' },
        { id: 'e-reader-t3', from: 'reader', to: 't3', weight: 'rank 3' },
        { id: 'e-patches-seq', from: 'patches', to: 'seq', weight: 'base' },
        { id: 'e-t1-seq', from: 't1', to: 'seq', weight: 'append' },
        { id: 'e-t2-seq', from: 't2', to: 'seq', weight: 'append' },
        { id: 'e-t3-seq', from: 't3', to: 'seq', weight: 'append' },
      ],
    }, { title: 'Input-driven tape bank adds another view of the data' }),
    highlight: { active: ['fine', 'reader', 't1', 't2', 't3'], found: ['seq'] },
    explanation: 'In an input-driven bank, the tape tokens can come from a finer-grained or alternate view of the same input. The reader decides which details deserve to enter the main transformer sequence.',
  };

  yield {
    state: labelMatrix(
      'AdaTape compared with depth adaptivity',
      [
        { id: 'act', label: 'ACT' },
        { id: 'mod', label: 'MoD' },
        { id: 'exit', label: 'early exit' },
        { id: 'adatape', label: 'AdaTape' },
      ],
      [
        { id: 'knob', label: 'knob' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['steps', 'loop depth'],
        ['token cap', 'block input'],
        ['exit layer', 'decode path'],
        ['tape count', 'input length'],
      ],
    ),
    highlight: { active: ['adatape:knob', 'adatape:shape'], compare: ['act:knob', 'mod:knob', 'exit:knob'] },
    explanation: 'AdaTape is adaptive compute by elastic input. ACT changes recurrent steps, MoD changes which tokens get a block, early exit changes how deep generation goes, and AdaTape changes how many auxiliary tokens the model receives.',
  };
}

function* elasticInput() {
  yield {
    state: labelMatrix(
      'Elastic sequence assembly',
      [
        { id: 'easy', label: 'easy image' },
        { id: 'medium', label: 'medium' },
        { id: 'hard', label: 'hard image' },
        { id: 'algo', label: 'parity' },
      ],
      [
        { id: 'base', label: 'base toks' },
        { id: 'tape', label: 'tape toks' },
        { id: 'why', label: 'reason' },
      ],
      [
        ['64', '1', 'simple'],
        ['64', '4', 'detail'],
        ['64', '10', 'hard parts'],
        ['32', '8', 'scratch'],
      ],
    ),
    highlight: { active: ['hard:tape', 'algo:tape'], compare: ['easy:tape'] },
    explanation: 'Elastic input means the base tokens remain, but examples receive different numbers of tape tokens. More tape tokens increase attention cost, so the selector must earn the extra context.',
  };

  yield {
    state: tapeGraph('Adaptive tape reading is a budgeted retrieval loop'),
    highlight: { active: ['summary', 'reader', 'bank', 'chosen'], found: ['append'] },
    explanation: 'You can read AdaTape as retrieval inside the model. The query summarizes the example, the bank provides candidate tokens, the reader selects a variable-length list, and the transformer consumes the augmented sequence.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'extra tape budget', min: 0, max: 12 }, y: { label: 'task score', min: 0, max: 100 } },
      series: [
        { id: 'adatape', label: 'AdaTape', points: [
          { x: 0, y: 63 }, { x: 2, y: 74 }, { x: 4, y: 82 }, { x: 8, y: 88 }, { x: 12, y: 89 },
        ] },
        { id: 'fixed', label: 'fixed', points: [
          { x: 0, y: 63 }, { x: 2, y: 69 }, { x: 4, y: 75 }, { x: 8, y: 80 }, { x: 12, y: 81 },
        ] },
      ],
      markers: [
        { id: 'knee', x: 8, y: 88, label: 'knee' },
      ],
    }),
    highlight: { active: ['adatape', 'knee'], compare: ['fixed'] },
    explanation: 'The useful goal is not appending as many tokens as possible. It is finding the quality-cost knee where the next tape token stops paying for itself.',
  };

  yield {
    state: labelMatrix(
      'Attention and masking concerns',
      [
        { id: 'base', label: 'base token' },
        { id: 'tape', label: 'tape token' },
        { id: 'pad', label: 'padding' },
        { id: 'pos', label: 'position' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'bug', label: 'bug if wrong' },
      ],
      [
        ['see tape', 'lost detail'],
        ['see base', 'free float'],
        ['masked out', 'false token'],
        ['stable id', 'order leak'],
      ],
    ),
    highlight: { active: ['tape:needs', 'pad:needs', 'pos:needs'], compare: ['base:bug'] },
    explanation: 'Elastic sequences need careful masks and position handling. Tape tokens should interact with the base sequence intentionally; padding tokens must stay invisible; selected-token order must be deterministic enough to train and serve.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'train', label: 'train', x: 0.7, y: 3.8, note: 'learn ATR' },
        { id: 'budget', label: 'budget', x: 2.4, y: 2.4, note: 'max toks' },
        { id: 'eval', label: 'eval', x: 2.4, y: 5.0, note: 'slices' },
        { id: 'serve', label: 'serve', x: 4.5, y: 3.8, note: 'route' },
        { id: 'watch', label: 'watch', x: 6.5, y: 3.8, note: 'tokens' },
        { id: 'cap', label: 'cap', x: 8.3, y: 3.8, note: 'fallback' },
      ],
      edges: [
        { id: 'e-train-budget', from: 'train', to: 'budget', weight: 'cost loss' },
        { id: 'e-train-eval', from: 'train', to: 'eval', weight: 'quality' },
        { id: 'e-budget-serve', from: 'budget', to: 'serve', weight: 'limits' },
        { id: 'e-eval-serve', from: 'eval', to: 'serve', weight: 'gates' },
        { id: 'e-serve-watch', from: 'serve', to: 'watch', weight: 'telemetry' },
        { id: 'e-watch-cap', from: 'watch', to: 'cap', weight: 'overuse' },
      ],
    }, { title: 'Deployment treats tape count as a route budget' }),
    highlight: { active: ['budget', 'serve', 'watch'], found: ['cap'] },
    explanation: 'In production, tape tokens are a budgeted resource. Monitor tape-token counts by route and slice, cap pathological inputs, and compare quality improvements against extra sequence-length cost.',
  };

  yield {
    state: labelMatrix(
      'Case-study lessons',
      [
        { id: 'vision', label: 'vision' },
        { id: 'parity', label: 'parity' },
        { id: 'graph', label: 'graph' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'next', label: 'read next' },
      ],
      [
        ['fine detail', 'Attention'],
        ['scratchpad', 'ACT'],
        ['learn bank', 'Transformers'],
        ['budget cap', 'MoD'],
      ],
    ),
    highlight: { active: ['vision:lesson', 'parity:lesson', 'serving:lesson'], compare: ['graph:next'] },
    explanation: 'The strongest lesson is structural: adaptive computation can mean adding the right interface tokens, not only running more layers. That opens a bridge to retrieval, memory tokens, and learned scratchpads.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tape bank') yield* tapeBank();
  else if (view === 'elastic input') yield* elasticInput();
  else throw new InputError('Pick an AdaTape view.');
}

export const article = {
  sections: [
    {
      heading: 'Why AdaTape exists',
      paragraphs: [
        'AdaTape is a way to give a neural network a variable compute budget without changing the depth of the main model. A standard transformer spends the same sequence budget on every example after tokenization or patching. A simple image, a cluttered image, and an algorithmic input with hidden structure all travel through the same number of blocks with the same input length. That is clean for batching, but it wastes compute on easy cases and under-serves hard cases.',
        'The ICML 2023 paper Adaptive Computation with Elastic Input Sequence proposes a different knob. Instead of asking an example to run for more layers, AdaTape appends a variable number of auxiliary tape tokens to the input. Easy examples can receive few extra tokens. Hard examples can receive more. The model still uses a shared transformer, but the sequence entering that transformer is elastic.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious approach to adaptive computation is dynamic depth. Adaptive Computation Time lets a recurrent model decide how many refinement steps to spend. Early-exit models let an example stop at a shallower layer when the answer is already clear. Mixture-of-Depths routes only some tokens through expensive blocks. These methods are reasonable because depth is where much of the work happens.',
        'The wall is control and hardware regularity. Dynamic depth changes the execution path, which can make batching, caching, and accelerator utilization harder. It also asks the model to decide when enough internal processing has happened. AdaTape keeps the main transformer path more regular and moves adaptivity to the input interface. The question becomes easier to state: how many extra working tokens should this example bring into the shared computation?',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that extra tokens can act as extra computational workspace. A transformer does not only process tokens as data. Tokens also become slots in the attention graph. Adding a token creates another representation that can attend to the input, collect detail, participate in later layers, and influence the output. If those tokens are selected carefully, input length becomes a compute allocation mechanism.',
        'This makes AdaTape closer to learned retrieval than to ordinary padding. A tape bank stores candidate tape tokens. A reader looks at the current input and chooses a variable-length subset. The chosen tokens are appended to the base sequence, and the transformer processes the augmented sequence. The invariant is that every example keeps its base tokens, while the selected tape tokens supply additional work only where the controller believes that work will help.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'The main data structures are ordinary but easy to get wrong. The system needs a tape bank, an input summary or query vector, selected tape-token ids, an elastic sequence buffer, an attention mask, position metadata, a maximum tape budget, and statistics for selected token counts. In a deployed system it also needs padding buckets, because variable sequence length can fragment batches and create tail-latency spikes.',
        'The bank can be trainable or input-derived. A trainable bank stores learned vectors that behave like reusable scratchpad slots. An input-derived bank extracts candidate tape tokens from another view of the same example, such as finer image patches or lower-level details. Adaptive Tape Reading scores or ranks candidate tape tokens, chooses a count and content, and materializes the final sequence. The important implementation detail is that selection changes both content and length. A fixed set of memory tokens would add constant cost. AdaTape makes the count part of the route.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'AdaTape works when difficulty is uneven across examples and the reader can detect useful extra context before the main computation. If every example needs the same amount of detail, a fixed sequence is simpler. If hard cases can be recognized from a summary, then the reader can give those cases more working slots. The extra slots increase attention opportunities and representation capacity where the input is dense, ambiguous, or algorithmically demanding.',
        'The correctness argument is not a proof in the classic algorithm sense. It is an inductive-bias argument. The transformer is still trained end to end, so selected tape tokens must learn to carry useful information. The architecture makes one behavior available: conditional workspace. Training rewards the reader when selected tokens improve the task enough to offset any cost penalty. The design is trustworthy only if evaluation shows that token use rises on genuinely harder slices and that quality improves more than a fixed-budget baseline at comparable cost.',
      ],
    },
    {
      heading: 'Cost behavior',
      paragraphs: [
        'Tape tokens are not free. In a full attention transformer, adding tokens increases the attention table. If the base sequence has n tokens and AdaTape appends k tape tokens, the attention work grows with the augmented length, not with k alone. A small k can be cheap. A large k on long inputs can dominate latency and memory. The cost curve is especially visible at p95 and p99 because the hardest examples tend to request the most extra tokens.',
        'Batching adds a second tax. Accelerators like rectangular work. If every request has a different augmented length, the serving system either pads to the largest example in a batch or creates many small buckets. Padding wastes compute; too many buckets reduce batch size. A practical AdaTape route needs a maximum tape cap, length buckets, and admission rules that keep the worst case bounded.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'AdaTape is useful when examples have uneven complexity and the extra information can be represented as tokens. Vision is a natural fit because some images need fine local evidence while others are globally obvious. Algorithmic tasks are another fit because extra scratchpad-like tokens can help preserve intermediate state. Any setting with cheap summaries and expensive details can use the same pattern: summarize first, then pull detail only when needed.',
        'It is also a useful mental bridge to retrieval, memory tokens, and latent arrays. Retrieval-augmented generation retrieves external chunks. Perceiver-style models use a fixed latent bottleneck. AdaTape retrieves or selects internal auxiliary tokens with a variable count. The shared lesson is that a model interface is a data structure. The interface decides which information becomes part of the working set and which cost the model pays to use it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'AdaTape is a poor fit when dynamic length is more expensive than the accuracy gain. It can lose to a fixed larger model if nearly all examples request many tape tokens. It can lose to a smaller fixed model if the reader is noisy and spends tokens on easy examples. It can also fail when the bank content is weak. A learned bank may become a bag of vague vectors. An input-derived bank may copy low-value details. In both cases, the augmented sequence grows without adding useful evidence.',
        'Masking and position handling are common failure points. Tape tokens must attend to the right base tokens. Padding must remain invisible. Selected-token order must be stable enough for training and serving. A production system must also handle distribution shift. If the route that once needed two tape tokens now needs eight because inputs changed, the system should show that drift before latency and cost surprise operators.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Good evaluation separates quality from cost. Track task score by tape-token count, score by difficulty slice, average and tail selected-token count, augmented sequence length, batch padding waste, attention memory, time to first output, p50 latency, p99 latency, and fallback frequency. A healthy route shows a quality-cost knee: adding tokens helps up to a point, then stops paying. If the curve is flat, the tape is decorative. If cost rises faster than quality, the controller is too generous.',
        'A good ablation suite compares no tape, fixed tape count, random selected tape, learned bank, input-derived bank, and AdaTape selection under matched compute. The key claim is not that extra tokens help. Extra tokens usually help if enough compute is added. The claim is that adaptive extra tokens spend the budget better than a fixed policy.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources are the PMLR paper page at https://proceedings.mlr.press/v202/xue23e.html, the arXiv version at https://arxiv.org/abs/2301.13195, the Google Research overview at https://research.google/blog/adatape-foundation-model-with-adaptive-computation-and-dynamic-read-and-write/, and the Scenic AdaTape code path at https://github.com/google-research/scenic/tree/main/scenic/projects/adatape.',
        'Study Adaptive Computation Time to understand halting over recurrent steps. Study Mixture-of-Depths and early-exit transformers for depth-side adaptivity. Study Attention, Transformer blocks, Perceiver IO, retrieval-augmented generation, tokenization, KV cache behavior, and LLM inference cost models to see the broader pattern: adaptive systems work only when the controller improves the quality-cost tradeoff under real serving constraints.',
      ],
    },
  ],
};
