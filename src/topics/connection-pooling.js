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
  yield {
    state: poolGraph('Cold start: pool is empty, first request opens a connection', {
      idle: '0', active: '0', waiting: '0', total: '0/10', action: 'first request',
    }),
    highlight: { active: ['app', 'e-app-pool'], compare: ['pool'] },
    explanation: 'The pool starts empty. The first checkout finds no idle connection, so it opens a fresh TCP socket to the database, completes the handshake (TCP three-way + optional TLS), authenticates, and returns the ready connection. That startup cost is paid once per physical connection.',
    invariant: 'idle + active + opening <= max pool size.',
  };

  yield {
    state: poolGraph('Connection in use: the pool tracks ownership', {
      idle: '0', active: '1', waiting: '0', total: '1/10', action: 'using conn',
    }),
    highlight: { active: ['active', 'e-active-db'], found: ['db'] },
    explanation: 'The application holds the connection while it runs queries. The pool marks it active. No other caller can use this connection until the holder returns it. The database sees one authenticated session occupying one of its max_connections slots.',
  };

  yield {
    state: poolGraph('Return: connection goes back to idle, ready for reuse', {
      idle: '1', active: '0', waiting: '0', total: '1/10', action: 'done, return',
    }),
    highlight: { active: ['pool', 'e-pool-idle'], found: ['idle'] },
    explanation: 'When the application finishes, it returns the connection to the pool instead of closing the TCP socket. The pool resets session state if needed and places the connection in the idle set. The next checkout takes the idle connection in microseconds instead of paying the handshake cost again.',
    invariant: 'Every checkout must have a matching return. A leaked checkout permanently reduces pool capacity.',
  };

  yield {
    state: poolGraph('Warm pool: multiple idle connections ready for instant checkout', {
      idle: '3', active: '2', waiting: '0', total: '5/10', action: 'steady state',
    }),
    highlight: { found: ['idle', 'active'], active: ['pool'] },
    explanation: 'Under steady traffic, the pool stabilizes with some connections active and some idle. Checkout is a pointer move from the idle list. The expensive handshake cost is amortized across thousands of queries. This is the normal operating state of a healthy pool.',
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
    explanation: 'Idle connections can die silently. The database may close them after a timeout. A firewall may drop the TCP session. The server may restart. Health checks detect dead connections before handing them to callers. The tradeoff is checkout latency versus surprise errors.',
  };
}

function* checkoutUnderLoad() {
  yield {
    state: poolGraph('All connections active: the wait queue fills', {
      idle: '0', active: '10', waiting: '3 callers', total: '10/10', action: 'checkout blocked',
    }),
    highlight: { compare: ['wait', 'e-pool-wait'], active: ['active'], removed: ['idle'] },
    explanation: 'When every connection is in use and the pool is at max size, new checkouts cannot open more connections. Callers enter a wait queue. Each waiting caller holds a thread, goroutine, or async task while producing no useful work. This is the point where pool sizing starts to matter.',
    invariant: 'Wait queue depth is the leading indicator of pool exhaustion.',
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
    explanation: 'Little\'s Law predicts steady-state concurrency: arrival rate times hold time. A pool of 20 handles 500 req/s at 8ms hold time easily. But if a slow query pushes hold time to 80ms, steady-state demand jumps to 40 and half the callers wait. During an incident with 2s hold time, the pool is a drop in the bucket and the wait queue explodes.',
  };

  yield {
    state: poolGraph('Timeout protects callers from unbounded waits', {
      idle: '0', active: '10', waiting: '1 (timed out)', total: '10/10', action: 'checkout timeout: 3s',
    }),
    highlight: { removed: ['wait'], active: ['app'], compare: ['pool'] },
    explanation: 'A checkout timeout caps how long a caller will wait for a connection. Without it, a full pool under a slow query can make every upstream request hang for minutes. With a 3-second timeout, callers get a fast error they can handle: retry, degrade, or fail to the user. The timeout converts an invisible outage queue into an observable rejection.',
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
    explanation: 'A connection leak happens when code checks out a connection but never returns it. The pool cannot reclaim it. Over hours, leaked connections accumulate, effective capacity drops, and eventually every checkout times out. The fix is always the same: ensure every checkout is paired with a return in a finally block, defer statement, or RAII scope.',
    invariant: 'Every checkout must have a matching return. Missing returns are silent capacity loss.',
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
        'The pool lifecycle view traces one connection from creation through checkout, use, and return. Watch the idle and active counts change as the application borrows and returns connections. The health-check matrix shows the four maintenance policies that keep the idle set honest.',
        {
          type: 'callout',
          text: 'A connection pool is both a latency cache and a concurrency limit for a scarce downstream resource.',
        },
        'The checkout-under-load view shows what happens when demand exceeds pool capacity. The wait queue fills, Little\'s Law sizes the gap, checkout timeouts convert silent hangs into fast errors, and connection leaks show the slow death of a pool that never gets its connections back.',
        'Active markers are the current operation. Found markers are connections in a healthy state. Removed markers are connections or callers in trouble. At each frame, track how many connections are idle, active, and waiting, and ask whether the pool invariant still holds.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A TCP connection to a database is expensive to establish. The three-way handshake costs ~1.5 round trips. TLS adds ~2 more round trips for the certificate exchange and key agreement. The database then authenticates the client, allocates session memory, and sets up transaction bookkeeping. On a LAN that totals 1-3ms. Across the public internet or between cloud regions it is 50-150ms.',
        'A web request that opens a connection, runs a single query, and closes the connection pays that setup cost on every request. At 200 requests per second, the application opens and closes 200 TCP sessions per second. Each one burns CPU on both sides, churns through ephemeral ports, and adds latency the user can feel.',
        'Connection pooling exists to pay the setup cost once and reuse the result. The pool holds a set of open, authenticated connections. When the application needs one, it borrows from the pool. When it is done, it returns the connection instead of closing it. The next borrower gets a ready connection in microseconds instead of milliseconds.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is to open a connection when needed and close it when done. This is correct and simple. It works well at low traffic: a handful of requests per second with fast queries. The application code is straightforward, there is no shared state, and every connection is guaranteed fresh.',
        'The second reasonable approach is to open one connection at startup and share it across all requests. This avoids repeated handshakes, but serializes every query through one session. Under concurrency, callers block waiting for the single connection, and a long query starves everyone behind it.',
        'Both approaches work in a narrow regime and fail when load or concurrency changes. The open-per-request model fails on latency and port exhaustion. The single-connection model fails on throughput and head-of-line blocking.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is setup cost multiplied by concurrency. At 500 requests per second with a 3ms connection setup, the application spends 1.5 seconds of aggregate CPU time per second just on handshakes. Across the WAN at 100ms per setup, that is 50 seconds of aggregate wait per second of real time, which is impossible to serve without massive parallelism.',
        'Ephemeral port exhaustion is the second wall. Each closed TCP connection enters TIME_WAIT for 60-120 seconds, occupying a local port. At 500 connections per second, the application burns through 30,000-60,000 ports per minute. Linux defaults to ~28,000 ephemeral ports. The operating system starts refusing new connections before the application logic fails.',
        'The database has its own wall: max_connections. PostgreSQL defaults to 100. MySQL defaults to 151. Each connection consumes server memory for session state, sort buffers, and transaction tracking. If 50 application instances each open connections freely, the database runs out of slots and starts refusing everyone.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A connection pool separates the cost of establishing a connection from the act of using one. The pool manages a bounded set of open connections and lends them to callers on demand. The caller sees instant availability; the database sees a stable, bounded number of sessions.',
        'The central invariant is conservation: idle connections + active connections + connections being opened equals the current pool size, and that total never exceeds the configured maximum. A leaked connection that is never returned breaks this invariant by permanently removing capacity.',
        'The pool is a concurrency limiter as much as a cache. By capping the number of open connections, it prevents the application from overwhelming the database with sessions. The wait queue makes demand visible: when it grows, the system knows it is at capacity before the database does.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On checkout, the pool checks for an idle connection. If one exists, it moves from idle to active and is returned to the caller. If no idle connection exists and the pool has not reached max size, a new connection is opened and returned. If the pool is at max size, the caller enters a wait queue with a configurable timeout.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TY1NCsIwEIX3OcVcoFdQ7J8IipBtyKKkIw3WGU0nlWK8uzS6cPV4P3zvMvLTDV0QOGq1M9WA7spRLBTFBsrXoR8RHBOhE8-0fatybdKCU4LKnHhG8OtGGDonfkb7WxBDRz0E5luC2pzvSH8gq6r80BgdCR4Rw2JV_Y1Uk7U1GiUGsqrNfm80TiiZul7aDw',
          alt: 'Connection pool checkout lifecycle from idle connection selection or opening a connection through query execution and return to idle.',
          caption: 'Checkout moves a connection from idle to active; return resets it and makes it available for reuse. Source: https://mermaid.ink/svg/pako:TY1NCsIwEIX3OcVcoFdQ7J8IipBtyKKkIw3WGU0nlWK8uzS6cPV4P3zvMvLTDV0QOGq1M9WA7spRLBTFBsrXoR8RHBOhE8-0fatybdKCU4LKnHhG8OtGGDonfkb7WxBDRz0E5luC2pzvSH8gq6r80BgdCR4Rw2JV_Y1Uk7U1GiUGsqrNfm80TiiZul7aDw',
        },
        'On return, the pool validates the connection. If it is healthy, it moves from active to idle and becomes available. If it is broken or left in a dirty transaction state, it is closed and the pool size decreases. If waiters are queued, a returned connection may be handed directly to the first waiter instead of entering the idle set.',
        'Background maintenance runs on a timer. Idle connections older than a threshold are closed to free server resources. Connections older than a max lifetime are closed regardless of health, which handles DNS changes, credential rotation, and server-side memory leaks. Some pools also run periodic health checks on idle connections to detect silent TCP deaths before checkout.',
        'Min-idle settings keep a warm baseline. The pool opens connections proactively to maintain a floor, so cold-start latency does not spike after quiet periods. The tradeoff is wasted server slots during low traffic versus instant availability when traffic returns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Connection reuse works because TCP connections are stateless between transactions. After a query completes and the transaction ends, the connection is in a clean state that any caller can use. The pool resets session variables if needed (SET NAMES, timezone, search_path) to ensure the next caller gets a predictable environment.',
        'The bounded size works because it converts an unbounded demand problem into a queuing problem. Without a pool, 500 concurrent requests mean 500 connections. With a pool of 20, the same 500 requests share 20 connections, and the wait queue absorbs the difference. If queries complete in 5ms, each connection serves 200 queries per second, and 20 connections serve 4,000 per second.',
        'The amortization argument is simple. If a connection costs 3ms to open and a query takes 5ms, opening per request doubles latency. A pooled connection used 10,000 times amortizes the 3ms setup to 0.3 microseconds per query. The more reuse, the less the setup cost matters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Checkout from an idle connection is O(1): a lock acquisition, a list removal, and an optional health check. The health check adds ~1ms for a ping or lightweight query. Return is O(1): state validation and list insertion. Connection opening is O(1) in code but takes 1-150ms in wall time depending on network distance and TLS.',
        'Memory cost is proportional to pool size. Each open connection holds a TCP socket (kernel buffers, typically 128KB-256KB), a protocol state machine, and any driver-level caches. On the database side, PostgreSQL allocates roughly 5-10MB per connection for work_mem, sort buffers, and shared buffer pointers.',
        'The hidden cost is pool contention. A single pool lock under high concurrency becomes a bottleneck. HikariCP (JVM) solves this with a lock-free ConcurrentBag. PgBouncer uses per-client state machines in an event loop. Go\'s database/sql uses a mutex-protected free list with conditional wake. The implementation determines whether the pool helps or becomes the new bottleneck at high throughput.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Connection pooling wins wherever the setup cost is high relative to query time and request volume is steady or bursty. Web applications, API servers, background job workers, and microservices all benefit because they make many short queries to the same database.',
        'External poolers like PgBouncer and ProxySQL win in multi-tenant and microservice architectures. If 100 application pods each want a pool of 10, the database needs 1,000 connections. PgBouncer in transaction mode can multiplex those 1,000 application-side connections onto 50 real database connections, because most of the time the application is not actively querying.',
        'Connection pooling also wins for connection-limited databases. PostgreSQL performance degrades above a few hundred connections because of its process-per-connection model. PgBouncer, Pgcat, and Odyssey exist primarily to shield PostgreSQL from connection storms. Amazon RDS Proxy, Google Cloud SQL Auth Proxy, and Azure PgBouncer serve the same purpose in managed environments.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pooling fails when connections carry per-session state that cannot be reset between callers. PostgreSQL LISTEN/NOTIFY, session-level advisory locks, prepared statements with session lifetime, and SET commands that change session behavior all bind a connection to a specific caller. Transaction-mode poolers like PgBouncer cannot multiplex these safely and must pin the connection, which defeats the pooling benefit.',
        'Pooling hides slow queries. A query that holds a connection for 30 seconds removes one slot from the pool for 30 seconds. If enough slow queries arrive concurrently, the pool drains and the wait queue grows. The pool did not cause the problem, but it masks the symptom until the wait queue fills and checkout timeouts fire. Observability on hold time, active count, and wait count is essential.',
        'Over-pooling wastes database resources. If every microservice sets max pool size to 50 "just in case," and 40 services connect, the database sees 2,000 connections, most of them idle. Each idle connection still costs server memory and OS file descriptors. Right-sizing the pool to actual concurrency, measured with Little\'s Law, avoids this waste.',
        'Connection leaks are the operational killer. Any code path that checks out a connection and fails to return it, whether through an exception, early return, panic, or timeout without cleanup, permanently reduces effective pool capacity. The pool slowly starves until checkout timeouts dominate. The fix is always language-level resource management: try/finally, defer, using, or RAII.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Django API server handles 300 requests per second. Each request runs 2-3 queries averaging 4ms each, holding a connection for about 12ms total. By Little\'s Law, steady-state concurrency is 300 * 0.012 = 3.6 connections. A pool of 10 handles this easily with 6 idle connections as buffer.',
        'At 3:00 AM, a batch job starts running analytics queries that take 2 seconds each at 20 per second. Steady-state demand jumps to 20 * 2 = 40 connections. The pool maxes out at 10, and 30 callers enter the wait queue. Checkout timeout is set to 5 seconds. The first callers wait and eventually get connections as fast queries finish, but the batch job dominates hold time. API requests start timing out.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:LcxLDsIgFIXhOas4G-gOfKQPqwto4oAwIHBNidCrFNTGuncjcXj-LzkXz08z6pgwNKKWdYzuoT2iTqRQVTs08sTeIrlASjQltbLlyeQYaTILLAU9WSXaYt27KxubLW7MHkG_9h_R_XBdaF5xkL2eE8xI5so5qb9NvKKXZ-0S7pkyKdGXw6McXCDOCRwxj2ThWVv1BQ',
          alt: 'Little Law sizing path from arrival rate and hold time to concurrency demand, pool capacity, wait queue, and timeout.',
          caption: 'Pool exhaustion is Little Law in motion: arrival rate times hold time becomes concurrency demand, and excess demand becomes waiting. Source: https://mermaid.ink/svg/pako:LcxLDsIgFIXhOas4G-gOfKQPqwto4oAwIHBNidCrFNTGuncjcXj-LzkXz08z6pgwNKKWdYzuoT2iTqRQVTs08sTeIrlASjQltbLlyeQYaTILLAU9WSXaYt27KxubLW7MHkG_9h_R_XBdaF5xkL2eE8xI5so5qb9NvKKXZ-0S7pkyKdGXw6McXCDOCRwxj2ThWVv1BQ',
        },
        'The fix is not to increase pool size. Increasing to 40 would push 40 long queries onto the database simultaneously, exhausting PostgreSQL\'s CPU. Instead, the batch job gets its own pool of 5 connections with a separate PgBouncer instance, rate-limited to 5 concurrent queries. The API pool of 10 stays healthy, and the batch job runs at a sustainable pace. Pool separation is the bulkhead: one workload cannot drown the other.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'HikariCP wiki (https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) covers pool sizing math and the relationship between connections, CPU cores, and disk. PgBouncer docs (https://www.pgbouncer.org/config.html) define session, transaction, and statement pooling modes. Go database/sql source shows a clean pool implementation with idle management and lifetime limits. The PostgreSQL documentation on max_connections explains server-side costs.',
        'Study Semaphore Permit Counter for the bounded-counter pattern that pool checkout uses. Study Bulkheads & Resource Isolation for per-dependency pool separation. Study Circuit Breakers & Deadlines for what to do when the pool is exhausted. Study TCP Three-Way Handshake for the setup cost that pooling amortizes. Study Load Shedding for what happens upstream when pools cannot keep up.',
      ],
    },
  ],
};
