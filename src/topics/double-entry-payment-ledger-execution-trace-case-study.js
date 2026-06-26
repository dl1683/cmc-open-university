// Double-entry payment ledger traces: every money movement is an append-only
// balanced journal entry, protected by idempotency and replayable proof.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'double-entry-payment-ledger-execution-trace-case-study',
  title: 'Double-Entry Payment Ledger Execution Trace',
  category: 'Systems',
  summary: 'A financial execution-grounding case study: journal entries, balancing invariants, idempotency keys, retries, reversals, and audit proofs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['journal invariant', 'idempotent payment'], defaultValue: 'journal invariant' },
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

function ledgerGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.8, y: 3.4, note: 'pay' },
      { id: 'idem', label: 'idem key', x: 2.2, y: 1.6, note: 'retry' },
      { id: 'auth', label: 'auth', x: 2.2, y: 5.2, note: 'card/bank' },
      { id: 'journal', label: 'journal', x: 4.0, y: 3.4, note: 'entry' },
      { id: 'debit', label: 'debit', x: 5.6, y: 1.7, note: 'acct A' },
      { id: 'credit', label: 'credit', x: 5.6, y: 5.1, note: 'acct B' },
      { id: 'balance', label: 'balance', x: 7.1, y: 3.4, note: 'sum=0' },
      { id: 'outbox', label: 'outbox', x: 8.5, y: 1.8, note: 'event' },
      { id: 'audit', label: 'audit', x: 8.5, y: 5.0, note: 'proof' },
    ],
    edges: [
      { id: 'e-req-idem', from: 'req', to: 'idem' },
      { id: 'e-req-auth', from: 'req', to: 'auth' },
      { id: 'e-idem-journal', from: 'idem', to: 'journal' },
      { id: 'e-auth-journal', from: 'auth', to: 'journal' },
      { id: 'e-journal-debit', from: 'journal', to: 'debit' },
      { id: 'e-journal-credit', from: 'journal', to: 'credit' },
      { id: 'e-debit-balance', from: 'debit', to: 'balance' },
      { id: 'e-credit-balance', from: 'credit', to: 'balance' },
      { id: 'e-balance-outbox', from: 'balance', to: 'outbox' },
      { id: 'e-balance-audit', from: 'balance', to: 'audit' },
    ],
  }, { title });
}

function retryGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.4, note: 'POST' },
      { id: 'key', label: 'key', x: 2.0, y: 3.4, note: 'idempotent' },
      { id: 'cache', label: 'result', x: 3.5, y: 1.8, note: 'saved' },
      { id: 'ledger', label: 'ledger', x: 3.5, y: 5.0, note: 'append' },
      { id: 'same', label: 'same req', x: 5.3, y: 2.0, note: 'return' },
      { id: 'diff', label: 'diff req', x: 5.3, y: 4.8, note: 'reject' },
      { id: 'reverse', label: 'reversal', x: 7.2, y: 3.4, note: 'new entry' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.4, note: 'trail' },
    ],
    edges: [
      { id: 'e-client-key', from: 'client', to: 'key' },
      { id: 'e-key-cache', from: 'key', to: 'cache' },
      { id: 'e-key-ledger', from: 'key', to: 'ledger' },
      { id: 'e-cache-same', from: 'cache', to: 'same' },
      { id: 'e-cache-diff', from: 'cache', to: 'diff' },
      { id: 'e-ledger-reverse', from: 'ledger', to: 'reverse' },
      { id: 'e-same-audit', from: 'same', to: 'audit' },
      { id: 'e-diff-audit', from: 'diff', to: 'audit' },
      { id: 'e-reverse-audit', from: 'reverse', to: 'audit' },
    ],
  }, { title });
}

function* journalInvariant() {
  yield {
    state: ledgerGraph('A payment trace appends a balanced journal entry'),
    highlight: { active: ['req', 'idem', 'auth', 'journal', 'debit', 'credit', 'e-req-idem', 'e-req-auth', 'e-idem-journal', 'e-auth-journal', 'e-journal-debit', 'e-journal-credit'], found: ['balance'] },
    explanation: 'A payment execution trace should not only say "charged card." It should append a journal entry with at least two lines and prove the debits and credits balance.',
  };

  yield {
    state: labelMatrix(
      'Balanced journal entry',
      [
        { id: 'cash', label: 'cash' },
        { id: 'payable', label: 'payable' },
        { id: 'fee', label: 'fee' },
        { id: 'net', label: 'net' },
      ],
      [
        { id: 'debit', label: 'debit' },
        { id: 'credit', label: 'credit' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['$100', '$0', 'asset +'],
        ['$0', '$97', 'liab +'],
        ['$0', '$3', 'revenue'],
        ['$100', '$100', 'sum ok'],
      ],
    ),
    highlight: { active: ['cash:debit', 'payable:credit', 'fee:credit'], found: ['net:proof'] },
    explanation: 'The invariant is mechanical: every journal entry balances. That makes payments a good vertical execution domain because the oracle can reject unbalanced or duplicate effects.',
    invariant: 'Money movement should be append-only and balance-preserving.',
  };

  yield {
    state: ledgerGraph('The outbox publishes only after the ledger is durable'),
    highlight: { active: ['journal', 'debit', 'credit', 'balance', 'outbox', 'e-debit-balance', 'e-credit-balance', 'e-balance-outbox'], compare: ['audit'] },
    explanation: 'Ledger append and outbound event publication should be coupled with an outbox or equivalent pattern. Otherwise a payment can be recorded without notification, or notification can escape without the ledger entry.',
  };

  yield {
    state: labelMatrix(
      'Payment state transitions',
      [
        { id: 'auth', label: 'auth' },
        { id: 'capture', label: 'capture' },
        { id: 'settle', label: 'settle' },
        { id: 'refund', label: 'refund' },
        { id: 'void', label: 'void' },
      ],
      [
        { id: 'entry', label: 'entry' },
        { id: 'invariant', label: 'invariant' },
      ],
      [
        ['hold', 'no double'],
        ['journal', 'balanced'],
        ['clear', 'matched'],
        ['reverse', 'balanced'],
        ['release', 'no settle'],
      ],
    ),
    highlight: { active: ['capture:invariant', 'refund:entry', 'refund:invariant'], compare: ['auth:entry'] },
    explanation: 'Each business state has a ledger shape. Refunds and corrections should append reversing entries instead of mutating history, because auditability is part of the verifier.',
  };

  yield {
    state: ledgerGraph('The audit proof joins request, authorization, journal, and event'),
    highlight: { active: ['req', 'auth', 'journal', 'balance', 'audit', 'e-balance-audit'], found: ['idem', 'outbox'] },
    explanation: 'A model trained on financial trajectories should see the full proof chain: request, idempotency key, authorization, balanced journal, durable outbox, and audit references.',
  };
}

function* idempotentPayment() {
  yield {
    state: retryGraph('Idempotency makes retries safe'),
    highlight: { active: ['client', 'key', 'cache', 'ledger', 'same', 'e-client-key', 'e-key-cache', 'e-key-ledger', 'e-cache-same'], compare: ['diff'] },
    explanation: 'A payment client may retry after a timeout. The idempotency key lets the server return the first result instead of creating a second journal entry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'retries after timeout', min: 0, max: 5 }, y: { label: 'side effects', min: 0, max: 5 } },
      series: [
        { id: 'unsafe', label: 'no key', points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 5 }] },
        { id: 'safe', label: 'idempotent', points: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }] },
      ],
      markers: [
        { id: 'cap', x: 4, y: 1, label: 'one effect' },
      ],
    }),
    highlight: { active: ['safe', 'cap'], compare: ['unsafe'] },
    explanation: 'The retry curve is the whole point. Without a key, side effects can scale with retries. With a key, retries converge on one recorded result.',
  };

  yield {
    state: labelMatrix(
      'Failure cases',
      [
        { id: 'timeout', label: 'timeout' },
        { id: 'same', label: 'same key' },
        { id: 'payload', label: 'diff body' },
        { id: 'partial', label: 'partial' },
        { id: 'refund', label: 'refund' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'move', label: 'move' },
      ],
      [
        ['unknown', 'retry key'],
        ['duplicate', 'return same'],
        ['semantic bug', 'reject'],
        ['dual write', 'outbox'],
        ['correction', 'new entry'],
      ],
    ),
    highlight: { active: ['timeout:move', 'same:move', 'partial:move'], removed: ['payload:move'], found: ['refund:move'] },
    explanation: 'Idempotency is not "ignore duplicates blindly." The server should compare request parameters, return the same result for the same operation, reject mismatched reuse, and append reversals for true corrections.',
    invariant: 'Retries reuse identity; corrections create new ledger facts.',
  };

  yield {
    state: retryGraph('Different payload under the same key is rejected'),
    highlight: { active: ['key', 'cache', 'diff', 'audit', 'e-cache-diff', 'e-diff-audit'], removed: ['ledger'], compare: ['same'] },
    explanation: 'If the client reuses the same key for a different amount or recipient, the safe behavior is rejection. Otherwise the idempotency layer becomes a silent corruption layer.',
  };

  yield {
    state: retryGraph('Reversals preserve history instead of rewriting it'),
    highlight: { active: ['ledger', 'reverse', 'audit', 'e-ledger-reverse', 'e-reverse-audit'], found: ['same'], compare: ['diff'] },
    explanation: 'If the original payment was wrong, the system appends a reversal or refund entry. That keeps the execution trace honest: the mistake happened, the correction happened, and both are auditable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'journal invariant') yield* journalInvariant();
  else if (view === 'idempotent payment') yield* idempotentPayment();
  else throw new InputError('Pick a payment-ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as one payment attempt becoming durable financial facts. A ledger is the system of record for money movement, double-entry means every journal entry has equal debits and credits, and idempotency means a retried request with the same key returns the same result instead of repeating the side effect. Active state is the current commit boundary, visited state is evidence already persisted, and found state is the balanced journal entry or retry verdict.',
        'The safe inference is conservation. If a journal entry does not balance per currency, it should not post. If a retry uses the same idempotency key and the same request shape, it should converge on the stored result rather than create another charge.',
        {type: 'callout', text: 'The ledger is the source of truth because every external payment attempt collapses into one append-only, balanced journal fact plus explicit correction facts for later changes.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Pacioli.jpg', alt: 'Portrait of Luca Pacioli at a table with a student, books, geometric instruments, and a hanging polyhedron.', caption: 'Portrait of Luca Pacioli with a student, attributed to Jacopo de Barbari, public-domain artwork, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A payment crosses unreliable boundaries. A customer clicks pay, a processor authorizes, a service writes a ledger entry, an event is published, and a response returns to the client. Any network hop can fail after real money state has changed.',
        'The system must prove later what happened. A timeout should not create a second charge, and a refund should not erase the original sale. The ledger exists so every balance can be traced back to append-only facts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design stores current balances. On payment, subtract from one account, add to another, send a receipt, and retry if the client does not receive the response. For a small demo, that is easy to build and inspect.',
        'Another common shortcut is to mutate the original row when a correction happens. A refund can look like changing the old payment status to refunded. That hides the event sequence that auditors, reconciliation jobs, and customer support need.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Partial failure breaks direct balance mutation. The processor may approve the charge while the service response times out. The ledger write may commit while the event publish fails. A retry cannot safely know whether it should run again unless the first attempt left a stable record.',
        'Auditability is the second wall. Financial systems must explain the path from external payment attempt to current balance. Rewriting old facts destroys the evidence needed to handle disputes, settlement differences, fees, chargebacks, and refunds.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent money movement as balanced journal entries, not direct balance edits. Each entry contains lines that debit and credit accounts, and the total debits equal total credits for each currency. Balances are projections from the journal.',
        'Wrap external operations in idempotency. The key, caller, amount, currency, recipient, and processor reference define one intended operation. A matching retry returns the saved result, while a reused key with different parameters is rejected.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A payment request first receives or supplies a stable idempotency key. The service records the request shape, calls the processor or consumes processor evidence, and enters a database transaction. Inside that transaction it appends the journal entry, verifies that lines balance, stores the idempotency result, and writes an outbox message.',
        'The outbox is a durable table of events waiting to be published. It prevents the system from announcing a payment that did not commit. Later corrections append reversal, refund, fee, or chargeback entries instead of editing the original posted entry.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The double-entry invariant is a conservation rule. A posted entry cannot create local money from nowhere because every debit is matched by a credit. If one side is missing, the entry fails the balance check and should not become visible.',
        'Idempotency handles uncertainty at the request boundary. The client may not know whether the first response was lost before or after commit, but the service can know because the key maps to a stored outcome. The outbox handles uncertainty at the event boundary by publishing only durable ledger facts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is write amplification. One capture can create journal lines, an idempotency row, an outbox row, reconciliation links, and audit metadata. Those extra writes buy replayability and reduce duplicate side effects.',
        'When payment volume doubles, append volume and reconciliation work also roughly double. Balance reads can be made fast with projections, but projections must be rebuilt from the journal if correctness is questioned. Retaining idempotency keys also consumes storage for the chosen replay window.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The model fits systems where external parties rely on money state: card payments, marketplace balances, wallets, issuing, payouts, refunds, fees, subscriptions, and chargebacks. The common access pattern is an irreversible or expensive side effect followed by later proof needs.',
        'It is also useful in agent and verifier training because the invariants are crisp. A trace can be checked for balanced entries, one durable outcome per idempotency key, explicit corrections, and events that refer to committed facts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A full double-entry ledger is too heavy for disposable counters, cache metrics, or UI-only state where no external party relies on the result. If state can be recomputed cheaply and no audit trail matters, a simpler log or aggregate may be enough.',
        'It also fails when teams use ledger words without enforcing ledger rules. If balances can be edited directly, entries can post unbalanced, idempotency keys are pruned too early, or events publish outside the transaction, the vocabulary gives false confidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client submits a $100 capture with key k1. The processor authorizes the capture. The ledger posts one entry: debit cash $100, credit merchant payable $97, and credit fee revenue $3, so debits and credits both total $100.',
        'The response times out and the client retries k1. The service finds the saved result for the same amount, currency, merchant, and processor reference, then returns it without posting another entry. If the client retries k1 for $120, the service rejects the mismatch; if $20 must be returned later, it posts a new refund entry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Stripe idempotent requests at https://docs.stripe.com/api/idempotent_requests, Stripe idempotency design at https://stripe.com/blog/idempotency, and Square Books at https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/. Study write-ahead logging, transactional outbox, saga patterns, two-phase commit, and append-and-aggregate balance projection next.',
      ],
    },
  ],
};
