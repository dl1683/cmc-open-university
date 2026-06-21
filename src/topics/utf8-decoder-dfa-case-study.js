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
      heading: 'Why This Exists',
      paragraphs: [
        'Programs move text as bytes. Users expect those bytes to become characters. Protocols, databases, logs, signatures, search indexes, and parsers need all layers to agree on the same answer: which byte strings are valid text and which Unicode scalar values they mean.',
        'UTF-8 exists because it can encode all Unicode scalar values while preserving ASCII as single bytes. That makes old ASCII-oriented formats practical: commas, quotes, slashes, braces, brackets, tabs, and line breaks keep their byte values. A parser can still find syntax bytes without understanding every human language.',
        'The decoder DFA is the small state machine that keeps this promise honest. It accepts valid byte sequences, emits scalar values, and rejects malformed input early. Without that shared boundary, one layer can treat a byte string as harmless while another layer later turns it into a different character stream.',
        {type:'callout', text:'A UTF-8 decoder turns byte validity into a shared boundary, so higher parsers receive one stable character stream instead of ambiguous byte spellings.'},
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        'The obvious approach is to treat each byte as a character. That works for pure ASCII demos because bytes 00 through 7F map directly to the same code points. It fails as soon as text contains characters outside ASCII, because one character can take two, three, or four bytes.',
        'A second tempting approach is to accept whatever a loose decoder returns. That breaks when a stream contains orphan continuation bytes, truncated sequences, overlong encodings, surrogate halves, or values above the Unicode maximum. The decoder may produce replacement characters, drop bytes, or accept spellings that strict UTF-8 forbids.',
        'The wall is disagreement between layers. A filter might reject a slash byte, a later decoder might accept an overlong slash spelling, and an application might route the request as if the slash had always been there. Strict decoding makes invalid byte strings fail before higher-level grammar or security logic runs.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'UTF-8 decoding is an obligation tracker. An ASCII byte has no obligation and emits immediately. A legal lead byte creates an obligation to see one, two, or three continuation bytes. Each continuation byte must arrive in the right state, contribute six payload bits, and reduce the remaining obligation.',
        'The decoder emits only when the obligation reaches zero and the assembled scalar value is legal. If a byte arrives that cannot satisfy the current obligation, the byte stream is malformed at that point. It is not an alternate spelling or a strange character.',
        'The invariant is that the decoder is always in one of two broad modes: ready for a new character, or waiting for a known number of continuation bytes with known range constraints. Every byte either moves the machine to the next valid state, emits a scalar, or rejects the stream.',
      ],
    },
    {
      heading: 'How the Visual Model Teaches It',
      paragraphs: [
        'The byte classes view starts at classification because UTF-8 is shaped by high bits. ASCII emits immediately. Continuation bytes are legal only after a lead byte. C2..DF starts a two-byte sequence. E0..EF starts a three-byte sequence. F0..F4 starts a four-byte sequence. Illegal lead ranges reject.',
        'The E2 82 AC table shows why only small state is needed. E2 creates a need for two continuation bytes. 82 satisfies one obligation and contributes payload bits. AC satisfies the last obligation. The accumulator becomes U+20AC, and the decoder can emit without buffering the rest of the string.',
        'The malformed input view teaches early rejection. A continuation byte at the start fails because no lead byte requested it. C0 AF fails because it is an overlong spelling. ED A0 80 fails because it encodes a surrogate half. F4 90 80 80 fails because it is beyond U+10FFFF.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A decoder keeps a small amount of state: the current accumulator, how many continuation bytes remain, and sometimes lower or upper bounds needed to reject overlong and out-of-range sequences. ASCII bytes 00..7F emit directly. Continuation bytes 80..BF contribute payload bits only when the decoder is waiting for them.',
        'Lead bytes decide the sequence length and seed the accumulator. C2..DF starts a two-byte sequence. E0..EF starts a three-byte sequence. F0..F4 starts a four-byte sequence. C0, C1, and F5..FF are illegal in modern UTF-8. They either create overlong forms or values outside the Unicode scalar range.',
        'Boundary checks do more than count bytes. E0 has a tighter first-continuation lower bound to prevent overlong three-byte encodings. ED has an upper bound to reject surrogate halves. F0 and F4 have bounds that keep four-byte values within U+10000 through U+10FFFF. A strict decoder checks byte shape and scalar legality.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The DFA works because every byte class has a limited set of legal next states. A continuation byte cannot start a character. A lead byte cannot appear while the decoder is still waiting for continuation bytes. End of input cannot arrive while the remaining count is nonzero. These rules make malformed input fail as soon as the stream proves it cannot be valid UTF-8.',
        'ASCII compatibility also matters. UTF-8 never hides an ASCII delimiter inside a multibyte sequence. If a JSON tokenizer scans for quote, colon, comma, brace, or bracket bytes, those bytes mean themselves. Non-ASCII text uses bytes with the high bit set and cannot impersonate ASCII syntax.',
        'The scalar-value check keeps UTF-8 tied to Unicode, not just to bit patterns. Surrogate halves are used internally by UTF-16 and are not Unicode scalar values. Values past U+10FFFF are outside the Unicode range. Accepting them would create strings that other correct systems must reject.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'The bytes E2 82 AC decode to U+20AC, the euro sign. E2 is a three-byte lead, so the decoder expects two continuation bytes and seeds the accumulator with the lead payload. 82 is a continuation byte, so it contributes six bits and leaves one continuation still required. AC contributes the last six bits. The count reaches zero, the scalar passes validation, and the decoder emits U+20AC.',
        'The bytes 41 E2 82 AC 0A decode as ASCII A, then U+20AC, then newline. The decoder does not need to know that the stream is a whole line. It can emit A immediately, keep two bytes of state while decoding the euro sign, then emit newline immediately. That streaming property is why UTF-8 works well for files, sockets, and parsers.',
        'The bytes C0 AF must be rejected. They are an overlong way to spell slash, which is already 2F in ASCII. If a filter rejects literal slash but a later layer accepts C0 AF as slash, the system has two interpretations of the same input. Strict UTF-8 validation closes that gap.',
      ],
    },
    {
      heading: 'Malformed Cases',
      paragraphs: [
        'An orphan continuation byte such as 80 fails in the ready state because no lead byte created an obligation. A truncated sequence such as E2 82 fails at end of input because one continuation byte is still required. A lead byte inside an unfinished sequence fails because the machine was expecting continuation, not a new character.',
        'Overlong encodings are invalid even if they could be decoded into a familiar character. UTF-8 has one shortest spelling for each scalar value. Allowing longer spellings makes filters, path checks, database keys, and signatures disagree about whether two byte strings represent the same text.',
        'Surrogate halves and out-of-range values are invalid for a different reason: they are not Unicode scalar values. ED A0 80 represents a surrogate half. F4 90 80 80 crosses above U+10FFFF. A strict decoder rejects both even though their byte prefixes may look structurally plausible.',
      ],
    },
    {
      heading: 'Decoder Policies',
      paragraphs: [
        'Strict mode rejects malformed input. It is the right default at protocol boundaries, authentication paths, database keys, signed payloads, parsers, and any place where accepting ambiguous text can change meaning or security behavior.',
        'Replacement mode emits U+FFFD for malformed byte sequences. It is useful for display, editors, logs, and recovery tools where showing damaged text is better than failing the whole document. Replacement should be a deliberate display policy, not a hidden parser behavior.',
        'Ignore mode drops bad bytes, and lax mode accepts illegal variants. Both are dangerous for structured input because they erase evidence. If one layer drops or accepts bytes that another layer rejects, the system loses one stable interpretation of text.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'The algorithm is cheap: O(n) over bytes and constant memory. It streams naturally because the decoder needs only the current state, accumulator, and remaining count. It does not need the whole string before producing output.',
        'The complexity is in correctness at the boundaries. A production decoder must get every illegal range, truncation case, overlong case, surrogate range, and maximum-code-point check right. Small mistakes become interoperability or security bugs.',
        'The other tradeoff is where validation happens. Validating once at input boundaries simplifies downstream parsers, but internal systems still need to preserve the invariant that strings remain valid. If code mixes raw bytes and decoded strings freely, the same ambiguity can reenter later.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Strict UTF-8 validation wins at protocol boundaries, file ingestion, JSON and CSV parsing, database keys, log pipelines, signatures, search indexes, URL handling, and any place where downstream code needs one stable interpretation of text.',
        'It is especially useful before parsers that care about ASCII delimiters. Once decoding has accepted the stream, a tokenizer can reason about characters and syntax without also handling malformed byte spellings.',
        'It also wins in streaming systems. A socket reader, log tailer, or incremental parser can validate as bytes arrive, emit complete scalar values, and report the exact position where malformed input first becomes undeniable.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'A UTF-8 decoder does not solve Unicode normalization, confusable characters, locale-specific casing, grapheme clusters, sorting, search matching, or display width. Two valid strings can still look similar or compare differently depending on higher-level text rules.',
        'It also cannot repair hostile input for a protocol. Replacement mode is useful for display, but accepting a message after replacing malformed bytes can change meaning. Validation and recovery should be separate decisions.',
        'It does not prove that text is safe for a particular grammar. A byte stream can be valid UTF-8 and still contain dangerous SQL, misleading identifiers, mixed-script spoofing, or control characters that a later layer must handle.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Use a well-tested decoder from the platform when possible. UTF-8 is small enough to explain but easy to get subtly wrong. If you implement it yourself, write tests for ASCII, each legal sequence length, boundaries around E0, ED, F0, and F4, orphan continuation bytes, truncation, overlong forms, surrogates, and values above U+10FFFF.',
        'Keep byte validation separate from higher-level text policy. First decide whether the bytes are valid UTF-8. Then decide whether to normalize, reject control characters, compare case-insensitively, split grapheme clusters, or defend against confusables. Those are separate layers with different rules.',
        'For streaming APIs, expose enough state to report incomplete sequences at end of input. A decoder that processes chunks must remember pending continuation obligations across chunk boundaries, but it must reject if the final chunk ends before those obligations are satisfied.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary source: RFC 3629, UTF-8, at https://www.rfc-editor.org/rfc/rfc3629. Study CSV Parser State Machine, JSON Parser Stack, Parser Design Patterns Primer, Finite State Machines, WebAssembly Linear Memory, Byte Latent Transformer, and Tokenization (BPE) next.',
      ],
    },
  ],
};
