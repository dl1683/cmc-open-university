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
  const knowledgeSources = ['acoustic', 'lexical', 'semantic'];
  yield {
    state: classicGraph('A blackboard is shared working memory'),
    highlight: { active: ['signal', knowledgeSources[0], knowledgeSources[1], 'board', 'e-signal-acoustic', 'e-signal-lexical', 'e-acoustic-board', 'e-lexical-board'], compare: [knowledgeSources[2]] },
    explanation: `The board replaces direct chatter between ${knowledgeSources.length} specialists (${knowledgeSources.join(', ')}). Each knowledge source reads the same working memory, adds a typed hypothesis or update, and leaves enough provenance for the control shell to decide what deserves attention next.`,
  };

  const triggeredKS = knowledgeSources[2];
  yield {
    state: classicGraph('Knowledge sources react to board changes'),
    highlight: { active: ['board', 'agenda', 'control', triggeredKS, 'e-board-agenda', 'e-agenda-control', 'e-control-semantic', 'e-semantic-board'], found: ['merge'] },
    explanation: `The control shell watches the board and chooses which knowledge source should run next. A new word hypothesis can wake the ${triggeredKS} source; a contradiction can wake a verifier.`,
    invariant: `Agents communicate through the board, not through hidden side channels — all ${knowledgeSources.length} KS share one memory.`,
  };

  const agendaInputs = ['board events', 'confidence deltas', 'coverage gaps', 'deadline pressure'];
  yield {
    state: classicGraph('The agenda solves focus of attention'),
    highlight: { active: ['board', 'agenda', 'control', 'e-board-agenda', 'e-agenda-control'], compare: knowledgeSources },
    explanation: `The hard problem is not only storing hypotheses. It is deciding which partial hypothesis is worth more compute. The agenda is a priority queue over ${agendaInputs.join(', ')}.`,
  };

  const mergeRequirements = ['conflict rules', 'confidence calibration', 'provenance'];
  yield {
    state: classicGraph('Merge resolves competing hypotheses'),
    highlight: { active: ['board', 'merge', 'answer', 'e-board-merge', 'e-merge-answer'], found: ['agenda'] },
    explanation: `The final answer is not just the last write. It is a selected path through competing hypotheses. The merge step needs ${mergeRequirements.join(', ')} to explain why one path won.`,
  };

  const schemaFields = ['hypothesis', 'support', 'conflict', 'freshness', 'status'];
  yield {
    state: labelMatrix(
      'Blackboard record schema',
      schemaFields.map((f, i) => ({ id: `h${i + 1}`, label: f })),
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
    explanation: `A board is useful only when each entry has a schema with ${schemaFields.length} fields. A pile of notes is not a blackboard; a structured table of ${schemaFields.join(', ')} is.`,
  };
}

function* researchBlackboard() {
  const stores = ['ledger', 'board'];
  yield {
    state: researchGraph('Research agents need a claim board'),
    highlight: { active: ['question', 'search', stores[0], stores[1], 'e-question-search', 'e-search-ledger', 'e-search-board', 'e-ledger-board'], compare: ['synth'] },
    explanation: `The animation separates durable evidence from live hypotheses. Search writes source records to the ${stores[0]} and candidate claims to the ${stores[1]}. The final writer should inherit provenance, not invent it at the end.`,
  };

  const extractFields = ['claim text', 'entity', 'date', 'source id', 'evidence span', 'confidence'];
  yield {
    state: researchGraph('Extraction turns sources into structured claims'),
    highlight: { active: ['ledger', 'extract', 'board', 'e-ledger-board', 'e-extract-board'], compare: ['critic'] },
    explanation: `Extraction agents translate documents into board records with ${extractFields.length} fields: ${extractFields.join(', ')}, and whether the claim supports or contradicts the current answer.`,
  };

  const criticOutputs = ['contradiction', 'missing source', 'stale date', 'unsupported generalization', 'scope violation'];
  yield {
    state: researchGraph('Critics write conflicts, not vibes'),
    highlight: { active: ['critic', 'board', 'agenda', 'e-critic-board', 'e-board-agenda'], found: ['search'] },
    explanation: `A critic is useful when its output mutates the board: ${criticOutputs.join(', ')}. That mutation creates a new agenda item.`,
    invariant: `Critique must create a record the next agent can act on — ${criticOutputs.length} mutation types are recognized.`,
  };

  const cellTypes = ['claim A', 'claim B', 'gap', 'conflict'];
  const nextActions = ['cite', 'verify', 'search', 'resolve'];
  yield {
    state: labelMatrix(
      'Research blackboard cells',
      cellTypes.map((c, i) => ({ id: `c${i + 1}`, label: c })),
      [
        { id: 'source', label: 'source' },
        { id: 'confidence', label: 'confidence' },
        { id: 'next', label: 'next action' },
      ],
      [
        ['S12, S18', 'high', nextActions[0]],
        ['S21 only', 'medium', nextActions[1]],
        ['none', 'unknown', nextActions[2]],
        ['S03 vs S09', 'unsettled', nextActions[3]],
      ],
    ),
    highlight: { active: ['c1:source', 'c1:next', 'c3:next', 'c4:next'], compare: ['c2:confidence'] },
    explanation: `The board doubles as a work queue with ${cellTypes.length} cell types. Strong claims ${nextActions[0]}; weak claims ${nextActions[1]}; ${cellTypes[2]}s ${nextActions[2]}; ${cellTypes[3]}s ${nextActions[3]}.`,
  };

  const synthInputs = ['claim board', 'source ledger'];
  yield {
    state: researchGraph('Synthesis reads the board and the ledger together'),
    highlight: { active: ['board', 'ledger', 'synth', 'gate', 'e-board-synth', 'e-ledger-synth', 'e-synth-gate'], compare: ['agenda'] },
    explanation: `The synthesizer should read both the ${synthInputs[0]} and the ${synthInputs[1]}. The ${synthInputs[0]} says what may be true; the ${synthInputs[1]} says where it came from. The gate rejects unsupported or contradiction-blind prose.`,
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
        'This animation has two views you can switch between. The classic blackboard view recreates the Hearsay-II speech recognition system: a raw signal enters, and three knowledge sources (acoustic, lexical, semantic) each write hypotheses to a shared board. A control shell reads an agenda of pending work and picks which specialist fires next. The research blackboard view applies the same pattern to a multi-agent research pipeline where search, extraction, and critic agents write structured claims to a shared claim board.',
        'Watch for three visual states. Active (highlighted) marks the component currently executing -- either a knowledge source writing to the board or the control shell choosing the next action. Compare (dimmed) marks components waiting for a board change to trigger them. Found (green) marks a record or path that has been confirmed by the merge or gate step.',
        'At each frame, identify which agent wrote to the board and what changed. The board is the single source of truth for the entire system. If two agents appear to coordinate without a board write between them, the animation is hiding a step -- all real coordination passes through the board.',
        {type: 'callout', text: 'A blackboard turns agent coordination into typed shared state, so scheduling, conflict, and provenance become inspectable instead of hidden in messages.'},
        {type: 'image', src: './assets/gifs/blackboard-architecture-agent-coordination.gif', alt: 'Animated walkthrough of the blackboard architecture agent coordination visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some problems need several specialists to build one answer. A speech recognition system needs acoustic analysis (what sounds were made), lexical matching (what words those sounds could be), syntactic parsing (what grammar allows), and semantic interpretation (what makes sense in context). A research agent pipeline needs search, extraction, contradiction checking, synthesis, and verification. No single module can do the whole job.',
        'The natural first thought is to wire specialists together directly: acoustic talks to lexical, lexical talks to syntactic, and so on. But with N specialists, direct wiring creates up to N*(N-1)/2 communication channels. Each channel carries its own message format, retry logic, and failure mode. Four specialists means six channels. Ten specialists means forty-five. The wiring itself becomes the hardest part of the system to debug, test, and extend.',
        'The blackboard architecture solves this by giving every specialist a shared working memory instead of private conversations. Each knowledge source reads the board, reacts to relevant changes, and writes structured hypotheses back. A control shell watches the board and decides which specialist should run next. The board is not a transcript of side conversations -- it is a typed, inspectable, priority-driven workspace where every piece of evidence has a source, a confidence, and a status.',
        {type: 'image', src: 'https://image2.slideserve.com/3959647/hearsay-ii-l.jpg', alt: 'Hearsay-II speech recognition blackboard system overview.', caption: 'Hearsay-II used specialist knowledge groups, a shared blackboard, and a scheduler. (Source: slideserve.com)'},
        'The idea originated at Carnegie Mellon in the 1970s. The Hearsay-II system needed to combine bottom-up evidence (raw audio segments) with top-down expectations (language models predicting likely words) in a way that no fixed pipeline could handle. The blackboard was the solution: a global database where knowledge sources post hypotheses and a scheduler decides what deserves attention next. H. Penny Nii later surveyed the pattern across speech, design, planning, and signal interpretation in her 1986 AI Magazine articles, establishing it as a general coordination architecture.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The most common multi-agent design today is a chat chain. Agent A asks agent B for help, B replies, A passes the combined context to agent C, and a final agent summarizes the transcript into an answer. This works for demos and simple pipelines, but it hides the state that actually matters: which claims are supported, which source produced them, which conflicts remain unresolved, and which hypothesis was rejected.',
        'A second naive design is a shared scratchpad of free text. Every agent appends notes to the same document. This centralizes information, which is better than scattered messages, but gives the system no reliable fields for confidence, source, freshness, status, or conflict. An agent searching the scratchpad for "all claims with confidence above 0.8" has to parse prose. An agent checking for contradictions has to read every note and reason about whether two paragraphs disagree. Neither operation is reliable at scale.',
        'Both approaches share the same structural flaw: coordination state is implicit. In a chat chain, state lives in the ordering and content of messages. In a scratchpad, state lives in unstructured paragraphs. Neither representation supports the operations the system actually needs -- querying by type, filtering by confidence, joining claims with their conflicts, or blocking synthesis until contradictions are resolved.',
        'With a blackboard, each agent reads and writes to a shared database with a fixed schema. The chat chain requires O(N^2) pairwise channels for N agents, each with its own protocol. The blackboard requires O(N) read/write contracts against one schema. That difference in wiring complexity is the whole point.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Chat chains break when evidence is partial and the next useful step depends on what has already been learned. The failure is not hypothetical -- it follows directly from how information flows in a chain versus a board.',
        'Consider a three-agent research pipeline: Search, Extract, and Critic. Search finds source S12 claiming "X is true." Extract writes claim A with high confidence from S12. Later, Search finds source S03 claiming "X is false." Extract writes claim B with medium confidence from S03. In a chat chain, Extract already sent claim A to Critic. Critic said "looks fine." Extract then sends claim B. Critic says "contradiction with A!" But claim A already flowed downstream to Synthesis as approved. Synthesis publishes a report containing both X-is-true and X-is-false without realizing they conflict.',
        'The invariant the chat chain violates is straightforward: no claim may reach synthesis while an unresolved conflict references it. A board enforces this because the conflict is a first-class record with links to both sides, a status field (open, resolved, dismissed), and an owner (which agent is responsible for resolution). When the critic writes a conflict record linking claims A and B, the agenda automatically blocks synthesis until that conflict reaches a terminal status.',
        'A chat transcript has no such structure. Contradictions become prose buried in a growing context window. A downstream agent might miss the contradiction because it was on a previous page of context, because the model hallucinated a resolution, or because the message ordering created the illusion that the contradiction was already handled. The board makes the contradiction a concrete object that the system must deal with before proceeding.',
        'This is the wall: any system that coordinates specialists through unstructured messages will eventually propagate contradictory state to its output. The only fix is to make conflict a first-class data type with enforced status transitions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight of the blackboard architecture is that typed shared state with a central scheduler beats direct agent-to-agent messaging for any problem where evidence arrives incrementally and may conflict. This is not just an engineering preference -- it is a structural argument about what operations the coordination layer must support.',
        'Direct messaging between agents is point-to-point: agent A sends a message to agent B, and only A and B know about it. If agent C needs the same information, A must send it again, or B must forward it. If agents D and E produce contradictory claims, the contradiction only becomes visible if some agent happens to receive both messages and notices the conflict. The system has no single place where all evidence lives together and can be queried.',
        'A typed board changes this by making every piece of evidence visible to every agent through a shared schema. Each record on the board has a fixed set of fields: claim text, source identifier, confidence score, status (open, supported, contradicted, merged, rejected), authoring agent, timestamp, and links to conflicting records. Because the schema is fixed, any agent can query the board for specific patterns -- "all claims with status=supported and no open conflicts" -- without parsing prose.',
        'The scheduler (control shell) adds the second key property: global prioritization. In a chat chain, the execution order is determined by the wiring -- A always runs before B, B before C. In a blackboard, the scheduler examines the current board state and decides which agent should fire next based on what would be most useful right now. A cheap check that resolves a major conflict outranks a broad search with low expected information gain. This opportunistic scheduling lets the system adapt its strategy as evidence accumulates.',
        'Together, typed shared state and a scheduler give the system two capabilities that no amount of message-passing can replicate: global visibility (every agent sees all evidence) and dynamic prioritization (the system can change its plan based on what it has learned so far). These are precisely the capabilities needed when the problem involves partial, incremental, potentially contradictory evidence from heterogeneous specialists.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A blackboard system has three components: knowledge sources, the board, and a control shell. Understanding each one precisely is necessary to build or debug the pattern.',
        {type: 'image', src: 'https://image1.slideserve.com/3303151/architecture-l.jpg', alt: 'Blackboard architecture with controller, knowledge sources, and shared board.', caption: 'Knowledge sources communicate through the board while the controller chooses the next action. (Source: slideserve.com)'},
        'A knowledge source (KS) is a specialist with three properties: a trigger condition, a read pattern, and a write contract. The trigger condition is a predicate over board state -- for example, "fire when a new word hypothesis appears with confidence above 0.6." The read pattern specifies which board records the KS needs to do its work. The write contract specifies what types of records the KS will produce. A KS activates when its trigger matches, reads the records it needs, computes, and writes new records or updates existing ones.',
        'The board is a structured database of typed records. Each record represents a hypothesis, a piece of evidence, a conflict, a gap, or a status marker. Every record carries fields for its type, content, confidence score, source identifier, authoring KS, creation timestamp, freshness window, and links to related records (supporting evidence, conflicting claims). The board is not a log -- records can be updated, and status transitions (open to supported, supported to contradicted) are first-class operations.',
        'The control shell watches the board for changes and maintains an agenda -- a priority queue of pending actions. When a KS writes a new record, the control shell evaluates which other KS triggers now match and adds them to the agenda with a priority score. It then picks the highest-priority agenda item and activates the corresponding KS. The priority function can consider factors like confidence deltas, coverage gaps, conflict severity, and remaining budget.',
        'The execution loop is: (1) a board change creates new agenda items, (2) the control shell picks the highest-priority item, (3) the selected KS reads relevant board records, (4) the KS writes new or updated records, (5) new board state may create more agenda items, (6) repeat until a termination condition is met (all gaps filled, confidence threshold reached, or budget exhausted). In the classic Hearsay-II view, the acoustic KS writes segment hypotheses, the lexical KS writes word candidates, and the semantic KS writes meaning interpretations. In the research view, search writes source records and candidate claims, extract enriches claims with structured fields, and the critic writes conflict and gap records.',
        'The board and a provenance ledger serve different roles. The ledger is durable evidence: URLs, authors, dates, text snippets, content hashes. The board is working memory: claims, gaps, conflicts, confidence, status. Synthesis needs both -- a claim on the board without a matching provenance entry in the ledger is not ready to publish.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The architecture works because it separates communication from control and makes conflict a first-class object. These are not incidental benefits -- they are the structural properties that make the pattern sound.',
        'Modularity comes from the board schema acting as a contract. Each KS needs only a trigger, a read pattern, and a write contract. Adding a new specialist does not require rewriting existing ones -- the new KS just needs to read and write records that conform to the board schema. If you add a "fact-checker" KS to the research pipeline, it reads claims with status=supported, checks them against a trusted database, and writes verification records. No existing KS changes.',
        'Visible partial progress comes from the status field on every record. A hypothesis can be open, supported, contradicted, merged, rejected, or promoted. At any moment, the system can report exactly what is known, what is unknown, what is contested, and what has been resolved. This is impossible in a chat chain because the "state" is the entire message history, which no agent can efficiently query.',
        {type: 'image', src: 'https://image2.slideserve.com/3959647/sample-of-hearsay-ii-s-blackboard-l.jpg', alt: 'Hearsay-II blackboard with speech waveform, hypotheses, and higher-level interpretations.', caption: 'The blackboard stores layered hypotheses so later specialists can build on earlier evidence. (Source: slideserve.com)'},
        'Explicit conflict handling is the most important property. On a board, a contradiction is a typed record with links to both claims, the sources backing each side, a status field (open, resolved, dismissed), and a next-action field (which KS should resolve it). In a chat chain, a contradiction is prose that the next model might forget, misinterpret, or hallucinate over. The board makes it structurally impossible to ignore a conflict -- synthesis cannot proceed until the conflict record reaches a terminal status.',
        'The correctness argument reduces to a single invariant: every record on the board that reaches synthesis must have (a) at least one supporting source, (b) no unresolved conflict linking to it, and (c) a freshness timestamp within the validity window. The gate step enforces this by rejecting any output path that violates it. This invariant is easy to state, easy to test, and impossible to enforce in an unstructured message-passing system.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A blackboard is more expensive than a pipeline. The overhead is real and structural, and pretending otherwise leads to over-engineering simple problems.',
        'Schema design is the first cost. A pipeline\'s interface is implicit in function signatures -- stage A returns what stage B expects. A blackboard requires explicit record types with defined fields, write contracts per KS, and versioning rules for updates. This design work is substantial. Expect to spend more time on the schema than on any individual KS.',
        'Coordination overhead is the second cost. A pipeline has a fixed execution order and no scheduler. A blackboard maintains an agenda -- a priority queue that requires O(log A) time per insert and extract for A agenda items. Every board write triggers a scan of KS triggers to determine which new agenda items to create. Every board read requires querying records by type, status, and conflict links. These operations are individually cheap (O(1) hash lookups or O(log N) index queries for N records), but they add up across thousands of iterations.',
        'Conflict handling is the third cost. A pipeline does not represent conflicts at all -- data flows forward and disagreements are invisible. A blackboard must create conflict records, maintain bidirectional links between conflicting claims, schedule resolution actions, and enforce status transitions. This machinery has real engineering and runtime cost.',
        'Testability changes character. A pipeline is tested by unit-testing each stage in isolation. A blackboard is tested by asserting invariants over board state -- for example, "every claim with status=supported must have at least one source record in the ledger" or "every open conflict must have a corresponding agenda item." These invariant tests are more powerful (they catch systemic issues) but harder to write and maintain.',
        'The practical guideline: budget 2-5x the implementation time of a pipeline for the same number of stages. The benefit scales with uncertainty. If the execution order is fixed and the data is clean, a pipeline is cheaper and clearer. If the next step depends on partial evidence, if conflicts arise, if specialists have overlapping scope, the blackboard pays for itself by preventing silent propagation of bad state.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hearsay-II at Carnegie Mellon (1977) is the canonical example. The system understood continuous speech by combining bottom-up acoustic evidence with top-down linguistic expectations. The board held segment hypotheses, word candidates, phrase hypotheses, and semantic interpretations. The control shell dynamically chose whether to pursue bottom-up evidence building or top-down hypothesis verification based on what the board revealed about the current state of understanding.',
        'Multi-agent research systems use the pattern when evidence arrives incrementally and conflicts must block synthesis. The board holds claims, source records, conflicts, gaps, and confidence scores. The critical property is that synthesis cannot proceed until every conflict referencing an included claim is resolved. This prevents the system from publishing contradictory conclusions.',
        'Medical diagnosis systems like INTERNIST used blackboard-style reasoning to handle overlapping symptoms. Multiple diseases can explain the same symptom, and partial evidence must be weighed and combined. The board held symptom observations, disease hypotheses, and differential conflicts. The scheduler prioritized tests that would most efficiently distinguish between competing hypotheses.',
        'Autonomous vehicle perception fuses data from cameras, lidar, and radar. These sensors produce overlapping but sometimes conflicting object detections. The board holds object hypotheses, sensor readings, fusion confidence scores, and tracking state. A conflict between camera and lidar about whether an object exists at a given location must be resolved before the planning layer can act on it.',
        'The common thread across all these domains is heterogeneous partial knowledge. Whenever the problem has multiple independent sources of evidence that may conflict, and the next useful step depends on what has been learned so far, the blackboard pattern earns its overhead.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Untyped boards are the most common failure mode. If the board is free text -- a shared notepad where agents write prose paragraphs -- then agents cannot query by field, filter by confidence, join claims with conflicts, or audit provenance. The board degrades into a scratchpad, and coordination reverts to the same guesswork that plagues chat chains. Every entry needs typed fields: claim, source, confidence, status, conflict links, timestamp.',
        'Hidden side channels destroy the architecture\'s guarantees. If agents coordinate outside the board -- through direct function calls, shared variables, or prompt injection -- the board no longer represents the true system state. The event log shows one history while the actual execution followed another. Debugging becomes impossible because the visible state diverges from actual state. Enforcing that all coordination passes through the board requires discipline and often runtime checks.',
        'Stale records cause subtle bugs. An agent reads a claim that has since been contradicted, or synthesis uses a source past its freshness window. The failure sequence is concrete: at time t=0, the critic writes a conflict linking claims A and B with status=open. At t=1, the synthesizer reads claim A (status=supported) without checking the conflict table. At t=2, the synthesizer publishes a report containing claim A. At t=3, the report contradicts itself because claim B (opposing A) is also supported elsewhere. The fix is to require every read that feeds synthesis to join claims with the conflict table and reject any claim that has an open conflict.',
        'Last-writer-wins semantics silently erase disagreement. If every agent can overwrite any record\'s final conclusion field, then the last agent to run wins regardless of evidence quality. Strong designs separate record types by lifecycle stage -- proposal, evidence, review, synthesis, publication -- so that only a designated step can promote a record from one stage to the next.',
        'Small deterministic workflows do not benefit from the pattern. If you have three stages in a fixed order with no uncertainty, conflicts, or branching, a pipeline is simpler, faster, and easier to test. The blackboard adds schema design, agenda maintenance, and event-log overhead for zero benefit. Use the pattern only when the problem has genuine uncertainty about execution order or potential contradictions between specialists.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Walk through a concrete multi-agent research task: answering the question "What is the average mass of a black hole in the Milky Way?" Three agents participate: Search, Extract, and Critic. The board starts empty.',
        'Step 1: The control shell initializes the board with a single gap record: {type: "gap", question: "average black hole mass in Milky Way", status: "open", priority: 10}. The agenda now contains one item: activate Search to fill this gap.',
        'Step 2: Search fires. It finds source S01 (a 2020 review paper) stating "stellar-mass black holes in the Milky Way have masses between 5 and 20 solar masses." Search writes two records to the board: a source record {id: "src-S01", url: "...", date: "2020", snippet: "5-20 solar masses"} and a claim record {id: "claim-A", text: "stellar-mass BH range: 5-20 solar masses", source: "src-S01", confidence: 0.85, status: "open"}. The gap record remains open because the claim gives a range, not an average.',
        'Step 3: The control shell re-evaluates the agenda. The gap is still open, but now there is also an open claim that needs extraction. It activates Extract on claim-A. Extract enriches the record: {id: "claim-A", value_low: 5, value_high: 20, unit: "solar masses", population: "stellar-mass", status: "supported"}. Extract also writes a new gap: {type: "gap", question: "are there non-stellar-mass BHs in the Milky Way?", status: "open", priority: 7}.',
        'Step 4: Search fires again on the new gap. It finds source S02 (a 2022 paper) reporting "Sagittarius A* has a mass of approximately 4 million solar masses." Search writes source record src-S02 and claim-B: {text: "Sgr A* mass: 4e6 solar masses", source: "src-S02", confidence: 0.95, status: "open", population: "supermassive"}. Now the board has two claims about black hole mass in the Milky Way, but they describe different populations.',
        'Step 5: Critic fires. It reads claims A and B and writes a conflict record: {type: "conflict", targets: ["claim-A", "claim-B"], reason: "different populations -- averaging across stellar-mass and supermassive is misleading", status: "open", suggested_action: "separate populations or clarify scope"}. The agenda now blocks synthesis because an open conflict exists.',
        'Step 6: The control shell examines the conflict. The suggested action is to clarify scope. It activates Search with a refined query about the population distribution. Search finds source S03 (a 2019 survey) estimating "approximately 100 million stellar-mass black holes in the Milky Way, with a mean mass of about 7.8 solar masses." Search writes claim-C: {text: "mean stellar-mass BH: 7.8 solar masses, population: ~1e8", source: "src-S03", confidence: 0.80, status: "open"}.',
        'Step 7: Critic fires again. It reads the conflict record and all three claims. Claims A and C are compatible (C gives a specific average within A\'s range). Claim B describes a different population. Critic updates the conflict status to "resolved" with resolution: "the question is ambiguous; stellar-mass average is ~7.8 solar masses; the supermassive outlier Sgr A* should be noted separately." Critic promotes claim-C to status "supported" and annotates claim-B as "context, not direct answer."',
        'Step 8: With no open conflicts remaining, synthesis fires. It reads claims with status "supported" (claim-A, claim-C) and context (claim-B), joins them with their source records from the ledger, and drafts: "The average mass of a stellar-mass black hole in the Milky Way is approximately 7.8 solar masses (estimated population: 100 million). The Milky Way also contains the supermassive black hole Sagittarius A* at 4 million solar masses, but this is a single outlier, not a representative average." The gate checks: every claim in the draft has a source, no open conflicts reference any included claim, and all sources are within their freshness window. The gate passes.',
        'The total cost: 3 Search calls, 1 Extract call, 2 Critic calls, 1 Synthesis call, 1 Gate check. The board held 3 claims, 3 sources, 2 gaps, and 1 conflict. At every step, the full state was inspectable, queryable, and auditable. A chat chain handling the same task would have buried the population ambiguity in a paragraph of text that synthesis might or might not have noticed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Lesser and Erman, "A Retrospective View of the Hearsay-II Architecture" (IJCAI 1977), which describes the original blackboard system for speech understanding, including control shell design, KS scheduling, and the focus-of-attention problem. Erman et al. expanded on this in "The Hearsay-II Speech-Understanding System" (Computing Surveys, 1980) with full system descriptions, performance data, and lessons learned.',
        'H. Penny Nii\'s two-part "Blackboard Systems" survey in AI Magazine 7(2-3), 1986, remains the best overview of the pattern across domains: speech, design, planning, and signal interpretation. Corkill\'s "Blackboard Systems" (AI Expert, 1991) provides practical implementation guidance and a taxonomy of blackboard variants.',
        'For prerequisites, study Binary Heap (the agenda is a priority queue, and understanding heap operations clarifies the scheduler\'s cost) and Hash Table (board records are keyed by id for O(1) lookup). Both are fundamental data structures that the blackboard pattern depends on directly.',
        'For extensions, study Multi-Agent Orchestration Topologies and Contract Net Agent Task Allocation for alternative coordination patterns that make different tradeoffs. The contract net uses competitive bidding rather than shared state, which is better when agents have private cost information but worse when evidence must be globally visible.',
        'For modern applications, study the Agent2Agent Protocol Task State Case Study, Deep Research Agent Architecture Case Study, and Claim Graph and Source Ledger topics on this site. These show how blackboard-style shared state appears in contemporary AI agent systems, often under different names but with the same structural properties. Distributed Tracing (board event logs resemble trace spans) and Temporal Workflow Case Study (durable execution with shared state) cover related infrastructure patterns.',
      ],
    },
  ],
};

