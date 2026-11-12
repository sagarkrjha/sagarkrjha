# Sagar Kumar Jha
**Software Engineer · Systems, Developer Tooling & Full-Stack** · *Delhi, India*

[LinkedIn](https://linkedin.com/in/devsagarkumarjha) · [X / Twitter](https://x.com/devsagarkrjha) · [LeetCode](https://leetcode.com/u/devsagarkrjha/) · [Discord](https://discord.com/users/894502933801107476)

## Summary

I build robust systems, developer tools, and storage engines from first principles. Currently engineering Git-compatible version control internals, LSM-tree storage engines, and cross-platform desktop/IDE tooling across modern C++20, Rust, and TypeScript.

- **Focus Areas:** Systems Programming & Storage Engines (LSM-tree, CAS, WAL), Distributed Version Control & Internal Algorithms (Myers $O(ND)$ diff), Cross-Platform Developer Tools (Desktop, CLI, VS Code).
- **Engineering Philosophy:** Understanding complex distributed abstractions by building them from first principles.
- **Open Collaborations:** Open to software engineering roles & systems collaborations.

## Technical Skills

- **Languages:** `C++20`, `C`, `Rust`, `TypeScript`, `JavaScript`, `Go`, `Python`
- **Frameworks & Full-Stack:** `Next.js (App Router)`, `React 19`, `Electron`, `Tailwind CSS v4`, `Node.js`
- **Systems & Storage Tooling:** `CMake`, `OpenSSL (SHA-256 / CRC32)`, `Zlib`, `Git Internals`, `Linux / POSIX`, `Windows API`
- **DevOps & Infrastructure:** `GitHub Actions`, `Docker`, `GCC / Clang / MSVC`
- **Architecture & Competencies:** Content-Addressable Storage (CAS) · Log-Structured Merge-tree (LSM-tree) · Directed Acyclic Graph (DAG) Topologies · Dynamic Programming Diff Algorithms (Myers O(ND)) · Cryptographic Hashing & Data Integrity · Systems Programming & Memory Management

## Featured Projects

### [MiniGit](https://github.com/sagarkrjha/minigit)
*`C++` · ★ 13 · Release: [v1.12.0](https://github.com/sagarkrjha/minigit/releases/tag/v1.12.0) · [Repository](https://github.com/sagarkrjha/minigit)*

A Git-compatible distributed version control system implemented from first principles in modern C++20. Features SHA-256 content-addressable storage, Eugene Myers' $O(ND)$ diff calculation, two-phase staging index, packfile delta compression, Git Smart HTTP wire synchronization, Docker containers, and multi-language SDKs (Rust, Python, Go, JS/TS, Java).

[![XERJ Corpus Hub contributor](https://hub.xerj.org/contributors/sagarkrjha/badge.svg)](https://hub.xerj.org/contributors/sagarkrjha.html)

- Selected for the [XERJ Corpus Hub](https://hub.xerj.org/contributors/sagarkrjha.html) as a verified reference implementation for AI coding agents
- SHA-256 Content-Addressable Storage (CAS) with flattened immutable object trees and atomic indexing
- Eugene Myers' dynamic programming $O(ND)$ diff algorithm with visual patch inspection
- Multi-language SDKs (`minigit-sdk`) with programmatic client bindings for Rust, Python, Go, TypeScript/Node.js, and Java
- Bounded packfile delta chains ($O(1)$ unpack time) and wire-compatible Git Smart HTTP v1 client
- Containerized Docker distribution and automated cross-platform releases for Windows, Linux, and macOS

### [CodeShelf](https://github.com/sagarkrjha/codeshelf)
*`TypeScript` · Release: [v0.3.6](https://github.com/sagarkrjha/codeshelf/releases/tag/v0.3.6) · [Repository](https://github.com/sagarkrjha/codeshelf)*

Developer snippet and knowledge management system spanning desktop, VS Code extension, and web. Local-first workspace with technology normalization, weighted lexical search, Myers diff revision history, and optional Gemini AI autofill.

- Local-first atomic disk storage (~/.codeshelf/) with bidirectional desktop-to-IDE synchronization
- Weighted lexical search, prefix filters (lang:, tag:, domain:), and technology taxonomy normalization
- Automatic revision snapshotting with visual Myers diff rollback and compressed JSON exports
- Cross-platform releases across Windows (NSIS), macOS (DMG), Linux (AppImage/deb), and VS Code Marketplace

### [LevelDB C++ Implementation](https://github.com/sagarkrjha/level-db-cpp)
*`C++` · ★ 1 · [Repository](https://github.com/sagarkrjha/level-db-cpp)*

Complete, clean, end-to-end modern C++20 implementation of the Log-Structured Merge-tree (LSM-tree) storage engine inspired by Google's LevelDB.

- Write-Ahead Log (WAL) with 32 KB chunked physical records and CRC32 checksum data integrity
- Lock-free concurrent SkipList MemTable with custom memory Arena allocator and release/acquire atomics
- SSTable storage hierarchy with delta prefix compression, restart points, and double-hashing Bloom filters
- Multi-level compaction pipeline with VersionSet / MANIFEST delta journaling and tombstone purging safety

## Additional Projects

- **[cp-workspace](https://github.com/sagarkrjha/cp-workspace)** — `C++` · ⚡ Lightweight, cross-platform competitive programming setup for C++ in VS Code with auto-compiler detection and fast I/O
- **[Config-Driven Portfolio](https://github.com/sagarkrjha/portfolio-web)** — `TypeScript` · High-performance, 100% config-driven developer portfolio and technical blog built with Next.js 16 (App Router), React 19, and Tailwind CSS v4. Features an interactive terminal CLI, Mermaid diagram canvas modal, and automated GitHub CI sync.
- **[Next.js MDX Starter Template](https://github.com/sagarkrjha/next-mdx-starter)** — `TypeScript` · Production-ready, reusable full-stack starter template built with Next.js 16, React 19, Tailwind CSS v4, Biome, shadcn/ui, Radix UI, and first-class @next/mdx support.

## Current Focus

- **Active Development:** [**MiniGit**](https://github.com/sagarkrjha/minigit) — A Git-compatible distributed version control system implemented from first principles in modern C++20. Features SHA-256 content-addressable storage, Eugene Myers' $O(ND)$ diff calculation, two-phase staging index, packfile delta compression, Git Smart HTTP wire synchronization, Docker containers, and multi-language SDKs (Rust, Python, Go, JS/TS, Java).
- **Recent Work:** Modern C++20 implementation of Git internals with SHA-256 CAS, staging index, and cross-platform releases.

## Engineering Activity

| Metric | Value | Metric | Value |
| :--- | :---: | :--- | :---: |
| **Public Repositories** | `9` | **Total Stars Earned** | `16` |
| **Total Lines of Code** | `88,466` | **Public Contributions** | `563` |
| **Total Commits** | `282` | **Pull Requests Opened** | `33` |
| **Current Streak** | `2 days` | **Longest Streak** | `22 days` |
| **Followers** | `29` | **Following** | `22` |

- **Codebase Composition:** `C++` (52.3%) · `TypeScript` (43.5%) · `MDX` (1.3%) · `CSS` (1.2%) · `CMake` (0.5%)

## Problem Solving & Algorithms

| Metric | Value | Metric | Value |
| :--- | :---: | :--- | :---: |
| **Problems Solved** | `722` | **Hard Solved** | `150` |
| **Medium Solved** | `364` | **Easy Solved** | `208` |

- **LeetCode Profile:** [leetcode.com/u/devsagarkrjha](https://leetcode.com/u/devsagarkrjha/)

## Milestones & Highlights

- Recognized as **XERJ Corpus Hub Contributor** — *Work in [`sagarkrjha/minigit`](https://github.com/sagarkrjha/minigit) selected as open reference memory for AI coding agents.* ([View](https://hub.xerj.org/contributors/sagarkrjha.html))
- Shipped **MiniGit v1.12.0** — *Published native cross-platform binaries with automated GitHub Actions CI/CD.* ([View](https://github.com/sagarkrjha/minigit/releases/tag/v1.12.0))
- Shipped **CodeShelf v0.3.6** — *Published native cross-platform binaries with automated GitHub Actions CI/CD.* ([View](https://github.com/sagarkrjha/codeshelf/releases/tag/v0.3.6))
- Earned **16+ GitHub Stars** across open-source systems projects. — *Recognized for building first-principles developer tooling and version control architecture.* ([View](https://github.com/sagarkrjha?tab=repositories))

---

*Profile generated dynamically via [GitHub Actions](https://github.com/sagarkrjha/sagarkrjha/actions) · Last synced: `2026-11-12 05:12 UTC`*
