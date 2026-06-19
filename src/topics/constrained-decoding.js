// Constrained decoding: turn format rules into token masks so an LLM can only
// emit tokens that keep the output valid.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'constrained-decoding',
  title: 'Constrained Decoding',
  category: 'AI & ML',
  summary: 'Guarantee JSON, regex, or grammar structure by masking invalid next tokens during generation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['json schema', 'grammar mask'], defaultValue: 'json schema' },
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

function automaton(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.6, y: 3.8, note: 'empty' },
      { id: 'open', label: '{', x: 2.0, y: 3.8, note: 'object' },
      { id: 'key', label: '"city"', x: 3.7, y: 2.4, note: 'key' },
      { id: 'colon', label: ':', x: 5.0, y: 2.4, note: 'separator' },
      { id: 'value', label: '"Paris"', x: 6.7, y: 2.4, note: 'value' },
      { id: 'comma', label: ',', x: 5.0, y: 5.1, note: 'next field' },
      { id: 'close', label: '}', x: 8.3, y: 3.8, note: 'valid JSON' },
    ],
    edges: [
      { id: 'e-start-open', from: 'start', to: 'open', weight: 'only {' },
      { id: 'e-open-key', from: 'open', to: 'key', weight: 'required key' },
      { id: 'e-key-colon', from: 'key', to: 'colon', weight: ':' },
      { id: 'e-colon-value', from: 'colon', to: 'value', weight: 'string' },
      { id: 'e-value-comma', from: 'value', to: 'comma', weight: 'optional more' },
      { id: 'e-value-close', from: 'value', to: 'close', weight: 'finish' },
      { id: 'e-comma-key', from: 'comma', to: 'key', weight: 'next key' },
    ],
  }, { title });
}

function* jsonSchema() {
  yield {
    state: automaton('A schema becomes a next-token state machine'),
    highlight: { active: ['start', 'e-start-open', 'open'], compare: ['key', 'colon', 'value', 'close'] },
    explanation: 'A JSON schema can be compiled into a state machine. At the start of an object, "{" is legal and almost everything else is illegal. The model still ranks possible text; the decoder enforces which tokens keep the partial output parseable.',
  };

  yield {
    state: labelMatrix(
      'At each state, invalid tokens are masked out',
      [
        { id: 's0', label: 'start' },
        { id: 's1', label: 'after {' },
        { id: 's2', label: 'after key' },
        { id: 's3', label: 'after value' },
      ],
      [
        { id: 'open', label: '{' },
        { id: 'city', label: '"city"' },
        { id: 'colon', label: ':' },
        { id: 'close', label: '}' },
      ],
      [
        ['allow', 'mask', 'mask', 'mask'],
        ['mask', 'allow', 'mask', 'mask'],
        ['mask', 'mask', 'allow', 'mask'],
        ['mask', 'mask', 'mask', 'allow'],
      ],
    ),
    highlight: { active: ['s0:open', 's1:city', 's2:colon', 's3:close'], removed: ['s0:city', 's1:close'] },
    explanation: 'The decoder converts grammar state into a vocabulary mask. Illegal tokens get probability zero before sampling, then the legal probabilities are renormalized. Structure is guaranteed because invalid continuations never enter the sample set.',
    invariant: 'The model ranks legal continuations; the constraint system defines legality.',
  };

  yield {
    state: labelMatrix(
      'The JSON object is built one legal token at a time',
      [
        { id: 'step1', label: 'step 1' },
        { id: 'step2', label: 'step 2' },
        { id: 'step3', label: 'step 3' },
        { id: 'step4', label: 'step 4' },
      ],
      [
        { id: 'token', label: 'chosen token' },
        { id: 'state', label: 'new state' },
        { id: 'why', label: 'why valid' },
      ],
      [
        ['{', 'object opened', 'only legal start'],
        ['"city"', 'field selected', 'required property'],
        ['"Paris"', 'value accepted', 'string type'],
        ['}', 'object closed', 'required fields done'],
      ],
    ),
    highlight: { found: ['step1:token', 'step2:token', 'step3:token', 'step4:token'] },
    explanation: 'The output is not repaired after generation. It is never allowed to leave the grammar. That distinction matters for APIs: the caller can parse the result without a retry loop for malformed JSON.',
  };

  yield {
    state: labelMatrix(
      'Where constraints help',
      [
        { id: 'tool', label: 'tool call' },
        { id: 'json', label: 'JSON API' },
        { id: 'sql', label: 'SQL subset' },
        { id: 'regex', label: 'regex field' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'risk', label: 'remaining risk' },
      ],
      [
        ['function signature', 'wrong argument value'],
        ['schema', 'unsupported claim'],
        ['grammar', 'semantic bug or injection'],
        ['regular language', 'format valid but meaningless'],
      ],
    ),
    highlight: { active: ['tool:constraint', 'json:constraint', 'sql:constraint'], compare: ['tool:risk', 'sql:risk'] },
    explanation: 'Constrained decoding guarantees shape, not truth. It can make a tool call parseable, but it cannot prove the chosen city, price, SQL predicate, or citation is correct.',
  };
}

function* grammarMask() {
  yield {
    state: labelMatrix(
      'Grammar engines avoid scanning the whole vocabulary naively',
      [
        { id: 'naive', label: 'naive mask' },
        { id: 'trie', label: 'vocab trie' },
        { id: 'fsm', label: 'finite-state mask' },
        { id: 'stack', label: 'CFG stack' },
      ],
      [
        { id: 'method', label: 'method' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['test every token', 'expensive at large vocab'],
        ['share token prefixes', 'fast prefix pruning'],
        ['precompute transitions', 'cheap regex constraints'],
        ['track nested grammar', 'harder but expressive'],
      ],
    ),
    highlight: { active: ['trie:method', 'fsm:method', 'stack:method'], compare: ['naive:cost'] },
    explanation: 'The core systems problem is not the idea of masking. It is making masks cheap enough that structure does not dominate decode time. Vocab tries, finite-state transitions, and grammar stacks sit directly in the generation hot path.',
  };

  yield {
    state: automaton('A regex-like constraint is a small automaton'),
    highlight: { active: ['open', 'key', 'colon', 'e-open-key', 'e-key-colon'], found: ['value'] },
    explanation: 'For regular constraints, the allowed-next-token set follows a finite-state transition. This connects directly to Finite-State Machine and Trie (Prefix Tree): the decoder is walking an automaton over token strings.',
  };

  yield {
    state: labelMatrix(
      'Mask then sample',
      [
        { id: 'model', label: 'model logits' },
        { id: 'mask', label: 'grammar mask' },
        { id: 'softmax', label: 'renormalize' },
        { id: 'sample', label: 'choose token' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'dependency', label: 'depends on' },
      ],
      [
        ['score every token', 'Transformer Block'],
        ['drop illegal tokens', 'current grammar state'],
        ['probabilities over legal set', 'Softmax & Temperature'],
        ['pick next token', 'sampling or Beam Search vs Greedy'],
      ],
    ),
    highlight: { found: ['model:job', 'mask:job', 'softmax:job', 'sample:job'] },
    explanation: 'The order is important: model logits, structural mask, renormalization, then sampling. If the legal set is empty, the system has a grammar or tokenization bug, not a model-quality problem.',
  };

  yield {
    state: labelMatrix(
      'Engineering tradeoffs',
      [
        { id: 'latency', label: 'latency' },
        { id: 'tokenization', label: 'tokenization' },
        { id: 'stream', label: 'streaming' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'challenge', label: 'challenge' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['mask computation can bottleneck', 'cache and precheck'],
        ['tokens split strings oddly', 'compile over token bytes'],
        ['partial output must remain valid prefix', 'prefix-closed states'],
        ['valid shape can still be unsafe', 'validate semantics too'],
      ],
    ),
    highlight: { active: ['latency:discipline', 'tokenization:discipline', 'safety:discipline'] },
    explanation: 'Structured generation is a runtime feature, not just a prompting style. The constraint engine must be fast, tokenization-aware, stream-friendly, and paired with semantic validation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'json schema') yield* jsonSchema();
  else if (view === 'grammar mask') yield* grammarMask();
  else throw new InputError('Pick a constrained decoding view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Constrained Decoding. Guarantee JSON, regex, or grammar structure by masking invalid next tokens during generation..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Constrained decoding exists because many language-model systems need output that software can parse on the first try. Tool calls need valid arguments. Extraction APIs need JSON objects with required fields. Agents need commands from a known action language. Database assistants may need a restricted SQL subset. A prompt that says "return valid JSON" is a request to the model. A constrained decoder is an enforcement mechanism in the generation loop.',
        'The idea is simple: the model still scores possible next tokens, but the decoder removes tokens that would make the partial output violate a schema, grammar, regular expression, or parser state. The remaining legal tokens are renormalized and sampled or selected. This changes the contract. Instead of generating free text and hoping a repair prompt can fix broken structure later, the system prevents malformed structure from being emitted in the first place.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is prompt discipline plus retry. Tell the model the format, parse the answer, and if parsing fails, ask it to fix the output. This can be good enough for demos, but it is weak infrastructure. It adds latency, creates retry storms under load, and still fails in edge cases. It also blurs responsibility: the model is being asked to remember syntax, obey instructions, solve the task, and repair its own mistakes.',
        'A second naive approach is post-processing. Generate unconstrained text, strip markdown fences, patch missing braces, fill missing fields, or run a best-effort parser. That can hide symptoms while introducing new errors. The repaired object may be syntactically valid but not what the model meant. Worse, repair logic can become a second fragile language interpreter. Constrained decoding moves the syntax rule to the only place where it can be guaranteed: before the next token is chosen.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate scoring from legality. The language model is good at ranking plausible continuations. The grammar engine is good at deciding which continuations preserve structure. Constrained decoding combines them by masking logits. Illegal tokens receive probability zero. Legal tokens keep their model scores and compete with each other. The result is still model-generated text, but it is generated inside a formal language boundary.',
        'This distinction matters because structure and meaning are different problems. A JSON schema can require a field named "city" and a string value. It cannot prove that the city exists, that it was extracted from the source, or that it is safe to pass into a tool. Constrained decoding guarantees shape. Semantic validation, authorization, grounding, and business rules still have to run after the object is produced.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A schema or grammar is compiled into a stateful acceptor. For a regular expression, that may be a finite-state machine. For nested JSON or a context-free grammar, it may be a parser state with a stack. At any point, the acceptor represents all valid ways the partial output can continue. The decoder asks this acceptor which token byte strings are legal next steps from the current state.',
        'The vocabulary makes this harder than it sounds. Models do not emit characters one by one. A token can contain a brace, a quote, a comma, a whole word, whitespace, or a partial string fragment. Efficient engines therefore compile constraints over token byte strings, often using a vocabulary trie, precomputed transitions, cached parser states, and special handling for strings and escapes. At each step the runtime computes a mask, applies it to model logits, renormalizes with softmax, samples or selects a token, and advances the parser state.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The schema visual proves that a format can be treated as a state machine. At the beginning of an object, an opening brace is legal and a closing brace or random field value is not. After a required key, a colon may be legal. After a value, a comma or closing brace may be legal depending on required fields. The model still chooses among legal content, but the decoder controls the structural transitions.',
        'The grammar-mask visual proves that data structures sit in the generation hot path. The order is model logits, legal-token mask, renormalization, and token choice. That loop runs for every generated token and for every active beam if beam search is used. A beautiful grammar that requires scanning every vocabulary token with a slow parser at each step can destroy latency. Practical constrained decoding is a systems problem as much as a formal-language problem.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because generation is incremental. Every invalid final string has a first token where it stopped being a valid prefix. If the decoder prevents that token, the final output cannot become invalid in that way. This is stronger than validation after the fact. Validation can reject a bad sample, but constrained decoding prevents the bad branch from entering the sample set.',
        'It also works because many output languages have compact state representations. Regular languages can be represented by finite-state machines. JSON schemas can be represented by parser states plus required-field bookkeeping. Context-free grammars can track nested structure with stacks. The model does not need to learn these rules from a prompt at inference time. The decoder already knows them and enforces them mechanically.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is latency. A naive mask checks every vocabulary token against the grammar on every decode step. With large vocabularies and long outputs, that can dominate generation. Efficient implementations precompute transitions, share prefixes with tries, cache common parser states, separate context-independent masks from state-dependent checks, and fuse mask application with sampling when possible. The constraint engine must be fast enough to sit beside optimized attention kernels without becoming the new bottleneck.',
        'The second cost is expressiveness versus usability. A narrow schema gives stronger guarantees and faster masks, but it may force awkward outputs. A broad grammar gives the model more room, but it can be slower and harder to validate semantically. The third cost is failure behavior. If the legal set becomes empty, the system has a grammar, tokenization, or state-management bug. If the model strongly prefers illegal continuations, output quality may degrade because the decoder must choose from weak legal alternatives.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Constrained decoding is used for tool calls, function arguments, API payloads, form extraction, browser automation commands, workflow agents, database filters, code-generation subsets, configuration files, and structured summaries. It is valuable wherever parse failures create operational cost. A tool-calling assistant can guarantee that the top-level object has the right function name and arguments. An extraction system can guarantee required keys and data types. A code assistant can stay inside a safe subset rather than emitting arbitrary text.',
        'It is also useful for streaming interfaces. If each partial output remains a valid prefix of the target language, clients can display or process data with more confidence. The constraint engine still has to handle partial strings, escaped characters, arrays, and required fields correctly. In multi-beam decoding, each beam must carry its own parser state. In speculative decoding, draft tokens must be checked against constraints before they are accepted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The biggest misconception is that constrained decoding makes an answer correct. It makes the answer structurally valid. A medical code can match a schema and still be the wrong code. A SQL query can match a grammar and still leak data. A tool call can have a parseable argument and still be unauthorized. Production systems should pair constrained decoding with semantic validation, permission checks, source grounding, range checks, and domain-specific review when the action matters.',
        'Tokenization is another common failure. A grammar written over characters has to be reconciled with tokens written over byte strings. Tokens may cross logical boundaries, include leading spaces, or represent fragments that are legal only inside strings. Unicode, escaping, and streaming partials add more edge cases. Finally, constraints can reduce diversity. If the schema is too rigid, the model may be forced into unnatural phrasing or low-probability values. The right schema is strict about machine contract and flexible about fields where genuine language variation is needed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Finite-State Machine, Trie (Prefix Tree), Tokenization (BPE), Softmax & Temperature, Beam Search vs Greedy, and JSON Schema Constrained Decoding Token Mask. Then study parser theory at the level needed to distinguish regular languages, context-free grammars, stacks, and required-field bookkeeping. For production context, read work such as Efficient Guided Generation for Large Language Models and XGrammar, then connect it to serving topics like speculative decoding, tool calling, validation ledgers, and agent safety. The key habit is to treat constrained decoding as one layer: syntax guarantee first, semantic correctness after.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Constrained Decoding moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

