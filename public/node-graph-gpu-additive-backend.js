const nodeGraphGpuAdditiveState = {
  adapterInfo: null,
  device: null,
  initError: "",
  pipeline: null,
  shaderModule: null,
  supported: null,
};

const nodeGraphGpuAdditiveShader = `
struct Params {
  sampleRate: f32,
  frequency: f32,
  phase: f32,
  level: f32,
  harmonics: u32,
  waveform: u32,
  frameCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read> params: Params;
@group(0) @binding(1) var<storage, read_write> outSamples: array<f32>;

fn harmonicAmplitude(harmonic: u32, waveform: u32) -> f32 {
  let h = f32(harmonic);
  if (waveform == 0u) {
    return select(0.0, 1.0, harmonic == 1u);
  }
  if (waveform == 2u) {
    return select(0.0, 1.0 / h, (harmonic % 2u) == 1u);
  }
  if (waveform == 3u) {
    return select(0.0, 1.0 / (h * h), (harmonic % 2u) == 1u);
  }
  return 1.0 / h;
}

fn harmonicPhase(harmonic: u32, waveform: u32) -> f32 {
  if (waveform == 1u && (harmonic % 2u) == 1u) {
    return 3.14159265359;
  }
  return 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let frame = gid.x;
  if (frame >= params.frameCount) {
    return;
  }
  let t = f32(frame) / max(params.sampleRate, 1.0);
  let basePhase = params.phase + 6.28318530718 * params.frequency * t;
  let harmonicCount = max(params.harmonics, 1u);
  var total = 0.0;
  var norm = 0.0;
  for (var harmonic = 1u; harmonic <= harmonicCount; harmonic = harmonic + 1u) {
    let amp = harmonicAmplitude(harmonic, params.waveform);
    if (amp != 0.0) {
      total = total + sin(basePhase * f32(harmonic) + harmonicPhase(harmonic, params.waveform)) * amp;
      norm = norm + abs(amp);
    }
  }
  let normalized = select(0.0, total / max(1.0, norm * 0.72), norm > 0.0);
  outSamples[frame] = clamp(normalized * params.level, -1.0, 1.0);
}
`;

function nodeGraphGpuAdditiveAvailable() {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

async function nodeGraphEnsureGpuAdditiveBackend() {
  if (!nodeGraphGpuAdditiveAvailable()) {
    nodeGraphGpuAdditiveState.supported = false;
    nodeGraphGpuAdditiveState.initError = "WebGPU unavailable";
    return null;
  }
  if (nodeGraphGpuAdditiveState.device && nodeGraphGpuAdditiveState.pipeline) {
    return nodeGraphGpuAdditiveState;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No WebGPU adapter");
    }
    const device = await adapter.requestDevice();
    const shaderModule = device.createShaderModule({
      code: nodeGraphGpuAdditiveShader,
      label: "Soundemote GPU Additive Shader",
    });
    const pipeline = device.createComputePipeline({
      compute: {
        entryPoint: "main",
        module: shaderModule,
      },
      label: "Soundemote GPU Additive Pipeline",
      layout: "auto",
    });
    nodeGraphGpuAdditiveState.adapterInfo = typeof adapter.requestAdapterInfo === "function"
      ? await adapter.requestAdapterInfo().catch(() => null)
      : null;
    nodeGraphGpuAdditiveState.device = device;
    nodeGraphGpuAdditiveState.initError = "";
    nodeGraphGpuAdditiveState.pipeline = pipeline;
    nodeGraphGpuAdditiveState.shaderModule = shaderModule;
    nodeGraphGpuAdditiveState.supported = true;
    return nodeGraphGpuAdditiveState;
  } catch (error) {
    nodeGraphGpuAdditiveState.device = null;
    nodeGraphGpuAdditiveState.initError = error?.message || String(error);
    nodeGraphGpuAdditiveState.pipeline = null;
    nodeGraphGpuAdditiveState.supported = false;
    return null;
  }
}

function nodeGraphGpuAdditiveCpuRender(params = {}, frameCount = 128, sampleRate = nodeGraphMvp?.sampleRate || 44100) {
  const frames = Math.max(1, Math.floor(Number(frameCount) || 1));
  const safeRate = Math.max(1, Number(sampleRate) || nodeGraphMvp?.sampleRate || 44100);
  const out = new Float32Array(frames);
  const frequency = Math.max(0, Number(params.frequency) || 0);
  const phase = Number(params.phase) || 0;
  const phaseIncrement = (frequency / safeRate) * Math.PI * 2;
  for (let frame = 0; frame < frames; frame += 1) {
    out[frame] = nodeGraphAdditiveOscillatorSample(
      null,
      "gpuAdditiveCpuRender",
      phase + phaseIncrement * frame,
      params,
      safeRate,
    );
  }
  return out;
}

async function nodeGraphRenderGpuAdditiveChunk(params = {}, options = {}) {
  const frameCount = Math.max(1, Math.min(65536, Math.floor(Number(options.frameCount) || 128)));
  const sampleRate = Math.max(1, Number(options.sampleRate) || nodeGraphMvp?.sampleRate || 44100);
  const backend = await nodeGraphEnsureGpuAdditiveBackend();
  if (!backend?.device || !backend?.pipeline) {
    return {
      backend: "cpu-fallback",
      diagnostics: {
        reason: nodeGraphGpuAdditiveState.initError || "WebGPU unavailable",
        supported: nodeGraphGpuAdditiveState.supported === true,
      },
      samples: nodeGraphGpuAdditiveCpuRender(params, frameCount, sampleRate),
    };
  }

  const device = backend.device;
  const paramsArray = new ArrayBuffer(32);
  const paramsFloat = new Float32Array(paramsArray);
  const paramsUint = new Uint32Array(paramsArray);
  paramsFloat[0] = sampleRate;
  paramsFloat[1] = Math.max(0, Number(params.frequency) || 0);
  paramsFloat[2] = Number(params.phase) || 0;
  paramsFloat[3] = clampNodeSliderValue(Number(params.level) || 0, 0, 1);
  paramsUint[4] = Math.max(1, Math.min(nodeGraphAdditiveHardMaxHarmonics, Math.round(Number(params.harmonics) || 32)));
  paramsUint[5] = Math.max(0, Math.min(7, Math.round(Number(params.waveform) || 1)));
  paramsUint[6] = frameCount;
  paramsUint[7] = 0;

  const paramsBuffer = device.createBuffer({
    mappedAtCreation: true,
    size: paramsArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  new Uint8Array(paramsBuffer.getMappedRange()).set(new Uint8Array(paramsArray));
  paramsBuffer.unmap();

  const outputByteLength = frameCount * Float32Array.BYTES_PER_ELEMENT;
  const outputBuffer = device.createBuffer({
    size: outputByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readbackBuffer = device.createBuffer({
    size: outputByteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const bindGroup = device.createBindGroup({
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
    ],
    layout: backend.pipeline.getBindGroupLayout(0),
  });
  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(backend.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(frameCount / 64));
  pass.end();
  commandEncoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, outputByteLength);
  device.queue.submit([commandEncoder.finish()]);
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  const samples = new Float32Array(readbackBuffer.getMappedRange().slice(0));
  readbackBuffer.unmap();
  return {
    backend: "webgpu",
    diagnostics: {
      frameCount,
      sampleRate,
      supported: true,
    },
    samples,
  };
}

if (typeof window !== "undefined") {
  window.nodeGraphGpuAdditive = {
    available: nodeGraphGpuAdditiveAvailable,
    renderChunk: nodeGraphRenderGpuAdditiveChunk,
    state: nodeGraphGpuAdditiveState,
  };
}
