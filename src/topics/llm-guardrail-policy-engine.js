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
    explanation: `A ${topic.title.toLowerCase()} starts before generation. It labels trust, filters retrieval by authorization, and assembles context so untrusted content is treated as evidence rather than instruction.`,
  };

  yield {
    state: policyGraph('The model proposes; external gates decide'),
    highlight: { active: ['model', 'schema', 'policy', 'tool', 'human', 'audit', 'e-model-schema', 'e-model-policy', 'e-model-tool', 'e-policy-human', 'e-tool-audit'], found: ['effect'] },
    explanation: `The model output is not the decision boundary in a ${topic.category.toLowerCase()} like ${topic.title}. Constrained Decoding can enforce shape, but policy and tool gates decide whether the requested action is authorized, safe, reversible, and worth escalating.`,
    invariant: `Never make the model the only authority over a privileged side effect in a ${topic.title.toLowerCase()}.`,
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
    explanation: `Each layer in ${topic.title} catches a different class of failure. A valid JSON object can still request a forbidden transfer. A safe-looking answer can still leak private data. Defense needs multiple gates with different jobs.`,
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
    explanation: `The ${topic.category.toLowerCase()} control plane should classify effects. Reading a public page, reading private data, drafting text, sending a message, and deleting records are not the same operation, even if the model expresses all of them as tool calls.`,
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
    explanation: `Prompt injection defense is not a single classifier in ${topic.title}. OWASP and NCSC both frame the risk as a ${topic.category.toLowerCase()} problem around untrusted instructions, data flow, and privileged actions. The proof artifacts make the review concrete.`,
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
    explanation: `The more autonomy a ${topic.category.toLowerCase()} has, the more proof it needs. Summarizing a public doc can be low risk. Sending email, changing permissions, or mutating customer data needs stronger gates and human review in any ${topic.title.toLowerCase()}.`,
  };

  yield {
    state: policyGraph('Audit logs turn attacks into regression tests'),
    highlight: { active: ['policy', 'tool', 'audit', 'human', 'e-policy-audit', 'e-tool-audit', 'e-policy-human'], compare: ['effect'], found: ['schema'] },
    explanation: `Every blocked, escalated, and allowed high-risk action in ${topic.title} should create an audit event. Those events become red-team cases, golden-set regressions, abuse analytics, and incident-response evidence.`,
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
    explanation: `The dangerous pattern in any ${topic.category.toLowerCase()} is symbolic-looking safety with no control-plane teeth. Real guardrails in ${topic.title} have permissions, typed effects, evals, logs, and escalation paths.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a control plane around the model. The model proposes text or a tool call, but schema checks, policy checks, permission checks, escalation, and audit logging decide whether an external effect is allowed. Active nodes show the current gate, and found nodes show an authorized outcome.',
        {type: 'callout', text: "Guardrails work when the model proposes and a typed control plane authorizes."},
        {type: 'image', src: './assets/gifs/llm-guardrail-policy-engine.gif', alt: 'Animated walkthrough of the llm guardrail policy engine visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LLM application often connects language to private data and tools. It may read documents, summarize email, draft messages, create tickets, update databases, or trigger workflows. A guardrail policy engine exists because a probabilistic model should not be the only authority over access and side effects.',
        {type: 'image', src: 'https://developer.gs.com/blog/blog-posts/scaling-opa-through-oces/oces_1_v2.png', alt: 'Open Policy Agent policy decision point in a service request path', caption: 'Policy engines separate application proposals from authorization decisions, which is the same boundary an LLM tool system needs. Source: Goldman Sachs Developer.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a stronger system prompt. Tell the model not to reveal secrets, not to follow untrusted instructions, and not to perform unsafe actions. That guidance is useful because the model needs local behavior rules.',
        'The next obvious approach is a single output checker such as a deny-list, classifier, or judge. These catch some mistakes, but they do not create an authorization boundary. A valid JSON tool call can still be forbidden for this user, resource, tenant, or risk level.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is confused authority. A retrieved webpage can contain an instruction that looks like a command, but it is only evidence. A user can ask for a harmless summary while hidden text asks the model to exfiltrate private data. If the system flattens instructions, evidence, and tool outputs into one channel, untrusted text can influence privileged behavior.',
        'The second wall is auditability. After a block, allow, or escalation, the organization needs to know which input was untrusted, which rule fired, which credential scope was used, and which action was attempted. Without a decision record, every incident becomes guesswork.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the model output as a proposal, not a decision. The control plane binds that proposal to typed resources, user identity, tenant, data classification, tool effect, credential scope, risk class, and approval state. The model can describe intent, but policy decides authority.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model diagram', caption: 'A policy decision should be inspectable as a path through criteria: identity, resource, action, risk, and approval state. Source: Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Before generation, the system labels sources as system instruction, user instruction, retrieved evidence, tool output, or untrusted external content. Retrieval is filtered by access control, and sensitive fields can be minimized before prompt assembly. The prompt should preserve authority boundaries instead of turning every text span into the same kind of instruction.',
        'After generation, the system validates shape, meaning, permission, and effect. A schema gate checks structure, a semantic policy gate checks prohibited meaning, a tool gate checks whether the user and agent can perform the action, and an escalation gate decides whether human approval is required. Every high-risk outcome writes an audit event.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works by separating flexible reasoning from deterministic authorization. A model can remain probabilistic while the policy engine remains explicit about resources, scopes, approvals, and tool effects. One layer may miss a problem, but different layers fail in different ways.',
        'Correctness is a contract over effects. A tool call is allowed only if the actor has the required permission, the resource is in scope, the requested effect is permitted at that risk level, and any required approval has been obtained. If any condition fails, the system blocks, downgrades, or escalates rather than letting the model decide alone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is policy maintenance and latency. Resource labels, tool schemas, permission tables, trust labels, redaction rules, approval flows, and logs need owners. More autonomy and more external effect require more proof, so sending email or deleting data costs more checks than summarizing a public page.',
        'False positives and false negatives are both expensive. Too many blocks push users around the system, while too many allowances create security risk. Good systems measure block rate, override rate, incident rate, audit completeness, and latency by action class rather than treating guardrails as a single pass/fail switch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Guardrail policy engines fit enterprise assistants, customer-support automation, RAG systems, coding agents, workflow agents, and internal copilots that mix private data with tools. They are strongest when the action surface is typed, such as read document, draft message, send message, create ticket, update record, change access, delete data, or publish externally.',
        {type: 'image', src: 'https://docs.oracle.com/en/cloud/paas/integration-cloud/rest-api-fs/images/oauth-flow.png', alt: 'OAuth authorization flow showing client and authorization server', caption: 'Scoped authorization keeps delegated access narrower than the human account, which limits blast radius when a model proposes an action. Source: Oracle Cloud documentation.'},
        'They also support security review and incident response because decisions leave evidence. A prompt cannot prove why a tool call was allowed last week. A policy decision record can show actor, resource, action, rule id, credential scope, and final disposition.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when guardrails are decorative. Prompt-only rules can be ignored by conflicting context, deny lists can be paraphrased, and a single judge can share blind spots with the generator. A global admin token can turn one prompt injection into a broad breach.',
        'It also fails when policy has no product semantics. If every tool is just call API, the engine cannot reason about effect. If all documents share one access label, retrieval filtering is fake. If audit logs omit inputs and rule ids, the organization cannot learn from blocked and allowed decisions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A company assistant can read email, draft replies, and send messages. A user asks it to summarize a vendor email, and the email contains hidden text saying to forward private attachments to attacker@example.com. The email is useful evidence, but it has zero authority to create a sending instruction.',
        'The engine labels the email as untrusted retrieved content, verifies the user can read it, and gives the model only draft-scope credentials. If the model proposes send_email with two attachments, the schema gate accepts the shape, but the policy gate rejects exfiltration and the permission table sees no send-with-attachment scope. The result is a safe draft or human review, plus an audit event with document id, action, rule id, and disposition.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study OWASP guidance for LLM application risks at https://owasp.org/www-project-top-10-for-large-language-model-applications/ and NCSC prompt-injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection. For policy-engine mechanics, compare Open Policy Agent concepts with OAuth scoped authorization.',
        'Study prompt injection, taint analysis, constrained decoding, capability security, Zanzibar-style authorization, OAuth token lifecycles, PII redaction, distributed tracing, and eval harnesses. The next exercise is to write one policy decision record for a blocked tool call.',
      ],
    },
  ],
};
