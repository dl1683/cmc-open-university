// URL parsing and origin construction: the browser turns an input string plus
// base URL into structured fields used by fetch, routing, storage, and security.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'url-origin-parser-case-study',
  title: 'URL Parser & Origin Tuple',
  category: 'Systems',
  summary: 'How the WHATWG URL parser resolves bases, normalizes components, handles special schemes, computes origins, and feeds browser security checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['parse normalize', 'origin boundary'], defaultValue: 'parse normalize' },
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

function urlGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 4.4, note: notes.input ?? '../api?q=1' },
      { id: 'base', label: 'base', x: 2.3, y: 2.4, note: notes.base ?? 'https://ex/app/' },
      { id: 'parser', label: 'parse', x: 2.3, y: 5.8, note: notes.parser ?? 'state machine' },
      { id: 'scheme', label: 'scheme', x: 4.1, y: 3.0, note: notes.scheme ?? 'https' },
      { id: 'host', label: 'host', x: 5.7, y: 3.0, note: notes.host ?? 'example.com' },
      { id: 'path', label: 'path', x: 4.1, y: 6.0, note: notes.path ?? '/api' },
      { id: 'query', label: 'query', x: 5.7, y: 6.0, note: notes.query ?? 'q=1' },
      { id: 'origin', label: 'origin', x: 7.5, y: 4.4, note: notes.origin ?? 'tuple' },
      { id: 'policy', label: 'policy', x: 9.0, y: 4.4, note: notes.policy ?? 'same?' },
    ],
    edges: [
      { id: 'e-input-parser', from: 'input', to: 'parser', weight: '' },
      { id: 'e-base-parser', from: 'base', to: 'parser', weight: '' },
      { id: 'e-parser-scheme', from: 'parser', to: 'scheme', weight: '' },
      { id: 'e-parser-host', from: 'parser', to: 'host', weight: '' },
      { id: 'e-parser-path', from: 'parser', to: 'path', weight: '' },
      { id: 'e-parser-query', from: 'parser', to: 'query', weight: '' },
      { id: 'e-scheme-origin', from: 'scheme', to: 'origin', weight: '' },
      { id: 'e-host-origin', from: 'host', to: 'origin', weight: '' },
      { id: 'e-origin-policy', from: 'origin', to: 'policy', weight: '' },
    ],
  }, { title });
}

function* parseNormalize() {
  yield {
    state: urlGraph('A URL input is parsed relative to a base URL'),
    highlight: { active: ['input', 'base', 'parser', 'e-input-parser', 'e-base-parser'], compare: ['origin'] },
    explanation: 'In the browser, many URL strings are relative. The parser combines the input with a base URL before fetch, links, routing, service workers, or security policy can reason about it.',
    invariant: 'Never compare raw URL strings when the platform compares parsed URLs.',
  };

  yield {
    state: urlGraph('The parser splits structured components', { parser: 'states', scheme: 'https', host: 'ex.com', path: '/api/v1', query: 'q=1' }),
    highlight: { active: ['parser', 'scheme', 'host', 'path', 'query', 'e-parser-scheme', 'e-parser-host', 'e-parser-path', 'e-parser-query'] },
    explanation: 'A URL is structured state: scheme, username, password, host, port, path, query, and fragment. The parser normalizes some components while preserving others exactly enough for later serialization.',
  };

  yield {
    state: labelMatrix(
      'Normalization',
      [
        { id: 'host', label: 'host' },
        { id: 'port', label: 'port' },
        { id: 'path', label: 'path' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['lower/IDNA', 'spoofing'],
        ['drop default', 'dup keys'],
        ['dot segs', 'escape'],
        ['percent', 'semantics'],
      ],
    ),
    highlight: { active: ['host:rule', 'port:rule', 'path:rule'], compare: ['query:risk'] },
    explanation: 'Normalization is not cosmetic. Default ports, host casing, dot segments, percent encoding, and internationalized domain handling all affect cache keys, allowlists, and routing.',
  };

  yield {
    state: urlGraph('Serialization gives one platform answer', { input: 'HTTPS://EX.COM:443/a/../b', path: '/b', origin: 'https://ex.com', policy: 'canonical' }),
    highlight: { found: ['scheme', 'host', 'path', 'origin', 'policy'], active: ['parser'] },
    explanation: 'The URL API gives a canonical serialized form. That is why allowlists and routers should parse first, then compare structured fields or serialized URLs produced by the platform.',
  };

  yield {
    state: urlGraph('The complete case is a redirect allowlist', { input: '/account', base: 'https://shop/', origin: 'https://shop', policy: 'allow' }),
    highlight: { active: ['input', 'base', 'parser', 'origin', 'policy'], found: ['path'] },
    explanation: 'A login page accepts next=/account. It parses next against the site base, verifies the resulting origin is the site origin, then redirects. Raw string checks are where open redirects and host confusion bugs start.',
  };
}

function* originBoundary() {
  yield {
    state: urlGraph('Origin is the browser security tuple', { scheme: 'https', host: 'app.example', origin: 'https+host+443', policy: 'storage/CORS' }),
    highlight: { active: ['scheme', 'host', 'origin', 'policy', 'e-scheme-origin', 'e-host-origin', 'e-origin-policy'], compare: ['path', 'query'] },
    explanation: 'For ordinary network schemes, origin is scheme, host, and port. Path and query can route application data, but they do not make two pages separate origins.',
    invariant: 'Same host over http and https are different origins.',
  };

  yield {
    state: labelMatrix(
      'Origin examples',
      [
        { id: 'https', label: 'https' },
        { id: 'http', label: 'http' },
        { id: 'port', label: 'port' },
        { id: 'opaque', label: 'opaque' },
      ],
      [
        { id: 'tuple', label: 'tuple' },
        { id: 'same', label: 'same?' },
      ],
      [
        ['https,h,443', 'base'],
        ['http,host,80', 'no'],
        ['https,h,8443', 'no'],
        ['unique', 'no'],
      ],
    ),
    highlight: { active: ['https:tuple'], compare: ['http:same', 'port:same', 'opaque:same'] },
    explanation: 'The tuple explains CORS, cookie scope boundaries, storage partitioning, service worker scope, and many security checks. Some URLs have opaque origins instead of a normal tuple.',
  };

  yield {
    state: urlGraph('CORS compares request origin to response policy', { input: 'fetch', origin: 'app origin', policy: 'ACAO?' }),
    highlight: { active: ['origin', 'policy', 'e-origin-policy'], compare: ['host'] },
    explanation: 'When JavaScript fetches across origins, the browser sends and checks origin policy. The URL parser created the tuple that CORS later compares.',
  };

  yield {
    state: urlGraph('Cookies and storage use related but not identical scopes', { host: 'example.com', path: '/app', origin: 'site/origin', policy: 'cookie store' }),
    highlight: { active: ['host', 'path', 'origin', 'policy'], found: ['scheme'] },
    explanation: 'Cookie Domain and Path matching are not the same as origin. That difference is why SameSite, Storage Access, and CORS need separate mental models.',
  };

  yield {
    state: labelMatrix(
      'Do not compare',
      [
        { id: 'raw', label: 'raw str' },
        { id: 'regex', label: 'regex' },
        { id: 'host', label: 'host only' },
        { id: 'url', label: 'URL obj' },
      ],
      [
        { id: 'safe', label: 'safe' },
        { id: 'miss', label: 'misses' },
      ],
      [
        ['no', 'encoding'],
        ['risky', 'parser gaps'],
        ['partial', 'scheme/port'],
        ['yes', 'policy bugs'],
      ],
    ),
    highlight: { found: ['url:safe'], removed: ['raw:safe'], compare: ['host:miss'] },
    explanation: 'The rule of thumb is simple: parse with the platform, compare structured fields, and then enforce policy. Do not build a URL security parser with regexes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'parse normalize') yield* parseNormalize();
  else if (view === 'origin boundary') yield* originBoundary();
  else throw new InputError('Pick a URL parser view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for URL Parser & Origin Tuple. How the WHATWG URL parser resolves bases, normalizes components, handles special schemes, computes origins, and feeds browser security checks..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type:"callout", text:"URL safety starts when validation and browser behavior share the same parsed structure instead of competing string interpretations."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `URLs look like strings, but browsers do not treat them as plain text. Before fetch, navigation, routing, storage, cookies, caches, service workers, and security policies can reason about a destination, the browser parses an input against a base URL and turns it into structured fields.`,
        `This topic exists because many security bugs are interpretation bugs. Application code validates one spelling while the browser executes another parsed meaning. When those interpretations disagree, redirect allowlists, CORS checks, cache keys, service worker scopes, and storage boundaries can all become wrong.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is string work. Developers write prefix checks for redirects, regular expressions for host checks, split on slash for paths, and search substrings for query parameters. It is quick to write and often passes simple examples.`,
        `That approach is tempting because many URLs are visually simple. The common case looks like scheme, host, path, and query. If every input were absolute, lowercase, unescaped, and already normalized, string checks might be tolerable for low-risk routing.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The wall is that a URL is structured state. Relative input needs a base. Hosts normalize differently from paths. Default ports can disappear. Percent encoding behaves differently by component. Backslashes, credentials, special schemes, fragments, and internationalized domain names can all change what the browser sees.`,
        `A hand-written regular expression often becomes a second parser. The bug appears when that second parser disagrees with the platform parser. In security-sensitive code, the platform parser wins because it is the parser used by navigation, fetch, storage, and policy machinery.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The invariant is parse first, then compare the structured field that matches the policy. If the policy is same origin, compare origin. If the policy is same host, compare host after parsing. If the policy is an application route, compare pathname only after the origin or host boundary is already approved.`,
        `A URL object is not a policy by itself. It is a shared interpretation. It records scheme, credentials, host, port, path, query, fragment, special-scheme behavior, and serialization rules. Correctness comes from using that shared interpretation before enforcing product rules.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The parser takes an input string and, when needed, a base URL. It resolves relative paths, identifies the scheme, parses authority fields, normalizes the host, handles default ports, processes dot segments, treats fragments separately, and exposes a canonical serialization.`,
        `Origin computation is a second step over the parsed result. For ordinary http and https URLs, origin is scheme plus host plus port. Path and query can route application behavior, but they do not create separate origins. That single fact explains many browser security decisions.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `The WHATWG URL algorithm is a state machine because the meaning of a character depends on where the parser is. A colon can end a scheme. A question mark can begin a query. A hash starts a fragment. A percent escape in a path is not the same decision as a percent escape inside query data.`,
        `Special schemes such as http, https, ws, wss, ftp, and file have extra rules. Non-network schemes, data URLs, sandboxed documents, and some generated documents can produce opaque origins instead of normal tuples. That is why visible string prefixes are not enough for origin reasoning.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `This works because later browser decisions consume the parsed representation. If application code compares the same fields the browser uses, validation and execution share one interpretation. The validation code stops guessing how the browser will read the destination.`,
        `The proof obligation is choosing the right boundary. A same-origin check answers a different question from same-site, cookie Domain matching, service worker scope, cache partitioning, CORS policy, or an application path allowlist. Parsing solves interpretation, not authorization.`,
      ],
    },
    {
      heading: 'Origin, site, and scope',
      paragraphs: [
        `Origin is the tuple scheme, host, and port for ordinary network schemes. Same host over http and https is not same origin. Same scheme and host on a different explicit port is not same origin. Path and query do not split origins.`,
        `Site, cookie scope, and service worker scope are nearby but different ideas. SameSite cookie checks reason about registrable domains and scheme. Cookie Domain and Path matching decide where cookies are sent. A service worker has a script URL and a scope path. CORS compares request origin to response policy. Do not collapse these into one mental model.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A login endpoint accepts a next parameter. The safe implementation constructs new URL(next, siteBase), checks that the parsed origin equals the site origin, then checks that the parsed pathname is one of the allowed in-product destinations. Only after both checks does it redirect.`,
        `The unsafe implementation asks whether the raw value starts with slash or contains the expected host text. That misses cases created by base resolution, scheme-relative input, default ports, encoded separators, credentials, host confusion, and parser differences around backslashes. The bug is not slow code. The bug is comparing before parsing.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The runtime cost of using the URL API is usually irrelevant next to the cost of a boundary bug. The real cost is design discipline. The team must say whether a rule is about origin, site, host, serialized URL, pathname after origin approval, query keys, or a product-level authorization decision.`,
        `Normalization is not cosmetic. Host casing, IDNA, default ports, dot segments, path separators, percent encoding, and fragments affect equality, routing, logging, and cache identity. A canonical serialized URL is useful, but only after the code has chosen the correct policy boundary.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Use new URL(input, base) for user-supplied navigation targets. Reject unexpected schemes before performing a side effect. Compare URL.origin for same-origin checks. Compare hostname only when host identity is the actual policy. Compare pathname only after origin or host has already been approved.`,
        `Keep parsing and authorization separate in code. A helper named parseRedirectTarget should not silently decide whether a user may access a destination. A helper named isAllowedRedirect should parse, compare the origin, compare the route allowlist, and return an explicit decision with enough logging to debug rejected input.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Use platform URL parsing for redirect allowlists, webhook callback validation, link rewriting, router matching, service worker registration checks, CORS reasoning, cache-key construction, CSP reviews, Fetch Metadata checks, and any user-supplied navigation target.`,
        `The lesson also applies outside browser code. Proxies, API gateways, crawlers, test runners, security scanners, and link preview systems need to compare the same structured destination that the downstream runtime will use. If the upstream parser and downstream parser disagree, policy can be bypassed.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `A URL object does not decide product policy. It can tell you the parsed origin and path; it cannot know whether an admin export route is a valid post-login redirect for this user. Authorization must still happen at the application layer.`,
        `URL parsing also cannot erase differences between browser concepts. Origin, site, cookie Domain and Path, storage partition key, service worker scope, CORS policy, CSP, and user authorization are related checks with different inputs. Many bugs come from using one boundary where another was required.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources are the WHATWG URL Standard and the MDN URL API documentation. For browser security boundaries, study CORS Preflight Cache, SameSite Cookies and CSRF, Storage Access API, Service Workers, Browser Cache Partitioning, Content Security Policy, Fetch Metadata, History API Session Stack, and Resource Hints.`,
        `For parser discipline, study UTF-8 Decoder DFA, CSV Parser State Machine, Pratt Parser, Finite State Machine, and Trusted Types DOM XSS Sink Case Study. They all teach the same systems lesson: parse once with the correct grammar, keep structured state, and enforce policy on that structure.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
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
        'Use this topic as a checkpoint: if you can explain why URL Parser & Origin Tuple moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

