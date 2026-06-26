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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt:'Memory hierarchy showing cache levels', caption:'Agent memory mirrors hardware memory hierarchy: fast context window (L1), working memory (L2), episodic store (L3), and external knowledge (disk). Source: Wikimedia Commons, CC BY-SA 4.0'},
        'Read the memory-layers view as a hierarchy. The context window is the small fast region the model can attend to right now. Episodic logs, notes, semantic indexes, graph memory, and procedural rules live outside that window until retrieval earns them a place.',
        'Read the context-packing view as a budget allocator. Active nodes are candidates for the next prompt pack. Removed nodes are dropped or compressed material. The safe inference is that memory should not enter the prompt merely because it exists.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A long-running agent has a physical limit: the model only sees the tokens placed in its current context window. Old tool outputs, user preferences, local rules, source links, unresolved bugs, and prior decisions may matter later, but they cannot all stay in the prompt forever.',
        'Agent memory is storage outside the prompt. Context engineering is the policy that chooses what returns to the prompt for the next action. Memory answers what might be useful later; context packing answers what is worth spending attention on now.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep appending the transcript. This works for short tasks because it preserves order and needs no index. A human can scroll back, so it feels natural to let the model do the same.',
        'The next obvious approach is a vector store. Split old text into chunks, embed each chunk, and retrieve the nearest chunks for the current query. This helps when similarity is the main lookup key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is attention quality. A larger prompt can carry more facts, but it can also carry stale instructions, duplicated logs, private data, malicious retrieved text, and summaries that hide the one unresolved constraint. More context is not the same as better context.',
        'The wall is also provenance. Provenance means evidence about where a memory came from. If a memory cannot point back to a source, episode, or user decision, the system should treat it as a lead to verify, not as a fact to assert.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'The core insight: separate the write path from the read path. The write path preserves what happened (raw episodes, provenance). The read path selects what the model should see next. A memory should not reach the prompt merely because it exists — it must earn its tokens.'},
        'Separate the write path from the read path. The write path preserves raw evidence first, then derives notes, tags, embeddings, graph edges, and summaries. The read path retrieves candidates, checks permission and freshness, ranks them, compresses them, and packs only useful pieces into the prompt.',
        'This creates a source-of-truth structure. The episode log and source ledger hold what actually happened. Semantic search, notes, and graph memory are indexes over that evidence, not replacements for it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical system writes several tiers. Working context holds the current goal and active constraints. Notes store task-level decisions and open problems. Episodic memory stores raw tool calls and observations. Semantic memory stores embeddings for similarity lookup. Temporal graph memory stores facts whose truth changes by entity and time.',
        'The read path starts from the current goal. It retrieves candidates from notes, semantic search, graph facts, and recent events. It then filters by authorization, freshness, source quality, and relevance before placing a small high-signal set into the prompt.',
        'Compaction is the same operation over a longer horizon. When the window fills, the system writes a restartable state: goal, constraints, files touched, decisions, unresolved problems, validation status, and next actions. The raw trace remains available because summaries can lose decisive detail.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is state fidelity. If raw evidence is preserved, derived memories point back to evidence, private records require authorization, and stale facts carry time information, then retrieval can be audited and corrected. Without those properties, memory improves fluency while weakening trust.',
        'The design mirrors caches and indexes. A cache helps because it keeps the hot working set close, not because it contains the whole database. An index helps because it answers a lookup pattern, not because it replaces the source of truth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main write cost is amplification. One observation may be stored as a raw episode, summarized into notes, embedded for vector search, extracted into graph facts, and linked to sources. That costs storage, embeddings, graph extraction, and sometimes extra model calls.',
        'The read path costs retrieval, reranking, permission checks, freshness checks, compression, and prompt tokens. Suppose a task has 2,000 old events averaging 200 tokens each, or 400,000 tokens total. If the prompt pack selects 12 memories averaging 250 tokens, the model sees 3,000 tokens instead of the whole trace.',
        'Cost is behavior: a transcript-only agent gets slower and noisier as history doubles. A layered memory system grows storage and indexing cost, but the prompt can remain bounded. The metric is decision-relevant signal per token, not total memory size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Long-horizon coding agents need this pattern for repository rules, validation commands, file decisions, and past failures. Research agents need it for source ledgers, extracted claims, conflicting evidence, and dated facts. Support agents need it for customer preferences, policy versions, and prior case outcomes.',
        'Multi-agent systems use the same idea in handoffs. A receiver should get a compact capsule with current state, evidence pointers, permissions, and unresolved risks. Dumping the raw transcript onto the next agent spreads stale context and hides provenance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Memory can make an agent worse. Context poisoning happens when untrusted text is retrieved near instructions. Stale memory happens when old facts beat newer evidence. Bad entity merges happen when similarly named people, repos, companies, or APIs are treated as one thing.',
        'Privacy failures are separate. A memory useful in one workspace may be a leak in another. Authorization must happen before prompt packing, not after the model has already seen the record.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A coding agent spends three days in one repository. It records 900 command outputs, 80 file reads, 14 edits, 6 failed test logs, and 4 user constraints. The raw trace may exceed 180,000 tokens, but the next turn needs only the current goal, assigned files, writing rules, latest diff, failed validation, and two durable decisions.',
        'The prompt pack chooses 9 items: system rules, current user request, file list, active constraints, last validation output, two source notes, one repository convention, and one unresolved risk. At 300 tokens each on average, that is about 2,700 tokens. The agent avoids replaying 180,000 tokens while keeping the evidence pointers needed for audit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study MemGPT at https://arxiv.org/abs/2310.08560, Anthropic context engineering at https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents, LangChain context engineering at https://www.langchain.com/blog/context-engineering-for-agents, Graphiti at https://github.com/getzep/graphiti, Zep at https://github.com/getzep/zep, and A-MEM at https://arxiv.org/abs/2502.12110. Next study Agent Model Router and Context Handoff Ledger, Claim Graph and Source Ledger, RAG Pipeline, Semantic Cache, Prompt Injection Threat Model, and Zanzibar Authorization.',
      ],
    },
  ],
};
