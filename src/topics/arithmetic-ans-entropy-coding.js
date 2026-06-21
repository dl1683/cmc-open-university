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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/arithmetic-ans-entropy-coding.gif', alt: 'Animated walkthrough of the arithmetic ans entropy coding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Entropy coding is the last step that turns modeled events into bits. A compressor may first find repeated strings, predict pixels, quantize transforms, or tokenize text, but eventually it has a stream of symbols with probabilities. If A appears three times as often as B, a good bitstream should spend fewer bits on A than on B. That is the pressure arithmetic coding and ANS respond to.`,
        `The hard part is that information theory does not usually ask for whole bits per symbol. A symbol with probability 0.75 has an ideal cost of about 0.415 bits, not one bit. A rare symbol with probability 0.25 costs two bits. Huffman coding is excellent when probabilities line up with powers of two, but real distributions are messier. Arithmetic coding and ANS exist so a coder can approach fractional average costs without assigning a separate fractional bitstring to a single symbol.`,
        {type: 'callout', text: 'Entropy coding turns probability mass into bit cost; arithmetic coding uses nested ranges, while ANS uses reversible integer states.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first approach is a prefix code. Count symbol frequencies, build a Huffman tree, and give common symbols shorter codewords. This is simple, fast, and still used in important formats. The decoder can read bits from left to right and stop as soon as it reaches a leaf, so the stream is self-delimiting. For many workloads, that engineering simplicity matters more than squeezing out the last fraction of a bit.`,
        `The wall is the integer-length rule. A prefix code cannot assign 0.415 bits to A. It must assign one bit, two bits, or some other whole length to each codeword. Long messages can average those whole lengths, but each symbol still pays through an integer code. That leaves compression on the table when the model is skewed, adaptive, or context dependent. The coder is no longer limited by the data model; it is limited by the representation of the code itself.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Arithmetic coding changes the unit of coding from one symbol to one message. Instead of saying "A is 0 and B is 10", it keeps an interval between 0 and 1. Each symbol narrows the current interval according to the model. After the whole message is processed, any binary fraction inside the final interval identifies the same path of choices. A likely message leaves a wider final interval and needs fewer bits to point into it. An unlikely message leaves a narrow final interval and needs more bits.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Arithmetic_coding_visualisation.svg/330px-Arithmetic_coding_visualisation.svg.png', alt: 'Arithmetic coding interval narrowing for two example messages.', caption: 'Nested intervals show how a whole message becomes one short binary prefix. (Source: Wikimedia Commons)'},
        `ANS makes a different surface move but follows the same economics. It keeps one integer state. Encoding a symbol maps the current state to a new state and emits low bits when the state grows too large. Common symbols occupy more of the state space, so they tend to move through the machine cheaply. Rare symbols occupy less state space and tend to force more emitted bits. The state is not just a counter; it carries the compressed payload and the alignment needed for exact decoding.`,
      ],
    },
    {
      heading: 'Arithmetic coding mechanism',
      paragraphs: [
        `In the interval view, the model partitions the current range. With P(A)=0.75 and P(B)=0.25, A receives the lower three quarters and B receives the upper quarter at each step. Encoding BAA starts with [0, 1), selects the B subrange [0.75, 1), then selects the A subrange inside that, and then selects A again. The interval width after the message is the probability of that message under the model.`,
        `A real implementation does not keep infinite-precision real numbers. Range coders use integer low and range values. When the leading bits of the interval become fixed, the encoder emits them and renormalizes the state. The decoder mirrors the same integer operations, refilling from the bitstream as needed. This is why arithmetic coders are exact only when encoder and decoder share the same frequency table, update schedule, rounding rules, and renormalization boundaries.`,
      ],
    },
    {
      heading: 'ANS mechanism',
      paragraphs: [
        `ANS can feel stranger because it decodes in reverse order. The encoder pushes symbols into a state, and the decoder pops symbols out while reconstructing the previous state. rANS uses arithmetic formulas over frequency tables. tANS, also known through Finite State Entropy, materializes a table of state transitions. In both forms, the probability model decides how many states each symbol owns.`,
        `The toy transition table in the visual is not a production rANS table. It is showing the shape that matters. A common A appears in more state slots. A rarer B appears in fewer slots and can push the state far enough to emit a bit. The emitted bits are not separate from the state machine; they are how the coder keeps the integer state inside a bounded range while preserving enough information for the inverse transition.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Simple_example_of_ANS_automaton.png/500px-Simple_example_of_ANS_automaton.png', alt: 'Four-state ANS automaton for symbols with unequal probabilities.', caption: 'The automaton makes the ANS state buffer visible: common symbols often emit fewer bits, rare symbols emit more. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The interval-coder view proves that the number of required bits tracks the final interval width, not the count of symbols. The row for BAA gets narrower after each symbol. That shrinking width is the probability of the whole message under the model. When the final width is about 0.141, the ideal cost is about -log2(0.141), or a little under three bits. The visual ties compression cost to probability mass rather than to a fixed codeword list.`,
        `The ANS view proves the same claim with discrete states. The model feeds a symbol and a state transition; renormalization sends bits out only when the bounded state needs room. The comparison table then places Huffman, arithmetic coding, and ANS side by side. Huffman is a prefix-tree method, arithmetic coding is a range method, and ANS is an integer-state method. All three need a model. The better the model, the fewer bits the entropy coder has to spend.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/ANS_general_picture.png/960px-ANS_general_picture.png', alt: 'Comparison of arithmetic coding and asymmetric numeral systems.', caption: 'Arithmetic coding narrows a range, while ANS stores information in one probability-shaped integer state. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        `Arithmetic coding works because nested intervals preserve a one-to-one path. At every step, the chosen symbol receives a non-overlapping subinterval of the current interval. Two different messages must diverge at some symbol, and at that symbol they move into different subintervals. A number inside the final interval therefore identifies exactly one message, as long as the decoder uses the same sequence of splits.`,
        `ANS works because every encode transition has a matching decode transition. The state space is arranged so a symbol can be recovered from the current state, and the previous state can be reconstructed from the symbol plus the remaining state bits. Renormalization is reversible because emitted low bits are later read back in the same order required by the decoder. The invariant is not "small codewords for common symbols." It is reversible movement through a probability-shaped state space.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost is model lookup, state update, renormalization, and careful bit I/O. Huffman decoding can be extremely fast with wide lookup tables. Arithmetic coding often needs more serial integer arithmetic and branch-sensitive normalization. ANS can be fast because table-based or interleaved rANS variants fit modern CPUs well, but it pays in table construction, state layout, and stricter stream ordering.`,
        `Compression ratio is not the only metric. A coder may be chosen for decode speed, memory footprint, streaming direction, random-access behavior, implementation risk, hardware friendliness, or patent and ecosystem history. Arithmetic coding gives excellent rate but can be harder to pipeline. ANS can combine strong rate with high speed, but table design and normalization details become part of the format contract. A tiny ratio gain can be a bad trade if it slows every decoder.`,
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        `Modern compressors almost always compose a modeling stage with an entropy coder. DEFLATE uses LZ77 to expose repeated strings and Huffman coding to write the resulting literals, lengths, and distances. Zstandard uses LZ-style matching and Finite State Entropy, an ANS-family coder, for literals and sequence data. Image and video codecs use prediction, transforms, quantization, and then entropy coding to write the remaining syntax and residuals compactly.`,
        `The clean mental model is separation of concerns. The model decides what events are likely. The coder pays for those events. If a video codec knows that a coefficient is probably zero, the entropy coder can make that cheap. If a text compressor turns repeated substrings into length-distance pairs, the entropy coder can make common pair patterns cheap. Arithmetic coding and ANS do not understand text, images, or video. They reward the stage that makes probability visible.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The biggest misconception is that an entropy coder discovers structure. It does not. If bytes are truly uniform and independent, no lossless entropy coder can compress them in expectation. If the model is stale, too coarse, or different between encoder and decoder, the result is poor compression or a broken stream. Adaptive models add another risk: both sides must update state in exactly the same order, including every escape, rescale, and context switch.`,
        `Implementation failures are also common. Off-by-one frequency totals, integer overflow, mismatched normalization thresholds, and non-deterministic table construction can make a stream undecodable. Error recovery is hard because a single corrupted bit can desynchronize the coder state. Security-sensitive decoders must validate ranges, table sizes, and symbol counts before trusting a bitstream. The coder is mathematically elegant, but production safety lives in the details.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Entropy & Information first, because it explains why -log2(probability) is the target. Then study Huffman Coding to understand prefix-code limits, LZ77 Compression and DEFLATE to see how modeling feeds entropy coding, and Finite State Machines to make the ANS table view feel natural. For media systems, continue into Video Codec Reference Frame DAG Case Study and AV1 Tile OBU Superblock Case Study.`,
        `Primary sources worth reading are Witten, Neal, and Cleary, "Arithmetic Coding for Data Compression", at https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf, Duda, "Asymmetric numeral systems", at https://arxiv.org/abs/0902.0271, and Duda, "Asymmetric numeral systems: entropy coding combining speed of Huffman coding with compression rate of arithmetic coding", at https://arxiv.org/abs/1311.2540.`,
      ],
    },
  ],
};
