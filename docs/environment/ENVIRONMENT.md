# Environment

Inspected on 2026-10-03 before implementation.

| Item | Finding |
| --- | --- |
| OS | Windows 11 Home, version 10.0.26200, 64-bit |
| Machine | Lenovo 81WB, 4 logical processors, 11.8 GB RAM |
| Disk | About 404 GB free on C: |
| Node.js | 24.19.0, with built-in `node:sqlite` |
| npm | 11.17.0 |
| Python | 3.12.10, unused by this project |
| Git | 2.55.0.windows.3, credential helper `manager` |
| Git config | No global `.gitconfig`. This project does not create one |
| GitHub CLI | Not installed |
| Docker, Postgres client, Redis | Not installed |
| pnpm, yarn, Go, Rust, Java, .NET | Not installed |
| AI and payment secrets | No `OPENAI`, `ANTHROPIC`, `STRIPE`, or database URLs in the environment |
| GitHub account | `TwiztedFX` is authenticated for read. Creating `ai-native-service-platform` returned `403 Resource not accessible by personal access token` |
| Execution choice | Local. Cloud deploy was not chosen because there are no hosting credentials and the slice fits on this machine |

Do not install Docker or a database server for this version. Use Node's SQLite.
