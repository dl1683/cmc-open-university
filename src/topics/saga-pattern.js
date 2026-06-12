// The saga pattern: distributed transactions without locks. Each step
// commits for real, immediately — and if a later step fails, you UNDO the
// earlier ones with compensating actions, in reverse. Microservices' answer
// to two-phase commit.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'saga-pattern',
  title: 'Saga Pattern',
  category: 'Systems',
  summary: 'A chain of local transactions plus compensating undos — distributed consistency without holding locks.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['all steps succeed', 'step 3 fails'], defaultValue: 'step 3 fails' },
  ],
  run,
};

const STEPS = [
  { name: 'flight', action: 'book the flight', undo: 'refund the flight' },
  { name: 'hotel', action: 'reserve the hotel', undo: 'cancel the hotel' },
  { name: 'car', action: 'rent the car', undo: 'cancel the rental' },
  { name: 'charge', action: 'charge the card', undo: 'refund the card' },
];

export function* run(input) {
  const failing = String(input.scenario) === 'step 3 fails';
  if (!['all steps succeed', 'step 3 fails'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }
  const failAt = failing ? 2 : -1;

  const labels = STEPS.map((s) => s.name);
  const ids = (upto) => Array.from({ length: upto }, (_, i) => `i${i}`);

  yield {
    state: arrayState(labels),
    highlight: {},
    explanation: 'Booking a trip touches four services — flights, hotels, cars, payments — each owning its OWN database. Two-Phase Commit (2PC) could make this atomic, but at the price of every service holding locks while waiting on a coordinator (and blocking if it dies). The saga\'s bargain: give up the single atomic moment, keep the all-or-nothing OUTCOME.',
  };

  yield {
    state: arrayState(labels),
    highlight: { range: ids(STEPS.length) },
    explanation: 'A saga is a CHAIN of ordinary local transactions, run in order — each one commits immediately and completely in its own service (each still using its own Write-Ahead Log (WAL) locally). The price of admission: every step must come with a COMPENSATING ACTION — a prepared undo: book↔refund, reserve↔cancel. No undo plan, no saga.',
    invariant: 'Every committed step has a compensating action ready before the saga starts.',
  };

  let completed = 0;
  for (let i = 0; i < STEPS.length; i += 1) {
    if (i === failAt) break;
    completed += 1;
    yield {
      state: arrayState(labels),
      highlight: { found: ids(completed), active: [`i${i}`] },
      explanation: `Step ${i + 1}: ${STEPS[i].action} — COMMITTED, for real, right now. ${i === 0 ? 'Note what did NOT happen: no lock held, no coordinator consulted, and the airline\'s database is already showing this seat as sold to everyone in the world. Sagas expose intermediate states — that is the trade.' : 'Each service did one normal transaction and moved on.'}`,
    };
  }

  if (failing) {
    yield {
      state: arrayState(labels),
      highlight: { swap: [`i${failAt}`], found: ids(completed) },
      explanation: `Step ${failAt + 1}: ${STEPS[failAt].action}… FAILS — no cars available. In 2PC this is where everyone would have voted no and quietly rolled back. But our first ${completed} steps are ALREADY COMMITTED — there is no rollback button on a committed transaction. There is only the plan we packed: compensate, in REVERSE order.`,
    };

    for (let i = completed - 1; i >= 0; i -= 1) {
      yield {
        state: arrayState(labels),
        highlight: { removed: ids(completed).slice(i), swap: [`i${failAt}`] },
        explanation: `Compensate step ${i + 1}: ${STEPS[i].undo}. This is itself just another local transaction — and it MUST succeed (compensations are designed to be retryable and unfailable: a refund can be retried forever; that is why "charge the card" goes LAST, where it never needs compensating in this saga).`,
      };
    }

    yield {
      state: arrayState(labels),
      highlight: { removed: ids(STEPS.length) },
      explanation: 'The saga ends in the "nothing happened" state: flight refunded, hotel cancelled, customer never charged. Eventually consistent — for a minute, the world COULD see a booked hotel for a trip that would never exist, and any process reading mid-saga must tolerate that (see CAP Theorem: this is choosing availability). The guarantee is weaker than 2PC\'s, the availability is far better: no service ever waited on another.',
    };
    return;
  }

  yield {
    state: arrayState(labels),
    highlight: { found: ids(STEPS.length) },
    explanation: 'All four steps committed — the trip exists, assembled from four independent transactions with zero cross-service locks. Each service stayed autonomous, deployable, and crash-isolated: had any step failed, the compensation chain would have unwound the rest.',
  };

  yield {
    state: arrayState(labels),
    highlight: {},
    explanation: 'Production notes: sagas come in two flavors — ORCHESTRATION (a coordinator service walks the chain; easier to follow) and CHOREOGRAPHY (each service emits events the next one reacts to; no central brain). Every step and compensation must be IDEMPOTENT, because retries are how failures get healed. And some actions cannot be literally undone (an email cannot be unsent) — compensate semantically: send the correction. This is how airlines, Uber, and every e-commerce checkout actually spans services; 2PC remains for the few places (banking ledgers, inventory counts) where exposing intermediate states is unacceptable.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `The saga pattern is a way to coordinate distributed transactions across microservices without holding locks. Instead of asking all participants to hold a lock while a central coordinator decides (like Two-Phase Commit does), a saga runs a chain of local transactions—each commits immediately and completely in its own service database, and if a later step fails, the saga unwinds by executing compensating actions in reverse order. Imagine booking a flight, hotel, and car: if the car rental fails after the flight and hotel are already booked, the saga refunds the flight and cancels the hotel, leaving the system as if none of the bookings happened.`,
        `The core trade-off is visibility: during a saga, the world can see inconsistent intermediate states. For a brief window, a hotel might show as booked for a trip that will never exist. This is the saga's answer to CAP Theorem—it chooses availability and partition tolerance over consistency, ensuring that no service ever waits on another and can recover independently from crashes.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Each step in a saga is a local transaction that commits for real, immediately, using the service's own Write-Ahead Log (WAL). There is no global coordinator holding everyone's resources—the flight service books and moves on; the hotel service reserves and moves on. The trick is that every action must have a companion undo: if flight-booking fails later, all prior steps execute their compensations (undos) in reverse. Compensating actions are themselves transactions and must be idempotent—refunding a payment twice should not double-charge; cancelling a hotel reservation that is already cancelled must succeed quietly.`,
        `One critical pattern is charging the card last. If the car rental fails, the flight and hotel compensations execute, and the customer was never charged. This simple reordering of steps eliminates one compensation path entirely—if the card transaction fails, everything before it rolls back, and nothing needs undoing from the card's perspective.`,
        `Sagas come in two flavors: orchestration, where a coordinator service explicitly walks each step and handles failures (easier to understand, single point of failure if the coordinator crashes); and choreography, where each service publishes events and the next service in the chain reacts (more resilient, harder to track). Real systems often mix both: orchestrate the happy path, choreograph compensations so failures trigger recovery automatically. Tools like Temporal.io, AWS Step Functions, and Airflow provide saga orchestration as a service.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Sagas are cheaper than Two-Phase Commit in terms of latency and availability—no service waits on a coordinator, and the system tolerates partial outages better. But the cost is in complexity: you must design a compensation for every action, handle the fact that compensations can fail (requiring retries and idempotent design), reason about eventual consistency, and live with the knowledge that a human may see a transient mess. An airline customer might see a refund appear and then disappear as a compensation retries. Debugging is harder because failures are not atomic—a saga failure is not a single point; it is a sequence of rollbacks that might themselves succeed, partially succeed, or fail.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every e-commerce checkout that spans multiple services uses sagas: the order service accepts the order, the inventory service reserves stock, the shipping service plans the route, and the payment service charges the card. If any step fails, compensations unwind what came before. Uber uses sagas to manage ride matching—once the driver accepts, the matching service locks that driver, the trip service starts a trip, the payment service prepares a charge, and the navigation service loads the route. If the driver cancels after being matched, compensations reset the system. Temporal.io (the temporal workflow engine) and AWS Step Functions are two modern saga orchestrators that handle retries, compensations, and state durably.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `One common mistake is assuming compensation is free. A refund is not the inverse of a charge—it is a separate transaction that can fail. If a refund fails, you need a retry strategy (exponential backoff, dead-letter queues, human review). Another pitfall is under-designing for idempotency: if a service resets the network and retries a compensating action, it must detect that the undo was already done and not repeat. A refund that is applied twice is a bug; the code must use idempotency keys (unique identifiers per compensation) to detect duplicates. A third pitfall is confusing sagas with transactions: a saga is not ACID. It is ACD (atomic in outcome, consistent eventually, durable per step, isolated in terms of locks) but not immediately consistent—a brief window of inconsistency is guaranteed. For systems where that window is unacceptable (banking ledgers, inventory counts with hard limits), Two-Phase Commit is still the right tool, and the saga pattern is a false economy.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To understand sagas in context, study Two-Phase Commit (2PC) to see the locking-based alternative, CAP Theorem to understand the availability trade-off, Write-Ahead Log (WAL) to see how each service durably records its side of a saga, Raft Log Replication to see how sagas stay consistent across service replicas, and Rate Limiter (Token Bucket) to control retries so failed compensations do not hammer the system. Sagas are the distributed-systems answer to managing failure at scale.`,
      ],
    },
  ],
};

