# soemdsp-sandbox

Read-only local sandbox shell for inspecting `soemdsp` demo handoff manifests.

This first shell consumes the generated bound WAV resync artifact packet from the sibling `soemdsp` repository. It displays manifest status, source file metadata, source error and detail fields, manifest HTTP status, browser-side manifest load time, manifest response cache headers, producer proof flags, boundary flags, phase coverage, phase reports with explicit or derived time ranges, structured parameter resync values and change ratios, live current-phase frequency/amplitude readouts, a phase-aligned parameter timeline, decoded per-phase audio stats, the inline artifact manifest and text reports, artifact coverage including missing-path count, visible metadata-only artifact-packet reachability method, served artifact modified times, labeled reachable artifact links, non-clickable missing artifact paths, no-store local success and error responses, malformed manifest shape checks with sandbox handoff and positive detailed WAV metadata requirements, source details, manifest error paths and roots, a waveform with current-phase, sample-cursor, byte metadata, peak, RMS, min/max, DC offset feedback, a decoded level envelope with peak/RMS summary, an X/Y signal plot with header summaries, resettable browser-local inspection preferences, selectable phase focus, trace/points mode, display scale, full/cursor window size, focused stats, lag, and current point readout derived from the decoded WAV, explicit follow/free view controls, browser-backed seekable audio, and the generated WAV through a browser-native audio control.

It also applies the current read-only consumer checklist in the browser, so unsupported contract or ownership states are visible as warnings.

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
audio/waveform control attributes, checks static assets, checks the waveform
seek source contract, checks producer proof flags, checks the handoff contract and boundary flags, checks handoff artifact
references, checks artifact and phase coverage, checks every manifest artifact
link for reachability, checks report documents, checks parameter resync summary
values, checks primary audio artifact reachability, WAV metadata, and byte-range
audio responses, checks
expected error and forbidden path responses including encoded traversal, checks
that non-read methods are rejected by the read-only server, and verifies that
readable malformed manifest shapes still preserve source details for the browser
consumer. It also verifies local responses use no-store cache headers. It prints
grouped checkpoints so failures are easier to locate, including sub-checkpoints
for shell, static assets, manifest contracts, artifact reports, audio, and
server error responses.

## Boundaries

This shell is read-only.

It does not:

- instantiate DSP objects
- schedule processing
- mutate Circuit
- serialize project files
- own audio engine behavior
- own plugin behavior
