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
      heading: 'What it is',
      paragraphs: [
        'A double-entry payment ledger execution trace records a payment as an append-only, balanced journal entry plus request identity, authorization evidence, retry state, outbox publication, and audit proof. It is a financial version of execution grounding: state transitions are accepted only if they preserve the ledger invariant.',
        'This is a natural vertical companion to Code World Models. A payment domain has objective oracles, but they are not Python interpreters. The oracles are balance checks, idempotency checks, authorization proofs, settlement matching, and reversal semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every money movement appends a journal entry with line items. Debits and credits must balance. A capture, refund, settlement, fee, chargeback, or correction becomes a new entry, not a mutation of old history. The ledger can project balances, but the source of truth is the ordered journal plus proof metadata.',
        'Square described Books as an immutable double-entry accounting database service and emphasized that journal entries must balance to zero: https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/. Stripe documents idempotent requests as the API mechanism that lets clients retry safely without creating duplicate operations: https://docs.stripe.com/api/idempotent_requests and https://stripe.com/blog/idempotency.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A client submits a $100 payment with idempotency key k1. The server authorizes the payment, appends a balanced journal entry, saves the result for k1, and publishes a ledger event through an outbox. The network drops before the client sees the response. The client retries with k1. The server returns the saved result and does not append a second entry. If the client changes the amount under k1, the server rejects the mismatch. If a real correction is needed, the system appends a refund or reversal.',
        'That makes the trace trainable. A model can learn that timeout does not imply "try a new charge," that duplicate keys return stored results, that balance is mandatory, and that corrections are new facts rather than edits to history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hard part is not summing debits and credits. It is exactly where distributed systems meet finance: partial failures, duplicate requests, delayed settlement files, idempotency windows, outbox delivery, reconciliation, fraud review, chargebacks, and ledger migrations. Each one needs explicit state, not comments in an incident doc.',
        'A production trace should connect the payment request, idempotency key, authorization response, journal entry, outbox event, reconciliation record, and audit references. If any link is missing, the example is incomplete training data.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not overwrite financial history. Do not rely on best-effort duplicate detection when an idempotency key is available. Do not publish events before the ledger entry is durable. Do not treat refunds as negative side effects hidden inside the original payment. Do not train payment agents on transcripts without the journal invariant and retry semantics.',
        'Primary sources: Stripe idempotent requests at https://docs.stripe.com/api/idempotent_requests, Stripe idempotency design article at https://stripe.com/blog/idempotency, and Square Books at https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/. Study Agent Payments Protocol Mandate Ledger Case Study, Idempotency & Exactly-Once Delivery, Write-Ahead Log, Transactional Outbox, Kafka Transactions & Exactly-Once Case Study, Saga Pattern, Two-Phase Commit, Hot Rows & Append-and-Aggregate, and Financial Contract Lifecycle Event Model next.',
      ],
    },
  ],
};
