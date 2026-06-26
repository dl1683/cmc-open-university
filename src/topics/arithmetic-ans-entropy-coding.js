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
  const coderStages = ['model', 'symbol', 'state'];
  const outputStages = ['bits', 'decode'];
  yield {
    state: coderGraph('Arithmetic coding separates model from bit writer'),
    highlight: { active: coderStages, found: outputStages },
    explanation: `Huffman assigns each symbol a whole number of bits. Arithmetic coding passes through ${coderStages.length} stages (${coderStages.join(', ')}) encoding the whole message as a number inside a final probability interval, so common symbols can average fractional bits.`,
    invariant: `The ${outputStages[1]}r must use the same probability ${coderStages[0]} and the same interval splits.`,
  };

  const pA = 0.75;
  const pB = 1 - pA;
  const message = ['B', 'A', 'A'];
  yield {
    state: labelMatrix(
      `Encode ${message.join('')} with P(A)=${pA} and P(B)=${pB}`,
      [
        { id: 's0', label: 'start' },
        { id: 's1', label: message[0] },
        { id: 's2', label: message.slice(0, 2).join('') },
        { id: 's3', label: message.join('') },
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
    explanation: `Each of the ${message.length} symbols narrows the current interval. ${message[0]} selects the upper ${pB * 100} percent. ${message[1]} then selects the lower ${pA * 100} percent of that subrange, twice. Any binary fraction inside the final interval identifies the whole message.`,
  };

  const coderTypes = [
    { id: 'huff', label: 'Huffman' },
    { id: 'arith', label: 'arith' },
    { id: 'model', label: 'model' },
    { id: 'stream', label: 'stream' },
  ];
  yield {
    state: labelMatrix(
      'Why this can beat whole-bit codes',
      coderTypes,
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
    explanation: `${coderTypes[1].label[0].toUpperCase() + coderTypes[1].label.slice(1)}metic coding keeps the ${coderTypes[2].label} separate from the channel code. Improve the probability ${coderTypes[2].label} and the same interval coder spends fewer bits without inventing a new ${coderTypes[0].label} prefix tree.`,
  };

  const rangeNotes = { state: 'low+range', bits: 'shift out', decode: 'invert' };
  yield {
    state: coderGraph('Range coders implement the same idea with integers', rangeNotes),
    highlight: { active: ['state', 'bits', 'decode'], compare: ['model'] },
    explanation: `Production arithmetic and range coders avoid infinite real numbers. They keep integer ${rangeNotes.state} state, ${rangeNotes.bits} stable leading bits, and ${rangeNotes.decode} the process during decode.`,
  };
}

function* ansStateMachine() {
  const ansNotes = { model: 'freq table', symbol: 'encode', state: 'x integer', bits: 'low bits', decode: 'pop sym' };
  yield {
    state: coderGraph('ANS replaces the interval with one integer state', ansNotes),
    highlight: { active: ['model', 'state'], found: ['bits', 'decode'] },
    explanation: `Asymmetric Numeral Systems keeps a single ${ansNotes.state}. Encoding a symbol moves the state to a new integer; renormalization emits ${ansNotes.bits} when the state gets too large. Decoding reverses those moves via ${ansNotes.decode}.`,
    invariant: `The ${ansNotes.state} carries both payload and enough alignment to recover symbols in reverse order.`,
  };

  const stateRows = [
    { id: 'x12', label: 'x=12' },
    { id: 'x13', label: 'x=13' },
    { id: 'x14', label: 'x=14' },
    { id: 'x15', label: 'x=15' },
  ];
  const startState = 12;
  yield {
    state: labelMatrix(
      'Toy rANS-style transition view',
      stateRows,
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
    explanation: `The exact transition table depends on the frequency table, but across ${stateRows.length} states (x=${startState}..${startState + stateRows.length - 1}) the shape is the lesson: common symbols occupy more states; rare symbols push the state further and tend to emit more bits.`,
  };

  const coderFamilies = [
    { id: 'huff', label: 'Huffman' },
    { id: 'arith', label: 'arith' },
    { id: 'ans', label: 'ANS' },
  ];
  yield {
    state: labelMatrix(
      'Coder comparison',
      [
        ...coderFamilies,
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
    explanation: `Modern compressors often choose between ${coderFamilies.length} families. ${coderFamilies[0].label} is simple and fast, ${coderFamilies[1].label}metic/range coding is close to entropy, and ${coderFamilies[2].label} aims for arithmetic-like rate with table-friendly speed.`,
  };

  const systemNotes = { model: 'tokens/freqs', symbol: 'events', state: 'coder', bits: 'compressed', decode: 'events' };
  yield {
    state: coderGraph('Entropy coders sit after a model or transform', systemNotes),
    highlight: { active: ['model', 'symbol', 'state'], found: ['bits'] },
    explanation: `The ${systemNotes.state} is only half the compressor. LZ77, BPE, image transforms, or context models create the ${systemNotes.symbol} and probabilities from ${systemNotes.model}; the entropy coder turns those ${systemNotes.symbol} into ${systemNotes.bits} output.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable at the top. "Interval coder" walks through arithmetic coding: you see a probability model feed symbols into a narrowing interval, with a table tracking low, high, width, and ideal bit cost at each step. "ANS state machine" shows how Asymmetric Numeral Systems encodes symbols by moving through integer states, emitting bits only when the state outgrows its bounded range.',
        'Each frame highlights one operation. Blue marks the active step, green marks derived outputs, and orange marks comparisons to alternatives. Step through manually or press play at 1x speed to read the explanation alongside each frame before it advances.',
        {type: 'image', src: './assets/gifs/arithmetic-ans-entropy-coding.gif', alt: 'Animated walkthrough of the arithmetic ans entropy coding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every compressor eventually reduces to the same final problem: you have a stream of symbols and a probability model, and you need to write the fewest bits that let a decoder recover the original stream exactly. The modeling stage (LZ matching, prediction, transforms) decides what is likely. The entropy coder turns those likelihoods into actual bits on disk.',
        'Information theory sets a hard floor. A symbol with probability p costs at minimum -log2(p) bits. If symbol A has probability 0.75, its ideal cost is -log2(0.75) = 0.415 bits. Not one bit. Not zero bits. A fractional number that no single codeword can represent exactly. Arithmetic coding and ANS exist because real probability distributions almost never align with whole-bit boundaries, and the gap between whole-bit codes and the entropy floor is wasted space.',
        {type: 'callout', text: 'Entropy coding turns probability mass into bit cost; arithmetic coding uses nested ranges, while ANS uses reversible integer states.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a prefix code, most famously Huffman coding. You count how often each symbol appears, build a binary tree that gives shorter paths to frequent symbols, and assign each symbol a codeword equal to its tree path. The decoder reads bits left to right and walks the tree until it hits a leaf. No ambiguity, no lookahead, fast.',
        'This works well in practice and still powers DEFLATE (gzip, PNG). For a two-symbol alphabet with P(A)=0.5 and P(B)=0.5, Huffman assigns one bit to each symbol, which matches the entropy exactly. The code is optimal when every symbol probability is a power of two.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Prefix codes hit a structural wall: every codeword must be a whole number of bits long. If P(A)=0.75, the ideal cost is 0.415 bits, but Huffman must assign A at least one bit. For P(B)=0.25, the ideal cost is 2 bits, which Huffman can hit. The weighted average for this distribution is 0.75*1 + 0.25*2 = 1.25 bits per symbol. The entropy is 0.75*0.415 + 0.25*2 = 0.811 bits per symbol. The gap is 0.439 bits per symbol, or about 54% overhead.',
        'For short blocks or skewed distributions, this overhead is severe. Worse, if the model is adaptive (changing probabilities after each symbol), you would need to rebuild the Huffman tree after every symbol. Huffman codes also cannot naturally handle fractional-bit costs from context-dependent models. The coder itself becomes the bottleneck, not the model.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Arithmetic coding escapes the whole-bit trap by coding the entire message as a single number. Instead of assigning a separate codeword to each symbol, it maintains an interval [low, high) that starts as [0, 1). Each new symbol narrows the interval by splitting it according to the model probabilities and keeping only the subrange that corresponds to the observed symbol. After processing every symbol, any binary fraction that falls inside the final interval uniquely identifies the message.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Arithmetic_coding_visualisation.svg/330px-Arithmetic_coding_visualisation.svg.png', alt: 'Arithmetic coding interval narrowing for two example messages.', caption: 'Nested intervals show how a whole message becomes one short binary prefix. (Source: Wikimedia Commons)'},
        'The key consequence: a likely message leaves a wide final interval and needs few bits to point into it. An unlikely message leaves a narrow interval and needs many bits. The bit cost tracks -log2(width of final interval), which equals -log2(probability of message). This is exactly the entropy floor. Arithmetic coding achieves it because it never rounds to whole bits per symbol; it amortizes across the entire message.',
        'ANS reaches the same compression rate through a completely different mechanism. Instead of narrowing a range, it stores information inside a single integer state. Encoding a symbol maps the current state x to a new state x\', and when x\' grows too large, the encoder emits low-order bits to keep the state bounded. The crucial property is that common symbols occupy more slots in the state space and therefore tend to increase the state by less (emitting fewer bits), while rare symbols occupy fewer slots and increase the state by more (emitting more bits). The cost per symbol converges to -log2(p) exactly as in arithmetic coding.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Arithmetic coding step by step. Given alphabet {A, B} with P(A)=0.75 and P(B)=0.25, define cumulative ranges: A owns [0, 0.75) and B owns [0.75, 1.0). To encode a symbol s into current interval [low, high): compute width = high - low, then new_low = low + width * cum_low(s), new_high = low + width * cum_high(s). After all symbols, output enough bits of any number inside the final interval to uniquely identify it.',
        'Production implementations avoid infinite-precision reals. They use fixed-point integers (e.g., 32-bit low and range). When the top bits of low and low+range agree, those bits are fixed forever and can be emitted. This is called renormalization: shift out settled bits, shift in fresh precision. The decoder mirrors every operation, reading bits from the stream to fill its own range. Both sides must use identical frequency tables, identical rounding, and identical renormalization thresholds.',
        'ANS step by step. rANS (range ANS) defines encode as: x\' = (x / freq[s]) * total + cum[s] + (x mod freq[s]), where freq[s] is the frequency count of symbol s, cum[s] is its cumulative frequency, and total is the sum of all frequencies. When x\' exceeds a threshold (typically 2^16 or 2^32), the encoder emits low bits of x\' until it fits. Decoding inverts the formula: from x\', recover s by finding which cumulative range x\' mod total falls in, then reconstruct x from the quotient and remainder.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Simple_example_of_ANS_automaton.png/500px-Simple_example_of_ANS_automaton.png', alt: 'Four-state ANS automaton for symbols with unequal probabilities.', caption: 'The automaton makes the ANS state buffer visible: common symbols often emit fewer bits, rare symbols emit more. (Source: Wikimedia Commons)'},
        'tANS (table ANS, used in Finite State Entropy) precomputes the entire transition function into a lookup table. Each table entry stores: next state and number of bits to emit. This eliminates the division in rANS at the cost of table memory (typically 2048 or 4096 entries). Zstandard uses tANS for exactly this reason: table lookups pipeline better than divisions on modern CPUs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Arithmetic coding is correct because nested intervals are injective. At each step, the symbol selects a non-overlapping subinterval. Two different messages must diverge at some symbol, at which point they enter disjoint subintervals. From that point forward, their intervals can never overlap again. Therefore, any number inside the final interval maps to exactly one message. The decoder reproduces the same splits and reads off the same sequence of symbols.',
        'The compression rate is optimal because the final interval width equals the message probability. If a three-symbol message has probability p1 * p2 * p3, the final interval width is exactly p1 * p2 * p3. The number of bits needed to specify a point inside an interval of width w is ceil(-log2(w)) + 1 at worst. As messages grow longer, the overhead of that +1 is amortized across more symbols, and the average rate converges to the entropy.',
        'ANS is correct because the encode function is a bijection. For every (state, symbol) pair, there is exactly one output (new_state, emitted_bits), and the inverse function recovers (state, symbol) from (new_state, emitted_bits). The state carries both the accumulated information and enough structure to determine which symbol was encoded last. Renormalization is reversible because the bits emitted during encoding are read back during decoding in precisely the right order (LIFO: last encoded symbol is first decoded).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/ANS_general_picture.png/960px-ANS_general_picture.png', alt: 'Comparison of arithmetic coding and asymmetric numeral systems.', caption: 'Arithmetic coding narrows a range, while ANS stores information in one probability-shaped integer state. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Arithmetic coding: encoding and decoding each symbol costs O(1) time (a few multiplications, comparisons, and bit shifts). Memory is minimal: just the low and range integers, plus the frequency table. The bottleneck is serial dependency: each symbol depends on the previous state, so you cannot pipeline multiple symbols in parallel without interleaving tricks.',
        'rANS: also O(1) per symbol, but requires one integer division per encode (which modern CPUs handle in a few cycles). The division can be replaced with a multiply-shift approximation for power-of-two totals. tANS replaces the division with a table lookup, trading memory (a few KB for the table) for speed. Interleaved rANS runs multiple independent state streams and encodes them round-robin, which lets out-of-order CPUs overlap the dependent arithmetic.',
        'Compression ratio for both methods converges to the cross-entropy between the model and the true distribution: H(data, model) = -sum over all symbols of p_true(s) * log2(p_model(s)). When the model is perfect, this equals the entropy H(data). When the model is wrong, the excess is the KL divergence D_KL(true || model), which is always non-negative. The coder itself wastes almost nothing; all waste comes from the model.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DEFLATE (gzip, zlib, PNG): LZ77 models repeated strings as literal/length/distance triples, then Huffman codes the results. This works but leaves the whole-bit gap. Modern alternatives like Zstandard replace the Huffman backend with tANS (Finite State Entropy) and get 10-30% better compression at similar or faster decode speeds.',
        'Video codecs (H.264, H.265, AV1): after prediction and transform, the residual coefficients and syntax elements are entropy coded. H.264 uses CABAC (Context-Adaptive Binary Arithmetic Coding), which adapts probabilities per context bin. H.265 continues with CABAC. AV1 uses a multi-symbol arithmetic coder with CDF-based probability tables updated after each frame. In all cases, the arithmetic coder is the final stage that turns modeled coefficients into the actual bits in the file.',
        'Machine learning: neural network weights are 32-bit floats, but inference often needs far fewer bits. Entropy coding is used in neural network compression to store quantized weights compactly. It also appears inside learned image compression models (e.g., the Balle hyperprior architecture), where a neural network produces the probability model and an arithmetic coder writes the latent representation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Entropy coders do not discover structure. If the input is truly random uniform bytes (each byte equally likely), the entropy is 8 bits per byte and no lossless coder can compress it. If you feed random data to an arithmetic coder with a uniform model, you get out roughly the same number of bits you put in, plus overhead for the stream header. Compression comes entirely from the model predicting symbols well.',
        'Encoder-decoder mismatch is catastrophic. If the encoder updates its probability table after symbol 47 but the decoder updates after symbol 46, every subsequent symbol decodes wrong, and the error cascades. Adaptive coders must synchronize every state update: same context selection, same rescaling schedule, same escape handling. A single bit flip in the compressed stream can desynchronize the state and corrupt everything that follows, with no way to resync without external framing.',
        'Implementation pitfalls are subtle. Integer overflow in the range product (low + width * cum can overflow 32 bits). Off-by-one in cumulative frequency tables (the ranges must partition [0, total) exactly, with no gaps and no overlaps). Non-deterministic table construction across platforms (floating-point rounding differences in tANS table spreading). Security-sensitive decoders must validate every table entry and range before trusting a bitstream, because a crafted input can drive the state into undefined territory.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Encode the message "BAA" with P(A)=0.75 and P(B)=0.25. Cumulative ranges: A owns [0, 0.75), B owns [0.75, 1.0). Start with interval [0, 1), width 1.0.',
        'Step 1, encode B: new_low = 0 + 1.0 * 0.75 = 0.75. new_high = 0 + 1.0 * 1.0 = 1.0. Interval is now [0.75, 1.0), width 0.25. The ideal cost so far is -log2(0.25) = 2.0 bits.',
        'Step 2, encode A: new_low = 0.75 + 0.25 * 0 = 0.75. new_high = 0.75 + 0.25 * 0.75 = 0.9375. Interval is [0.75, 0.9375), width 0.1875. Cost so far is -log2(0.1875) = 2.415 bits.',
        'Step 3, encode A: new_low = 0.75 + 0.1875 * 0 = 0.75. new_high = 0.75 + 0.1875 * 0.75 = 0.890625. Interval is [0.75, 0.890625), width 0.140625. Cost is -log2(0.140625) = 2.830 bits. We need 3 bits to identify a point in this interval.',
        'Choose a binary fraction inside [0.75, 0.890625). The fraction 0.8125 = 0.1101 in binary works (it equals 13/16). Actually, 0.11 in binary = 0.75, which is the left endpoint (half-open, so it is included). Output "110" in binary (0.75 in binary is 0.11, but we need to be inside the interval; 0.8125 = 0.1101 requires 4 bits, while 0.11 = 0.75 is at the boundary). A clean choice: 0.8 is roughly 0.1100110... in binary. The encoder picks the shortest binary string that falls strictly inside the interval.',
        'Verify by decoding. The decoder knows P(A)=0.75, P(B)=0.25, and receives the binary fraction. It starts with [0, 1). The received number 0.8125 falls in [0.75, 1.0), so the first symbol is B. Narrow to [0.75, 1.0). Now 0.8125 falls in [0.75, 0.9375), which is the A subrange. Narrow to [0.75, 0.9375). Now 0.8125 falls in [0.75, 0.890625), which is the A subrange again. The decoded message is BAA.',
        'Compare to Huffman. With Huffman, A gets codeword "0" (1 bit) and B gets "10" (2 bits). The message BAA encodes as "10" + "0" + "0" = "1000", which is 4 bits. Arithmetic coding used about 3 bits. The saving is 25%. On longer messages with skewed distributions, this gap widens further.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Entropy and Information to understand why -log2(p) is the ideal bit cost. Study Huffman Coding to see what prefix codes do well and where they hit the whole-bit wall. Then read about LZ77 Compression and DEFLATE to see how a modeling front end feeds an entropy coder. For the ANS table view, Finite State Machines will make the automaton formulation natural.',
        'Primary sources: Witten, Neal, and Cleary, "Arithmetic Coding for Data Compression" (1987), available at https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf — the paper that made arithmetic coding practical. Duda, "Asymmetric numeral systems" (2009), at https://arxiv.org/abs/0902.0271 — the original ANS paper. Duda, "Asymmetric numeral systems: entropy coding combining speed of Huffman coding with compression rate of arithmetic coding" (2013), at https://arxiv.org/abs/1311.2540 — the paper that led to tANS and Zstandard adoption.',
        'For video codec applications, continue with the Video Codec Reference Frame DAG Case Study and AV1 Tile OBU Superblock Case Study topics on this site.',
      ],
    },
  ],
};
