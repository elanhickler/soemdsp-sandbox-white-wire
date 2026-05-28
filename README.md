# soemdsp-sandbox

Local browser sandbox for `soemdsp` proof artifacts and demo-scoped interactive patching.

The sandbox now has two lanes:

- a browser-only Node Wiring MVP where output ports can be freely wired into signal or modulation inputs, with reachable graphs ending at Output compiled into an inspectable browser-local execution plan, rendered to an audible Web Audio buffer, played live through Web Audio, and inspected through local waveform and signal-plot canvases
- a read-only artifact inspector for generated `soemdsp` handoff manifests, WAVs, phase reports, producer proofs, boundary flags, parameter resync data, waveform playback, level envelopes, and X/Y signal plots

The server remains read-only. The node graph is intentionally demo-scoped browser state. Its execution-plan compiler is a sandbox proof for browser patches; it does not mutate `Circuit`, introduce a production `soemdsp` scheduler, or become a plugin layer. Patch scripts can be edited, loaded, and saved from the browser, but the server does not persist project state.

## Run

Generate the current artifact packet from `soemdsp` first:

```powershell
C:\Users\argit\Documents\_PROGRAMMING\soemdsp\build-moved\examples\Debug\runtime_dsp_object_bound_wav_resync_demo.exe
```

Start the sandbox:

```powershell
python C:\Users\argit\Documents\_PROGRAMMING\soemdsp-sandbox\server.py
```

Open:

```text
http://127.0.0.1:8765
```

## Smoke Test

After generating the current `soemdsp` artifact packet, run:

```powershell
python C:\Users\argit\Documents\_PROGRAMMING\soemdsp-sandbox\scripts\smoke_test.py
```

The smoke test starts isolated local servers on automatic temporary ports, checks
the manifest endpoint, checks the root shell DOM contract, duplicate IDs, and
audio/waveform control attributes, checks the node graph MVP shell/source/style
contract including the single-pass stored-output scheduler debug surface, checks static assets, checks the waveform
seek source contract, checks producer proof flags, checks the handoff contract and boundary flags, checks handoff artifact
references, checks artifact and phase coverage, checks every manifest artifact
link for reachability, checks report documents, checks hands-on readiness source
coverage, checks parameter resync summary
values, checks primary audio artifact reachability, WAV metadata, and byte-range
audio responses, checks producer-side phase audio measurements against decoded
consumer measurements, checks decoded phase frequency and peak amplitude against the manifest resync targets, checks
negative artifact handoff contract cases for entry point, audio, WAV path,
duplicate single-role artifact, and phase-report coverage mismatches, checks
negative phase-audio measurement contract cases for missing, mismatched, and
drifting producer values, checks negative parameter-resync contract cases for
missing, unchanged, invalid, and non-upward values, checks
expected error and forbidden path responses including encoded traversal, checks
that non-read methods are rejected by the read-only server, and verifies that
readable malformed manifest shapes still preserve source details for the browser
consumer. It also verifies local responses use no-store cache headers. It prints
grouped checkpoints so failures are easier to locate, including sub-checkpoints
for shell, static assets, manifest contracts, artifact reports, audio, and
server error responses.

## Boundaries

The local server is read-only. The browser may generate temporary audio from the
demo node graph, but it does not write patch/project state.

The browser node graph compiles signal/modulation wiring into a local execution
plan for Render Sample and Live Audio. The execution model is single-pass
stored-output:

- acyclic edges are evaluated as same-pass dependencies
- patch-node-order cycle-closing signal or modulation edges are allowed as state reads
- each node starts with stored output `0`
- each node overwrites its stored output when it runs
- disconnected modules remain in the editable patch but are omitted from the
  audio runtime plan until they become reachable from Output

Render Sample and Live Audio expose patch evidence for debugging:

- rendered samples store the patch fingerprint that produced them
- the execution debug panel reports whether the last render still matches the
  current patch
- Render Sample and Live Audio evidence include active graph counts for nodes,
  signal wires, modulation wires, feedback wires, and state reads
- Live Audio error evidence includes the blocking message so failures can be
  inspected without scraping the visible status text
- Live Audio plan and parameter acknowledgements show the current patch
  fingerprint in the plan status pill
- `window.soemdspSandboxDebug` exposes `compileExecutionPlan()`,
  `currentPatchFingerprint()`, `lastRender()`, and `live()` for direct
  inspection

That compiler is demo-scoped UI machinery, not a `soemdsp` runtime scheduler,
not a Circuit-owned executor, and not a production project format. Feedback
routing is intentionally simple stateful patch behavior, not algebraic loop
solving.

The sandbox does not:

- instantiate DSP objects
- schedule production `soemdsp` processing
- mutate Circuit
- persist project files server-side
- own audio engine behavior
- own plugin behavior
