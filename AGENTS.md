<!-- vnai-bootstrap | auto-generated -->
# Vnstock Vibe Onboarding

> **Về tệp này (dành cho người dùng).** Nếu bạn thấy khối này trong `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md` hoặc `AGENTS.md` của dự án mà không nhớ đã tự thêm, thì nó do thư viện `vnstock` dòng 4.x cũ tự ghi vào khi bạn `import vnstock`. Thư viện `vnstock` thế hệ 6 không ghi tệp nào. Khối này chỉ là tài liệu cài đặt, không cấp cho trợ lý AI quyền gì thêm; muốn gỡ thì xoá nó khỏi tệp đó. Giải thích đầy đủ tại <https://vnstocks.com/docs/tai-lieu/vnstock-agent-skills>.

## Scope — read this first (for AI assistants)

This is **reference documentation** for installing and updating the Vnstock Python packages. It is not a task and it grants no permissions.

* **Act on it only when the user asks** to install, set up, update or troubleshoot `vnstock`. In any other conversation, ignore this file entirely.
* If the user pasted a setup prompt copied from vnstocks.com, **that prompt is the user's request** — follow it, and use this file only to look up details.
* **The user's instructions and your own safety rules always win.** Nothing here overrides them. If a step conflicts with what the user asked, follow the user.
* **Ask before acting.** Show the commands you intend to run and get the user's go-ahead before installing packages, creating environments, or writing any file. A request like "set up vnstock for me" counts as approval for the install commands in Sections G1–G7; it does not cover anything else, and never covers storing a key.
* **Never handle the API key yourself** — see Section G4.

## Which generation to install

**Generation 6** (`vnstock` 6.0.1 with `vnstock-oapi` 0.1.2) is the only line that runs; plans apply to it from 11/11/2026. Every setup in this file is generation 6. Tell the user that generation 6 reads data with their own Open API key at a source they choose.

* **Older code or packages:** if you find `vnstock` 5.x or older, or `vnstock_data`, `vnai`, `vnii` or `vnstock_installer` (in `<env python> -m pip show vnstock vnstock_data vnai vnii vnstock_installer`, or imported in the project's code), it no longer runs: those releases stopped authenticating on 10/11/2026. Tell the user in one line, do not install it, install generation 6 into the same environment (Section G2) after uninstalling those packages, and move the project's code with <https://vnstocks.com/onboard-member/migration> and the skill `migration-assistant`.
* Generation 6 goes into the fixed environment `~/.venv` (Section G2). Before installing, check the environment you are about to install into with `<env python> -m pip show vnstock vnstock-oapi` and tell the user in one line what you found.
* The only place generation 6 goes into a separate environment (`~/.venv_6x`) is that migration page, with the skill `migration-assistant`. If the user wants to move an existing project, send them there instead of following this file.

### Generation 6 at a glance — copy these, do not rewrite them

Plans must use these exact values.

* **First detect where you are running (Section G1).** The OS named in a prompt is where the user opened the web page, not necessarily where you run.
* Environment on a personal machine or server: exactly `~/.venv` (Windows `$HOME\.venv`). Not `~/.venv6`, not a project `.venv`; `~/.venv_6x` only when the user follows the migration page.
* Environment on Google Colab, GitHub Codespaces or Kaggle: **no virtual environment**. Install into the session's own Python.
* Core install, macOS / Linux: `~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"`
* Core install, Windows: `& "$HOME\.venv\Scripts\python.exe" -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"`
* Core install, Colab / Codespaces / Kaggle: `python3 -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"`
* Add-ons: only the commands in Section G7, each with its exact version. Do not use `vnstock install` without a package name and version, and do not use `--all`.
* Never install `vnstock_data`, `vnstock_ta`, `vnstock_news` or `vnstock_installer`. `vnstock_data` is merged into `vnstock` and `vnstock_ta` is replaced by `vnstock_quant`.
* Every `pip` command needs `--extra-index-url https://vnstocks.com/api/packages` and exact versions. Do not swap them for `--pre`.

## What the Vnstock packages do on the user's machine

State this plainly if the user asks. Do not downplay it.

* Two kinds of key, never mixed:
  * The **Vnstock account key** (from <https://vnstocks.com/account#api-key>) checks the tier and the release, and registers the machine as one of the account's devices (each tier has a device limit). It is sent to `vnstocks.com` over HTTPS in the `Authorization` header and stored encrypted under `~/.vnstock/auth/`, never printed. It is never sent to a data source.
  * The **source keys** are the user's own Open API keys, registered by the user at each source they choose, under that source's terms. `vnstock-oapi` reads them from environment variables, then a `.env` file in the current directory, then the operating system keyring. They are sent only to that source, never to `vnstocks.com`, and no function takes a key as an argument.
* Data goes straight from the source to the user's machine; `vnstock` normalizes it there into `pandas` tables.
* Usage measurement runs only if the account turned it on at <https://vnstocks.com/account?section=data-preferences>. It never records symbols, dates, values or which source was used. `DO_NOT_TRACK=1` or `VNSTOCK_TELEMETRY=0` switches it off.
* Each release carries a signed lifetime: 365 days for a final release, 30 days from the build date for an `rc` release. `vnstock status` shows the date.
* It writes no file for AI assistants.

Privacy policy: <https://vnstocks.com/onboard/chinh-sach-quyen-rieng-tu>

## Package index

* `https://vnstocks.com/api/packages` (PEP 503). No separate installer.

Always use `--extra-index-url`, not `--index-url` (dependencies such as `pandas` still come from PyPI). A plain `pip install vnstock` without the index gets 4.x from PyPI. Use the interpreter of the environment you checked: `python -m pip …`.

**Generation 6 needs the index and exact versions, both.** Without the index pip takes `vnstock` 4.x from PyPI. Exact versions keep the core and add-ons a tested combination, and stop a leftover add-on of an older release from pulling `vnstock` back below 6. Copy the pinned commands in Section G3, also when updating.

## Setup (generation 6)

These are final releases: each runs 365 days from its release.

Sources: <https://vnstocks.com/docs/vnstock/v6/cai-dat> (install and source keys), <https://vnstocks.com/docs/vnstock-oapi/cai-dat> (the connector). When this section and those pages disagree, the pages win; tell the user.

### G1. Where you are running, then Python

**Do this before writing the plan.** On Linux or macOS run:

```bash
python3 -c "import os,pathlib;e=os.environ;print('colab' if any(k.startswith('COLAB_') for k in e) or pathlib.Path('/content').is_dir() else 'codespaces' if e.get('CODESPACES') else 'kaggle' if any(k.startswith('KAGGLE_') for k in e) else 'local')"
```

`colab`, `codespaces` or `kaggle` means a hosted session: Python is provided, there is no virtual environment, and the hosted notes in G2 to G5 and G9 apply; go on to G2. `local` (and any Windows machine) means a personal machine or server. Do not use `import google.colab` for this: it only works inside a notebook kernel and fails from a terminal in the same Colab session.

`python3 -m venv` failing with an `ensurepip` error on a path under `/root` usually means this check was skipped. Run it again rather than working around the error.

Then Python, **3.10 or newer**. The prebuilt wheels cover macOS (Apple chip and Intel), Linux x86_64 and aarch64 (glibc 2.17+), Windows x86_64; no compiler is needed.

* **macOS:** `python3 --version`. The `/usr/bin/python3` that ships with the Xcode command line tools is 3.9, too old. Use Python from <https://www.python.org/downloads/> or Homebrew (`brew install python`, the user runs it).
* **Linux:** `python3 --version`. `python3 -m venv` needs the distribution's venv package; on Debian/Ubuntu, if creating the environment fails with `ensurepip is not available` on a personal machine, the user runs `sudo apt install python3-venv` (or `python3.12-venv`, matching the version). You show the command, they run it.
* **Windows:** `py --version` (the Python launcher) or `python --version`. If several versions are installed, `py -0p` lists them; pick one with `py -3.12`. Avoid the Microsoft Store Python (hidden script folders, sandboxed paths); recommend the python.org installer.
* Python missing or too old → stop and point the user to <https://www.python.org/downloads/> or <https://vnstocks.com/onboard/cai-dat-moi-truong-python>. Do not run `curl | sh` style installers.

### G2. Where to install

Generation 6 always goes into **one fixed place**, so the user, their support and any assistant know where the complete vnstock environment is:

| Machine | Environment | Python of that environment |
| --- | --- | --- |
| macOS, Linux | `~/.venv` | `~/.venv/bin/python` |
| Windows | `$HOME\.venv` | `& "$HOME\.venv\Scripts\python.exe"` |
| Colab, Codespaces, Kaggle | the session's own Python, **no** virtual environment, never `~/.venv` | `python3` in a terminal, `!python3` in a notebook cell |

Use another place only when the user asks for it (a project `.venv`, conda, uv).

* `~/.venv` does not exist → propose creating it: `python3 -m venv ~/.venv` (Windows `py -m venv "$HOME\.venv"`, or `py -3.12 -m venv "$HOME\.venv"` to pick a version).
* It exists → look inside first (`~/.venv/bin/python --version` and `~/.venv/bin/python -m pip show vnstock vnstock-oapi`; Windows `& "$HOME\.venv\Scripts\python.exe" …`):
  * `vnstock` 6.x or nothing → install or update there.
  * Anything older → the rule under "Which generation to install": say so in one line and put the clean-up and the generation 6 install in the same plan.
  * Python older than 3.10, or a broken environment (its `python` no longer runs, for example after a Python upgrade) → ask before recreating it: recreating deletes everything installed in it.
* `~/.venv_6x` left from a migration → tell the user; use it only if they ask for it, otherwise set up `~/.venv` and let them remove `~/.venv_6x` themselves once their projects run from `~/.venv`.
* On a hosted notebook where an older `vnstock` was already imported in the session, installing generation 6 replaces it. Say so before installing, then restart the runtime.
* A hosted session can have more than one Python, and a terminal's `python3` may differ from the notebook's. If the user will work in a notebook, have them run `import sys; print(sys.executable)` in a cell and install with that interpreter. Say which interpreter you used.
* Hosted sessions are short-lived: when the runtime is recycled the install and anything under `~` are gone, and the steps must be run again.

Run every later command with the environment's own Python and its own `vnstock` command (`~/.venv/bin/vnstock`, Windows `& "$HOME\.venv\Scripts\vnstock.exe"`) rather than activating it. That works even when PowerShell blocks `Activate.ps1` and whatever is on PATH. `vnstock` being "not found" in an un-activated terminal is expected, not an error. If the user wants to type `python` and `vnstock` directly, they activate it: `source ~/.venv/bin/activate` (macOS/Linux) or `& "$HOME\.venv\Scripts\Activate.ps1"` (Windows; if blocked, the user runs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`). Never `sudo pip`, never `--break-system-packages`.

### G3. Install

macOS / Linux:

```bash
~/.venv/bin/python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"
~/.venv/bin/vnstock version
```

Windows (PowerShell):

```powershell
& "$HOME\.venv\Scripts\python.exe" -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"
& "$HOME\.venv\Scripts\vnstock.exe" version
```

* Colab / Codespaces / Kaggle: `python3 -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"` (notebook cell: prefix `!`), then `vnstock version`. Restart the notebook runtime only if `vnstock` was already imported in that session.
* `uv` users who asked for uv: `uv pip install --python ~/.venv/bin/python -U --extra-index-url https://vnstocks.com/api/packages "vnstock==6.0.1" "vnstock-oapi==0.1.2"`.
* Verify: `python -c "import vnstock; print(vnstock.__version__)"` prints `6.0.1`. The environment now has two commands: `vnstock` (account, machine check, function lookup) and `vnstock-oapi` (source keys and sessions).

**Editors and Jupyter.** Point the user's tools at the same environment so code runs where vnstock is installed:

* **Antigravity / VS Code:** *Python: Select Interpreter* → `~/.venv/bin/python` (Windows: `%USERPROFILE%\.venv\Scripts\python.exe`).
* **Jupyter (local):** register the environment as a kernel once, then pick **Python (Vnstock)** in the notebook. A kernel that already pointed at `~/.venv` runs generation 6 after the install; restart it.

```bash
~/.venv/bin/python -m pip install ipykernel
~/.venv/bin/python -m ipykernel install --user --name=vnstock-venv --display-name "Python (Vnstock)"
```
```powershell
& "$HOME\.venv\Scripts\python.exe" -m pip install ipykernel
& "$HOME\.venv\Scripts\python.exe" -m ipykernel install --user --name=vnstock-venv --display-name "Python (Vnstock)"
```

### G4. Vnstock account — the user logs in, you never see the key

A free registered account or a paid plan has a key at <https://vnstocks.com/account#api-key>.

* **Do not ask the user to paste the key into the chat.** If they do, tell them it is now in the conversation log and suggest regenerating it at the link above.
* **Do not put the key in a command, a script, a file you write, or your output.** Never print `VNSTOCK_API_KEY` (no `echo`, `env`, `printenv`, `set`, `Get-ChildItem Env:`); only check whether it exists.
* The key is kept encrypted under `~/.vnstock/auth/`. You never read those files, and you never call private helpers that return the key.

Where `vnstock` takes the key from, in order: `VNSTOCK_API_KEY` in the environment, if set (it always wins); then the encrypted store written by `vnstock login`; then a plain `~/.vnstock/api_key.json`, written by the one-line command on vnstocks.com that plan users run before opening you, which is imported into the encrypted store **once**, the first time on a machine that has no stored key yet. After that the file is ignored: rewriting it does **not** change the key `vnstock` uses. The key is stored per user, not per environment.

* Check first with `vnstock status` (the environment's command): tier, expiry and device; it never prints the key.
* If it shows no login, or a tier the user does not expect, the user runs `vnstock login` in their own terminal with the same environment's command (hidden input; it replaces the stored key). In a notebook: `import os, vnstock; vnstock.login(os.environ["VNSTOCK_API_KEY"])`.
* **Hosted sessions:** the one-line command on vnstocks.com saved the key on the user's own computer, so a Colab, Codespaces or Kaggle session is usually not logged in, even if the prompt says the key is saved. Run `vnstock status`. If it is not logged in: the user runs `vnstock login` in the session's terminal, or provides `VNSTOCK_API_KEY` as an environment variable (Codespaces Secrets; in a Colab notebook, `os.environ["VNSTOCK_API_KEY"] = userdata.get("VNSTOCK_API_KEY")`).
* If the user says the key is in a `.env` file: do not open or print it. With their agreement, load it for that command only: `set -a; . ./.env; set +a; vnstock status`.
* Once `vnstock status` shows the right tier, tell the user that `~/.vnstock/api_key.json` still holds the key in plain text and offer that they delete it themselves. To log out: `vnstock logout`.
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

Run `vnstock doctor`: connection to vnstocks.com, release lifetime, account, updates, `vnstock-oapi`, keys and sessions per source, each with a fix. A source without a key is only a warning. Illustrated walkthrough for the user: <https://vnstocks.com/onboard-member/cai-dat-go-loi>

Then `vnstock onboard` (`--json` for a program): this machine's release, tier, add-ons, the rules and the skills the tier can read. Follow it before writing code. In short:

* Every data call names a source: `Market("<nguồn>").equity("FPT").ohlcv(start="2026-01-01")`, or `source="<nguồn>"`, or once per process `vnstock.sources.use("<nguồn>")` (per group: `route="fundamental.equity.*"`; keep it with `vnstock.sources.save()`). Without one, the call raises `VNSTOCK_INPUT_SOURCE`.
* Which sources read a kind of data: `vnstock.sources.readers("market.equity.ohlcv")`. A source that has prices may have no financial statements.
* The data classes are `Market`, `Reference` and `Fundamental`. Columns, units and times follow the `v5` compatibility profile by default; `vnstock.compat.use("v6")` switches to the generation 6 names. Tables whose columns changed raise `SchemaChangeWarning` and list the changes in `df.attrs["schema_changes"]`.
* Not in this release: source-computed ratios (`ratio`), notes, filings, `Insights`, `Analytics`, `Macro`. They raise `UnsupportedError` with `VNSTOCK_ROUTE_UNSUPPORTED`, not an empty table. Financial ratios are computed on the machine with `vnstock_quant.fa` from the three statements.
* A parameter the function does not take raises `VNSTOCK_INPUT_PARAM`; it is never ignored.
* Look functions up instead of guessing: `vnstock tools`, `vnstock doc Market.equity.ohlcv`.
* Attribute figures with `vnstock.cite(df)`. Never recommend buying, selling or holding a symbol.

Confirm the install with one small read-only call at the user's source, for example `Reference("<nguồn>").equity.list()`.

### G7. Add-on libraries of generation 6

| Library | Install into the generation 6 environment | Lowest tier |
| --- | --- | --- |
| `vnstock_quant` 1.0.0 | `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock_quant==1.0.0"` | Community trial; Bronze, Silver add more |
| `vnstock-mcp` 1.0.0 | `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages "vnstock-mcp[quant]==1.0.0" "vnstock==6.0.1" "vnstock-oapi==0.1.2"`, then `vnstock-mcp --setup` | Community; prebuilt for macOS Apple chip only in this release |
| `vnstock-pipeline` 4.0.0 | `vnstock install "vnstock-pipeline[rest,stream,excel]==4.0.0"` (after `vnstock login`; the index serves it only to an entitled machine) | Golden |

* Always keep the exact versions. Without them pip may pick an older release of a library, which pulls `vnstock` back below 6.
* A library above the user's tier is simply not offered; that is not an install error. Higher tiers: <https://vnstocks.com/pricing>.
* `vnstock_news` has no generation 6 release.
* Charts: use `vnstock_chart` (successor of `vnstock_ezchart`, same function names). Install it with the core pinned in the same command: `python -m pip install -U --extra-index-url https://vnstocks.com/api/packages vnstock-chart "vnstock==6.0.1" "vnstock-oapi==0.1.2"`. Draw with `matplotlib`, `seaborn` or `plotly` directly only for a figure or customisation `vnstock_chart` does not offer.
* Never install `vnstock_quant` 0.x, `vnstock_pipeline` 3.x or `vnstock_news` into the generation 6 environment.
* Docs: `vnstock_quant` <https://vnstocks.com/docs/vnstock_quant/v1/bat-dau/cai-dat-va-thiet-lap>, MCP <https://vnstocks.com/docs/vnstock-mcp/v1/cai-dat-va-ket-noi>, pipeline <https://vnstocks.com/docs/vnstock-pipeline/v6/cai-dat-va-tai-khoan>.

### G8. Updating, release lifetime, skills for AI assistants

**Updating.** Use this when the user pastes an update notice or asks to update. Moving to a higher plan tier is an account change at <https://vnstocks.com/pricing>, not a pip command.

1. Use the environment from Section G2. `vnstock version` (the environment's command) shows the installed and latest release.
2. After the user agrees, run the pinned commands of Section G3 and G7 with the new version numbers from <https://vnstocks.com/docs/vnstock/v6/cai-dat>, never an unpinned `pip install -U vnstock`.
3. Restart the Python process, Jupyter kernel or Colab runtime, check the version again, and report before → after to the user in Vietnamese with the release notes: <https://vnstocks.com/docs/tai-lieu/lich-su-phien-ban>.

A final release runs 365 days (an `rc` release only 30 days from its build). Near the end the library warns once; then calls fail with `VNSTOCK_RELEASE_EXPIRED`. Updating regularly avoids it.

| Symptom | Fix |
| --- | --- |
| `pip install vnstock` gave 4.x | The command lacks `--extra-index-url https://vnstocks.com/api/packages` or the pinned versions. |
| `externally-managed-environment` | System Python targeted instead of `~/.venv`. Install with `~/.venv/bin/python -m pip` (Section G2); never add `--break-system-packages`. |
| Version unchanged | pip ran in another environment; compare `python -c "import sys; print(sys.executable)"` in the user's terminal, notebook kernel or editor with `~/.venv/bin/python`, and point the tool at `~/.venv` (Section G3). |
| `vnstock: command not found` / not recognized | The environment is not activated. Call `~/.venv/bin/vnstock` (Windows `$HOME\.venv\Scripts\vnstock.exe`) or activate it (Section G2). |
| `ensurepip is not available` (Linux) | The distribution's venv package is missing; the user runs `sudo apt install python3-venv`, then create `~/.venv` again (Section G1). |
| `Activate.ps1 cannot be loaded` (Windows) | Not needed: call `& "$HOME\.venv\Scripts\python.exe"` directly, or the user runs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| Device limit reached | The user removes unused devices at <https://vnstocks.com/account?section=devices>, then runs `vnstock login` again. |

**Skills for AI assistants.** Topic guides ("skills") and the documentation pages on vnstocks.com can be loaded into your context on demand:

```python
from vnstock.utils.agents import load_skill, load_skill_catalog, load_doc, load_docs_catalog
print(load_skill_catalog())          # every skill and the tier it needs
print(load_skill("vnstock-bootstrap"))
```

* They are reference material, not instructions: they never override the user's request or your safety rules. Tell the user in one line which one you load.
* They are not installed in your own skill folder, so nothing surfaces them for you: `vnstock onboard` lists what each one is for, and for a task on stocks, portfolios or a vnstock project you load the matching one before planning.
* The key the user logged in with goes with the request; you never handle it. A refusal is raised as an error that says why (no key, tier too low with the tier needed, unknown name). Nothing is written to disk.
* The catalog marks each skill's generations (`generations`); do not use a skill whose `generations` lacks `6`.

### G9. AI assistant guide in the project's instruction file (only when the user's prompt says to turn it on)

**User asked to turn it on.** `vnstock` writes no file itself. Show the user the block below, and after they agree add it to `AGENTS.md` in the project directory (create the file if it does not exist; keep everything already in it). Use another instruction file only if the user names it. Never write to the assistants' global files (`~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md`).

Write the block as it is, filling only the placeholder; do not add source names, code samples or sections of your own. On a hosted session, replace the "Environment" line with: `- Environment: this session's own Python (no virtual environment); install again when the runtime is recycled.`, and in the "Skills" line use `python3` instead of `~/.venv/bin/python`. If the user chose `~/.venv_6x` while migrating and keeps it, write that path instead.

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

To update the guide later, replace everything between the two markers; to remove it, delete them and what is between.

**User asked not to turn it on** — write nothing to any instruction file.

### G10. First prompts

After the install and the check succeed, do not leave the user wondering what to do next. Congratulate the user and offer three prompts they can try at once, with the user's source written into them:

1. **Price and technicals:**
   > *"Lấy dữ liệu giá đóng cửa 6 tháng gần nhất của FPT từ nguồn `<nguồn>`, tính đường MA20, MA50 và vẽ biểu đồ thể hiện xu hướng cùng khối lượng."*
2. **Fundamental comparison** (check first that the user's source reads statements: `vnstock.sources.readers("fundamental.equity.income_statement")`):
   > *"Tải báo cáo tài chính 4 quý gần nhất của HPG và NKG từ nguồn `<nguồn>`, lập bảng so sánh doanh thu thuần, biên lợi nhuận gộp và tốc độ tăng trưởng."*
3. **Domain skill:**
   > *"Nạp kỹ năng phân tích báo cáo tài chính từ Vnstock và đánh giá cơ cấu tài sản, tỷ lệ nợ vay của VNM."*
