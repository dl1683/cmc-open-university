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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the encoder-stream view as two kinds of traffic. Request streams carry HTTP field sections, while the QPACK encoder stream mutates the dynamic table. A dynamic table is a connection-local list of reusable header fields indexed by number.',
        'In the blocking-budget view, a blocked stream is a request stream waiting for table inserts it references. Required Insert Count is the minimum dynamic-table state needed before decoding is safe. The safe inference is simple: a decoder may use an indexed dynamic entry only after the insert that created it has been processed.',
        {type:'callout', text:'QPACK makes header compression safe over independent QUIC streams by separating table mutation state from request field sections.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP headers repeat. Methods, schemes, status codes, cookies, authorization shapes, content types, and cache controls often recur across many requests. Compression saves bytes by replacing repeated fields with indexes.',
        'HTTP/3 runs over QUIC, where streams are independent and can arrive out of order. HTTP/2 HPACK relied on one ordered TCP byte stream to keep table updates and header blocks synchronized. QPACK exists because HTTP/3 still wants dynamic compression without letting one late stream corrupt another stream.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reuse HPACK. Put common fields in a static table, insert repeated connection-specific fields into a dynamic table, and let later headers refer to table indexes. That is efficient when every header block and table update is processed in the same order.',
        'In HTTP/3, a request field section can arrive before the encoder-stream insert it references. If the decoder guessed, index 42 could mean the wrong field or no field at all. The old ordered-stream assumption is gone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is head-of-line independence. QUIC deliberately lets independent streams make progress even when another stream is delayed. A compression design that forces all requests to wait for one ordered header stream would throw away that transport benefit.',
        'At the same time, table references must stay exact. The decoder cannot decode a dynamic reference without knowing the entry. QPACK must allow bounded waiting for compression gains while preventing unbounded blocked streams and wrong decodes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate mutation from use. Inserts and capacity changes travel on the QPACK encoder stream. Request streams carry field sections with a prefix that names the table state they require. The decoder stream sends acknowledgments so the encoder can learn what the peer has processed.',
        'The invariant is that references are safe only after the dependent table state exists at the decoder. Required Insert Count, Base, acknowledgments, and blocked-stream limits are protocol machinery around that one rule.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder chooses between literals, static-table references, and dynamic-table references. Literals are larger but never depend on dynamic state. Dynamic references are smaller for repeated connection-specific fields, but they can block if the insert has not arrived.',
        'A field section includes the table state needed to decode it. If the decoder has processed enough inserts, it decodes immediately. If not, it can block the stream within the advertised limit, then resume after the encoder-stream bytes arrive.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'QPACK is correct because the decoder never guesses the dynamic table. When required state is present, an index resolves under shared rules to one table entry. When required state is missing, the decoder waits or rejects rather than inventing a value.',
        'Feedback makes table lifetime safe. Section acknowledgments and insert count increments tell the encoder which entries are known and which references are still risky. Stream cancellation prevents the encoder from waiting forever for a request section that no longer matters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The byte savings trade against latency risk and memory. A literal may spend 80 bytes now and never block. A dynamic reference may spend a few bytes later but can stall a request if the needed insert is delayed. Doubling repeated requests increases savings only if the table entries stay useful and the peer keeps up.',
        'Implementation complexity is real. Both endpoints track insert counts, relative indexes, table capacity, eviction, acknowledgments, cancellations, and blocked-stream limits under packet loss. The codec is not just compression; it is distributed state management on one connection.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'QPACK wins on long-lived HTTP/3 connections with repeated medium-size headers. Browsers, API clients, CDNs, service meshes, and mobile apps often resend cookies, authorization shapes, content negotiation fields, and cache metadata.',
        'It is most useful when the peer advertises enough dynamic table capacity and blocked-stream budget to justify risk. Conservative encoders can start with literals and static references, then use dynamic references after feedback shows the peer is processing inserts promptly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when headers are mostly one-off or high-cardinality. Filling the table with values that will not repeat wastes memory and may evict useful entries. Literal encoding can be better for unique request metadata.',
        'It also fails as a latency optimization when byte savings create critical-path blocking. A tiny dynamic reference that stalls authentication headers can be worse than a larger literal. Sensitive fields need policy too, because compression can interact with size-based side channels.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client sends 100 requests on one HTTP/3 connection. Each request repeats an authorization header of 900 bytes and a cookie of 600 bytes. If QPACK inserts those two fields once, later requests may replace about 1500 literal bytes with small indexed references, saving roughly 148000 bytes across 99 later requests before overhead.',
        'Now assume request 12 references an insert with Required Insert Count 5, but the decoder has processed only 4 inserts because the encoder stream packet was delayed. That request blocks. If the blocked-stream limit is 2 and two other requests are already blocked, the encoder must choose safer literals or risk violating the peer budget.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9204 for QPACK, RFC 9114 for HTTP/3, and RFC 7541 for HPACK. These specifications define the table-state contract and the predecessor design.',
        'Study HTTP/3 over QUIC, QUIC streams and loss recovery, HPACK, Huffman coding, varints, backpressure, and flow control next. The transferable lesson is that compression over independent streams needs explicit dependency state.',
      ],
    },
  ],
};
