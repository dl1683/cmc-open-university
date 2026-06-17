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
      heading: 'Why this exists',
      paragraphs: [
        'CSV looks like the simplest format in the world until real data arrives. Names contain commas. Notes contain newlines. Quotes appear inside quoted fields. Export tools disagree about dialect details. A parser that works for clean demo rows can silently corrupt production data.',
        'The important idea is that the same character can mean different things depending on parser state. A comma outside quotes ends a field. A comma inside quotes is data. A newline outside quotes ends a record. A newline inside quotes is data. A quote inside a quoted field may close the field, or it may be the first half of an escaped quote.',
        'That makes CSV a practical finite-state machine. The states are small, but the consequences matter because CSV is used at the boundary between spreadsheets, databases, ETL jobs, uploads, analytics tools, and finance workflows.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is line.split(","). It works for toy rows and fails on the first field like "Lovelace, A." or the first address split across lines. The failure can be silent: the row still has strings in it, just in the wrong columns.',
        'A slightly less naive approach is to split lines first and then parse fields. That also fails because quoted fields can contain line breaks. The parser cannot decide where a record ends until it knows whether it is currently inside a quoted field.',
        'The wall is delimiter meaning. Delimiters do not have fixed meaning by character alone. They get meaning from state. That is why a CSV parser should be designed as a state machine instead of a sequence of string splits.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the quoted-fields view, watch the parser state more than the characters. The comma after Ada emits a field because the parser is in plain mode. The comma inside "Lovelace, A." is appended because the parser is in quoted mode. The same byte gets a different interpretation because the state changed.',
        'The quote-handling frames show the hardest edge. After a quote inside a quoted field, the parser must wait for the next character. Another quote means a literal quote. A comma means field end. A record separator means row end. Ordinary text means the input is malformed under strict CSV rules.',
        'In the streaming-rows view, focus on what has to survive across chunk boundaries: current state, current field buffer, current row, and source position. That is enough to parse a giant file without reading it all into memory.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At field start, the parser has not committed to a mode. A quote enters quoted mode. A comma emits an empty field. A row separator emits the row. Ordinary text starts an unquoted field.',
        'In unquoted mode, ordinary characters are appended to the current field until a comma or row separator arrives. In quoted mode, almost everything is data, including commas and row separators. A quote moves to an after-quote state because the parser cannot yet tell whether the quote is an escape or the end of the quoted field.',
        'The after-quote state resolves the ambiguity. A second quote appends one literal quote and returns to quoted mode. A comma emits the field and starts the next one. A record separator emits the field and row. End of file ends the final field. Anything else should usually be rejected rather than guessed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CSV has bounded memory in its grammar. There is no recursive nesting like JSON arrays inside arrays. The parser only needs the current mode, the current field, the row being built, and a position for useful error messages.',
        'That bounded state is why streaming is natural. If a chunk ends in the middle of a quoted field, the parser simply keeps quoted mode and continues when the next chunk arrives. If a chunk ends after a single quote, the parser keeps the after-quote state until it can inspect the next byte.',
        'The result is O(n) parsing with memory proportional to the current field and row, not the whole file.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the row Ada,"Lovelace, A.",42. The parser starts a plain field with Ada and emits it at the first comma. The opening quote moves into quoted mode. The text Lovelace, A. is appended exactly as data, including the comma. The closing quote moves to after-quote mode. The following comma confirms the quoted field is complete. The final 42 is read as the last field.',
        'Now take "line one\nline two",ok. A line-first parser breaks this record in half. A state-machine parser keeps quoted mode across the newline, appends it to the field, and emits the row only after the closing quote and the following delimiter or row end.',
        'For escaped quotes, "She said ""hi""" becomes She said "hi". The doubled quote is not a string terminator; it is an encoded literal quote because it occurs in quoted mode and is followed by another quote.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The transition logic is cheap: one pass over the input. The expensive parts in production are usually allocation, Unicode decoding, type conversion, validation, batching, schema enforcement, and moving rows into downstream systems.',
        'A parser that emits one object per row may spend more time allocating than parsing. A high-throughput ingestion pipeline may batch rows, reuse buffers, or write into columnar builders. The state machine is still the correctness layer underneath those performance choices.',
      ],
    },
    {
      heading: 'Dialect policy',
      paragraphs: [
        'A production parser needs an explicit dialect contract. Decide the delimiter, quote character, escape rule, line ending policy, header behavior, empty-field meaning, trimming behavior, maximum field size, and whether malformed quotes are rejected or tolerated. Put those choices in configuration instead of scattering guesses through downstream import code.',
        'That policy matters because CSV often crosses organizational boundaries. A finance export, spreadsheet upload, warehouse copy command, and browser import widget may all say CSV while accepting different edge cases. The parser should make the disagreement visible early, before a row is loaded into the wrong columns and treated as valid business data.',
        'The same policy should be recorded with import jobs. Six months later, a team should be able to tell whether a file was parsed as strict RFC-style CSV, a spreadsheet-flavored dialect, or a partner-specific variant. Without that record, debugging a bad import turns into archaeology.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A state-machine CSV parser wins for uploads, ETL, spreadsheet interchange, data migrations, and streaming ingestion. It is especially useful when the file can be large, rows can contain embedded newlines, and parsing must report precise errors instead of failing somewhere downstream.',
        'It also wins as a teaching example because it shows the real value of finite-state machines. The theory is not abstract here; each state prevents a specific class of data corruption.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The parser does not solve schema. CSV gives fields and rows, not types, required columns, date formats, null policy, encoding guarantees, or semantic validation. Those checks belong above the parser.',
        'CSV dialects also vary. Some systems use semicolons, some allow backslash escapes, some tolerate unquoted quotes, and some handle trailing delimiters differently. A serious parser should make dialect policy explicit instead of silently accepting everything.',
        'If the input is hostile or untrusted, error behavior matters. A parser should cap field size, row size, and total bytes where appropriate, or one enormous quoted field can become a memory attack.',
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
