// Agent Payments Protocol: signed checkout/payment mandates, constrained
// autonomous purchasing, role separation, receipts, and dispute evidence.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-payments-protocol-mandate-ledger-case-study',
  title: 'Agent Payments Protocol Mandate Ledger Case Study',
  category: 'Systems',
  summary: 'A protocol and data-structure case study for agentic commerce: AP2 roles, signed checkout/payment mandates, human-present and autonomous flows, constraint evaluation, scoped payment tokens, receipts, and dispute evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mandate chain', 'risk gates'], defaultValue: 'mandate chain' },
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

function roleGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 3.5, note: 'intent' },
      { id: 'surface', label: 'surface', x: 2.2, y: 1.8, note: 'consent' },
      { id: 'agent', label: 'agent', x: 2.2, y: 5.1, note: 'shop' },
      { id: 'merchant', label: 'merchant', x: 4.4, y: 3.5, note: 'checkout' },
      { id: 'checkout', label: 'checkout', x: 5.9, y: 1.8, note: 'JWT' },
      { id: 'provider', label: 'provider', x: 5.9, y: 5.1, note: 'wallet' },
      { id: 'mpp', label: 'processor', x: 7.7, y: 3.5, note: 'charge' },
      { id: 'receipt', label: 'receipt', x: 9.2, y: 3.5, note: 'proof' },
    ],
    edges: [
      { id: 'e-user-surface', from: 'user', to: 'surface' },
      { id: 'e-user-agent', from: 'user', to: 'agent' },
      { id: 'e-agent-merchant', from: 'agent', to: 'merchant' },
      { id: 'e-merchant-checkout', from: 'merchant', to: 'checkout' },
      { id: 'e-agent-provider', from: 'agent', to: 'provider' },
      { id: 'e-provider-mpp', from: 'provider', to: 'mpp' },
      { id: 'e-merchant-mpp', from: 'merchant', to: 'mpp' },
      { id: 'e-mpp-receipt', from: 'mpp', to: 'receipt' },
      { id: 'e-merchant-receipt', from: 'merchant', to: 'receipt' },
      { id: 'e-surface-agent', from: 'surface', to: 'agent' },
    ],
  }, { title });
}

function mandateGraph(title) {
  return graphState({
    nodes: [
      { id: 'openC', label: 'open C', x: 0.8, y: 2.2, note: 'rules' },
      { id: 'openP', label: 'open P', x: 0.8, y: 5.0, note: 'budget' },
      { id: 'cart', label: 'cart', x: 2.8, y: 2.2, note: 'merchant JWT' },
      { id: 'hash', label: 'hash', x: 4.2, y: 3.6, note: 'bind' },
      { id: 'closedC', label: 'closed C', x: 5.8, y: 2.2, note: 'items' },
      { id: 'closedP', label: 'closed P', x: 5.8, y: 5.0, note: 'pay' },
      { id: 'token', label: 'token', x: 7.5, y: 5.0, note: 'scoped' },
      { id: 'order', label: 'order', x: 7.5, y: 2.2, note: 'accepted' },
      { id: 'ledger', label: 'ledger', x: 9.1, y: 3.6, note: 'evidence' },
    ],
    edges: [
      { id: 'e-openC-closedC', from: 'openC', to: 'closedC' },
      { id: 'e-openP-closedP', from: 'openP', to: 'closedP' },
      { id: 'e-cart-hash', from: 'cart', to: 'hash' },
      { id: 'e-hash-closedC', from: 'hash', to: 'closedC' },
      { id: 'e-hash-closedP', from: 'hash', to: 'closedP' },
      { id: 'e-closedP-token', from: 'closedP', to: 'token' },
      { id: 'e-closedC-order', from: 'closedC', to: 'order' },
      { id: 'e-token-ledger', from: 'token', to: 'ledger' },
      { id: 'e-order-ledger', from: 'order', to: 'ledger' },
    ],
  }, { title });
}

function riskGraph(title) {
  return graphState({
    nodes: [
      { id: 'llm', label: 'LLM', x: 0.8, y: 3.6, note: 'attacker?' },
      { id: 'intent', label: 'intent', x: 2.4, y: 1.9, note: 'signed' },
      { id: 'cart', label: 'cart', x: 2.4, y: 5.2, note: 'signed' },
      { id: 'verify', label: 'verify', x: 4.5, y: 3.6, note: 'code' },
      { id: 'constraints', label: 'rules', x: 6.1, y: 1.9, note: 'bounds' },
      { id: 'token', label: 'token', x: 6.1, y: 5.2, note: 'scoped' },
      { id: 'allow', label: 'allow', x: 8.1, y: 2.6, note: 'charge' },
      { id: 'reject', label: 'reject', x: 8.1, y: 4.7, note: 'receipt' },
    ],
    edges: [
      { id: 'e-llm-intent', from: 'llm', to: 'intent' },
      { id: 'e-llm-cart', from: 'llm', to: 'cart' },
      { id: 'e-intent-verify', from: 'intent', to: 'verify' },
      { id: 'e-cart-verify', from: 'cart', to: 'verify' },
      { id: 'e-verify-constraints', from: 'verify', to: 'constraints' },
      { id: 'e-verify-token', from: 'verify', to: 'token' },
      { id: 'e-constraints-allow', from: 'constraints', to: 'allow' },
      { id: 'e-token-allow', from: 'token', to: 'allow' },
      { id: 'e-constraints-reject', from: 'constraints', to: 'reject' },
    ],
  }, { title });
}

function* mandateChain() {
  yield {
    state: roleGraph('AP2 separates shopping, consent, checkout, and payment roles'),
    highlight: { active: ['user', 'surface', 'agent', 'merchant', 'provider', 'mpp', 'e-user-surface', 'e-user-agent', 'e-agent-merchant', 'e-agent-provider'], found: ['receipt'] },
    explanation: 'AP2 is built around role separation. The shopping agent can search and assemble intent, but a trusted surface captures consent, the merchant signs the checkout, the credential provider controls payment credentials, and the processor handles payment.',
  };

  yield {
    state: labelMatrix(
      'AP2 role responsibilities',
      [
        { id: 'sa', label: 'agent' },
        { id: 'ts', label: 'surface' },
        { id: 'm', label: 'merchant' },
        { id: 'cp', label: 'provider' },
        { id: 'mpp', label: 'processor' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'must check', label: 'must check' },
      ],
      [
        ['search/cart', 'mandates'],
        ['user consent', 'authn'],
        ['checkout JWT', 'cart hash'],
        ['pay token', 'pay mandate'],
        ['charge/receipt', 'scope'],
      ],
    ),
    highlight: { active: ['ts:owns', 'm:owns', 'cp:owns', 'mpp:must check'], compare: ['sa:owns'] },
    explanation: 'The shopping agent is intentionally not the sole authority. Deterministic components and payment actors verify signed artifacts before a token is released or a checkout is completed.',
  };

  yield {
    state: mandateGraph('Mandates link user intent to checkout and payment'),
    highlight: { active: ['cart', 'hash', 'closedC', 'closedP', 'token', 'order', 'e-cart-hash', 'e-hash-closedC', 'e-hash-closedP', 'e-closedP-token', 'e-closedC-order'], found: ['ledger'] },
    explanation: 'The closed checkout mandate proves the agent is authorized to purchase this checkout. The closed payment mandate proves payment authority for the same checkout. The checkout hash is the join key between the cart and payment sides.',
    invariant: 'Payment authority should be bound to the exact checkout, not to a vague shopping instruction.',
  };

  yield {
    state: mandateGraph('Autonomous flows start with open mandates'),
    highlight: { active: ['openC', 'openP', 'closedC', 'closedP', 'e-openC-closedC', 'e-openP-closedP'], compare: ['cart'], found: ['hash'] },
    explanation: 'In a human-not-present flow, the user signs open mandates with constraints before leaving. Later, the agent may sign closed mandates with its own key, but verifiers check that the closed checkout and payment satisfy the user-signed constraints.',
  };

  yield {
    state: labelMatrix(
      'Human-present versus autonomous',
      [
        { id: 'direct', label: 'human present' },
        { id: 'auto', label: 'autonomous' },
      ],
      [
        { id: 'user signs' },
        { id: 'agent signs' },
        { id: 'risk' },
      ],
      [
        ['closed pair', 'not needed', 'UI truth'],
        ['open rules', 'closed facts', 'bounds'],
      ],
    ),
    highlight: { active: ['direct:user signs', 'auto:user signs', 'auto:agent signs'], compare: ['direct:risk', 'auto:risk'] },
    explanation: 'Human-present purchases can ask the user to approve the exact checkout. Autonomous purchases need a different structure: signed constraints now, deterministic verification later, and a sender-constrained agent key for the closed mandate.',
  };

  yield {
    state: mandateGraph('Receipts turn payment into dispute evidence'),
    highlight: { active: ['closedC', 'closedP', 'token', 'order', 'ledger', 'e-token-ledger', 'e-order-ledger'], found: ['hash'], compare: ['openC', 'openP'] },
    explanation: 'AP2 makes receipts part of the evidence ledger. A dispute can bring together checkout mandate, checkout receipt, payment mandate, payment receipt, hashes, and signatures to show what each party saw and accepted.',
  };
}

function* riskGates() {
  yield {
    state: riskGraph('AP2 treats the LLM-controlled agent as untrusted'),
    highlight: { active: ['llm', 'intent', 'cart', 'verify', 'e-llm-intent', 'e-llm-cart', 'e-intent-verify', 'e-cart-verify'], compare: ['allow'] },
    explanation: 'The AP2 security model assumes agents and LLMs can be attacked. Trust moves into signed mandates, deterministic verification, scoped tokens, receipts, and constraints that bound the worst financial effect.',
    invariant: 'A fluent agent request is not payment authorization.',
  };

  yield {
    state: labelMatrix(
      'Constraint evaluation',
      [
        { id: 'merchant', label: 'merchant' },
        { id: 'items', label: 'items' },
        { id: 'amount', label: 'amount' },
        { id: 'budget', label: 'budget' },
        { id: 'date', label: 'date' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'data shape', label: 'data shape' },
      ],
      [
        ['allowlist', 'set membership'],
        ['valid set', 'flow graph'],
        ['range', 'interval'],
        ['total cap', 'counter'],
        ['window', 'time range'],
      ],
    ),
    highlight: { active: ['merchant:data shape', 'items:data shape', 'amount:data shape', 'budget:data shape'], found: ['date:data shape'] },
    explanation: 'AP2 constraints are data structures. Merchant constraints are allowlists, payment amount constraints are intervals, recurrence/budget constraints are counters, and checkout line-item constraints can be evaluated as a flow or matching problem.',
  };

  yield {
    state: riskGraph('Closed mandates bind to open mandates and checkout hash'),
    highlight: { active: ['intent', 'cart', 'verify', 'constraints', 'e-intent-verify', 'e-cart-verify', 'e-verify-constraints'], compare: ['token'] },
    explanation: 'Closed mandates must be linked to the presented open mandate and to the merchant-signed checkout. That prevents an attacker from mixing a valid payment authorization with a different cart.',
  };

  yield {
    state: labelMatrix(
      'Attack and mitigation map',
      [
        { id: 'checkout', label: 'bad checkout' },
        { id: 'payment', label: 'bad payment' },
        { id: 'token', label: 'token theft' },
        { id: 'discovery', label: 'bad item' },
        { id: 'double', label: 'double use' },
      ],
      [
        { id: 'attack' },
        { id: 'control' },
      ],
      [
        ['swap cart', 'hash bind'],
        ['wrong payee', 'signature'],
        ['reuse token', 'scope token'],
        ['prompt inj', 'constraints'],
        ['two carts', 'receipts'],
      ],
    ),
    highlight: { active: ['checkout:control', 'payment:control', 'token:control', 'double:control'], compare: ['discovery:attack'] },
    explanation: 'The main AP2 controls are binding, signatures, scoped tokens, deterministic constraint checks, and receipt management. Prompt injection can still choose a poor item, but constraints bound the financial and logical impact.',
  };

  yield {
    state: riskGraph('Selective disclosure preserves privacy in autonomous flows'),
    highlight: { active: ['intent', 'constraints', 'verify', 'e-intent-verify', 'e-verify-constraints'], compare: ['token'], found: ['reject'] },
    explanation: 'Open mandates may contain more user intent than a specific merchant needs. Selective disclosure reveals only the constraints required to verify this checkout and payment, reducing unnecessary leakage.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        { id: 'keys', label: 'keys' },
        { id: 'store', label: 'store' },
        { id: 'verify', label: 'verify' },
        { id: 'tokens', label: 'tokens' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'must keep' },
        { id: 'linked topic' },
      ],
      [
        ['agent key', 'JWT Verify'],
        ['mandates', 'Outbox'],
        ['constraints', 'Max-Flow'],
        ['scoped pay', 'OAuth'],
        ['receipts', 'Ledger'],
      ],
    ),
    highlight: { active: ['keys:must keep', 'store:must keep', 'verify:must keep', 'tokens:must keep', 'audit:must keep'] },
    explanation: 'A serious AP2 implementation needs key management, mandate storage, deterministic constraint evaluation, scoped token release, receipt handling, and an audit ledger that can survive disputes and incident review.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mandate chain') yield* mandateChain();
  else if (view === 'risk gates') yield* riskGates();
  else throw new InputError('Pick an Agent Payments Protocol view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Agent Payments Protocol, or AP2, is an open protocol for agentic commerce. It addresses the gap created when an AI agent, rather than a human directly clicking buy, initiates a purchase. The core questions are authorization, authenticity, and accountability: did the user authorize this exact purchase, does the request reflect true user intent, and what evidence exists if the transaction is disputed?',
        'AP2 is available as an extension for Agent2Agent and other commerce protocols. It is not a replacement for payment rails. It is a security and evidence layer around agent-driven checkout and payment: signed mandates, deterministic verification, scoped payment credentials, receipts, and role separation.',
      ],
    },
    {
      heading: 'Mandates as data structures',
      paragraphs: [
        'AP2 defines two mandate families. A Checkout Mandate proves that the shopping agent is authorized to purchase the assembled checkout. A Payment Mandate proves that the shopping agent is authorized to pay for that checkout. Both can exist in open form, where the user signs constraints for future autonomous execution, and closed form, where a specific checkout or payment is bound to those constraints.',
        'The important join key is the checkout hash. The merchant creates a signed checkout JWT. The closed checkout and closed payment mandates bind to that checkout through cryptographic hashes. Receipts then bind back to the accepted mandates. The resulting ledger is not just prose consent; it is a graph of signed artifacts and hashes.',
      ],
    },
    {
      heading: 'Human-present and autonomous flows',
      paragraphs: [
        'In a human-present flow, the user sees and approves the final checkout and payment through a trusted surface. The trusted surface signs the closed checkout and payment mandates, the credential provider verifies the payment mandate and releases a scoped token, and the merchant verifies the checkout mandate before completing the order.',
        'In a human-not-present flow, the user signs open mandates up front: budget, allowed merchants, line-item constraints, payment instruments, payees, dates, recurrence, and other rules. Later, the shopping agent builds a cart and signs closed mandates with its agent key. Verifiers accept the transaction only if the closed mandates satisfy the user-signed open constraints.',
      ],
    },
    {
      heading: 'Complete case study: sneaker drop',
      paragraphs: [
        'A user tells a shopping agent: buy one pair of a specific sneaker model from either of two merchants, size 10, under $180, only on launch day, using a chosen wallet. The trusted surface renders that intent and signs open checkout and payment mandates. The user leaves. When inventory appears, the agent assembles a checkout from an allowed merchant. The merchant signs the checkout JWT. The agent signs closed checkout and payment mandates bound to that checkout hash.',
        'The merchant checks that the closed checkout satisfies the open checkout mandate. The credential provider checks the payment mandate constraints and releases a scoped payment token only for this checkout. The merchant payment processor verifies the payment mandate in the token before charging. The checkout receipt and payment receipt enter the evidence ledger. If a dispute occurs, the parties can reconstruct user intent, cart contents, payment amount, agent authority, and acceptance receipts.',
      ],
    },
    {
      heading: 'Systems lessons',
      paragraphs: [
        'AP2 is useful because it turns agentic commerce into familiar systems problems. Constraints become sets, intervals, counters, time windows, and flow graphs. Mandates become signed credentials with versioned schemas. Receipts become append-only audit records. Scoped payment tokens limit blast radius. Idempotency and receipt handling prevent duplicate autonomous purchases. Selective disclosure reduces privacy leakage from broad open mandates.',
        'The security docs explicitly assume agents and LLMs may be attackers, because prompt injection cannot be fully prevented. That is the core lesson: do not ask the model whether it is authorized. Verify signatures, hashes, constraints, scopes, payment tokens, and receipts in deterministic code.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat AP2 as permission for an agent to spend generally. It authorizes specific closed transactions or bounded autonomous constraints. Do not expose more user intent than the verifier needs; use selective disclosure. Do not release payment tokens before final mandate verification. Do not allow multiple overlapping autonomous closed mandates from the same open mandate without receipt handling. Do not treat a merchant catalog result as trustworthy simply because an agent selected it.',
        'AP2 also does not replace fraud, compliance, settlement, chargeback, KYC, AML, or merchant risk systems. It gives those systems better evidence and consistent agent-presence signals. Payment processors and issuers still need their ordinary risk engines and operational controls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AP2 docs at https://ap2-protocol.org/, AP2 specification at https://ap2-protocol.org/ap2/specification/, AP2 flows at https://ap2-protocol.org/ap2/flows/, Checkout Mandate at https://ap2-protocol.org/ap2/checkout_mandate/, Payment Mandate at https://ap2-protocol.org/ap2/payment_mandate/, Security and Privacy Considerations at https://ap2-protocol.org/ap2/security_and_privacy_considerations/, Implementation Considerations at https://ap2-protocol.org/ap2/implementation_considerations/, Google Cloud announcement at https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol, AP2 GitHub at https://github.com/google-agentic-commerce/AP2, and PayPal AP2 discussion at https://developer.paypal.com/community/blog/PayPal-Agent-Payments-Protocol/.',
        'Study Agent2Agent Protocol Task State Case Study, Model Context Protocol Case Study, Double-Entry Payment Ledger Execution Trace, Idempotency & Exactly-Once Delivery, JWT Verification, OAuth PKCE Token Lifecycle Case Study, WebAuthn Passkeys, Capability Security & Attenuation, Agent Tool Permission Lattice, Prompt Injection Threat Model, Min-Cost Max-Flow, Message Queue, Distributed Tracing, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
