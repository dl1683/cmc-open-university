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
      heading: 'Why this exists',
      paragraphs: [
        'HTTP requests repeat a lot of header fields. Methods, schemes, status codes, content types, cookies, authorization shapes, cache controls, and user-agent prefixes recur across many requests. Sending those fields literally every time wastes bytes and slows down the start of work.',
        'QPACK exists because HTTP/3 still needs indexed header compression, but HTTP/3 no longer has one ordered TCP byte stream. HPACK used that order to keep the encoder and decoder dynamic tables synchronized. QUIC streams can arrive independently, so a request can outrun the table update it references.',
        {type:'callout', text:'QPACK makes header compression safe over independent QUIC streams by separating table mutation state from request field sections.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reuse HPACK from HTTP/2. HPACK has a static table for common fields and a dynamic table for repeated connection-specific fields. A later header block can say "use entry 42" instead of repeating the whole field.',
        'That works when both endpoints process one ordered stream of header blocks and table mutations. In HTTP/3, request streams are independent. If a request field section arrives before the encoder-stream bytes that insert entry 42, the decoder cannot safely know what entry 42 means.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'QPACK separates the compressed field section from the dynamic-table mutation log. The encoder stream mutates the table. Request streams carry field sections. The decoder stream reports which sections and inserts have been processed. The field section prefix says how much table state is required before decoding is safe.',
        'The core invariant is simple: a decoder may use a dynamic reference only after it has processed the insert that created that entry. Required Insert Count, Base, acknowledgments, and blocked-stream limits exist to preserve that invariant without forcing every request stream to wait for every other request stream.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The encoder-stream view shows compression state as its own ordered log. Dynamic-table inserts must be processed before any field section that references them. A request stream can arrive early, but it cannot safely decode a reference to a table entry it has not seen.',
        'The blocking-budget view shows the safety valve. QPACK allows bounded waiting because byte savings matter, but it makes the bound explicit so compression cannot turn into unbounded application latency and memory growth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder chooses among literals, static-table references, and dynamic-table references. Inserts travel on the QPACK encoder stream. A request field section carries Required Insert Count and Base, then literals or indexed references relative to that base.',
        'If the decoder has processed enough inserts, it decodes immediately. If not, it may block that request stream, but only within the peer advertised blocked-stream limit. The decoder stream then sends Section Acknowledgment, Stream Cancellation, and Insert Count Increment signals so the encoder can manage risk and table lifetime.',
        'An API client with repeated authorization and cookie fields is the normal win. The first request may send literals or insert table entries. Later requests use compact references. If one request references an insert that is late, only that request waits; other field sections that use literals, static entries, or already-known dynamic entries can continue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'QPACK is correct because the decoder never guesses table state. Required Insert Count defines the minimum insert count needed by a field section. Base anchors relative indexes. Decoder feedback tells the encoder which dynamic entries are safe to reuse or evict.',
        'When the required state is present, an index resolves to one table entry under the shared indexing rules. When the state is missing, the decoder blocks or rejects instead of decoding the wrong field. The protocol trades some latency risk for a precise synchronization contract.',
        'This is the same broad systems move as a replicated log: references are safe only after the dependent state is known to exist. QPACK uses smaller protocol machinery than a database log, but the reasoning is familiar. Do not consume a reference until the state that gives it meaning has arrived.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'QPACK can save many bytes when headers repeat, but the dynamic table costs memory and bookkeeping on both endpoints. Inserts, relative indexes, capacity changes, acknowledgments, cancellations, and eviction all have to stay consistent under packet loss and stream reordering.',
        'The encoder policy decides the latency tradeoff. A literal is larger but never blocks. A static reference is small and safe when the field is in the static table. A dynamic reference is smallest for repeated connection-specific fields, but it can stall if the insert has not arrived. When the request count doubles, the byte savings can compound, but so can blocked-stream pressure if the encoder is too aggressive.',
      ],
    },
    {
      heading: 'Incident review',
      paragraphs: [
        'A practical QPACK incident starts with an HTTP/3 service that shows request latency spikes without matching backend work. The transport is alive, but some request streams are blocked waiting for dynamic-table inserts on the encoder stream. The fix may be to reduce risky dynamic references, lower table capacity, use literals for critical fields, or tune the blocked-stream limit.',
        'The diagnostic question is precise: which field section required which insert count, had the decoder processed that insert, and did encoder feedback justify the reference? That review keeps teams from blaming QUIC generally when the actual problem is a compression-state ordering choice.',
      ],
    },
    {
      heading: 'Deployment review',
      paragraphs: [
        'A deployment review should separate three policies: what may be indexed, when a dynamic reference is worth the blocking risk, and how much blocked-stream budget the peer is allowed to consume. Those are different decisions. A field can be safe to compress but still not worth referencing on a latency-critical request.',
        'Good telemetry reports dynamic-table capacity, insert count progress, blocked streams, encoder-stream loss, decoder acknowledgments, and fallback to literals. Without those signals, operators see only application latency and miss the compression-state cause.',
        'A conservative encoder can start with literals and static references, then use dynamic references only after feedback shows that the peer is processing inserts promptly. That policy spends a few more bytes early to avoid turning connection warm-up into a latency trap.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'QPACK wins for repeated, medium-to-large header sets on long-lived HTTP/3 connections. API clients, browser sessions, service meshes, and CDN-to-origin traffic often repeat cookies, authorization shapes, content negotiation fields, and cache metadata.',
        'It is especially useful when bandwidth or round-trip startup cost matters and the peer has signaled enough dynamic table capacity and blocked-stream budget to make references worthwhile.',
        'The best wins come from stable, repeated fields whose byte savings recur across many requests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'QPACK is weak when headers are mostly one-off, high-cardinality, or sensitive enough that compression is disabled or constrained. Literal encoding can be better than filling a table with entries that will not repeat.',
        'It also fails as a latency optimization when the encoder chases byte savings beyond the peer budget. A tiny dynamic reference that blocks a request on the critical path can be worse than a larger literal that the application can process immediately.',
        'Sensitive fields also need care. Compression can interact with side-channel risk when attackers can influence plaintext and observe sizes. QPACK is a codec, not a security policy; applications and intermediaries still decide which fields should be indexed, never indexed, or sent literally.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9204 QPACK at https://datatracker.ietf.org/doc/html/rfc9204, RFC 9114 HTTP/3 at https://datatracker.ietf.org/doc/html/rfc9114, and RFC 7541 HPACK at https://datatracker.ietf.org/doc/html/rfc7541. Study HTTP/3 over QUIC for the transport constraint, HTTP/3 Priority Urgency Scheduler for request scheduling, HPACK Dynamic Table HTTP/2 Case Study for the predecessor design, QUIC Transport Streams & Loss Recovery for stream ordering, Base-128 Varint & ZigZag Encoding and Huffman Coding for compact encodings, and Backpressure & Flow Control for bounded waiting.',
      ],
    },
  ],
};
