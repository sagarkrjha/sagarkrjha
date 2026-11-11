# ⚙️ GitHub Profile README Automation Setup & Operations Guide

This guide explains the architecture, configuration, deployment, and operational workflows for the automated GitHub Profile README system of **Sagar Kumar Jha (`@sagarkrjha`)**.

---

## 📋 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [File Structure](#-file-structure)
3. [Required GitHub Permissions](#-required-github-permissions)
4. [How the Automation Works](#-how-the-automation-works)
5. [Configuration Guide (`config.json`)](#-configuration-guide-configjson)
6. [Manual Workflow Triggering](#-manual-workflow-triggering)
7. [Changing Update Frequency](#-changing-update-frequency)
8. [Adding, Removing, or Customizing Sections](#-adding-removing-or-customizing-sections)
9. [Local Testing & Development](#-local-testing--development)
10. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛️ Architecture Overview

The system runs completely on native GitHub infrastructure using a compiled Rust engine executed on a scheduled GitHub Actions runner (`ubuntu-latest`).

```
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions Runner (Ubuntu)              │
├───────────────────┬─────────────────────────────────────────┤
│ 1. Event Trigger  │ Daily Cron (00:00 UTC) / Manual Dispatch│
├───────────────────┼─────────────────────────────────────────┤
│ 2. API Ingestion  │ GitHub REST & GraphQL API               │
│                   │ Authenticated via GITHUB_TOKEN          │
├───────────────────┼─────────────────────────────────────────┤
│ 3. Data Processing│ Dynamic pinned repos, active projects,  │
│                   │ languages breakdown & real achievements │
├───────────────────┼─────────────────────────────────────────┤
│ 4. Change Check   │ Normalize & diff against existing file  │
├───────────────────┼─────────────────────────────────────────┤
│ 5. Safe Commit    │ Commit & push back with [skip ci]       │
└───────────────────┴─────────────────────────────────────────┘
```

### Key Technical Highlights:
- **Native Rust Engine:** Built with modern asynchronous Rust (`tokio`, `reqwest`, `serde`, `chrono`, `regex`). Fast, memory-safe, and self-contained.
- **Completely Automatic Pinned Projects:** Automatically fetches your GitHub pinned repositories via GraphQL (with profile page HTML scraping and `config.json` fallbacks) and presents them as **Featured Projects**.
- **Fail-Safe Operation:** If GitHub API limits or network issues occur, the updater aborts cleanly without altering or truncating `README.md`.
- **Change Detection & Loop Prevention:** Normalizes and compares Markdown content while ignoring trivial volatile timestamps. Commits are tagged with `[skip ci]` and path-filtered to prevent recursive CI loops.
- **Strict Evidence-Based Content:** All tech stacks, metrics, and project descriptions are derived from real GitHub activity and validated public repositories.

---

## 📂 File Structure

```
sagarkrjha/
├── .github/
│   └── workflows/
│       └── update-profile-readme.yml   # Scheduled & manual GitHub Actions workflow
├── updater/                            # Pure Rust updater application
│   ├── Cargo.toml                      # Rust dependencies & build manifest
│   ├── Cargo.lock
│   └── src/
│       └── main.rs                     # Core async fetching and markdown generator
├── config.json                         # Centralized configuration file
├── package.json                        # Development scripts (cargo delegation)
├── README.md                           # Generated profile README rendered on GitHub
├── SETUP.md                            # Detailed documentation and operations guide
└── .gitignore                          # Build artifacts and local environment ignores
```

---

## 🔐 Required GitHub Permissions

The GitHub Actions workflow requires write permissions to push the updated `README.md` back to your repository.

### Setting Repository Permissions:
1. Navigate to your repository on GitHub: `https://github.com/sagarkrjha/sagarkrjha`.
2. Click **Settings** (top menu bar) → **Actions** → **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions**.
5. Check the box **Allow GitHub Actions to create and approve pull requests** (optional, recommended).
6. Click **Save**.

> [!IMPORTANT]
> The workflow uses the built-in `${{ secrets.GITHUB_TOKEN }}` provided by GitHub Actions automatically. No Personal Access Tokens (PATs) or manual secret additions are required.

---

## 🔄 How the Automation Works

### 1. Triggers
The workflow executes under three conditions:
- **Scheduled Cron:** Daily at `00:00 UTC` (`0 0 * * *`).
- **Manual Trigger:** On-demand via GitHub's `workflow_dispatch` button.
- **Code Pushes:** Automatically when modifications are pushed to `updater/**`, `config.json`, `package.json`, or `.github/workflows/**`.

### 2. Execution Pipeline
1. **Runner Provisioning:** Spins up `ubuntu-latest`.
2. **Toolchain & Cache:** Sets up the stable Rust toolchain (`dtolnay/rust-toolchain@stable`) and restores cargo build cache (`Swatinem/rust-cache@v2`).
3. **Execution:** Runs `cargo run --manifest-path updater/Cargo.toml --release` with `GITHUB_TOKEN`.
4. **Data Acquisition:**
   - Queries `api.github.com/users/sagarkrjha` for bio, repository counts, followers, etc.
   - Queries `api.github.com/users/sagarkrjha/repos` for public repositories, languages, and pushed dates.
   - Queries `api.github.com/graphql` for user's pinned repositories to display as Featured Projects.
   - Fetches individual repository languages breakdown and release information.
   - Fetches LeetCode statistics and contest rankings via LeetCode's GraphQL API.
   - Scrapes public lines of code, streak counters, and contribution metrics.
5. **Change Evaluation:**
   - Strips the timestamp and evaluates exact equivalence between the existing and newly generated `README.md`.
   - If identical: exits cleanly with no file writes and no git commit.
   - If changed: writes the new `README.md`.
6. **Markdown Verification:** Ensures pure Markdown compliance with zero unescaped or broken HTML tags.
7. **Automated Commit:** If changes were written, commits as `github-actions[bot]` with message `chore: update profile README [skip ci]` and pushes back to `main`.

---

## ⚙️ Configuration Guide (`config.json`)

All customizable aspects are controlled from [`config.json`](file:///home/senku/dev/portfolio/sagarkrjha/config.json).

```json
{
  "profile": {
    "username": "sagarkrjha",
    "name": "Sagar Kumar Jha",
    "role": "Software Engineer",
    "tagline": "Software Engineer · Systems & Developer Tooling",
    "bio": "I build robust systems...",
    "location": "Delhi, India",
    "socials": {
      "linkedin": "https://linkedin.com/in/devsagarkumarjha",
      "twitter": "https://x.com/devsagarkrjha",
      "leetcode": "https://leetcode.com/u/devsagarkrjha/",
      "discord": "https://discord.com/users/894502933801107476"
    }
  },
  "sections": {
    "header": true,
    "about": true,
    "currently_building": true,
    "featured_projects": true,
    "other_projects": true,
    "tech_stack": true,
    "metrics": true,
    "leetcode": true,
    "achievements": true,
    "interests": true,
    "footer": true
  },
  "featured_projects": {
    "max_count": 6,
    "pinned": ["minigit", "codeshelf", "level-db-cpp"],
    "exclude": ["sagarkrjha"],
    "include_forks": false,
    "custom_metadata": {
      "minigit": {
        "title": "MiniGit",
        "description": "A Git-compatible distributed version control system...",
        "highlights": [
          "Selected for the XERJ Corpus Hub...",
          "SHA-256 Content-Addressable Storage (CAS)..."
        ]
      },
      "codeshelf": {
        "title": "CodeShelf",
        "description": "Developer snippet and knowledge management system...",
        "highlights": [...]
      },
      "level-db-cpp": {
        "title": "LevelDB C++ Implementation",
        "description": "Complete, clean, end-to-end modern C++20 implementation of the LSM-tree storage engine...",
        "highlights": [...]
      }
    }
  }
}
```

---

## 🖱️ Manual Workflow Triggering

Whenever you pin a new repository on your profile, publish a release, or update your bio:

1. Open `https://github.com/sagarkrjha/sagarkrjha/actions`.
2. In the left sidebar, click **Generate & Sync README**.
3. Click the **Run workflow** dropdown on the right side.
4. Select branch `main` and click the green **Run workflow** button.
5. The workflow compiles and executes the Rust updater in ~15–20 seconds (leveraging cached build dependencies) and updates your README automatically.

---

## ⏰ Changing Update Frequency

The schedule is controlled by the cron expression in [`.github/workflows/update-profile-readme.yml`](file:///home/senku/dev/portfolio/sagarkrjha/.github/workflows/update-profile-readme.yml):

```yaml
on:
  schedule:
    - cron: '0 0 * * *' # Every day at 00:00 UTC
```

Common schedules:
- **Every 12 Hours:** `- cron: '0 */12 * * *'`
- **Every 6 Hours:** `- cron: '0 */6 * * *'`
- **Once Weekly (Sunday midnight):** `- cron: '0 0 * * 0'`
- **Twice Daily (00:00 & 12:00 UTC):** `- cron: '0 0,12 * * *'`

---

## 🧩 Adding, Removing, or Customizing Sections

### 1. Disabling a Section
To temporarily hide a section, change its boolean flag to `false` in `config.json`:
```json
"sections": {
  "interests": false,
  "metrics": false
}
```

### 2. Pinning Repositories (Featured Projects)
- **Automatic:** When you pin or unpin any repository on your GitHub profile, the Rust updater automatically queries GraphQL in CI and renders your pinned repositories under **Featured Projects** in the exact order you arranged them.
- **Custom Highlights:** To add custom bullet points for any pinned repository, simply add an entry under `custom_metadata` in `config.json`:
  ```json
  "my-repo": {
    "title": "Custom Display Title",
    "description": "Optional description override.",
    "highlights": [
      "Custom bullet point 1",
      "Custom bullet point 2"
    ]
  }
  ```

---

## 💻 Local Testing & Development

You can run and test the profile generator locally on your machine at any time using Cargo or npm:

```bash
# 1. Preview changes without writing to README.md
cargo run --manifest-path updater/Cargo.toml -- --dry-run
# or
npm run dry-run

# 2. Check whether the current README is up-to-date (returns exit code 0 if identical, 1 if diff)
cargo run --manifest-path updater/Cargo.toml -- --check
# or
npm run check

# 3. Generate and update README.md locally
cargo run --manifest-path updater/Cargo.toml --release
# or
npm run build

# 4. Force update README.md regardless of identical content
cargo run --manifest-path updater/Cargo.toml -- --force
```

### Testing with Authenticated Rate Limits Locally
If you hit GitHub's unauthenticated IP rate limit locally, pass your token:
```bash
GITHUB_TOKEN=$(gh auth token) cargo run --manifest-path updater/Cargo.toml -- --dry-run
```

---

## 🛠️ Troubleshooting & FAQs

### Q1: Workflow fails with `Resource not accessible by integration` (403)
- **Root Cause:** The `GITHUB_TOKEN` does not have write permissions in repository settings.
- **Fix:** Go to **Settings** → **Actions** → **General** → **Workflow permissions** → Select **Read and write permissions** → Click **Save**.

### Q2: Why did the workflow run but not commit any changes?
- **Root Cause:** The change detection system determined that your GitHub metrics, stars, and repos have not changed since the last run.
- **Verification:** Check the Actions log. You should see `✅ README.md is already up to date. No profile or repository changes detected.`

### Q3: How does the system avoid infinite commit loops?
1. The GitHub Actions workflow specifies `paths` to only trigger on `updater/**`, `config.json`, etc. Changes to `README.md` do not trigger pushes.
2. The commit message includes `[skip ci]`.
3. The generator performs intelligent timestamp-agnostic equality checks.
