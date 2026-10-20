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
 * Helper to fetch GitHub telemetry metrics (commits, prs, issues, streak, loc)
 */
async function fetchTelemetry(username) {
  const result = {
    commits: null,
    prs: null,
    issues: null,
    contributions: null,
    currentStreak: null,
    longestStreak: null,
    loc: null
  };

  const safeFetchText = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  try {
    const [statsText, streakText, locText] = await Promise.all([
      safeFetchText(`https://github-readme-stats-fast.vercel.app/api?username=${username}`),
      safeFetchText(`https://streak-stats.demolab.com/?user=${username}`),
      safeFetchText(`https://readme-line-counter.vercel.app/${username}?category=lines&theme=sunset`, 10000)
    ]);

    if (statsText) {
      const commitsMatch = statsText.match(/Total Commits[^:]*:\s*<\/text>\s*<text[^>]*>\s*([0-9,]+)/i);
      const prsMatch = statsText.match(/Total PRs:\s*<\/text>\s*<text[^>]*>\s*([0-9,]+)/i);
      const issuesMatch = statsText.match(/Total Issues:\s*<\/text>\s*<text[^>]*>\s*([0-9,]+)/i);
      if (commitsMatch) result.commits = commitsMatch[1];
      if (prsMatch) result.prs = prsMatch[1];
      if (issuesMatch) result.issues = issuesMatch[1];
    }

    if (streakText) {
      const contribMatch = streakText.match(/Total Contributions[\s\S]*?<text[^>]*>\s*([0-9,]+)\s*<\/text>/i)
        || streakText.match(/<text[^>]*font-size=.28px.[^>]*>\s*([0-9,]+)\s*<\/text>[\s\S]*?Total Contributions/i);
      const currentStreakMatch = streakText.match(/Current Streak[\s\S]*?<text[^>]*>\s*([0-9,]+)\s*<\/text>/i)
        || streakText.match(/<text[^>]*font-size=.28px.[^>]*>\s*([0-9,]+)\s*<\/text>[\s\S]*?Current Streak/i);
      const longestStreakMatch = streakText.match(/Longest Streak[\s\S]*?<text[^>]*>\s*([0-9,]+)\s*<\/text>/i)
        || streakText.match(/<text[^>]*font-size=.28px.[^>]*>\s*([0-9,]+)\s*<\/text>[\s\S]*?Longest Streak/i);

      if (contribMatch) result.contributions = contribMatch[1];
      if (currentStreakMatch) result.currentStreak = currentStreakMatch[1];
      if (longestStreakMatch) result.longestStreak = longestStreakMatch[1];
    }

    if (locText) {
      const locMatch = locText.match(/<text[^>]*font-size="72"[^>]*>\s*([0-9,]+)\s*<\/text>/);
      if (locMatch) result.loc = locMatch[1];
    }
  } catch (err) {
    console.warn(`⚠️  Failed to fetch telemetry metrics: ${err.message}`);
  }

  return result;
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

  // Determine featured projects: pinned repos as Featured Projects, rest as Other Projects
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

  const featuredProjects = enrichedRepos.filter(r => pinnedSet.has(r.name));
  const otherProjects = enrichedRepos.filter(r => !pinnedSet.has(r.name));

  // Determine "Currently Building"
  const activeRepo = enrichedRepos.find(r => !excludeSet.has(r.name));

  // Determine achievements
  const achievements = [];

  // XERJ Corpus Hub contributor recognition
  achievements.push({
    type: 'curation',
    title: 'Recognized as **XERJ Corpus Hub Contributor**',
    description: 'Work in [`sagarkrjha/minigit`](https://github.com/sagarkrjha/minigit) selected as open reference memory for AI coding agents.',
    link: 'https://hub.xerj.org/contributors/sagarkrjha.html'
  });
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

  // 3. Fetch LeetCode stats (if enabled for metrics or achievements)
  let leetcodeData = null;
  const lcUsername = config.leetcode?.username || 'devsagarkrjha';
  const showLcAchievements = config.leetcode?.show_achievements !== false;
  const showLcRating = config.leetcode?.show_rating !== false;
  const showLcBadge = config.leetcode?.show_badge !== false;

  if ((config.sections?.leetcode || (config.sections?.achievements !== false && showLcAchievements)) && lcUsername) {
    console.log(`📡 Fetching LeetCode data for @${lcUsername}...`);
    leetcodeData = await fetchLeetCode(lcUsername);
    if (leetcodeData) {
      console.log(`  ↳ LeetCode Solved: ${leetcodeData.totalSolved}, Rating: ${leetcodeData.contestRating || 'N/A'}`);
    }
  }

  if (showLcAchievements && leetcodeData && (showLcRating || showLcBadge || leetcodeData.totalSolved > 0)) {
    if (showLcRating && leetcodeData.contestRating) {
      const badgeName = (showLcBadge && leetcodeData.badge) ? `LeetCode ${leetcodeData.badge}` : 'LeetCode Competitive Programmer';
      const topPercentStr = leetcodeData.topPercentage ? ` (Top ${leetcodeData.topPercentage}% globally)` : '';
      achievements.push({
        type: 'leetcode',
        title: `Achieved **${badgeName}** · **${leetcodeData.contestRating} Contest Rating**${topPercentStr}`,
        description: `Solved **${leetcodeData.totalSolved}+ algorithmic problems** (${leetcodeData.hardSolved} Hard, ${leetcodeData.mediumSolved} Medium) with a peak contest rating of **${leetcodeData.contestRating}**.`,
        link: `https://leetcode.com/u/${lcUsername}/`
      });
    } else if (showLcBadge && leetcodeData.badge) {
      achievements.push({
        type: 'leetcode',
        title: `Achieved **LeetCode ${leetcodeData.badge}**`,
        description: `Solved **${leetcodeData.totalSolved}+ algorithmic problems** (${leetcodeData.hardSolved} Hard, ${leetcodeData.mediumSolved} Medium).`,
        link: `https://leetcode.com/u/${lcUsername}/`
      });
    } else if (leetcodeData.totalSolved > 0) {
      achievements.push({
        type: 'leetcode',
        title: `Solved **${leetcodeData.totalSolved}+ Algorithmic Problems** on LeetCode`,
        description: `Demonstrated algorithmic problem solving across ${leetcodeData.hardSolved} Hard and ${leetcodeData.mediumSolved} Medium challenges.`,
        link: `https://leetcode.com/u/${lcUsername}/`
      });
    }
  }

  if (totalStars >= 5) {
    achievements.push({
      type: 'stars',
      title: `Earned **${totalStars}+ GitHub Stars** across open-source systems projects.`,
      description: `Recognized for building first-principles developer tooling and version control architecture.`,
      link: `https://github.com/${username}?tab=repositories`
    });
  }

  // 4. Fetch telemetry metrics (commits, prs, issues, streaks, lines of code)
  console.log('📡 Fetching GitHub telemetry & activity metrics...');
  const telemetry = await fetchTelemetry(username);
  if (telemetry.loc) console.log(`  ↳ Lines of Code: ${telemetry.loc}`);
  if (telemetry.contributions) console.log(`  ↳ Contributions: ${telemetry.contributions}`);

  // 5. Assemble Markdown sections
  console.log('📝 Assembling README markdown...');
  const markdown = buildMarkdown({
    config,
    user,
    totalStars,
    totalForks,
    languageBytes,
    featuredProjects,
    otherProjects,
    validRepos,
    activeRepo,
    achievements,
    leetcodeData,
    telemetry
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
function buildMarkdown({ config, user, totalStars, totalForks, languageBytes, featuredProjects, otherProjects = [], validRepos = [], activeRepo, achievements, leetcodeData, telemetry = {} }) {
  const p = config.profile;
  const s = config.sections;
  const parts = [];

  // HEADER SECTION (Resume Contact Header)
  if (s.header) {
    const contactLinks = [];
    if (p.socials.github) {
      contactLinks.push(`[GitHub](${p.socials.github})`);
    }
    if (p.socials.linkedin) {
      contactLinks.push(`[LinkedIn](${p.socials.linkedin})`);
    }
    if (p.socials.twitter) {
      contactLinks.push(`[X / Twitter](${p.socials.twitter})`);
    }
    if (p.socials.leetcode) {
      contactLinks.push(`[LeetCode](${p.socials.leetcode})`);
    }
    if (p.socials.discord) {
      contactLinks.push(`[Discord](${p.socials.discord})`);
    }
    if (p.socials.email) {
      const emailUrl = p.socials.email.startsWith('mailto:') ? p.socials.email : `mailto:${p.socials.email}`;
      contactLinks.push(`[Email](${emailUrl})`);
    }
    if (p.socials.resume) {
      contactLinks.push(`[Resume](${p.socials.resume})`);
    }

    const locationLine = p.location ? ` · *${p.location}*` : '';

    parts.push(
`# ${p.name}
**${p.tagline}**${locationLine}

${contactLinks.join(' · ')}`
    );
  }

  // 1. SUMMARY / ABOUT ME (Resume Professional Summary)
  if (s.about) {
    const summaryBullets = [
      `- **Focus:** Systems Programming, Version Control Internals, Developer Tooling, High-Performance Software.`,
      `- **Philosophy:** Understanding complex abstractions by engineering them from first principles.`,
      `- **Status:** Open to software engineering roles & technical collaborations.`
    ];

    parts.push(
`## Summary

${p.bio}

${summaryBullets.join('\n')}`
    );
  }

  // 2. TECHNICAL SKILLS (Resume Technical Skills)
  if (s.tech_stack) {
    const catalog = config.tech_stack_catalog;
    const detectedLangNames = new Set(Object.keys(languageBytes));
    // Also include primary repo languages from enriched repos
    for (const repo of validRepos || []) {
      if (repo.language) detectedLangNames.add(repo.language);
    }
    const languagesList = [];
    for (const [key, item] of Object.entries(catalog.languages)) {
      if (detectedLangNames.size === 0 || detectedLangNames.has(key) || key === 'C++' || key === 'C' || key === 'TypeScript') {
        languagesList.push(item.label || key);
      }
    }

    const systemsList = Object.values(catalog.systems_and_tooling).map(item => item.label);
    const devopsList = Object.values(catalog.devops_and_ci).map(item => item.label);
    const coreList = catalog.core_competencies.join(' · ');

    parts.push(
`## Technical Skills

- **Languages:** ${languagesList.map(l => `\`${l}\``).join(', ')}
- **Systems & Core Tooling:** ${systemsList.map(s => `\`${s}\``).join(', ')}
- **DevOps & Infrastructure:** ${devopsList.map(d => `\`${d}\``).join(', ')}
- **Architecture & Competencies:** ${coreList}`
    );
  }

  // 3. PROJECTS (Resume Projects Section)
  if (s.featured_projects && featuredProjects.length > 0) {
    const projectBlocks = [];

    for (const project of featuredProjects) {
      const customMeta = config.featured_projects.custom_metadata[project.name] || {};
      const title = customMeta.title || project.name;
      const description = customMeta.description || project.description || 'Public engineering repository.';

      const metaTokens = [];
      if (project.language) metaTokens.push(`\`${project.language}\``);
      if (project.stargazers_count > 0) metaTokens.push(`★ ${project.stargazers_count}`);
      if (project.releases && project.releases.length > 0) {
        metaTokens.push(`Release: [${project.releases[0].tag_name}](${project.releases[0].html_url || project.html_url})`);
      }
      metaTokens.push(`[Repository](${project.html_url})`);

      let highlightsMd = '';
      if (customMeta.highlights && customMeta.highlights.length > 0) {
        highlightsMd = '\n' + customMeta.highlights.map(h => `- ${h}`).join('\n');
      }

      projectBlocks.push(
`### [${title}](${project.html_url})
*${metaTokens.join(' · ')}*

${description}
${highlightsMd}`
      );
    }

    parts.push(
`## Featured Projects

${projectBlocks.join('\n\n')}`
    );
  }

  // 4. OTHER PROJECTS (Resume Additional Projects)
  if (s.other_projects && otherProjects.length > 0) {
    const otherItems = otherProjects.map(project => {
      const customMeta = config.featured_projects.custom_metadata[project.name] || {};
      const title = customMeta.title || project.name;
      const description = customMeta.description || project.description || 'Public engineering repository.';
      const lang = project.language ? `\`${project.language}\` · ` : '';
      return `- **[${title}](${project.html_url})** — ${lang}${description}`;
    });

    parts.push(
`## Additional Projects

${otherItems.join('\n')}`
    );
  }

  // 5. CURRENT FOCUS (Currently Building)
  if (s.currently_building && activeRepo) {
    const customMeta = config.featured_projects.custom_metadata[activeRepo.name] || {};
    const repoTitle = customMeta.title || activeRepo.name;
    const desc = customMeta.description || activeRepo.description || 'Active development';
    // Clean description of badges for bullet point presentation
    const cleanDesc = desc.replace(/\n\n\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '');

    parts.push(
`## Current Focus

- **Active Development:** [**${repoTitle}**](${activeRepo.html_url}) — ${cleanDesc}
- **Recent Work:** Modern C++20 implementation of Git internals with SHA-256 CAS, staging index, and cross-platform releases.`
    );
  }

  // 6. METRICS & ACTIVITY (Resume Technical Activity)
  if (s.metrics) {
    const opts = config.display_options || {};
    const metricsRows = [
      { label: 'Public Repositories', value: `\`${user.public_repos}\`` },
      { label: 'Total Stars Earned', value: `\`${totalStars}\`` }
    ];

    if (telemetry.loc && opts.show_loc !== false) {
      metricsRows.push({ label: 'Total Lines of Code', value: `\`${telemetry.loc}\`` });
    }

    if (telemetry.contributions && opts.show_contributions !== false) {
      metricsRows.push({ label: 'Public Contributions', value: `\`${telemetry.contributions}\`` });
    }

    if (telemetry.commits) {
      metricsRows.push({ label: 'Total Commits', value: `\`${telemetry.commits}\`` });
    }

    if (telemetry.prs) {
      metricsRows.push({ label: 'Pull Requests Opened', value: `\`${telemetry.prs}\`` });
    }

    if (telemetry.currentStreak) {
      metricsRows.push({ label: 'Current Streak', value: `\`${telemetry.currentStreak} days\`` });
    }

    if (telemetry.longestStreak) {
      metricsRows.push({ label: 'Longest Streak', value: `\`${telemetry.longestStreak} days\`` });
    }

    metricsRows.push({ label: 'Followers', value: `\`${user.followers}\`` });
    metricsRows.push({ label: 'Following', value: `\`${user.following}\`` });

    const pairedRows = [];
    for (let i = 0; i < metricsRows.length; i += 2) {
      const left = metricsRows[i];
      const right = metricsRows[i + 1] || { label: '', value: '' };
      pairedRows.push(`| **${left.label}** | ${left.value} | ${right.label ? `**${right.label}**` : ''} | ${right.value} |`);
    }

    const tableMd = `| Metric | Value | Metric | Value |\n| :--- | :---: | :--- | :---: |\n${pairedRows.join('\n')}`;

    const totalCodeBytes = Object.values(languageBytes).reduce((acc, b) => acc + b, 0);
    const topLanguages = Object.entries(languageBytes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, bytes]) => {
        const pct = totalCodeBytes > 0 ? ((bytes / totalCodeBytes) * 100).toFixed(1) : 0;
        return `\`${lang}\` (${pct}%)`;
      });
    const langLine = topLanguages.length > 0 ? `\n\n- **Codebase Composition:** ${topLanguages.join(' · ')}` : '';

    parts.push(
`## Engineering Activity

${tableMd}${langLine}`
    );
  }

  // 7. LEETCODE (Algorithmic Problem Solving)
  if (s.leetcode && leetcodeData) {
    const lcConfig = config.leetcode || {};
    const lcUser = lcConfig.username || 'devsagarkrjha';

    const cells = [];
    cells.push({ label: 'Problems Solved', value: `\`${leetcodeData.totalSolved}\`` });
    cells.push({ label: 'Hard Solved', value: `\`${leetcodeData.hardSolved}\`` });
    cells.push({ label: 'Medium Solved', value: `\`${leetcodeData.mediumSolved}\`` });
    cells.push({ label: 'Easy Solved', value: `\`${leetcodeData.easySolved}\`` });

    const pairs = [];
    for (let i = 0; i < cells.length; i += 2) {
      const left = cells[i];
      const right = cells[i + 1] || { label: '', value: '' };
      pairs.push(`| **${left.label}** | ${left.value} | ${right.label ? `**${right.label}**` : ''} | ${right.value} |`);
    }

    const tableMd = `| Metric | Value | Metric | Value |\n| :--- | :---: | :--- | :---: |\n${pairs.join('\n')}`;

    parts.push(
`## Problem Solving & Algorithms

${tableMd}

- **LeetCode Profile:** [leetcode.com/u/${lcUser}](https://leetcode.com/u/${lcUser}/)`
    );
  }

  // 8. ACHIEVEMENTS & MILESTONES (Resume Honors / Highlights)
  if (s.achievements && achievements.length > 0) {
    const achievementItems = achievements.map(a => {
      return `- ${a.title} — *${a.description}* ([View](${a.link}))`;
    }).join('\n');

    parts.push(
`## Milestones & Highlights

${achievementItems}`
    );
  }

  // 9. FOOTER
  if (s.footer) {
    const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    parts.push(
`---

*Profile generated dynamically via [GitHub Actions](https://github.com/${p.username}/${p.username}/actions) · Last synced: \`${nowUtc}\`*`
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
