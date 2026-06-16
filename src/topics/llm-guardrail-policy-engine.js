// LLM guardrail policy engines: deterministic control planes around model
// outputs, retrieval, tools, privileges, and audit traces.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-guardrail-policy-engine',
  title: 'LLM Guardrail Policy Engine',
  category: 'Systems',
  summary: 'A production guardrail stack for LLM apps: trust labels, output schemas, policy gates, tool permissions, escalation, and audit traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['policy pipeline', 'risk controls'], defaultValue: 'policy pipeline' },
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

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 3.7, note: 'user/doc' },
      { id: 'trust', label: 'trust map', x: 2.2, y: 1.6, note: 'labels' },
      { id: 'retrieve', label: 'retrieve', x: 2.2, y: 5.7, note: 'ACL' },
      { id: 'prompt', label: 'prompt', x: 3.8, y: 3.7, note: 'pack' },
      { id: 'model', label: 'model', x: 5.3, y: 3.7, note: 'untrusted' },
      { id: 'schema', label: 'schema', x: 6.9, y: 1.7, note: 'shape' },
      { id: 'policy', label: 'policy', x: 6.9, y: 3.7, note: 'meaning' },
      { id: 'tool', label: 'tool gate', x: 6.9, y: 5.8, note: 'effect' },
      { id: 'human', label: 'human', x: 8.6, y: 1.8, note: 'review' },
      { id: 'audit', label: 'audit', x: 8.6, y: 5.7, note: 'trace' },
      { id: 'effect', label: 'effect', x: 9.5, y: 3.7, note: 'allowed' },
    ],
    edges: [
      { id: 'e-input-trust', from: 'input', to: 'trust' },
      { id: 'e-input-retrieve', from: 'input', to: 'retrieve' },
      { id: 'e-trust-prompt', from: 'trust', to: 'prompt' },
      { id: 'e-retrieve-prompt', from: 'retrieve', to: 'prompt' },
      { id: 'e-prompt-model', from: 'prompt', to: 'model' },
      { id: 'e-model-schema', from: 'model', to: 'schema' },
      { id: 'e-model-policy', from: 'model', to: 'policy' },
      { id: 'e-model-tool', from: 'model', to: 'tool' },
      { id: 'e-schema-human', from: 'schema', to: 'human' },
      { id: 'e-policy-human', from: 'policy', to: 'human' },
      { id: 'e-tool-audit', from: 'tool', to: 'audit' },
      { id: 'e-policy-audit', from: 'policy', to: 'audit' },
      { id: 'e-tool-effect', from: 'tool', to: 'effect' },
    ],
  }, { title });
}

function* policyPipeline() {
  yield {
    state: policyGraph('Guardrails are a control plane around the model'),
    highlight: { active: ['input', 'trust', 'retrieve', 'prompt', 'model', 'e-input-trust', 'e-input-retrieve', 'e-trust-prompt', 'e-retrieve-prompt', 'e-prompt-model'], compare: ['effect'] },
    explanation: 'A guardrail policy engine starts before generation. It labels trust, filters retrieval by authorization, and assembles context so untrusted content is treated as evidence rather than instruction.',
  };

  yield {
    state: policyGraph('The model proposes; external gates decide'),
    highlight: { active: ['model', 'schema', 'policy', 'tool', 'human', 'audit', 'e-model-schema', 'e-model-policy', 'e-model-tool', 'e-policy-human', 'e-tool-audit'], found: ['effect'] },
    explanation: 'The model output is not the decision boundary. Constrained Decoding can enforce shape, but policy and tool gates decide whether the requested action is authorized, safe, reversible, and worth escalating.',
    invariant: 'Never make the model the only authority over a privileged side effect.',
  };

  yield {
    state: labelMatrix(
      'Guardrail layers',
      [
        { id: 'trust', label: 'trust labels' },
        { id: 'retrieval', label: 'retrieval ACL' },
        { id: 'schema', label: 'schema check' },
        { id: 'semantic', label: 'semantic policy' },
        { id: 'tool', label: 'tool gate' },
        { id: 'audit', label: 'audit trace' },
      ],
      [
        { id: 'catches', label: 'catches' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['mixed authority', 'bad action intent'],
        ['data leaks', 'bad answer wording'],
        ['malformed output', 'valid harmful call'],
        ['unsafe meaning', 'novel bypass'],
        ['unauthorized effect', 'bad explanation'],
        ['probing pattern', 'real-time block'],
      ],
    ),
    highlight: { active: ['schema:catches', 'semantic:catches', 'tool:catches', 'audit:catches'], compare: ['schema:misses'] },
    explanation: 'Each layer catches a different class of failure. A valid JSON object can still request a forbidden transfer. A safe-looking answer can still leak private data. Defense needs multiple gates with different jobs.',
  };

  yield {
    state: labelMatrix(
      'Tool-call decision table',
      [
        { id: 'read', label: 'read public doc' },
        { id: 'private', label: 'read private doc' },
        { id: 'draft', label: 'draft email' },
        { id: 'send', label: 'send email' },
        { id: 'delete', label: 'delete data' },
      ],
      [
        { id: 'privilege', label: 'privilege' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['none', 'allow and log'],
        ['user scoped', 'ACL check'],
        ['no side effect', 'allow preview'],
        ['external effect', 'confirm'],
        ['destructive', 'block or break-glass'],
      ],
    ),
    highlight: { active: ['read:decision', 'private:decision', 'draft:decision'], compare: ['send:decision'], removed: ['delete:decision'] },
    explanation: 'The control plane should classify effects. Reading a public page, reading private data, drafting text, sending a message, and deleting records are not the same operation, even if the model expresses all of them as tool calls.',
  };
}

function* riskControls() {
  yield {
    state: labelMatrix(
      'Prompt-injection response map',
      [
        { id: 'direct', label: 'direct override' },
        { id: 'indirect', label: 'indirect content' },
        { id: 'exfil', label: 'exfiltration' },
        { id: 'tool', label: 'tool abuse' },
        { id: 'drift', label: 'policy drift' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'proof', label: 'proof artifact' },
      ],
      [
        ['instruction hierarchy', 'prompt trace'],
        ['content quarantine', 'trust labels'],
        ['data minimization', 'redaction log'],
        ['least privilege', 'permission table'],
        ['eval regression', 'golden set'],
      ],
    ),
    highlight: { active: ['indirect:control', 'exfil:control', 'tool:control'], found: ['drift:proof'] },
    explanation: 'Prompt injection defense is not a single classifier. OWASP and NCSC both frame the risk as a systems problem around untrusted instructions, data flow, and privileged actions. The proof artifacts make the review concrete.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'automation level', min: 0, max: 5 }, y: { label: 'required proof', min: 0, max: 100 } },
      series: [
        { id: 'risk', label: 'risk', points: [{ x: 0, y: 5 }, { x: 1, y: 12 }, { x: 2, y: 25 }, { x: 3, y: 47 }, { x: 4, y: 72 }, { x: 5, y: 96 }] },
        { id: 'proof', label: 'proof budget', points: [{ x: 0, y: 15 }, { x: 1, y: 22 }, { x: 2, y: 38 }, { x: 3, y: 58 }, { x: 4, y: 82 }, { x: 5, y: 98 }] },
      ],
      markers: [
        { id: 'review', x: 3, y: 58, label: 'human review' },
      ],
    }),
    highlight: { active: ['risk', 'proof', 'review'] },
    explanation: 'The more autonomy a system has, the more proof it needs. Summarizing a public doc can be low risk. Sending email, changing permissions, or mutating customer data needs stronger gates and human review.',
  };

  yield {
    state: policyGraph('Audit logs turn attacks into regression tests'),
    highlight: { active: ['policy', 'tool', 'audit', 'human', 'e-policy-audit', 'e-tool-audit', 'e-policy-human'], compare: ['effect'], found: ['schema'] },
    explanation: 'Every blocked, escalated, and allowed high-risk action should create an audit event. Those events become red-team cases, golden-set regressions, abuse analytics, and incident-response evidence.',
  };

  yield {
    state: labelMatrix(
      'Bad guardrails and replacements',
      [
        { id: 'prompt', label: 'prompt-only rule' },
        { id: 'deny', label: 'deny-list regex' },
        { id: 'judge', label: 'one LLM judge' },
        { id: 'global', label: 'global admin token' },
        { id: 'silent', label: 'silent block' },
      ],
      [
        { id: 'failure', label: 'failure mode' },
        { id: 'replacement', label: 'replacement' },
      ],
      [
        ['ignored by context', 'external policy'],
        ['easy paraphrase', 'attack corpus'],
        ['shared blind spots', 'diverse gates'],
        ['large blast radius', 'scoped tokens'],
        ['no learning loop', 'logged outcome'],
      ],
    ),
    highlight: { removed: ['prompt:failure', 'deny:failure', 'global:failure'], active: ['prompt:replacement', 'global:replacement', 'silent:replacement'] },
    explanation: 'The dangerous pattern is symbolic-looking safety with no control-plane teeth. Real guardrails have permissions, typed effects, evals, logs, and escalation paths.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'policy pipeline') yield* policyPipeline();
  else if (view === 'risk controls') yield* riskControls();
  else throw new InputError('Pick a guardrail view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An LLM guardrail policy engine is a deterministic control plane around an LLM application. It labels trust, filters retrieval, validates output shape, checks semantic policy, gates tool calls, escalates risky actions, and writes audit traces. It is not one clever system prompt. It is the set of non-model mechanisms that decide what the model is allowed to see, say, and do.',
        'This module builds on Prompt Injection Threat Model. OWASP lists prompt injection as LLM01 in the 2025 GenAI risk taxonomy and describes direct and indirect injections where external content alters model behavior: https://genai.owasp.org/llmrisk/llm01-prompt-injection/. NCSC argues prompt injection is better viewed as an exploitation of an inherently confusable deputy than as ordinary SQL-style injection: https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection.',
      ],
    },
    {
      heading: 'Architecture',
      paragraphs: [
        'The policy pipeline has three phases. Before the model, classify input trust, apply retrieval access control, remove secrets that are not needed, and mark untrusted content as data. During generation, use structured output, constrained decoding, tool schemas, and model-side refusal guidance. After generation, run deterministic checks over the proposed answer or action: authorization, data-loss prevention, semantic safety, rate limits, reversibility, and required human approval.',
        'Microsoft Learn recommends defenses for indirect prompt injection that include security guardrails, information-flow control, least privilege, and short-lived privileges: https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection. NIST AI RMF and the Generative AI Profile give the broader govern, map, measure, and manage risk frame: https://www.nist.gov/itl/ai-risk-management-framework and https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf. Google SAIF gives a security framework for AI systems: https://safety.google/intl/en_in/safety/saif/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are a trust map, a permission table, a tool-effect taxonomy, a policy decision record, and an audit log. The trust map labels text as system, user, retrieved public source, retrieved private source, tool output, or untrusted external content. The permission table maps users, agents, tools, scopes, resources, and expiry. The effect taxonomy separates read, draft, send, write, delete, purchase, permission change, and external publication. The policy decision record stores allow, block, or escalate with reasons. The audit log makes later investigation and regression testing possible.',
        'Constrained Decoding is useful but insufficient. It can guarantee that an answer is valid JSON or matches a schema, yet a schema-valid call can still send a private file to the wrong address. Zanzibar Authorization Case Study explains the permission side. OAuth PKCE Token Lifecycle Case Study explains short-lived credential flow. Model Context Protocol Case Study explains why tool capability boundaries need negotiation and security review. Agent Tool Permission Lattice turns those boundaries into an effect-ranked decision table. Seccomp BPF Sandbox Policy explains how risky tools should be contained at runtime. Distributed Tracing explains how to keep the evidence trail for every decision.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine an enterprise research assistant that can read emails, search internal docs, draft responses, and create tickets. A retrieved email contains hidden text telling the assistant to forward private attachments. The trust map marks the email body as untrusted external content. Retrieval ACL limits which attachments enter context. The model may still propose a send-email tool call. The schema gate checks required fields. The semantic policy gate flags private attachment exfiltration. The permission table sees that the model has draft scope but not send-with-attachment scope. The action is escalated or blocked, and the full event becomes a red-team regression case.',
        'This is the difference between prompt-based safety and policy-engine safety. The model can be confused, but the control plane should not be. The model proposes a plan in natural language or JSON. The guardrail engine binds that proposal to typed resources, users, scopes, risk class, and approval state before anything changes outside the chat window.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not rely on hidden prompts as secrets. Do not use deny-list phrases as the main defense. Do not give an agent a global token when a short-lived scoped token would do. Do not let one LLM judge be the only safety layer. Do not silently block everything without recording why. Do not confuse output formatting with action safety. The policy engine should make every high-risk decision inspectable and every attack attempt reusable as a test.',
        'Study Prompt Injection Threat Model, Taint Analysis Source-to-Sink Case Study, Data-Flow Worklist Analysis, Multi-Agent Orchestration Topologies, Contract Net Agent Task Allocation, Constrained Decoding, Model Context Protocol Case Study, Agent Tool Permission Lattice, Seccomp BPF Sandbox Policy, JSON-RPC Protocol Case Study, Zanzibar Authorization Case Study, OAuth PKCE Token Lifecycle Case Study, Capability Security & Attenuation, Macaroon Caveat Chain Case Study, UCAN Delegation Proof Chain, OPA Rego Policy Decision Graph, PII Redaction Token Span Pipeline, Model Inversion Confidence Attack, LLM Training Data Extraction, Rate Limiter, Circuit Breakers, Distributed Tracing, Claim Graph Source Ledger, Software Supply Chain Provenance Graph, LLM Evaluation Harnesses, AI Audit Evidence Packet Case Study, RAG Evaluation, and AIOps Incident Response next. Local sources include prompt-attack and agentic-systems documents in the provided corpus.',
      ],
    },
  ],
};
