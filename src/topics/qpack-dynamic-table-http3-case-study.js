// QPACK for HTTP/3: header compression with dynamic table instructions carried
// on independent QUIC streams.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'qpack-dynamic-table-http3-case-study',
  title: 'QPACK Dynamic Table HTTP/3',
  category: 'Systems',
  summary: 'QPACK adapts indexed header compression to HTTP/3 by separating encoder instructions, decoder acknowledgments, request field sections, and blocked-stream limits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encoder streams', 'blocking budget'], defaultValue: 'encoder streams' },
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

function qpackGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'headers', label: 'fields', x: 0.6, y: 4.0, note: notes.headers ?? 'HTTP' },
      { id: 'static', label: 'static', x: 2.2, y: 2.2, note: notes.static ?? 'fixed' },
      { id: 'dynamic', label: 'dyn', x: 2.2, y: 5.8, note: notes.dynamic ?? 'conn' },
      { id: 'encoder', label: 'enc', x: 4.15, y: 4.0, note: notes.encoder ?? 'choose' },
      { id: 'encstr', label: 'enc out', x: 6.35, y: 1.55, note: notes.encstr ?? 'inserts' },
      { id: 'reqstr', label: 'req', x: 6.55, y: 4.0, note: notes.reqstr ?? 'HEADERS' },
      { id: 'decstr', label: 'dec out', x: 6.35, y: 6.45, note: notes.decstr ?? 'acks' },
      { id: 'decoder', label: 'dec', x: 8.55, y: 4.0, note: notes.decoder ?? 'decode' },
      { id: 'app', label: 'app', x: 9.75, y: 4.0, note: notes.app ?? 'fields' },
    ],
    edges: [
      { id: 'e-headers-encoder', from: 'headers', to: 'encoder', weight: '' },
      { id: 'e-static-encoder', from: 'static', to: 'encoder', weight: '' },
      { id: 'e-dynamic-encoder', from: 'dynamic', to: 'encoder', weight: '' },
      { id: 'e-encoder-encstr', from: 'encoder', to: 'encstr', weight: 'ins' },
      { id: 'e-encoder-reqstr', from: 'encoder', to: 'reqstr', weight: '' },
      { id: 'e-decstr-encoder', from: 'decstr', to: 'encoder', weight: '' },
      { id: 'e-encstr-decoder', from: 'encstr', to: 'decoder', weight: 'ins' },
      { id: 'e-reqstr-decoder', from: 'reqstr', to: 'decoder', weight: '' },
      { id: 'e-decoder-decstr', from: 'decoder', to: 'decstr', weight: 'ack' },
      { id: 'e-decoder-app', from: 'decoder', to: 'app', weight: '' },
    ],
  }, { title });
}

function blockedGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'insert', label: 'insert', x: 0.8, y: 2.3, note: notes.insert ?? 'ic=7' },
      { id: 'loss', label: 'loss', x: 2.6, y: 2.3, note: notes.loss ?? 'late' },
      { id: 'reqA', label: 'req A', x: 2.6, y: 5.6, note: notes.reqA ?? 'RIC 7' },
      { id: 'decode', label: 'decode', x: 4.8, y: 4.0, note: notes.decode ?? 'need 7' },
      { id: 'blocked', label: 'blocked', x: 6.7, y: 4.0, note: notes.blocked ?? 'budget--' },
      { id: 'ack', label: 'ack', x: 8.3, y: 2.5, note: notes.ack ?? 'arrives' },
      { id: 'fields', label: 'fields', x: 8.3, y: 5.5, note: notes.fields ?? 'release' },
    ],
    edges: [
      { id: 'e-insert-loss', from: 'insert', to: 'loss', weight: 'lost' },
      { id: 'e-reqA-decode', from: 'reqA', to: 'decode', weight: 'headers' },
      { id: 'e-loss-decode', from: 'loss', to: 'decode', weight: 'missing' },
      { id: 'e-decode-blocked', from: 'decode', to: 'blocked', weight: 'wait' },
      { id: 'e-blocked-ack', from: 'blocked', to: 'ack', weight: 'later' },
      { id: 'e-ack-fields', from: 'ack', to: 'fields', weight: 'unblock' },
    ],
  }, { title });
}

function* encoderStreams() {
  yield {
    state: qpackGraph('QPACK separates table changes from requests'),
    highlight: { active: ['headers', 'static', 'dynamic', 'encoder', 'encstr', 'reqstr'], found: ['decoder'] },
    explanation: 'QPACK is HTTP/3 header compression. It keeps HPACK-like static and dynamic tables, but it moves dynamic-table instructions onto dedicated QUIC streams so request streams can be delivered independently.',
    invariant: 'A request can reference dynamic entries only when the decoder can prove those entries exist.',
  };

  yield {
    state: labelMatrix(
      'QPACK stream roles',
      [
        { id: 'enc', label: 'encoder' },
        { id: 'dec', label: 'decoder' },
        { id: 'req', label: 'request' },
        { id: 'ctrl', label: 'control' },
      ],
      [
        { id: 'dir', label: 'direction' },
        { id: 'job', label: 'job' },
      ],
      [
        ['uni', 'insert table'],
        ['uni', 'ack sections'],
        ['bidi', 'field section'],
        ['uni', 'SETTINGS'],
      ],
    ),
    highlight: { active: ['enc:job', 'dec:job', 'req:job'], compare: ['ctrl:job'] },
    explanation: 'The encoder stream carries Insert instructions. The decoder stream carries acknowledgments and cancellation signals. Request streams carry compressed field sections with enough prefix data to detect whether a dynamic reference is safe.',
  };

  yield {
    state: qpackGraph('First repeated header is inserted, then referenced', { headers: 'cookie', dynamic: 'add row', encstr: 'Insert', reqstr: 'RIC=1', decoder: 'lookup', app: 'cookie' }),
    highlight: { active: ['headers', 'dynamic', 'encoder', 'encstr', 'reqstr'], found: ['decoder', 'app'] },
    explanation: 'A repeated cookie can be inserted into the dynamic table on the encoder stream. A later request field section can reference it by index, but the field section prefix records the required insert count.',
  };

  yield {
    state: labelMatrix(
      'Field section prefix',
      [
        { id: 'ric', label: 'RIC' },
        { id: 'base', label: 'Base' },
        { id: 'refs', label: 'refs' },
        { id: 'lits', label: 'literals' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['needed count', 'block check'],
        ['anchor index', 'relative refs'],
        ['table indexes', 'save bytes'],
        ['raw fields', 'safe fallback'],
      ],
    ),
    highlight: { active: ['ric:why', 'base:why'], found: ['refs:why'], compare: ['lits:why'] },
    explanation: 'Required Insert Count is the safety gate. If the decoder has not processed enough dynamic-table inserts, it must block or reject the section rather than decode a reference to a nonexistent row.',
  };

  yield {
    state: qpackGraph('Decoder feedback lets the encoder take safer shortcuts', { decstr: 'SectionAck', dynamic: 'known', encoder: 'safe refs', reqstr: 'short', decoder: 'fast' }),
    highlight: { active: ['decoder', 'decstr', 'e-decoder-decstr', 'e-decstr-encoder'], found: ['encoder', 'reqstr'] },
    explanation: 'Decoder acknowledgments tell the encoder which field sections and table entries are known to have been processed. That feedback lets the encoder use dynamic references without guessing blindly.',
  };
}

function* blockingBudget() {
  yield {
    state: labelMatrix(
      'Blocked stream accounting',
      [
        { id: 'have5', label: 'have 5' },
        { id: 'reqA', label: 'req A' },
        { id: 'reqB', label: 'req B' },
        { id: 'limit', label: 'limit' },
      ],
      [
        { id: 'need', label: 'needs' },
        { id: 'status', label: 'status' },
      ],
      [
        ['IC <= 5', 'can decode'],
        ['RIC 7', 'blocked'],
        ['RIC 5', 'decode now'],
        ['max 2', 'budget guard'],
      ],
    ),
    highlight: { active: ['reqA:status', 'limit:status'], found: ['reqB:status'] },
    explanation: 'QPACK lets a decoder block a bounded number of streams while waiting for dynamic-table instructions. The setting is explicit because unbounded header blocking would become a memory and latency hazard.',
    invariant: 'Compression policy must respect the peer blocked-stream limit.',
  };

  yield {
    state: blockedGraph('A request can outrun the encoder stream'),
    highlight: { active: ['insert', 'loss', 'reqA', 'decode', 'blocked'], removed: ['e-insert-loss'], compare: ['ack'] },
    explanation: 'Because QUIC streams are independent, a request stream can arrive before the encoder stream bytes that create the referenced table entry. The decoder must wait until the insert count catches up.',
  };

  yield {
    state: labelMatrix(
      'Encoder policy choices',
      [
        { id: 'lit', label: 'literal' },
        { id: 'static', label: 'static ref' },
        { id: 'ackref', label: 'acked ref' },
        { id: 'riskref', label: 'risky ref' },
      ],
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'latency', label: 'latency' },
      ],
      [
        ['larger', 'never blocks'],
        ['small', 'never blocks'],
        ['small', 'safe'],
        ['smallest', 'may block'],
      ],
    ),
    highlight: { active: ['riskref:latency', 'lit:latency'], found: ['ackref:latency'] },
    explanation: 'QPACK is a policy problem, not just a codec. The encoder can spend more bytes to avoid blocking, or take dynamic-table references when feedback says the decoder is likely ready.',
  };

  yield {
    state: blockedGraph('When the missing insert arrives, the section unblocks', { loss: 'recovered', blocked: 'resume', ack: 'IC=7', fields: 'decoded' }),
    highlight: { active: ['ack', 'fields', 'e-ack-fields'], found: ['decode'], compare: ['blocked'] },
    explanation: 'Once the encoder-stream insert is processed, the decoder has the required dynamic entry and can decode the waiting field section. The application sees normal HTTP fields; the stall was compression-state ordering.',
  };

  yield {
    state: labelMatrix(
      'HPACK vs QPACK',
      [
        { id: 'state', label: 'table state' },
        { id: 'order', label: 'ordering' },
        { id: 'hol', label: 'HOL risk' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        { id: 'hpack', label: 'HPACK' },
        { id: 'qpack', label: 'QPACK' },
      ],
      [
        ['header blocks', 'encoder stream'],
        ['TCP order', 'QUIC streams'],
        ['TCP byte gap', 'header block'],
        ['table size', 'block limit'],
      ],
    ),
    highlight: { active: ['hol:hpack', 'hol:qpack'], found: ['guard:qpack'] },
    explanation: 'HPACK could rely on TCP order to keep table mutations synchronized. QPACK cannot assume one ordered byte stream, so it adds explicit insert counts, encoder and decoder streams, and a bounded blocking model.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encoder streams') yield* encoderStreams();
  else if (view === 'blocking budget') yield* blockingBudget();
  else throw new InputError('Pick a QPACK view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'QPACK is the header-compression format for HTTP/3. It preserves the core idea of HPACK, namely a static table, a dynamic table, and indexed field representations, but redesigns synchronization for QUIC stream multiplexing.',
        'The central data structure is still a bounded dynamic table. The protocol around it is different: encoder instructions mutate the table, request field sections reference entries, decoder feedback confirms progress, and blocked-stream limits cap how much a peer may wait on missing compression state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder stream sends dynamic-table instructions such as inserts. A request stream carries a field section prefix with Required Insert Count and Base, followed by literals or table references. If the decoder has processed enough inserts, it can decode immediately. If not, the stream may become blocked, subject to the peer limit.',
        'The decoder stream sends acknowledgments and cancellation signals back to the encoder. Those signals let the encoder know which entries are safe to reference and when dynamic-table capacity can be managed without keeping unnecessary state alive.',
      ],
    },
    {
      heading: 'Complete case study: repeated authorization headers',
      paragraphs: [
        'An API client sends many requests with the same authorization shape and cookie. The encoder inserts those fields into the dynamic table on the QPACK encoder stream. Later request streams use compact references instead of repeating the full values, reducing header bytes on the wire.',
        'If a request referencing a new table entry arrives before the encoder-stream insert, the decoder checks Required Insert Count and blocks that request stream. Other request streams that use static references, literals, or already-known dynamic entries can continue.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'QPACK improves compression for repeated headers without reintroducing TCP-level head-of-line blocking. The tradeoff is a more explicit state machine: insert counts, bases, relative indexes, stream acknowledgments, table capacity, eviction, and blocked-stream budgets.',
        'The safest encoder is not always the smallest encoder. A literal can be bigger but never blocks. A dynamic reference can be tiny but may stall if the decoder has not received the required insert. Good HTTP/3 stacks tune this policy for latency, memory, and byte savings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9204 QPACK at https://datatracker.ietf.org/doc/html/rfc9204, RFC 9114 HTTP/3 at https://datatracker.ietf.org/doc/html/rfc9114, and RFC 7541 HPACK at https://datatracker.ietf.org/doc/html/rfc7541. Study HTTP/3 over QUIC, HTTP/3 Priority Urgency Scheduler, HPACK Dynamic Table HTTP/2 Case Study, QUIC Transport Streams & Loss Recovery, Base-128 Varint & ZigZag Encoding, Huffman Coding, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
