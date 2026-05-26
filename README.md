# soemdsp-sandbox

Read-only local sandbox shell for inspecting `soemdsp` demo handoff manifests.

This first shell consumes the generated bound WAV resync artifact packet from the sibling `soemdsp` repository. It displays manifest status, source file metadata, producer proof flags, boundary flags, phase coverage, phase reports with time ranges, parameter resync values and change ratios, the inline artifact manifest and text reports, artifact coverage, metadata-only artifact-packet reachability, served artifact modified times, reachable artifact links, a read-only waveform with current-phase and sample-cursor feedback, follow/free view controls, and the generated WAV through a browser-native audio control.

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

## Boundaries

This shell is read-only.

It does not:

- instantiate DSP objects
- schedule processing
- mutate Circuit
- serialize project files
- own audio engine behavior
- own plugin behavior
