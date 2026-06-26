// Connection pooling: opening a database connection costs 1-3ms on a LAN,
// 50-150ms across the WAN, and a TLS handshake adds ~2 more round trips.
// A pool pays that cost once, then lends idle connections to whoever needs one.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'connection-pooling',
  title: 'Connection Pooling',
  category: 'Systems',
  summary: 'Reuse expensive connections instead of opening and closing them per request — a bounded pool with checkout, return, health checks, and eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pool lifecycle', 'checkout under load'], defaultValue: 'pool lifecycle' },
  ],
  run,
};

function poolGraph(title, { idle = '3 idle', active = '2 active', waiting = '0', total = '5/10', action = '' } = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'application', x: 1.0, y: 3.5, note: action || 'requests' },
      { id: 'pool', label: 'POOL', x: 4.5, y: 3.5, note: total },
      { id: 'idle', label: 'idle conns', x: 7.5, y: 1.5, note: idle },
      { id: 'active', label: 'active conns', x: 7.5, y: 3.5, note: active },
      { id: 'wait', label: 'wait queue', x: 7.5, y: 5.5, note: waiting },
      { id: 'db', label: 'DATABASE', x: 9.5, y: 3.5, note: 'max_connections' },
    ],
    edges: [
      { id: 'e-app-pool', from: 'app', to: 'pool', weight: 'checkout' },
      { id: 'e-pool-idle', from: 'pool', to: 'idle', weight: 'pick' },
      { id: 'e-pool-active', from: 'pool', to: 'active', weight: 'in use' },
      { id: 'e-pool-wait', from: 'pool', to: 'wait', weight: 'park' },
      { id: 'e-active-db', from: 'active', to: 'db', weight: 'TCP' },
      { id: 'e-idle-db', from: 'idle', to: 'db', weight: 'TCP' },
    ],
  }, { title });
}

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

function* poolLifecycle() {
  const poolNodes = 6;
  const poolEdges = 6;
  const maxPoolSize = 10;
  const healthChecks = 4;

  yield {
    state: poolGraph('Cold start: pool is empty, first request opens a connection', {
      idle: '0', active: '0', waiting: '0', total: `0/${maxPoolSize}`, action: 'first request',
    }),
    highlight: { active: ['app', 'e-app-pool'], compare: ['pool'] },
    explanation: `The pool of ${poolNodes} components starts empty. The first checkout finds no idle connection, so it opens a fresh TCP socket to the database, completes the handshake (TCP three-way + optional TLS), authenticates, and returns the ready connection. That startup cost is paid once per physical connection.`,
    invariant: `idle + active + opening <= max pool size of ${maxPoolSize}.`,
  };

  yield {
    state: poolGraph('Connection in use: the pool tracks ownership', {
      idle: '0', active: '1', waiting: '0', total: `1/${maxPoolSize}`, action: 'using conn',
    }),
    highlight: { active: ['active', 'e-active-db'], found: ['db'] },
    explanation: `The application holds the connection while it runs queries through ${poolEdges} edges. The pool marks it active. No other caller can use this connection until the holder returns it. The database sees one authenticated session occupying one of its max_connections slots.`,
  };

  yield {
    state: poolGraph('Return: connection goes back to idle, ready for reuse', {
      idle: '1', active: '0', waiting: '0', total: `1/${maxPoolSize}`, action: 'done, return',
    }),
    highlight: { active: ['pool', 'e-pool-idle'], found: ['idle'] },
    explanation: `When the application finishes, it returns the connection to the pool instead of closing the TCP socket. The pool resets session state and places the connection in the idle set. The next checkout takes the idle connection in microseconds instead of paying the handshake cost again.`,
    invariant: `Every checkout must have a matching return. A leaked checkout permanently reduces pool capacity below ${maxPoolSize}.`,
  };

  yield {
    state: poolGraph('Warm pool: multiple idle connections ready for instant checkout', {
      idle: '3', active: '2', waiting: '0', total: `5/${maxPoolSize}`, action: 'steady state',
    }),
    highlight: { found: ['idle', 'active'], active: ['pool'] },
    explanation: `Under steady traffic, the pool stabilizes at 5 of ${maxPoolSize} maximum connections — 3 idle and 2 active. Checkout is a pointer move from the idle list. The expensive handshake cost is amortized across thousands of queries.`,
  };

  yield {
    state: labelMatrix(
      'Health checks keep the idle set honest',
      [
        { id: 'borrow', label: 'test on borrow' },
        { id: 'return', label: 'test on return' },
        { id: 'idle', label: 'idle eviction' },
        { id: 'maxlife', label: 'max lifetime' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['ping or lightweight query before handing out', 'adds ~1ms per checkout; catches stale/broken connections'],
        ['validate state before returning to idle', 'catches connections left in bad transaction state'],
        ['close connections idle longer than threshold', 'reduces server-side resource waste; risks cold starts'],
        ['close after absolute age regardless of health', 'prevents DNS stale, credential rotation issues'],
      ],
    ),
    highlight: { active: ['borrow:check', 'maxlife:check'], found: ['idle:cost'] },
    explanation: `Idle connections can die silently. All ${healthChecks} health-check policies guard against this: the database may close them after a timeout, a firewall may drop the TCP session, or the server may restart. The tradeoff is checkout latency versus surprise errors.`,
  };
}

function* checkoutUnderLoad() {
  const maxSize = 10;
  const waiters = 3;
  const loadScenarios = 4;
  const leakSnapshots = 5;
  const checkoutTimeout = 3;

  yield {
    state: poolGraph('All connections active: the wait queue fills', {
      idle: '0', active: String(maxSize), waiting: `${waiters} callers`, total: `${maxSize}/${maxSize}`, action: 'checkout blocked',
    }),
    highlight: { compare: ['wait', 'e-pool-wait'], active: ['active'], removed: ['idle'] },
    explanation: `When all ${maxSize} connections are in use and the pool is at max size, new checkouts cannot open more. ${waiters} callers enter a wait queue, each holding a thread or async task while producing no useful work. This is the point where pool sizing starts to matter.`,
    invariant: `Wait queue depth is the leading indicator of pool exhaustion at max size ${maxSize}.`,
  };

  yield {
    state: labelMatrix(
      'Little\'s Law sizes the pool: L = lambda * W',
      [
        { id: 'low', label: 'normal load' },
        { id: 'med', label: 'peak hour' },
        { id: 'spike', label: 'query slow' },
        { id: 'bad', label: 'incident' },
      ],
      [
        { id: 'rate', label: 'req/s' },
        { id: 'hold', label: 'hold time' },
        { id: 'need', label: 'conns needed' },
        { id: 'pool', label: 'pool = 20' },
      ],
      [
        ['100', '5ms', '~1', 'fine'],
        ['500', '8ms', '~4', 'fine'],
        ['500', '80ms', '~40', 'wait queue grows'],
        ['500', '2s', '~1000', 'callers time out'],
      ],
    ),
    highlight: { active: ['spike:need', 'spike:pool'], removed: ['bad:need', 'bad:pool'] },
    explanation: `Little's Law predicts steady-state concurrency across ${loadScenarios} scenarios: arrival rate times hold time. A pool of 20 handles 500 req/s at 8ms easily. But if a slow query pushes hold time to 80ms, demand jumps to ~40 and half the callers wait. During an incident with 2s hold time, the pool is a drop in the bucket.`,
  };

  yield {
    state: poolGraph('Timeout protects callers from unbounded waits', {
      idle: '0', active: String(maxSize), waiting: '1 (timed out)', total: `${maxSize}/${maxSize}`, action: `checkout timeout: ${checkoutTimeout}s`,
    }),
    highlight: { removed: ['wait'], active: ['app'], compare: ['pool'] },
    explanation: `A checkout timeout of ${checkoutTimeout}s caps how long a caller will wait for one of ${maxSize} connections. Without it, a full pool under a slow query can make every upstream request hang for minutes. The timeout converts an invisible outage queue into an observable rejection.`,
  };

  yield {
    state: labelMatrix(
      'Connection leak: the pool that slowly dies',
      [
        { id: 't0', label: 'deploy' },
        { id: 't1', label: 'hour 1' },
        { id: 't2', label: 'hour 6' },
        { id: 't3', label: 'hour 12' },
        { id: 't4', label: 'page alert' },
      ],
      [
        { id: 'idle', label: 'idle' },
        { id: 'active', label: 'active' },
        { id: 'leaked', label: 'leaked' },
        { id: 'avail', label: 'effective capacity' },
      ],
      [
        ['10', '5', '0', '20'],
        ['8', '5', '2', '18'],
        ['3', '5', '7', '13'],
        ['0', '5', '10', '10'],
        ['0', '5', '15', '5 — timeouts start'],
      ],
    ),
    highlight: { active: ['t2:leaked', 't3:leaked'], removed: ['t4:avail'] },
    explanation: `A connection leak happens when code checks out but never returns. Across ${leakSnapshots} time snapshots, leaked connections accumulate from 0 to 15 while effective capacity drops from 20 to 5 until every checkout times out. The fix: ensure every checkout is paired with a return in a finally block, defer statement, or RAII scope.`,
    invariant: `Every checkout must have a matching return. Missing returns are silent capacity loss across all ${leakSnapshots} observed intervals.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pool lifecycle') yield* poolLifecycle();
  else if (view === 'checkout under load') yield* checkoutUnderLoad();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable at the top. The "pool lifecycle" view follows a single connection from the moment it is created through checkout, active use, return to idle, and eventual health checking. Each frame updates the idle and active counters on the pool node so you can watch capacity shift in real time. The final frame switches to a matrix showing the four health-check policies that keep idle connections honest.',
        {
          type: 'callout',
          text: 'A connection pool is both a latency cache and a concurrency limit for a scarce downstream resource.',
        },
        'The "checkout under load" view shows what happens when every connection is busy. It opens with a saturated pool where new callers enter a wait queue, then walks through Little\'s Law sizing across four traffic scenarios, demonstrates how checkout timeouts convert silent hangs into fast failures, and ends with a leak timeline showing how unreturned connections slowly kill the pool.',
        'Color coding is consistent across both views. Active (blue) markers highlight the component doing work right now. Found (green) markers show connections in a healthy, reusable state. Removed (red) markers flag connections or callers in trouble. At each frame, count idle, active, and waiting, then check whether idle + active still equals pool size. If it does not, something leaked.',
        {type: 'image', src: './assets/gifs/connection-pooling.gif', alt: 'Animated walkthrough of the connection pooling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every time your application talks to a database, it needs a connection -- a live TCP session with an authenticated, ready-to-query socket on the other end. Building that session is expensive. The TCP three-way handshake costs 1.5 round trips. If TLS is enabled (and in production it should be), the certificate exchange and key agreement add another 2 round trips. Then the database authenticates the client, allocates memory for session state, and initializes transaction bookkeeping. On a local-area network that whole sequence takes 1-3 milliseconds. Between cloud regions or across the public internet it takes 50-150 milliseconds.',
        'If every incoming web request opens a fresh connection, runs one query, and closes the connection, you pay that setup cost on every single request. At 200 requests per second you open and tear down 200 TCP sessions per second, burning CPU on both the application and the database, churning through ephemeral ports, and adding latency the user can feel on every page load.',
        'Connection pooling exists to pay the setup cost once and reuse the result thousands of times. The pool holds a set of already-open, already-authenticated connections. When the application needs to query the database, it borrows a connection from the pool. When it finishes, it returns the connection instead of closing it. The next caller gets a ready connection in microseconds instead of waiting milliseconds for a new handshake.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest design is open-per-request: every time the application needs the database, it opens a connection, runs its queries, and closes the connection. This is correct and easy to reason about. There is no shared state, no lifecycle management, and every connection is guaranteed fresh. It works fine at low traffic -- a few requests per second with fast queries.',
        'The next simplest design is a single shared connection: open one connection at startup and route every query through it. This avoids repeated handshakes entirely, but it serializes all work through one session. Under concurrency, every caller blocks behind whoever is currently using the connection. A single slow query starves every request behind it.',
        'Both designs work in a narrow band of traffic and break when load changes. Open-per-request breaks on latency and port exhaustion at high volume. The single shared connection breaks on throughput and head-of-line blocking under any concurrency at all. Neither adapts to the gap between "I need one connection" and "I need many but not unlimited."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is setup cost multiplied by request rate. At 500 requests per second with 3 milliseconds per connection setup, the application spends 1.5 seconds of aggregate time every second just on handshakes. Across the WAN at 100 milliseconds per setup, that becomes 50 seconds of aggregate wait per second of real time -- physically impossible to sustain without hundreds of parallel threads doing nothing but waiting on TCP.',
        'The second wall is ephemeral port exhaustion. When a TCP connection closes, the local port it used enters the TIME_WAIT state for 60-120 seconds before it can be reused. At 500 new connections per second, the application consumes 30,000-60,000 ports per minute. Linux defaults to roughly 28,000 ephemeral ports in the range 32768-60999. The operating system starts refusing new outbound connections before any application-level error triggers.',
        'The third wall is the database itself. PostgreSQL defaults to max_connections = 100. MySQL defaults to 151. Each connection on the server side costs memory for session state, sort buffers, temporary tables, and shared buffer pointers. If 50 application pods each open connections freely, the database runs out of slots and rejects everyone. Unlike the first two walls, this one is not local -- it is shared across every client that connects.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A connection pool separates the cost of establishing a connection from the act of using one. The application never opens or closes connections directly. Instead, a pool manager maintains a bounded set of open connections and lends them out on demand. The caller sees instant availability. The database sees a stable, predictable number of sessions.',
        'The central invariant is conservation: idle connections + active connections + connections currently being opened = current pool size, and that total never exceeds the configured maximum. Every checkout must have a matching return. A connection that is checked out and never returned permanently reduces the pool\'s effective capacity -- it breaks the invariant silently.',
        'The pool is just as much a concurrency limiter as it is a cache. By capping the number of open connections, it prevents the application from overwhelming the database. The wait queue makes excess demand visible: when it grows, the application knows it is at capacity before the database does, and can shed load or alert rather than crash the backend.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Checkout is a three-branch decision. The pool first checks whether an idle connection is available. If so, it moves that connection from the idle list to the active set and hands it to the caller -- this takes microseconds. If no idle connection exists but the pool has not reached its maximum size, it opens a new connection (paying the handshake cost), adds it to the active set, and returns it. If the pool is already at maximum size, the caller enters a FIFO wait queue with a configurable timeout.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TY1NCsIwEIX3OcVcoFdQ7J8IipBtyKKkIw3WGU0nlWK8uzS6cPV4P3zvMvLTDV0QOGq1M9WA7spRLBTFBsrXoR8RHBOhE8-0fatybdKCU4LKnHhG8OtGGDonfkb7WxBDRz0E5luC2pzvSH8gq6r80BgdCR4Rw2JV_Y1Uk7U1GiUGsqrNfm80TiiZul7aDw',
          alt: 'Connection pool checkout lifecycle from idle connection selection or opening a connection through query execution and return to idle.',
          caption: 'Checkout moves a connection from idle to active; return resets it and makes it available for reuse. Source: https://mermaid.ink/svg/pako:TY1NCsIwEIX3OcVcoFdQ7J8IipBtyKKkIw3WGU0nlWK8uzS6cPV4P3zvMvLTDV0QOGq1M9WA7spRLBTFBsrXoR8RHBOhE8-0fatybdKCU4LKnHhG8OtGGDonfkb7WxBDRz0E5luC2pzvSH8gq6r80BgdCR4Rw2JV_Y1Uk7U1GiUGsqrNfm80TiiZul7aDw',
        },
        'Return is the mirror operation. The pool validates the connection: is the TCP socket still alive, is there an uncommitted transaction, are session variables in an unexpected state? If the connection is healthy, the pool resets session state (timezone, search_path, character encoding), moves the connection from active to idle, and signals the first waiter if any are queued. If the connection is broken or dirty, the pool closes it and decrements the pool size. A returned connection may skip the idle list entirely and go straight to a waiting caller.',
        'Background maintenance runs on a periodic timer independent of checkout and return. It closes idle connections that have sat unused longer than an idle-timeout threshold, freeing server-side resources. It also enforces a max-lifetime policy that closes connections after an absolute age, regardless of health. Max-lifetime handles DNS changes (the database IP may have moved), credential rotation (the password may have expired), and server-side memory leaks. Some pools also run a periodic ping on every idle connection to detect silently dropped TCP sessions before the next checkout.',
        'A min-idle setting keeps the pool warm. Even during quiet periods, the pool proactively opens connections to maintain a floor count so that the first burst of traffic after a lull does not pay cold-start latency. The tradeoff is clear: wasted database slots during low traffic versus instant readiness when traffic returns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Connection reuse works because a TCP connection is stateless between transactions. Once a query completes and the transaction commits or rolls back, the connection is clean -- any caller can use it for any query. The pool resets per-session variables (SET NAMES, SET timezone, SET search_path) between uses so the next borrower gets a predictable environment, not leftover state from the previous caller.',
        'The bounded size works because it converts an unbounded resource-demand problem into a queuing problem with known capacity. Without a pool, 500 concurrent requests open 500 connections. With a pool capped at 20, those same 500 requests share 20 connections, and the wait queue absorbs the excess. If each query takes 5 milliseconds, each connection handles 200 queries per second, and 20 connections handle 4,000 per second -- far more than 500 requests per second requires.',
        'The amortization math is straightforward. A connection costs 3 milliseconds to open. A typical query takes 5 milliseconds. Opening per-request means 3 + 5 = 8 milliseconds per query, with 37.5% of wall time wasted on setup. A pooled connection reused 10,000 times amortizes the 3 millisecond setup cost to 0.0003 milliseconds per query -- effectively zero. The more reuse each connection gets, the less the setup cost matters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Checkout from idle is O(1) in code: acquire a lock (or CAS in lock-free implementations), pop from the idle list, mark active. The optional health-check ping adds roughly 1 millisecond of network round-trip. Return is also O(1): validate state, push to idle list or hand off to a waiter. Opening a new connection is O(1) in code complexity but costs 1-150 milliseconds of wall-clock time depending on network distance and whether TLS is required.',
        'Memory cost scales linearly with pool size. On the client side, each open connection holds a TCP socket with kernel send and receive buffers (typically 128-256 KB total), a protocol-level state machine, and any driver-level prepared-statement caches. On the database side, PostgreSQL allocates roughly 5-10 MB per connection for work_mem, sort buffers, temporary table space, and shared buffer pointers. A pool of 100 connections costs the database 500 MB-1 GB of RAM before a single query runs.',
        'The hidden cost is lock contention inside the pool itself. A naive implementation with a single mutex becomes a bottleneck above a few thousand checkouts per second. HikariCP on the JVM avoids this with a lock-free ConcurrentBag backed by ThreadLocal lists. PgBouncer sidesteps the problem entirely by running single-threaded with an event loop and per-client state machines. Go\'s database/sql uses a mutex-protected free list with condition-variable wake. Which implementation you choose determines whether the pool helps at high throughput or becomes the new bottleneck.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web application backends are the canonical use case. A Django, Rails, or Spring Boot server handles hundreds of short-lived HTTP requests per second, each needing one or two database queries. An in-process pool (Django\'s CONN_MAX_AGE, ActiveRecord\'s pool, HikariCP) gives every request a ready connection without the per-request handshake cost.',
        'External connection poolers like PgBouncer and ProxySQL sit between application pods and the database, aggregating connections across many processes. If 100 application pods each maintain an in-process pool of 10, the database sees 1,000 connections. PgBouncer in transaction mode can multiplex those 1,000 application-side connections onto 50 real database connections, because at any given moment most applications are doing computation, not actively running queries.',
        'Connection-limited databases benefit the most. PostgreSQL uses a process-per-connection model, so its performance degrades noticeably above a few hundred connections as the OS scheduler, shared buffer contention, and context switching overhead all grow. PgBouncer, Pgcat, Odyssey, Amazon RDS Proxy, Google Cloud SQL Auth Proxy, and Azure PgBouncer all exist primarily to shield PostgreSQL from connection storms in production environments.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pooling breaks when connections carry per-session state that cannot be safely reset between callers. PostgreSQL LISTEN/NOTIFY channels, session-level advisory locks, prepared statements with session lifetime, temporary tables, and SET commands that alter session behavior all bind a connection to one specific caller. Transaction-mode poolers like PgBouncer cannot multiplex these safely and must "pin" the connection to the caller for the duration, which defeats the entire multiplexing benefit.',
        'Pooling masks slow queries instead of surfacing them. A query that holds a connection for 30 seconds removes one slot from the pool for 30 seconds. If enough slow queries arrive at once, the pool drains, the wait queue fills, and checkout timeouts start firing. The pool did not cause the problem, but it hid the symptom until the cascade was already underway. Without observability on hold time, active count, and wait-queue depth, you will not see the slow query until everything is on fire.',
        'Over-pooling wastes database resources. When every microservice sets its max pool size to 50 "just in case" and 40 services connect, the database sees 2,000 connections, most sitting idle. Each idle connection still costs server RAM and an OS file descriptor. Right-sizing each pool to actual concurrency -- measured with Little\'s Law, not guessed -- avoids this waste.',
        'Connection leaks are the slow operational killer. Any code path that checks out a connection and fails to return it -- through an unhandled exception, an early return, a panic, or a timeout without cleanup -- permanently reduces the pool\'s effective capacity by one. The pool starves gradually over hours or days until checkout timeouts dominate every request. The only reliable fix is language-level resource management: try/finally in Python and Java, defer in Go, using in C#, or RAII destructors in C++ and Rust.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Django API server handles 300 requests per second. Each request runs 2-3 database queries averaging 4 milliseconds each, so a single request holds a connection for about 12 milliseconds total. Little\'s Law gives the steady-state concurrency: L = lambda * W = 300 requests/second * 0.012 seconds = 3.6 connections in use at any instant. A pool of 10 handles this comfortably, with roughly 6 connections sitting idle as buffer for bursts.',
        'At 3:00 AM, a batch analytics job starts. It runs heavy aggregation queries that each take 2 seconds, arriving at 20 queries per second. Steady-state demand for the batch job alone is 20 * 2 = 40 connections. The pool is capped at 10. All 10 connections are immediately consumed by batch queries (which hold each one for 2 full seconds), and the remaining 30 callers per second enter the wait queue. The checkout timeout is set to 5 seconds. API requests that arrive during this window either wait several seconds for a connection to free up or time out entirely. The API is effectively down.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:LcxLDsIgFIXhOas4G-gOfKQPqwto4oAwIHBNidCrFNTGuncjcXj-LzkXz08z6pgwNKKWdYzuoT2iTqRQVTs08sTeIrlASjQltbLlyeQYaTILLAU9WSXaYt27KxubLW7MHkG_9h_R_XBdaF5xkL2eE8xI5so5qb9NvKKXZ-0S7pkyKdGXw6McXCDOCRwxj2ThWVv1BQ',
          alt: 'Little Law sizing path from arrival rate and hold time to concurrency demand, pool capacity, wait queue, and timeout.',
          caption: 'Pool exhaustion is Little Law in motion: arrival rate times hold time becomes concurrency demand, and excess demand becomes waiting. Source: https://mermaid.ink/svg/pako:LcxLDsIgFIXhOas4G-gOfKQPqwto4oAwIHBNidCrFNTGuncjcXj-LzkXz08z6pgwNKKWdYzuoT2iTqRQVTs08sTeIrlASjQltbLlyeQYaTILLAU9WSXaYt27KxubLW7MHkG_9h_R_XBdaF5xkL2eE8xI5so5qb9NvKKXZ-0S7pkyKdGXw6McXCDOCRwxj2ThWVv1BQ',
        },
        'The fix is not to raise the pool size to 40. Pushing 40 heavy aggregation queries onto PostgreSQL simultaneously would saturate its CPU and make every query slower, including the API queries. Instead, the batch job gets its own dedicated pool of 5 connections routed through a separate PgBouncer instance, rate-limiting it to 5 concurrent queries at most. The API keeps its pool of 10, untouched by batch traffic. This is the bulkhead pattern: separate pools for separate workloads so one cannot drown the other. The batch job runs slower (5 concurrent queries instead of 40), but the API stays healthy, and the database is not crushed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The HikariCP wiki (https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) walks through pool sizing math, the relationship between connection count and CPU cores, and why smaller pools often outperform larger ones. The PgBouncer documentation (https://www.pgbouncer.org/config.html) defines the three pooling modes -- session, transaction, and statement -- and when each is appropriate. The Go standard library\'s database/sql source code is a clean, readable implementation of a connection pool with idle management, lifetime limits, and conditional wake. The PostgreSQL documentation on max_connections explains server-side per-connection memory costs.',
        'For related topics, study Semaphore Permit Counter for the bounded-counter primitive that pool checkout is built on. Study Bulkheads and Resource Isolation for the pattern of separating pools per workload. Study Circuit Breakers and Deadlines for strategies when the pool is exhausted and callers must fail fast. Study TCP Three-Way Handshake for the network-level cost that pooling amortizes. Study Load Shedding for what happens upstream when pools cannot absorb demand.',
      ],
    },
  ],
};
