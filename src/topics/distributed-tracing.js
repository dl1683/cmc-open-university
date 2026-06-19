// Distributed tracing: one user clicks "buy", six services fire, and the
// page takes 120ms. WHICH service ate the time? Follow one trace ID through
// the whole tree of calls and watch the culprit light up.

import { callTreeState, InputError } from '../core/state.js';

export const topic = {
  id: 'distributed-tracing',
  title: 'Distributed Tracing',
  category: 'Systems',
  summary: 'One trace ID, one tree of spans across six services — and the slow hop has nowhere to hide.',
  controls: [
    { id: 'view', label: 'Follow', type: 'select', options: ['one checkout request'], defaultValue: 'one checkout request' },
  ],
  run,
};

export function* run(input) {
  if (String(input.view) !== 'one checkout request') throw new InputError('Pick the walkthrough.');

  const frames = new Map();
  const open = (id, parentId, name) => frames.set(id, { id, parentId, name, args: '…', status: 'active', result: null });
  const wait = (id) => { frames.get(id).status = 'waiting'; };
  const close = (id, ms) => {
    const f = frames.get(id);
    f.status = 'returned';
    f.args = `${ms}ms`;
    f.result = `${ms}ms`;
  };
  const snapshot = () => callTreeState([...frames.values()]);

  yield {
    state: callTreeState([]),
    highlight: {},
    explanation: 'A user reports: "checkout is slow." Six microservices touch every checkout, each with its OWN logs on its OWN machines — six islands of evidence with no shared story. Distributed tracing stitches them: the gateway mints one TRACE ID, every service passes it along in a request header (the W3C traceparent), and each unit of work records a SPAN — who am I, who called me, how long did I take. The spans assemble into a tree. Watch one request build it.',
  };

  open('g', null, 'gateway');
  yield {
    state: snapshot(),
    highlight: { active: ['g'] },
    explanation: 'POST /checkout hits the gateway — span opens, trace ID abc123 is born. Everything that happens downstream, in any service on any machine, will carry this ID.',
  };

  wait('g');
  open('a', 'g', 'auth');
  yield {
    state: snapshot(),
    highlight: { active: ['a'] },
    explanation: 'The gateway calls auth to validate the session token. A child span opens under the gateway — parentId is how the tree structure survives being scattered across machines.',
  };

  close('a', 15);
  open('o', 'g', 'orders');
  yield {
    state: snapshot(),
    highlight: { returning: ['a'], active: ['o'] },
    explanation: 'Auth returns in 15ms — its span closes and ships off to the tracing backend. The gateway proceeds to the orders service, which owns the checkout logic… and fans out further.',
  };

  wait('o');
  open('i', 'o', 'inventory');
  close('i', 20);
  open('p', 'o', 'payments');
  yield {
    state: snapshot(),
    highlight: { returning: ['i'], active: ['p'] },
    explanation: 'Orders checks inventory (20ms, fine) and then calls payments. So far every hop looks innocent — which is exactly why per-service dashboards never caught this: each service IS fast, except…',
  };

  wait('p');
  open('f', 'p', 'fraud-check');
  yield {
    state: snapshot(),
    highlight: { active: ['f'] },
    explanation: '…payments quietly calls a fraud-check service that nobody remembered was in the path. Its span opens — and stays open. And open. The tree doesn\'t lie: everything else is done; this one box is still burning.',
  };

  close('f', 55);
  close('p', 70);
  close('o', 95);
  open('n', 'g', 'notify');
  close('n', 2);
  close('g', 120);
  yield {
    state: snapshot(),
    highlight: { returning: ['g'] },
    explanation: 'The request completes: fraud-check 55ms → payments 70ms total → orders 95ms → gateway 120ms (notify fires an event onto a Message Queue in 2ms and doesn\'t wait — async work drops off the critical path). Every span carries the same trace ID, so the backend reassembles this exact tree from six services\'s worth of fragments.',
    invariant: 'A span\'s duration includes all of its children — the tree IS the timing breakdown.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['g', 'o', 'p', 'f'] },
    explanation: 'The verdict, readable at a glance: the CRITICAL PATH is gateway → orders → payments → fraud-check, and fraud-check alone is 55 of the 120ms — 46% of the user\'s wait, hiding two layers deep where no single service\'s logs would ever show it. This is the entire value proposition: the tree turns "checkout is slow" into "fraud-check needs a cache." (Recognize the shape? It is the Recursion call tree, distributed across machines.)',
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'In production: OpenTelemetry is the instrumentation standard; Jaeger and Zipkin the open-source backends; Datadog and Honeycomb the hosted ones. Tracing every request would drown you — so systems SAMPLE (often keeping all slow/error traces and a fair fraction of normal ones — see Reservoir Sampling). Traces complete the observability trio: METRICS say something is slow, LOGS say what one service saw, TRACES say where the time went. The debugging tool for the microservices world the Saga Pattern and Message Queues built.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Distributed Tracing. One trace ID, one tree of spans across six services — and the slow hop has nowhere to hide..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Distributed tracing follows one user request through dozens of machines, dozens of services, and hundreds of function calls — and assembles them into a single tree. A trace ID (like abc123) is minted at the gateway and propagated downstream in request headers, especially the W3C traceparent standard. Each unit of work — a function call, a database query, an RPC — records a span: its name, start time, end time, and parentId (which service called me). All spans with the same trace ID reassemble at a tracing backend into the exact shape of the dependency tree. If a request takes 120ms from user to response, the tree shows which 55ms came from fraud-check, which 20ms from inventory, which 45ms from idle network waiting.`,
        `Without tracing, each service logs its own events to its own server. A checkout that takes 120ms looks fast in the auth service (15ms), fine in inventory (20ms), reasonable in payments (70ms). The bug hides two layers deep. Tracing exposes it: fraud-check is the critical path. It is the Recursion call tree, but scattered across a dozen machines and reassembled by timestamp and parentId.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The obvious approach is to inspect service logs one by one. That works when one service owns the whole request. It breaks down when latency comes from nested calls, retries, network waits, queue handoffs, or a dependency nobody remembered was on the path.`,
        `Per-service dashboards hit the same wall. Auth can look fast, inventory can look fast, and payments can look acceptable while the composed checkout is slow. Without parent-child timing, you cannot tell which spans were serial, which overlapped, and which one sat on the critical path.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Use the visual model as one checkout trace being built. When a span opens, a service has started work. When it waits, that service is blocked on a child span. When it returns, its duration becomes evidence about the request path. The tree is not a map of every possible dependency; it is the exact call tree for this request.`,
        `Fraud-check matters because it sits on the critical path. Its 55ms flows upward into payments, orders, and gateway. Notify is different: it publishes to a queue and returns quickly, so later notification work is operationally relevant but not part of this user's response time.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is context propagation. The system must carry trace identity across process boundaries so independently emitted spans can be joined later. W3C Trace Context standardizes headers such as traceparent and tracestate for this reason.`,
        `A span is useful because it has both timing and parentage. Timing alone is a stopwatch. Parentage turns many stopwatches into a dependency tree, separating self time, child time, parallel work, and detached async work.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `When a request arrives at the gateway, a trace ID is generated and stored in the request context. The gateway opens a root span (the gateway service itself) and immediately passes the trace ID and span ID to the next service — usually in request headers. That service, say the orders service, creates a child span with the trace ID and the gateway span as its parentId. When orders calls inventory, it passes the trace ID again, and inventory creates a span whose parentId points to the orders span. Every downstream service does the same.`,
        `Each span records a start time and end time. When inventory finishes in 20ms, its span closes and ships to the tracing backend. When orders finishes 75ms after it started, the orders span closes. The backend collects all fragments from all machines and sorts them by trace ID: one trace, six spans, one tree. A span's duration includes all nested spans — the tree itself is the timing breakdown.`,
        `Async work (like notify sending an event to a Message Queue) can be detached from the critical path: the span opens, fires the message, and closes immediately without waiting for the consumer. The request completes faster, and the tracing backend knows which work ran on the critical path and which ran fire-and-forget.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Spans can arrive out of order from different machines. The backend can still assemble the trace if each span carries trace ID, span ID, and parent span ID. Those identifiers are enough to rebuild the tree after the work has already happened.`,
        `Latency attribution works because span intervals nest or overlap in time. A child span inside a parent contributes to the parent's elapsed time, but two overlapping children should not be added as if they were serial. The trace view prevents that common arithmetic mistake.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A checkout trace takes 120ms. Gateway calls auth for 15ms, then orders. Orders checks inventory in 20ms and calls payments. Payments calls fraud-check, which takes 55ms. Payments finishes at 70ms, orders at 95ms, and gateway at 120ms.`,
        `The conclusion is not merely that payments took 70ms. Payments is slow because fraud-check dominates its child time, and payments sits under orders, which sits under gateway. If fraud-check can be cached or moved off the synchronous path safely, the user-facing latency can improve.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Instrumenting every service to emit spans requires a client library (OpenTelemetry is the standard) and a tracing backend (Jaeger and Zipkin are free and open-source; Datadog, Honeycomb, and others are hosted). Tracing every request is too expensive: 10,000 requests per second times 100 bytes per span quickly overwhelms disks and networks. Most production systems sample: keep 100% of slow traces (e.g., anything over 1 second) and 100% of error traces, then sample 1% of fast, normal requests — a strategy called tail-based sampling. See Reservoir Sampling for the math. The overhead is small once sampling is in place: a span is just six integers (IDs and timestamps) and a string (the name).`,
      ],
    },
    {
      heading: 'Cost and behavior (2)',
      paragraphs: [
        `The real costs are storage, high-cardinality attributes, privacy review, and operational dependency on collectors. Head sampling is cheap but can drop the slow trace before the system knows it is slow. Tail sampling can keep slow and error traces, but it needs buffering and backend capacity.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `The primary use is debugging latency regressions: "our checkout endpoint got slower last week; which service changed?" The trace tree answers in seconds. Second use: capacity planning. If fraud-check is the critical path and takes 45% of the total time, redesigning payments (which takes 20%) saves nothing. Third: dependency discovery. New engineers ask "what does this service call?" A trace shows every downstream call in order, with latency for each. Fourth: contract violations. If a service promises 50ms SLA but consistently takes 100ms when called by a certain caller, distributed tracing identifies the pattern.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Myth: "Tracing tells me why something is slow." False — it tells you where (which service, which function). The why comes from profilers, logs, and human investigation. Myth: "A 120ms trace means my response time is 120ms." False: if 100 traces run in parallel (common with async work), the median response time might be 120ms but the sum of all spans across all traces is 12,000ms. Tracing shows concurrency; it does not measure throughput. Pitfall: forgetting to propagate the trace ID. If one service doesn't pass the header downstream, the trace breaks into fragments — the tree becomes a forest. Pitfall: over-sampling. If you keep every normal request, your tracing backend becomes a bottleneck and you lose the latency advantage. Pitfall: confusing traces with metrics. Metrics (response time percentiles) drive the alert; traces (the full call tree) explain it.`,
      ],
    },
    {
      heading: 'Sources and standards',
      paragraphs: [
        `OpenTelemetry's traces concept page describes traces as collections of spans and identifies context propagation as the core concept that lets spans from different services be assembled into one trace: https://opentelemetry.io/docs/concepts/signals/traces/. Its context propagation page explains how traces, metrics, and logs can be correlated across process and network boundaries: https://opentelemetry.io/docs/concepts/context-propagation/.`,
        `The W3C Trace Context specification standardizes traceparent and tracestate headers so trace identity can move across vendor boundaries: https://www.w3.org/TR/trace-context/. Jaeger's architecture documentation explains the production side: spans, collectors, query service, storage backends, and sampling to control overhead: https://www.jaegertracing.io/docs/1.76/architecture/. OpenTelemetry's JavaScript propagation docs show the same propagation idea in the JavaScript ecosystem: https://opentelemetry.io/docs/languages/js/propagation/.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `GenAI Trace Token Cost Ledger is the LLM-specific continuation: the same span tree must carry model version, prompt hash, token usage, cache hit/miss, tool calls, eval scores, safety verdicts, cost, redaction policy, and rollout cohort.`,
        `Trace Context & Baggage Propagation goes one layer lower and shows how traceparent, tracestate, and bounded baggage survive proxies, queues, and vendor boundaries. OpenTelemetry Tail Sampling Policy shows how a backend keeps expensive traces after it knows whether they were slow or erroneous.`,
        `Metric Exemplars Trace Correlation connects aggregate latency buckets back to exact trace IDs, while SLO Error Budget Burn Rate Alert explains when a trace investigation becomes a page and Log Template Drain Parser shows how raw logs become joinable event keys during incident response.`,
        `DDSketch Relative-Error Quantiles explains how tracing and metrics backends roll up latency distributions without averaging p99s. Tail Latency & p99 Thinking explains why those percentiles matter before you inspect individual traces.`,
        `Distributed tracing visualizes the shape of the dependency tree, which is identical to a Recursion call tree. Understanding Recursion first makes tracing intuitive. Async Context Propagation shows how trace IDs and request-local values survive promise, timer, and callback hops inside one JavaScript service before they become cross-service headers. If a service delegates work asynchronously, the critical path shrinks: see Load Balancer for how systems shed work to avoid bottlenecks. When tracing a saga that spans multiple services, see Saga Pattern to understand compensation and rollback. Finally, Message Queues decouple services and allow async fire-and-forget — the technique that lets trace work drop off the critical path.`,
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
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
        'Use this topic as a checkpoint: if you can explain why Distributed Tracing moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
