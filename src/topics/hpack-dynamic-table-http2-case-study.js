// HPACK dynamic tables: HTTP/2 header compression as synchronized static
// and dynamic indexing state shared by encoder and decoder.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hpack-dynamic-table-http2-case-study',
  title: 'HPACK Dynamic Table HTTP/2 Case Study',
  category: 'Systems',
  summary: 'HTTP/2 compresses repeated headers with HPACK: a static table, a bounded dynamic table, indexed representations, literals, and eviction rules shared by encoder and decoder.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['indexed header block', 'dynamic table eviction'], defaultValue: 'indexed header block' },
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

function hpackGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'headers', label: 'headers', x: 0.55, y: 4.0, note: notes.headers ?? 'name:value' },
      { id: 'static', label: 'static', x: 2.3, y: 2.35, note: notes.static ?? 'read only' },
      { id: 'dynamic', label: 'dynamic', x: 2.3, y: 5.75, note: notes.dynamic ?? 'per conn' },
      { id: 'encoder', label: 'encode', x: 4.35, y: 4.0, note: notes.encoder ?? 'choose' },
      { id: 'block', label: 'block', x: 6.25, y: 4.0, note: notes.block ?? 'bytes' },
      { id: 'decoder', label: 'decode', x: 8.05, y: 4.0, note: notes.decoder ?? 'replay' },
      { id: 'mirror', label: 'mirror', x: 9.65, y: 4.0, note: notes.mirror ?? 'same' },
    ],
    edges: [
      { id: 'e-headers-encoder', from: 'headers', to: 'encoder', weight: '' },
      { id: 'e-static-encoder', from: 'static', to: 'encoder', weight: '' },
      { id: 'e-dynamic-encoder', from: 'dynamic', to: 'encoder', weight: '' },
      { id: 'e-encoder-block', from: 'encoder', to: 'block', weight: '' },
      { id: 'e-block-decoder', from: 'block', to: 'decoder', weight: '' },
      { id: 'e-decoder-mirror', from: 'decoder', to: 'mirror', weight: '' },
    ],
  }, { title });
}

function* indexedHeaderBlock() {
  yield {
    state: hpackGraph('HPACK compresses headers with shared index tables'),
    highlight: { active: ['headers', 'static', 'dynamic', 'encoder'], found: ['block'] },
    explanation: 'HTTP headers repeat across requests. HPACK gives the encoder and decoder shared tables so a header can be sent as an index instead of repeating the full name and value.',
    invariant: 'The decoder must replay table updates in the same order as the encoder.',
  };

  yield {
    state: labelMatrix(
      'Static plus dynamic index space',
      [
        { id: 's2', label: 'index 2' },
        { id: 's7', label: 'index 7' },
        { id: 'd62', label: 'index 62' },
        { id: 'd63', label: 'index 63' },
      ],
      [
        { id: 'table', label: 'table' },
        { id: 'entry', label: 'entry' },
      ],
      [
        ['static', ':method: GET'],
        ['static', ':scheme: https'],
        ['dynamic', 'authorization: ...'],
        ['dynamic', 'cookie: sid=...'],
      ],
    ),
    highlight: { active: ['s2:entry', 'd62:entry'], compare: ['d63:table'] },
    explanation: 'The static table is predefined. The dynamic table is per connection and grows from prior encoded header blocks. Together they form one address space for indexes.',
  };

  yield {
    state: hpackGraph('First request inserts a repeated header', { headers: 'cookie', dynamic: 'insert', block: 'literal+idx', mirror: 'add row' }),
    highlight: { active: ['headers', 'dynamic', 'encoder', 'block', 'decoder', 'mirror'], found: ['e-decoder-mirror'] },
    explanation: 'The first time a useful repeated header appears, the encoder can send it as a literal with incremental indexing. The decoder sees that instruction and inserts the same entry into its dynamic table.',
  };

  yield {
    state: hpackGraph('Next request can reference the dynamic entry', { headers: 'same cookie', dynamic: 'index 62', block: 'indexed', decoder: 'lookup', mirror: 'hit' }),
    highlight: { active: ['dynamic', 'encoder', 'block', 'decoder', 'mirror'], found: ['e-dynamic-encoder'] },
    explanation: 'On a later request over the same HTTP/2 connection, the encoder can send a compact indexed representation. The bytes are smaller because both sides already share the table entry.',
  };

  yield {
    state: labelMatrix(
      'Representation choices',
      [
        { id: 'indexed', label: 'indexed' },
        { id: 'literalidx', label: 'literal + index' },
        { id: 'literalno', label: 'literal no index' },
        { id: 'sensitive', label: 'never index' },
      ],
      [
        { id: 'sends', label: 'sends' },
        { id: 'use_when', label: 'use when' },
      ],
      [
        ['index only', 'table already has it'],
        ['name/value', 'will repeat later'],
        ['name/value', 'one-off header'],
        ['name/value', 'secret or risky'],
      ],
    ),
    highlight: { active: ['indexed:sends', 'literalidx:use_when'], compare: ['sensitive:use_when'] },
    explanation: 'The dynamic table is a cache, not a place to put every header. Index useful repeated fields; avoid indexing values that are one-off or sensitive.',
  };
}

function* dynamicTableEviction() {
  yield {
    state: labelMatrix(
      'Dynamic table before insert',
      [
        { id: 'e1', label: 'newest' },
        { id: 'e2', label: 'middle' },
        { id: 'e3', label: 'oldest' },
        { id: 'cap', label: 'capacity' },
      ],
      [
        { id: 'entry', label: 'entry' },
        { id: 'size', label: 'size' },
      ],
      [
        ['authorization', '140'],
        ['cookie', '96'],
        ['user-agent', '110'],
        ['max table', '256'],
      ],
    ),
    highlight: { active: ['cap:size'], compare: ['e1:size', 'e2:size', 'e3:size'] },
    explanation: 'HPACK table size is bounded. Entry size is based on name length, value length, and a fixed overhead. The encoder cannot grow the table beyond the maximum agreed for the connection.',
    invariant: 'New entries are inserted at the front; eviction removes old entries from the end.',
  };

  yield {
    state: hpackGraph('Adding a large entry evicts old rows first', { dynamic: 'evict tail', encoder: 'insert', block: 'update', mirror: 'same evict' }),
    highlight: { active: ['dynamic', 'encoder', 'block', 'decoder', 'mirror'], found: ['e-block-decoder'] },
    explanation: 'Before inserting a new entry, old entries are evicted from the end until enough capacity remains. The decoder performs the same eviction because the encoded block tells it the same update sequence.',
  };

  yield {
    state: labelMatrix(
      'After inserting accept-language',
      [
        { id: 'e0', label: 'newest' },
        { id: 'e1', label: 'kept' },
        { id: 'e2', label: 'evicted' },
        { id: 'e3', label: 'evicted' },
      ],
      [
        { id: 'entry', label: 'entry' },
        { id: 'why', label: 'why' },
      ],
      [
        ['accept-language', 'insert at front'],
        ['authorization', 'still fits'],
        ['cookie', 'tail eviction'],
        ['user-agent', 'tail eviction'],
      ],
    ),
    highlight: { active: ['e0:entry', 'e2:why', 'e3:why'], found: ['e1:why'] },
    explanation: 'The dynamic table behaves like bounded recency state. A large or changing header can push out useful older entries and reduce compression on later requests.',
  };

  yield {
    state: labelMatrix(
      'SETTINGS_HEADER_TABLE_SIZE effects',
      [
        { id: 'same', label: 'same size' },
        { id: 'shrink', label: 'smaller size' },
        { id: 'zero', label: 'size 0' },
        { id: 'raise', label: 'larger size' },
      ],
      [
        { id: 'decoder_action', label: 'decoder action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['keep entries', 'stable compression'],
        ['evict tail', 'state churn'],
        ['clear table', 'no dynamic refs'],
        ['allow more entries', 'more memory'],
      ],
    ),
    highlight: { active: ['shrink:decoder_action', 'zero:decoder_action'], compare: ['raise:cost'] },
    explanation: 'HTTP/2 SETTINGS can reduce the permitted dynamic table size. The following header block carries a table-size update so decoder and encoder state remain synchronized.',
  };

  yield {
    state: hpackGraph('HPACK is compression plus protocol state', { static: 'fixed', dynamic: 'bounded', encoder: 'policy', block: 'frames', decoder: 'strict', mirror: 'sync' }),
    highlight: { active: ['static', 'dynamic', 'encoder', 'decoder', 'mirror'], found: ['block'] },
    explanation: 'HPACK is not just a byte codec. It is a synchronized state machine: compression wins come from repeated headers, but correctness depends on both endpoints maintaining identical table state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'indexed header block') yield* indexedHeaderBlock();
  else if (view === 'dynamic table eviction') yield* dynamicTableEviction();
  else throw new InputError('Pick an HPACK view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a shared address book for headers. Active nodes are the fields, static table, dynamic table, encoder, block, decoder, and mirror table that are participating in one header-block decision.',
        'Found marks the compact representation that can be sent safely. The safe inference is that an index is valid only when the encoder and decoder have replayed the same static-table lookup, insertion, and eviction history.',
        {type:'callout', text:'HPACK treats compression as synchronized table state, so small indexes are safe only when encoder and decoder replay the same updates.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP headers are name-value metadata sent before a body. On one HTTP/2 connection, a browser or gRPC client repeats method, scheme, authority, cookies, authorization shape, and content negotiation fields across many streams.',
        'Sending those names and values as text each time wastes bytes on the hottest path of the protocol. HPACK exists so repeated headers can become small indexes while the decoder still reconstructs the exact header list for each stream.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send every header as plain text. That is stateless, easy to inspect, and correct for a single request because the receiver sees the full name and value every time.',
        'A second approach is generic compression over the connection. That looks attractive until the protocol needs bounded state, deterministic decoding, independent header blocks, and special handling for secrets such as cookies or bearer tokens.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that compression state becomes protocol state. If one side believes index 62 means one cookie and the other side believes it means a different header, the decoded request can become wrong without any missing bytes.',
        'The wall is also policy. Indexing a one-off tracing id wastes table space, while indexing a sensitive value can reveal repetition patterns through compressed sizes. The compressor must decide which values deserve shared memory.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'HPACK turns header compression into a synchronized table machine. The static table is fixed by the specification, and the dynamic table is built by encoded instructions that both endpoints apply in the same order.',
        'A literal with incremental indexing pays the full name and value once, then inserts that pair into the dynamic table. A later header block can reference the pair by index, so the saved bytes come from remembered connection state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder chooses among indexed representation, literal with incremental indexing, literal without indexing, and never-indexed literal. Indexed representation is cheapest, but it is legal only when the field already exists in the static or dynamic table.',
        'Dynamic entries are inserted at the front. In HPACK the static table has 61 entries, so the newest dynamic entry starts at index 62, and older dynamic entries shift to larger indexes.',
        'Entry size equals name length plus value length plus 32 bytes of overhead. When an insertion would exceed the configured maximum table size, the oldest entries are evicted from the end until the table fits.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the table-agreement invariant. After every decoded header block, the decoder dynamic table must be exactly the table the encoder predicted when it encoded the next block.',
        'Every instruction that changes the dynamic table is carried in the byte stream and applied by both sides. Because insertion position, size calculation, and tail eviction are deterministic, the same history produces the same index mapping.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Encoding and decoding are linear in the number of header fields plus the bytes needed for integer and string encodings. The dynamic table uses bounded memory, so its space cost is the configured table size, not the number of requests on the connection.',
        'Cost behaves like a cache. A stable 120-byte cookie sent 1,000 times can cost one literal insertion plus 999 small indexes, but a rotating 120-byte request id can consume insertion and eviction work without future hits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HPACK is used by HTTP/2 clients, servers, proxies, and gRPC stacks. It fits long-lived connections where pseudo-headers, authentication shape, cookies, user agents, and application metadata repeat across streams.',
        'Operators feel it through header-size limits, compression ratio, and invalid header-block errors. The practical tuning question is not whether HPACK exists, but whether high-cardinality metadata is churning the dynamic table.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HPACK fails as a performance tool when values rarely repeat. Large unique cookies, tracing baggage, nonce fields, and per-request signatures can evict useful entries and leave later requests larger than expected.',
        'It fails as a correctness tool if encoder and decoder state diverge. Bad size updates, invalid indexes, or wrong eviction order corrupt the meaning of future indexes, so decoders must reject malformed header blocks rather than guess.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume the dynamic table limit is 256 bytes. A cookie field with name length 6 and value length 58 costs 6 + 58 + 32 = 96 bytes, so the first request can insert it as a literal with incremental indexing.',
        'A later request can reference that cookie by dynamic index instead of sending 64 bytes of name and value again. If the encoder then inserts an accept-language field costing 150 bytes while the table holds authorization at 140 bytes and cookie at 96 bytes, the 386-byte total is too large, so the oldest entries are evicted until the table is at or below 256 bytes.',
        'The behavior is the lesson. The encoder saves bytes only while useful entries remain resident, and correctness holds only because the decoder performs the same insertion and eviction arithmetic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 7541 HPACK at https://datatracker.ietf.org/doc/html/rfc7541 and RFC 9113 HTTP/2 at https://datatracker.ietf.org/doc/html/rfc9113. Read the static table, dynamic table management, and header field representation sections before implementation work.',
        'Study QPACK Dynamic Table HTTP/3 next to see how QUIC changes blocking constraints. Then study Huffman Coding, Finite State Machines, Backpressure and Flow Control, and HTTP/3 over QUIC to connect compression state with transport behavior.',
      ],
    },
  ],
};
