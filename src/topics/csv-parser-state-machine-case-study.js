// CSV parsing: commas, CRLF rows, quoted fields, doubled quotes, and streaming
// output as a practical finite-state machine.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'csv-parser-state-machine-case-study',
  title: 'CSV Parser State Machine Case Study',
  category: 'Concepts',
  summary: 'CSV looks simple until quotes appear: a parser needs explicit states for field start, unquoted field, quoted field, quote escape, delimiter, and row end.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['quoted fields', 'streaming rows'], defaultValue: 'quoted fields' },
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

function csvGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.8, y: 4.0, note: notes.start ?? 'new field' },
      { id: 'plain', label: 'plain', x: 2.7, y: 2.5, note: notes.plain ?? 'chars' },
      { id: 'quoted', label: 'quoted', x: 2.7, y: 5.6, note: notes.quoted ?? 'any char' },
      { id: 'quote', label: 'quote', x: 4.8, y: 5.6, note: notes.quote ?? 'maybe end' },
      { id: 'field', label: 'field', x: 6.7, y: 4.0, note: notes.field ?? 'emit value' },
      { id: 'row', label: 'row', x: 8.6, y: 4.0, note: notes.row ?? 'emit row' },
    ],
    edges: [
      { id: 'e-start-plain', from: 'start', to: 'plain', weight: '' },
      { id: 'e-start-quoted', from: 'start', to: 'quoted', weight: '' },
      { id: 'e-quoted-quote', from: 'quoted', to: 'quote', weight: '' },
      { id: 'e-quote-quoted', from: 'quote', to: 'quoted', weight: '' },
      { id: 'e-plain-field', from: 'plain', to: 'field', weight: '' },
      { id: 'e-quote-field', from: 'quote', to: 'field', weight: '' },
      { id: 'e-field-row', from: 'field', to: 'row', weight: '' },
      { id: 'e-field-start', from: 'field', to: 'start', weight: '' },
    ],
  }, { title });
}

function* quotedFields() {
  yield {
    state: csvGraph('CSV needs state because comma sometimes means data'),
    highlight: { active: ['start', 'quoted', 'quote'], found: ['field'] },
    explanation: 'A comma outside quotes ends a field. A comma inside quotes is ordinary data. That single distinction is why a CSV parser is a state machine, not string.split(",").',
    invariant: 'Delimiter meaning depends on parser state.',
  };

  yield {
    state: labelMatrix(
      'Parsing Ada,\"Lovelace, A.\",42',
      [
        { id: 'ada', label: 'Ada' },
        { id: 'comma1', label: 'comma' },
        { id: 'quote1', label: 'open quote' },
        { id: 'inside', label: 'Lovelace, A.' },
        { id: 'quote2', label: 'close quote' },
        { id: 'age', label: '42' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['plain', 'append to field'],
        ['plain', 'emit Ada'],
        ['start', 'enter quoted'],
        ['quoted', 'comma is data'],
        ['quote', 'maybe field end'],
        ['plain', 'emit 42'],
      ],
    ),
    highlight: { active: ['inside:state', 'inside:effect'], found: ['comma1:effect'] },
    explanation: 'The comma after Ada is a delimiter because the parser is in plain state. The comma inside Lovelace, A. is data because the parser is in quoted state.',
  };

  yield {
    state: csvGraph('A quote inside a quoted field is ambiguous until the next byte', { quote: 'end or ""', field: 'after comma' }),
    highlight: { active: ['quoted', 'quote', 'e-quoted-quote'], compare: ['e-quote-quoted', 'e-quote-field'] },
    explanation: 'When a quote appears inside a quoted field, it could close the field or it could be the first half of a doubled quote. The next byte decides.',
  };

  yield {
    state: labelMatrix(
      'Quote handling',
      [
        { id: 'double', label: '\"\" inside quotes' },
        { id: 'comma', label: '\", after quotes' },
        { id: 'crlf', label: '\" CRLF' },
        { id: 'bad', label: '\" text' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'next', label: 'next state' },
      ],
      [
        ['literal quote', 'quoted'],
        ['field ended', 'start'],
        ['row ended', 'row'],
        ['format error', 'reject'],
      ],
    ),
    highlight: { active: ['double:meaning', 'comma:next'], removed: ['bad:meaning'] },
    explanation: 'RFC-style CSV escapes quotes by doubling them. After a closing quote, a parser expects comma, record end, or file end. Other text is not just weird; it is malformed.',
  };

  yield {
    state: csvGraph('The state machine emits fields and rows incrementally', { start: 'field start', field: 'value', row: 'record' }),
    highlight: { active: ['field', 'row', 'e-field-row', 'e-field-start'], found: ['start'] },
    explanation: 'The parser does not need to load the whole file. It can stream bytes, append characters to the current field, emit each field, then emit each row.',
  };
}

function* streamingRows() {
  yield {
    state: labelMatrix(
      'Streaming parser registers',
      [
        { id: 'state', label: 'state' },
        { id: 'field', label: 'field buffer' },
        { id: 'row', label: 'row array' },
        { id: 'line', label: 'line/byte pos' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why keep it' },
      ],
      [
        ['plain/quoted/etc', 'interpret next char'],
        ['current field text', 'emit on delimiter'],
        ['fields so far', 'emit on row end'],
        ['location', 'good errors'],
      ],
    ),
    highlight: { active: ['state:stores', 'field:stores'], found: ['line:why'] },
    explanation: 'A streaming CSV parser is tiny but stateful: current state, current field buffer, current row, and source position for diagnostics.',
  };

  yield {
    state: csvGraph('CRLF ends a row only outside quotes', { plain: 'CRLF ends', quoted: 'CRLF data', row: 'emit' }),
    highlight: { active: ['plain', 'quoted', 'row'], compare: ['e-field-row'] },
    explanation: 'A newline inside a quoted field is part of the field. A newline outside quotes ends the record. Again the delimiter meaning depends on state.',
  };

  yield {
    state: labelMatrix(
      'Batch versus streaming CSV ingestion',
      [
        { id: 'all', label: 'read all' },
        { id: 'row', label: 'row stream' },
        { id: 'chunk', label: 'chunk stream' },
        { id: 'worker', label: 'web worker' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'fit', label: 'best fit' },
      ],
      [
        ['whole file', 'small local files'],
        ['one row', 'ETL pipelines'],
        ['field may span chunks', 'large uploads'],
        ['separate thread', 'browser UI stays live'],
      ],
    ),
    highlight: { active: ['chunk:memory', 'worker:fit'], compare: ['all:memory'] },
    explanation: 'Chunk streaming adds one subtlety: a quoted field can span chunk boundaries. That is exactly why explicit parser state is better than per-chunk splitting.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'split', label: 'split comma' },
        { id: 'newline', label: 'split newline' },
        { id: 'quote', label: 'bad quote' },
        { id: 'arity', label: 'ragged row' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'symptom', label: 'symptom' },
      ],
      [
        ['ignores quoted comma', 'extra columns'],
        ['ignores quoted CRLF', 'row breaks early'],
        ['accepts invalid quote', 'silent corruption'],
        ['wrong field count', 'schema mismatch'],
      ],
    ),
    highlight: { active: ['split:bug', 'newline:bug'], removed: ['quote:bug'] },
    explanation: 'CSV failures are usually silent data corruption. A strict parser should surface malformed quotes and row-shape mismatches instead of producing plausible wrong rows.',
  };

  yield {
    state: csvGraph('CSV parsing is the practical face of finite state machines', { start: 'state', quoted: 'mode', field: 'emit', row: 'batch' }),
    highlight: { active: ['start', 'plain', 'quoted', 'quote'], found: ['field', 'row'] },
    explanation: 'Finite-state machines become concrete when every byte in a messy file format has to mean exactly one thing. CSV is the compact production example.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'quoted fields') yield* quotedFields();
  else if (view === 'streaming rows') yield* streamingRows();
  else throw new InputError('Pick a CSV parser view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'CSV is a record format built from fields, delimiters, record separators, and optional quoting. It looks like a comma split until a field contains a comma, a quote, or a newline. A correct parser needs states: at field start, inside an unquoted field, inside a quoted field, just after a quote, at field end, and at row end.',
        'The data structure is small: a transition table plus buffers for the current field and current row. The operational value is large because CSV often sits at the boundary between spreadsheets, data warehouses, scripts, uploads, and ETL systems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At field start, a quote enters quoted mode, a comma emits an empty field, a newline emits the row, and ordinary text starts an unquoted field. In unquoted mode, comma and row end delimit the field. In quoted mode, comma and newline are data. A quote in quoted mode moves to a special after-quote state, where the next byte decides whether the quote was doubled or closed the field.',
        'That after-quote state is the difference between correctness and accidental parsing. Two quotes inside a quoted field produce one literal quote. A comma after a closing quote ends the field. A record separator after a closing quote ends the row. Other text is malformed under strict CSV rules.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For Ada,\"Lovelace, A.\",42, the parser reads Ada in plain state and emits it at the first comma. The opening quote moves into quoted state. The comma in Lovelace, A. is appended to the field instead of ending it. The closing quote moves to after-quote state, the following comma emits the field, and 42 becomes the final field.',
        'In a browser upload, the parser should run in a worker when files are large. The worker can stream chunks, keep parser state across chunk boundaries, emit rows incrementally, and keep the UI thread responsive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parsing is O(n) over input bytes or characters and needs only bounded parser state plus the current field and row. The expensive part is not the transition table; it is allocation, decoding, validation, type conversion, schema checks, error reporting, and moving large row batches through the rest of the pipeline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 4180, Common Format and MIME Type for CSV Files, at https://www.rfc-editor.org/rfc/rfc4180. Study UTF-8 Decoder DFA, JSON Parser Stack, Parser Design Patterns Primer, Finite State Machines, Web Workers, DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
