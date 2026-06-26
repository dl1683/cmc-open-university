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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'When a human clicks Buy, the click is the authorization signal. When an AI agent initiates a purchase, that signal disappears. AP2 exists to restore three properties human-present commerce gets for free: authorization (did the user approve this exact purchase?), authenticity (does the request reflect true intent, not a manipulated agent?), and accountability (what evidence exists if disputed?).'},
        'Read the mandate-chain view as authority narrowing over time. A mandate is a signed statement that gives limited permission for checkout or payment. Open mandates describe user constraints before a specific cart exists; closed mandates bind those constraints to a specific checkout.',
        'Read the risk-gates view as deterministic verification around an untrusted agent. Active nodes show artifacts being verified. The safe inference is that fluent model output is never payment authority; signatures, hashes, constraints, and receipts are the authority.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When a person clicks Buy, the payment system can treat that click as direct authorization for a visible cart. An autonomous agent changes the situation. It may shop while the user is absent, and the final cart may be shaped by prompt injection, bad product data, or agent error.',
        'Agent payments protocols exist to restore authorization, authenticity, and accountability. Authorization asks whether the user allowed this purchase. Authenticity asks whether the request reflects true intent. Accountability asks what evidence exists if the purchase is disputed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to give the agent a saved card, wallet token, or payment API key. The agent finds the item, calls the merchant API, and pays. Mechanically, that works.',
        'A softer version asks the agent to restate intent at checkout time. It might write that the user wanted one pair of shoes under 180 dollars. That sounds like confirmation, but it is only model-generated prose, not a user signature over constraints or an exact cart.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the agent is not a trusted payer. A prompt-injected product page can tell the agent to add a gift card, switch merchants, or exceed the budget. If the agent holds raw payment authority, the payment system sees a valid credential even though the user did not approve the final purchase.',
        'The dispute wall is evidence. A card transaction log can show that money moved, but it may not show the user constraint, the exact cart the merchant presented, the agent claim, the payment scope, and the verifier decision. Autonomous commerce needs those artifacts linked together.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move trust out of the model and into signed artifacts plus deterministic checks. A signed artifact is data plus a cryptographic signature that proves which key approved it. Deterministic checks are ordinary code paths that evaluate constraints the same way every time.',
        'The checkout hash is the join key. A hash is a fixed fingerprint of data. If the closed checkout mandate and closed payment mandate both bind to the hash of the merchant-signed checkout, an attacker cannot swap in a different cart without breaking verification.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In a human-present flow, the user sees the exact cart and signs a closed checkout mandate plus a closed payment mandate. The shopping agent can help assemble the cart, but it does not hold blanket payment authority. The payment credential is released only for the approved checkout.',
        'In an autonomous flow, the user signs open mandates first. Those mandates encode allowed merchants, item rules, amount limits, time windows, payment instrument, and budget. Later, the agent builds a cart and signs closed mandates with its own key, but deterministic verifiers check those closed mandates against the user-signed open constraints.',
        'Receipts complete the ledger. The merchant receipt, payment receipt, mandate ids, checkout hash, signatures, timestamps, and token scope all point to the same transaction. That linked evidence is what makes later audit or dispute replay possible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three invariants. First, hash binding means the payment authority is tied to one exact merchant checkout. Changing the cart changes the hash and invalidates the mandate chain.',
        'Second, constraint preservation means every closed mandate must satisfy the open mandate. A 500 dollar cart cannot pass a 180 dollar cap because code checks the amount before token release. Third, scope limiting means the payment token can be used only for the verified checkout and expires after a narrow window.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The per-transaction compute cost is small. A verifier checks a few signatures, computes one checkout hash, evaluates constraints, and queries receipt counters. The larger cost is infrastructure: key management, mandate storage, token scoping, receipt indexing, versioned verifier code, and dispute replay.',
        'For example, one autonomous purchase may create two open mandates, two closed mandates, one checkout JWT, one scoped payment token, two receipts, and one ledger entry linking them. At 2 KB per artifact, that is roughly 16 KB before indexes. One million purchases would create about 16 GB of raw artifacts, plus signatures, indexes, retention overhead, and audit logs.',
        'Budget counters are behaviorally important. If a user sets a 500 dollar monthly cap and has already spent 330.01 dollars, a new 169.99 dollar checkout exactly reaches 500.00 dollars and can pass. A second simultaneous checkout for 20 dollars must fail or wait on a serialized counter update.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The direct use is autonomous shopping. An agent can monitor inventory, price drops, or restocks and purchase within user-defined constraints while the user is absent. The same pattern fits procurement agents, subscription restocking, and agent-to-agent marketplaces.',
        'The ledger is also useful for compliance. A finance or marketplace team can show what the user authorized, what the merchant presented, what the agent signed, what the credential provider scoped, what the processor charged, and which verifier version accepted the transaction.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when constraints are too broad. An open mandate with merchant wildcard, high max amount, long expiry, and no item rules is close to raw credential delegation. Cryptography cannot save a policy that grants too much authority.',
        'It also fails on quality judgment. The protocol can prove an item is under 180 dollars from an allowed merchant, but it cannot prove the item is a good deal or the best product for the user. Product choice still needs agent quality, user preferences, fraud checks, and merchant risk systems.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user signs open mandates for one pair of Air Max 90 shoes, size 10, from nike.com or footlocker.com, on July 1, under 180 USD, using wallet-xyz. The open checkout mandate stores the item and merchant constraints. The open payment mandate stores wallet-xyz, payee allowlist, and a 180 USD budget cap.',
        'On July 1, the agent finds Nike inventory for 169.99 USD. Nike signs a checkout JWT for that exact cart. The agent signs closed mandates that reference the open mandate ids and the SHA-256 hash of the checkout JWT.',
        'The verifier checks signatures, hash equality, merchant allowlist, item match, date, amount, wallet, payee, and cumulative budget. Prior spend is 0, so 0 + 169.99 <= 180 passes. The credential provider releases a token scoped to that checkout hash, the processor charges 169.99 USD, and receipts enter the ledger.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the AP2 specification at https://ap2-protocol.org/ap2/specification/, AP2 flows at https://ap2-protocol.org/ap2/flows/, AP2 security and privacy considerations at https://ap2-protocol.org/ap2/security_and_privacy_considerations/, AP2 GitHub at https://github.com/google-agentic-commerce/AP2, and the Google Cloud AP2 announcement at https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol. Next study JWT Verification, Capability Security and Attenuation, OAuth PKCE Token Lifecycle, Prompt Injection Threat Model, Min-Cost Max-Flow, and Idempotency and Exactly-Once Delivery.',
      ],
    },
  ],
};
