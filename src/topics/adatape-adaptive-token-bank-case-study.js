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
      heading: 'What it is',
      paragraphs: [
        'AdaTape is adaptive computation through elastic input sequences. Instead of changing how many layers an example uses, it changes how many auxiliary tape tokens are appended to the input. Hard examples can receive more tape tokens; easy examples can receive few.',
        'The paper calls this adaptive computation with a dynamic read-and-write tape. The tape bank supplies candidate tokens, Adaptive Tape Reading selects a variable-length subset, and the transformer processes the base tokens plus selected tape tokens together.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The main data structures are a tape bank, an input summary or query vector, selected tape-token ids, an elastic sequence buffer, a sequence mask, position metadata, a maximum tape budget, and telemetry for selected token counts. A production implementation also needs padding buckets so dynamic sequence length does not destroy batching.',
        'There are two bank styles. An input-driven bank extracts candidate tape tokens from the input using a different view or granularity. A learnable bank stores trainable vectors that behave like reusable scratchpad tokens. Both let the model retrieve extra computational workspace only when the example calls for it.',
      ],
    },
    {
      heading: 'Case study: AdaTape',
      paragraphs: [
        'The ICML 2023 paper "Adaptive Computation with Elastic Input Sequence" introduces AdaTape as dynamic computation through adaptive tape tokens. The PMLR abstract says AdaTape uses an elastic input sequence with a dynamic read-and-write tape, obtains tape tokens from a trainable or input-derived bank, and proposes Adaptive Tape Reading to obtain dynamic sequence content and length.',
        'Google Research frames the contribution as a different kind of adaptivity from dynamic depth: AdaTape injects adaptivity into the input sequence. Their post describes a transformer architecture that selects a variable number of tape tokens based on input complexity and reports favorable quality-cost tradeoffs on image and algorithmic tasks.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'AdaTape is a useful bridge between adaptive computation and memory. ACT changes how many recurrent steps an item receives. Mixture-of-Depths changes which tokens receive a block. Early exit changes when a generated token can stop. Perceiver IO uses a fixed latent array as internal working memory. AdaTape changes the interface another way: it provides extra tokens that can carry detail, scratchpad state, or alternative input views.',
        'That makes the data-structure analogy concrete. The tape bank is a memory table. The reader is a learned retrieval policy. The selected ids are a compact route. The elastic sequence is the materialized working set the transformer actually sees.',
      ],
    },
    {
      heading: 'Production pitfalls',
      paragraphs: [
        'Dynamic sequence length can be expensive. Extra tape tokens increase attention cost, can fragment batches, and can create p99 spikes if hard examples receive many extras. Pad and bucket carefully. Track tape tokens per route. Make the cost knob explicit.',
        'Masking and ordering are also easy to get wrong. Tape tokens must see the right base tokens, padding must be invisible, and selected-token order must be stable enough to train and serve. A tape bank can also go stale if the input distribution changes or if learned tokens specialize too narrowly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PMLR page for Adaptive Computation with Elastic Input Sequence at https://proceedings.mlr.press/v202/xue23e.html, arXiv version at https://arxiv.org/abs/2301.13195, Google Research AdaTape overview at https://research.google/blog/adatape-foundation-model-with-adaptive-computation-and-dynamic-read-and-write/, and the released Scenic project path at https://github.com/google-research/scenic/tree/main/scenic/projects/adatape.',
        'Study Adaptive Computation Time Halting, Mixture-of-Depths Token Routing, Early-Exit Transformer Layer Skipping, Perceiver IO Latent Array Bottleneck, Attention Mechanism, Transformer Block, Tokenization BPE, Gradient Flow, KV Cache, RAG Pipeline, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
