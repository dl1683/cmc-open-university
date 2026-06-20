// Agent memory and context engineering: how long-running agents decide what
// to store, retrieve, compress, isolate, and place back into the model window.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-memory-context-engineering-case-study',
  title: 'Agent Memory & Context Engineering Case Study',
  category: 'AI & ML',
  summary: 'How long-running agents manage working context, notes, episodic traces, semantic memory, temporal graph memory, compaction, and prompt packing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['memory layers', 'context packing'], defaultValue: 'memory layers' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 3.5, note: 'goal' },
      { id: 'ctx', label: 'context', x: 2.0, y: 2.0, note: 'working set' },
      { id: 'model', label: 'model', x: 3.4, y: 3.5, note: 'next action' },
      { id: 'tool', label: 'tool', x: 4.9, y: 2.0, note: 'observe' },
      { id: 'trace', label: 'trace', x: 6.3, y: 1.0, note: 'episodes' },
      { id: 'notes', label: 'notes', x: 6.3, y: 2.8, note: 'scratchpad' },
      { id: 'semantic', label: 'semantic', x: 6.3, y: 4.6, note: 'vectors' },
      { id: 'graph', label: 'graph', x: 7.9, y: 3.6, note: 'time facts' },
      { id: 'pack', label: 'pack', x: 8.9, y: 2.0, note: 'retrieve' },
      { id: 'answer', label: 'answer', x: 9.4, y: 4.9, note: 'cite' },
    ],
    edges: [
      { id: 'e-task-ctx', from: 'task', to: 'ctx' },
      { id: 'e-ctx-model', from: 'ctx', to: 'model' },
      { id: 'e-model-tool', from: 'model', to: 'tool' },
      { id: 'e-tool-trace', from: 'tool', to: 'trace' },
      { id: 'e-tool-notes', from: 'tool', to: 'notes' },
      { id: 'e-tool-semantic', from: 'tool', to: 'semantic' },
      { id: 'e-trace-graph', from: 'trace', to: 'graph' },
      { id: 'e-notes-graph', from: 'notes', to: 'graph' },
      { id: 'e-semantic-pack', from: 'semantic', to: 'pack' },
      { id: 'e-graph-pack', from: 'graph', to: 'pack' },
      { id: 'e-pack-ctx', from: 'pack', to: 'ctx' },
      { id: 'e-model-answer', from: 'model', to: 'answer' },
    ],
  }, { title });
}

function contextGraph(title) {
  return graphState({
    nodes: [
      { id: 'goal', label: 'goal', x: 0.7, y: 3.7, note: 'current task' },
      { id: 'pinned', label: 'pinned', x: 2.1, y: 1.3, note: 'rules' },
      { id: 'recent', label: 'recent', x: 2.1, y: 3.1, note: 'turns' },
      { id: 'retrieved', label: 'retrieved', x: 2.1, y: 4.9, note: 'memory' },
      { id: 'rank', label: 'rank', x: 3.9, y: 3.1, note: 'budget' },
      { id: 'compress', label: 'compress', x: 5.4, y: 1.6, note: 'summary' },
      { id: 'drop', label: 'drop', x: 5.4, y: 4.7, note: 'evict' },
      { id: 'prompt', label: 'prompt pack', x: 7.0, y: 3.1, note: 'tokens' },
      { id: 'llm', label: 'LLM', x: 8.4, y: 3.1, note: 'attention' },
      { id: 'trace', label: 'trace', x: 9.3, y: 5.0, note: 'audit' },
    ],
    edges: [
      { id: 'e-goal-rank', from: 'goal', to: 'rank' },
      { id: 'e-pinned-rank', from: 'pinned', to: 'rank' },
      { id: 'e-recent-rank', from: 'recent', to: 'rank' },
      { id: 'e-retrieved-rank', from: 'retrieved', to: 'rank' },
      { id: 'e-rank-compress', from: 'rank', to: 'compress' },
      { id: 'e-rank-drop', from: 'rank', to: 'drop' },
      { id: 'e-rank-prompt', from: 'rank', to: 'prompt' },
      { id: 'e-compress-prompt', from: 'compress', to: 'prompt' },
      { id: 'e-prompt-llm', from: 'prompt', to: 'llm' },
      { id: 'e-drop-trace', from: 'drop', to: 'trace' },
      { id: 'e-llm-trace', from: 'llm', to: 'trace' },
    ],
  }, { title });
}

function* memoryLayers() {
  yield {
    state: memoryGraph('Agent memory is a hierarchy, not one vector store'),
    highlight: { active: ['task', 'ctx', 'model', 'e-task-ctx', 'e-ctx-model'], compare: ['trace', 'notes', 'semantic', 'graph'] },
    explanation: 'The naive baseline is to keep stuffing the transcript into the prompt. A long-running agent needs a tiny working set for the next action, while traces, notes, semantic memory, and graph facts live outside the window until retrieval earns them a place.',
  };

  yield {
    state: labelMatrix(
      'Memory tiers and retrieval keys',
      [
        { id: 'working', label: 'working' },
        { id: 'notes', label: 'notes' },
        { id: 'episodic', label: 'episodic' },
        { id: 'semantic', label: 'semantic' },
        { id: 'graph', label: 'temporal graph' },
        { id: 'procedural', label: 'procedural' },
      ],
      [
        { id: 'lifetime', label: 'lifetime' },
        { id: 'key', label: 'query key' },
        { id: 'risk', label: 'main risk' },
      ],
      [
        ['one turn', 'next action', 'pollution'],
        ['one task', 'milestone', 'stale plan'],
        ['many events', 'time/source', 'replay cost'],
        ['many sessions', 'embedding', 'false match'],
        ['changing facts', 'entity+time', 'bad merge'],
        ['always-on', 'task type', 'wrong rule'],
      ],
    ),
    highlight: { active: ['working:lifetime', 'notes:key', 'semantic:key', 'graph:key'], compare: ['working:risk', 'semantic:risk', 'graph:risk'] },
    explanation: 'The data structure depends on the question you need to answer later. Recent instructions belong in working memory, milestones in notes, raw tool outputs in an episodic trace, facts in semantic or graph memory, and reusable behavior in procedural memory.',
  };

  yield {
    state: memoryGraph('Observations are written before they are reused'),
    highlight: { active: ['tool', 'trace', 'notes', 'semantic', 'graph', 'e-tool-trace', 'e-tool-notes', 'e-tool-semantic', 'e-trace-graph', 'e-notes-graph'], found: ['pack'] },
    explanation: 'The write path should preserve provenance first, then derive summaries, vectors, tags, and graph facts. Graphiti and Zep push this into a temporal context graph where relationships carry validity windows and derived facts trace back to episodes.',
    invariant: 'Derived memory should never erase the raw episode that justified it.',
  };

  yield {
    state: labelMatrix(
      'Memory organization patterns',
      [
        { id: 'append', label: 'append log' },
        { id: 'vector', label: 'vector notes' },
        { id: 'agentic', label: 'agentic links' },
        { id: 'temporal', label: 'time graph' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
        { id: 'fit', label: 'best fit' },
      ],
      [
        ['full replay', 'large', 'audit'],
        ['cheap recall', 'misses structure', 'similarity'],
        ['evolves links', 'LLM calls', 'learning'],
        ['current truth', 'schema work', 'changing facts'],
      ],
    ),
    highlight: { active: ['append:strength', 'vector:strength', 'agentic:strength', 'temporal:strength'], found: ['temporal:fit'] },
    explanation: 'MemGPT frames memory as virtual context management across fast and slow tiers. A-MEM adds dynamic note linking and memory evolution. Temporal graph memory adds point-in-time truth and contradiction handling for facts that change.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'retrieved memories', min: 0, max: 30 }, y: { label: 'answer utility', min: 0, max: 1 } },
      series: [
        { id: 'recall', label: 'recall', points: [{ x: 1, y: 0.2 }, { x: 4, y: 0.52 }, { x: 8, y: 0.73 }, { x: 14, y: 0.84 }, { x: 24, y: 0.88 }, { x: 30, y: 0.89 }] },
        { id: 'noise', label: 'noise', points: [{ x: 1, y: 0.03 }, { x: 4, y: 0.08 }, { x: 8, y: 0.17 }, { x: 14, y: 0.36 }, { x: 24, y: 0.69 }, { x: 30, y: 0.84 }] },
      ],
      markers: [
        { id: 'knee', x: 12, y: 0.8, label: 'rerank here' },
      ],
    }),
    highlight: { active: ['recall', 'knee'], compare: ['noise'] },
    explanation: 'Memory retrieval has the same shape as RAG. Too few memories lose recall; too many create distraction, conflict, and cost. Production systems need rank fusion, recency rules, authority rules, and reranking before context packing.',
  };
}

function* contextPacking() {
  yield {
    state: contextGraph('Context engineering decides what the model sees now'),
    highlight: { active: ['goal', 'pinned', 'recent', 'retrieved', 'rank', 'prompt', 'llm', 'e-goal-rank', 'e-rank-prompt', 'e-prompt-llm'], compare: ['compress', 'drop'] },
    explanation: 'Memory is the warehouse. Context engineering is the loading dock. The system chooses the smallest high-signal token set for the next step: instructions, current task, recent state, retrieved evidence, and parsed tool results.',
  };

  yield {
    state: labelMatrix(
      'Prompt-packing policy',
      [
        { id: 'rules', label: 'rules' },
        { id: 'goal', label: 'goal' },
        { id: 'recent', label: 'recent' },
        { id: 'tools', label: 'tool output' },
        { id: 'evidence', label: 'evidence' },
        { id: 'notes', label: 'notes' },
        { id: 'history', label: 'history' },
      ],
      [
        { id: 'keep', label: 'keep' },
        { id: 'compress', label: 'compress' },
        { id: 'drop', label: 'drop when' },
      ],
      [
        ['always', 'rarely', 'obsolete'],
        ['always', 'never', 'task changes'],
        ['latest', 'older turns', 'summarized'],
        ['parsed facts', 'raw blobs', 'irrelevant'],
        ['cited slices', 'long docs', 'low trust'],
        ['milestones', 'details', 'stale'],
        ['decisions', 'repetition', 'no effect'],
      ],
    ),
    highlight: { active: ['rules:keep', 'goal:keep', 'evidence:keep', 'notes:compress'], removed: ['tools:drop', 'history:drop'] },
    explanation: 'A prompt pack is a policy object, not a concatenated transcript. Pinned instructions and the current goal are usually non-negotiable; raw tool output, repetitive history, stale notes, and low-trust evidence should be compressed or dropped.',
  };

  yield {
    state: contextGraph('Compaction turns a transcript into a restartable state'),
    highlight: { active: ['recent', 'rank', 'compress', 'prompt', 'trace', 'e-recent-rank', 'e-rank-compress', 'e-compress-prompt', 'e-llm-trace'], found: ['pinned', 'goal'] },
    explanation: 'Anthropic describes compaction as summarizing a conversation near the context limit and starting a fresh window with the critical details preserved. The hard part is not making it shorter; it is preserving unresolved bugs, decisions, evidence, and next actions.',
    invariant: 'Compress for future decisions, not for pleasant prose.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context tokens', min: 0, max: 200 }, y: { label: 'relative effect', min: 0, max: 1 } },
      series: [
        { id: 'signal', label: 'useful signal', points: [{ x: 10, y: 0.2 }, { x: 30, y: 0.48 }, { x: 70, y: 0.75 }, { x: 120, y: 0.86 }, { x: 180, y: 0.9 }] },
        { id: 'latency', label: 'latency/cost', points: [{ x: 10, y: 0.04 }, { x: 30, y: 0.12 }, { x: 70, y: 0.32 }, { x: 120, y: 0.61 }, { x: 180, y: 0.92 }] },
        { id: 'confusion', label: 'confusion', points: [{ x: 10, y: 0.02 }, { x: 30, y: 0.06 }, { x: 70, y: 0.18 }, { x: 120, y: 0.45 }, { x: 180, y: 0.78 }] },
      ],
      markers: [
        { id: 'budget', x: 95, y: 0.78, label: 'budget' },
      ],
    }),
    highlight: { active: ['signal', 'budget'], compare: ['latency', 'confusion'] },
    explanation: 'Bigger context is not free. Even when the window is large enough, irrelevant or contradictory tokens can dilute attention, raise latency, and push the agent toward old assumptions. Context engineering treats attention as a scarce resource.',
  };

  yield {
    state: labelMatrix(
      'Context failure gates',
      [
        { id: 'poison', label: 'poisoning' },
        { id: 'stale', label: 'stale memory' },
        { id: 'privacy', label: 'privacy' },
        { id: 'conflict', label: 'conflict' },
        { id: 'loss', label: 'lost nuance' },
        { id: 'source', label: 'source-less' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['untrusted text acts', 'isolate input'],
        ['old fact wins', 'time validity'],
        ['wrong user data', 'permission check'],
        ['facts disagree', 'show conflict'],
        ['summary hides bug', 'recall audit'],
        ['memory no proof', 'source ledger'],
      ],
    ),
    highlight: { active: ['poison:gate', 'stale:gate', 'privacy:gate', 'source:gate'], compare: ['conflict:symptom', 'loss:symptom'] },
    explanation: 'The best memory system can still make the agent worse if it retrieves unsafe, stale, private, conflicting, or source-less context. The prompt pack needs trust, time, authorization, and provenance checks before the model sees the material.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'memory layers') yield* memoryLayers();
  else if (view === 'context packing') yield* contextPacking();
  else throw new InputError('Pick an agent-memory view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt:'Memory hierarchy showing cache levels', caption:'Agent memory mirrors hardware memory hierarchy: fast context window (L1), working memory (L2), episodic store (L3), and external knowledge (disk). Source: Wikimedia Commons, CC BY-SA 4.0'},
        'A long-running agent has a simple physical problem: the model only sees the tokens placed in its current context window. The task, old tool results, user preferences, local rules, source links, unresolved bugs, and previous decisions may all matter later, but they cannot all stay in the prompt forever. If the system treats the transcript as its only memory, every new turn makes the next decision more expensive and less focused.',
        'Agent memory is the outside-of-context storage layer. It decides what to persist: raw episodes, notes, source ledgers, embeddings, graph facts, user preferences, and reusable procedures. Context engineering is the inside-the-window selection layer. It decides what the model should see for the next action. The two layers are connected, but they solve different problems. Memory answers "what might be useful later?" Context packing answers "what is worth spending attention on now?"',
        'MemGPT describes the same constraint as virtual context management inspired by operating-system memory hierarchy: a small fast context window backed by larger external memory at slower tiers: https://arxiv.org/abs/2310.08560. Anthropic describes context as a finite resource that must be curated for agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents. LangChain gives the practical verbs: write, select, compress, and isolate context: https://www.langchain.com/blog/context-engineering-for-agents.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable design is to keep appending the conversation. This works for short tasks. It preserves ordering, requires no extra index, and gives the model every prior instruction and observation. A human can scroll back through the same transcript, so it feels natural to let the model do the same thing.',
        'The next reasonable design is a vector store. Split old messages into chunks, embed them, and retrieve the nearest chunks for each new user request. That improves recall when the relevant memory is semantically close to the current query. It also gives the system a clean retrieval interface: query in, top-k memories out.',
        'Both designs are useful baselines. They fail because the memory problem is not one problem. A raw transcript does not distinguish current rules from obsolete turns, private user data from public facts, unresolved decisions from completed work, or high-authority source evidence from model-generated guesses. A vector store knows similarity, but similarity is not the same as permission, freshness, provenance, contradiction handling, or task relevance.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is attention quality. A larger prompt can carry more facts, but it can also carry more distraction. Old assumptions compete with new instructions. Duplicated tool output raises latency without adding signal. A stale memory can overpower a fresher observation. A malicious web page can be retrieved beside trusted instructions. A summary can hide the one constraint that mattered.',
        'The wall is also accountability. If an answer cites a memory, the system needs to know where the memory came from. If two memories disagree, the system needs to show the conflict instead of silently choosing the one with the nearest embedding. If a user asks for work in one repository, memories from another repository should not leak into the context just because the wording is similar. A useful agent needs recall, but it also needs isolation, authority, time, and source tracking.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'The core insight: separate the write path from the read path. The write path preserves what happened (raw episodes, provenance). The read path selects what the model should see next. A memory should not reach the prompt merely because it exists — it must earn its tokens.'},
        'The core insight is to separate the write path from the read path. The write path preserves what happened, then derives searchable forms from it. The read path retrieves candidates, checks them, ranks them, compresses them, and packs only the useful pieces into the next prompt. A memory should not reach the model merely because it exists.',
        'The write path should be provenance-first. Store the raw episode before generating summaries, tags, embeddings, graph edges, or durable notes. Derived memory can be compact and searchable, but it should point back to the episode or source that justified it. This invariant is the difference between a memory system and a pile of plausible recollections.',
        'Graphiti and Zep use this idea for temporal knowledge graphs: episodes feed entity and relationship extraction, facts can carry time validity, and retrieval can combine vector, text, and graph signals: https://github.com/getzep/graphiti and https://github.com/getzep/zep. A-MEM takes a different route by organizing memories as linked, evolving notes with tags, context, and dynamic connections: https://arxiv.org/abs/2502.12110. The common lesson is that memory needs structure beyond nearest-neighbor recall.',
      ],
    },
    {
      heading: 'Memory tiers',
      paragraphs: [
        'A practical agent usually needs several memory tiers. Working context holds the current goal, active files, constraints, and immediate next actions. It should be small enough that every token can influence the next decision. An episodic trace stores raw tool calls, observations, page reads, command outputs, screenshots, and user messages. It answers "what actually happened?"',
        'A note store records task-level state: decisions made, open questions, partial plans, and handoff summaries. A semantic index retrieves similar past material when wording is the best available key. A temporal graph stores facts whose truth changes by entity and time, such as "this API version was current on this date" or "this user preference applied to this workspace." Procedural memory stores stable habits such as repo validation commands or writing rules. A source ledger stores the evidence behind claims.',
        'These tiers answer different queries. "What command failed?" wants the episode log. "What did we decide about style?" wants notes or procedural memory. "Which old topic resembles this topic?" wants semantic search. "Which fact is current for this entity?" wants a temporal graph. Collapsing all of them into one vector database makes the system simple, but it also removes the distinctions that make recall safe.',
      ],
    },
    {
      heading: 'Context packing',
      paragraphs: [
        'Context packing is the policy that spends the next prompt budget. The pack normally includes pinned system and developer rules, the current user goal, recent conversation state, active files, selected tool results, retrieved memories, source excerpts, and a short plan. Each item should have a reason to be present. If it cannot affect the next decision, it is probably noise.',
        'Good prompt packs rank before they compress. They check permissions before retrieval output reaches the model. They prefer fresh memories when facts drift. They keep source links near claims that depend on sources. They isolate untrusted text from instructions so a retrieved page cannot become a hidden command. They also make dropping explicit: obsolete turns, repeated tool logs, failed paths, and low-trust guesses should be summarized or removed.',
        'Compaction is the long-horizon version of the same operation. When the context window fills, the system writes a restartable summary. The summary is not a literary recap. It is a state object: current goal, active constraints, files touched, decisions made, unresolved problems, exact validation status, and next actions. The raw trace remains available because a compact summary can lose a nuance that later becomes decisive.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when three invariants hold. First, raw evidence is preserved before derived memory is written. Second, derived memory carries enough provenance to be checked. Third, prompt packing is query-specific rather than global. The model does not need every memory; it needs the few records that make the next action more correct.',
        'This is the same logic behind caches and indexes. A cache is useful because it keeps the hot working set close, not because it contains the whole database. An index is useful because it answers a specific lookup pattern, not because it replaces the source of truth. Agent memory should be treated the same way. Working context is the hot set. Semantic search, notes, and graphs are indexes. The episode log and source ledger are the ground truth.',
        'The correctness argument is not mathematical proof of a model answer. It is an engineering argument about state fidelity. If every derived memory can be traced to evidence, stale facts carry validity information, private records require authorization, and context packing records why material was included, then the agent can be audited and corrected. Without those properties, memory improves fluency while weakening trust.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is write amplification. One observation may be written to an episode log, summarized into notes, embedded into a semantic index, extracted into graph facts, and linked to sources. That costs storage, embeddings, graph extraction, and sometimes extra model calls. The benefit is that later retrieval can be selective instead of replaying the whole transcript.',
        'The read path has its own cost. Retrieval must search one or more stores, rerank candidates, check freshness and permissions, compress evidence, and build a prompt. Larger context windows reduce pressure, but they do not remove the need for ranking. Long prompts still raise latency and can dilute attention. The useful metric is not "how much context did we include?" It is "how much decision-relevant signal did the model receive per token?"',
        'When input volume doubles, a transcript-only agent gets slower and noisier. A layered memory system grows storage and indexing cost, but the prompt can stay bounded. That is the point of the hierarchy. The outside memory may grow with the project; the inside context should remain a small, high-signal working set.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a coding and research agent working in this educational repository for several days. The working context contains the assigned files, the local writing rules, the validation commands, and the latest user constraints. The episode log stores commands, file reads, diffs, browser checks, and validation output. The note store records durable project choices such as "study notes are the article" and "do not touch files outside the assigned write set."',
        'The semantic index can retrieve nearby topics with similar structure, such as another case study with a strong study-next section. The source ledger stores arXiv pages, official docs, and local source files separately from the final prose. A temporal graph can keep facts such as "this package version was current on June 17, 2026" separate from older facts that may still explain old decisions.',
        'When the user asks for another rewrite, the prompt pack should not include a week of transcripts. It should include the current goal, the write set, the relevant writing doctrine, the four active files, the adjacent topic names, and any source checks needed for unstable facts. If an old memory says to run full tests but the current user says not to run unit tests, the current task constraint wins and the old memory should be either omitted or marked as lower priority.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Memory can make an agent worse. Context poisoning happens when untrusted retrieved text lands near instructions. Stale memory happens when an old fact beats a newer observation. Bad entity merges happen when the system treats two similarly named people, repos, companies, or APIs as one thing. Over-compression happens when a clean summary drops the awkward detail that later decides the task.',
        'Privacy is a separate failure mode. A useful memory in one workspace may be a leak in another. Authorization should happen before prompt packing, not after the model has already seen the record. Source-less memory is another trap. If the agent remembers a claim but cannot point to evidence, the system should treat it as a lead to verify, not as a fact to assert.',
        'Operationally, evaluate memory by replaying tasks. Measure whether retrieved context changes decisions for the better, whether stale records are suppressed, whether sensitive records stay isolated, and whether summaries preserve unresolved constraints. Memory quality is not the size of the store. It is the rate at which retrieved material improves the next action without creating new risk.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'This design matters most for long-horizon coding agents, research agents, customer-support agents, personal assistants, enterprise knowledge agents, and compliance-heavy workflows. These agents need to remember work across turns and sessions, but they also need to prove why a memory was used. The same pattern applies to multi-agent systems: handoff capsules should carry the current state, evidence, and unresolved risks instead of dumping raw transcripts on the next agent.',
        'It is the wrong tool for short, stateless tasks. If a user asks a one-turn question and no future behavior depends on it, writing durable memory can add cost and risk. If a system cannot enforce permissions, durable memory may be worse than no memory. If facts change quickly and the team has no freshness policy, memory becomes a stale cache that sounds confident.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources and useful anchors: MemGPT at https://arxiv.org/abs/2310.08560, Anthropic context engineering at https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents, LangChain context engineering at https://www.langchain.com/blog/context-engineering-for-agents, Graphiti at https://github.com/getzep/graphiti, Zep at https://github.com/getzep/zep, and A-MEM at https://arxiv.org/abs/2502.12110.',
        'Study Agent Model Router & Context Handoff Ledger for boundary-crossing context capsules, Titans Test-Time Neural Memory Case Study for model-side memory, Agentic AI Patterns for planning and tools, Claim Graph & Source Ledger for provenance, RAG Pipeline for retrieval basics, Semantic Cache for LLMs for reuse under similarity, LRU Cache for working-set intuition, Prompt Injection Threat Model for untrusted retrieved text, Zanzibar Authorization Case Study for access control, and Temporal Workflow Case Study for restartable long-running work.',
      ],
    },
  ],
};
