use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Utc;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Config {
    pub profile: ProfileConfig,
    pub sections: SectionConfig,
    pub featured_projects: FeaturedProjectsConfig,
    pub tech_stack_catalog: TechStackCatalog,
    #[serde(default)]
    pub display_options: DisplayOptions,
    #[serde(default)]
    pub leetcode: LeetCodeConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProfileConfig {
    pub username: String,
    pub name: String,
    pub role: String,
    pub tagline: String,
    pub bio: String,
    pub location: String,
    pub socials: SocialsConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SocialsConfig {
    pub linkedin: Option<String>,
    pub twitter: Option<String>,
    pub leetcode: Option<String>,
    pub discord: Option<String>,
    pub resume: Option<String>,
    pub instagram: Option<String>,
    pub youtube: Option<String>,
    pub email: Option<String>,
    pub github: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SectionConfig {
    #[serde(default = "default_true")]
    pub header: bool,
    #[serde(default = "default_true")]
    pub about: bool,
    #[serde(default = "default_true")]
    pub currently_building: bool,
    #[serde(default = "default_true")]
    pub featured_projects: bool,
    #[serde(default = "default_true")]
    pub other_projects: bool,
    #[serde(default = "default_true")]
    pub tech_stack: bool,
    #[serde(default = "default_true")]
    pub metrics: bool,
    #[serde(default = "default_true")]
    pub leetcode: bool,
    #[serde(default = "default_true")]
    pub achievements: bool,
    #[serde(default = "default_true")]
    pub interests: bool,
    #[serde(default = "default_true")]
    pub footer: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct FeaturedProjectsConfig {
    #[serde(default = "default_max_count")]
    pub max_count: usize,
    #[serde(default)]
    pub pinned: Vec<String>,
    #[serde(default)]
    pub exclude: Vec<String>,
    #[serde(default)]
    pub include_forks: bool,
    #[serde(default)]
    pub custom_metadata: HashMap<String, ProjectCustomMeta>,
}

fn default_max_count() -> usize {
    6
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct ProjectCustomMeta {
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub highlights: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TechStackCatalog {
    pub languages: HashMap<String, TechItem>,
    #[serde(default)]
    pub frameworks_and_frontend: HashMap<String, TechItem>,
    pub systems_and_tooling: HashMap<String, TechItem>,
    pub devops_and_ci: HashMap<String, TechItem>,
    pub core_competencies: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TechItem {
    pub badge: String,
    pub label: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct DisplayOptions {
    pub format: Option<String>,
    pub stats_base_url: Option<String>,
    pub stats_theme: Option<String>,
    pub hide_stats_border: Option<bool>,
    pub show_stats_card: Option<bool>,
    pub show_streak_card: Option<bool>,
    pub show_langs_card: Option<bool>,
    pub show_loc_card: Option<bool>,
    pub show_contributions_graph: Option<bool>,
    pub show_table: Option<bool>,
    pub show_loc: Option<bool>,
    pub show_contributions: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct LeetCodeConfig {
    pub username: Option<String>,
    pub format: Option<String>,
    pub theme: Option<String>,
    pub font: Option<String>,
    pub ext: Option<String>,
    pub show_table: Option<bool>,
    pub show_card: Option<bool>,
    pub show_rating: Option<bool>,
    pub show_badge: Option<bool>,
    pub show_achievements: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub public_repos: u64,
    pub followers: u64,
    pub following: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GitHubRepo {
    pub name: String,
    pub description: Option<String>,
    pub html_url: String,
    #[serde(default)]
    pub stargazers_count: u64,
    #[serde(default)]
    pub forks_count: u64,
    #[serde(default)]
    pub fork: bool,
    #[serde(default)]
    pub pushed_at: Option<String>,
    pub language: Option<String>,
    pub languages_url: Option<String>,
    pub releases_url: Option<String>,
    #[serde(skip)]
    pub languages: HashMap<String, u64>,
    #[serde(skip)]
    pub releases: Vec<GitHubRelease>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GitHubRelease {
    pub tag_name: Option<String>,
    pub name: Option<String>,
    pub html_url: Option<String>,
    pub published_at: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct LeetCodeStats {
    pub username: String,
    pub ranking: Option<u64>,
    pub total_solved: u64,
    pub easy_solved: u64,
    pub medium_solved: u64,
    pub hard_solved: u64,
    pub contest_rating: Option<u64>,
    pub exact_rating: Option<f64>,
    pub contest_ranking: Option<u64>,
    pub total_participants: Option<u64>,
    pub top_percentage: Option<f64>,
    pub attended_contests: u64,
    pub badge: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct TelemetryMetrics {
    pub commits: Option<String>,
    pub prs: Option<String>,
    pub issues: Option<String>,
    pub contributions: Option<String>,
    pub current_streak: Option<String>,
    pub longest_streak: Option<String>,
    pub loc: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AchievementItem {
    pub ach_type: String,
    pub title: String,
    pub description: String,
    pub link: String,
    pub date: Option<String>,
}

/// Helper to build HTTP client with headers
fn create_http_client(token: Option<&str>) -> reqwest::Client {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("sagarkrjha-profile-updater/1.0"));
    headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
    headers.insert("X-GitHub-Api-Version", HeaderValue::from_static("2022-11-28"));

    if let Some(tok) = token {
        if let Ok(mut val) = HeaderValue::from_str(&format!("Bearer {}", tok)) {
            val.set_sensitive(true);
            headers.insert(reqwest::header::AUTHORIZATION, val);
        }
    }

    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to build HTTP client")
}

/// Dynamic Pinned Repositories fetcher
/// Priority:
/// 1. GitHub GraphQL API
/// 2. Public profile HTML scraping
/// 3. config.json static list
async fn fetch_pinned_repositories(
    client: &reqwest::Client,
    username: &str,
    has_token: bool,
    fallback_list: &[String],
) -> Vec<String> {
    if has_token {
        let gql_query = serde_json::json!({
            "query": "query($login: String!) { user(login: $login) { pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name } } } } }",
            "variables": { "login": username }
        });

        match client
            .post("https://api.github.com/graphql")
            .json(&gql_query)
            .send()
            .await
        {
            Ok(res) if res.status().is_success() => {
                if let Ok(body) = res.json::<serde_json::Value>().await {
                    if let Some(nodes) = body["data"]["user"]["pinnedItems"]["nodes"].as_array() {
                        let names: Vec<String> = nodes
                            .iter()
                            .filter_map(|n| n["name"].as_str().map(|s| s.to_string()))
                            .collect();
                        if !names.is_empty() {
                            println!(
                                "📌 Retrieved {} pinned repositories dynamically via GraphQL: [{}]",
                                names.len(),
                                names.join(", ")
                            );
                            return names;
                        }
                    }
                }
            }
            Ok(res) => {
                eprintln!("⚠️  GraphQL API returned non-success: HTTP {}", res.status());
            }
            Err(e) => {
                eprintln!("⚠️  Failed to query GraphQL API: {}", e);
            }
        }
    }

    // Fallback: Scrape public profile HTML
    match client
        .get(format!("https://github.com/{}", username))
        .header(ACCEPT, "text/html,application/xhtml+xml")
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => {
            if let Ok(html) = res.text().await {
                let re = Regex::new(r#"<span class="repo"[^>]*>([^<]+)</span>"#).unwrap();
                let names: Vec<String> = re
                    .captures_iter(&html)
                    .filter_map(|c| c.get(1).map(|m| m.as_str().trim().to_string()))
                    .collect();
                if !names.is_empty() {
                    println!(
                        "📌 Retrieved {} pinned repositories dynamically via profile scraping: [{}]",
                        names.len(),
                        names.join(", ")
                    );
                    return names;
                }
            }
        }
        _ => {}
    }

    println!(
        "📌 Using fallback pinned repositories from configuration: [{}]",
        fallback_list.join(", ")
    );
    fallback_list.to_vec()
}

/// Helper to fetch LeetCode statistics
async fn fetch_leetcode(client: &reqwest::Client, username: &str) -> Option<LeetCodeStats> {
    if username.is_empty() {
        return None;
    }

    let query = r#"query userProfile($username: String!) {
        matchedUser(username: $username) {
            profile { ranking }
            submitStats {
                acSubmissionNum { difficulty count }
            }
        }
        userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            totalParticipants
            topPercentage
            badge { name }
        }
    }"#;

    let body = serde_json::json!({
        "query": query,
        "variables": { "username": username }
    });

    let res = client
        .post("https://leetcode.com/graphql")
        .header("Referer", "https://leetcode.com")
        .json(&body)
        .send()
        .await
        .ok()?;

    if !res.status().is_success() {
        return None;
    }

    let json: serde_json::Value = res.json().await.ok()?;
    let matched_user = json.get("data")?.get("matchedUser")?;
    let contest = json.get("data")?.get("userContestRanking");

    let ranking = matched_user["profile"]["ranking"].as_u64();
    let subs = matched_user["submitStats"]["acSubmissionNum"].as_array();

    let mut total_solved = 0;
    let mut easy_solved = 0;
    let mut medium_solved = 0;
    let mut hard_solved = 0;

    if let Some(arr) = subs {
        for s in arr {
            let diff = s["difficulty"].as_str().unwrap_or("");
            let count = s["count"].as_u64().unwrap_or(0);
            match diff {
                "All" => total_solved = count,
                "Easy" => easy_solved = count,
                "Medium" => medium_solved = count,
                "Hard" => hard_solved = count,
                _ => {}
            }
        }
    }

    let mut stats = LeetCodeStats {
        username: username.to_string(),
        ranking,
        total_solved,
        easy_solved,
        medium_solved,
        hard_solved,
        ..Default::default()
    };

    if let Some(c) = contest {
        if !c.is_null() {
            stats.attended_contests = c["attendedContestsCount"].as_u64().unwrap_or(0);
            if let Some(r) = c["rating"].as_f64() {
                stats.exact_rating = Some(r);
                stats.contest_rating = Some(r.round() as u64);
            }
            stats.contest_ranking = c["globalRanking"].as_u64();
            stats.total_participants = c["totalParticipants"].as_u64();
            stats.top_percentage = c["topPercentage"].as_f64();
            stats.badge = c["badge"]["name"].as_str().map(|s| s.to_string());
        }
    }

    Some(stats)
}

/// Helper to fetch GitHub telemetry metrics
async fn fetch_telemetry(client: &reqwest::Client, username: &str) -> TelemetryMetrics {
    let mut result = TelemetryMetrics::default();

    let stats_url = format!("https://github-readme-stats-fast.vercel.app/api?username={}", username);
    let streak_url = format!("https://streak-stats.demolab.com/?user={}", username);
    let loc_url = format!("https://readme-line-counter.vercel.app/{}?category=lines&theme=sunset", username);

    let (stats_res, streak_res, loc_res) = tokio::join!(
        client.get(&stats_url).timeout(Duration::from_secs(8)).send(),
        client.get(&streak_url).timeout(Duration::from_secs(8)).send(),
        client.get(&loc_url).timeout(Duration::from_secs(10)).send(),
    );

    if let Ok(res) = stats_res {
        if res.status().is_success() {
            if let Ok(text) = res.text().await {
                let re_commits = Regex::new(r"(?i)Total Commits[^:]*:\s*</text>\s*<text[^>]*>\s*([0-9,]+)").unwrap();
                let re_prs = Regex::new(r"(?i)Total PRs:\s*</text>\s*<text[^>]*>\s*([0-9,]+)").unwrap();
                let re_issues = Regex::new(r"(?i)Total Issues:\s*</text>\s*<text[^>]*>\s*([0-9,]+)").unwrap();

                if let Some(c) = re_commits.captures(&text) {
                    result.commits = c.get(1).map(|m| m.as_str().to_string());
                }
                if let Some(c) = re_prs.captures(&text) {
                    result.prs = c.get(1).map(|m| m.as_str().to_string());
                }
                if let Some(c) = re_issues.captures(&text) {
                    result.issues = c.get(1).map(|m| m.as_str().to_string());
                }
            }
        }
    }

    if let Ok(res) = streak_res {
        if res.status().is_success() {
            if let Ok(text) = res.text().await {
                let re_contrib = Regex::new(r"(?is)Total Contributions.*?<text[^>]*>\s*([0-9,]+)\s*</text>").unwrap();
                let re_curr = Regex::new(r"(?is)Current Streak.*?<text[^>]*>\s*([0-9,]+)\s*</text>").unwrap();
                let re_long = Regex::new(r"(?is)Longest Streak.*?<text[^>]*>\s*([0-9,]+)\s*</text>").unwrap();

                if let Some(c) = re_contrib.captures(&text) {
                    result.contributions = c.get(1).map(|m| m.as_str().to_string());
                }
                if let Some(c) = re_curr.captures(&text) {
                    result.current_streak = c.get(1).map(|m| m.as_str().to_string());
                }
                if let Some(c) = re_long.captures(&text) {
                    result.longest_streak = c.get(1).map(|m| m.as_str().to_string());
                }
            }
        }
    }

    if let Ok(res) = loc_res {
        if res.status().is_success() {
            if let Ok(text) = res.text().await {
                let re_loc = Regex::new(r#"<text[^>]*font-size="72"[^>]*>\s*([0-9,]+)\s*</text>"#).unwrap();
                if let Some(c) = re_loc.captures(&text) {
                    result.loc = c.get(1).map(|m| m.as_str().to_string());
                }
            }
        }
    }

    result
}

fn build_markdown(
    config: &Config,
    user: &GitHubUser,
    total_stars: u64,
    language_bytes: &HashMap<String, u64>,
    featured_projects: &[GitHubRepo],
    other_projects: &[GitHubRepo],
    valid_repos: &[GitHubRepo],
    active_repo: Option<&GitHubRepo>,
    achievements: &[AchievementItem],
    leetcode_data: Option<&LeetCodeStats>,
    telemetry: &TelemetryMetrics,
) -> String {
    let p = &config.profile;
    let s = &config.sections;
    let mut parts = Vec::new();

    // HEADER SECTION
    if s.header {
        let mut links = Vec::new();
        if let Some(ref l) = p.socials.github {
            if !l.is_empty() { links.push(format!("[GitHub]({})", l)); }
        }
        if let Some(ref l) = p.socials.linkedin {
            if !l.is_empty() { links.push(format!("[LinkedIn]({})", l)); }
        }
        if let Some(ref l) = p.socials.twitter {
            if !l.is_empty() { links.push(format!("[X / Twitter]({})", l)); }
        }
        if let Some(ref l) = p.socials.leetcode {
            if !l.is_empty() { links.push(format!("[LeetCode]({})", l)); }
        }
        if let Some(ref l) = p.socials.discord {
            if !l.is_empty() { links.push(format!("[Discord]({})", l)); }
        }
        if let Some(ref l) = p.socials.email {
            if !l.is_empty() {
                let url = if l.starts_with("mailto:") { l.clone() } else { format!("mailto:{}", l) };
                links.push(format!("[Email]({})", url));
            }
        }
        if let Some(ref l) = p.socials.resume {
            if !l.is_empty() { links.push(format!("[Resume]({})", l)); }
        }

        let loc_line = if !p.location.is_empty() {
            format!(" · *{}*", p.location)
        } else {
            String::new()
        };

        parts.push(format!(
            "# {}\n**{}**{}\n\n{}",
            p.name,
            p.tagline,
            loc_line,
            links.join(" · ")
        ));
    }

    // 1. SUMMARY
    if s.about {
        let mut focus_items = Vec::new();
        focus_items.push("Systems Programming & Storage Engines (LSM-tree, CAS, WAL)".to_string());
        focus_items.push("Distributed Version Control & Internal Algorithms (Myers $O(ND)$ diff)".to_string());
        focus_items.push("Cross-Platform Developer Tools (Desktop, CLI, VS Code)".to_string());

        let summary_bullets = [
            format!("- **Focus Areas:** {}.", focus_items.join(", ")),
            "- **Engineering Philosophy:** Understanding complex distributed abstractions by building them from first principles.".to_string(),
            "- **Open Collaborations:** Open to software engineering roles & systems collaborations.".to_string(),
        ];

        parts.push(format!(
            "## Summary\n\n{}\n\n{}",
            p.bio,
            summary_bullets.join("\n")
        ));
    }

    // 2. TECHNICAL SKILLS
    if s.tech_stack {
        let catalog = &config.tech_stack_catalog;
        let mut detected_langs: HashSet<String> = language_bytes.keys().cloned().collect();
        for r in valid_repos {
            if let Some(ref lang) = r.language {
                detected_langs.insert(lang.clone());
            }
        }
        // Always include foundational languages demonstrated across repositories and projects
        detected_langs.insert("Rust".to_string());
        detected_langs.insert("C++".to_string());
        detected_langs.insert("C".to_string());
        detected_langs.insert("TypeScript".to_string());
        detected_langs.insert("JavaScript".to_string());

        let lang_order = [
            "C++",
            "C",
            "Rust",
            "TypeScript",
            "JavaScript",
            "Go",
            "Python",
            "Shell",
        ];
        let mut languages_list = Vec::new();
        for key in &lang_order {
            if let Some(item) = catalog.languages.get(*key) {
                if detected_langs.contains(*key) {
                    languages_list.push(format!("`{}`", item.label));
                }
            }
        }

        let fw_order = [
            "Next.js",
            "React",
            "Electron",
            "Tailwind CSS",
            "Node.js",
        ];
        let mut frameworks_list = Vec::new();
        for key in &fw_order {
            if let Some(item) = catalog.frameworks_and_frontend.get(*key) {
                frameworks_list.push(format!("`{}`", item.label));
            }
        }

        let systems_order = [
            "CMake",
            "OpenSSL",
            "Zlib",
            "Git",
            "Linux",
            "Windows",
        ];
        let mut systems_list = Vec::new();
        for key in &systems_order {
            if let Some(item) = catalog.systems_and_tooling.get(*key) {
                systems_list.push(format!("`{}`", item.label));
            }
        }

        let devops_order = [
            "GitHub Actions",
            "Docker",
            "Compilers",
        ];
        let mut devops_list = Vec::new();
        for key in &devops_order {
            if let Some(item) = catalog.devops_and_ci.get(*key) {
                devops_list.push(format!("`{}`", item.label));
            }
        }
        let core_list = catalog.core_competencies.join(" · ");

        let mut skill_lines = Vec::new();
        skill_lines.push(format!("- **Languages:** {}", languages_list.join(", ")));
        if !frameworks_list.is_empty() {
            skill_lines.push(format!("- **Frameworks & Full-Stack:** {}", frameworks_list.join(", ")));
        }
        skill_lines.push(format!("- **Systems & Storage Tooling:** {}", systems_list.join(", ")));
        skill_lines.push(format!("- **DevOps & Infrastructure:** {}", devops_list.join(", ")));
        skill_lines.push(format!("- **Architecture & Competencies:** {}", core_list));

        parts.push(format!(
            "## Technical Skills\n\n{}",
            skill_lines.join("\n")
        ));
    }

    // 3. FEATURED PROJECTS (Dynamically populated with pinned repos)
    if s.featured_projects && !featured_projects.is_empty() {
        let mut project_blocks = Vec::new();

        for project in featured_projects {
            let default_meta = ProjectCustomMeta::default();
            let custom_meta = config
                .featured_projects
                .custom_metadata
                .get(&project.name)
                .unwrap_or(&default_meta);

            let title = custom_meta
                .title
                .as_ref()
                .cloned()
                .unwrap_or_else(|| project.name.clone());
            let description = custom_meta
                .description
                .as_ref()
                .cloned()
                .or_else(|| project.description.clone())
                .unwrap_or_else(|| "Public engineering repository.".to_string());

            let mut meta_tokens = Vec::new();
            if let Some(ref lang) = project.language {
                meta_tokens.push(format!("`{}`", lang));
            }
            if project.stargazers_count > 0 {
                meta_tokens.push(format!("★ {}", project.stargazers_count));
            }
            if let Some(first_rel) = project.releases.first() {
                let tag = first_rel.tag_name.as_deref().unwrap_or("Release");
                let url = first_rel.html_url.as_deref().unwrap_or(&project.html_url);
                meta_tokens.push(format!("Release: [{}]({})", tag, url));
            }
            meta_tokens.push(format!("[Repository]({})", project.html_url));

            let highlights_md = if !custom_meta.highlights.is_empty() {
                format!(
                    "\n\n{}",
                    custom_meta
                        .highlights
                        .iter()
                        .map(|h| format!("- {}", h))
                        .collect::<Vec<_>>()
                        .join("\n")
                )
            } else {
                String::new()
            };

            project_blocks.push(format!(
                "### [{}]({})\n*{}\n\n{}{}",
                title,
                project.html_url,
                meta_tokens.join(" · ") + "*",
                description,
                highlights_md
            ));
        }

        parts.push(format!(
            "## Featured Projects\n\n{}",
            project_blocks.join("\n\n")
        ));
    }

    // 4. ADDITIONAL PROJECTS
    if s.other_projects && !other_projects.is_empty() {
        let other_items: Vec<String> = other_projects
            .iter()
            .map(|project| {
                let default_meta = ProjectCustomMeta::default();
                let custom_meta = config
                    .featured_projects
                    .custom_metadata
                    .get(&project.name)
                    .unwrap_or(&default_meta);
                let title = custom_meta
                    .title
                    .as_ref()
                    .cloned()
                    .unwrap_or_else(|| project.name.clone());
                let description = custom_meta
                    .description
                    .as_ref()
                    .cloned()
                    .or_else(|| project.description.clone())
                    .unwrap_or_else(|| "Public engineering repository.".to_string());
                let lang_token = project
                    .language
                    .as_ref()
                    .map(|l| format!("`{}` · ", l))
                    .unwrap_or_default();
                format!("- **[{}]({})** — {}{}", title, project.html_url, lang_token, description)
            })
            .collect();

        parts.push(format!(
            "## Additional Projects\n\n{}",
            other_items.join("\n")
        ));
    }

    // 5. CURRENT FOCUS
    if s.currently_building {
        if let Some(active) = active_repo {
            let default_meta = ProjectCustomMeta::default();
            let custom_meta = config
                .featured_projects
                .custom_metadata
                .get(&active.name)
                .unwrap_or(&default_meta);
            let repo_title = custom_meta
                .title
                .as_ref()
                .cloned()
                .unwrap_or_else(|| active.name.clone());
            let desc = custom_meta
                .description
                .as_ref()
                .cloned()
                .or_else(|| active.description.clone())
                .unwrap_or_else(|| "Active development".to_string());
            let re_badge = Regex::new(r"\n\n\[!\[.*?\]\(.*?\)\]\(.*?\)").unwrap();
            let clean_desc = re_badge.replace_all(&desc, "");

            parts.push(format!(
                "## Current Focus\n\n- **Active Development:** [**{}**]({}) — {}\n- **Recent Work:** Modern C++20 implementation of Git internals with SHA-256 CAS, staging index, and cross-platform releases.",
                repo_title, active.html_url, clean_desc
            ));
        }
    }

    // 6. ENGINEERING ACTIVITY
    if s.metrics {
        let opts = &config.display_options;
        let mut rows = vec![
            ("Public Repositories", format!("`{}`", user.public_repos)),
            ("Total Stars Earned", format!("`{}`", total_stars)),
        ];

        if opts.show_loc != Some(false) {
            if let Some(ref loc) = telemetry.loc {
                rows.push(("Total Lines of Code", format!("`{}`", loc)));
            }
        }
        if opts.show_contributions != Some(false) {
            if let Some(ref contrib) = telemetry.contributions {
                rows.push(("Public Contributions", format!("`{}`", contrib)));
            }
        }
        if let Some(ref commits) = telemetry.commits {
            rows.push(("Total Commits", format!("`{}`", commits)));
        }
        if let Some(ref prs) = telemetry.prs {
            rows.push(("Pull Requests Opened", format!("`{}`", prs)));
        }
        if let Some(ref curr) = telemetry.current_streak {
            rows.push(("Current Streak", format!("`{} days`", curr)));
        }
        if let Some(ref long) = telemetry.longest_streak {
            rows.push(("Longest Streak", format!("`{} days`", long)));
        }
        rows.push(("Followers", format!("`{}`", user.followers)));
        rows.push(("Following", format!("`{}`", user.following)));

        let mut paired_rows = Vec::new();
        let mut i = 0;
        while i < rows.len() {
            let left = &rows[i];
            let right = rows.get(i + 1);
            let right_label = right.map(|r| format!("**{}**", r.0)).unwrap_or_default();
            let right_val = right.map(|r| r.1.clone()).unwrap_or_default();
            paired_rows.push(format!(
                "| **{}** | {} | {} | {} |",
                left.0, left.1, right_label, right_val
            ));
            i += 2;
        }

        let table_md = format!(
            "| Metric | Value | Metric | Value |\n| :--- | :---: | :--- | :---: |\n{}",
            paired_rows.join("\n")
        );

        let total_bytes: u64 = language_bytes.values().sum();
        let mut sorted_langs: Vec<(&String, &u64)> = language_bytes.iter().collect();
        sorted_langs.sort_by(|a, b| b.1.cmp(a.1));

        let top_langs: Vec<String> = sorted_langs
            .into_iter()
            .take(5)
            .map(|(lang, bytes)| {
                let pct = if total_bytes > 0 {
                    format!("{:.1}", (*bytes as f64 / total_bytes as f64) * 100.0)
                } else {
                    "0".to_string()
                };
                format!("`{}` ({}%)", lang, pct)
            })
            .collect();

        let lang_line = if !top_langs.is_empty() {
            format!("\n\n- **Codebase Composition:** {}", top_langs.join(" · "))
        } else {
            String::new()
        };

        parts.push(format!("## Engineering Activity\n\n{}{}", table_md, lang_line));
    }

    // 7. LEETCODE
    if s.leetcode {
        if let Some(lc) = leetcode_data {
            let lc_user = config.leetcode.username.as_deref().unwrap_or("devsagarkrjha");
            let cells = vec![
                ("Problems Solved", format!("`{}`", lc.total_solved)),
                ("Hard Solved", format!("`{}`", lc.hard_solved)),
                ("Medium Solved", format!("`{}`", lc.medium_solved)),
                ("Easy Solved", format!("`{}`", lc.easy_solved)),
            ];

            let mut paired = Vec::new();
            let mut i = 0;
            while i < cells.len() {
                let left = &cells[i];
                let right = cells.get(i + 1);
                let right_label = right.map(|r| format!("**{}**", r.0)).unwrap_or_default();
                let right_val = right.map(|r| r.1.clone()).unwrap_or_default();
                paired.push(format!(
                    "| **{}** | {} | {} | {} |",
                    left.0, left.1, right_label, right_val
                ));
                i += 2;
            }

            let table_md = format!(
                "| Metric | Value | Metric | Value |\n| :--- | :---: | :--- | :---: |\n{}",
                paired.join("\n")
            );

            parts.push(format!(
                "## Problem Solving & Algorithms\n\n{}\n\n- **LeetCode Profile:** [leetcode.com/u/{lc_user}](https://leetcode.com/u/{lc_user}/)",
                table_md, lc_user = lc_user
            ));
        }
    }

    // 8. ACHIEVEMENTS
    if s.achievements && !achievements.is_empty() {
        let items: Vec<String> = achievements
            .iter()
            .map(|a| format!("- {} — *{}* ([View]({}))", a.title, a.description, a.link))
            .collect();

        parts.push(format!("## Milestones & Highlights\n\n{}", items.join("\n")));
    }

    // 9. FOOTER
    if s.footer {
        let now = Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
        parts.push(format!(
            "---\n\n*Profile generated dynamically via [GitHub Actions](https://github.com/{username}/{username}/actions) · Last synced: `{now}`*",
            username = p.username, now = now
        ));
    }

    parts.join("\n\n") + "\n"
}

fn strip_timestamp(text: &str) -> String {
    let re = Regex::new(r"Last synced: `[^`]+`").unwrap();
    re.replace_all(text, "Last synced: `STATIC`")
        .replace("\r\n", "\n")
        .trim()
        .to_string()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting GitHub Profile README generation (Rust)...");

    let args: Vec<String> = env::args().collect();
    let is_dry_run = args.iter().any(|a| a == "--dry-run");
    let is_check_only = args.iter().any(|a| a == "--check");
    let is_force = args.iter().any(|a| a == "--force");

    // Discover repository paths relative to current exe or working dir
    let config_path = if Path::new("config.json").exists() {
        PathBuf::from("config.json")
    } else if Path::new("../config.json").exists() {
        PathBuf::from("../config.json")
    } else if Path::new("scripts/config.json").exists() {
        PathBuf::from("scripts/config.json")
    } else if Path::new("../scripts/config.json").exists() {
        PathBuf::from("../scripts/config.json")
    } else {
        PathBuf::from("config.json")
    };

    let readme_path = if Path::new("README.md").exists() {
        PathBuf::from("README.md")
    } else if Path::new("../README.md").exists() {
        PathBuf::from("../README.md")
    } else {
        PathBuf::from("README.md")
    };

    let config_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;
    let config: Config = serde_json::from_str(&config_str)
        .map_err(|e| format!("Failed to parse {}: {}", config_path.display(), e))?;

    let username = &config.profile.username;
    let token = env::var("GITHUB_TOKEN")
        .or_else(|_| env::var("GH_TOKEN"))
        .ok();

    if token.is_none() {
        eprintln!("⚠️  No GITHUB_TOKEN environment variable found. Making unauthenticated requests (lower rate limit).");
    } else {
        println!("🔑 Authenticated GitHub API requests enabled.");
    }

    let client = create_http_client(token.as_deref());

    // 1. Fetch user profile
    println!("📡 Fetching profile for @{}...", username);
    let user_url = format!("https://api.github.com/users/{}", username);
    let user_res = client.get(&user_url).send().await?;
    if !user_res.status().is_success() {
        return Err(format!("Failed to fetch user {}: HTTP {}", username, user_res.status()).into());
    }
    let user: GitHubUser = user_res.json().await?;

    // 2. Fetch public repositories
    println!("📡 Fetching repositories for @{}...", username);
    let repos_url = format!("https://api.github.com/users/{}/repos?per_page=100&sort=pushed&direction=desc", username);
    let repos_res = client.get(&repos_url).send().await?;
    if !repos_res.status().is_success() {
        return Err(format!("Failed to fetch repos for {}: HTTP {}", username, repos_res.status()).into());
    }
    let raw_repos: Vec<GitHubRepo> = repos_res.json().await?;

    let exclude_set: HashSet<String> = config.featured_projects.exclude.iter().cloned().collect();
    let valid_repos: Vec<GitHubRepo> = raw_repos
        .into_iter()
        .filter(|r| {
            if r.fork && !config.featured_projects.include_forks {
                return false;
            }
            true
        })
        .collect();

    let mut total_stars = 0;
    let mut _total_forks = 0;
    let mut language_bytes: HashMap<String, u64> = HashMap::new();
    let mut enriched_repos = Vec::new();

    for mut repo in valid_repos.clone() {
        total_stars += repo.stargazers_count;
        _total_forks += repo.forks_count;

        if exclude_set.contains(&repo.name) {
            continue;
        }

        println!("  ↳ Fetching details for {}...", repo.name);
        if let Some(ref lang_url) = repo.languages_url {
            if let Ok(res) = client.get(lang_url).send().await {
                if res.status().is_success() {
                    if let Ok(langs) = res.json::<HashMap<String, u64>>().await {
                        for (k, v) in &langs {
                            *language_bytes.entry(k.clone()).or_insert(0) += *v;
                        }
                        repo.languages = langs;
                    }
                }
            }
        }

        if let Some(ref rel_url) = repo.releases_url {
            let clean_rel_url = rel_url.replace("{/id}", "");
            if let Ok(res) = client.get(&clean_rel_url).send().await {
                if res.status().is_success() {
                    if let Ok(rels) = res.json::<Vec<GitHubRelease>>().await {
                        repo.releases = rels;
                    }
                }
            }
        }

        enriched_repos.push(repo);
    }

    // 3. Dynamic Pinned Repositories resolution
    let dynamic_pinned = fetch_pinned_repositories(
        &client,
        username,
        token.is_some(),
        &config.featured_projects.pinned,
    )
    .await;

    let pinned_set: HashSet<String> = dynamic_pinned.iter().cloned().collect();
    let pinned_order: HashMap<String, usize> = dynamic_pinned
        .iter()
        .enumerate()
        .map(|(idx, name)| (name.clone(), idx))
        .collect();

    enriched_repos.sort_by(|a, b| {
        let a_pinned = pinned_set.contains(&a.name);
        let b_pinned = pinned_set.contains(&b.name);
        if a_pinned && !b_pinned {
            return std::cmp::Ordering::Less;
        }
        if !a_pinned && b_pinned {
            return std::cmp::Ordering::Greater;
        }
        if a_pinned && b_pinned {
            let a_idx = pinned_order.get(&a.name).unwrap_or(&usize::MAX);
            let b_idx = pinned_order.get(&b.name).unwrap_or(&usize::MAX);
            return a_idx.cmp(b_idx);
        }
        if a.stargazers_count != b.stargazers_count {
            return b.stargazers_count.cmp(&a.stargazers_count);
        }
        b.pushed_at.cmp(&a.pushed_at)
    });

    let max_count = config.featured_projects.max_count;
    let featured_projects: Vec<GitHubRepo> = enriched_repos
        .iter()
        .filter(|r| pinned_set.contains(&r.name))
        .take(max_count)
        .cloned()
        .collect();

    let other_projects: Vec<GitHubRepo> = enriched_repos
        .iter()
        .filter(|r| !pinned_set.contains(&r.name))
        .cloned()
        .collect();

    let active_repo = enriched_repos.iter().find(|r| !exclude_set.contains(&r.name));

    // Achievements
    let mut achievements = vec![
        AchievementItem {
            ach_type: "curation".to_string(),
            title: "Recognized as **XERJ Corpus Hub Contributor**".to_string(),
            description: "Work in [`sagarkrjha/minigit`](https://github.com/sagarkrjha/minigit) selected as open reference memory for AI coding agents.".to_string(),
            link: "https://hub.xerj.org/contributors/sagarkrjha.html".to_string(),
            date: None,
        }
    ];

    for repo in &enriched_repos {
        if let Some(rel) = repo.releases.first() {
            let default_meta = ProjectCustomMeta::default();
            let custom_meta = config.featured_projects.custom_metadata.get(&repo.name).unwrap_or(&default_meta);
            let repo_title = custom_meta.title.as_ref().unwrap_or(&repo.name);
            let tag = rel.tag_name.as_deref().or(rel.name.as_deref()).unwrap_or("");
            achievements.push(AchievementItem {
                ach_type: "release".to_string(),
                title: format!("Shipped **{} {}**", repo_title, tag),
                description: "Published native cross-platform binaries with automated GitHub Actions CI/CD.".to_string(),
                link: rel.html_url.as_deref().unwrap_or(&repo.html_url).to_string(),
                date: rel.published_at.clone().or_else(|| rel.created_at.clone()),
            });
        }
    }

    // LeetCode stats
    let mut leetcode_data = None;
    let lc_user = config.leetcode.username.as_deref().unwrap_or("devsagarkrjha");
    let show_lc_ach = config.leetcode.show_achievements.unwrap_or(true);
    let show_lc_rating = config.leetcode.show_rating.unwrap_or(true);
    let show_lc_badge = config.leetcode.show_badge.unwrap_or(true);

    if (config.sections.leetcode || (config.sections.achievements && show_lc_ach)) && !lc_user.is_empty() {
        println!("📡 Fetching LeetCode data for @{}...", lc_user);
        leetcode_data = fetch_leetcode(&client, lc_user).await;
        if let Some(ref lc) = leetcode_data {
            println!("  ↳ LeetCode Solved: {}, Rating: {:?}", lc.total_solved, lc.contest_rating);
        }
    }

    if show_lc_ach {
        if let Some(ref lc) = leetcode_data {
            if show_lc_rating && lc.contest_rating.is_some() {
                let badge_name = if show_lc_badge && lc.badge.is_some() {
                    format!("LeetCode {}", lc.badge.as_ref().unwrap())
                } else {
                    "LeetCode Competitive Programmer".to_string()
                };
                let top_pct = lc.top_percentage
                    .map(|pct| format!(" (Top {}% globally)", pct))
                    .unwrap_or_default();
                achievements.push(AchievementItem {
                    ach_type: "leetcode".to_string(),
                    title: format!("Achieved **{}** · **{} Contest Rating**{}", badge_name, lc.contest_rating.unwrap(), top_pct),
                    description: format!("Solved **{}+ algorithmic problems** ({} Hard, {} Medium) with a peak contest rating of **{}**.", lc.total_solved, lc.hard_solved, lc.medium_solved, lc.contest_rating.unwrap()),
                    link: format!("https://leetcode.com/u/{}/", lc_user),
                    date: None,
                });
            } else if show_lc_badge && lc.badge.is_some() {
                achievements.push(AchievementItem {
                    ach_type: "leetcode".to_string(),
                    title: format!("Achieved **LeetCode {}**", lc.badge.as_ref().unwrap()),
                    description: format!("Solved **{}+ algorithmic problems** ({} Hard, {} Medium).", lc.total_solved, lc.hard_solved, lc.medium_solved),
                    link: format!("https://leetcode.com/u/{}/", lc_user),
                    date: None,
                });
            } else if lc.total_solved > 0 {
                achievements.push(AchievementItem {
                    ach_type: "leetcode".to_string(),
                    title: format!("Solved **{}+ Algorithmic Problems** on LeetCode", lc.total_solved),
                    description: format!("Demonstrated algorithmic problem solving across {} Hard and {} Medium challenges.", lc.hard_solved, lc.medium_solved),
                    link: format!("https://leetcode.com/u/{}/", lc_user),
                    date: None,
                });
            }
        }
    }

    if total_stars >= 5 {
        achievements.push(AchievementItem {
            ach_type: "stars".to_string(),
            title: format!("Earned **{}+ GitHub Stars** across open-source systems projects.", total_stars),
            description: "Recognized for building first-principles developer tooling and version control architecture.".to_string(),
            link: format!("https://github.com/{}?tab=repositories", username),
            date: None,
        });
    }

    // Telemetry
    println!("📡 Fetching GitHub telemetry & activity metrics...");
    let telemetry = fetch_telemetry(&client, username).await;
    if let Some(ref loc) = telemetry.loc {
        println!("  ↳ Lines of Code: {}", loc);
    }
    if let Some(ref contrib) = telemetry.contributions {
        println!("  ↳ Contributions: {}", contrib);
    }

    // Build Markdown
    println!("📝 Assembling README markdown...");
    let markdown = build_markdown(
        &config,
        &user,
        total_stars,
        &language_bytes,
        &featured_projects,
        &other_projects,
        &valid_repos,
        active_repo,
        &achievements,
        leetcode_data.as_ref(),
        &telemetry,
    );

    // Equality check
    let existing_content = if readme_path.exists() {
        fs::read_to_string(&readme_path).unwrap_or_default()
    } else {
        String::new()
    };

    let is_identical = strip_timestamp(&markdown) == strip_timestamp(&existing_content);

    if !is_force && is_identical && !existing_content.is_empty() {
        println!("✅ README.md is already up to date. No profile or repository changes detected.");
        if is_check_only {
            std::process::exit(0);
        }
        return Ok(());
    }

    if is_check_only {
        eprintln!("⚠️  README.md is out of date.");
        std::process::exit(1);
    }

    if is_dry_run {
        println!("🔍 DRY RUN output:\n----------------------------------------\n");
        println!("{}", markdown);
        println!("\n----------------------------------------\n✅ Dry run complete.");
        return Ok(());
    }

    fs::write(&readme_path, markdown)?;
    println!("🎉 Successfully updated {}!", readme_path.display());

    Ok(())
}
