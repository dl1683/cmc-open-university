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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a stream of bytes plus a small memory cell called state. State means the parser\'s current interpretation mode: field start, unquoted field, quoted field, or after quote. Active characters are the bytes being inspected, and found fields are values that have become safe to emit.',
        'The safe inference rule is simple. A comma ends a field only when the state is not quoted field. The same comma inside quoted field is ordinary data, so the visual color change is the proof that delimiter meaning comes from state.',
        {type:'callout', text:'CSV parsing is a state problem: delimiters only become structure after the parser knows whether it is inside a quoted field.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9e/Turnstile_state_machine_colored.svg', alt:'State diagram with Locked and Unlocked states and coin and push transitions.', caption:'State-machine transition diagram. Source: Wikimedia Commons, Chetvorno, CC0 1.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CSV means comma-separated values, a plain text format where rows contain fields separated by delimiters. It survives because spreadsheets, databases, warehouses, finance systems, and upload widgets can all emit or accept it. The format looks small, but it sits on high-risk boundaries where one shifted column can corrupt money, inventory, or customer records.',
        'The trap is that CSV is not just split-on-comma text. Quotes can protect commas and line breaks inside a field. A parser must remember whether it is inside quoted data before it can decide what a character means.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to split the file into lines, then split each line on commas. That works for rows like Ada,Lovelace,42 because every comma is a delimiter and every newline is a record boundary. For clean exports, this solution feels honest because it matches what the eye sees.',
        'The next step is usually a few patches. Trim whitespace, remove surrounding quotes, and handle empty fields. Those patches still assume that characters have fixed meaning without reading the surrounding state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears with a row where the name Lovelace, Ada is wrapped in quote characters between id 7 and notes. A comma inside the quoted name is data, while the commas outside quotes are structure. A line-first parser also fails when line one and line two sit inside one quoted field because that newline is data, not the end of the record.',
        'The failure is silent when the row still produces strings. One bad split can move an amount into a name column or a comment into a date column. The parser must reject or preserve structure before later schema checks can mean anything.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'CSV has a small grammar with bounded memory. The parser does not need a stack or a tree; it needs the current state, the current field buffer, the current row, and enough source position to report errors. That is why a finite-state machine fits the problem.',
        'A finite-state machine is a program whose next action is determined by the current state and the next input symbol. In CSV, the transition table says whether a comma emits a field, appends a character, or triggers an error. Correct parsing comes from making those transitions explicit instead of hiding them inside string utilities.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At field start, an opening quote enters quoted field state. A comma emits an empty field, a newline emits an empty field and row, and any ordinary character starts an unquoted field. End of file emits the final field only if the current state allows it.',
        'In unquoted field state, ordinary characters append to the field until a comma or row separator arrives. In quoted field state, commas and row separators append as data. A quote moves to after quote state because the parser needs one more character to know whether the quote ended the field or encoded a literal quote.',
        'After quote state resolves the ambiguity. A second quote appends one literal quote and returns to quoted field state. A comma emits the field, a row separator emits the row, and ordinary text should be treated as malformed input in a strict dialect.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the emitted fields are exactly the completed fields to the left of the current byte. The current buffer contains only the unfinished field, and the state records the only context needed to interpret the next byte. Each transition preserves that invariant.',
        'When the parser is outside quotes, a delimiter is safe because no earlier unmatched quote can make it data. When the parser is inside quotes, a delimiter is unsafe to treat as structure because the quoted field has not closed. The after quote state prevents premature emission by delaying the decision until the next byte is known.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The parser reads each byte once, so the core time cost is O(n) for n input bytes. If a 100 MB file becomes 200 MB, the transition work roughly doubles. The machine does not need to revisit earlier bytes because state carries the needed context forward.',
        'Space is O(w) for the current row and field width, not for the whole file, when the parser streams rows to a consumer. The real production costs are allocation, Unicode decoding, validation, type conversion, batching, and error reporting. A parser that creates a new object for every row may spend more time allocating than recognizing delimiters.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'State-machine CSV parsing is useful for uploads, extract-transform-load jobs, spreadsheet imports, warehouse COPY commands, browser tools, and data migrations. These systems need to process large files while preserving row boundaries, field boundaries, and useful error positions. Streaming also lets a server reject a bad file before storing the whole upload.',
        'The same state-machine pattern appears in log parsers, protocol decoders, lexical analyzers, and UTF-8 validators. The shared idea is that a byte stream becomes meaningful only after a small amount of context is tracked. CSV is a compact example because the states are few and the corruption risk is easy to see.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The parser does not solve schema. It returns rows and fields, not types, required columns, date formats, null policy, encoding certainty, or business validity. Those checks must run above the parser after structure is safe.',
        'CSV also has dialect drift. Some files use semicolons, some allow backslash escapes, some trim spaces after delimiters, and some tolerate malformed quotes. A production parser needs a declared dialect, field-size limits, row-size limits, and clear reject behavior for hostile or ambiguous input.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Parse the bytes for three fields: Ada, then Lovelace, A. wrapped in quote characters, then 42. Ada starts an unquoted field, and the first comma emits field 1 as Ada. The quote enters quoted field state, so the comma in Lovelace, A. is appended as data instead of ending field 2.',
        'The closing quote moves to after quote state, and the next comma proves that field 2 is complete. The parser emits Lovelace, A., then reads 42 as field 3 and emits it at end of file. The result has 3 fields, not 4, because one comma was interpreted under quoted state.',
        'For escaped quotes, a field encoding the phrase She said hi with quote marks around hi uses doubled quote characters inside the quoted field. The doubled quotes each contribute one literal quote. A split-based parser cannot derive that result from delimiter positions alone.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read RFC 4180 at https://www.rfc-editor.org/rfc/rfc4180 for the common CSV format and MIME type. Then study finite-state machines, UTF-8 decoder deterministic finite automata, parser design, JSON tokenization, Web Workers for streaming parse work, Apache Arrow columnar memory, and DuckDB vectorized execution.',
      ],
    },
  ],
};
