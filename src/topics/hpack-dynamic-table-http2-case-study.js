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
      heading: 'The problem',
      paragraphs: [
        'HTTP headers repeat heavily. A browser or gRPC client may send the same `:method`, `:scheme`, `:authority`, cookies, content negotiation, authorization shape, user agent, and application metadata across many requests on one HTTP/2 connection.',
        'Sending that text again and again wastes bytes, but plain generic compression is awkward for a multiplexed protocol. The decoder needs to understand each header block independently enough to route streams correctly, while the connection still wants to exploit repetition over time. HPACK solves that by turning repeated header fields into shared table indexes.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'HTTP/1.x mostly treats headers as repeated textual fields. HTTP/2 changes the framing model: many streams share one connection, and each stream carries compact header blocks. That shared connection is exactly where repeated header state becomes useful.',
        'HPACK is the header-compression layer for HTTP/2. It uses a fixed static table for common names and values, a per-connection dynamic table for fields learned during the connection, integer encodings, optional Huffman coding for strings, and strict rules that keep the encoder and decoder tables synchronized.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to send headers as plain text on every request. That is easy to debug and stateless, but it wastes bytes when the same connection repeats the same fields across many streams.',
        'A second obvious approach is generic compression over the connection. The wall is HTTP/2 multiplexing and security: header blocks must be decoded in a controlled stream protocol, and compression state has to be bounded, deterministic, and careful with sensitive values. HPACK is a purpose-built compromise: indexed header fields with strict dynamic-table rules.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'The core idea is shared indexed state. The static table is predefined by the specification. The dynamic table is built by the header blocks themselves. When the encoder sends a literal with incremental indexing, the decoder inserts the same field into its own dynamic table.',
        'After that, a later header block can say "use index 62" instead of repeating the name and value. This is why HPACK is not just a byte codec. It is a synchronized state machine where compression wins come from both endpoints replaying the same table updates in the same order.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'An encoded header field can be an indexed representation, a literal with incremental indexing, a literal without indexing, or a literal that must never be indexed. Indexed representation is cheapest, but it only works when the field already exists in the static or dynamic table. Literal with indexing costs more now but may save bytes later.',
        'Dynamic entries are inserted at the front. In HPACK, the static table has 61 entries, so the newest dynamic entry starts at index 62 and older dynamic entries shift to larger indexes. Entry size is name length plus value length plus 32 bytes of overhead. When the table would exceed its maximum size, old entries are evicted from the end until the table fits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the first request on an HTTP/2 connection sends `:method: GET` and `:scheme: https`. Those can use the static table. It also sends a cookie that is likely to repeat. The encoder sends the cookie as a literal with incremental indexing. The decoder reads that instruction and inserts the same cookie entry into its dynamic table.',
        'On the next request, the same cookie can be sent as a dynamic-table index instead of as a full name and value. Later, a large `accept-language` value is indexed. If the dynamic table is already near capacity, that insertion evicts older entries from the tail. If the cookie was evicted, the next request cannot reference it by index anymore and must send it again as a literal.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'HPACK works because the header block is also an update log for decoder state. When the encoder indexes a literal, the decoder applies the same insertion. When capacity is exceeded, both sides evict using the same tail-removal rule. When a dynamic table size update appears, both sides shrink to the same bound.',
        'The invariant is exact table agreement. An index is meaningful only if both endpoints map that index to the same header field at that moment in the connection. If the decoder missed one insertion or eviction, every later dynamic index could decode to the wrong field.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the indexed-header-block view, read the graph as a round trip of shared meaning. Raw headers enter the encoder. The encoder chooses between static entries, dynamic entries, and literals. The header block crosses the connection, and the decoder rebuilds the same table state before handing headers to HTTP/2.',
        'In the dynamic-table-eviction view, focus on the table as a bounded recency structure. New entries go to the front, old entries leave from the end, and the decoder mirrors the same movement. The eviction frames are the hidden cost of compression: a large or low-value insertion can push out entries that would have saved more bytes later.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'HPACK saves bandwidth and can reduce latency when many header blocks share values. It is strongest on long-lived HTTP/2 connections with stable pseudo-headers, common response headers, repeated cookies, gRPC metadata, and predictable application headers.',
        'The cost is synchronized mutable state, bounded memory, eviction churn, and privacy-sensitive policy choices. Indexing every header is not optimal. One-off values waste table space, high-cardinality values churn the table, and sensitive values can reveal repetition patterns or interact with compression side channels.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'HPACK does not solve transport loss, server admission, flow control, or application backpressure. HTTP/2 still runs over TCP, so packet loss can affect every stream on the connection. Header compression saves bytes, but it does not make the transport independent per stream.',
        'HPACK also becomes less useful when headers are one-off, too large, highly sensitive, or too high-cardinality for the dynamic table. The dynamic table is per connection, so new connections start cold. HTTP/3 uses QPACK instead because QUIC changes the stream and head-of-line-blocking constraints.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A correctness failure means encoder and decoder state diverged. That can happen if an implementation mishandles a table-size update, evicts the wrong entry, accepts an invalid index, or applies header blocks out of the strict order required for the connection. Once state diverges, compact indexes become dangerous because they silently point at different fields.',
        'A performance failure is more common: the dynamic table is filled with values that never repeat, or large values evict smaller useful ones. A security failure comes from indexing values that should have used never-indexed representation, especially secrets whose repetition or length should not become observable through compression behavior.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'In practice, most application developers meet HPACK through HTTP/2 libraries and proxies rather than hand-written encoders. The useful operational skill is recognizing header behavior: stable repeated metadata compresses well, rapidly changing cookies or tracing baggage may churn, and oversized headers still hurt even when compression exists.',
        'For protocol implementers, test table synchronization aggressively. Include cold connections, repeated headers, large insertions, table-size reductions, zero-size tables, invalid indexes, never-indexed literals, and interleaved streams. The decoder should be strict because lenient state machines can turn one bad block into persistent connection corruption.',
        'For operators, watch header size, dynamic table size, compression ratio, invalid header-block errors, and high-cardinality metadata. A small tracing or cookie change can shift the table from useful repetition to constant eviction churn.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 7541 HPACK at https://datatracker.ietf.org/doc/html/rfc7541 and RFC 9113 HTTP/2 at https://datatracker.ietf.org/doc/rfc9113/. RFC 7541 section 2 defines the static and dynamic tables, section 4 defines dynamic table management, and section 6 defines header field representations.',
        'Study Base-128 Varint & ZigZag Encoding, Huffman Coding, Finite State Machine, CDN Request Flow, TCP Listen Backlog & Accept Queue, TCP: Handshake & Congestion Control, Backpressure & Flow Control, HTTP/3 over QUIC, and QPACK Dynamic Table HTTP/3 next.',
      ],
    },
  ],
};
