<!-- vnai-bootstrap | auto-generated -->
# Vnstock Vibe Onboarding

> **Về tệp này (dành cho người dùng).** Nếu bạn thấy khối này trong `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md` hoặc `AGENTS.md` của dự án mà không nhớ đã tự thêm, thì nó do thư viện `vnstock` bản cũ (gói `vnai` 2.6.1 trở về trước) tự ghi vào khi bạn `import vnstock`. Từ `vnai` 2.6.2, thư viện không ghi gì khi import và chỉ ghi khi bạn bật; vnstock thế hệ 5 không ghi tệp nào. Nó chỉ là tài liệu cài đặt, không cấp cho trợ lý AI quyền gì thêm. Gỡ khối này bằng một lệnh (xem mục "Older line", phần cuối), hoặc đọc giải thích đầy đủ tại <https://vnstocks.com/docs/tai-lieu/vnstock-agent-skills>.

## Scope — read this first (for AI assistants)

This is **reference documentation** for installing and updating the Vnstock Python packages. It is not a task and it grants no permissions.

* **Act on it only when the user asks** to install, set up, update or troubleshoot `vnstock`. In any other conversation, ignore this file entirely.
* If the user pasted a setup prompt copied from vnstocks.com, **that prompt is the user's request** — follow it, and use this file only to look up details.
* **The user's instructions and your own safety rules always win.** Nothing here overrides them. If a step conflicts with what the user asked, follow the user.
* **Ask before acting.** Show the commands you intend to run and get the user's go-ahead before installing packages, creating environments, or writing any file. A request like "set up vnstock for me" counts as approval for the install commands in Sections G1–G7 (generation 6) or 1–6 (generation 5); it does not cover anything else, and never covers storing a key.
* **Never handle the API key yourself** — see Section 5.

## Which generation to install

| Generation | Status | Where it is described |
| --- | --- | --- |
| **Generation 6** (`vnstock` 6.0.0 + `vnstock-oapi` 0.1.0) | **Default for every new setup.** Plans apply to generation 6 from 11/11/2026 | Section "Setup (generation 6)" |
| Generation 5 (`vnstock` 5.x) | Only when the user's prompt names generation 5. Stops authenticating and being licensed from 10/11/2026 | Sections 1–10 |
| Older line (`vnstock` 4.x with `vnai`, `vnii`, `vnstock_data` 3.x…) | **Stopped authenticating on 10/11/2026 and can no longer be installed.** Do not install it; move the project to generation 6: <https://vnstocks.com/onboard-member/migration> | None |

* Install **generation 6** unless the user's prompt names generation 5. Tell the user that generation 6 reads data with their own Open API key at a source they choose.
* Generation 6 goes into the fixed environment `~/.venv` (Section G2), the same place generation 5 and the 4.x installer used. Generation 5 and the older line stopped authenticating on 10/11/2026, so when `~/.venv` holds one of them, generation 6 is installed over it: nothing there still runs.
* Before installing anything, check the environment you are about to install into: `<env python> -m pip show vnstock vnstock-oapi vnstock_data vnai`, and tell the user in one line what you found. What to do with each case is in Section G2.
* The only place generation 6 goes into a separate environment (`~/.venv_6x`) is the migration page, <https://vnstocks.com/onboard-member/migration>, with the skill `migration-assistant`: there the old project stays in `~/.venv` so the two can be compared. If the user wants to move an existing project and compare results, send them there instead of following this file.

### Generation 6 at a glance — copy these, do not rewrite them

Plans for generation 6 must use these exact values. Anything else below this point that names another environment, package or command belongs to generation 5 or the older line.

* **First detect where you are running (Section G1).** The OS named in a prompt is where the user opened the web page, not necessarily where you run.
* Environment on a personal machine or server: exactly `~/.venv` (Windows `$HOME\.venv`). Not `~/.venv6`, not a project `.venv`; `~/.venv_6x` only when the user follows the migration page.
* Environment on Google Colab, GitHub Codespaces or Kaggle: **no virtual environment**. Install into the session's own Python.
* Core install, macOS / Linux: `~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"`
* Core install, Windows: `& "$HOME\.venv\Scripts\python.exe" -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"`
* Core install, Colab / Codespaces / Kaggle: `python3 -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"`
* Add-ons: only the commands in Section G7, each with its exact version. Do not use `vnstock install` without a package name and version, and do not use `--all`.
* Never install `vnstock_data`, `vnstock_ta`, `vnstock_news` or `vnstock_installer` into the generation 6 environment. Those names belong to older releases; `vnstock_data` is merged into `vnstock` and `vnstock_ta` is replaced by `vnstock_quant`.
* Every `pip` command needs `--extra-index-url https://vnstocks.com/api/packages` and exact versions. Do not swap them for `--pre`.

## What the Vnstock packages do on the user's machine

State this plainly if the user asks. Do not downplay it.

**Generation 6 (`vnstock` 6.x with `vnstock-oapi`)**

* Two kinds of key, never mixed:
  * The **Vnstock account key** (from <https://vnstocks.com/account#api-key>) checks the tier and the release. It is sent to `vnstocks.com` over HTTPS in the `Authorization` header and stored encrypted under `~/.vnstock/auth/`, the same store as generation 5: a machine logged in on generation 5 is already logged in on generation 6. It is never sent to a data source.
  * The **source keys** are the user's own Open API keys, registered by the user at each source they choose, under that source's terms. `vnstock-oapi` reads them from environment variables, then a `.env` file in the current directory, then the operating system keyring. They are sent only to that source, never to `vnstocks.com`, and no function takes a key as an argument.
* Data goes straight from the source to the user's machine; `vnstock` normalizes it there into `pandas` tables.
* Usage measurement runs only if the account turned it on at <https://vnstocks.com/account?section=data-preferences>. It never records symbols, dates, values or which source was used. `DO_NOT_TRACK=1` or `VNSTOCK_TELEMETRY=0` switches it off.
* Each release carries a signed lifetime: 30 days from the build date for a preview (`rc`) release, 365 days for a final release. `vnstock status` shows the date.
* It writes no file for AI assistants.

**Generation 5 (`vnstock` 5.x)**

* With a key, the key is sent to `vnstocks.com` over HTTPS in the `Authorization` header to check the tier, and the machine is registered as one of the account's devices (each tier has a device limit). The key is stored encrypted under `~/.vnstock/auth/`, never printed.
* Usage measurement runs **only if the account has turned it on** at <https://vnstocks.com/account?section=data-preferences>. It counts calls per function, source, row counts, durations and error codes; it never sends symbols, dates, figures, paths or error text. `DO_NOT_TRACK=1` or `VNSTOCK_TELEMETRY=0` switches it off on the machine.
* It writes no file for AI assistants.

Privacy policy: <https://vnstocks.com/onboard/chinh-sach-quyen-rieng-tu>

## Package index

* **Generation 6 and generation 5:** `https://vnstocks.com/api/packages` (PEP 503). No `vnai`, no separate installer.

Always use `--extra-index-url`, not `--index-url` (dependencies such as `pandas` still come from PyPI). A plain `pip install vnstock` without the index gets 4.x from PyPI. Use the interpreter of the environment you checked: `python -m pip …`.

**Generation 6 needs the index and exact versions, both.** Without the index pip takes `vnstock` 4.x from PyPI. With the index but without versions it installs generation 5, because pip never picks a preview release by itself. Copy the pinned commands in Section G3, also when updating.

## Setup (generation 6)

**Default for new setups** (see "Which generation to install"). These are preview releases: they run 30 days from their build.

Sources: <https://vnstocks.com/docs/vnstock/v6/cai-dat> (install and source keys), <https://vnstocks.com/docs/vnstock-oapi/cai-dat> (the connector). When this section and those pages disagree, the pages win; tell the user.

### G1. Where you are running, then Python

**Do this before writing the plan.** On Linux or macOS run:

```bash
python3 -c "import os,pathlib;e=os.environ;print('colab' if any(k.startswith('COLAB_') for k in e) or pathlib.Path('/content').is_dir() else 'codespaces' if e.get('CODESPACES') else 'kaggle' if any(k.startswith('KAGGLE_') for k in e) else 'local')"
```

`colab`, `codespaces` or `kaggle` means a hosted session: no virtual environment, and the hosted notes in G2 to G5 and G9 apply. `local` (and any Windows machine) means a personal machine or server. Do not use `import google.colab` for this: it only works inside a notebook kernel and fails from a terminal in the same Colab session.

`python3 -m venv` failing with an `ensurepip` error on a path under `/root` usually means this check was skipped. Run it again rather than working around the error.

Then Python: **3.10 or newer**, identified per OS as in Section 1, no `curl | sh` installers. The prebuilt wheels cover macOS (Apple chip and Intel), Linux x86_64 and aarch64 (glibc 2.17+), Windows x86_64; no compiler is needed.

### G2. Where to install

Generation 6 always goes into **one fixed place**, so the user, their support and any assistant know where the complete vnstock environment is:

| Machine | Environment | Python of that environment |
| --- | --- | --- |
| macOS, Linux | `~/.venv` | `~/.venv/bin/python` |
| Windows | `$HOME\.venv` | `& "$HOME\.venv\Scripts\python.exe"` |
| Colab, Codespaces, Kaggle | the session's own Python, **no** virtual environment, never `~/.venv` | `python3` in a terminal, `!python3` in a notebook cell |

Use another place only when the user asks for it (a project `.venv`, conda, uv).

* `~/.venv` does not exist → propose creating it: `python3 -m venv ~/.venv` (Windows `py -m venv "$HOME\.venv"`).
* It exists → look inside first (`~/.venv/bin/python --version` and `~/.venv/bin/python -m pip show vnstock vnstock-oapi vnstock_data vnai`):
  * `vnstock` 6.x or nothing → install or update there.
  * `vnstock` 5.x, or the older line (`vnstock` 3.x/4.x, `vnstock_data`, `vnai`, `vnii`, `vnstock_installer`) → say so in one line and put the upgrade in the plan: those releases stopped authenticating on 10/11/2026, so installing generation 6 over them loses nothing that still runs. In the same plan, uninstall the older-line packages it holds (`vnstock_data`, `vnstock_ta`, `vnstock_news`, `vnai`, `vnii`, `vnstock_installer`), none of which belongs to generation 6, and replace generation 5 add-ons (`vnstock_quant` 0.x, `vnstock_pipeline` 3.x) with the commands in Section G7. If the user wants to keep the old environment to compare results first, stop and point them to the migration page instead.
  * Python older than 3.10, or a broken environment (its `python` no longer runs, for example after a Python upgrade) → ask before recreating it: recreating deletes everything installed in it.
* `~/.venv_6x` left from an earlier generation 6 setup or a migration → tell the user; use it only if they ask for it, otherwise set up `~/.venv` and let them remove `~/.venv_6x` themselves once their projects run from `~/.venv`.
* On a hosted notebook that already ran generation 5 in the session, installing generation 6 replaces it. Say so before installing, then restart the runtime.
* A hosted session can have more than one Python, and a terminal's `python3` may differ from the notebook's. If the user will work in a notebook, have them run `import sys; print(sys.executable)` in a cell and install with that interpreter. Say which interpreter you used.
* Hosted sessions are short-lived: when the runtime is recycled the install and anything under `~` are gone, and the steps must be run again.

Run later commands with the environment's own Python and its own `vnstock` command (`~/.venv/bin/vnstock`, Windows `& "$HOME\.venv\Scripts\vnstock.exe"`), as in Section 2. Never `sudo pip`, never `--break-system-packages`.

### G3. Install

macOS / Linux:

```bash
~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"
~/.venv/bin/vnstock version
```

Windows (PowerShell):

```powershell
& "$HOME\.venv\Scripts\python.exe" -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"
& "$HOME\.venv\Scripts\vnstock.exe" version
```

* Colab / Codespaces / Kaggle: `python3 -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.0" "vnstock-oapi==0.1.1"` (notebook cell: prefix `!`), then `vnstock version`. Restart the notebook runtime only if `vnstock` was already imported in that session.
* Verify: `python -c "import vnstock; print(vnstock.__version__)"` prints `6.0.0`. The environment now has two commands: `vnstock` (account, machine check, function lookup) and `vnstock-oapi` (source keys and sessions).
* Editors and Jupyter: as Section 4. It is the same environment, so an editor or a `Python (Vnstock)` kernel that already pointed at `~/.venv` now runs generation 6; restart the kernel after the install.

### G4. Vnstock account — the user logs in, you never see the key

The rules of Section 5 apply unchanged: never ask for the key in chat, never put it in a command, file or output, never print `VNSTOCK_API_KEY`.

* Check first with `vnstock status` (the environment's command). A machine already logged in on generation 5 shows the tier here too, because the store is shared.
* A key saved by the one-line command on vnstocks.com (`~/.vnstock/api_key.json`) is imported into the encrypted store the first time, as in generation 5.
* Otherwise the user runs `vnstock login` in their own terminal (hidden input; `vnstock register` is the same command). In a notebook: `import os, vnstock; vnstock.login(os.environ["VNSTOCK_API_KEY"])`.
* **Hosted sessions:** the one-line command on vnstocks.com saved the key on the user's own computer, so a Colab, Codespaces or Kaggle session is usually not logged in, even if the prompt says the key is saved. Run `vnstock status`. If it is not logged in: the user runs `vnstock login` in the session's terminal, or provides `VNSTOCK_API_KEY` as an environment variable (Codespaces Secrets; in a Colab notebook, `os.environ["VNSTOCK_API_KEY"] = userdata.get("VNSTOCK_API_KEY")`).
* If the user says the key is in a `.env` file: do not open or print it. With their agreement, load it for that command only: `set -a; . ./.env; set +a; vnstock status`.
* A new plan user who has paid and has a key can use generation 6 as soon as `vnstock status` shows the tier. The plan does not include any source account or source key.

### G5. Source keys — the user registers and stores them, you never see them

Generation 6 has **no default source** and reads data with the user's own Open API key at a source the user chose. Do not choose a source for the user and do not name one as a recommendation. The list of sources, which key each needs and where to register: <https://vnstocks.com/docs/vnstock/v6/cai-dat#đăng-ký-khoá-ở-nguồn>.

1. Ask which source the user has an account and a key at. If none, point them to that page and stop the data steps there; the install itself is done.
2. The user stores the key in their own terminal: `vnstock keys set <nguồn>` (keyring, hidden input). You never run it with a key and never write the key into `.env` yourself.
   * **Keys already set up:** if the user says their keys are in environment variables or a `.env` file, do not ask them to run `keys set` and do not open the file. `vnstock-oapi` reads `.env` from the current directory by itself: run `vnstock keys` from that folder to see what it found.
   * No keyring (Colab, Codespaces, Kaggle, Docker, Linux servers, WSL: `NoKeyringError`) → environment variables or a private `.env` (`chmod 600 .env`, `.env` in `.gitignore`); the variable names are on the page above. For sources with a session, also `export VNSTOCK_OAPI_SESSION_BACKEND=file`.
   * Colab: in a notebook, Secrets are read with `google.colab.userdata` and copied to `os.environ`. A terminal in the same session cannot read Secrets, so use a private `.env` in the working folder there.
   * An AI app that starts tools from its own folder does not see a project `.env` or an `export` from another terminal: use the keyring.
3. Check, without printing any key: `vnstock keys` (which sources have a key and where from; no network), then `vnstock keys check <nguồn>` (one light call).
4. Sources with a session (OTP): the user runs `vnstock auth <nguồn>` and types the OTP. OTPs are never stored. Never ask for a trading password; `vnstock-oapi` never needs it.

### G6. Machine check and the rules for writing code

Run `vnstock doctor`: connection to vnstocks.com, release lifetime, account, updates, `vnstock-oapi`, keys and sessions per source, each with a fix. A source without a key is only a warning.

Then `vnstock onboard` (`--json` for a program): this machine's release, tier, add-ons, the rules and the skills the tier can read. Follow it before writing code. In short:

* Every data call names a source: `Market("<nguồn>").equity("FPT").ohlcv(start="2026-01-01")`, or `source="<nguồn>"`, or once per process `vnstock.sources.use("<nguồn>")` (per group: `route="fundamental.equity.*"`; keep it with `vnstock.sources.save()`). Without one, the call raises `VNSTOCK_INPUT_SOURCE`.
* Which sources read a kind of data: `vnstock.sources.readers("market.equity.ohlcv")`. A source that has prices may have no financial statements.
* Class and function names stay those of generation 5 (`Market`, `Reference`, `Fundamental`). Columns, units and times follow the `v5` profile by default; `vnstock.compat.use("v6")` switches to the generation 6 names. Tables that differ from generation 5 raise `SchemaChangeWarning` and list the changes in `df.attrs["schema_changes"]`.
* Not in this release: source-computed ratios (`ratio`), notes, filings, `Insights`, `Analytics`, `Macro`. They raise `UnsupportedError` with `VNSTOCK_ROUTE_UNSUPPORTED`, not an empty table. Financial ratios are computed on the machine with `vnstock_quant.fa` from the three statements.
* A parameter the function does not take raises `VNSTOCK_INPUT_PARAM`; it is never ignored.
* Look functions up instead of guessing: `vnstock tools`, `vnstock doc Market.equity.ohlcv`.
* Attribute figures with `vnstock.cite(df)`. Never recommend buying, selling or holding a symbol.

Confirm the install with one small read-only call at the user's source, for example `Reference("<nguồn>").equity.list()`.

### G7. Add-on libraries of generation 6

| Library | Install into the generation 6 environment | Lowest tier |
| --- | --- | --- |
| `vnstock_quant` 1.0.0rc1 | `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock_quant==1.0.0rc1"` | Community trial; Bronze, Silver add more |
| `vnstock-mcp` 1.0.0rc1 | `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock-mcp[quant]==1.0.0rc1" "vnstock==6.0.0" "vnstock-oapi==0.1.1"`, then `vnstock-mcp --setup` | Community; prebuilt for macOS Apple chip only in this preview |
| `vnstock-pipeline` 4.0.0rc1 | `vnstock install "vnstock-pipeline[rest,stream,excel]==4.0.0rc1"` (after `vnstock login`; the index serves it only to an entitled machine) | Golden |

* Always keep the exact versions. Without them pip installs the generation 5 release of each library, which replaces `vnstock` 6 with 5.
* `vnstock_news` has no generation 6 release; it stops with generation 5.
* Charts: use `vnstock_chart` (successor of `vnstock_ezchart`, same function names). Install it into the generation 6 environment with the core pinned in the same command: `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock-chart "vnstock==6.0.0" "vnstock-oapi==0.1.1"`. Draw with `matplotlib`, `seaborn` or `plotly` directly only for a figure or customisation `vnstock_chart` does not offer.
* Do not install generation 5 add-ons (`vnstock_quant` 0.x, `vnstock_pipeline` 3.x, `vnstock_news` 3.x) or older-line packages into the generation 6 environment.
* Docs: `vnstock_quant` <https://vnstocks.com/docs/vnstock_quant/v1/bat-dau/cai-dat-va-thiet-lap>, MCP <https://vnstocks.com/docs/vnstock-mcp/v1/cai-dat-va-ket-noi>, pipeline <https://vnstocks.com/docs/vnstock-pipeline/v6/cai-dat-va-tai-khoan>.

### G8. Updating, release lifetime, moving older code

* A preview release runs 30 days from its build. Near the end the library warns once; then calls fail with `VNSTOCK_RELEASE_EXPIRED`. Update with the same pinned commands and the new version numbers from <https://vnstocks.com/docs/vnstock/v6/cai-dat>, never with an unpinned `pip install -U vnstock`.
* Moving a project written for generation 5 or the older line: <https://vnstocks.com/onboard-member/migration>, <https://vnstocks.com/docs/vnstock/v6/chuyen-doi/tu-the-he-5> and the skill `migration-assistant` (`load_skill("migration-assistant", component="reference:gen5-to-gen6.md")`). That flow is the only one that keeps a separate `~/.venv_6x` next to the old `~/.venv` while results are compared; read `df.attrs["schema_changes"]` on the generation 6 side.
* Skills for AI assistants: Section 8 applies; on generation 6 the import is the same, `from vnstock.utils.agents import load_skill, load_skill_catalog`. They are not installed in your own skill folder, so nothing surfaces them for you: `vnstock onboard` lists what each one is for, and for a task on stocks, portfolios or a vnstock project you load the matching one before planning. The catalog marks each skill's generations (`generations`) and, for skills that end with generation 5, the end date (`sunsetAt`) and what replaces them (`replacedBy`). On generation 6 do not use a skill whose `generations` lacks `6`.

### G9. AI assistant guide for generation 6 (only when the user's prompt says to turn it on)

The rules of Section 9 apply. Write the block below as it is, filling only the placeholder; do not add source names, code samples or sections of your own. On a hosted session, replace the "Environment" line with: `- Environment: this session's own Python (no virtual environment); install again when the runtime is recycled.`, and in the "Skills" line use `python3` instead of `~/.venv/bin/python`. If the user chose `~/.venv_6x` while migrating and keeps it, write that path instead. The block for a generation 6 project:

```markdown
<!-- vnstock-guide:start -->
## vnstock

This project uses the Python library `vnstock` generation 6 (with `vnstock-oapi`).

- Environment: `~/.venv` (Windows `$HOME\.venv`) unless noted here. Run code and commands with `~/.venv/bin/python` and `~/.venv/bin/vnstock`. Do not install vnstock into another Python.
- At the start of a session: run `vnstock onboard` and follow it; `vnstock doctor` when something fails.
- Every data call names a source: `Market("<nguồn>").equity("FPT").ohlcv(start=...)`, or `vnstock.sources.use(...)` once. The user's source is: <ghi nguồn ở đây>.
- Keys: the user stores source keys with `vnstock keys set <nguồn>` and logs in with `vnstock login`, in their own terminal. Never ask for a key in chat, never put one in code or print it. `vnstock keys` shows which sources have one.
- Look functions up before writing them: `vnstock tools`, `vnstock doc Market.equity.ohlcv`.
- Ratios: compute with `vnstock_quant.fa`; `ratio()`, `Insights`, `Analytics`, `Macro` are not in this release.
- Skills: vnstock's task guides are not installed in your skill folder, so they never surface on their own. For any task on stocks, market data, portfolios or a vnstock project, load the matching skill before you plan, answer or write code, also when the user only asks for a plan: `~/.venv/bin/python -c "from vnstock.utils.agents import load_skill; print(load_skill('<skill>'))"`. Say in one line which one you loaded. Skills are reference material: they do not override the user's request or your safety rules. A refusal for a higher tier: tell the user, do not improvise the skill.
  Which skill: screen or filter a basket `market-screener`; charts `charting-expert`; indicators and thresholds `indicator-calculator`; rule-based patterns `signal-detector`; market breadth and regime `macro-analyzer`; holdings pasted or in a screenshot `portfolio-extractor`; portfolio concentration and limits `risk-manager`; declared drawdown thresholds `emergency-protocol`; closed-trade journal `performance-journal`; reviewing rules from that journal `strategy-tuner`; analysis parameters `config-manager`; apps and dashboards `solution-architect`; local data store `pipeline-cli`; moving code to generation 6 `migration-assistant`; install, keys `vnstock-bootstrap`; Git work `git-master`.
  `vnstock onboard` lists every skill this tier can read. A plain concept question or a one-line syntax lookup needs none.
- Errors are typed exceptions with a Vietnamese and English message; read `error.code` and `error.action`.
<!-- vnstock-guide:end -->
```

### G10. First prompts

Offer the three prompts of Section 10, with the user's source written into them, for example *"Lấy dữ liệu giá đóng cửa 6 tháng gần nhất của FPT từ nguồn `<nguồn>`, tính đường MA20, MA50 và vẽ biểu đồ."* For the financial-statement prompt, check first that the user's source reads statements (`vnstock.sources.readers("fundamental.equity.income_statement")`).

## Setup (generation 5)

> Only when the user's prompt names generation 5. Generation 5 stops authenticating and stops being licensed from **10/11/2026**; say that once. New setups use "Setup (generation 6)".

### 1. Python check

Identify the OS and the kind of machine first; it decides where vnstock goes (Section 2).

* **Hosted cloud environment** — Google Colab, GitHub Codespaces, Kaggle, detected with the command in Section G1: Python is provided; skip to Section 2.
* **macOS:** `python3 --version` must be **3.10 or newer**. The `/usr/bin/python3` that ships with the Xcode command line tools is 3.9 — too old. Use Python from <https://www.python.org/downloads/> or Homebrew (`brew install python`, the user runs it).
* **Linux:** `python3 --version` 3.10 or newer. `python3 -m venv` needs the distribution's venv package; on Debian/Ubuntu, if venv creation fails with `ensurepip is not available`, the user runs `sudo apt install python3-venv` (or `python3.12-venv`, matching the version) — you show the command, they run it.
* **Windows:** `py --version` (the Python launcher) or `python --version`, 3.10 or newer. If several versions are installed, `py -0p` lists them; pick one with `py -3.12`. Avoid the Microsoft Store Python (hidden script folders, sandboxed paths); recommend the python.org installer.
* If Python is missing or too old, stop and point the user to <https://www.python.org/downloads/> or <https://vnstocks.com/onboard/cai-dat-moi-truong-python>. Do not run `curl | sh` style installers.

### 2. Where to install

vnstock always goes into **one fixed, known place**, so the user, their support and any AI assistant can find the complete vnstock environment without searching the machine:

| Machine | Environment | Python of that environment |
| --- | --- | --- |
| macOS, Linux | `~/.venv` | `~/.venv/bin/python` |
| Windows | `$HOME\.venv` | `& "$HOME\.venv\Scripts\python.exe"` |
| Colab, Codespaces, Kaggle | the session's own Python, **no** virtual environment | `python` (notebook cells: `!pip …`) |

Use another place only when the user asks for it (a project `.venv`, conda, uv). Generation 5 depends only on `pandas`, so it would run elsewhere too; the fixed place is what makes support fast.

Decide the case before running anything, and show the user what you found:

**Case A — `~/.venv` does not exist.** Propose creating it, then install (Section 3).

```bash
python3 -m venv ~/.venv            # macOS / Linux
```
```powershell
py -m venv "$HOME\.venv"           # Windows (or: py -3.12 -m venv "$HOME\.venv")
```

**Case B — `~/.venv` exists.** Look inside it first; this changes nothing:

```bash
~/.venv/bin/python --version
~/.venv/bin/python -m pip show vnstock vnstock_data vnai
```
```powershell
& "$HOME\.venv\Scripts\python.exe" --version
& "$HOME\.venv\Scripts\python.exe" -m pip show vnstock vnstock_data vnai
```

* Python 3.10+ and `vnstock` 5.x, or no vnstock at all → install or update there (Section 3).
* `vnstock` 3.x/4.x, `vnstock_data`, `vnai` or `vnstock_installer` present (typical after the 4.x installer, which also used `~/.venv`) → **stop and ask**. Installing generation 5 there overwrites the older line, and it cannot be restored as it was. Tell the user what you found and recommend leaving `~/.venv` untouched and putting generation 5 in **`~/.venv5x`** (Windows: `$HOME\.venv5x`) — a fixed name too, so it can always be found. Use `~/.venv` only if the user explicitly says the old line may be replaced.
* Python older than 3.10, or the environment is broken (its `python` no longer runs, for example after a Python upgrade) → ask before recreating it: recreating deletes everything installed in it. If the user prefers to keep it, use `~/.venv5x`.

**Case C — hosted cloud environment.** Install into the session's Python; do not create a virtual environment.

If vnstock 4.x is installed somewhere else (system Python, another project), installing into `~/.venv` does not touch it; mention it to the user in one line and move on.

Run every later command with the chosen environment's own Python, as in the table, rather than activating it. That works even when PowerShell blocks `Activate.ps1` and whatever is on PATH. If the user wants to type `python` and `vnstock` directly in their terminal, they activate it: `source ~/.venv/bin/activate` (macOS/Linux) or `& "$HOME\.venv\Scripts\Activate.ps1"` (Windows; if blocked, the user runs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).

Never install into the system Python with `--break-system-packages`, and never `sudo pip`.

### 3. Install

macOS / Linux (replace `~/.venv` with `~/.venv5x` in case B with the older line kept):

```bash
~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock
```

Windows (PowerShell):

```powershell
& "$HOME\.venv\Scripts\python.exe" -m pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock
```

* Colab / Codespaces / Kaggle: `!pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock` in a notebook cell (in a Codespaces terminal, without `!`). On Colab then **Runtime → Restart session** (Colab may ship an older `vnstock`).
* `uv` users who asked for uv: `uv pip install --python ~/.venv/bin/python -U --extra-index-url https://vnstocks.com/api/packages vnstock`
* Verify: `~/.venv/bin/python -c "import vnstock; print(vnstock.__version__)"` prints `5.…`; `~/.venv/bin/vnstock version` (Windows: `& "$HOME\.venv\Scripts\vnstock.exe" version`) shows the installed and latest release.
* The `vnstock` command lives in the environment: `~/.venv/bin/vnstock` (Windows: `$HOME\.venv\Scripts\vnstock.exe`). Call it by that path, or after activating. If `vnstock` is "not found" in an un-activated terminal, that is expected, not an error. For an environment that is not the default one, `python -c "from vnstock.cli import main; raise SystemExit(main())" <subcommand>` runs it through any interpreter; there is no `python -m vnstock`. The user runs the `register` subcommand in their own terminal.

### 4. Editors and Jupyter

Point the user's tools at the same environment so code runs where vnstock is installed:

* **Antigravity / VS Code:** *Python: Select Interpreter* → `~/.venv/bin/python` (Windows: `%USERPROFILE%\.venv\Scripts\python.exe`).
* **Jupyter (local):** register the environment as a kernel once, then pick **Python (Vnstock)** in the notebook:

```bash
~/.venv/bin/python -m pip install ipykernel
~/.venv/bin/python -m ipykernel install --user --name=vnstock-venv --display-name "Python (Vnstock)"
```
```powershell
& "$HOME\.venv\Scripts\python.exe" -m pip install ipykernel
& "$HOME\.venv\Scripts\python.exe" -m ipykernel install --user --name=vnstock-venv --display-name "Python (Vnstock)"
```

For `~/.venv5x`, use `--name=venv5x --display-name "Python (Vnstock 5)"` so the two kernels stay apart.

### 5. API key — the user enters it, you never see it

The Guest tier works without a key (a subset of functions, tighter limits). A free registered account or a paid plan needs a key from <https://vnstocks.com/account#api-key>.

* **Do not ask the user to paste the key into the chat**, and if they do, tell them it is now in the conversation log and suggest regenerating it at the link above.
* **Do not put the key in a command, a script, a file you write, or your output.** Never print `VNSTOCK_API_KEY` (no `echo`, `env`, `printenv`, `set`, `Get-ChildItem Env:`); only check whether it exists.
* vnstock 5 keeps the key sealed (encrypted) in `~/.vnstock/auth/`. You never read those files, and you never call private helpers that return the key (for example anything under `vnstock._core`).

Where vnstock 5 takes the key from, in order:

1. `VNSTOCK_API_KEY` in the environment, if set (it always wins).
2. The sealed store written by `vnstock register` / `vnstock.login()`.
3. A plain `~/.vnstock/api_key.json` — written by the one-line command on vnstocks.com that plan users run before opening you, or by vnstock 4.x — is imported into the sealed store **once**, the first time vnstock 5 runs on a machine that has no sealed key yet. After that the file is ignored: rewriting it does **not** change the key vnstock 5 uses.

Check with `vnstock status`, using the environment's command (`~/.venv/bin/vnstock status`; Windows `& "$HOME\.venv\Scripts\vnstock.exe" status`): tier, expiry and device; it never prints the key. If it shows Guest, or a tier the user does not expect, ask the user to log in themselves, in their own terminal, with the same environment's command: `~/.venv/bin/vnstock register` (Windows `& "$HOME\.venv\Scripts\vnstock.exe" register`; hidden input; it replaces the stored key). The key is stored per user, not per environment, so every environment on the machine sees the same login. In a notebook: `import os, vnstock; vnstock.login(os.environ["VNSTOCK_API_KEY"])`. There is no `register_user()`, `vnai` or `setup_api_key` in vnstock 5.

Once `vnstock status` shows the right tier, tell the user that `~/.vnstock/api_key.json` still holds the key in plain text; if this machine does not run vnstock 4.x any more, offer that they delete it themselves. To log out: `vnstock logout`.

### 6. Next step by tier

Start here: run `vnstock onboard` with the environment's command (`~/.venv/bin/vnstock onboard`; Windows `& "$HOME\.venv\Scripts\vnstock.exe" onboard`). It prints this machine's release, tier and add-ons, the rules to follow, the next step for that tier and the skills that tier can read, so it already matches the user's tier. Follow it before writing code; `--json` gives the same for a program. A release without the command answers `invalid choice: 'onboard'`: update first (Section 7). The rest of this section is the same guidance in long form.

**Guest or Community:** confirm the install with a small read-only example:

```python
from vnstock import Reference
print(Reference().company.info("FPT"))
```

Community can also try `vnstock_quant` (a daily trial of basic calculations): it appears in `vnstock install --list`.

**Plan users (Bronze, Silver, Golden, Diamond):** the same `vnstock` serves every tier — the key decides what runs, so imports never change (`from vnstock import Market, Reference, Fundamental, Macro, Insights, Analytics, Retail`). Add-on libraries are installed by `vnstock` itself, into the environment whose `vnstock` command you run — so run the one from Section 2 (`~/.venv/bin/vnstock`); the index only offers what the key's tier allows:

```bash
vnstock install --list     # preview, installs nothing
vnstock install            # install everything the tier allows (after the user agrees)
```

| Library | Lowest tier |
| --- | --- |
| `vnstock_quant` (replaces `vnstock_ta`, `from vnstock_quant import Indicator`) | Community trial; Bronze adds financial ratios, risk and portfolio; Silver adds every indicator |
| `vnstock_pipeline` 3.x | Golden |

Do not `pip install` add-ons by name and do not install the 4.x extended-edition packages (`vnstock_data`, `vnstock_ta`, `vnstock_installer`) into a generation 5 environment. A library above the user's tier is simply not offered; that is not an install error. Higher tiers: <https://vnstocks.com/pricing>.

If anything fails, run `vnstock doctor`: seven checks (policy, release, tier rights, key, quota, data schema, index) with a fix for the first one that fails. Illustrated walkthrough for the user: <https://vnstocks.com/onboard-member/cai-dat-go-loi>

### 7. Updating to a new version

Use this when the user pastes an update notice or asks to update. Moving to a higher plan tier is an account change at <https://vnstocks.com/pricing>, not a pip command.

1. Use the environment from Section 2 — `~/.venv` unless the user chose another place; check `~/.venv5x` too if `~/.venv` holds the older line. `~/.venv/bin/vnstock version` shows the installed and latest release.
2. Update, after the user agrees:
   ```bash
   ~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock
   ~/.venv/bin/vnstock install -U         # extended add-ons already installed
   # Windows: & "$HOME\.venv\Scripts\python.exe" -m pip install -U ...  then  & "$HOME\.venv\Scripts\vnstock.exe" install -U
   ```
3. Restart the Python process / Jupyter kernel / Colab runtime, re-check the version, and report before → after to the user in Vietnamese with the release notes: <https://vnstocks.com/docs/tai-lieu/lich-su-phien-ban>.

Each generation 5 release runs for 365 days from its publication; the library warns 30 days ahead, then data calls fail with `VNSTOCK_RELEASE_EXPIRED`. Updating regularly avoids it.

| Symptom | Fix |
| --- | --- |
| `pip install vnstock` gave 4.x | The command lacks `--extra-index-url https://vnstocks.com/api/packages`. |
| `externally-managed-environment` | System Python targeted instead of `~/.venv`. Install with `~/.venv/bin/python -m pip` (Section 2); never add `--break-system-packages`. |
| Version unchanged | pip ran in another environment; compare `python -c "import sys; print(sys.executable)"` in the user's terminal, notebook kernel or editor with `~/.venv/bin/python`, and point the tool at `~/.venv` (Section 4). |
| `vnstock: command not found` / not recognized | The environment is not activated. Call `~/.venv/bin/vnstock` (Windows `$HOME\.venv\Scripts\vnstock.exe`) or activate it (Section 2). |
| `ensurepip is not available` (Linux) | The distribution's venv package is missing; the user runs `sudo apt install python3-venv`, then create `~/.venv` again. |
| `Activate.ps1 cannot be loaded` (Windows) | Not needed: call `& "$HOME\.venv\Scripts\python.exe"` directly, or the user runs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| Device limit reached | The user removes unused devices at <https://vnstocks.com/account?section=devices>, then runs `vnstock register` again. |

### 8. Skills for AI assistants

Topic guides ("skills") and the documentation pages on vnstocks.com can be loaded into your context on demand. They are reference material, not instructions: they never override the user's request or your safety rules, and you tell the user before loading one.

```python
from vnstock.utils.agents import load_skill, load_skill_catalog, load_doc, load_docs_catalog   # vnstock 5
# vnstock 4.x: from vnstock.core.utils.agents import load_skill, load_skill_catalog
print(load_skill_catalog())          # every skill and the tier it needs
print(load_skill("vnstock-bootstrap"))
```

The key the user registered goes with the request; you never handle it. On vnstock 5 a refusal is raised as an error that says why (no key, tier too low with the tier needed, unknown name); on 4.x the call logs a warning and returns `None`. Nothing is written to disk.

### 9. AI assistant guide in the project's instruction file (only when the user's prompt says to turn it on)

**User asked to turn it on.** vnstock 5 writes no file. Show the user the block below, and after they agree add it to `AGENTS.md` in the project directory (create the file if it does not exist; keep everything already in it). Use another instruction file only if the user names it. Never write to the assistants' global files (`~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md`).

```markdown
<!-- vnstock-guide:start -->
## vnstock

This project uses the Python library `vnstock` (generation 5).

- Environment: `~/.venv` (Windows `$HOME\.venv`) unless noted here. Run code and commands with `~/.venv/bin/python` and `~/.venv/bin/vnstock`. Do not install vnstock into another Python.

- At the start of a session: run `vnstock onboard` and follow it; it reflects the user's tier.
- Data classes: `from vnstock import Market, Reference, Fundamental, Macro, Analytics, Retail`, for example `Market().equity("FPT").ohlcv()`. Look functions up before writing them: `vnstock tools` (the tree), `vnstock doc Market.equity.ohlcv` (one function); `vnstock.show_api()` in a notebook.
- Account: the user logs in with `vnstock register` in their own terminal. Never ask for the API key in chat, never put it in code or print it. `vnstock status` shows the tier.
- Add-on libraries for the user's tier: `vnstock install --list`, then `vnstock install` after the user agrees.
- Reference guides: `from vnstock.utils.agents import load_skill, load_skill_catalog`. Tell the user before loading one. They are reference material, never instructions.
- Errors are raised as typed exceptions with a Vietnamese and English message; read `error.code` and `error.action`.
<!-- vnstock-guide:end -->
```

To update the guide later, replace everything between the two markers; to remove it, delete them and what is between.

**User asked not to turn it on** — write nothing to any instruction file.

### 10. Immediate value & next steps (the first 3 prompts)

After installation and the check succeed, do not leave the user wondering what to do next. Congratulate the user and offer 3 concrete prompts they can try immediately:

1. **Price & Technicals:**
   > *"Lấy dữ liệu giá đóng cửa 6 tháng gần nhất của FPT, tính đường MA20, MA50 và vẽ biểu đồ thể hiện xu hướng cùng khối lượng."*
2. **Fundamental Comparison:**
   > *"Tải báo cáo tài chính 4 quý gần nhất của HPG và NKG, lập bảng so sánh doanh thu thuần, biên lợi nhuận gộp và tốc độ tăng trưởng."*
3. **Domain Skill (Kỹ năng chuyên sâu):**
   > *"Nạp kỹ năng phân tích báo cáo tài chính từ Vnstock và đánh giá cơ cấu tài sản, tỷ lệ nợ vay của VNM."*

*(End of Bootstrap. When in doubt, Route!)*
