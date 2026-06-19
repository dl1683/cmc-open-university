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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for LLM Guardrail Policy Engine. A production guardrail stack for LLM apps: trust labels, output schemas, policy gates, tool permissions, escalation, and audit traces..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LLM application is rarely just a text box connected to a model. A useful assistant may read private documents, summarize email, query a vector index, call tools, draft messages, change tickets, update databases, or trigger payments. That means the system has two very different jobs. It needs the model to produce flexible language and plans, but it also needs a reliable boundary around data access and side effects.',
        'The hard part is that the model sees mixtures of authority. A system prompt may say one thing, a user may ask another, a retrieved page may contain hidden instructions, and a tool schema may expose a privileged operation. The model can be helpful, but it is not a security kernel. A guardrail policy engine is the deterministic control plane that decides what context may enter the prompt, what output shape is acceptable, what actions are authorized, which decisions need review, and what evidence must be logged.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is usually a better prompt. Tell the model not to reveal secrets, not to follow untrusted instructions, not to perform unsafe actions, and not to violate policy. This is worth doing because it gives the model local guidance. It is not enough because the model still processes instructions and data in the same channel and may be persuaded, confused, or forced into an edge case.',
        'The second attempt is a single after-the-fact checker: a regular expression, a deny list, a toxicity classifier, or one LLM judge. These checks catch some obvious mistakes, but they do not create a complete authorization boundary. A valid JSON tool call can still request a forbidden transfer. A harmless-looking answer can still include private data. A judge model can share blind spots with the generator. A real policy engine needs several different gates, each tied to a different kind of failure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is prompt injection and confused authority. A retrieved document can say "ignore previous instructions" even though it is supposed to be evidence, not policy. A user can ask the assistant to summarize a file and then slip in a request to reveal another user account. A tool can be technically callable but unsafe for this user, this resource, this time, or this risk level. The dangerous condition is not bad wording; it is a system that lets untrusted text influence privileged behavior.',
        'A second wall is auditability. If the assistant blocks a request, allows a tool call, or asks for human approval, the organization needs to know why. Which input was untrusted? Which rule fired? Which credential scope was used? Which document ids entered context? Without a decision record, every incident becomes a memory test. The guardrail engine should turn decisions into evidence that can be reviewed, replayed, and converted into regression cases.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat model output as a proposal, not an authorization. The model may propose an answer, a citation, a tool call, or a plan. The control plane decides whether the proposal is allowed. That decision should be based on typed resources, user identity, tenant, data classification, tool effect, credential scope, risk class, and approval state. The model can describe intent; the policy engine binds that intent to concrete authority.',
        'The key data structures are ordinary but powerful. A trust map labels inputs as user instruction, system instruction, retrieved evidence, tool output, or untrusted external content. A permission table maps users and agents to resources and actions. A tool-effect taxonomy distinguishes reads, previews, drafts, sends, writes, deletes, purchases, and administrative changes. A policy decision record captures rule inputs and outcomes. An audit log preserves the event stream. Together these structures decide what the model may see, say, and do.',
      ],
    },
    {
      heading: 'What the visualization shows',
      paragraphs: [
        'The policy pipeline view separates the model from the decision boundary. Input enters through trust labeling and retrieval access control before it reaches the prompt. The model then emits a proposal, but the proposal still has to pass schema validation, semantic policy checks, tool authorization, and audit capture before an external effect occurs.',
        'The risk controls view shows why one guardrail cannot cover the whole space. Prompt injection, exfiltration, tool abuse, and policy drift leave different evidence and require different controls. Use the highlighted nodes to ask which layer is making the decision, what proof it has, and which failure would pass if that layer were removed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Before generation, the system classifies every source. User instructions, system policy, retrieved documents, tool outputs, and external pages get different trust labels. Retrieval is filtered by access control before prompt assembly, so a document the user cannot read never becomes latent context. Sensitive fields can be redacted or minimized when the requested task does not require them. Prompt construction should preserve the distinction between instructions and evidence instead of flattening everything into one blob.',
        'During generation, the application can constrain output shape with schemas, tool definitions, typed arguments, and constrained decoding. Shape is only the first gate. After generation, deterministic checks evaluate the proposed answer or action: authorization, data-loss prevention, semantic policy, rate limits, tenant boundaries, reversibility, and approval requirements. Allowed, blocked, and escalated decisions all create audit events with enough detail to explain the outcome later.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an enterprise research assistant that can search internal documents, read email threads, draft responses, and create support tickets. A user asks it to summarize a vendor email and prepare a reply. The email contains hidden text asking the assistant to forward private attachments to an external address. The email body is useful evidence, but it is not trusted instruction.',
        'The guardrail engine labels the email as untrusted retrieved content. Retrieval access control confirms that the user can read the email but does not automatically grant permission to send attachments. The model proposes a reply and perhaps a send-email tool call. The schema gate verifies the tool arguments. The semantic policy gate flags private attachment exfiltration. The permission table sees that the assistant has draft scope, not send-with-attachment scope. The result is a safe preview, a blocked send, or a human review request, plus an audit event that records the document id, proposed action, rule outcome, and final disposition.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it refuses to let one component carry every safety property. Schema checks catch malformed outputs. Semantic checks catch prohibited meaning. Permission checks catch unauthorized effects. Trust labels reduce indirect prompt injection by making retrieved content data, not policy. Scoped credentials limit blast radius if the model is manipulated. Audit logs turn blocked and allowed decisions into test fixtures.',
        'It also works because it changes the question from "can the model be perfectly safe?" to "can the surrounding system reduce likelihood and impact?" That is the practical framing for LLM security. A model can remain probabilistic while the control plane remains explicit about resources, scopes, approvals, and effects.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is friction and maintenance. Policies need owners. Resource labels need to be correct. Tool schemas need stable semantics. Credentials need scopes and expiration. Logs need retention, privacy review, and searchability. Too many false positives will push users around the system, while too many silent allowances will make the guardrail meaningless.',
        'There is also latency and product complexity. A low-risk summary may need only retrieval filtering and output checks. Sending email, deleting records, changing permissions, or moving money may need confirmation, approval, replay protection, and stronger identity binding. Good systems make risk proportional to proof: more autonomy and more external effect require more evidence.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A guardrail policy engine wins in enterprise assistants, customer-support automation, coding agents, RAG systems, workflow agents, and internal copilots that combine private data with tools. It is strongest when the action surface is typed: read a document, draft a message, send a message, create a ticket, write to a database, change access, delete data, or publish externally.',
        'It also wins in regulated or high-accountability settings because it leaves evidence. Security review, incident response, compliance reporting, and regression testing all need durable records. A plain prompt cannot explain why a tool call was allowed last Thursday. A policy decision record can.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design fails when it is only decorative. A prompt-only safety rule can be ignored by conflicting context. A deny-list phrase can be paraphrased. A single LLM judge can miss the same attack pattern as the generator. A global service token can turn a small prompt injection into a broad data breach. A silent block can prevent learning because nobody reviews the pattern.',
        'It also fails when policies are disconnected from product semantics. If every tool is labeled "call API", the engine cannot reason about effect. If all documents share one access label, retrieval filtering becomes fake. If the audit log omits inputs, rule ids, and credential scopes, the organization cannot distinguish a safe refusal from a broken workflow.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Test direct override attempts, indirect instructions in retrieved documents, cross-tenant document references, private data in citations, unsafe tool arguments hidden in valid JSON, approval bypasses, stale policy versions, unlogged denials, and credential overreach. Include benign near misses so the system does not learn to block every difficult request.',
        'A useful test case should say what the model saw, what it proposed, which policy should fire, which action should be blocked or escalated, and what audit record should exist afterward. That turns guardrails from vague safety language into an executable contract.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources for this topic include OWASP guidance on LLM application risks at https://owasp.org/www-project-top-10-for-large-language-model-applications/, NCSC prompt-injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection, the NIST AI Risk Management Framework at https://www.nist.gov/itl/ai-risk-management-framework, and the NIST Generative AI Profile at https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence.',
        'Good next topics are Prompt Injection Threat Model, Taint Analysis Source-to-Sink Case Study, Constrained Decoding, Agent Tool Permission Lattice, OPA Rego Policy Decision Graph, Zanzibar Authorization Case Study, OAuth PKCE Token Lifecycle Case Study, Capability Security and Attenuation, PII Redaction Token Span Pipeline, Distributed Tracing, AI Audit Evidence Packet Case Study, and RAG Claim Verification Support Ledger.',
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
        'Use this topic as a checkpoint: if you can explain why LLM Guardrail Policy Engine moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
