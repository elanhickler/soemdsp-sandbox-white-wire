function nodeGraphPatchNode(id) {
  return nodeGraphMvp.patch.nodes.find((node) => node.id === id) || null;
}

function nodeGraphPatchNodeType(id) {
  return nodeGraphPatchNode(id)?.type || id;
}

function nodeGraphBypassedNodeIds(patch = nodeGraphMvp.patch) {
  return new Set(Array.isArray(patch.bypassedNodes) ? patch.bypassedNodes : []);
}

function nodeGraphRuntimeBypassedNodeIds(patch = nodeGraphMvp.patch) {
  const bypassed = nodeGraphBypassedNodeIds(patch);
  if (!nodeGraphMvp.live.inputActive) {
    for (const node of patch.nodes || []) {
      if (node.type === "audioInput") {
        bypassed.add(node.id);
      }
    }
  }
  return bypassed;
}

function nodeGraphNodeIsBypassed(nodeId, patch = nodeGraphMvp.patch) {
  return nodeGraphBypassedNodeIds(patch).has(nodeId);
}

function nextNodeGraphTypeCounts(nodes = nodeGraphMvp.patch.nodes) {
  const counts = {};
  for (const node of nodes) {
    const match = node.id.match(new RegExp(`^${node.type}-(\\d+)$`));
    const count = match ? Number(match[1]) : node.id === node.type ? 1 : 0;
    counts[node.type] = Math.max(counts[node.type] || 0, count);
  }
  return {
    additiveOsc: counts.additiveOsc || 0,
    gpuAdditiveOsc: counts.gpuAdditiveOsc || 0,
    audioInput: counts.audioInput || 0,
    badvalMonitor: counts.badvalMonitor || 0,
    bandpass: counts.bandpass || 0,
    bias: counts.bias || 0,
    clock: counts.clock || 0,
    clockDivider: counts.clockDivider || 0,
    cookbookFilter: counts.cookbookFilter || 0,
    delayedTrigger: counts.delayedTrigger || 0,
    expAdsr: counts.expAdsr || 0,
    flowerChildEnvelopeFollower: counts.flowerChildEnvelopeFollower || 0,
    fractalBrownianNoise: counts.fractalBrownianNoise || 0,
    gain: counts.gain || 0,
    groupInput: counts.groupInput || 0,
    groupOutput: counts.groupOutput || 0,
    highpass: counts.highpass || 0,
    ladderFilter: counts.ladderFilter || 0,
    linearEnvelope: counts.linearEnvelope || 0,
    lowpass: counts.lowpass || 0,
    moduleGroup: counts.moduleGroup || 0,
    noise: counts.noise || 0,
    noiseGenerator: counts.noiseGenerator || 0,
    osc: counts.osc || 0,
    pluckEnvelope: counts.pluckEnvelope || 0,
    randomClock: counts.randomClock || 0,
    randomWalk: counts.randomWalk || 0,
    sampleHold: counts.sampleHold || 0,
    slewLimiter: counts.slewLimiter || 0,
    spiral: counts.spiral || 0,
    stereoNoise: counts.stereoNoise || 0,
    stepSequencer: counts.stepSequencer || 0,
    textBox: counts.textBox || 0,
    triggerCounter: counts.triggerCounter || 0,
    triggerDivider: counts.triggerDivider || 0,
    valueSlider: counts.valueSlider || 0,
    vactrolEnvelope: counts.vactrolEnvelope || 0,
  };
}

function syncNodeGraphRuntimeFromPatch() {
  nodeGraphMvp.activeNodes = new Set(nodeGraphMvp.patch.nodes.map((node) => node.id));
  nodeGraphMvp.connections = nodeGraphMvp.patch.connections.map((connection) => ({
    ...connection,
    tracePoints: normalizeNodeGraphTracePoints(connection.tracePoints),
  }));
  nodeGraphMvp.modulations = nodeGraphMvp.patch.modulations.map((modulation) => ({
    ...modulation,
    tracePoints: normalizeNodeGraphTracePoints(modulation.tracePoints),
  }));
  nodeGraphMvp.monitors = normalizeNodeGraphPatchMonitors(
    nodeGraphMvp.patch.monitors,
    nodeGraphMvp.patch,
  );
  nodeGraphMvp.nodeTypeCounts = nextNodeGraphTypeCounts();
}
