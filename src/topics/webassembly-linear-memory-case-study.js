// WebAssembly linear memory: one growable byte array shared between Wasm and
// JavaScript, with pages, typed-array views, explicit pointers, and sandboxed bounds.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webassembly-linear-memory-case-study',
  title: 'WebAssembly Linear Memory Case Study',
  category: 'Systems',
  summary: 'How Wasm represents memory as pages of raw bytes, exposes an ArrayBuffer to JavaScript, grows memory, and keeps native-style code sandboxed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['linear memory', 'growth and interop'], defaultValue: 'linear memory' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.8, y: 3.7, note: 'host' },
      { id: 'memory', label: 'Memory', x: 2.7, y: 3.7, note: 'ArrayBuffer' },
      { id: 'u8', label: 'Uint8', x: 4.8, y: 1.8, note: 'bytes' },
      { id: 'u32', label: 'Uint32', x: 4.8, y: 3.7, note: 'words' },
      { id: 'f64', label: 'Float64', x: 4.8, y: 5.6, note: 'numbers' },
      { id: 'wasm', label: 'Wasm', x: 7.0, y: 3.7, note: 'instance' },
      { id: 'load', label: 'load/store', x: 9.0, y: 2.3, note: 'offset' },
      { id: 'bounds', label: 'bounds', x: 9.0, y: 5.1, note: 'trap' },
    ],
    edges: [
      { id: 'e-js-memory', from: 'js', to: 'memory' },
      { id: 'e-memory-u8', from: 'memory', to: 'u8' },
      { id: 'e-memory-u32', from: 'memory', to: 'u32' },
      { id: 'e-memory-f64', from: 'memory', to: 'f64' },
      { id: 'e-memory-wasm', from: 'memory', to: 'wasm' },
      { id: 'e-wasm-load', from: 'wasm', to: 'load' },
      { id: 'e-load-bounds', from: 'load', to: 'bounds' },
    ],
  }, { title });
}

function interopGraph(title) {
  return graphState({
    nodes: [
      { id: 'malloc', label: 'malloc', x: 0.8, y: 3.7, note: 'reserve' },
      { id: 'ptr', label: 'ptr', x: 2.5, y: 3.7, note: 'number' },
      { id: 'view', label: 'view', x: 4.2, y: 2.0, note: 'typed array' },
      { id: 'call', label: 'call', x: 4.2, y: 5.3, note: 'export' },
      { id: 'grow', label: 'grow', x: 6.1, y: 3.7, note: '+pages' },
      { id: 'old', label: 'old view', x: 7.9, y: 2.0, note: 'stale' },
      { id: 'new', label: 'new view', x: 7.9, y: 5.3, note: 'refresh' },
      { id: 'free', label: 'free', x: 9.3, y: 3.7, note: 'manual' },
    ],
    edges: [
      { id: 'e-malloc-ptr', from: 'malloc', to: 'ptr' },
      { id: 'e-ptr-view', from: 'ptr', to: 'view' },
      { id: 'e-ptr-call', from: 'ptr', to: 'call' },
      { id: 'e-call-grow', from: 'call', to: 'grow' },
      { id: 'e-grow-old', from: 'grow', to: 'old' },
      { id: 'e-grow-new', from: 'grow', to: 'new' },
      { id: 'e-new-free', from: 'new', to: 'free' },
    ],
  }, { title });
}

function* linearMemory() {
  yield {
    state: memoryGraph('Wasm memory is one indexed byte array'),
    highlight: { active: ['js', 'memory', 'wasm', 'e-js-memory', 'e-memory-wasm'], found: ['u8', 'u32', 'f64'] },
    explanation: 'WebAssembly linear memory is a contiguous mutable byte array. JavaScript sees it through WebAssembly.Memory.buffer. Wasm code sees it through numeric offsets used by load and store instructions.',
  };

  yield {
    state: labelMatrix(
      'Pages and regions inside one memory',
      [
        { id: 'p0', label: 'page 0' },
        { id: 'p1', label: 'page 1' },
        { id: 'p2', label: 'page 2' },
        { id: 'p3', label: 'page 3' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'typical use', label: 'typical use' },
      ],
      [
        ['64 KiB', 'data segment'],
        ['64 KiB', 'stack'],
        ['64 KiB', 'heap'],
        ['64 KiB', 'future grow'],
      ],
    ),
    highlight: { active: ['p0:size', 'p1:size', 'p2:size', 'p3:size'], compare: ['p3:typical use'] },
    explanation: 'Memory grows in WebAssembly pages. One page is 64 KiB. Toolchains divide the byte array into regions such as static data, stack, and heap, but those regions are conventions built on the same byte address space.',
    invariant: 'A pointer is an offset into linear memory, not a JavaScript object reference.',
  };

  yield {
    state: memoryGraph('Typed arrays are overlapping interpretations'),
    highlight: { active: ['memory', 'u8', 'u32', 'f64', 'e-memory-u8', 'e-memory-u32', 'e-memory-f64'], compare: ['wasm'] },
    explanation: 'A Uint8Array, Uint32Array, and Float64Array can all view the same bytes. The data is not copied when a view is created; only the interpretation changes. That is why byte offsets, alignment, and encoding matter.',
  };

  yield {
    state: labelMatrix(
      'Load/store safety boundary',
      [
        { id: 'address', label: 'address' },
        { id: 'bounds', label: 'bounds check' },
        { id: 'trap', label: 'trap' },
        { id: 'sandbox', label: 'sandbox' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['integer offset', 'portable pointer'],
        ['inside memory?', 'host safety'],
        ['fail fast', 'no native memory escape'],
        ['separate store', 'browser/runtime isolation'],
      ],
    ),
    highlight: { found: ['bounds:why', 'trap:why', 'sandbox:why'] },
    explanation: 'Wasm can be low-level without giving a module native pointers. Loads and stores target linear memory and are checked against its bounds. An out-of-bounds access traps instead of reading arbitrary host memory.',
  };
}

function* growthAndInterop() {
  yield {
    state: interopGraph('Interop passes pointers and lengths across the boundary'),
    highlight: { active: ['malloc', 'ptr', 'view', 'call', 'e-malloc-ptr', 'e-ptr-view', 'e-ptr-call'], compare: ['grow'] },
    explanation: 'JavaScript and Wasm usually exchange compound data by passing a pointer and length. JavaScript writes bytes into memory, calls an exported function with the pointer, and reads bytes back through a typed-array view.',
  };

  yield {
    state: labelMatrix(
      'Memory growth edge cases',
      [
        { id: 'grow', label: 'memory.grow' },
        { id: 'old', label: 'old ArrayBuffer' },
        { id: 'new', label: 'new buffer' },
        { id: 'shared', label: 'shared memory' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['adds pages', 'capacity changes'],
        ['detached', 'views go stale'],
        ['fresh length', 'recreate views'],
        ['not detached', 'length caveat'],
      ],
    ),
    highlight: { removed: ['old:behavior'], found: ['new:lesson'], compare: ['shared:behavior'] },
    explanation: 'For non-shared memory, memory.grow detaches references to the old buffer, even grow(0). Code that caches a Uint8Array over memory.buffer must recreate the view after calls that may grow memory.',
    invariant: 'Store pointer and length; recreate the typed-array view when needed.',
  };

  yield {
    state: interopGraph('Manual allocation makes JavaScript a guest in the heap'),
    highlight: { active: ['malloc', 'ptr', 'new', 'free', 'e-malloc-ptr', 'e-new-free'], removed: ['old'] },
    explanation: 'If the Wasm module owns malloc/free, JavaScript must treat returned pointers like foreign heap addresses. A pointer can outlive a temporary JS view, but the allocation still needs an ownership rule and a matching free.',
  };

  yield {
    state: labelMatrix(
      'Interop checklist',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'strings', label: 'strings' },
        { id: 'structs', label: 'structs' },
        { id: 'growth', label: 'growth' },
        { id: 'threads', label: 'threads' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['use Uint8Array', 'wrong element width'],
        ['encode/decode UTF-8', 'garbled text'],
        ['match layout', 'bad offsets'],
        ['refresh views', 'empty stale arrays'],
        ['SharedArrayBuffer rules', 'race or isolation issue'],
      ],
    ),
    highlight: { active: ['bytes:rule', 'strings:rule', 'structs:rule', 'growth:rule', 'threads:rule'] },
    explanation: 'The hard bugs are ordinary memory bugs wearing a browser costume: width mismatch, string encoding, struct layout, stale views, and shared-memory races. The fix is to write explicit boundary contracts.',
  };

  yield {
    state: labelMatrix(
      'What toolchains add',
      [
        { id: 'heap', label: 'HEAP views' },
        { id: 'ccall', label: 'ccall/cwrap' },
        { id: 'malloc', label: 'malloc/free' },
        { id: 'fs', label: 'virtual FS' },
      ],
      [
        { id: 'adds', label: 'adds' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['typed views', 'view refresh'],
        ['function bridge', 'export config'],
        ['C heap API', 'manual lifetime'],
        ['file illusion', 'sync and packaging'],
      ],
    ),
    highlight: { found: ['heap:adds', 'ccall:adds', 'malloc:adds'], compare: ['fs:cost'] },
    explanation: 'Emscripten and similar toolchains hide much of the ceremony, but they do not remove the model. Underneath, data still crosses as bytes, pointers, typed views, and runtime-managed heap conventions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'linear memory') yield* linearMemory();
  else if (view === 'growth and interop') yield* growthAndInterop();
  else throw new InputError('Pick a WebAssembly memory view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'WebAssembly linear memory is the memory model that lets low-level code run inside a browser or other host without receiving native pointers into the host process. The core abstraction is deliberately simple: a contiguous, mutable array of raw bytes. Wasm load and store instructions use integer offsets into that byte array. The host can expose the same memory to JavaScript through WebAssembly.Memory.buffer, which is an ArrayBuffer or SharedArrayBuffer.',
        'The official core specification describes linear memory as a mutable byte array, and the MDN JavaScript API reference describes WebAssembly.Memory as the resizable buffer accessed by a WebAssembly instance: https://www.w3.org/TR/wasm-core-2/ and https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory. That makes this topic a bridge between arrays, allocators, typed arrays, browser runtimes, and sandboxing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A memory has an initial size measured in pages. One WebAssembly page is 64 KiB. A module can import memory from JavaScript or create and export memory to JavaScript. JavaScript then creates typed-array views such as Uint8Array, Uint32Array, or Float64Array over the same buffer. Those views do not copy data; they interpret the same bytes with different element widths.',
        'Compound values cross the boundary as pointer and length pairs. JavaScript writes bytes into memory, passes the offset to an exported Wasm function, and reads the result back from memory. Toolchains such as Emscripten add helpers for calling compiled C functions, string conversion, and HEAP8/HEAPU8/HEAP32-style typed views, but the underlying model is still bytes plus offsets: https://emscripten.org/docs/api_reference/preamble.js.html.',
      ],
    },
    {
      heading: 'Growth and pitfalls',
      paragraphs: [
        'Memory can grow by pages. The JavaScript API memory.grow(delta) returns the previous page count and increases the memory size if it stays within the maximum. MDN documents the sharp edge: for non-shared memory, every grow call detaches references to the old buffer, even grow(0), so cached typed-array views become empty or stale. Accessing memory.buffer again gives a buffer with the current length: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow.',
        'This is why robust interop code stores pointer and length, not a permanent JavaScript view. If an exported function might allocate and trigger growth, recreate typed-array views afterward. If the module owns malloc/free, JavaScript must also respect allocation lifetime. Pointers are just numeric offsets; the runtime will bounds-check them, but it will not automatically free your heap object or decode your struct layout.',
      ],
    },
    {
      heading: 'Case-study connections',
      paragraphs: [
        'This topic links Buddy Allocator Free Lists and Slab Allocator Size Classes to browser execution. A C or Rust allocator compiled to Wasm manages a heap inside linear memory. It also links Apache Arrow Columnar Memory Case Study because both rely on byte buffers plus typed views and offsets. It links Web Workers because Wasm modules often run off the main thread, Structured Clone & Transferables because ArrayBuffer ownership affects interop, and SharedArrayBuffer & Atomics because Wasm threads share memory through the same browser gate.',
        'V8 Generational Garbage Collection is a useful contrast. JavaScript objects live in a garbage-collected heap controlled by the engine. Wasm linear memory is a separate byte store controlled by the module and host API. The browser can sandbox it, grow it, and detach buffers, but the language compiled into Wasm may still require manual allocation discipline.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a Wasm pointer like a JavaScript object reference. It is an offset. Do not cache typed-array views forever if memory can grow. Do not forget string encodings; JavaScript strings are not raw C strings. Do not assume a struct layout unless both sides agree on alignment and field widths. Do not confuse the sandbox boundary with memory safety inside the module: C code can still corrupt its own heap inside linear memory.',
        'A second misconception is that WebAssembly is only a browser feature. The core format is designed to be portable and not web-specific, though browsers expose it through JavaScript APIs. The V8 4GB memory writeup is a good example of how runtime and toolchain details affect what large linear memories can do in practice: https://v8.dev/blog/4gb-wasm-memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C WebAssembly Core Specification at https://www.w3.org/TR/wasm-core-2/, MDN WebAssembly.Memory at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory, MDN memory.grow at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow, MDN text-format memory examples at https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Understanding_the_text_format, Emscripten preamble.js at https://emscripten.org/docs/api_reference/preamble.js.html, Emscripten deployment memory notes at https://emscripten.org/docs/compiling/Deploying-Pages.html, and V8 4GB Wasm Memory at https://v8.dev/blog/4gb-wasm-memory. Study Bytecode Stack Virtual Machine, Interpreter Dispatch Table & Threaded Code, Buddy Allocator Free Lists, Slab Allocator Size Classes, TLSF Real-Time Allocator Bitmap Index, Apache Arrow Columnar Memory Case Study, Structured Clone & Transferables, SharedArrayBuffer & Atomics, Web Workers, Service Workers, Ring Buffer, and V8 Generational Garbage Collection next.',
      ],
    },
  ],
};
