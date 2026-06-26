// WebGPU: host arrays become GPUBuffer resources, bind groups connect those
// buffers to shader slots, and command buffers move work onto the GPU queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-buffer-bind-group-case-study',
  title: 'WebGPU Buffer & Bind Group Case Study',
  category: 'Systems',
  summary: 'How WebGPU moves typed-array data into GPUBuffer objects, binds resources to shader slots, records commands, and submits work to a GPU queue.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resource binding', 'compute pass'], defaultValue: 'resource binding' },
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

function resourceGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.7, y: 3.6, note: 'host' },
      { id: 'array', label: 'Array', x: 2.4, y: 1.7, note: 'CPU bytes' },
      { id: 'device', label: 'device', x: 2.4, y: 5.7, note: 'logical' },
      { id: 'buffer', label: 'Buffer', x: 4.4, y: 3.7, note: 'flags' },
      { id: 'layout', label: 'Layout', x: 6.4, y: 1.4, note: 'slots' },
      { id: 'bind', label: 'Bind', x: 6.4, y: 5.8, note: 'resources' },
      { id: 'pipe', label: 'Pipe', x: 8.4, y: 2.3, note: 'shader' },
      { id: 'queue', label: 'Queue', x: 9.3, y: 5.0, note: 'submit' },
    ],
    edges: [
      { id: 'e-js-array', from: 'js', to: 'array' },
      { id: 'e-js-device', from: 'js', to: 'device' },
      { id: 'e-array-buffer', from: 'array', to: 'buffer', weight: 'write/copy' },
      { id: 'e-device-buffer', from: 'device', to: 'buffer', weight: 'create' },
      { id: 'e-buffer-bind', from: 'buffer', to: 'bind' },
      { id: 'e-layout-bind', from: 'layout', to: 'bind' },
      { id: 'e-layout-pipe', from: 'layout', to: 'pipe' },
      { id: 'e-bind-pipe', from: 'bind', to: 'pipe' },
      { id: 'e-pipe-queue', from: 'pipe', to: 'queue' },
    ],
  }, { title });
}

function computeGraph(title) {
  return graphState({
    nodes: [
      { id: 'inA', label: 'input A', x: 0.7, y: 2.1, note: 'storage' },
      { id: 'inB', label: 'input B', x: 0.7, y: 5.2, note: 'storage' },
      { id: 'bind', label: 'bind group', x: 2.8, y: 3.6, note: 'slots 0..2' },
      { id: 'shader', label: 'WGSL', x: 4.8, y: 3.6, note: 'kernel' },
      { id: 'dispatch', label: 'dispatch', x: 6.7, y: 3.6, note: 'workgroups' },
      { id: 'out', label: 'output', x: 8.5, y: 2.1, note: 'storage' },
      { id: 'readback', label: 'readback', x: 8.5, y: 5.2, note: 'MAP_READ' },
    ],
    edges: [
      { id: 'e-a-bind', from: 'inA', to: 'bind' },
      { id: 'e-b-bind', from: 'inB', to: 'bind' },
      { id: 'e-bind-shader', from: 'bind', to: 'shader' },
      { id: 'e-shader-dispatch', from: 'shader', to: 'dispatch' },
      { id: 'e-dispatch-out', from: 'dispatch', to: 'out' },
      { id: 'e-out-readback', from: 'out', to: 'readback' },
    ],
  }, { title });
}

function* resourceBinding() {
  yield {
    state: resourceGraph('WebGPU starts with a logical device and explicit buffers'),
    highlight: { active: ['js', 'device', 'buffer', 'e-js-device', 'e-device-buffer'], compare: ['array'] },
    explanation: 'A WebGPU app asks the browser for a GPUAdapter and GPUDevice, then creates GPUBuffer objects with explicit usage flags. The buffer is not a JavaScript array; it is a GPU resource with declared allowed uses.',
  };

  yield {
    state: resourceGraph('Typed arrays upload bytes into GPUBuffer storage'),
    highlight: { active: ['array', 'buffer', 'e-array-buffer'], found: ['js'], compare: ['device'] },
    explanation: 'Host data usually starts as a TypedArray. The app writes it into a GPUBuffer with queue.writeBuffer, mapped ranges, or copy commands. This is the same boundary lesson as WebAssembly linear memory: bytes cross explicitly, and layout is the contract.',
    invariant: 'The shader sees bytes with a declared layout; JavaScript object shape is not visible on the GPU.',
  };

  yield {
    state: resourceGraph('Bind group layout names the shader resource contract'),
    highlight: { active: ['layout', 'bind', 'buffer', 'pipe', 'e-layout-bind', 'e-buffer-bind', 'e-layout-pipe'], compare: ['queue'] },
    explanation: 'A bind group layout says which resource slots exist, which shader stages can see them, and whether a buffer is uniform, read-only storage, writable storage, or another resource type. A bind group fills those slots with concrete resources.',
  };

  yield {
    state: labelMatrix(
      'GPUBuffer usage flags',
      [
        { id: 'mapread', label: 'MAP_READ' },
        { id: 'mapwrite', label: 'MAP_WRITE' },
        { id: 'copy', label: 'COPY_SRC/DST' },
        { id: 'vertex', label: 'VERTEX/INDEX' },
        { id: 'uniform', label: 'UNIFORM' },
        { id: 'storage', label: 'STORAGE' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'common pitfall', label: 'common pitfall' },
      ],
      [
        ['read back to CPU', 'must copy from compute output first'],
        ['CPU writes mapped range', 'not a free live JS view'],
        ['staging and transfers', 'missing flag blocks copy'],
        ['draw input streams', 'wrong stride breaks vertices'],
        ['small constants', 'alignment and size limits'],
        ['large shader data', 'race and bounds discipline'],
      ],
    ),
    highlight: { active: ['copy:purpose', 'uniform:purpose', 'storage:purpose'], compare: ['mapread:common pitfall'] },
    explanation: 'Usage flags are a validation data structure. They let the browser reject impossible or unsafe resource transitions before commands reach the driver.',
  };
}

function* computePass() {
  yield {
    state: computeGraph('A compute pass binds buffers and dispatches workgroups'),
    highlight: { active: ['inA', 'inB', 'bind', 'shader', 'dispatch', 'e-a-bind', 'e-b-bind', 'e-bind-shader', 'e-shader-dispatch'], compare: ['out'] },
    explanation: 'A compute shader reads storage buffers through a bind group, runs many invocations grouped into workgroups, and writes results into another storage buffer. This is GPU data-parallelism exposed inside the browser.',
  };

  yield {
    state: labelMatrix(
      'Resource type fit',
      [
        { id: 'uniform', label: 'uniform buffer' },
        { id: 'storage', label: 'storage buffer' },
        { id: 'vertex', label: 'vertex buffer' },
        { id: 'index', label: 'index buffer' },
        { id: 'readback', label: 'readback buffer' },
      ],
      [
        { id: 'shader access', label: 'shader access' },
        { id: 'data structure shape', label: 'data structure shape' },
      ],
      [
        ['read constants', 'small config block'],
        ['read/write arrays', 'large flat arrays'],
        ['read per vertex', 'struct stream'],
        ['read indices', 'compact topology'],
        ['CPU map after copy', 'staging result'],
      ],
    ),
    highlight: { active: ['storage:shader access', 'vertex:data structure shape', 'index:data structure shape'], found: ['uniform:data structure shape'] },
    explanation: 'Choosing the buffer type is choosing the access pattern. Uniforms are compact constants, storage buffers are large arrays, vertex and index buffers are draw-specific streams, and readback buffers are CPU-visible staging space.',
  };

  yield {
    state: resourceGraph('Command encoding separates recording from execution'),
    highlight: { active: ['pipe', 'queue', 'e-pipe-queue'], found: ['bind'], compare: ['js'] },
    explanation: 'WebGPU records work into a command encoder, finishes a command buffer, then submits it to the queue. JavaScript is describing future GPU work, not executing each shader invocation directly.',
    invariant: 'The queue timeline and the JavaScript event loop are related but not the same timeline.',
  };

  yield {
    state: computeGraph('Readback copies GPU output into a mappable buffer'),
    highlight: { active: ['out', 'readback', 'e-out-readback'], found: ['dispatch'], compare: ['inA', 'inB'] },
    explanation: 'Compute output usually lives in a storage buffer that is not directly mappable for CPU reads. The usual path is copyBufferToBuffer into a MAP_READ staging buffer, then mapAsync and read the ArrayBuffer after the GPU has completed the copy.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: sparse PageRank in the browser',
      [
        { id: 'rowptr', label: 'rowPtr' },
        { id: 'colidx', label: 'colIdx' },
        { id: 'rank', label: 'rank values' },
        { id: 'next', label: 'next values' },
        { id: 'control', label: 'iteration params' },
      ],
      [
        { id: 'WebGPU resource', label: 'WebGPU resource' },
        { id: 'source topic', label: 'source topic' },
      ],
      [
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['storage buffer', 'PageRank'],
        ['writable storage', 'PageRank'],
        ['uniform buffer', 'algorithm constants'],
      ],
    ),
    highlight: { active: ['rowptr:WebGPU resource', 'colidx:WebGPU resource', 'rank:WebGPU resource', 'next:WebGPU resource'], found: ['control:WebGPU resource'] },
    explanation: 'The case-study bridge is concrete: a CSR graph becomes flat storage buffers, a PageRank iteration becomes a compute dispatch, and the browser app reads back only summaries or the final rank vector.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resource binding') yield* resourceBinding();
  else if (view === 'compute pass') yield* computePass();
  else throw new InputError('Pick a WebGPU view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the resource-binding view as JavaScript values becoming GPU-visible bytes and shader slots. Active nodes are the current boundary: typed array, GPUBuffer, bind group layout, bind group, pipeline, pass, or queue submission. Found nodes are resources whose contract is now fixed.',
        'The safe inference is that data has not crossed a boundary until the active edge shows it. A buffer can exist without containing uploaded data. A bind group can exist without any shader running. A submitted command buffer can still be executing asynchronously on the GPU.',
        {type: 'callout', text: 'WebGPU turns GPU work into explicit byte layout and binding contracts, so validation can replace implicit driver state.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/WebGPU_logo.svg', alt: 'WebGPU blue geometric logo', caption: 'WebGPU logo. Attribution: W3C, via Wikimedia Commons; public-domain text logo.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A GPU is not a faster JavaScript object engine. It consumes flat memory, typed shader inputs, command buffers, and pipeline state. JavaScript values must be packed into bytes before thousands of GPU invocations can read them.',
        'WebGPU exists to make that contract explicit and portable. Buffers declare usage flags, bind group layouts declare shader slots, bind groups attach resources to those slots, and command encoders record work. The browser validates the structure before the driver sees it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to pass a JavaScript array directly to the shader. That is how ordinary functions feel: call the function with values and receive a result. It also resembles the mental model many developers bring from small WebGL uniform uploads.',
        'A second tempting approach is one buffer for everything. Use the same allocation as vertex data, uniform data, compute input, compute output, and CPU readback. That reduces names in the code but erases the usage contract the browser needs to validate.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the GPU cannot read JavaScript heap objects, and JavaScript cannot synchronously inspect GPU memory. The two sides have different memory, timing, alignment, and execution rules. An array object has no meaning to a WGSL shader until its values are copied into a GPUBuffer with a layout the shader expects.',
        'Usage conflicts are another wall. A buffer mapped for CPU readback is not the same as a storage buffer used by a compute shader. WebGPU forces those intended roles into usage flags so invalid combinations fail as validation errors instead of driver-specific behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'GPU programming is data-layout programming. The shader is fast only after the data is flat, typed, aligned, and bound to the correct slot. WebGPU makes the byte layout and binding layout part of the API instead of hidden driver state.',
        'There are two translations. First, JavaScript values become bytes in GPUBuffer objects. Second, bind groups connect those buffers to shader declarations such as group 0 binding 2. Both translations must match the pipeline before execution is valid.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The app requests a GPUDevice, creates buffers with size and usage flags, uploads data with queue.writeBuffer or mapped ranges, creates a bind group layout, creates a bind group with actual buffer resources, records a compute or render pass, and submits the finished command buffer to the queue. JavaScript describes future GPU work; it does not execute the shader inline.',
        'Readback uses a staging buffer. A compute shader may write a storage buffer, then the command encoder copies that data into a MAP_READ buffer. JavaScript awaits mapAsync before reading the mapped range, because GPU execution happens on a separate timeline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from explicit contracts. Usage flags say how a buffer may be used. Bind group layouts say which resource type each shader slot expects. WGSL declarations say how bytes are interpreted. Command encoding says which work will run and in what order.',
        'The temporal contract matters too. queue.submit returns before the GPU is necessarily finished, but mapAsync resolves only after the relevant work is complete. That prevents JavaScript from reading a result before the GPU has produced it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main costs are allocation, upload, validation, command recording, and readback. For 1,024 floats, the data is only 4 KB, so a JavaScript loop may beat the GPU once setup and readback are included. For 10,000,000 floats, the data is 40 MB and the GPU can amortize setup across many parallel operations.',
        'Readback often dominates small compute jobs. A vector addition may execute in microseconds on the GPU, but copying results to a staging buffer and awaiting mapAsync can take milliseconds. The practical rule is to keep data on the GPU across several passes before reading it back.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'WebGPU buffers and bind groups fit browser ML inference, real-time rendering, image filters, particle systems, scientific visualization, and graph analytics. The access pattern is large flat data, repeated shader passes, and results that can remain on the GPU.',
        'The same model appears in vertex buffers, uniform buffers, storage buffers, textures, samplers, and compute pipelines. A renderer may draw with vertex buffers while a simulation updates positions in storage buffers. The binding contract keeps those roles explicit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the workload is small, branchy, or needs immediate CPU results after every pass. Setup and synchronization can swamp the shader speedup. A CPU typed-array loop is often better when the data already lives on the CPU and the answer is needed right away.',
        'It also fails when layout is guessed. WGSL alignment and JavaScript packing must match. A missing padding field can produce valid GPU memory with wrong values, which is worse than a validation error because the shader runs and returns nonsense.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compute C = A + B for 1,000,000 float32 values. A and B are 4 MB each, and C is 4 MB. The app creates two read-only storage buffers for input, one storage buffer for output, and one 4 MB staging buffer for readback if the CPU needs the result.',
        'With workgroup size 256, dispatchWorkgroups(3907) covers 1,000,000 values because ceil(1,000,000 / 256) is 3907. Each invocation reads A[i] and B[i], writes C[i], and no two invocations write the same index. The bind group proves each shader slot points to the intended buffer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN WebGPU API at https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API, MDN GPUBuffer at https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer, MDN GPUQueue.submit at https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit, and W3C WGSL at https://www.w3.org/TR/WGSL/.',
        'Study next by role: WebAssembly Linear Memory for byte-boundary thinking, Apache Arrow Columnar Memory for flat typed layout, Compressed Sparse Row Graph for buffer-shaped sparse data, WebGPU Parallel Prefix Scan for multi-pass compute, and Render Graph Resource Lifetimes for managing many GPU resources over time.',
      ],
    },
  ],
};

