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
    explanation: 'The board replaces direct chatter between specialists. Each knowledge source reads the same working memory, adds a typed hypothesis or update, and leaves enough provenance for the control shell to decide what deserves attention next.',
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
    explanation: 'The animation separates durable evidence from live hypotheses. Search writes source records to the ledger and candidate claims to the board. The final writer should inherit provenance, not invent it at the end.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Some problems need several specialized processes to build one answer. A speech system may need acoustic, lexical, syntactic, and semantic knowledge. A research agent may need search, extraction, contradiction checking, synthesis, and verification. If every specialist talks directly to every other specialist, coordination turns into hidden state and brittle message passing.`,
        `A blackboard architecture exists to give those specialists a shared working memory. Each knowledge source reads the board, reacts to relevant changes, and writes structured hypotheses or updates. A control shell watches the board and chooses what should run next. The board becomes the central data structure for coordination, not a transcript of side conversations.`,
      ],
    },
    {
      heading: 'The naive agent design',
      paragraphs: [
        `The obvious multi-agent design is a chat chain. One agent asks another agent for help, that agent replies, and a final agent summarizes the transcript. This can work for demos, but it hides the state that matters. Which claims are supported? Which source produced them? Which conflicts are unresolved? Which hypothesis was rejected? Which task deserves the next tool call?`,
        `Another naive design is a shared scratchpad of free text. That at least centralizes notes, but it does not give the system reliable fields for confidence, source, freshness, status, or conflict. A blackboard is stronger because entries are typed, inspectable, prioritized, and changed through explicit write contracts.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A blackboard separates communication from control. Knowledge sources do not need to know about each other directly. They need to know how to read relevant board records and how to write valid updates. The control shell decides which update is worth acting on next.`,
        `This makes partial progress visible. A hypothesis can be open, supported, contradicted, merged, rejected, or ready for synthesis. A contradiction can become an agenda item. A missing source can trigger search. A high-confidence claim can move toward final output. The system coordinates by changing shared state.`,
      ],
    },
    {
      heading: 'Classic blackboard anatomy',
      paragraphs: [
        `The classic example is Hearsay-II, a speech-understanding system built around independent knowledge sources and a global blackboard. Acoustic evidence, word hypotheses, phrase hypotheses, and semantic interpretations were different representation levels over the same problem. Each specialist could add information when the board contained a pattern it knew how to improve.`,
        `The control shell solved focus of attention. It inspected board changes, estimated which knowledge source might make useful progress, and scheduled work. That is the reason the architecture mattered: the system could combine bottom-up evidence from the signal with top-down expectations from language and meaning without hard-wiring every module to every other module.`,
      ],
    },
    {
      heading: 'Research-agent anatomy',
      paragraphs: [
        `A modern research blackboard has different records but the same shape. A search knowledge source writes source records to a ledger. An extraction source turns documents into structured claims. A critic writes conflicts, missing evidence, date problems, or scope violations. A synthesizer reads stable claims and source records. A gate checks whether the answer is supported.`,
        `The board and the ledger should be separate. The ledger is durable evidence: sources, retrieval time, authorship, snippets, hashes, and permissions. The board is working memory: claims, gaps, conflicts, confidence, status, and next actions. Synthesis needs both, because a claim without provenance is not ready to publish.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The classic visual proves that specialists coordinate through the board. The acoustic, lexical, and semantic sources do not form a private tangle of calls. They write hypotheses into shared memory, and the agenda chooses which path deserves more work. The final answer is a selected path through competing hypotheses, not the last message in a chat.`,
        `The research visual proves the provenance split. Search writes durable evidence to the ledger and candidate claims to the board. Critique creates actionable conflict records. Synthesis reads the board and ledger together. The gate rejects prose that ignores missing support or unresolved contradiction.`,
      ],
    },
    {
      heading: 'The agenda problem',
      paragraphs: [
        `A blackboard without an agenda becomes a database of unfinished thoughts. The agenda decides focus of attention: verify this claim, search for another source, merge duplicate entities, resolve this conflict, ask a domain validator, or promote a record to synthesis. In implementation, the agenda is often a priority queue over board events.`,
        `Priority can combine confidence delta, expected information gain, user value, deadline, cost, dependency blocking, and risk. A cheap check that resolves a major contradiction should outrank a broad search with low expected value. This scheduling layer is where a blackboard architecture becomes more than shared storage and starts behaving like an adaptive problem solver.`,
      ],
    },
    {
      heading: 'Record schemas',
      paragraphs: [
        `The blackboard should contain structured records. A claim record can include id, text, entity, source ids, evidence spans, confidence, freshness, status, authoring knowledge source, and conflict links. A source record can include URL, title, author, date, retrieval time, trust label, snippet hash, permissions, and extracted claims.`,
        `An agenda item can include trigger event, target record, candidate knowledge source, priority, budget, retry count, and stopping rule. These fields let the system inspect itself. They also make testing possible: a unit test can assert that an unsupported claim creates a verification item instead of silently flowing into the final answer.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The architecture works when specialists have partial, heterogeneous knowledge. Each knowledge source can stay narrow. It only needs a trigger condition, a read pattern, and a write contract. New specialists can be added without rewriting every existing module, as long as they speak the board schema.`,
        `It also works because conflict is represented explicitly. In a chat chain, contradiction often becomes prose that the next model may forget. On a board, a conflict can be a first-class record with links to both claims, sources, status, owner, and next action. That makes unresolved uncertainty harder to hide.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `A blackboard design costs more than a simple pipeline. You need schemas, versioning, event logs, locking or transactional updates, permissions, agenda scheduling, and cleanup. You also need clear ownership over who can mutate which fields. Without that discipline, the board becomes an attractive shared mess.`,
        `The benefit is flexibility. Pipelines are easier when the order is fixed. Blackboards are better when the path depends on partial evidence, conflicts, uncertainty, and opportunistic progress. The design is a poor fit for a small deterministic workflow but a strong fit for research, diagnosis, planning, and other tasks where the next step depends on what has been learned.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is untyped prose. If the board is just notes, agents cannot reliably prioritize, merge, reject, or audit entries. The second is hidden side channels. If agents coordinate outside the board, the visible state is no longer the system state, and debugging becomes guesswork.`,
        `Stale state is another common failure. An agent may read a claim that has since been contradicted, or synthesis may use a source after its freshness window expired. Version fields, status transitions, conflict links, leases, and trace events help keep the board from becoming a dump of obsolete facts. The practical rule is simple: promote only records whose support, freshness, and conflict status are explicit.`,
        `A third failure is weak authority control. If every worker can overwrite final conclusions, the board becomes last-writer-wins memory. Strong designs separate proposal, evidence, review, synthesis, and publication records so that disagreement is preserved until a responsible step resolves it.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Lesser and Erman, A Retrospective View of the Hearsay-II Architecture, https://www.ijcai.org/Proceedings/77-2/Papers/055.pdf; Hearsay-II Speech-Understanding System, https://stacks.stanford.edu/file/druid%3Ats923xj4709/ts923xj4709.pdf; and Blackboard Systems overview, https://mas.cs.umass.edu/paper/218.`,
        `Study Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Contract Net Agent Task Allocation, Claim Graph & Source Ledger, Deep Research Agent Architecture Case Study, Binary Heap, Hash Table, Distributed Tracing, and Temporal Workflow Case Study next.`,
      ],
    },
  ],
};
