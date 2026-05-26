# soemdsp-sandbox

Read-only local sandbox shell for inspecting `soemdsp` demo handoff manifests.

This first shell consumes the generated bound WAV resync artifact packet from the sibling `soemdsp` repository. It displays manifest status, boundary flags, phase reports, artifact links, and the generated WAV through a browser-native audio control.

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
