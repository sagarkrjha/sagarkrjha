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

The system runs completely on native GitHub infrastructure using a lightweight Node.js script executed on a scheduled GitHub Actions runner (`ubuntu-latest`).

```
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions Runner (Ubuntu)              │
├───────────────────┬─────────────────────────────────────────┤
│ 1. Event Trigger  │ Daily Cron (00:00 UTC) / Manual Dispatch│
├───────────────────┼─────────────────────────────────────────┤
│ 2. API Ingestion  │ GitHub REST API (Users, Repos, Releases)│
│                   │ Authenticated via GITHUB_TOKEN          │
├───────────────────┼─────────────────────────────────────────┤
│ 3. Data Processing│ Calculate real stars, active projects,  │
│                   │ languages breakdown & real achievements │
├───────────────────┼─────────────────────────────────────────┤
│ 4. Change Check   │ Normalize & diff against existing file  │
├───────────────────┼─────────────────────────────────────────┤
│ 5. Safe Commit    │ Commit & push back with [skip ci]       │
└───────────────────┴─────────────────────────────────────────┘
```

### Key Technical Highlights:
- **Zero External npm Dependencies:** Built using native Node.js (`fs`, `path`, `fetch`). Fast, lightweight, and immune to dependency supply chain vulnerabilities.
- **Fail-Safe Operation:** If GitHub API limits or network issues occur, the script aborts cleanly with a non-zero exit code without altering or truncating `README.md`.
- **Change Detection & Loop Prevention:** Ignores trivial volatile timestamps during equality comparison. Commits are tagged with `[skip ci]` and path-filtered to prevent recursive CI loops.
- **Strict Evidence-Based Content:** All tech stacks, metrics, and project descriptions are derived from real GitHub activity and validated public repositories.

---

## 📂 File Structure

```
sagarkrjha/
├── .github/
│   └── workflows/
│       └── update-profile-readme.yml   # Scheduled & manual GitHub Actions workflow
├── scripts/
│   ├── config.json                     # Single centralized configuration file
│   └── update_readme.js                # Core data fetching and markdown generation engine
├── package.json                        # Node.js project descriptor and scripts
├── README.md                           # The generated profile README rendered on GitHub
└── SETUP.md                            # Detailed documentation and maintenance guide
```

---

## 🔐 Required GitHub Permissions

The GitHub Actions workflow requires write permissions to push the updated `README.md` back to your repository.

### Setting Repository Permissions:
1. Navigate to your repository on GitHub: `https://github.com/sagarkrjha/sagarkrjha`.
2. Click **Settings** (top menu bar) → **Actions** → **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions**.
5. Ensure the checkbox **"Allow GitHub Actions to create and approve pull requests"** is checked (optional but recommended).
6. Click **Save**.

> [!NOTE]
> The workflow uses the built-in `${{ secrets.GITHUB_TOKEN }}` provided by GitHub Actions runners. You **do not** need to generate or store a Personal Access Token (PAT).

---

## ⚡ How the Automation Works

1. **Trigger:**
   - A cron schedule triggers the `.github/workflows/update-profile-readme.yml` workflow once daily (at `00:00 UTC`).
   - You can also manually trigger the workflow anytime from the **Actions** tab.
   - Pushing changes to `scripts/**` or `.github/workflows/**` also triggers a rebuild.
2. **Checkout & Environment:**
   - Runner checks out the repository with full git history.
   - Node.js 22 is initialized.
3. **Execution:**
   - `node scripts/update_readme.js` runs with `GITHUB_TOKEN`.
   - Fetches profile metadata from `GET /users/sagarkrjha`.
   - Fetches repository list from `GET /users/sagarkrjha/repos`.
   - Inspects languages, releases, tags, stars, and commit timestamps for public repos.
4. **Change Detection:**
   - Compares the newly generated Markdown against the existing `README.md`.
   - If no structural, statistical, or content differences exist, the script reports:
     `✅ README.md is already up to date. No profile or repository changes detected.`
     and exits cleanly.
5. **Atomic Commit & Push:**
   - If changes are detected, git stages `README.md`, creates a commit signed by `github-actions[bot]`, and pushes it to `main`.
   - The commit message includes `[skip ci]` to ensure no secondary build is spawned.

---

## ⚙️ Configuration Guide (`config.json`)

All customizable options reside in [`scripts/config.json`](file:///C:/Users/sagar/dev/portfolio/sagarkrjha/scripts/config.json). You can modify your profile details, links, or section toggles without touching any JavaScript code.

```jsonc
{
  "profile": {
    "username": "sagarkrjha",
    "name": "Sagar Kumar Jha",
    "role": "Aspiring Software Engineer",
    "tagline": "Aspiring Software Engineer · Systems & Developer Tooling",
    "bio": "I build robust systems, developer tools, and low-level software from first principles...",
    "location": "",  // Leave empty string "" to hide location from README
    "socials": {
      "github": "https://github.com/sagarkrjha",
      "linkedin": "https://linkedin.com/in/devsagarkumarjha",
      "twitter": "https://x.com/devsagarkrjha",
      "instagram": "", // Leave empty string "" to hide from README
      "youtube": "",   // Leave empty string "" to hide from README
      "discord": "",   // Leave empty string "" to hide from README
      "email": ""      // Leave empty string "" to hide email from README
    }
  },
  "sections": {
    "header": true,
    "about": true,
    "currently_building": true,
    "featured_projects": true,
    "tech_stack": true,
    "metrics": true,
    "achievements": true,
    "interests": true,
    "footer": true
  },
  "featured_projects": {
    "max_count": 6,
    "pinned": ["minigit"],
    "exclude": ["sagarkrjha"],
    "include_forks": false,
    "custom_metadata": {
      "minigit": {
        "title": "MiniGit",
        "description": "A Git-compatible version control system implemented from first principles in modern C++20...",
        "highlights": [
          "SHA-256 Content-Addressable Storage (CAS)",
          "DAG-based commit history and branch management",
          "Two-phase staging index & DP diff engine",
          "Automated cross-platform releases for Windows, Linux, and macOS"
        ]
      }
    }
  },
  "display_options": {
    "stats_theme": "tokyonight", // Theme for GitHub stats card
    "hide_stats_border": true,
    "show_stats_card": true,
    "show_langs_card": true
  }
}
```

---

## 🖱️ Manual Workflow Triggering

Whenever you create a new repository, publish a release, or update your bio:

1. Open `https://github.com/sagarkrjha/sagarkrjha/actions`.
2. In the left sidebar, click **Update Profile README**.
3. Click the **Run workflow** dropdown on the right side.
4. Select branch `main` and click the green **Run workflow** button.
5. The workflow will finish in approximately 10–15 seconds and update your README if new data exists.

---

## ⏰ Changing Update Frequency

The schedule is controlled by the cron expression in [`.github/workflows/update-profile-readme.yml`](file:///C:/Users/sagar/dev/portfolio/sagarkrjha/.github/workflows/update-profile-readme.yml):

```yaml
on:
  schedule:
    - cron: '0 0 * * *' # Every day at 00:00 UTC
```

Common schedules you can choose from:
- **Every 12 Hours:** `- cron: '0 */12 * * *'`
- **Every 6 Hours:** `- cron: '0 */6 * * *'`
- **Once Weekly (Sunday midnight):** `- cron: '0 0 * * 0'`
- **Twice Daily (00:00 & 12:00 UTC):** `- cron: '0 0,12 * * *'`

> [!TIP]
> A frequency of once every 12 to 24 hours is optimal. It keeps your stats fresh while preserving your GitHub API quota.

---

## 🧩 Adding, Removing, or Customizing Sections

### 1. Disabling a Section
To temporarily hide a section, change its boolean flag to `false` in `scripts/config.json`:
```json
"sections": {
  "interests": false,
  "metrics": false
}
```

### 2. Pinning a New Project
To display another project at the top of **Featured Projects**:
1. Add its repository name to `"pinned"`:
   ```json
   "pinned": ["minigit", "new-project-name"]
   ```
2. Optionally add custom highlights under `"custom_metadata"`:
   ```json
   "new-project-name": {
     "title": "My Awesome Tool",
     "description": "High performance indexing service.",
     "highlights": [
       "Sub-millisecond query latency",
       "Zero memory leaks"
     ]
   }
   ```

### 3. Hiding or Adding Social Profiles
To show Instagram or YouTube, simply add the URL string in `"socials"`:
```json
"socials": {
  "youtube": "https://youtube.com/@devsagarkrjha",
  "instagram": "https://instagram.com/devsagarkrjha"
}
```
Setting any profile to `""` automatically omits its badge.

---

## 💻 Local Testing & Development

You can run and test the profile generator locally on your machine at any time using npm:

```bash
# 1. Preview changes without writing to README.md
npm run dry-run

# 2. Check whether the current README is up-to-date (returns exit code 0 if identical, 1 if diff)
npm run check

# 3. Generate and update README.md locally
npm run build

# 4. Force update README.md regardless of identical content
node scripts/update_readme.js --force
```

---

## 🛠️ Troubleshooting & FAQs

### Q1: Workflow fails with `Resource not accessible by integration` (403)
- **Root Cause:** The `GITHUB_TOKEN` does not have write permissions in repository settings.
- **Fix:** Go to **Settings** → **Actions** → **General** → **Workflow permissions** → Select **Read and write permissions** → Click **Save**.

### Q2: Why did the workflow run but not commit any changes?
- **Root Cause:** The change detection system determined that your GitHub metrics, stars, and repos have not changed since the last run.
- **Verification:** Check the Actions log. You should see `✅ README.md is already up to date. No commit necessary.`

### Q3: How do I test with an authenticated token locally?
- Run PowerShell:
  ```powershell
  $env:GITHUB_TOKEN = "your_github_pat_here"
  node scripts/update_readme.js
  ```
- The script automatically detects `process.env.GITHUB_TOKEN`.

### Q4: How does the system avoid infinite commit loops?
1. The GitHub Actions workflow specifies `paths` to only trigger on `scripts/**` or `.github/workflows/**`. Changes to `README.md` do not trigger pushes.
2. The commit message includes `[skip ci]`.
3. The generator performs intelligent normalization and equality checks.
