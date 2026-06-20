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
      heading: 'Why this exists',
      paragraphs: [
        'A payment is a distributed side effect with financial consequences. The customer presses pay, the processor authorizes, the ledger records, an event leaves the service, settlement arrives later, and any network hop can fail after doing real work.',
        'The hard question is not whether the happy path can charge a card. The hard question is whether the system can prove, after a timeout or dispute, that one intended payment created exactly one durable money movement and that every later correction is visible.',
        {type: 'callout', text: 'The ledger is the source of truth because every external payment attempt collapses into one append-only, balanced journal fact plus explicit correction facts for later changes.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Pacioli.jpg', alt: 'Portrait of Luca Pacioli at a table with a student, books, geometric instruments, and a hanging polyhedron.', caption: 'Portrait of Luca Pacioli with a student, attributed to Jacopo de Barbari, public-domain artwork, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        'A small system can start with balance rows: subtract from one account, add to another, emit a receipt, and retry the HTTP request if the client does not hear back. This is easy to build and easy to explain.',
        'That design works only while failures stay polite. It stores the latest answer, not the chain of facts that produced the answer. When the response disappears after the write, the retry path cannot tell whether it should return the old result, create a new charge, or repair a half-finished operation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Partial failure turns direct balance mutation into a trap. Authorization may succeed while the ledger write fails. The ledger write may commit while the response times out. The notification may publish before the transaction is durable. Settlement may disagree days later.',
        'Auditability is the second wall. A financial system cannot secretly rewrite yesterday because the facts changed today. A wrong capture, refund, fee, chargeback, or reversal must become a new durable fact that explains the current balance.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model money movement as an append-only double-entry journal, not as a direct balance edit. Each journal entry contains line items whose debits and credits balance. Balances are projections from the journal, not the source of truth.',
        'Add idempotency keys around externally visible operations. A retry with the same key and same parameters returns the saved result. A reused key with different parameters is rejected. A real correction appends a reversal or refund entry instead of mutating the original entry.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the journal-invariant view, watch the graph move from request identity and authorization into a balanced journal entry, then into outbox and audit nodes. The important state change is the commit point: once the balanced entry is durable, events and proofs can refer to a fact rather than a hope.',
        'In the idempotent-payment view, the plot is the lesson. The unsafe line creates another side effect for every retry. The safe line stays flat because the key maps repeated attempts back to one stored result. The rejection path matters too: idempotency prevents duplicate execution, not semantic drift under the same key.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The request first gets a stable operation identity. Authorization evidence records what the external payment network allowed. The ledger transaction appends one journal entry with multiple book entries, such as cash, merchant payable, processing fee, or refunds receivable. The entry is accepted only if the line items balance.',
        'The service saves the result under the idempotency key after execution begins. Future retries with the same key and same parameters return that result. Outbound notifications are staged through an outbox tied to the same durable transaction, so consumers hear about entries that actually exist.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The double-entry invariant is a conservation law. A journal entry cannot create or destroy money inside the ledger because every debit has matching credit. If a local write omits one side, the entry does not balance and should not commit.',
        'Idempotency handles uncertainty at the request boundary. The network can lose responses, but the key survives the retry. The outbox handles uncertainty at the event boundary by making publication depend on a durable ledger fact. Together they create a replayable proof chain from user request to audit record.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client submits a $100 capture with key k1. The processor authorizes it. The ledger appends a balanced entry: debit cash $100, credit merchant payable $97, and credit fee revenue $3. The result is stored under k1, and an outbox row announces the committed journal entry.',
        'The response times out, so the client retries with k1. The server compares the parameters, finds the saved result, and returns it without appending another entry. If the client retries k1 with $120 or a different merchant, the server rejects the mismatch. If the original $100 was wrong, the correction is a new reversal or refund entry.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is write amplification and stricter modeling. One business action may create several journal lines, idempotency records, outbox rows, reconciliation links, and audit references. Those writes buy traceability.',
        'The operational cost is lifecycle discipline. Idempotency records need retention windows, keys need enough entropy, outbox delivery needs replay, settlement needs reconciliation, and schema changes must preserve old entries. The ledger gives proof, but it does not remove the work of operating finance.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'This model fits card payments, wallets, marketplace balances, subscriptions, bank transfers, card issuing, fees, payouts, chargebacks, credits, and regulated reporting. The common pattern is irreversible or expensive side effects plus a later need to prove what happened.',
        'It is also useful as a training domain for agents and verifiers. The rules are crisp: balanced entries, stable idempotency identity, no duplicate side effects on retry, durable event publication, and append-only corrections.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A full double-entry ledger is heavy for disposable counters, UI-only balances, cache statistics, or toy systems where no external party relies on the result. If the state can be recomputed cheaply and no audit trail matters, a simpler event log or direct aggregate may be enough.',
        'It is also the wrong abstraction if teams use it as a decorative wrapper around mutable balances. Without enforced balance checks, idempotency comparisons, transaction boundaries, and reconciliation, the ledger vocabulary gives false confidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failures are duplicate keys with different payloads, keys pruned too early, event publication outside the ledger transaction, refunds implemented as hidden mutations, settlement files not reconciled, and account models that cannot represent fees, holds, chargebacks, or pending balances cleanly.',
        'A deeper failure is confusing idempotency with exactly-once delivery. The network does not give exactly-once execution. The service builds a stable record so repeated attempts converge on the same durable outcome.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Make balance checks database-enforced, not only application comments. Store journal lines with a transaction id, account id, side, amount, currency, and effective time, then enforce that every posted entry balances per currency and cannot be edited after posting.',
        'Bind idempotency to both key and semantic request shape. The saved record should include amount, currency, merchant, recipient, external authorization reference, and caller identity where relevant. A retry that changes those fields is not the same operation and should not receive the old success response.',
        'Reconcile against external systems as a normal workflow. Processor captures, settlement files, bank statements, chargebacks, and refunds should link back to ledger entries or create explicit exception records. The ledger is strongest when every outside fact has a place to land.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Stripe idempotent requests at https://docs.stripe.com/api/idempotent_requests, Stripe idempotency design at https://stripe.com/blog/idempotency, and Square Books at https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/.',
        'Study Write-Ahead Log for durability, Transactional Outbox for event publication, Saga Pattern for long-running workflows, Two-Phase Commit for cross-system atomicity, Hot Rows and Append-and-Aggregate for balance projection, and Financial Contract Lifecycle Event Model for richer money-state transitions.',
      ],
    },
  ],
};
