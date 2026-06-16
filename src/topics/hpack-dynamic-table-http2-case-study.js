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
      heading: 'What it is',
      paragraphs: [
        'HPACK is the header-compression format used by HTTP/2. HTTP fields repeat heavily: methods, schemes, content types, cookies, authorization shapes, user agents, and application metadata often recur across requests on the same connection. HPACK compresses those fields using a predefined static table, a per-connection dynamic table, integer encodings, string encodings, and indexed references.',
        'The dynamic table is the data structure worth studying. It is a bounded, ordered table shared by encoder and decoder. The encoder inserts useful repeated headers. The decoder replays the same insertions and evictions from the encoded instructions so indexes mean the same thing on both sides.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The static table contains common headers and values. The dynamic table starts empty and is updated over the life of the connection. A header can be encoded as an index, as a literal with incremental indexing, as a literal without indexing, or as a literal that should never be indexed. This lets the encoder trade compression against memory, churn, and privacy risk.',
        'New dynamic entries are inserted at the front. Old entries are evicted from the end when capacity is exceeded. HPACK entry size includes the name length, value length, and fixed overhead. HTTP/2 peers can change the allowed table size with SETTINGS_HEADER_TABLE_SIZE, and the header block must carry a table-size update so both sides evict consistently.',
      ],
    },
    {
      heading: 'Complete case study: repeated API headers',
      paragraphs: [
        'A browser opens one HTTP/2 connection to api.example.com. The first request sends :method and :scheme by static-table index, then sends authorization and cookie as literals with incremental indexing. The decoder inserts those entries into its dynamic table. The next request on the same connection sends the same authorization and cookie values as indexes, shrinking the header block dramatically.',
        'Later, a large accept-language value is indexed. The table exceeds its capacity, so older entries are evicted from the end. If the cookie entry is evicted, the following request cannot reference it by index and must send it again as a literal. The compression result depends on recency and table pressure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HPACK saves bytes and improves request latency, especially when many requests share one HTTP/2 connection. The cost is synchronized mutable state. Encoder and decoder must agree exactly on table updates, index meanings, and size changes. Sensitive fields should not be indexed casually because a dynamic table can expose repetition patterns and state interactions.',
        'HTTP/2 still runs over TCP, so HPACK does not remove TCP head-of-line blocking. It compresses header frames; it does not solve transport loss, server admission, or application backpressure. QPACK Dynamic Table HTTP/3 is the follow-up that redesigns header compression for QUIC streams.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 7541 HPACK at https://datatracker.ietf.org/doc/html/rfc7541 and RFC 9113 HTTP/2 at https://datatracker.ietf.org/doc/rfc9113/. Study Base-128 Varint & ZigZag Encoding, Huffman Coding, Finite State Machine, CDN Request Flow, TCP Listen Backlog & Accept Queue, TCP: Handshake & Congestion Control, Backpressure & Flow Control, HTTP/3 over QUIC, and QPACK Dynamic Table HTTP/3 next.',
      ],
    },
  ],
};
