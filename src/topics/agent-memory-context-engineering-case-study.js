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
    explanation: 'A long-running agent starts with a tiny working set: the current goal, relevant instructions, and the immediate observations needed for the next action. Everything else should live outside the model window until retrieval earns it a place.',
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
    explanation: 'The write path should preserve provenance first, then derive summaries, vectors, tags, and graph facts. Graphiti and Zep push this idea into a temporal context graph where relationships carry validity windows and derived facts trace back to episodes.',
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
    explanation: 'Memory is the warehouse. Context engineering is the loading dock. The system must choose the smallest set of high-signal tokens that maximizes the next step: instructions, current task, recent state, retrieved evidence, and tool results.',
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
      heading: 'What it is',
      paragraphs: [
        'Agent memory and context engineering are the data-structure layer underneath long-running AI agents. Memory decides what is persisted outside the model window: notes, traces, source ledgers, embeddings, graph facts, user preferences, and reusable instructions. Context engineering decides which of those records should be placed into the model window for the next action. They are related, but not the same problem.',
        'MemGPT names the core constraint directly: LLMs are limited by finite context windows, so the system needs virtual context management inspired by operating-system memory hierarchy: https://arxiv.org/abs/2310.08560. Anthropic frames the practical engineering levers as compaction, structured note-taking, and sub-agent architectures for long-horizon agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents. LangChain summarizes the same space as writing, selecting, compressing, and isolating context: https://www.langchain.com/blog/context-engineering-for-agents.',
      ],
    },
    {
      heading: 'Architecture',
      paragraphs: [
        'A production agent should have a working context, an episodic trace, a scratchpad or note store, a semantic index, optional temporal graph memory, procedural memory, and a prompt-packing policy. The working context holds only what the next step needs. The episodic trace stores raw observations and tool outputs. The scratchpad stores progress and unresolved decisions. The semantic index retrieves similar memories. A temporal graph stores facts that change over time and keeps validity windows. Procedural memory stores stable rules such as repo conventions, style guides, or tool preferences.',
        'The key design rule is provenance first. Write the raw episode before generating summaries, tags, embeddings, or graph edges. Graphiti and Zep make this explicit with episodes as ground-truth streams, entity/fact edges, temporal validity, and hybrid retrieval across vector, full-text, and graph traversal: https://github.com/getzep/graphiti and https://www.getzep.com/platform/graphiti/. The Zep repository describes a graph-RAG path where messages, business data, and events are extracted into a temporal graph, then retrieved as relationship-aware context blocks: https://github.com/getzep/zep.',
      ],
    },
    {
      heading: 'Memory data structures',
      paragraphs: [
        'Different memories answer different queries. A write-ahead episode log answers, "What actually happened?" A note file answers, "What did we decide?" A vector store answers, "What past material is semantically close?" A temporal graph answers, "Which fact is true for this entity at this time?" A source ledger answers, "What evidence supports this claim?" Treating all of these as one vector database creates brittle retrieval because similarity alone does not know authority, freshness, permissions, or contradiction.',
        'A-MEM pushes beyond append-only memory by using a Zettelkasten-style network of linked notes. New memories receive structured attributes, tags, keywords, contextual descriptions, and links to older memories; the system can also update older memory representations as new information arrives: https://arxiv.org/abs/2502.12110 and https://github.com/agiresearch/A-mem. That makes memory more adaptive, but it also raises operational requirements: versioning, source links, conflict handling, and rollback become part of the memory system.',
      ],
    },
    {
      heading: 'Context packing and compaction',
      paragraphs: [
        'A prompt pack should be assembled like a cache line for the next action. Pinned instructions, the current task, recent state, retrieved evidence, selected notes, and parsed tool results compete for the same attention budget. Raw transcripts are usually bad prompt packs because they include stale turns, redundant tool output, hidden contradictions, and old assumptions. Good systems rank, trim, summarize, and isolate before calling the model.',
        'Compaction is the common long-horizon move: summarize a nearly full conversation, start a fresh context, and preserve the details that future decisions need. Anthropic notes that compaction should preserve architectural decisions, unresolved bugs, implementation details, and recent files while clearing redundant tool calls and results. This is a data-structure problem, not just a writing task: the summary must be checkable against the trace, and the trace must remain available if the summary drops an important nuance. Agent Model Router & Context Handoff Ledger applies the same rule at ownership boundaries, where a context capsule replaces transcript sprawl.',
      ],
    },
    {
      heading: 'Complete case study: coding and research agent',
      paragraphs: [
        'Imagine a coding agent working on this educational repo for several days. The working context contains the current topic, selected source links, the exact files being edited, and the validation command. The episodic trace stores every command, screenshot path, article word count, and browser result. The note store records durable decisions such as "validate with route smoke checks, not unit tests" and "source-backed modules should include at least two primary links." The semantic index retrieves older topics with similar animations. The source ledger keeps arXiv, official docs, and local PDF evidence separate from the final article prose.',
        'When the user asks for another module, the context pack should not include the entire week of transcripts. It should include the current goal, the latest repo conventions, the most relevant prior topic files, source links for the chosen concept, and the validation pattern. If the agent finds a contradiction, such as a source claim that changed after an older module was written, the temporal graph should keep both facts with dates instead of silently overwriting history. Distributed Tracing explains the runtime view; Prompt Injection Threat Model explains why retrieved pages must be treated as untrusted input; Zanzibar Authorization Case Study explains why private memories need access control; Temporal Workflow Case Study explains how multi-hour work survives restarts.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'The most common mistake is believing that a larger context window removes the need for memory design. Larger windows reduce pressure, but they do not solve context poisoning, stale facts, privacy leaks, low-authority memories, source-less recollection, irrelevant tokens distracting the model, or Lost in the Middle behavior where evidence in different positions is used unevenly. Another mistake is over-compression: a neat summary can erase a subtle constraint that becomes critical later. The cure is layered memory, provenance, ranking, recency, authorization, and evaluation of the prompt pack itself.',
        'Primary sources: MemGPT at https://arxiv.org/abs/2310.08560, Anthropic context engineering at https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents, LangChain context engineering at https://www.langchain.com/blog/context-engineering-for-agents, Graphiti at https://github.com/getzep/graphiti, Zep Graphiti platform notes at https://www.getzep.com/platform/graphiti/, Zep examples at https://github.com/getzep/zep, A-MEM at https://arxiv.org/abs/2502.12110, and the A-MEM implementation at https://github.com/agiresearch/A-mem. Study Agent Model Router & Context Handoff Ledger, Titans Test-Time Neural Memory Case Study, Agentic AI Patterns, Deep Research Agent Architecture, Claim Graph & Source Ledger, RAG Pipeline, Multi-Index RAG, LightRAG, Lost in the Middle: Long-Context Failure Modes, Semantic Cache for LLMs, KV Cache, LRU Cache, Distributed Tracing, Prompt Injection Threat Model, Zanzibar Authorization Case Study, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
