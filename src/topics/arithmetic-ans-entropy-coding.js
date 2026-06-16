// Arithmetic coding and ANS: entropy coders that spend fractional bits by
// keeping a coding state instead of assigning one whole-bit code per symbol.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'arithmetic-ans-entropy-coding',
  title: 'Arithmetic & ANS Coding',
  category: 'Concepts',
  summary: 'Go past whole-bit Huffman codes: arithmetic coding narrows an interval, while ANS moves through integer states near the entropy limit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['interval coder', 'ANS state machine'], defaultValue: 'interval coder' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function coderGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'model', label: 'model', x: 0.8, y: 3.8, note: notes.model ?? 'P(A)=.75' },
      { id: 'symbol', label: 'symbol', x: 2.6, y: 3.8, note: notes.symbol ?? 'next char' },
      { id: 'state', label: 'state', x: 4.6, y: 3.8, note: notes.state ?? 'range/int' },
      { id: 'bits', label: 'bits', x: 6.6, y: 3.8, note: notes.bits ?? 'renorm' },
      { id: 'decode', label: 'decode', x: 8.5, y: 3.8, note: notes.decode ?? 'same model' },
    ],
    edges: [
      { id: 'e-model-symbol', from: 'model', to: 'symbol', weight: '' },
      { id: 'e-symbol-state', from: 'symbol', to: 'state', weight: '' },
      { id: 'e-state-bits', from: 'state', to: 'bits', weight: '' },
      { id: 'e-bits-decode', from: 'bits', to: 'decode', weight: '' },
    ],
  }, { title });
}

function* intervalCoder() {
  yield {
    state: coderGraph('Arithmetic coding separates model from bit writer'),
    highlight: { active: ['model', 'symbol', 'state'], found: ['bits', 'decode'] },
    explanation: 'Huffman assigns each symbol a whole number of bits. Arithmetic coding encodes the whole message as a number inside a final probability interval, so common symbols can average fractional bits.',
    invariant: 'The decoder must use the same probability model and the same interval splits.',
  };

  yield {
    state: labelMatrix(
      'Encode BAA with P(A)=0.75 and P(B)=0.25',
      [
        { id: 's0', label: 'start' },
        { id: 's1', label: 'B' },
        { id: 's2', label: 'BA' },
        { id: 's3', label: 'BAA' },
      ],
      [
        { id: 'low', label: 'low' },
        { id: 'high', label: 'high' },
        { id: 'width', label: 'width' },
        { id: 'bits', label: 'bits' },
      ],
      [
        ['0.000', '1.000', '1.000', '0.00'],
        ['0.750', '1.000', '0.250', '2.00'],
        ['0.750', '0.938', '0.188', '2.42'],
        ['0.750', '0.891', '0.141', '2.83'],
      ],
    ),
    highlight: { active: ['s1:low', 's2:high', 's3:width'], found: ['s3:bits'] },
    explanation: 'Each symbol narrows the current interval. B selects the upper quarter. A then selects the lower 75 percent of that subrange, twice. Any binary fraction inside the final interval identifies the whole message.',
  };

  yield {
    state: labelMatrix(
      'Why this can beat whole-bit codes',
      [
        { id: 'huff', label: 'Huffman' },
        { id: 'arith', label: 'arith' },
        { id: 'model', label: 'model' },
        { id: 'stream', label: 'stream' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['symbol code', 'whole bits'],
        ['message num', 'frac bits'],
        ['prob table', 'separate'],
        ['renormalize', 'emit bits'],
      ],
    ),
    highlight: { active: ['arith:unit', 'arith:effect'], compare: ['huff:effect'], found: ['model:effect'] },
    explanation: 'Arithmetic coding keeps the model separate from the channel code. Improve the probability model and the same interval coder spends fewer bits without inventing a new prefix tree.',
  };

  yield {
    state: coderGraph('Range coders implement the same idea with integers', { state: 'low+range', bits: 'shift out', decode: 'invert' }),
    highlight: { active: ['state', 'bits', 'decode'], compare: ['model'] },
    explanation: 'Production arithmetic and range coders avoid infinite real numbers. They keep integer low/range state, emit stable leading bits, and refill state during decode.',
  };
}

function* ansStateMachine() {
  yield {
    state: coderGraph('ANS replaces the interval with one integer state', { model: 'freq table', symbol: 'encode', state: 'x integer', bits: 'low bits', decode: 'pop sym' }),
    highlight: { active: ['model', 'state'], found: ['bits', 'decode'] },
    explanation: 'Asymmetric Numeral Systems keeps a single integer state. Encoding a symbol moves the state to a new integer; renormalization emits low bits when the state gets too large. Decoding reverses those moves.',
    invariant: 'The state carries both payload and enough alignment to recover symbols in reverse order.',
  };

  yield {
    state: labelMatrix(
      'Toy rANS-style transition view',
      [
        { id: 'x12', label: 'x=12' },
        { id: 'x13', label: 'x=13' },
        { id: 'x14', label: 'x=14' },
        { id: 'x15', label: 'x=15' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'next', label: 'next x' },
        { id: 'emit', label: 'emit' },
      ],
      [
        ['A', 'x=16', ''],
        ['A', 'x=17', ''],
        ['B', 'x=21', '1'],
        ['A', 'x=18', ''],
      ],
    ),
    highlight: { active: ['x14:sym', 'x14:next', 'x14:emit'], found: ['x12:sym', 'x13:sym'] },
    explanation: 'The exact transition table depends on the frequency table, but the shape is the lesson: common symbols occupy more states; rare symbols push the state further and tend to emit more bits.',
  };

  yield {
    state: labelMatrix(
      'Coder comparison',
      [
        { id: 'huff', label: 'Huffman' },
        { id: 'arith', label: 'arith' },
        { id: 'ans', label: 'ANS' },
        { id: 'model', label: 'model' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'trade', label: 'trade' },
      ],
      [
        ['prefix tree', 'fast simple'],
        ['range', 'near entropy'],
        ['int state', 'fast tables'],
        ['freqs', 'quality wins'],
      ],
    ),
    highlight: { active: ['ans:shape', 'arith:trade'], compare: ['huff:trade'], found: ['model:trade'] },
    explanation: 'Modern compressors often choose between these families. Huffman is simple and fast, arithmetic/range coding is close to entropy, and ANS aims for arithmetic-like rate with table-friendly speed.',
  };

  yield {
    state: coderGraph('Entropy coders sit after a model or transform', { model: 'tokens/freqs', symbol: 'events', state: 'coder', bits: 'compressed', decode: 'events' }),
    highlight: { active: ['model', 'symbol', 'state'], found: ['bits'] },
    explanation: 'The coder is only half the compressor. LZ77, BPE, image transforms, or context models create the events and probabilities; the entropy coder turns those events into bits.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interval coder') yield* intervalCoder();
  else if (view === 'ANS state machine') yield* ansStateMachine();
  else throw new InputError('Pick an entropy-coding view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Arithmetic coding and Asymmetric Numeral Systems are entropy-coding families that avoid Huffman Coding\'s whole-bit codeword limitation. Instead of giving every symbol an integer-length prefix code, they keep a coding state whose evolution represents the whole message. That lets the average bit cost approach the entropy of the probability model more tightly.',
        'Arithmetic coding narrows an interval. ANS moves through integer states. Both depend on the same separation: the model estimates symbol probabilities, and the coder converts those modeled events into bits. Entropy & Information explains the target; these coders are the machinery that tries to reach it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In arithmetic coding, the current range is split according to symbol probabilities. To encode a symbol, keep only that symbol\'s subrange. After all symbols are processed, any binary fraction inside the final interval identifies the message. Integer range coders implement the same idea with low/range state and renormalization, emitting bits when the leading part of the range becomes fixed.',
        'ANS uses one integer state. Encoding maps the current state and a symbol into a new state, emitting low bits when needed to keep the state bounded. Decoding pops a symbol from the state and reconstructs the previous state. Table-based variants such as tANS/FSE make the state machine explicit; rANS uses arithmetic formulas over frequency tables.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is dominated by model lookup, state update, and renormalization. Huffman decoders can be extremely simple table lookups, while arithmetic/range and ANS coders need more careful integer arithmetic or state tables. The payoff is rate: skewed distributions and adaptive models can use fractional average bits per symbol instead of rounding every code length to a whole bit.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Modern compressors compose a model with an entropy coder. DEFLATE uses Huffman codes after LZ77. Zstandard uses LZ-style matching plus Finite State Entropy, an ANS-family coder, for literals and sequences. Image and video codecs often combine transforms, prediction, quantization, and arithmetic/range-style entropy coding. The recurring design is the same: expose predictable events, then code them close to their probability cost.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Entropy coders do not discover structure by themselves. If the model says every byte is equally likely, no coder can compress random data. Another trap is comparing coders only by compression ratio. Decoder speed, table size, streaming direction, patents/history, random access, and implementation complexity can dominate the engineering choice. Finally, arithmetic and ANS decoders are exact only when encoder and decoder share the same model and normalization rules.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Witten, Neal, and Cleary, "Arithmetic Coding for Data Compression", at https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf, Duda, "Asymmetric numeral systems", at https://arxiv.org/abs/0902.0271, and Duda, "Asymmetric numeral systems: entropy coding combining speed of Huffman coding with compression rate of arithmetic coding", at https://arxiv.org/abs/1311.2540. Study Entropy & Information, Huffman Coding, LZ77 Compression, DEFLATE Case Study, Tokenization (BPE), and Finite State Machine next.',
      ],
    },
  ],
};
