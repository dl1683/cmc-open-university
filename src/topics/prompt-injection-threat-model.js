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
    explanation: 'The graph shows the broken boundary: the app knows system text, user text, and retrieved text have different trust levels, but the model receives one mixed token stream. Prompt injection exploits that collapse.',
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
    explanation: 'The matrix separates entry points by who planted the instruction. Direct injection comes from the user; indirect injection waits inside retrieved pages, documents, tickets, or tool output until the app reads it.',
    invariant: 'Treat external content as hostile even when it arrived through retrieval.',
  };

  yield {
    state: boundaryGraph('The model becomes a confused deputy'),
    highlight: { active: ['retrieval', 'prompt', 'model', 'tool', 'secret', 'e-retrieval-prompt', 'e-prompt-model', 'e-model-tool', 'e-tool-secret'], removed: ['output'] },
    explanation: 'The confused-deputy path is the real danger. The attacker never touches the privileged tool; malicious content steers the model, and the model invokes the tool with someone else\'s authority.',
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
    explanation: 'The target matrix keeps the threat model concrete. The serious failures are private-data leakage, unauthorized actions, policy extraction, and corrupted decisions, not merely rude or jailbreak-like text.',
  };
}

function* defenseLayers() {
  yield {
    state: defenseGraph('Defense belongs outside the model too'),
    highlight: { active: ['ingest', 'prompt', 'model', 'policy', 'tool', 'e-ingest-prompt', 'e-prompt-model', 'e-model-policy', 'e-model-tool'], found: ['log'] },
    explanation: 'The defense graph moves trust decisions outside the prompt. Labels, scoped retrieval, output checks, tool gates, logs, and human escalation reduce blast radius because no single instruction can create a hard boundary.',
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
    explanation: 'Each control belongs to a boundary. Retrieval controls decide what enters context; output controls decide what leaves the model; tool controls decide what can change the world.',
  };

  yield {
    state: defenseGraph('Tool gates should ignore model enthusiasm'),
    highlight: { active: ['model', 'policy', 'tool', 'human', 'log', 'e-model-policy', 'e-model-tool', 'e-policy-human', 'e-tool-log'], removed: ['retrieval'] },
    explanation: 'The model can propose an action, but the gate must decide authorization. Typed schemas, approval flows, rate limits, and audit logs matter because they are deterministic checks outside model persuasion.',
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
    explanation: 'The bad-defense table shows why text filters are not enough. Constrained decoding can make a tool call valid JSON, but only policy and authorization can decide whether the action is allowed.',
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
    explanation: 'The checklist turns a threat model into artifacts. Trust maps, permission tables, data-flow diagrams, attack corpora, and traces make prompt-injection risk inspectable and rerunnable.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Prompt injection is a security problem created by putting language models inside applications that read text and act. The vulnerable pattern is simple: text that should be treated as data changes the model behavior as if it were an instruction. OWASP lists prompt injection as LLM01 in its 2025 LLM risk taxonomy: https://genai.owasp.org/llmrisk/llm01-prompt-injection/.',
        {type: 'callout', text: 'Prompt injection is a boundary failure: untrusted text reaches a model that can speak with application authority.'},
        'The dangerous part is not a magic jailbreak phrase. The dangerous part is boundary collapse. The application knows the difference between system policy, user request, retrieved document, tool output, private data, and approval state. The model receives all of it as tokens. Once an app adds retrieval, memory, browser access, email, code execution, or business tools, an attacker can plant instructions in content the model later consumes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious defense is to tell the model to ignore hostile instructions. That can reduce casual failures, but it is not a security boundary. The model still sees trusted and untrusted text in the same context and still has to decide which words to obey.',
        'The wall is that prompt text has no parameterized-query equivalent. A database can distinguish SQL code from a bound string parameter. Current LLM applications usually ask one model to interpret instructions and data together. That means the realistic target is not perfect prevention inside the prompt. The target is smaller blast radius, better isolation, stronger gates, and rerunnable evidence when something goes wrong.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat the model as an untrusted reasoner, not as the authority boundary. It can propose, summarize, classify, and draft actions, but deterministic systems should decide what text enters context, what private data is exposed, what tools can run, and whether a proposed side effect is authorized.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A prompt-injection review is a data-flow problem: track untrusted source nodes to privileged action sinks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'This is a confused-deputy problem. The attacker may not have direct access to the privileged tool. Instead, the attacker places text in a web page, issue comment, email, PDF, ticket, or tool response. The application retrieves that content. The model interprets it. If the model then leaks private context or invokes a tool, the attacker has borrowed the application authority.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Direct injection arrives from the user message itself. Indirect injection arrives from content the application reads on the user behalf: a retrieved page, document, calendar invite, repository file, log line, database cell, or API response. Stored injection waits in durable data until a later run consumes it.',
        'A typical failure path has five steps. First, the app collects trusted policy and untrusted content. Second, it builds one model context. Third, the model treats hostile data as an instruction or allows it to reshape priorities. Fourth, the model emits a tool call, answer, or hidden-state decision. Fifth, the surrounding application trusts that output too much.',
        'The papers "Not what you have signed up for" and HouYi both study this attack surface for LLM-integrated applications: https://arxiv.org/abs/2302.12173 and https://arxiv.org/abs/2306.05499. Their practical lesson is that indirect content can steer systems even when the attacker never touches the prompt template.',
      ],
    },
    {
      heading: 'Why layered defense works',
      paragraphs: [
        'Layered defense works because it moves authority out of the model. Retrieval filters enforce access control before content is added. Trust labels preserve provenance. Context builders minimize private data. Schemas make output parseable. Policy engines decide authorization. Approval gates handle high-impact actions. Logs make attacks reproducible.',
        {type: 'image', src: 'https://docs.oracle.com/en/cloud/paas/integration-cloud/rest-api-fs/images/oauth-flow.png', alt: 'OAuth authorization flow showing client resource owner authorization server and resource server', caption: 'Authorization flows separate request intent from resource authority, the same separation agent tool gates need. Source: Oracle documentation, https://docs.oracle.com/en/cloud/paas/integration-cloud/rest-api-fs/oauth-auth-code-credentials.html.'},
        'No single layer is enough. A schema can prove that a tool call is valid JSON, but it cannot prove that sending the email is allowed. A system prompt can express policy, but it cannot prove the model followed it. A classifier can flag suspicious text, but attackers adapt. Defense improves when each layer reduces one concrete permission, data exposure, or action path.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The threat matters most when a model reads untrusted text and has access to private data or external systems. Enterprise RAG over Slack, Drive, GitHub, tickets, legal documents, and email is exposed to indirect injection. Coding agents are exposed through repository files, issue comments, logs, dependency output, and test failures. Browser agents are exposed through pages they visit. Customer-support agents are exposed through attachments and prior conversation history.',
        'The defensive counterpart connects to existing system design topics. RAG should apply authorization before retrieval, not after generation. Constrained decoding can make tool calls parseable, not safe. Zanzibar-style authorization computes permissions outside the model. Taint analysis tracks untrusted sources toward sensitive sinks. Distributed tracing preserves the evidence chain from retrieved text to tool side effect.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is overclaiming. Prompt injection is not "solved" by a better prompt, a hidden policy, or a deny list. Attackers can rephrase, encode, translate, split instructions across sources, or exploit tool observations that look normal.',
        'The second failure mode is treating validation as authorization. A JSON tool call can be valid and still be forbidden. A cited answer can quote real text and still violate confidentiality. A clean malware scan can miss a social instruction. Security checks must ask what authority is being exercised, not only whether output has the right shape.',
        'The third failure mode is making the model carry secrets it does not need. If a system prompt contains sensitive internal rules, or if the context pack includes private documents unrelated to the user request, the application has already widened the blast radius before the model answers.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with a trust map. Mark each text source as user, system, retrieved, tool observation, memory, private record, or external public content. Then build a permission table for each tool: who can call it, what arguments are allowed, what approval is required, and what data it may read.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branch and leaf decisions', caption: 'Policy review should branch on source trust, requested authority, data class, and side effect before any tool call runs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.'},
        'Use least privilege at runtime. Retrieval should filter by ACL before ranking. Tools should run with scoped credentials. High-impact actions should require human approval or a deterministic policy engine. The model output should be treated as a proposal that passes through schema checks, semantic checks, authorization checks, and audit logging.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Good defenses add friction. Narrower retrieval can miss helpful context. Approval gates slow automation. Tool scopes require product work. Logs and traces need storage, redaction, and access control. These costs are real, so they should be tied to concrete authority: private data exposure, money movement, account mutation, code execution, external communication, or policy decisions.',
        'The tradeoff is that a looser system is cheaper only until it fails. A customer-support bot that can draft a reply may tolerate lighter controls. An agent that can refund orders, send email, read internal documents, or modify repositories needs stronger gates because prompt injection turns ordinary content into an attempted control channel.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The attack-surface graph shows the boundary collapse. The app has different trust levels, but the model sees one context stream. The dangerous edge is not just untrusted text entering the prompt; it is untrusted text influencing a privileged tool, secret, or decision.',
        'The defense graph shows where controls belong. Retrieval controls decide what enters context. Output controls decide what leaves the model. Tool gates decide what can change the world. The model can help explain or propose, but the gate must ignore model enthusiasm when policy says no.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary and official sources: OWASP LLM01:2025 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, OWASP Top 10 for LLM Applications at https://owasp.org/www-project-top-10-for-large-language-model-applications/, NIST Adversarial Machine Learning taxonomy at https://csrc.nist.gov/pubs/ai/100/2/e2025/final, Not what you have signed up for at https://arxiv.org/abs/2302.12173, and Prompt Injection attack against LLM-integrated Applications at https://arxiv.org/abs/2306.05499.',
        'Study Agent Tool Permission Lattice, Seccomp BPF Sandbox Policy, Taint Analysis Source-to-Sink Case Study, Data-Flow Worklist Analysis, Agentic AI Patterns: Planning, Tools, Memory, RAG Pipeline, Constrained Decoding, Zanzibar Authorization Case Study, Capability Security and Attenuation, OPA Rego Policy Decision Graph, and Distributed Tracing next.',
      ],
    },
],
};

