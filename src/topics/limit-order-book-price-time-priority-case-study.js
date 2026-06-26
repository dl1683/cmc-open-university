// A limit order book is a two-sided price ladder: price levels are ordered,
// and each level owns a FIFO queue of resting orders.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'limit-order-book-price-time-priority-case-study',
  title: 'Limit Order Book Price-Time Priority Case Study',
  category: 'Systems',
  summary: 'A market microstructure case study: bid/ask price trees, FIFO queues per price level, order ids, partial fills, cancels, replaces, spread, depth, and price-time priority.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['price levels', 'matching step'], defaultValue: 'price levels' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function bookGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'buyTree', label: 'bids', x: 1.1, y: 3.3, note: notes.buyTree || 'max price' },
      { id: 'bid100', label: '100.00', x: 2.8, y: 1.9, note: notes.bid100 || 'q:2' },
      { id: 'bid99', label: '99.95', x: 2.8, y: 4.8, note: 'q:1' },
      { id: 'sellTree', label: 'asks', x: 7.9, y: 3.3, note: notes.sellTree || 'min price' },
      { id: 'ask10005', label: '100.05', x: 6.2, y: 1.9, note: notes.ask10005 || 'q:2' },
      { id: 'ask10010', label: '100.10', x: 6.2, y: 4.8, note: 'q:3' },
      { id: 'bestBid', label: 'best bid', x: 4.2, y: 2.1, note: 'top' },
      { id: 'bestAsk', label: 'best ask', x: 4.9, y: 2.1, note: 'top' },
      { id: 'spread', label: 'spread', x: 4.6, y: 5.4, note: notes.spread || '5c' },
    ],
    edges: [
      { id: 'e-buy-100', from: 'buyTree', to: 'bid100', weight: 'top' },
      { id: 'e-buy-99', from: 'buyTree', to: 'bid99', weight: '' },
      { id: 'e-sell-10005', from: 'sellTree', to: 'ask10005', weight: 'top' },
      { id: 'e-sell-10010', from: 'sellTree', to: 'ask10010', weight: '' },
      { id: 'e-bid-best', from: 'bid100', to: 'bestBid', weight: '' },
      { id: 'e-ask-best', from: 'ask10005', to: 'bestAsk', weight: '' },
      { id: 'e-best-spread', from: 'bestBid', to: 'spread', weight: '' },
      { id: 'e-ask-spread', from: 'bestAsk', to: 'spread', weight: '' },
    ],
  }, { title });
}

function* priceLevels() {
  yield {
    state: bookGraph('Two ordered maps point to FIFO price queues'),
    highlight: { active: ['buyTree', 'sellTree'], compare: ['bid100', 'ask10005'], found: ['spread'] },
    explanation: 'A limit order book usually keeps bids in descending price order and asks in ascending price order. Each price level owns a queue of resting orders in time priority.',
    invariant: 'Price priority chooses the best price; time priority chooses the earliest live order inside that price level.',
  };

  yield {
    state: labelMatrix(
      'Price level queues',
      [
        { id: 'b100', label: 'B100.00' },
        { id: 'b9995', label: 'B99.95' },
        { id: 'a10005', label: 'A100.05' },
        { id: 'a10010', label: 'A100.10' },
      ],
      [
        { id: 'head', label: 'head' },
        { id: 'tail', label: 'tail' },
        { id: 'qty', label: 'qty' },
      ],
      [
        ['o17', 'o22', '600'],
        ['o12', 'o12', '200'],
        ['o31', 'o44', '500'],
        ['o40', 'o53', '900'],
      ],
    ),
    highlight: { active: ['b100:head', 'b100:tail'], compare: ['a10005:head'], found: ['b100:qty', 'a10005:qty'] },
    explanation: 'The ordered price map gives best-price lookup. The per-price FIFO queue gives fair execution order and lets cancels remove specific order ids.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'price', min: 99.9, max: 100.2 }, y: { label: 'shares', min: 0, max: 1200 } },
      series: [
        { id: 'bidDepth', label: 'bid', points: [{ x: 99.95, y: 200 }, { x: 100.00, y: 800 }] },
        { id: 'askDepth', label: 'ask', points: [{ x: 100.05, y: 500 }, { x: 100.10, y: 900 }, { x: 100.15, y: 1100 }] },
      ],
      markers: [
        { id: 'bb', label: 'BB', x: 100.00, y: 800 },
        { id: 'ba', label: 'BA', x: 100.05, y: 500 },
      ],
    }, { title: 'Depth is cumulative liquidity around the spread' }),
    highlight: { active: ['bidDepth'], compare: ['askDepth'], found: ['bb', 'ba'] },
    explanation: 'A book is not only the top quote. Depth by price level tells matching, routing, slippage, and risk systems how much displayed liquidity exists near the touch.',
  };

  yield {
    state: labelMatrix(
      'Book operations',
      [
        { id: 'add', label: 'add' },
        { id: 'cancel', label: 'cancel' },
        { id: 'replace', label: 'replace' },
        { id: 'execute', label: 'execute' },
      ],
      [
        { id: 'index', label: 'index' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['id map + level', 'append'],
        ['order id', 'remove qty'],
        ['old -> new id', 'priority?'],
        ['head order', 'fill'],
      ],
    ),
    highlight: { active: ['add:index', 'cancel:index'], compare: ['replace:effect'], found: ['execute:effect'] },
    explanation: 'The order-id map is as important as the price tree. Cancels, partial fills, and replaces must find one live order without scanning the whole book.',
  };
}

function* matchingStep() {
  yield {
    state: bookGraph('An incoming buy crosses the best ask', { ask10005: 'match', spread: 'cross' }),
    highlight: { active: ['ask10005', 'bestAsk'], compare: ['bid100'], found: ['e-ask-best'] },
    explanation: 'A marketable buy order matches against the lowest ask first. If the incoming quantity exceeds the first resting order, matching continues through the price level queue and then to the next ask level.',
    invariant: 'The matching engine must make one deterministic sequence of book mutations and execution events.',
  };

  yield {
    state: labelMatrix(
      'Fill walk',
      [
        { id: 'inc', label: 'incoming' },
        { id: 'o31', label: 'o31' },
        { id: 'o44', label: 'o44' },
        { id: 'rest', label: 'rest' },
      ],
      [
        { id: 'qty', label: 'qty' },
        { id: 'state', label: 'state' },
      ],
      [
        ['700 buy', 'crosses'],
        ['300 sell', 'filled'],
        ['200 sell', 'filled'],
        ['200 buy', 'posts?'],
      ],
    ),
    highlight: { active: ['inc:qty', 'o31:qty', 'o44:qty'], compare: ['rest:state'], found: ['o31:state', 'o44:state'] },
    explanation: 'Price-time priority consumes resting liquidity in queue order. Any unfilled remainder follows the order type: post, cancel, reject, or route depending on venue and instructions.',
  };

  yield {
    state: bookGraph('After fills, best ask advances to the next level', { ask10005: 'empty', ask10010: 'new top', spread: '10c' }),
    highlight: { active: ['ask10010', 'bestAsk', 'spread'], compare: ['ask10005'], found: ['e-sell-10010'] },
    explanation: 'When a price queue empties, the price level is removed from the ordered map and the best ask pointer advances. This update must be atomic with the fill events.',
  };

  yield {
    state: labelMatrix(
      'Priority traps',
      [
        { id: 'reduce', label: 'reduce' },
        { id: 'price', label: 'price' },
        { id: 'hidden', label: 'hidden' },
        { id: 'tie', label: 'tie' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['keep place?', 'venue rule'],
        ['new price', 'lose time'],
        ['display rules', 'complex'],
        ['seq number', 'determinism'],
      ],
    ),
    highlight: { active: ['price:rule', 'tie:rule'], compare: ['hidden:risk'], found: ['reduce:rule'] },
    explanation: 'The hard part is not the tree lookup; it is the rulebook. Replace semantics, hidden orders, self-trade prevention, auctions, and ties must be encoded explicitly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'price levels') yield* priceLevels();
  else if (view === 'matching step') yield* matchingStep();
  else throw new InputError('Pick an order-book view.');
}

export const article = {
  references: [
    { title: 'Nasdaq OUCH 5.0 Order Entry Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf' },
    { title: 'Nasdaq TotalView-ITCH 5.0 Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf' },
    { title: 'CME Market by Order FAQ', url: 'https://www.cmegroup.com/articles/faqs/market-by-order-mbo.html' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for limit-order-book price-time priority. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'Price-time priority is implemented by ordered price maps plus FIFO queues, with an order-id index making cancels and fills local.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Order_book_depth_chart.gif', alt: 'Animated order book depth chart with bids on the left and asks on the right.', caption: 'Order book depth chart by Kjerish, Wikimedia Commons, CC BY-SA 4.0.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'limit-order-book price-time priority exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in limit-order-book price-time priority. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'limit-order-book price-time priority fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the ask map has 100.05 -> [o31: 300 shares, o44: 200 shares] and 100.07 -> [o52: 500 shares]. A buy limit order for 700 shares at 100.10 arrives. It fills o31 for 300, o44 for 200, then 200 from o52.',
        'The incoming order is complete, and o52 remains with 300 shares at 100.07. The log has three fills and displayed ask depth falls by 700 shares. Price priority selected 100.05 before 100.07; time priority selected o31 before o44.',
        'If a cancel for o44 is sequenced before the buy, the id index removes o44 directly. The buy then fills o31 for 300 and o52 for 400. Event order decides the book, not later argument.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf, and CME Market by Order at https://www.cmegroup.com/articles/faqs/market-by-order-mbo.html. Study Queue, Red-Black Tree, Skip List, Matching Engine Sequencer Event Log Case Study, and Event Sourcing next.',
      ],
    },
  ],
};
