# soemdsp-sandbox

Read-only local sandbox shell for inspecting `soemdsp` demo handoff manifests.

This first shell consumes the generated bound WAV resync artifact packet from the sibling `soemdsp` repository. It displays manifest status, source file metadata, source error and detail fields, manifest HTTP status, browser-side manifest load time, manifest response cache headers, producer proof flags, boundary flags, phase coverage, phase reports with time ranges, parameter resync values and change ratios, the inline artifact manifest and text reports, artifact coverage including missing-path count, visible metadata-only artifact-packet reachability method, served artifact modified times, labeled reachable artifact links, non-clickable missing artifact paths, no-store local success and error responses, malformed manifest shape checks with source details, manifest error paths and roots, a read-only waveform with current-phase and sample-cursor feedback, follow/free view controls, and the generated WAV through a browser-native audio control.

It also applies the current read-only consumer checklist in the browser, so unsupported contract or ownership states are visible as warnings.

## Run

Generate the current artifact packet from `soemdsp` first:

```powershell
C:\Users\argit\Desktop\soemdsp\build\examples\Debug\runtime_dsp_object_bound_wav_resync_demo.exe
```

Start the sandbox:

```powershell
python C:\Users\argit\Desktop\soemdsp-sandbox\server.py
```

Open:

```text
http://127.0.0.1:8765
```

## Smoke Test

After generating the current `soemdsp` artifact packet, run:

```powershell
python C:\Users\argit\Desktop\soemdsp-sandbox\scripts\smoke_test.py
```

The smoke test starts isolated local servers on automatic temporary ports, checks
the manifest endpoint, checks the root shell and static assets, checks producer
proof flags, checks the handoff contract and boundary flags, checks handoff
artifact references, checks artifact and phase coverage, checks every manifest
artifact link for reachability, checks report documents, checks parameter resync
summary values, checks primary audio artifact reachability and WAV metadata,
checks expected error and forbidden path responses, and verifies local responses
use no-store cache headers. It prints grouped checkpoints so failures are easier
to locate.

## Boundaries

This shell is read-only.

It does not:

- instantiate DSP objects
- schedule processing
- mutate Circuit
- serialize project files
- own audio engine behavior
- own plugin behavior
