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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The classic blackboard view shows Hearsay-II-style speech understanding: signal input feeds acoustic, lexical, and semantic knowledge sources that write to a shared board, while a control shell reads the agenda and chooses the next specialist. The research blackboard view shows the same pattern applied to a multi-agent research pipeline: search, extraction, and critic agents write claims and conflicts to a shared claim board, while a synthesizer and gate produce the final answer.',
        {type: 'callout', text: 'A blackboard turns agent coordination into typed shared state, so scheduling, conflict, and provenance become inspectable instead of hidden in messages.'},
        {
          type: 'table',
          headers: ['Visual marker', 'Meaning'],
          rows: [
            ['Active (highlighted)', 'The component currently executing -- the knowledge source writing or the control shell choosing'],
            ['Compare (dimmed)', 'Components waiting for a board change to trigger them'],
            ['Found (green)', 'A record or path confirmed by the merge or gate step'],
          ],
        },
        {
          type: 'note',
          text: 'At each frame, identify which agent wrote to the board and what changed. The board is the single source of truth. If two agents appear to coordinate without a board write between them, the animation is hiding a step.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some problems require several specialists to build one answer. A speech system needs acoustic, lexical, syntactic, and semantic knowledge. A research agent needs search, extraction, contradiction checking, synthesis, and verification. If every specialist talks directly to every other, coordination becomes hidden state and brittle point-to-point message passing. With N specialists, direct wiring creates up to N*(N-1)/2 channels, each carrying its own format, retry logic, and failure mode.',
        {
          type: 'quote',
          text: 'The key idea underlying the blackboard model is the use of a global database, called the blackboard, as a communication medium among a set of independent knowledge sources.',
          attribution: 'H. Penny Nii, "Blackboard Systems," AI Magazine, 1986',
        },
        {type: 'image', src: 'https://image2.slideserve.com/3959647/hearsay-ii-l.jpg', alt: 'Hearsay-II speech recognition blackboard system overview.', caption: 'Hearsay-II used specialist knowledge groups, a shared blackboard, and a scheduler. (Source: slideserve.com)'},
        'A blackboard architecture replaces that tangle with shared working memory. Each knowledge source reads the board, reacts to relevant changes, and writes structured hypotheses. A control shell watches the board and chooses which specialist should run next. The board is the central data structure for coordination -- not a transcript of side conversations, but a typed, inspectable, priority-driven workspace.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious multi-agent design is a chat chain. Agent A asks agent B for help, B replies, and a final agent summarizes the transcript. This works for demos but hides the state that matters: which claims are supported, which source produced them, which conflicts are unresolved, which hypothesis was rejected, which task deserves the next tool call.',
        'A second naive design is a shared scratchpad of free text. That centralizes notes, but gives the system no reliable fields for confidence, source, freshness, status, or conflict. Agents cannot reliably query, filter, or prioritize entries in unstructured prose.',
        {
          type: 'diagram',
          label: 'Chat chain vs. blackboard coordination',
          text: 'Chat chain (N=4 agents, 6 channels):\n\n  A <---> B\n  |\\     /|\n  | \\   / |\n  |  \\ /  |\n  |   X   |\n  |  / \\  |\n  | /   \\ |\n  v/     \\v\n  C <---> D\n\nBlackboard (N=4 agents, 1 shared board):\n\n  A ---\\       /--- C\n        \\     /\n     [  BOARD  ]\n        /     \\\n  B ---/       \\--- D\n\nChat chain: O(N^2) channels, each with its own protocol.\nBlackboard: O(N) read/write contracts against one schema.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Chat chains break when evidence is partial and the next useful step depends on what has been learned so far. Consider a three-agent research pipeline: Search, Extract, Critic.',
        {
          type: 'code',
          language: 'text',
          text: 'Step 1: Search finds source S12 claiming "X is true."\nStep 2: Extract writes claim A (confidence: high, source: S12).\nStep 3: Search finds source S03 claiming "X is false."\nStep 4: Extract writes claim B (confidence: medium, source: S03).\n\nChat chain behavior:\n  Extract sends claim A to Critic.\n  Critic says "looks fine."\n  Extract sends claim B to Critic.\n  Critic says "contradiction with A!"\n  But claim A already flowed to Synthesis as approved.\n  Synthesis publishes a report containing both X-is-true\n  and X-is-false without realizing they conflict.\n\nBlackboard behavior:\n  Claims A and B both live on the board.\n  Critic writes a conflict record linking A and B.\n  The agenda blocks synthesis until the conflict is resolved.\n  No contradictory answer can reach the gate.',
        },
        'The invariant the chat chain violates: no claim may reach synthesis while an unresolved conflict references it. A board enforces this because the conflict is a first-class record with links to both sides, a status field, and an owner. A chat transcript has no such structure -- contradictions become prose buried in a growing context window.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A blackboard system has three parts: knowledge sources, the board itself, and a control shell.',
        {type: 'image', src: 'https://image1.slideserve.com/3303151/architecture-l.jpg', alt: 'Blackboard architecture with controller, knowledge sources, and shared board.', caption: 'Knowledge sources communicate through the board while the controller chooses the next action. (Source: slideserve.com)'},
        {
          type: 'bullets',
          items: [
            'Knowledge source (KS): a specialist with a trigger condition, a read pattern, and a write contract. It activates when the board contains a record matching its trigger. It reads relevant entries, computes, and writes new records or updates.',
            'Board: a structured database of typed records -- hypotheses, evidence, conflicts, gaps, and status. Every record carries fields for confidence, source, freshness, authoring KS, and conflict links.',
            'Control shell: watches board changes, scores pending agenda items by priority, and selects which KS to activate next. The agenda is typically a priority queue over board events.',
          ],
        },
        {
          type: 'diagram',
          label: 'Blackboard execution loop',
          text: 'loop:\n  1. Board changes trigger new agenda items.\n  2. Control shell picks highest-priority agenda item.\n  3. Selected KS reads relevant board records.\n  4. KS writes new/updated records to the board.\n  5. New board state may trigger new agenda items.\n  6. Repeat until termination condition\n     (all gaps filled, confidence threshold met,\n      or budget exhausted).',
        },
        'In the classic view, the acoustic KS writes segment hypotheses, the lexical KS writes word candidates, and the semantic KS writes meaning interpretations. The control shell uses the agenda to decide whether bottom-up evidence (new acoustic segments) or top-down expectations (semantic predictions) deserve the next cycle.',
        'In the research view, the search KS writes source records to a durable ledger and candidate claims to the board. The extract KS enriches claims with structured fields. The critic KS writes conflict and gap records. The synthesizer reads only claims whose status is "supported" or "merged." The gate rejects output that references unsupported or conflict-blocked claims.',
        {
          type: 'note',
          text: 'The board and the ledger serve different roles. The ledger is durable evidence: URLs, authors, dates, snippets, hashes. The board is working memory: claims, gaps, conflicts, confidence, status. Synthesis needs both -- a claim without provenance is not ready to publish.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The architecture works because it separates communication from control and makes conflict a first-class object.',
        {
          type: 'bullets',
          items: [
            'Modularity: each KS needs only a trigger, a read pattern, and a write contract. Adding a new specialist does not require rewriting existing ones -- it just needs to speak the board schema.',
            'Visible partial progress: a hypothesis can be open, supported, contradicted, merged, rejected, or promoted. The system can inspect itself at any point and report what is known, unknown, and contested.',
            'Explicit conflict: on a board, contradiction is a typed record with links to both claims, sources, a status field, and a next-action field. In a chat chain, contradiction becomes prose that the next model may forget or hallucinate over.',
            'Opportunistic scheduling: the control shell can dynamically shift between bottom-up evidence building and top-down hypothesis verification based on what the board reveals. A cheap check that resolves a major conflict outranks a broad search with low expected information gain.',
          ],
        },
        {type: 'image', src: 'https://image2.slideserve.com/3959647/sample-of-hearsay-ii-s-blackboard-l.jpg', alt: 'Hearsay-II blackboard with speech waveform, hypotheses, and higher-level interpretations.', caption: 'The blackboard stores layered hypotheses so later specialists can build on earlier evidence. (Source: slideserve.com)'},
        {
          type: 'quote',
          text: 'In Hearsay-II, the scheduling strategy was critical: combining bottom-up evidence from the signal with top-down expectations from language models, without hard-wiring every knowledge source to every other.',
          attribution: 'Lesser and Erman, "A Retrospective View of the Hearsay-II Architecture," IJCAI 1977',
        },
        'The correctness argument is an invariant: every record on the board that reaches synthesis must have (a) at least one supporting source, (b) no unresolved conflict, and (c) a freshness timestamp within the validity window. The gate enforces this by rejecting any output path that violates it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A blackboard is more expensive than a pipeline. The overhead is real and structural.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Pipeline', 'Blackboard'],
          rows: [
            ['Schema design', 'Implicit in function signatures', 'Explicit record types, field contracts, version rules'],
            ['Coordination', 'Fixed order, no scheduler', 'Agenda priority queue: O(log A) per insert/extract for A agenda items'],
            ['Per-step overhead', 'One function call', 'Board read (query matching records) + board write (insert/update) + agenda update'],
            ['Conflict handling', 'Not represented', 'Conflict records, link maintenance, resolution scheduling'],
            ['Testability', 'Unit test each stage', 'Assert board state invariants: unsupported claims must create verification agenda items'],
            ['Debugging', 'Stack trace', 'Board event log with timestamps, authoring KS, and state diffs'],
          ],
        },
        {
          type: 'note',
          text: 'Board operations are typically O(1) hash lookups or O(log N) index queries for N records. The real cost is not algorithmic -- it is the engineering effort to define schemas, enforce write contracts, and maintain the agenda. Budget 2-5x the implementation time of a pipeline for the same number of stages.',
        },
        'The benefit scales with uncertainty. If the execution order is fixed and the data is clean, a pipeline is cheaper and clearer. If the next step depends on partial evidence, if conflicts arise, if specialists have overlapping scope, if the problem admits opportunistic progress -- the blackboard pays for itself by preventing the silent propagation of bad state.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Why the blackboard fits', 'What the board holds'],
          rows: [
            ['Speech understanding (Hearsay-II)', 'Multiple representation levels (acoustic, lexical, semantic) must combine bottom-up and top-down evidence', 'Segment hypotheses, word candidates, phrase hypotheses, semantic interpretations'],
            ['Multi-agent research systems', 'Evidence arrives incrementally, conflicts must block synthesis, provenance must reach the final answer', 'Claims, source records, conflicts, gaps, confidence scores'],
            ['Medical diagnosis (INTERNIST-like)', 'Multiple diseases can explain overlapping symptoms; partial evidence must be weighed and combined', 'Symptom observations, disease hypotheses, differential conflicts'],
            ['Autonomous vehicle perception', 'Camera, lidar, radar produce overlapping but conflicting object detections that must be fused', 'Object hypotheses, sensor readings, fusion confidence, tracking state'],
            ['Collaborative design (ABACUS)', 'Structural, thermal, and geometric constraints from different engineering disciplines must be reconciled', 'Constraint sets, design hypotheses, violation records'],
          ],
        },
        {
          type: 'note',
          text: 'The common thread is heterogeneous partial knowledge. Whenever the problem has multiple independent sources of evidence that may conflict, the blackboard pattern earns its overhead.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Untyped boards: if the board is free text, agents cannot query, filter, prioritize, merge, or audit entries. The board becomes a shared notepad and coordination reverts to guesswork. Every entry needs typed fields: claim, source, confidence, status, conflict links.',
            'Hidden side channels: if agents coordinate outside the board (direct calls, shared variables, prompt injection), the board no longer represents the true system state. Debugging becomes impossible because the visible state diverges from actual state.',
            'Stale records: an agent reads a claim that has since been contradicted, or synthesis uses a source past its freshness window. Mitigation requires version fields, status transitions, lease expiration, and conflict-link checks before any promotion.',
            'Last-writer-wins: if every agent can overwrite final conclusions, disagreement is silently erased. Strong designs separate record types (proposal, evidence, review, synthesis, publication) so that only a responsible step can promote a record.',
            'Small deterministic workflows: if there are 3 stages in a fixed order with no uncertainty, a pipeline is simpler, faster, and easier to test. The blackboard adds schema, agenda, and event-log overhead for no benefit.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: '// Stale-read failure sequence:\n// t=0  Critic writes conflict(claim_A, claim_B, status=open)\n// t=1  Synthesizer reads claim_A (status=supported) -- does not check conflicts\n// t=2  Synthesizer publishes report containing claim_A\n// t=3  Report contradicts itself because claim_B (opposing A) is also supported\n//\n// Fix: synthesizer query must join claims with conflicts:\n//   SELECT * FROM claims\n//   WHERE status = \'supported\'\n//   AND id NOT IN (SELECT target FROM conflicts WHERE status = \'open\')',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Lesser & Erman, "A Retrospective View of the Hearsay-II Architecture," IJCAI 1977', 'The original blackboard system for speech understanding; control shell design, KS scheduling, and the focus-of-attention problem'],
            ['Erman et al., "The Hearsay-II Speech-Understanding System," Computing Surveys, 1980', 'Full system description with performance data and lessons learned'],
            ['H. Penny Nii, "Blackboard Systems," AI Magazine 7(2-3), 1986', 'Survey of the blackboard model across domains: speech, design, planning, signal interpretation'],
            ['Corkill, "Blackboard Systems," AI Expert, 1991', 'Practical implementation guidance and taxonomy of blackboard variants'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Binary Heap (the agenda is a priority queue) and Hash Table (board records are keyed by id for O(1) lookup).',
            'Extension: study Multi-Agent Orchestration Topologies and Contract Net Agent Task Allocation for alternative coordination patterns.',
            'Case studies: study Agent2Agent Protocol Task State Case Study, Deep Research Agent Architecture Case Study, and Claim Graph & Source Ledger for modern applications of blackboard-style shared state.',
            'Related systems: study Distributed Tracing (board event logs resemble spans) and Temporal Workflow Case Study (durable execution with shared state).',
          ],
        },
      ],
    },
  ],
};

