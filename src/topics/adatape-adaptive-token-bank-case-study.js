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
      heading: 'How to read the animation',
      paragraphs: [
        'The tape-bank view shows AdaTape as an input-length controller. AdaTape means adaptive computation with an elastic input sequence: the model appends a variable number of auxiliary tape tokens before a shared transformer processes the sequence. Active slots show which tape tokens are selected for the current example.',
        'The elastic-input view shows cost. Adding k tape tokens to n base tokens changes attention over n + k tokens, not only over k. The safe inference is that extra tokens are useful only when their quality gain pays for longer attention and harder batching.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'AdaTape’s key insight: instead of making the model deeper for hard inputs, make the input longer. Append a variable number of auxiliary tape tokens to the sequence. Easy examples get few extra tokens; hard examples get more. The transformer stays fixed-depth, but the input is elastic — giving adaptive compute without dynamic depth or early exit.'},
        'A standard transformer spends roughly the same depth on every example after tokenization. Easy examples, cluttered examples, and algorithmic examples all move through the same block count. That regularity is good for batching but wasteful when difficulty varies.',
        'AdaTape exists to give hard examples extra workspace without changing the main model depth. A reader module looks at the input, selects a variable number of tape tokens, and appends them to the base sequence. The transformer stays shared and fixed-depth, while the input length becomes adaptive.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious adaptive-compute approach is dynamic depth. A model can run more layers for hard examples, stop early for easy examples, or route only some tokens through expensive blocks. This is reasonable because much of a transformer cost sits inside repeated layers.',
        'Another obvious method is to use a fixed set of memory tokens for every example. That adds workspace while keeping execution regular. It does not adapt cost, because every example pays for the same extra tokens whether they help or not.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dynamic depth complicates batching, caching, scheduling, and accelerator utilization. Examples in the same batch may want different layer counts, which creates idle work or fragmented execution. It also asks the model to decide when enough internal computation has happened.',
        'Fixed memory tokens hit the opposite wall. They improve capacity for some inputs but add constant cost to all inputs. If only 20 percent of examples need extra workspace, the remaining 80 percent still pay the attention and memory bill.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Extra tokens can act as conditional workspace. In a transformer, a token is not only data; it is a slot in the attention graph that can gather evidence and influence later representations. Adding tokens gives the model more places to store and combine information.',
        'AdaTape moves adaptivity to the input interface. The base sequence remains present for every example, while a reader selects zero or more tape tokens from a bank or input-derived pool. The invariant is that selected tape tokens must add useful evidence more often than they add wasted attention.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system builds an input summary or query vector, scores candidate tape tokens, chooses a count, and appends the selected tokens to the base sequence. It also creates an attention mask and position metadata so padding stays invisible and selected tokens attend legally. A maximum tape budget keeps the worst case bounded.',
        'The tape bank can be learned vectors, input-derived detail tokens, or a mix. A learned bank behaves like reusable scratchpad slots. An input-derived bank can pull finer image patches or local details only when the summary says they matter.',
        'Training rewards the reader when the selected tokens improve task performance enough to justify their cost. Serving usually adds length buckets so requests with similar augmented lengths batch together. Without buckets, one hard example can force every request in a batch to pad to its long sequence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works when difficulty is uneven and detectable before the main transformer computation. If a summary can identify hard examples, the reader can allocate more token slots to them. Those slots increase attention opportunities and representation capacity where the input is dense or ambiguous.',
        'The correctness argument is not a classic proof; it is an inductive-bias and evaluation argument. The architecture permits conditional workspace, and training must learn to use it. The claim is trustworthy only if token count rises on genuinely harder slices and if adaptive selection beats a fixed-token baseline at matched compute.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full attention cost grows with the square of augmented length. If n = 512 base tokens and k = 64 tape tokens, attention cells grow from 512 * 512 = 262,144 to 576 * 576 = 331,776, about 27 percent more. If k = 256, the table grows to 768 * 768 = 589,824, more than double the base cost.',
        'Batching adds tail cost. If one request in a batch uses 256 tape tokens and the others use 16, padding can make all of them pay for the longest case. Production use needs a cap, buckets, telemetry on selected-token counts, and a policy for rejecting or rerouting pathological examples.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AdaTape is useful when examples have uneven complexity and extra evidence can be represented as tokens. Vision is a natural fit because some images need fine local detail while others are globally obvious. Algorithmic tasks can also benefit when extra slots act like scratchpad state.',
        'It is also a bridge to retrieval and latent-array models. Retrieval-augmented generation pulls external chunks, Perceiver-style models use latent bottlenecks, and AdaTape selects internal auxiliary tokens with variable count. The common lesson is that the model interface decides the working set and therefore the cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'AdaTape fails when nearly all examples ask for many tape tokens. In that case a fixed larger model or fixed longer sequence may be simpler and faster. It also fails when the reader is noisy and spends tokens on easy examples.',
        'The bank can fail too. A learned bank may become vague vectors that add little information, while an input-derived bank may copy low-value detail. Masking, position handling, selected-token order, and padding bugs can make training and serving disagree.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A vision classifier uses 196 base patch tokens from a 224 by 224 image. The tape cap is 64 tokens, and the reader can choose 0, 16, 32, or 64. Easy product images average 8 selected tokens, cluttered shelf images average 48, and occluded images hit the cap.',
        'Base attention has 196 * 196 = 38,416 cells. With 32 tape tokens, the table becomes 228 * 228 = 51,984 cells, about 35 percent more. If the hard-slice accuracy rises from 82 percent to 88 percent while average latency rises from 11 ms to 13 ms, the trade may be acceptable.',
        'A fixed 64-token policy would make every example use 260 * 260 = 67,600 attention cells. AdaTape avoids that cost on easy inputs, but only if the reader selects low counts there. The evaluation must compare adaptive tokens against fixed 16, fixed 32, and fixed 64 under matched latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the ICML 2023 AdaTape paper, the arXiv version, the Google Research overview, and the Scenic project implementation. Read the method with attention to selected-token count, quality-cost curves, and fixed-budget baselines.',
        'Study next: Adaptive Computation Time for halting decisions, Mixture-of-Depths and early-exit transformers for depth-side adaptivity, Attention and Transformer Blocks for the cost model, Perceiver IO for latent arrays, retrieval-augmented generation for external context, and KV cache behavior for serving consequences.',
      ],
    },
  ],
};
