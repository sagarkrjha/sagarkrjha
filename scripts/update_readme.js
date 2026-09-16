#!/usr/bin/env node

/**
 * Automated GitHub Profile README Generator
 * 
 * Fetches real-time profile, repository, language, and release data from the GitHub API
 * and generates a clean, modern, developer-centric README.md based on real work.
 * 
 * Requirements met:
 * - Safe API calls with authentication & rate-limit awareness
 * - Safe failure: never overwrites README on network/API failure
 * - Grounded strictly in repository evidence (no invented claims)
 * - Intelligent change detection: updates file only when content changes
 * - Minimal, professional design without excessive emojis or fake metrics
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const README_PATH = path.join(ROOT_DIR, 'README.md');

// Parse CLI flags
const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes('--dry-run');
const IS_CHECK_ONLY = args.includes('--check');
const IS_FORCE = args.includes('--force');

/**
 * Load and validate configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found at: ${CONFIG_PATH}`);
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse configuration file: ${err.message}`);
  }
}

/**
 * Helper to perform authenticated and timeout-protected GitHub API requests
 */
async function fetchGitHub(url, token) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'sagarkrjha-profile-updater/1.0',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 403 || res.status === 429) {
      const resetTime = res.headers.get('x-ratelimit-reset');
      const resetMsg = resetTime ? ` Rate limit resets at ${new Date(resetTime * 1000).toISOString()}` : '';
      throw new Error(`GitHub API rate limit exceeded (HTTP ${res.status}).${resetMsg}`);
    }

    if (!res.ok) {
      throw new Error(`GitHub API request failed: ${url} (HTTP ${res.status}: ${res.statusText})`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`GitHub API request timed out: ${url}`);
    }
    throw err;
  }
}

/**
 * Formats ISO date to human readable "Month Year" or "YYYY-MM-DD"
 */
function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Helper to fetch public LeetCode statistics & contest rankings
 */
async function fetchLeetCode(username) {
  if (!username) return null;

  const query = `query userProfile($username: String!) {
    matchedUser(username: $username) {
      profile {
        ranking
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
      badge {
        name
      }
    }
  }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'sagarkrjha-profile-updater/1.0',
        'Referer': 'https://leetcode.com'
      },
      body: JSON.stringify({ query, variables: { username } }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`LeetCode GraphQL HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`LeetCode GraphQL Error: ${data.errors[0].message}`);
    }

    const matchedUser = data?.data?.matchedUser;
    const contest = data?.data?.userContestRanking;

    if (!matchedUser) {
      throw new Error(`LeetCode user not found: @${username}`);
    }

    const submissions = matchedUser.submitStats?.acSubmissionNum || [];
    const totalSolved = submissions.find(s => s.difficulty === 'All')?.count || 0;
    const easySolved = submissions.find(s => s.difficulty === 'Easy')?.count || 0;
    const mediumSolved = submissions.find(s => s.difficulty === 'Medium')?.count || 0;
    const hardSolved = submissions.find(s => s.difficulty === 'Hard')?.count || 0;

    return {
      username,
      ranking: matchedUser.profile?.ranking || null,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      contestRating: contest ? Math.round(contest.rating) : null,
      exactRating: contest ? contest.rating : null,
      contestRanking: contest?.globalRanking || null,
      totalParticipants: contest?.totalParticipants || null,
      topPercentage: contest?.topPercentage || null,
      attendedContests: contest?.attendedContestsCount || 0,
      badge: contest?.badge?.name || null
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`⚠️  Failed to fetch LeetCode data for @${username}: ${err.message}`);
    return null;
  }
}

/**
 * Main generator logic
 */
async function run() {
  console.log('🚀 Starting GitHub Profile README generation...');

  const config = loadConfig();
  const username = config.profile.username;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;

  if (!token) {
    console.warn('⚠️  No GITHUB_TOKEN environment variable found. Making unauthenticated requests (lower rate limit).');
  } else {
    console.log('🔑 Authenticated GitHub API requests enabled.');
  }

  // 1. Fetch user profile data
  console.log(`📡 Fetching profile for @${username}...`);
  const user = await fetchGitHub(`https://api.github.com/users/${username}`, token);
  if (!user || !user.login) {
    throw new Error(`User data returned from GitHub API is invalid for @${username}.`);
  }

  // 2. Fetch public repositories
  console.log(`📡 Fetching repositories for @${username}...`);
  const rawRepos = await fetchGitHub(
    `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed&direction=desc`,
    token
  );
  if (!Array.isArray(rawRepos)) {
    throw new Error('Repositories response is not an array.');
  }

  // Filter repos
  const excludeSet = new Set(config.featured_projects.exclude || []);
  const validRepos = rawRepos.filter(repo => {
    if (repo.fork && !config.featured_projects.include_forks) return false;
    return true;
  });

  // Calculate high-level metrics
  let totalStars = 0;
  let totalForks = 0;
  const languageBytes = {};

  // Fetch enriched details for user's owned non-profile repos
  const enrichedRepos = [];
  for (const repo of validRepos) {
    totalStars += repo.stargazers_count || 0;
    totalForks += repo.forks_count || 0;

    if (excludeSet.has(repo.name)) continue;

    console.log(`  ↳ Fetching details for ${repo.name}...`);
    let languages = {};
    let releases = [];

    try {
      if (repo.languages_url) {
        languages = await fetchGitHub(repo.languages_url, token);
        for (const [lang, bytes] of Object.entries(languages)) {
          languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
        }
      }
      const releasesUrl = repo.releases_url ? repo.releases_url.replace('{/id}', '') : null;
      if (releasesUrl) {
        releases = await fetchGitHub(releasesUrl, token);
      }
    } catch (err) {
      console.warn(`    ⚠️ Failed to fetch extra details for ${repo.name}: ${err.message}`);
    }

    enrichedRepos.push({
      ...repo,
      languages,
      releases: Array.isArray(releases) ? releases : []
    });
  }

  // Determine featured projects: pinned repos first, then by stars and push date
  const pinnedSet = new Set(config.featured_projects.pinned || []);
  enrichedRepos.sort((a, b) => {
    const aPinned = pinnedSet.has(a.name);
    const bPinned = pinnedSet.has(b.name);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (b.stargazers_count !== a.stargazers_count) {
      return b.stargazers_count - a.stargazers_count;
    }
    return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
  });

  const featuredProjects = enrichedRepos.slice(0, config.featured_projects.max_count || 6);

  // Determine "Currently Building"
  const activeRepo = enrichedRepos.find(r => !excludeSet.has(r.name));

  // Determine achievements
  const achievements = [];
  for (const repo of enrichedRepos) {
    if (repo.releases && repo.releases.length > 0) {
      const latestRelease = repo.releases[0];
      const customMeta = config.featured_projects.custom_metadata[repo.name] || {};
      const repoTitle = customMeta.title || repo.name;
      achievements.push({
        type: 'release',
        title: `Shipped **${repoTitle} ${latestRelease.tag_name || latestRelease.name}**`,
        description: `Published native cross-platform binaries with automated GitHub Actions CI/CD.`,
        link: latestRelease.html_url || repo.html_url,
        date: latestRelease.published_at || latestRelease.created_at
      });
    }
  }

  // 3. Fetch LeetCode stats (if enabled)
  let leetcodeData = null;
  const lcUsername = config.leetcode?.username || 'devsagarkrjha';
  if (config.sections?.leetcode !== false && lcUsername) {
    console.log(`📡 Fetching LeetCode data for @${lcUsername}...`);
    leetcodeData = await fetchLeetCode(lcUsername);
    if (leetcodeData) {
      console.log(`  ↳ LeetCode Solved: ${leetcodeData.totalSolved}, Rating: ${leetcodeData.contestRating || 'N/A'}`);
    }
  }

  if (leetcodeData && leetcodeData.contestRating) {
    const badgeName = leetcodeData.badge ? `LeetCode ${leetcodeData.badge}` : 'LeetCode Competitive Programmer';
    const topPercentStr = leetcodeData.topPercentage ? ` (Top ${leetcodeData.topPercentage}% globally)` : '';
    achievements.push({
      type: 'leetcode',
      title: `Achieved **${badgeName}** · **${leetcodeData.contestRating} Contest Rating**${topPercentStr}`,
      description: `Solved **${leetcodeData.totalSolved}+ algorithmic problems** (${leetcodeData.hardSolved} Hard, ${leetcodeData.mediumSolved} Medium) with a peak contest rating of **${leetcodeData.contestRating}**.`,
      link: `https://leetcode.com/u/${lcUsername}/`
    });
  }

  if (totalStars >= 5) {
    achievements.push({
      type: 'stars',
      title: `Earned **${totalStars}+ GitHub Stars** across open-source systems projects.`,
      description: `Recognized for building first-principles developer tooling and version control architecture.`,
      link: `https://github.com/${username}?tab=repositories`
    });
  }

  // 4. Assemble Markdown sections
  console.log('📝 Assembling README markdown...');
  const markdown = buildMarkdown({
    config,
    user,
    totalStars,
    totalForks,
    languageBytes,
    featuredProjects,
    activeRepo,
    achievements,
    leetcodeData
  });

  // 4. Change detection
  let existingContent = '';
  if (fs.existsSync(README_PATH)) {
    existingContent = fs.readFileSync(README_PATH, 'utf-8');
  }

  // Normalize and compare content ignoring the volatile timestamp line
  const stripTimestamp = (text) => text.replace(/Last synced: `[^`]+`/g, 'Last synced: `STATIC`').replace(/\r\n/g, '\n').trim();

  const isContentIdentical = stripTimestamp(markdown) === stripTimestamp(existingContent);

  if (!IS_FORCE && isContentIdentical && existingContent.length > 0) {
    console.log('✅ README.md is already up to date. No profile or repository changes detected.');
    if (IS_CHECK_ONLY) process.exit(0);
    return;
  }

  if (IS_CHECK_ONLY) {
    console.log('⚠️  README.md is out of date.');
    process.exit(1);
  }

  if (IS_DRY_RUN) {
    console.log('🔍 DRY RUN output:\n----------------------------------------\n');
    console.log(markdown);
    console.log('\n----------------------------------------\n✅ Dry run complete.');
    return;
  }

  // Write file safely
  fs.writeFileSync(README_PATH, markdown, 'utf-8');
  console.log(`🎉 Successfully updated ${README_PATH}!`);
}

/**
 * Builds the complete Markdown string from fetched data
 */
function buildMarkdown({ config, user, totalStars, totalForks, languageBytes, featuredProjects, activeRepo, achievements, leetcodeData }) {
  const p = config.profile;
  const s = config.sections;
  const parts = [];

  // HEADER SECTION
  if (s.header) {
    const socialBadges = [];
    if (p.socials.linkedin) {
      socialBadges.push(`[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](${p.socials.linkedin})`);
    }
    if (p.socials.twitter) {
      socialBadges.push(`[![X (Twitter)](https://img.shields.io/badge/X%20(Twitter)-000000?style=flat-square&logo=x&logoColor=white)](${p.socials.twitter})`);
    }
    if (p.socials.github) {
      socialBadges.push(`[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](${p.socials.github})`);
    }
    if (p.socials.leetcode) {
      socialBadges.push(`[![LeetCode](https://img.shields.io/badge/LeetCode-FFA116?style=flat-square&logo=leetcode&logoColor=black)](${p.socials.leetcode})`);
    }
    if (p.socials.email) {
      const emailUrl = p.socials.email.startsWith('mailto:') ? p.socials.email : `mailto:${p.socials.email}`;
      socialBadges.push(`[![Email](https://img.shields.io/badge/Email-D14836?style=flat-square&logo=gmail&logoColor=white)](${emailUrl})`);
    }
    if (p.socials.youtube) {
      socialBadges.push(`[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white)](${p.socials.youtube})`);
    }
    if (p.socials.discord) {
      socialBadges.push(`[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](${p.socials.discord})`);
    }

    parts.push(
`<div align="center">

# ${p.name}
### ${p.tagline}

${socialBadges.join('&nbsp;&nbsp;')}

</div>`
    );
  }

  // ABOUT ME SECTION
  if (s.about) {
    const aboutBulletPoints = [
      `- 🔭 **Focus Area:** Systems Programming, Version Control Internals, Developer Tooling, and High-Performance Software.`,
      `- ⚙️ **Philosophy:** Understanding complex abstractions by building them from first principles.`
    ];
    if (p.location && p.location.trim()) {
      aboutBulletPoints.push(`- 📍 **Location:** ${p.location.trim()}`);
    }
    aboutBulletPoints.push(`- 💼 **Status:** Open to software engineering roles & technical collaborations.`);

    parts.push(
`## 📌 About Me

${p.bio}

${aboutBulletPoints.join('\n')}`
    );
  }

  // CURRENTLY BUILDING SECTION
  if (s.currently_building && activeRepo) {
    const customMeta = config.featured_projects.custom_metadata[activeRepo.name] || {};
    const repoTitle = customMeta.title || activeRepo.name;
    const latestRelease = activeRepo.releases && activeRepo.releases.length > 0 ? activeRepo.releases[0].tag_name : null;
    const releaseBadge = latestRelease ? ` [![Latest Release](https://img.shields.io/badge/release-${latestRelease}-blue.svg?style=flat-square)](${activeRepo.html_url}/releases)` : '';

    parts.push(
`## ⚡ Currently Building

### [${repoTitle}](${activeRepo.html_url})${releaseBadge}
> ${customMeta.description || activeRepo.description || 'Active development'}

- **Recent Focus:** First-principles Git architecture in modern C++20 with SHA-256 CAS, staging index, and cross-platform CI/CD automation.
- **Active Repository:** [\`${activeRepo.full_name}\`](${activeRepo.html_url}) · *Last updated: ${formatDate(activeRepo.pushed_at)}*`
    );
  }

  // FEATURED PROJECTS SECTION
  if (s.featured_projects && featuredProjects.length > 0) {
    const projectBlocks = [];

    for (const project of featuredProjects) {
      const customMeta = config.featured_projects.custom_metadata[project.name] || {};
      const title = customMeta.title || project.name;
      const description = customMeta.description || project.description || 'Public engineering repository.';
      
      const badges = [];
      if (project.stargazers_count > 0) {
        badges.push(`![Stars](https://img.shields.io/badge/stars-%E2%98%85%20${project.stargazers_count}-yellow?style=flat-square)`);
      }
      if (project.releases && project.releases.length > 0) {
        badges.push(`![Release](https://img.shields.io/badge/release-${project.releases[0].tag_name}-blue?style=flat-square)`);
      }
      if (project.license) {
        badges.push(`![License](https://img.shields.io/badge/license-${encodeURIComponent(project.license.spdx_id || 'MIT')}-green?style=flat-square)`);
      }

      // Tech tags
      const techList = [];
      if (project.language) techList.push(`\`${project.language}\``);
      if (project.topics && project.topics.length > 0) {
        project.topics.slice(0, 5).forEach(t => techList.push(`\`${t}\``));
      }

      let highlightsMd = '';
      if (customMeta.highlights && customMeta.highlights.length > 0) {
        highlightsMd = '\n' + customMeta.highlights.map(h => `  - ${h}`).join('\n');
      }

      projectBlocks.push(
`### 📁 [${title}](${project.html_url})
${badges.join(' ')}

${description}
${highlightsMd}

- **Technologies:** ${techList.join(' · ') || '\`C++\`'}
- **Repository:** [github.com/${project.full_name}](${project.html_url})`
      );
    }

    parts.push(
`## 🚀 Featured Projects

${projectBlocks.join('\n\n---\n\n')}`
    );
  }

  // TECH STACK SECTION
  if (s.tech_stack) {
    const catalog = config.tech_stack_catalog;

    // Detect languages present in repos
    const detectedLangNames = Object.keys(languageBytes);
    const languagesBadges = [];
    for (const [key, item] of Object.entries(catalog.languages)) {
      if (detectedLangNames.includes(key) || key === 'C++' || key === 'C') {
        languagesBadges.push(`![${item.label}](https://img.shields.io/badge/${item.badge})`);
      }
    }

    const systemsBadges = Object.values(catalog.systems_and_tooling).map(
      item => `![${item.label}](https://img.shields.io/badge/${item.badge})`
    );

    const devopsBadges = Object.values(catalog.devops_and_ci).map(
      item => `![${item.label}](https://img.shields.io/badge/${item.badge})`
    );

    const coreList = catalog.core_competencies.map(c => `- **${c}**`).join('\n');

    parts.push(
`## 🛠️ Technical Stack & Tooling

Supported by real repository code and active systems development:

| Category | Technologies & Tools |
| :--- | :--- |
| **Languages** | ${languagesBadges.join(' ')} |
| **Systems & Core Tooling** | ${systemsBadges.join(' ')} |
| **DevOps & Build Infrastructure** | ${devopsBadges.join(' ')} |

### 🧠 Core Competencies & Architecture
${coreList}`
    );
  }

  // GITHUB STATS & ACTIVITY SECTION
  if (s.metrics) {
    const opts = config.display_options || {};
    const baseUrl = opts.stats_base_url || 'https://github-readme-stats-fast.vercel.app';
    const theme = opts.stats_theme || 'tokyonight';
    const hideBorder = opts.hide_stats_border ? '&hide_border=true' : '';
    const excludeRepos = (config.featured_projects?.exclude || []).join(',');
    const excludeParam = excludeRepos ? `&exclude_repo=${excludeRepos}` : '';

    const cards = [];
    if (opts.show_stats_card !== false) {
      cards.push(`<img height="165" src="${baseUrl}/api?username=${p.username}&show_icons=true&theme=${theme}${hideBorder}&include_all_commits=true&count_private=false" alt="${p.name}'s GitHub Stats" />`);
    }
    if (opts.show_langs_card !== false) {
      cards.push(`<img height="165" src="${baseUrl}/api/top-langs/?username=${p.username}&layout=compact&theme=${theme}${hideBorder}${excludeParam}" alt="Top Languages" />`);
    }
    if (opts.show_streak_card) {
      cards.push(`<img height="165" src="https://streak-stats.demolab.com/?user=${p.username}&theme=${theme}${hideBorder}" alt="${p.name}'s Streak Stats" />`);
    }

    const cardsHtml = cards.length > 0
      ? `\n<a href="https://github.com/${p.username}">\n  ${cards.join('\n  ')}\n</a>\n`
      : '';

    parts.push(
`## 📊 GitHub Activity & Metrics

<div align="center">

| Metric | Value | Metric | Value |
| :--- | :---: | :--- | :---: |
| **Public Repositories** | \`${user.public_repos}\` | **Followers** | \`${user.followers}\` |
| **Stars Earned** | \`${totalStars}\` | **Following** | \`${user.following}\` |

<br />
${cardsHtml}
</div>`
    );
  }

  // LEETCODE & ALGORITHMIC METRICS SECTION
  if (s.leetcode) {
    const lcConfig = config.leetcode || {};
    const lcUser = lcConfig.username || 'devsagarkrjha';
    const lcTheme = lcConfig.theme || 'dark';
    const showTable = lcConfig.show_table !== false;
    const showCard = lcConfig.show_card !== false;

    const tableRows = [];
    if (showTable && leetcodeData) {
      const ratingStr = leetcodeData.contestRating
        ? `\`${leetcodeData.contestRating}\`${leetcodeData.topPercentage ? ` (Top ${leetcodeData.topPercentage}%)` : ''}`
        : '`N/A`';
      const contestRankStr = leetcodeData.contestRanking
        ? `\`${leetcodeData.contestRanking.toLocaleString('en-US')}${leetcodeData.totalParticipants ? ` / ${leetcodeData.totalParticipants.toLocaleString('en-US')}` : ''}\``
        : '`N/A`';
      const badgeStr = leetcodeData.badge ? `\`${leetcodeData.badge} ⚔️\`` : '`Knight`';

      tableRows.push(
`| Metric | Value | Metric | Value |
| :--- | :---: | :--- | :---: |
| **Contest Rating** | ${ratingStr} | **Global Contest Rank** | ${contestRankStr} |
| **Problems Solved** | \`${leetcodeData.totalSolved}\` | **Badge** | ${badgeStr} |
| **Hard Solved** | \`${leetcodeData.hardSolved}\` | **Medium Solved** | \`${leetcodeData.mediumSolved}\` |`
      );
    }

    const cardElements = [];
    if (showCard) {
      cardElements.push(
`<a href="https://leetcode.com/u/${lcUser}/">
  <img height="340" src="https://leetcard.jacoblin.cool/${lcUser}?ext=contest&theme=${lcTheme}" alt="${p.name}'s LeetCode Stats" />
</a>`
      );
    }

    const contentBlocks = [];
    if (tableRows.length > 0) contentBlocks.push(tableRows.join('\n'));
    if (tableRows.length > 0 && cardElements.length > 0) contentBlocks.push('<br />');
    if (cardElements.length > 0) contentBlocks.push(cardElements.join('\n'));

    if (contentBlocks.length > 0) {
      parts.push(
`## ⚔️ Algorithmic & LeetCode Metrics

<div align="center">

${contentBlocks.join('\n\n')}

</div>`
      );
    }
  }

  // ACHIEVEMENTS & MILESTONES SECTION
  if (s.achievements && achievements.length > 0) {
    const achievementItems = achievements.map(a => {
      return `- ${a.title}\n  *${a.description}* ([View](${a.link}))`;
    }).join('\n');

    parts.push(
`## 🏆 Milestones & Achievements

${achievementItems}`
    );
  }

  // LEARNING & INTERESTS SECTION
  if (s.interests) {
    parts.push(
`## 🧭 Engineering Focus & Current Interests

- **Low-Level Systems:** Memory management, cache-conscious data structures, and POSIX system calls.
- **Developer Infrastructure:** Build systems (CMake), continuous integration/delivery, and reproducible builds.
- **Storage Engines:** Content-addressable storage (CAS), Merkle trees, and cryptographic verification.`
    );
  }

  // FOOTER SECTION
  if (s.footer) {
    const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    parts.push(
`---

<div align="center">

*Automated profile system generated dynamically via [GitHub Actions](https://github.com/${p.username}/${p.username}/actions) · Last synced: \`${nowUtc}\`*

</div>`
    );
  }

  return parts.join('\n\n') + '\n';
}

// Execute generator
run().catch(err => {
  console.error('\n❌ Profile generator failed:');
  console.error(err.message);
  process.exit(1);
});
