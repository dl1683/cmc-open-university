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
    explanation: `Booking a trip touches four services -- flights, hotels, cars, payments -- each owning its OWN database. Two-Phase Commit (2PC) could make this atomic, but at the price of every service holding locks while waiting on a coordinator and blocking if it dies. The saga bargain: give up the single atomic moment, keep the all-or-nothing OUTCOME.`,
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
      explanation: `Step ${i + 1}: ${STEPS[i].action} -- COMMITTED, for real, right now. ${i === 0 ? "Note what did NOT happen: no lock held, no coordinator consulted, and the airline database is already showing this seat as sold to everyone in the world. Sagas expose intermediate states -- that is the trade." : 'Each service did one normal transaction and moved on.'}`,
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
      explanation: `The saga ends in the "nothing happened" state: flight refunded, hotel cancelled, customer never charged. Eventually consistent -- for a minute, the world COULD see a booked hotel for a trip that would never exist, and any process reading mid-saga must tolerate that (see CAP Theorem: this is choosing availability). The guarantee is weaker than 2PC, the availability is far better: no service ever waited on another.`,
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
      heading: `Why this exists`,
      paragraphs: [
        `A real business workflow rarely lives inside one database. A checkout touches inventory, payment, tax, shipping, notification, fraud scoring, and analytics. A trip booking touches airlines, hotels, car rental, payment, loyalty points, and email. Each part has its own service, owner, database, retry policy, and failure mode.`,
        {type: 'callout', text: 'A saga trades one global commit for durable local steps plus compensations that repair the business outcome.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A saga is easiest to reason about as directed workflow state: forward commands, failure edges, and reverse compensation edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        `The saga pattern exists because these workflows still need a coherent outcome. The customer should not pay for an order that cannot ship. The traveler should not be charged for a trip whose flight could not be booked. At the same time, the system cannot afford to hold distributed locks while it waits on remote services, external providers, and human-scale delays.`,
        `A saga chooses a practical contract: each service performs a normal local transaction, and the workflow records enough state to continue, retry, or compensate later. It does not promise one magical atomic commit across the whole company. It promises a controlled path from partial progress to a final business outcome.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious approach is one distributed transaction that spans every service. In a database textbook, that means a coordinator asks every participant to prepare, waits for votes, and then tells everyone to commit or roll back. Two-Phase Commit is a serious tool, and it is still useful when participants are close together, tightly controlled, and the transaction is short.`,
        `The wall is duration and ownership. A checkout may call a payment network that takes seconds. A hotel reservation may call a partner system outside your control. A shipment may be created now and cancelled later. A service may deploy while the workflow is open. If every participant holds locks until the slowest one finishes, local availability is sacrificed for a global boundary that may not match the business process.`,
        `The second wall is that many real actions cannot be rolled back by a database undo log. You cannot unsend an email, uncall a partner API, unnotify a warehouse worker, or pretend a payment authorization was never seen. The system needs semantic repair, not physical rollback.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram with one input end and one output end', caption: 'Retries and compensations usually move through durable queues; the saga state machine decides which command enters the queue next. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `A saga turns one large transaction into a sequence of small local transactions. After each step commits, the workflow records that fact durably. If a later step fails, the saga does not ask the earlier databases to roll back. It runs compensating actions that move the business back to an acceptable state.`,
        `The central invariant is simple: every committed forward step has a known recovery path. That recovery path may be a cancellation, refund, release, void, reversal, correction event, or manual escalation. It must be designed before the workflow ships, not invented during an outage.`,
        `This is why compensation is not the same as undo. Undo restores bytes to an earlier state. Compensation creates new business facts. A refund does not erase the charge; it adds a second ledger event that balances the customer outcome. A cancellation does not erase a reservation; it changes the reservation state and may leave an audit trail.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `The visual uses a travel booking because it makes the trade visible. Booking a flight, reserving a hotel, renting a car, and charging a card are separate service actions. A highlighted forward step means that action has really committed in its own system.`,
        `The failure path is the important part. When the car rental fails, the already completed steps are not tentative votes waiting for a coordinator. They are finished facts. The workflow can only walk backward through compensations: cancel the hotel, refund the flight, and leave a durable record of how the final outcome was produced.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each step is a local transaction in one service. The inventory service reserves stock in its own database. The payment service authorizes money in its own ledger. The shipping service creates a label in its own system. Each service can use normal isolation, a local write-ahead log, idempotency keys, and its own deployment cycle.`,
        `Around those steps sits a workflow record. It stores the saga id, current state, completed steps, pending step, idempotency keys, retry counters, timeout deadlines, compensation state, final status, and enough error detail for operators. That record is the data structure that turns a distributed business process into recoverable state.`,
        `A forward step must be called through a stable command or message. The command should carry a request id that the target service can deduplicate. The response should say whether the action completed, failed permanently, timed out, or is still pending. The saga engine then advances, retries, waits, compensates, or escalates.`,
        `The workflow must survive crashes. If the orchestrator dies after reserving inventory but before recording the response, recovery needs a way to ask the inventory service what happened or safely retry the command with the same idempotency key. Without that, the saga cannot distinguish a lost response from a lost action.`,
      ],
    },
    {
      heading: `Coordination Styles`,
      paragraphs: [
        `In an orchestrated saga, one workflow service owns the state machine. It calls each participant, persists progress, schedules retries, and launches compensations when needed. This style is easier to inspect because there is one place to ask where the workflow is and why it is waiting.`,
        `In a choreographed saga, services publish events and react to each other. OrderCreated leads inventory to reserve stock. InventoryReserved leads payment to authorize. PaymentAuthorized leads shipping to prepare fulfillment. There is no single controller, which can reduce coupling, but the global workflow becomes harder to see and harder to change safely.`,
        `Neither style is automatically better. Orchestration centralizes control and can become a bottleneck or god service if designed carelessly. Choreography spreads control and can become an event tangle if every service learns too much about every other service. The right choice depends on ownership, audit needs, failure visibility, and workflow complexity.`,
      ],
    },
    {
      heading: `Compensation Design`,
      paragraphs: [
        `A compensation must match the domain, not the database table. Releasing inventory, voiding an authorization, cancelling a shipment, refunding money, deleting a draft account, sending a correction email, and opening a support task are different kinds of repair. Some are automatic. Some are partial. Some cost money. Some require human approval.`,
        `Good compensations are idempotent. A refund command may be delivered twice during a retry storm, so the payment service needs to recognize that the same refund already happened. The same rule applies to cancel, release, void, and correction commands. A retry should make progress or prove that progress already happened.`,
        `Step ordering should be chosen around compensation quality. Reversible, cheap, internal actions can happen early. Irreversible, expensive, public, or customer-visible actions should happen late when possible. If an email cannot be unsent, send it after the workflow is confident, or design a correction path that is honest with the user.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `A saga works because it replaces blocking atomicity with durable intent and retryable repair. Local transactions still give each service strong rules inside its own boundary. The workflow record gives the cross-service process a memory. Idempotency lets commands be retried without duplicating real-world effects.`,
        `The correctness target is eventual outcome, not instantaneous invisibility. During the saga, other systems may observe a hotel reservation before the car rental succeeds. That is not a bug in the pattern; it is the cost of avoiding a distributed lock. Readers must understand pending states, reservation states, and final states.`,
        `This makes sagas compatible with availability-oriented systems. A service can commit locally and move on. If another service is down, the workflow waits, retries, compensates, or escalates. The price is more explicit business state and more careful product behavior around in-progress work.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The saga pattern reduces lock duration and cross-service blocking, but it moves complexity into workflow design. Each forward command needs a timeout, retry rule, idempotency key, compensation, and failure classification. Each compensation needs the same treatment.`,
        `A workflow touching six services can have many states: pending inventory, inventory reserved, payment authorized, payment failed, shipping requested, shipping cancelled, customer notified, manual review, compensated, and completed. These states must be named in the product, logs, metrics, and support tooling. If operators only see success or failure, they cannot repair the middle.`,
        `Retries need rate limits and backoff. A payment outage should not cause every pending saga to hammer the payment service once per second. A popular checkout path should not create a thundering herd of compensations when one downstream provider is degraded. Sagas make progress through retries, but production systems must pace those retries.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Model the saga as an explicit state machine. Give every state a name, every transition a reason, and every external command an idempotency key. Store the workflow record durably before doing work that depends on it, and update it after each observed result. Ambiguous gaps are where duplicate charges and missing cancellations are born.`,
        `Separate transient failures from permanent business failures. A network timeout, HTTP 503, lock conflict, or rate limit may deserve retry. A declined card, invalid address, sold-out item, or policy rejection may require compensation or a user-facing decision. Treating all errors the same produces either endless retries or premature cancellation.`,
        `Use an outbox or durable message mechanism when a local database change must publish an event. Otherwise the service can commit its database and crash before the event is sent, leaving the saga stuck. The outbox pattern keeps local state and outgoing messages tied to the same durable commit.`,
        `Instrument the workflow as a first-class object. You want metrics for age by state, retry counts, compensation counts, stuck workflows, duplicate command suppression, provider error classes, manual repair volume, and final outcomes. Distributed tracing should connect the saga id through every service call.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Sagas fit e-commerce checkout, travel booking, ride-hailing, claims processing, account onboarding, subscription changes, marketplace payouts, loan origination, and long-running provisioning. These workflows cross teams and systems, and their business rules already contain pending, cancelled, refunded, rejected, and manual-review states.`,
        `They are strongest when each participant can protect its own local invariant. Inventory must not oversell. Payment must not double charge. Shipping must not create duplicate labels. The saga then coordinates those local truths into a larger outcome.`,
        `They also work well when product language can show in-progress state honestly. A user can understand "pending payment", "reservation held", "refund processing", or "order cancelled". If the product insists that intermediate states do not exist, the engineering pattern and the user promise are fighting each other.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Sagas fail when compensation is pretend. If money cannot be refunded, inventory cannot be released, a legal notice cannot be corrected, or a partner action cannot be cancelled, the workflow does not have a clean repair path. That does not mean the business cannot proceed, but it does mean the saga must include manual review, apology, credits, or another explicit policy.`,
        `They fail when intermediate visibility is unacceptable. Some financial ledger operations, entitlement changes, identity updates, and inventory promises need stronger boundaries or a different model with pending states. A saga is not a license to expose inconsistent facts and hope no one notices.`,
        `They also fail when the team treats events as the source of truth without a workflow record. A pile of messages is not a state machine. If no system can answer which step completed, which compensation is owed, and which retry is next, the saga exists only as folklore.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `A trip-booking saga starts with a request to book flight, hotel, car, and payment. The workflow creates a saga record in state "started". It books the flight with idempotency key trip-123-flight and records flightBooked. It reserves the hotel with trip-123-hotel and records hotelReserved. It tries to rent the car with trip-123-car.`,
        `If the car rental fails permanently, the workflow marks compensationStarted. It cancels the hotel reservation with trip-123-hotel-cancel. After that succeeds or is proven already done, it refunds or cancels the flight booking with trip-123-flight-refund. Then it marks the saga compensated and tells the user the trip could not be completed.`,
        `If the car rental times out, the workflow should not guess. It can retry with the same key, ask the provider for the status of that key, or move to a pending state until the answer is known. Guessing is how systems create both a rental and a cancellation, or neither.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Two-Phase Commit to understand the atomic alternative and why it blocks. Study Write-Ahead Log to understand durable local commits. Study Transactional Outbox to connect local state changes to messages. Study Message Queue, Idempotency, Distributed Tracing, Retries with Jitter, Circuit Breakers, and Rate Limiter to understand the production shell around a saga.`,
        `For deeper design, compare saga orchestration with choreography, then model one workflow as a state machine. Write down each forward action, each compensation, whether it is idempotent, what happens on timeout, what happens on permanent rejection, and what an operator sees when the workflow is stuck. That exercise exposes most saga bugs before code is written.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The textbook answer to multi-service atomicity is Two-Phase Commit (2PC). A coordinator sends PREPARE to every participant. Each participant writes enough state to guarantee it can commit or abort on demand, then votes YES or NO. If all vote YES, the coordinator sends COMMIT; otherwise ABORT. The protocol gives a clean atomic boundary: either every database commits or none does.`,
        `2PC works well when participants are few, close together, under one team's control, and the transaction is short. Database-to-database joins inside one data center, XA transactions across two JDBC sources, and tightly coupled ledger updates are legitimate 2PC territory. The protocol is not a strawman; it solves a real problem within its constraints.`,
        `The wall appears when the transaction crosses ownership, network, and time boundaries. A checkout that calls a payment gateway, a partner inventory API, an email service, and a shipping provider cannot ask all four to hold locks while a coordinator deliberates. The payment gateway is not yours to lock. The shipping provider may take seconds. A service may deploy mid-transaction. 2PC's prepare phase becomes a distributed stall, and a coordinator crash leaves every participant blocked until recovery. Garcia-Molina and Salem identified this in 1987: long-lived transactions need a different contract.`,
      ],
    },
    {
      heading: 'Garcia-Molina and Salem, 1987',
      paragraphs: [
        `Hector Garcia-Molina and Kenneth Salem introduced the saga concept in their 1987 paper "Sagas" (ACM SIGMOD). The motivating problem was long-lived transactions: a batch job, a multi-day business process, or a workflow that holds database locks for minutes or hours. Traditional ACID transactions assume short critical sections. When a transaction runs long, it blocks other work, wastes resources on aborts, and creates fragile dependencies on coordinator availability.`,
        `Their solution was to decompose a long-lived transaction T into a sequence of sub-transactions T1, T2, ..., Tn, each of which commits independently. For every sub-transaction Ti, the designer provides a compensating transaction Ci that semantically undoes Ti's effects. If the saga completes all steps, the outcome is equivalent to T having committed. If it fails at step Tk, the system runs compensations Ck-1, Ck-2, ..., C1 in reverse order, producing a net effect equivalent to T never having run.`,
        `The 1987 paper focused on single-database sagas for long batch jobs. The microservices era repurposed the same idea across service boundaries, where each sub-transaction is a local commit in a different service's database. The algebra is identical: forward steps commit eagerly, and compensations restore a consistent business outcome on failure. What changed is that the sub-transactions now cross network and ownership boundaries, making the compensation design harder and the coordination protocol more important.`,
      ],
    },
    {
      heading: 'Choreography versus orchestration',
      paragraphs: [
        `Orchestration uses a central coordinator service that owns the saga state machine. The coordinator calls each participant in order, records progress durably, handles retries, and triggers compensations. The state machine is explicit: you can query it, visualize it, and audit it. Temporal (formerly Cadence), AWS Step Functions, Netflix Conductor, and most workflow engines implement this model. The coordinator is a single point of visibility, not necessarily a single point of failure, because the state machine can be replicated or rebuilt from durable storage.`,
        `Choreography distributes control. Each service publishes a domain event when its local transaction commits. The next service in the chain subscribes to that event and runs its own step. OrderPlaced triggers InventoryReserved, which triggers PaymentAuthorized, which triggers ShipmentCreated. No central brain exists. Coupling is lower in theory, but the global workflow is now implicit in the event wiring. Adding a step, reordering steps, or understanding why a saga is stuck requires tracing events across multiple services and message brokers.`,
        `Orchestration is usually the better starting point. The explicit state machine makes failure handling, compensation ordering, timeout management, and operational debugging straightforward. Choreography can work for simple two- or three-step flows where the event chain is obvious and rarely changes. In practice, most teams that start with choreography migrate toward orchestration as workflows grow, because debugging a five-service event chain during a production incident is significantly harder than querying a workflow table.`,
      ],
    },
    {
      heading: 'Worked example: e-commerce order',
      paragraphs: [
        `An e-commerce checkout saga has three forward steps: (1) reserve inventory, (2) charge payment, (3) initiate shipment. Each step commits in its own service's database. The saga record stores the order id, current state, and idempotency keys for every command.`,
        `Step 1: the inventory service receives reserve(orderId=42, sku=WIDGET, qty=3, idempotencyKey=ord-42-inv). It decrements available stock by 3 and records a reservation row. The saga record advances to inventoryReserved. Step 2: the payment service receives charge(orderId=42, amount=$59.97, idempotencyKey=ord-42-pay). It creates an authorization against the customer's card. The saga record advances to paymentCharged. Step 3: the shipping service receives ship(orderId=42, address=..., idempotencyKey=ord-42-ship). It creates a shipping label and schedules pickup. The saga record advances to shipmentInitiated, then completed.`,
        `Now suppose payment fails at step 2: the card is declined. The saga cannot roll back inventory with a database UNDO; the reservation is already committed. Instead, it runs compensation C1: releaseInventory(orderId=42, idempotencyKey=ord-42-inv-comp). The inventory service adds 3 units back to available stock and marks the reservation cancelled. The saga record moves to compensated. The customer sees "payment declined, order cancelled" and stock is available for other buyers.`,
        `Notice the step ordering: inventory is reserved before payment because a false reservation is cheap to undo (release stock), while a false charge is expensive to undo (refund money, customer confusion). The general rule is to place cheap, reversible, internal steps early and expensive, visible, or irreversible steps late. Shipment goes last because recalling a package from a carrier is the hardest compensation of all.`,
      ],
    },
    {
      heading: 'Sagas versus 2PC',
      paragraphs: [
        `2PC guarantees atomicity: either all participants commit or none does. No observer ever sees an intermediate state. The cost is availability. Every participant must hold locks during the prepare-commit window, the coordinator is a single point of blocking failure, and a crashed coordinator can leave participants stuck in the prepared state indefinitely (the blocking problem). Adding participants increases the probability that at least one is slow, failed, or unreachable, extending the lock window.`,
        `Sagas guarantee eventual consistency: the workflow either completes all forward steps or compensates back to a clean state, but intermediate states are visible to other transactions during the process. The cost is isolation. A concurrent reader may see a reserved hotel for a trip that will be cancelled in the next second. The benefit is availability: no service holds locks waiting on another service, each participant commits and moves on, and a crashed coordinator can recover from durable state without blocking participants.`,
        `The tradeoff maps directly to the CAP theorem. 2PC chooses consistency over availability at the cross-service boundary. Sagas choose availability over consistency at the cross-service boundary, while keeping consistency within each local service. Most microservice architectures accept this tradeoff because cross-service 2PC at internet scale is impractical: you cannot ask Stripe, FedEx, and a partner API to all hold locks while your coordinator thinks.`,
      ],
    },
    {
      heading: 'Production tooling',
      paragraphs: [
        `Temporal (open source, formerly Uber Cadence) models sagas as durable workflows in Go, Java, TypeScript, or Python. Each activity is a forward step with automatic retry and timeout. Compensation is coded as a normal activity triggered by workflow logic. Temporal persists workflow state through event sourcing, so a crashed worker replays the event history and resumes exactly where it left off. This eliminates most hand-rolled state machine code.`,
        `AWS Step Functions model sagas as state machines in JSON (Amazon States Language). Each state can be a Task (Lambda, ECS, API call), with Catch and Retry blocks. A compensation path is a parallel branch of states triggered on error. Step Functions persist state durably in the AWS control plane. The main limitation is expressiveness: complex branching and dynamic step counts require workarounds.`,
        `For simpler cases, a saga can be implemented with a durable message queue (SQS, RabbitMQ, Kafka) and a saga table in a relational database. Each forward step writes its result to the saga table and publishes the next command to the queue. A compensation worker subscribes to failure events and walks the saga table backward. This is more work than a workflow engine but avoids a platform dependency.`,
      ],
    },
],
};
