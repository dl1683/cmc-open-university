// Prompt injection threat model: the LLM sees one context stream, while the
// application must enforce trust boundaries around data, tools, and secrets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prompt-injection-threat-model',
  title: 'Prompt Injection Threat Model',
  category: 'AI & ML',
  summary: 'Model direct and indirect prompt injection as a confused-deputy problem across context, retrieval, tools, secrets, and traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['attack surface', 'defense layers'], defaultValue: 'attack surface' },
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

function boundaryGraph(title) {
  return graphState({
    nodes: [
      { id: 'system', label: 'system', x: 1.0, y: 1.7, note: 'trusted' },
      { id: 'user', label: 'user', x: 1.0, y: 4.9, note: 'direct' },
      { id: 'retrieval', label: 'web doc', x: 3.2, y: 6.1, note: 'indirect' },
      { id: 'prompt', label: 'context', x: 3.4, y: 3.4, note: 'mixed' },
      { id: 'model', label: 'model', x: 5.2, y: 3.4, note: 'tokens' },
      { id: 'tool', label: 'tool', x: 7.1, y: 1.9, note: 'action' },
      { id: 'secret', label: 'private', x: 7.1, y: 5.3, note: 'data' },
      { id: 'output', label: 'output', x: 9.0, y: 3.4, note: 'effect' },
      { id: 'trace', label: 'trace', x: 9.0, y: 6.2, note: 'audit' },
    ],
    edges: [
      { id: 'e-system-prompt', from: 'system', to: 'prompt' },
      { id: 'e-user-prompt', from: 'user', to: 'prompt' },
      { id: 'e-retrieval-prompt', from: 'retrieval', to: 'prompt' },
      { id: 'e-prompt-model', from: 'prompt', to: 'model' },
      { id: 'e-model-tool', from: 'model', to: 'tool' },
      { id: 'e-tool-secret', from: 'tool', to: 'secret' },
      { id: 'e-secret-model', from: 'secret', to: 'model' },
      { id: 'e-model-output', from: 'model', to: 'output' },
      { id: 'e-output-trace', from: 'output', to: 'trace' },
      { id: 'e-tool-trace', from: 'tool', to: 'trace' },
    ],
  }, { title });
}

function defenseGraph(title) {
  return graphState({
    nodes: [
      { id: 'ingest', label: 'ingest', x: 0.9, y: 3.6, note: 'label' },
      { id: 'retrieval', label: 'retrieve', x: 2.6, y: 5.4, note: 'scope' },
      { id: 'prompt', label: 'prompt', x: 3.0, y: 2.2, note: 'separate' },
      { id: 'model', label: 'model', x: 4.9, y: 3.7, note: 'untrusted' },
      { id: 'policy', label: 'policy', x: 6.8, y: 2.0, note: 'rules' },
      { id: 'tool', label: 'tool gate', x: 6.8, y: 5.2, note: 'least priv' },
      { id: 'human', label: 'human', x: 8.7, y: 2.0, note: 'review' },
      { id: 'log', label: 'logs', x: 8.7, y: 5.2, note: 'detect' },
    ],
    edges: [
      { id: 'e-ingest-retrieval', from: 'ingest', to: 'retrieval' },
      { id: 'e-ingest-prompt', from: 'ingest', to: 'prompt' },
      { id: 'e-retrieval-model', from: 'retrieval', to: 'model' },
      { id: 'e-prompt-model', from: 'prompt', to: 'model' },
      { id: 'e-model-policy', from: 'model', to: 'policy' },
      { id: 'e-model-tool', from: 'model', to: 'tool' },
      { id: 'e-policy-human', from: 'policy', to: 'human' },
      { id: 'e-tool-log', from: 'tool', to: 'log' },
      { id: 'e-policy-log', from: 'policy', to: 'log' },
    ],
  }, { title });
}

function* attackSurface() {
  yield {
    state: boundaryGraph('Trusted and untrusted text collapse into one context'),
    highlight: { active: ['system', 'user', 'retrieval', 'prompt', 'model', 'e-system-prompt', 'e-user-prompt', 'e-retrieval-prompt', 'e-prompt-model'], compare: ['tool', 'secret'] },
    explanation: 'Prompt injection starts at the context boundary. The application knows which text is trusted instruction and which text is untrusted data. The model receives one token stream and may treat hostile data as an instruction.',
  };

  yield {
    state: labelMatrix(
      'Direct and indirect prompt injection',
      [
        { id: 'direct', label: 'direct' },
        { id: 'indirect', label: 'indirect' },
        { id: 'stored', label: 'stored' },
        { id: 'tool', label: 'tool output' },
      ],
      [
        { id: 'entry', label: 'entry point' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['user message', 'ignores app policy'],
        ['retrieved page', 'remote attacker steers model'],
        ['document or ticket', 'payload waits in data'],
        ['API result', 'observation becomes command'],
      ],
    ),
    highlight: { active: ['direct:entry', 'indirect:entry', 'stored:entry', 'tool:entry'], found: ['indirect:risk', 'tool:risk'] },
    explanation: 'The important distinction is who planted the instruction. A direct attacker talks to the app. An indirect attacker poisons content the app later retrieves, summarizes, or passes through a tool.',
    invariant: 'Treat external content as hostile even when it arrived through retrieval.',
  };

  yield {
    state: boundaryGraph('The model becomes a confused deputy'),
    highlight: { active: ['retrieval', 'prompt', 'model', 'tool', 'secret', 'e-retrieval-prompt', 'e-prompt-model', 'e-model-tool', 'e-tool-secret'], removed: ['output'] },
    explanation: 'The attacker does not need direct access to the privileged tool. If the model reads malicious content and then calls a tool with the user or service account privileges, the model is acting as a confused deputy.',
  };

  yield {
    state: labelMatrix(
      'What the attacker wants',
      [
        { id: 'leak', label: 'exfiltrate' },
        { id: 'act', label: 'unauthorized action' },
        { id: 'steal', label: 'prompt theft' },
        { id: 'poison', label: 'decision poison' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'control', label: 'needed control' },
      ],
      [
        ['private context', 'data minimization'],
        ['tool or API', 'least privilege gate'],
        ['system prompt', 'no secret policies'],
        ['ranking or answer', 'source trust labels'],
      ],
    ),
    highlight: { active: ['leak:control', 'act:control', 'poison:control'], compare: ['steal:target'] },
    explanation: 'Prompt injection is not only about jailbreak text. The serious cases are data leakage, unauthorized tool use, hidden policy extraction, and corrupted business decisions.',
  };
}

function* defenseLayers() {
  yield {
    state: defenseGraph('Defense belongs outside the model too'),
    highlight: { active: ['ingest', 'prompt', 'model', 'policy', 'tool', 'e-ingest-prompt', 'e-prompt-model', 'e-model-policy', 'e-model-tool'], found: ['log'] },
    explanation: 'No single prompt can fully separate data from instructions. Defense in depth means labeling trust, minimizing context, validating outputs, gating tools, logging actions, and escalating risky cases.',
  };

  yield {
    state: labelMatrix(
      'Layered controls',
      [
        { id: 'context', label: 'context' },
        { id: 'retrieval', label: 'retrieval' },
        { id: 'output', label: 'output' },
        { id: 'tools', label: 'tools' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'why', label: 'why' },
      ],
      [
        ['trust labels and quoting', 'make roles explicit'],
        ['ACL filters before search', 'avoid data leaks'],
        ['schema and semantic checks', 'reject unsafe payloads'],
        ['least privilege and approval', 'limit blast radius'],
        ['trace and anomaly alerts', 'catch probing'],
      ],
    ),
    highlight: { found: ['context:control', 'retrieval:control', 'output:control', 'tools:control', 'ops:control'] },
    explanation: 'The controls map to boundaries. Retrieval controls decide what enters context. Output controls decide what leaves the model. Tool controls decide what changes the world.',
  };

  yield {
    state: defenseGraph('Tool gates should ignore model enthusiasm'),
    highlight: { active: ['model', 'policy', 'tool', 'human', 'log', 'e-model-policy', 'e-model-tool', 'e-policy-human', 'e-tool-log'], removed: ['retrieval'] },
    explanation: 'A model can propose an action; a deterministic gate should decide whether it is allowed. This is where authorization, typed schemas, approval flows, rate limits, and audit logs matter.',
    invariant: 'Never let the model be the only authority over a privileged action.',
  };

  yield {
    state: labelMatrix(
      'Bad defenses and better replacements',
      [
        { id: 'deny', label: 'deny-list phrases' },
        { id: 'hidden', label: 'hidden prompt rules' },
        { id: 'parse', label: 'parseable output only' },
        { id: 'firewall', label: 'single firewall' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'replacement', label: 'replacement' },
      ],
      [
        ['easy to rephrase', 'threat model and evals'],
        ['can be leaked or ignored', 'external policy gate'],
        ['valid can still be harmful', 'semantic validation'],
        ['residual risk remains', 'defense in depth'],
      ],
    ),
    highlight: { removed: ['deny:problem', 'hidden:problem'], active: ['parse:replacement', 'firewall:replacement'] },
    explanation: 'Prompt injection is a systems problem, not a regex problem. Constrained Decoding can guarantee shape, but a valid JSON tool call can still be the wrong or forbidden action.',
  };

  yield {
    state: labelMatrix(
      'Security review checklist',
      [
        { id: 'sources', label: 'sources' },
        { id: 'privs', label: 'privileges' },
        { id: 'state', label: 'state' },
        { id: 'tests', label: 'tests' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['which text is untrusted?', 'trust map'],
        ['what can the model trigger?', 'tool permission table'],
        ['what is stored or retrieved?', 'data-flow diagram'],
        ['what attack set is used?', 'red-team corpus'],
      ],
    ),
    highlight: { active: ['sources:artifact', 'privs:artifact', 'state:artifact', 'tests:artifact'] },
    explanation: 'A useful review produces artifacts: trust map, permission table, data-flow diagram, attack corpus, and traces. That is how prompt-injection risk becomes inspectable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'attack surface') yield* attackSurface();
  else if (view === 'defense layers') yield* defenseLayers();
  else throw new InputError('Pick a prompt-injection view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Prompt injection is a vulnerability in LLM-integrated applications where text supplied as data changes the model behavior as if it were an instruction. OWASP lists prompt injection as LLM01 in its 2025 LLM risk taxonomy: https://genai.owasp.org/llmrisk/llm01-prompt-injection/. The core problem is not that a user says a magic phrase. The problem is that the model reads system instructions, user requests, retrieved documents, tool outputs, and hidden text as one context stream.',
        'This is why prompt injection is tightly linked to Agentic AI Patterns: Planning, Tools, Memory. The more an application retrieves external data and calls tools, the more an attacker can place hostile instructions in content the model later consumes. The model may then act with privileges the attacker does not have.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Direct prompt injection comes from the user talking to the app. Indirect prompt injection comes from external content: a web page, email, PDF, support ticket, calendar invite, repository file, or tool response. The paper Not what you have signed up for describes this as a new attack vector for LLM-integrated applications because untrusted content can remotely influence an application that retrieves it: https://arxiv.org/abs/2302.12173.',
        'The security shape is a confused-deputy graph. The attacker cannot call the privileged tool directly. Instead, they put instructions into content. The app retrieves that content. The model mixes it with trusted instructions. If the model then calls an API, leaks private context, or changes a decision, the attacker has coerced a more privileged component. The HouYi paper studied black-box prompt injection against real LLM-integrated apps and reported severe outcomes such as prompt theft and arbitrary LLM usage: https://arxiv.org/abs/2306.05499.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Prompt-injection defense is hard because there is no parameterized-query equivalent for current LLM prompts. The UK NCSC blog Prompt injection is not SQL injection, published December 8, 2025, argues that LLMs do not enforce an inherent boundary between data and instructions inside a prompt: https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection. That means the practical goal is reducing likelihood and blast radius, not claiming perfect prevention.',
        'The cost appears in product design. Retrieval needs source labels and authorization filters before context construction. Tool calls need typed schemas, deterministic policy checks, least-privilege credentials, approval gates, and rate limits. Output needs validation. Operations needs Distributed Tracing over prompts, retrieved chunks, tool calls, and side effects so attacks can be detected and reproduced.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The threat matters most when LLMs read untrusted text and can affect private data or external systems. Enterprise RAG over Slack, Drive, GitHub, tickets, legal documents, and email is exposed to indirect injection. Coding agents are exposed through repository files, issue comments, logs, and package output. Browser agents are exposed through pages they visit. Customer-support agents are exposed through user-provided attachments and prior conversation history.',
        'The defensive counterpart connects to existing topics. Multi-Index RAG should filter access-control boundaries before retrieval. Constrained Decoding can make tool calls parseable, but cannot prove they are authorized. Zanzibar Authorization Case Study gives the right authorization instinct: compute permissions outside the model. Adversarial Examples & FGSM gives the broader robustness habit: evaluate against an adaptive attacker, not only normal inputs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that prompt injection is solved by telling the model to ignore malicious instructions. That may reduce casual failures, but it does not create a security boundary. The second misconception is that deny-listing phrases such as ignore previous instructions is enough. Attackers can rephrase, encode, hide, translate, or stage instructions across multiple retrieved documents.',
        'The third misconception is that valid structured output is safe output. A JSON object can be valid and still request a forbidden transfer, query, email, or file edit. Use schema checks for shape, semantic checks for meaning, authorization checks for privilege, and human approval for high-impact ambiguity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: OWASP LLM01:2025 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, OWASP Top 10 for LLM Applications at https://owasp.org/www-project-top-10-for-large-language-model-applications/, NIST Adversarial Machine Learning taxonomy at https://csrc.nist.gov/pubs/ai/100/2/e2025/final, Not what you have signed up for at https://arxiv.org/abs/2302.12173, and Prompt Injection attack against LLM-integrated Applications at https://arxiv.org/abs/2306.05499. Study LLM Guardrail Policy Engine, Agent Tool Permission Lattice, Agent Payments Protocol Mandate Ledger Case Study, Seccomp BPF Sandbox Policy, Taint Analysis Source-to-Sink Case Study, Data-Flow Worklist Analysis, Agentic AI Patterns: Planning, Tools, Memory, RAG Pipeline, Multi-Index RAG, Constrained Decoding, Zanzibar Authorization Case Study, Capability Security & Attenuation, OPA Rego Policy Decision Graph, and Distributed Tracing next.',
      ],
    },
  ],
};
