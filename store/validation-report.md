# Microsoft Store package validation

Validated **2026-10-08**, Windows 11 x64, OS build **10.0.26340**.

| Check | Result |
| --- | --- |
| Release frontend and Tauri build | PASS |
| Windows SDK MakeAppx schema validation and packaging | PASS |
| MakeAppx unpack of the generated MSIX | PASS |
| Store identity / publisher / publisher display name | PASS: exact user-provided Partner Center values |
| Registered package family | PASS: `NornsInteractive.realisticminesweeper_r7cz9kdzz55d0` |
| Native game and runtime architecture | PASS: x64 PE binaries |
| Microsoft WebView2 signature | PASS: Valid Microsoft Corporation Authenticode signature |
| Package ZIP integrity and all SHA-256 block hashes | PASS: 273 package entries |
| Local registered package launch | PASS: game window created; WebView2 processes use the bundled runtime directory |
| Windows App Certification Kit | **PASS**, full run (`PARTIAL_RUN=FALSE`) |
| Game unit tests | PASS: 9 |
| Browser gameplay / layout / settings / scores / WebGPU tests | PASS: 14 |
| Localized listing field and image limits | PASS: zh-CN, ja-JP, en-US; 12 screenshots and 7 promotional PNGs |
| Git whitespace validation | PASS |

## Certified test artifact

Package: `realistic-minesweeper-1.0.0.0-x64.msix`  
Package version: **1.0.0.0**; source game version: **0.1.7**  
Size: **351,898,593 bytes** (approximately **335.60 MiB**)  
SHA-256: `8F0D3116EDECD945B5A7931DF6C2F5F0B6FAF3FF6849C3248DFE86438DF6167B`  
Bundled runtime: **Microsoft WebView2 Fixed Version 154.0.4258.62 x64**  
WACK version: **10.0.26100.8249**  
WACK result: **OVERALL_RESULT=PASS**, **PARTIAL_RUN=FALSE**  
Report generated: **2026-10-08 11:53:27 +08:00**.

The delivery includes `certification/wack-report.xml` and `certification/wack-report.htm`. The XML contains this product's package identity. The complete test was run elevated in the normal interactive account, against the final build-2 package layout. The EXE and full runtime in that layout are the same files packed in this MSIX; its block hashes were verified independently.

## Scope

The signed-in user's normal Windows token runs the game. `runFullTrust` is declared for the Win32/Tauri executable, not administrator elevation. No driver, service or custom installer is packaged. Native imports of the game executable require Windows system DLLs rather than a separate VC++ redistributable installer. The full official WebView2 runtime, existing third-party notices and asset credits are included.

The MSIX is an **unsigned Microsoft Store upload artifact**. Microsoft Store signs it after its own certification. A local WACK PASS does not mean Microsoft has approved or published the Store product. The publisher must complete Partner Center pricing/markets, IARC and the actual submission.

Only Windows PC **x64** is packaged. This validation does not claim physical testing on Windows 10, ARM64, Xbox, low-end hardware or every sensor-equipped device. Tilt is optional and only supported where a compatible orientation sensor is exposed. The app UI is Simplified Chinese/English; Japanese is Store metadata and artwork only.

The fixed runtime is deliberately included for installation without an extra runtime download. It must be refreshed in future app releases for security servicing. This accounts for most of the package size.
