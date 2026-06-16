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
      heading: 'What it is',
      paragraphs: [
        'UTF-8 is a variable-length byte encoding for Unicode scalar values. ASCII bytes 00..7F encode themselves. Non-ASCII characters use lead bytes followed by one to three continuation bytes. A decoder is a small state machine: classify the byte, update the expected continuation count, accumulate payload bits, validate the final scalar value, then emit.',
        'This matters because nearly every text format in the repo sits on top of UTF-8 or a compatible byte stream. Before a parser can trust quotes, commas, braces, identifiers, or log text, it needs a clear boundary between valid characters and malformed bytes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The decoder classifies bytes by high-bit pattern and range. ASCII emits immediately. A legal two-byte lead such as C2..DF requires one continuation byte. A three-byte lead requires two. A four-byte lead requires three. Continuation bytes must be 80..BF and must arrive only when the decoder is waiting for them.',
        'Strict validation also checks semantic constraints: no overlong encodings, no surrogate halves, and no scalar values above U+10FFFF. Those checks prevent multiple byte spellings for the same character and keep later parsers from disagreeing about what the text means.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'The bytes E2 82 AC decode to U+20AC. E2 is a three-byte lead, so the decoder expects two continuation bytes and seeds the accumulator. 82 and AC contribute six payload bits each. When the remaining count reaches zero, the accumulated value is checked against the valid range and emitted.',
        'The bytes C0 AF must be rejected. They are an overlong way to spell slash, which should be the one-byte ASCII value 2F. A filter that rejects literal slash but accepts overlong slash can be bypassed if a later layer decodes the bytes loosely.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Decoding is O(n) over bytes and uses constant state: current accumulator, remaining continuation count, and validation bounds. The hard part is not asymptotic cost; it is rejecting every malformed corner consistently across libraries, protocols, logs, databases, and security filters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 3629, UTF-8, at https://www.rfc-editor.org/rfc/rfc3629. Study CSV Parser State Machine, JSON Parser Stack, Parser Design Patterns Primer, Finite State Machines, WebAssembly Linear Memory, Byte Latent Transformer, and Tokenization (BPE) next.',
      ],
    },
  ],
};
