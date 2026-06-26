// UTF-8 decoding: classify bytes, track expected continuations, reject
// overlong or invalid scalar values, and emit Unicode code points.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'utf8-decoder-dfa-case-study',
  title: 'UTF-8 Decoder DFA Case Study',
  category: 'Concepts',
  summary: 'A byte-stream decoding case study: classify lead and continuation bytes, track remaining payload bytes, assemble code points, and reject malformed UTF-8 early.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['byte classes', 'malformed input'], defaultValue: 'byte classes' },
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

function decoderGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'bytes', label: 'bytes', x: 0.7, y: 4.0, note: notes.bytes ?? 'stream' },
      { id: 'classify', label: 'class', x: 2.5, y: 4.0, note: notes.classify ?? 'lead/cont' },
      { id: 'state', label: 'state', x: 4.4, y: 2.5, note: notes.state ?? 'need n' },
      { id: 'accum', label: 'accum', x: 4.4, y: 5.6, note: notes.accum ?? 'bits' },
      { id: 'scalar', label: 'scalar', x: 6.5, y: 4.0, note: notes.scalar ?? 'U+...' },
      { id: 'emit', label: 'emit', x: 8.2, y: 4.0, note: notes.emit ?? 'char' },
      { id: 'reject', label: 'reject', x: 8.2, y: 6.5, note: notes.reject ?? 'error' },
    ],
    edges: [
      { id: 'e-bytes-classify', from: 'bytes', to: 'classify', weight: '' },
      { id: 'e-classify-state', from: 'classify', to: 'state', weight: '' },
      { id: 'e-classify-accum', from: 'classify', to: 'accum', weight: '' },
      { id: 'e-accum-scalar', from: 'accum', to: 'scalar', weight: '' },
      { id: 'e-state-scalar', from: 'state', to: 'scalar', weight: '' },
      { id: 'e-scalar-emit', from: 'scalar', to: 'emit', weight: '' },
      { id: 'e-state-reject', from: 'state', to: 'reject', weight: '' },
    ],
  }, { title });
}

function* byteClasses() {
  yield {
    state: decoderGraph('UTF-8 is a byte classifier plus a tiny state machine'),
    highlight: { active: ['bytes', 'classify', 'state'], found: ['emit'] },
    explanation: 'A UTF-8 decoder reads bytes, classifies each byte, tracks how many continuation bytes are still required, and emits one Unicode scalar value only when the sequence is complete and valid.',
    invariant: 'ASCII bytes stand alone; multi-byte lead bytes create an obligation to read continuation bytes.',
  };

  yield {
    state: labelMatrix(
      'Byte class table',
      [
        { id: 'ascii', label: '00..7F' },
        { id: 'cont', label: '80..BF' },
        { id: 'lead2', label: 'C2..DF' },
        { id: 'lead3', label: 'E0..EF' },
        { id: 'lead4', label: 'F0..F4' },
        { id: 'bad', label: 'C0,C1,F5..FF' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'next', label: 'decoder action' },
      ],
      [
        ['ASCII', 'emit now'],
        ['continuation', 'only after lead'],
        ['2-byte lead', 'need 1 cont'],
        ['3-byte lead', 'need 2 cont'],
        ['4-byte lead', 'need 3 cont'],
        ['invalid', 'reject'],
      ],
    ),
    highlight: { active: ['ascii:next', 'lead3:next'], compare: ['bad:next'] },
    explanation: 'The high bits tell the shape. 0xxxxxxx is ASCII. 10xxxxxx is a continuation byte. Lead bytes start a two-, three-, or four-byte sequence. Some byte ranges are illegal because they would encode overlong or out-of-range values.',
  };

  yield {
    state: labelMatrix(
      'Decoding E2 82 AC',
      [
        { id: 'b0', label: 'E2' },
        { id: 'b1', label: '82' },
        { id: 'b2', label: 'AC' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'class', label: 'class' },
        { id: 'state', label: 'state' },
        { id: 'payload', label: 'payload' },
      ],
      [
        ['3-byte lead', 'need 2', '0010'],
        ['continuation', 'need 1', '000010'],
        ['continuation', 'need 0', '101100'],
        ['scalar', 'emit', 'U+20AC'],
      ],
    ),
    highlight: { active: ['b0:state', 'b1:state', 'b2:state'], found: ['done:payload'] },
    explanation: 'E2 82 AC decodes to U+20AC. The decoder keeps only a small accumulator and a remaining-count state, so it can stream bytes without waiting for the whole string.',
  };

  yield {
    state: decoderGraph('ASCII-compatible design keeps delimiters visible', { bytes: 'JSON,CSV', classify: '00..7F', state: 'none', scalar: 'same byte', emit: 'delims' }),
    highlight: { active: ['bytes', 'classify', 'emit'], found: ['e-scalar-emit'] },
    explanation: 'UTF-8 preserves ASCII bytes. A parser looking for commas, quotes, braces, or brackets can find those delimiter bytes without mistaking them for part of a multi-byte character.',
  };

  yield {
    state: labelMatrix(
      'Why parsers care',
      [
        { id: 'json', label: 'JSON' },
        { id: 'csv', label: 'CSV' },
        { id: 'logs', label: 'logs' },
        { id: 'db', label: 'databases' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'risk', label: 'risk if lax' },
      ],
      [
        ['valid text', 'bad escapes or spoofing'],
        ['delimiter safety', 'corrupt columns'],
        ['streaming decode', 'broken observability'],
        ['stable keys', 'duplicate-looking text'],
      ],
    ),
    highlight: { active: ['json:need', 'csv:need'], compare: ['risk'] },
    explanation: 'UTF-8 validation is not decorative. Text parsers, logs, signatures, and databases all need a shared answer to which byte strings are valid text.',
  };
}

function* malformedInput() {
  yield {
    state: decoderGraph('A continuation byte at the start is invalid', { bytes: '80', classify: 'cont', state: 'need 0', reject: 'unexpected' }),
    highlight: { active: ['bytes', 'classify', 'state', 'reject', 'e-state-reject'], removed: ['emit'] },
    explanation: 'A continuation byte is legal only after a lead byte has created an obligation. If the decoder is not waiting for continuation bytes, 80..BF must be rejected.',
    invariant: 'Malformed input should fail at the byte that proves it malformed.',
  };

  yield {
    state: labelMatrix(
      'Malformed cases',
      [
        { id: 'orphan', label: '80' },
        { id: 'trunc', label: 'E2 82' },
        { id: 'overlong', label: 'C0 AF' },
        { id: 'surrogate', label: 'ED A0 80' },
        { id: 'high', label: 'F4 90 80 80' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'why', label: 'why reject' },
      ],
      [
        ['orphan cont', 'no lead byte'],
        ['truncated', 'need one more byte'],
        ['overlong', 'slash should be 2F'],
        ['surrogate', 'not scalar value'],
        ['above max', 'past U+10FFFF'],
      ],
    ),
    highlight: { active: ['overlong:why', 'surrogate:why'], compare: ['trunc:problem'] },
    explanation: 'Strict UTF-8 validation rejects more than bad bit prefixes. It also rejects overlong encodings, surrogate halves, and values beyond the Unicode scalar-value range.',
  };

  yield {
    state: decoderGraph('Overlong encodings are security bugs, not alternate spellings', { bytes: 'C0 AF', classify: 'bad lead', reject: 'overlong' }),
    highlight: { active: ['bytes', 'classify', 'reject', 'e-state-reject'], removed: ['emit'] },
    explanation: 'Overlong encodings let the same character appear in more than one byte spelling. That can bypass filters that check one representation and a later layer decodes another.',
  };

  yield {
    state: labelMatrix(
      'Decoder policies',
      [
        { id: 'strict', label: 'strict' },
        { id: 'replace', label: 'replace' },
        { id: 'ignore', label: 'ignore' },
        { id: 'lax', label: 'lax accept' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'use' , label: 'use when' },
      ],
      [
        ['throw error', 'protocol boundary'],
        ['U+FFFD', 'display text'],
        ['drop bytes', 'rarely safe'],
        ['accept variants', 'avoid'],
      ],
    ),
    highlight: { active: ['strict:use', 'replace:behavior'], removed: ['lax:behavior'] },
    explanation: 'There is a difference between validation and display. Protocol parsers often need strict rejection; user interfaces may replace bad bytes so a document can still be shown.',
  };

  yield {
    state: decoderGraph('The decoder hands clean text to higher parsers', { bytes: 'valid', state: 'complete', scalar: 'Unicode', emit: 'tokens', reject: 'closed' }),
    highlight: { found: ['emit'], active: ['bytes', 'classify', 'state', 'scalar'], removed: ['reject'] },
    explanation: 'Once UTF-8 validation has done its job, a CSV parser, JSON tokenizer, search indexer, or database key comparator can reason about characters instead of ambiguous byte sequences.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'byte classes') yield* byteClasses();
  else if (view === 'malformed input') yield* malformedInput();
  else throw new InputError('Pick a UTF-8 decoder view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the boxes as a streaming decoder, which means the bytes arrive one at a time and the program cannot wait for a whole file. Active nodes show the byte being classified, found nodes show a scalar value that can be emitted, and removed nodes show a path that strict UTF-8 has rejected.',
        'A byte is an 8-bit value. A code point is the numeric identity of a Unicode character, and a Unicode scalar value is a code point that is legal to encode as text. The safe inference rule is this: a continuation byte is legal only after a lead byte has created an exact remaining-byte obligation.',
        {type:'callout', text:'A UTF-8 decoder turns byte validity into a shared boundary, so higher parsers receive one stable character stream instead of ambiguous byte spellings.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Programs store and transmit text as bytes, but users and parsers reason about characters. UTF-8 exists because it can encode Unicode while leaving ASCII bytes 00 through 7F unchanged, so commas, slashes, quotes, brackets, and newlines keep their old byte values.',
        'The decoder exists to make that contract precise. It turns a byte stream into one valid scalar-value stream, or it rejects the stream at the first byte that proves the text is not UTF-8.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is to treat every byte as one character. That works for pure ASCII because byte 41 means U+0041, the letter A, and byte 2F means slash.',
        'The next approach is to accept any loose decoder output and replace bad bytes later. That is acceptable for displaying damaged text, but it is wrong at a protocol boundary where two layers must agree on exactly which characters were received.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity. Bytes C0 AF can be a forbidden overlong spelling of slash in a lax decoder, while a strict byte filter might not see a literal 2F slash at all.',
        'Malformed UTF-8 is not only a display problem. Orphan continuation bytes, truncated sequences, surrogate halves, and values above U+10FFFF can make logs, signatures, database keys, and parsers disagree about the same input.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'UTF-8 decoding is an obligation tracker. ASCII bytes emit immediately, legal lead bytes create an obligation for one to three continuation bytes, and each continuation byte must satisfy the current state.',
        'The invariant is small but strict. At every byte, the decoder is either ready for a new character or waiting for a known number of continuation bytes with known range limits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The decoder classifies the next byte by its high bits and range. Bytes 00..7F are ASCII, 80..BF are continuation bytes, C2..DF starts a two-byte sequence, E0..EF starts a three-byte sequence, and F0..F4 starts a four-byte sequence.',
        'A lead byte seeds an accumulator with payload bits and records how many continuation bytes remain. Each continuation byte contributes six payload bits, decrements the count, and keeps the stream alive only if it is legal for the current range.',
        'When the count reaches zero, the accumulator must be a legal scalar value with the shortest UTF-8 spelling. C0, C1, and F5..FF reject immediately, E0 and F0 need lower-bound checks, ED blocks surrogate halves, and F4 blocks values above U+10FFFF.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the state invariant. If the decoder is ready, only ASCII or a legal lead byte can move it forward; if it is waiting, only a continuation byte in the allowed range can move it forward.',
        'The algorithm emits only after all required bytes have arrived and the assembled value has passed scalar-value checks. That proves every emitted character has exactly one valid UTF-8 spelling and every rejected stream has violated the byte grammar or scalar range.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The running time is O(n) over bytes because each byte is classified once. Doubling a 1 MB input to 2 MB doubles the number of byte transitions, but it does not change the amount of state the decoder keeps.',
        'The space cost is constant: current state, remaining count, accumulator, and a few range checks. The practical complexity is not memory; it is getting every boundary case correct, because one accepted overlong sequence can become a security bug.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Strict UTF-8 validation belongs at protocol, file-ingest, database, log, JSON, CSV, search-index, and signature boundaries. Once bytes are validated, higher parsers can reason about one character stream instead of defending against alternate byte spellings.',
        'Streaming parsers benefit most. A socket reader can emit ASCII immediately, hold at most a few bytes of pending state for non-ASCII text, and report the exact byte offset where malformed input becomes undeniable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A UTF-8 decoder does not solve all Unicode problems. Valid text can still contain visually confusable characters, different normalization forms, locale-specific casing, control characters, and grapheme clusters that do not match one code point.',
        'Replacement mode is also not validation. Emitting U+FFFD may be right for a text editor, but a parser that accepts repaired bytes may change the meaning of a signed message, path, or database key.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Decode E2 82 AC. E2 is a three-byte lead, so the decoder records that two continuation bytes are required; 82 contributes six bits and leaves one byte required; AC contributes the last six bits, so the accumulator becomes U+20AC, the euro sign.',
        'Now compare C0 AF. Slash is U+002F and has the one-byte UTF-8 spelling 2F, so C0 AF is an overlong two-byte spelling and must reject even though a lax decoder could turn it into the same character.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 3629, UTF-8, at https://www.rfc-editor.org/rfc/rfc3629. Study finite state machines for the decoder shape, parser state machines for protocol boundaries, and Unicode normalization for the text problems that begin after byte validity is settled.',
      ],
    },
  ],
};
