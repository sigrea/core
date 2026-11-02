import { execFileSync, spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseChangelogMarkdown } from "changelogen";
import semver from "semver";

const run = (command, args, options = {}) =>
	execFileSync(command, args, { stdio: "inherit", ...options });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const readPackage = () => JSON.parse(readFileSync("package.json", "utf8"));

function stableVersion(version) {
	if (
		!version ||
		semver.valid(version) !== version ||
		semver.prerelease(version)
	) {
		throw new Error("Use a stable x.y.z version.");
	}
	return version;
}

function cleanMain() {
	if (git("branch", "--show-current") !== "main") {
		throw new Error("Run this command on main.");
	}
	if (git("status", "--porcelain")) {
		throw new Error("Git status must be clean.");
	}
}

function releaseNotes(version) {
	const release = parseChangelogMarkdown(
		readFileSync("CHANGELOG.md", "utf8"),
	).releases.find((entry) => entry.version === version);
	if (!release?.body?.trim()) {
		throw new Error(`Missing changelog entry for ${version}.`);
	}
	return release.body;
}

function prepareRelease(version = process.env.SIGREA_RELEASE_VERSION) {
	cleanMain();
	stableVersion(version);
	if (!semver.gt(version, readPackage().version)) {
		throw new Error(
			"The release version must be greater than the current version.",
		);
	}
	run("git", ["fetch", "origin", "main", "--tags"]);
	if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) {
		throw new Error("main must match origin/main before preparing a release.");
	}
	const tag = `v${version}`;
	if (git("tag", "--list", tag)) {
		throw new Error(`${tag} already exists.`);
	}
	run("vp", ["run", "cicheck"]);
	cleanMain();
	run("vp", ["exec", "changelogen", "--bump", "-r", version]);
	if (readPackage().version !== version) {
		throw new Error("Changelogen did not update the package version.");
	}
	releaseNotes(version);
	run("vp", ["fmt", "package.json"]);
	run("git", ["add", "--", "package.json", "CHANGELOG.md"]);
	run("git", ["commit", "-m", `chore(release): ${tag}`]);
	cleanMain();
	run("git", ["tag", "-a", tag, "-m", tag]);
}

async function pushRelease() {
	cleanMain();
	const tag = `v${stableVersion(readPackage().version)}`;
	if (
		git("cat-file", "-t", `refs/tags/${tag}`) !== "tag" ||
		git("rev-parse", `refs/tags/${tag}^{commit}`) !== git("rev-parse", "HEAD")
	) {
		throw new Error(`${tag} must be an annotated tag pointing to HEAD.`);
	}
	run("git", ["fetch", "origin", "main", "--tags"]);
	const remote = git("rev-parse", "origin/main");
	if (
		remote !== git("rev-parse", "HEAD") &&
		remote !== git("rev-parse", "HEAD^")
	) {
		throw new Error(
			"origin/main changed or main contains extra unpublished commits.",
		);
	}
	const prompt = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	try {
		const answer = await prompt.question(
			`Push main and ${tag} to origin? [y/N] `,
		);
		if (!/^(y|yes)$/i.test(answer.trim())) throw new Error("Cancelled.");
	} finally {
		prompt.close();
	}
	run("git", [
		"push",
		"--atomic",
		"--no-follow-tags",
		"origin",
		"refs/heads/main:refs/heads/main",
		`refs/tags/${tag}:refs/tags/${tag}`,
	]);
}

function alreadyPublished(name, version) {
	const result = spawnSync(
		"npm",
		["view", `${name}@${version}`, "version", "--json"],
		{
			encoding: "utf8",
		},
	);
	if (result.error) throw result.error;
	const response = JSON.parse(result.stdout || "null");
	if (result.status === 0 && response === version) return true;
	if (result.status !== 0 && response?.error?.code === "E404") return false;
	throw new Error(
		result.stderr || "Unable to determine the published npm version.",
	);
}

function publishRelease() {
	const { name, version } = readPackage();
	stableVersion(version);
	const tag = `v${version}`;
	if (
		process.env.GITHUB_REF_TYPE !== "tag" ||
		process.env.GITHUB_REF_NAME !== tag
	) {
		throw new Error("The Git tag must match the package version.");
	}
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) throw new Error("GITHUB_REPOSITORY is required.");
	git("merge-base", "--is-ancestor", "HEAD", "origin/main");
	const notes = releaseNotes(version);
	const directory = mkdtempSync(join(tmpdir(), "sigrea-release-"));
	try {
		if (!alreadyPublished(name, version)) {
			run("vp", ["check"]);
			run("vp", ["test", "run"]);
			const tarball = join(directory, "package.tgz");
			run("pnpm", ["pack", "--out", tarball]);
			run("tar", ["-xzf", tarball, "-C", directory]);
			const unpacked = join(directory, "package");
			symlinkSync(
				resolve("node_modules"),
				join(unpacked, "node_modules"),
				"dir",
			);
			run("npm", ["run", "smoke"], { cwd: unpacked });
			run("npm", ["publish", tarball, "--access", "public"]);
		}
		const existing = spawnSync(
			"gh",
			["api", "--include", `repos/${repo}/releases/tags/${tag}`],
			{
				encoding: "utf8",
			},
		);
		if (existing.error) throw existing.error;
		if (existing.status === 0) return;
		if (!/^HTTP\/\S+ 404\b/m.test(existing.stdout)) {
			throw new Error(
				existing.stderr || "Unable to look up the GitHub Release.",
			);
		}
		const notesFile = join(directory, "notes.md");
		writeFileSync(notesFile, notes);
		run("gh", [
			"release",
			"create",
			tag,
			"--repo",
			repo,
			"--verify-tag",
			"--title",
			tag,
			"--notes-file",
			notesFile,
		]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

try {
	switch (process.argv[2]) {
		case "prepare":
			prepareRelease();
			break;
		case "push":
			await pushRelease();
			break;
		case "publish":
			publishRelease();
			break;
		default:
			throw new Error("Usage: node scripts/release.js <prepare|push|publish>");
	}
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
