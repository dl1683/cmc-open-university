// Blackboard architecture for agent coordination: a shared working-memory
// pattern from Hearsay-II to modern research agents and tool-using systems.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'blackboard-architecture-agent-coordination',
  title: 'Blackboard Architecture for Agent Coordination',
  category: 'AI & ML',
  summary: 'Coordinate specialized agents with a shared working memory of hypotheses, evidence, confidence, conflicts, and agenda priorities.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['classic blackboard', 'research blackboard'], defaultValue: 'classic blackboard' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function classicGraph(title) {
  return graphState({
    nodes: [
      { id: 'signal', label: 'signal', x: 0.8, y: 4.0, note: 'input' },
      { id: 'acoustic', label: 'acoustic', x: 2.6, y: 3.3, note: 'segments' },
      { id: 'lexical', label: 'lexical', x: 2.6, y: 4.0, note: 'words' },
      { id: 'semantic', label: 'semantic', x: 2.6, y: 5.1, note: 'meaning' },
      { id: 'board', label: 'board', x: 5.4, y: 4.0, note: 'global memory' },
      { id: 'agenda', label: 'agenda', x: 6.9, y: 3.3, note: 'priorities' },
      { id: 'control', label: 'control', x: 7.0, y: 5.0, note: 'choose KS' },
      { id: 'merge', label: 'merge', x: 8.4, y: 4.0, note: 'resolve' },
      { id: 'answer', label: 'best', x: 9.6, y: 4.0, note: 'path' },
    ],
    edges: [
      { id: 'e-signal-acoustic', from: 'signal', to: 'acoustic' },
      { id: 'e-signal-lexical', from: 'signal', to: 'lexical' },
      { id: 'e-acoustic-board', from: 'acoustic', to: 'board' },
      { id: 'e-lexical-board', from: 'lexical', to: 'board' },
      { id: 'e-semantic-board', from: 'semantic', to: 'board' },
      { id: 'e-board-agenda', from: 'board', to: 'agenda' },
      { id: 'e-agenda-control', from: 'agenda', to: 'control' },
      { id: 'e-control-acoustic', from: 'control', to: 'acoustic' },
      { id: 'e-control-lexical', from: 'control', to: 'lexical' },
      { id: 'e-control-semantic', from: 'control', to: 'semantic' },
      { id: 'e-board-merge', from: 'board', to: 'merge' },
      { id: 'e-merge-answer', from: 'merge', to: 'answer' },
    ],
  }, { title });
}

function researchGraph(title) {
  return graphState({
    nodes: [
      { id: 'question', label: 'question', x: 0.7, y: 3.7, note: 'scope' },
      { id: 'search', label: 'search KS', x: 2.5, y: 5.1, note: 'sources' },
      { id: 'extract', label: 'extract KS', x: 2.5, y: 3.7, note: 'claims' },
      { id: 'critic', label: 'critic KS', x: 2.5, y: 2.4, note: 'conflict' },
      { id: 'board', label: 'claim board', x: 5.0, y: 3.7, note: 'shared facts' },
      { id: 'ledger', label: 'ledger', x: 6.9, y: 5.0, note: 'provenance' },
      { id: 'agenda', label: 'agenda', x: 6.9, y: 2.5, note: 'next gaps' },
      { id: 'synth', label: 'synth', x: 8.5, y: 3.7, note: 'draft' },
      { id: 'gate', label: 'gate', x: 9.6, y: 3.7, note: 'verify' },
    ],
    edges: [
      { id: 'e-question-search', from: 'question', to: 'search' },
      { id: 'e-search-ledger', from: 'search', to: 'ledger' },
      { id: 'e-search-board', from: 'search', to: 'board' },
      { id: 'e-extract-board', from: 'extract', to: 'board' },
      { id: 'e-critic-board', from: 'critic', to: 'board' },
      { id: 'e-ledger-board', from: 'ledger', to: 'board' },
      { id: 'e-board-agenda', from: 'board', to: 'agenda' },
      { id: 'e-agenda-search', from: 'agenda', to: 'search' },
      { id: 'e-agenda-extract', from: 'agenda', to: 'extract' },
      { id: 'e-board-synth', from: 'board', to: 'synth' },
      { id: 'e-ledger-synth', from: 'ledger', to: 'synth' },
      { id: 'e-synth-gate', from: 'synth', to: 'gate' },
    ],
  }, { title });
}

function* classicBlackboard() {
  yield {
    state: classicGraph('A blackboard is shared working memory'),
    highlight: { active: ['signal', 'acoustic', 'lexical', 'board', 'e-signal-acoustic', 'e-signal-lexical', 'e-acoustic-board', 'e-lexical-board'], compare: ['semantic'] },
    explanation: 'In a blackboard architecture, independent knowledge sources do not call each other directly. They read and write a shared board. The board holds partial hypotheses, confidence, provenance, and gaps.',
  };

  yield {
    state: classicGraph('Knowledge sources react to board changes'),
    highlight: { active: ['board', 'agenda', 'control', 'semantic', 'e-board-agenda', 'e-agenda-control', 'e-control-semantic', 'e-semantic-board'], found: ['merge'] },
    explanation: 'The control shell watches the board and chooses which knowledge source should run next. A new word hypothesis can wake the semantic source; a contradiction can wake a verifier.',
    invariant: 'Agents communicate through the board, not through hidden side channels.',
  };

  yield {
    state: classicGraph('The agenda solves focus of attention'),
    highlight: { active: ['board', 'agenda', 'control', 'e-board-agenda', 'e-agenda-control'], compare: ['acoustic', 'lexical', 'semantic'] },
    explanation: 'The hard problem is not only storing hypotheses. It is deciding which partial hypothesis is worth more compute. The agenda is a priority queue over board events, confidence deltas, coverage gaps, and deadline pressure.',
  };

  yield {
    state: classicGraph('Merge resolves competing hypotheses'),
    highlight: { active: ['board', 'merge', 'answer', 'e-board-merge', 'e-merge-answer'], found: ['agenda'] },
    explanation: 'The final answer is not just the last write. It is a selected path through competing hypotheses. The merge step needs conflict rules, confidence calibration, and enough provenance to explain why one path won.',
  };

  yield {
    state: labelMatrix(
      'Blackboard record schema',
      [
        { id: 'h1', label: 'hypothesis' },
        { id: 'h2', label: 'support' },
        { id: 'h3', label: 'conflict' },
        { id: 'h4', label: 'freshness' },
        { id: 'h5', label: 'status' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['claim + span', 'what may be true'],
        ['source + score', 'why believe it'],
        ['opposing claim', 'what must be resolved'],
        ['time + version', 'avoid stale state'],
        ['open/merged/rejected', 'control agenda'],
      ],
    ),
    highlight: { active: ['h1:field', 'h2:purpose', 'h3:purpose', 'h5:field'] },
    explanation: 'A board is useful only when each entry has a schema. A pile of notes is not a blackboard; a structured table of hypotheses, support, conflicts, freshness, and status is.',
  };
}

function* researchBlackboard() {
  yield {
    state: researchGraph('Research agents need a claim board'),
    highlight: { active: ['question', 'search', 'ledger', 'board', 'e-question-search', 'e-search-ledger', 'e-search-board', 'e-ledger-board'], compare: ['synth'] },
    explanation: 'A research blackboard separates source collection from synthesis. Search agents write sources to the ledger and candidate claims to the board; the final writer should not be inventing provenance at the end.',
  };

  yield {
    state: researchGraph('Extraction turns sources into structured claims'),
    highlight: { active: ['ledger', 'extract', 'board', 'e-ledger-board', 'e-extract-board'], compare: ['critic'] },
    explanation: 'Extraction agents translate documents into board records: claim text, entity, date, source id, evidence span, confidence, and whether the claim supports or contradicts the current answer.',
  };

  yield {
    state: researchGraph('Critics write conflicts, not vibes'),
    highlight: { active: ['critic', 'board', 'agenda', 'e-critic-board', 'e-board-agenda'], found: ['search'] },
    explanation: 'A critic is useful when its output mutates the board: contradiction, missing source, stale date, unsupported generalization, or scope violation. That mutation creates a new agenda item.',
    invariant: 'Critique must create a record the next agent can act on.',
  };

  yield {
    state: labelMatrix(
      'Research blackboard cells',
      [
        { id: 'c1', label: 'claim A' },
        { id: 'c2', label: 'claim B' },
        { id: 'c3', label: 'gap' },
        { id: 'c4', label: 'conflict' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'confidence', label: 'confidence' },
        { id: 'next', label: 'next action' },
      ],
      [
        ['S12, S18', 'high', 'cite'],
        ['S21 only', 'medium', 'verify'],
        ['none', 'unknown', 'search'],
        ['S03 vs S09', 'unsettled', 'resolve'],
      ],
    ),
    highlight: { active: ['c1:source', 'c1:next', 'c3:next', 'c4:next'], compare: ['c2:confidence'] },
    explanation: 'The board doubles as a work queue. Strong claims can move to synthesis; weak claims ask for verification; gaps ask for search; conflicts ask for resolution.',
  };

  yield {
    state: researchGraph('Synthesis reads the board and the ledger together'),
    highlight: { active: ['board', 'ledger', 'synth', 'gate', 'e-board-synth', 'e-ledger-synth', 'e-synth-gate'], compare: ['agenda'] },
    explanation: 'The synthesizer should read both the claim board and the source ledger. The board says what may be true; the ledger says where it came from. The gate rejects unsupported or contradiction-blind prose.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'classic blackboard') yield* classicBlackboard();
  else if (view === 'research blackboard') yield* researchBlackboard();
  else throw new InputError('Pick a blackboard architecture view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A blackboard architecture coordinates many specialized knowledge sources through a shared working memory. Each knowledge source reads the board, reacts to relevant changes, and writes new hypotheses or updates. The control shell chooses which source should run next. This is different from a simple chat between agents: the board is the central data structure, and every contribution becomes inspectable state.',
        'The classic example is Hearsay-II, a speech-understanding system built around many independent knowledge sources and a global blackboard. Lesser and Erman describe the blackboard as a global working memory where distinct representations are integrated uniformly, with a data-directed control structure for activating knowledge sources: https://www.ijcai.org/Proceedings/77-2/Papers/055.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system starts with raw input and a board schema. In Hearsay-style speech understanding, the board may hold acoustic segments, phonemes, candidate words, phrases, and semantic interpretations. In a research agent, it may hold sources, claims, contradictions, entity records, confidence, dates, and missing evidence. Knowledge sources are independent modules: search, extraction, verification, contradiction detection, summarization, planning, or domain-specific validators.',
        'The agenda is the control mechanism. Every board write can create an agenda item: verify this claim, resolve this conflict, search for another source, merge duplicate entities, or promote a stable claim to synthesis. The agenda is often a priority queue, scored by expected information gain, confidence delta, user value, deadline, cost, and risk. That is how the system avoids spending equal effort on every partial hypothesis.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The blackboard itself is usually a set of structured records, not free text. A claim record can include id, text, entity, source ids, evidence spans, confidence, freshness, status, and conflict links. A source record can include URL, author, date, retrieval time, trust label, snippet hash, and extracted claims. An agenda item can include trigger event, target record, candidate knowledge source, priority, budget, and retry count.',
        'The most important invariant is provenance. A board entry without a source, timestamp, and authoring knowledge source is hard to debug and dangerous to reuse. Modern agent systems should treat blackboard writes like database writes: versioned, typed, permissioned, and traceable.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'Hearsay-II is the historical systems case. The 1977 retrospective says the model was designed for large search spaces, diverse knowledge sources, errorful input, and iterative experimental development. It also emphasizes a global data structure for communication and interaction among knowledge sources: https://www.ijcai.org/Proceedings/77-2/Papers/055.pdf. A longer Hearsay-II speech-understanding overview is available from Stanford: https://stacks.stanford.edu/file/druid%3Ats923xj4709/ts923xj4709.pdf.',
        'Modern deep research agents recreate the same pressure with web evidence instead of speech hypotheses. A search agent finds documents, an extractor writes claims, a critic writes contradictions, and a synthesizer reads the stable board. This connects directly to Claim Graph & Source Ledger and Deep Research Agent Architecture Case Study: the board is the live working memory; the ledger is the durable provenance layer.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A shared scratchpad is not automatically a blackboard. If entries are untyped prose, the system cannot prioritize, merge, reject, or audit them reliably. Another mistake is letting every agent mutate every field. Mature designs give each knowledge source a narrow write contract and make dangerous transitions, such as promoting a claim to final answer, pass through a gate.',
        'Blackboards also create stale-state risk. An agent may read a hypothesis that has since been contradicted, or synthesis may use a source after its freshness window expired. Version fields, status fields, conflict links, and trace events prevent the board from becoming an attractive dump of obsolete facts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lesser and Erman, A Retrospective View of the Hearsay-II Architecture, https://www.ijcai.org/Proceedings/77-2/Papers/055.pdf; Hearsay-II Speech-Understanding System, https://stacks.stanford.edu/file/druid%3Ats923xj4709/ts923xj4709.pdf; and Blackboard Systems overview, https://mas.cs.umass.edu/paper/218. Study Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Contract Net Agent Task Allocation, Claim Graph & Source Ledger, Deep Research Agent Architecture Case Study, Binary Heap, Hash Table, Distributed Tracing, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
