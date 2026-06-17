// Content Security Policy: nonce and hash based script authorization as a
// browser-side allow graph for code execution.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-security-policy-nonce-hash-case-study',
  title: 'CSP Nonce & Hash Policy',
  category: 'Security',
  summary: 'How strict Content Security Policy uses nonces, hashes, script-src, strict-dynamic, reports, and rollout modes to reduce XSS execution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['nonce flow', 'hash policy'], defaultValue: 'nonce flow' },
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

function cspGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'server', label: 'server', x: 0.8, y: 4.8, note: notes.server ?? 'renders HTML' },
      { id: 'header', label: 'policy', x: 2.5, y: 6.0, note: notes.header ?? 'script-src' },
      { id: 'parser', label: 'parser', x: 4.2, y: 4.8, note: notes.parser ?? 'checks script' },
      { id: 'good', label: 'script', x: 6.0, y: 6.0, note: notes.good ?? 'trusted' },
      { id: 'bad', label: 'inject', x: 6.0, y: 3.6, note: notes.bad ?? 'attacker' },
      { id: 'exec', label: 'exec', x: 8.0, y: 5.8, note: notes.exec ?? 'allowed' },
      { id: 'report', label: 'report', x: 8.0, y: 3.6, note: notes.report ?? 'violation' },
    ],
    edges: [
      { id: 'e-server-header', from: 'server', to: 'header', weight: '' },
      { id: 'e-server-parser', from: 'server', to: 'parser', weight: '' },
      { id: 'e-header-parser', from: 'header', to: 'parser', weight: '' },
      { id: 'e-parser-good', from: 'parser', to: 'good', weight: '' },
      { id: 'e-parser-bad', from: 'parser', to: 'bad', weight: '' },
      { id: 'e-good-exec', from: 'good', to: 'exec', weight: '' },
      { id: 'e-bad-report', from: 'bad', to: 'report', weight: '' },
    ],
  }, { title });
}

function* nonceFlow() {
  yield {
    state: cspGraph('The server emits a fresh nonce and policy', { header: "nonce 'r7'", good: "nonce='r7'", bad: 'no nonce' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], compare: ['bad'] },
    explanation: 'A nonce policy starts on the server. For each response, the server generates a fresh unpredictable nonce, puts it in the Content-Security-Policy header, and attaches it to trusted script elements.',
    invariant: 'A nonce is per response, not a global password.',
  };

  yield {
    state: cspGraph('The parser authorizes the matching script', { header: "nonce 'r7'", parser: 'match', good: 'nonce ok', exec: 'runs' }),
    highlight: { found: ['header', 'parser', 'good', 'exec', 'e-header-parser', 'e-parser-good', 'e-good-exec'] },
    explanation: 'When the browser reaches a script, it checks the policy. If the script carries the exact nonce from the response header, it is allowed to execute.',
  };

  yield {
    state: cspGraph('Injected inline code lacks the nonce and is blocked', { bad: 'onclick=...', report: 'blocked' }),
    highlight: { removed: ['bad', 'e-parser-bad'], active: ['report', 'e-bad-report'], found: ['good'] },
    explanation: 'An attacker who can inject markup does not automatically get execution. Inline handlers, script tags without the nonce, and disallowed sources are blocked and can generate violation reports.',
  };

  yield {
    state: cspGraph('strict-dynamic transfers trust from a nonce script', { good: 'loader', exec: 'loads app', header: 'strict dyn', bad: 'host list' }),
    highlight: { active: ['good', 'exec', 'e-good-exec'], compare: ['bad'], found: ['header'] },
    explanation: 'strict-dynamic lets a nonce- or hash-authorized loader create additional scripts without listing every host. That supports modern bundlers, but it makes the trusted loader a more important security boundary.',
  };

  yield {
    state: labelMatrix(
      'Rollout modes',
      [
        { id: 'report', label: 'report' },
        { id: 'enforce', label: 'enforce' },
        { id: 'legacy', label: 'legacy' },
        { id: 'clean', label: 'clean' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['observe', 'find breaks'],
        ['block', 'reduce XSS'],
        ['allowlist', 'migrate'],
        ['strict', 'least code'],
      ],
    ),
    highlight: { active: ['report:mode'], found: ['enforce:goal', 'clean:mode'], compare: ['legacy:mode'] },
    explanation: 'A safe rollout often starts in Report-Only, fixes real violations, then enforces. The end state is strict enough to block injected execution without breaking intentional scripts.',
  };
}

function* hashPolicy() {
  yield {
    state: cspGraph('A hash policy approves exact script bytes', { server: 'build', header: 'sha256...', good: 'same bytes', parser: 'hash' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], found: ['parser'] },
    explanation: 'A hash policy records a cryptographic hash of an inline script. At parse time, the browser hashes the script content and compares it with the allowed hash in script-src.',
    invariant: 'Hashes authorize exact bytes; nonces authorize selected elements for this response.',
  };

  yield {
    state: cspGraph('Exact bytes match, so execution is allowed', { parser: 'hash match', exec: 'runs', report: 'quiet' }),
    highlight: { found: ['parser', 'good', 'exec', 'e-parser-good', 'e-good-exec'] },
    explanation: 'Hashes fit static inline bootstraps that do not change per response. If the content is exactly the approved content, the script runs without a per-request nonce.',
  };

  yield {
    state: cspGraph('A tiny script change breaks the hash', { good: 'changed', parser: 'hash miss', report: 'blocked' }),
    highlight: { removed: ['good', 'e-good-exec'], active: ['report', 'e-bad-report'], compare: ['header'] },
    explanation: 'The hash is intentionally brittle. A whitespace, build, or injection change means the bytes no longer match, so the browser blocks execution unless the policy is updated.',
  };

  yield {
    state: labelMatrix(
      'Policy choices',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'hash', label: 'hash' },
        { id: 'host', label: 'host' },
        { id: 'unsafe', label: 'unsafe' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dynamic', 'leak value'],
        ['static', 'brittle'],
        ['external', 'JSONP/CDN'],
        ['legacy', 'XSS runs'],
      ],
    ),
    highlight: { found: ['nonce:fit', 'hash:fit'], compare: ['host:risk'], removed: ['unsafe:risk'] },
    explanation: 'Nonce and hash policies are preferred for strict CSP because they authorize intended code rather than broad locations. Host allowlists are easier to bypass when a trusted host can serve attacker-controlled script.',
  };

  yield {
    state: cspGraph('A complete migration removes inline execution sinks', { server: 'templates', header: 'strict CSP', good: 'boot hash', bad: 'handler', report: 'telemetry' }),
    highlight: { found: ['header', 'good', 'exec'], removed: ['bad'], active: ['report'] },
    explanation: 'The complete case study is a legacy app migration: remove inline event handlers, move dynamic data into JSON script tags or data attributes safely, add nonces or hashes, collect reports, then enforce.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nonce flow') yield* nonceFlow();
  else if (view === 'hash policy') yield* hashPolicy();
  else throw new InputError('Pick a CSP view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Cross-site scripting is dangerous because a small injection can become same-origin code execution. Once attacker JavaScript runs inside the page, it can read DOM state, send authenticated requests, steal tokens exposed to script, and act as the user.',
        'Content Security Policy exists because the browser sees every script candidate before it executes. A strict `script-src` policy turns that moment into an authorization check. The page no longer says "run any inline code that appears in the HTML." It says "run only code that carries a valid proof."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first answer is still correct: escape output, sanitize HTML, avoid string-to-code APIs, remove inline event handlers, and keep untrusted data out of executable contexts. CSP does not replace any of that work.',
        'The wall is coverage. One missed template sink can put a `<script>` tag or `onclick` handler into the page. A host allowlist helps, but it is coarse. If an allowed CDN, JSONP endpoint, upload path, or compromised third party can serve attacker-controlled JavaScript, the browser may still see an allowed source.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core idea is to authorize script execution by proof, not by accident of placement. Every script candidate must match the policy before it crosses the execution boundary.',
        'A nonce proves that the server selected this script element for this response. A hash proves that the script bytes are exactly the approved bytes. `strict-dynamic` can let a nonce- or hash-authorized loader extend trust to scripts it creates, which is useful for modern bundlers but makes that loader part of the security boundary.',
        'This is a policy data-structure lesson. The browser maintains a set of accepted tokens, hashes, sources, and flags. Each script candidate is a lookup against that policy plus a decision: execute, block, or report.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In nonce flow, follow the value from server to policy header to trusted script element. The important state change is not that the script tag exists. The important state change is that the browser can match the element nonce to the nonce listed in `script-src`.',
        'The injected node is drawn beside the trusted script because it may be in the same HTML document. CSP is not deciding based on location in the DOM. It is deciding based on proof. No matching nonce means the parser blocks execution and can emit a violation report.',
        'In hash policy, watch the decision move from "selected element" to "exact bytes." A one-character change matters because the hash no longer names the script. The rollout frame is operational: report-only mode finds real breakage before enforcement blocks users.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nonce mode is response-specific. The server generates a fresh unpredictable value, sends it in `Content-Security-Policy`, and places the same value on trusted script elements. The browser allows a matching element and blocks injected inline scripts, event handlers, and other script candidates that lack authorization.',
        'Hash mode is content-specific. The policy contains a cryptographic hash such as `sha256-...` for stable inline script bytes. At parse time, the browser hashes the candidate and allows execution only on an exact match. Whitespace and build output matter because the hash names bytes, not intent.',
        '`strict-dynamic` changes how descendants are handled. If a trusted root script was authorized by nonce or hash, scripts it programmatically loads can inherit that trust. That helps applications with loader scripts, but it raises the value of compromising the loader.',
        'A safe migration starts in `Content-Security-Policy-Report-Only`, groups violations by real cause, removes inline handlers, moves dynamic data into non-executable JSON or data attributes, adds nonces or hashes, then switches to enforcement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is simple: a script may execute only if the browser can match it to an authorization token, exact approved bytes, or another allowed policy rule. Injected markup does not gain that proof merely by appearing in the DOM.',
        'For nonce policies, an attacker who can inject HTML after the server rendered the response usually cannot predict the fresh nonce. For hash policies, an attacker cannot change the script without changing the digest. The browser check is local, deterministic, and close to the execution boundary.',
        'The proof collapses if the attacker can read or reuse the nonce, inject into a trusted script body, control a trusted loader, weaken the policy with `unsafe-inline`, or load attacker-controlled code from an allowed source.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A server renders a payment page with `Content-Security-Policy: script-src \'nonce-r7\' \'strict-dynamic\'; object-src \'none\'; base-uri \'none\'`. It marks the intended bootstrap script with `nonce="r7"`.',
        'A template bug lets an attacker inject `<script>steal()</script>`. The injected tag is in the DOM, but it has no nonce and its bytes are not hashed in the policy. The browser blocks it before execution and can send a violation report.',
        'The bootstrap script then loads the bundled application script. With `strict-dynamic`, the trusted loader can create that descendant script without enumerating every host in a brittle allowlist. The loader has become a narrow trust root, so it must not turn user data into script URLs or executable strings.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Nonces add server and template plumbing. The value must be fresh and unpredictable per response, and every trusted script element has to receive it. Full-page HTML caching becomes harder when the nonce changes on every response.',
        'Hashes are brittle by design. A whitespace change, minifier change, framework upgrade, or build output change can require a policy update. That brittleness is useful for security but noisy for deployment.',
        'Reports are necessary but messy. Browser extensions, older clients, third-party widgets, and partial rollouts can create noisy violation streams. A team needs triage, sampling, and a clear path from report-only to enforce.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Strict CSP wins on pages where the team controls rendering and can make intended script execution explicit. Account pages, admin tools, payment flows, and authenticated dashboards benefit because a single XSS bug has high impact.',
        'It also wins during legacy cleanup. Report-only mode gives a map of old inline execution paths before enforcement breaks users. The reports show which templates, widgets, and script patterns must change.',
        'Nonce or hash policies are especially useful when host allowlists are too broad. They authorize the page bootstrap directly instead of trusting every script that can be served by a large domain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        '`unsafe-inline` largely gives up the script-execution protection this page is about. A broad host allowlist is also weaker than a strict nonce or hash policy when an allowed host can serve attacker-controlled code.',
        'CSP does not make unsafe HTML safe. It does not replace output encoding, HTML sanitization, URL validation, cookie hardening, dependency review, or server-side authorization.',
        'CSP also cannot express every client-side sink boundary. Trusted Types covers the DOM-XSS problem of controlling which code may write strings into dangerous DOM sinks. CSP and Trusted Types are adjacent tools, not substitutes.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A nonce reused across responses becomes closer to a password than a one-response proof. A nonce inserted into attacker-controlled HTML gives the attacker the proof they need. A policy generator that logs nonces into visible markup can leak the boundary.',
        'A hash policy can fail operationally when teams forget to update hashes after a deploy. It can fail strategically when the hashed bootstrap reads untrusted data and turns it into code.',
        'A rollout can fail by enforcing before reports have been cleaned up. Breakages often come from inline event handlers, third-party widgets, injected analytics snippets, and old templates that still depend on `eval` or string event attributes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN CSP guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP, MDN `script-src` reference at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src, MDN nonce attribute reference at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce, W3C CSP Level 3 at https://www.w3.org/TR/CSP3/, and OWASP CSP Cheat Sheet at https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html.',
        'Study Trusted Types DOM XSS Sink Guard next for client-side sink control, Subresource Integrity Hash Manifest for resource-byte integrity, CORS Preflight Cache for cross-origin request gates, Permissions Policy Feature Gate for browser capability control, and Capability Security Attenuation for the general idea of passing narrow authority instead of broad ambient power.',
      ],
    },
  ],
};
