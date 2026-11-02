import { execFileSync, spawnSync } from "node:child_process";
import {
	appendFileSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vite-plus/test";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "sigrea-release-test-"));
	temporaryDirectories.push(directory);
	const cwd = join(directory, "work");
	const remote = join(directory, "origin.git");
	const bin = join(directory, "bin");
	const stateFile = join(directory, "state.json");
	const logFile = join(directory, "commands.jsonl");
	mkdirSync(cwd);
	mkdirSync(bin);
	writeFileSync(logFile, "");
	writeFileSync(
		stateFile,
		JSON.stringify({ published: false, githubStatus: 404 }),
	);
	const git = (...args) =>
		execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	git("init", "--bare", remote);
	git("init", "-b", "main");
	git("config", "user.name", "Release fixture");
	git("config", "user.email", "fixture@example.invalid");
	git("config", "commit.gpgSign", "false");
	git("config", "tag.gpgSign", "false");
	git("config", "core.hooksPath", join(directory, "hooks"));
	git("remote", "add", "origin", remote);
	writeFileSync(join(cwd, ".gitignore"), "node_modules\n");
	writeFileSync(
		join(cwd, "package.json"),
		JSON.stringify({
			name: "@sigrea/fixture",
			version: "1.0.0",
			type: "module",
			repository: "https://github.com/sigrea/fixture.git",
			exports: { import: "./index.mjs", require: "./index.cjs" },
			scripts: {
				smoke: `node --input-type=module -e "import { value } from '@sigrea/fixture'; if (value !== 1) process.exit(1)" && node -e "if (require('@sigrea/fixture').value !== 1) process.exit(1)"`,
			},
		}),
	);
	writeFileSync(
		join(cwd, "CHANGELOG.md"),
		"# Changelog\n\n## v1.0.0\n\nInitial release.\n",
	);
	git("add", ".gitignore", "package.json", "CHANGELOG.md");
	git("commit", "-m", "feat: initial fixture");
	git("tag", "-a", "v1.0.0", "-m", "v1.0.0");
	git("push", "-u", "origin", "main", "refs/tags/v1.0.0");
	symlinkSync(
		join(repository, "node_modules"),
		join(cwd, "node_modules"),
		"dir",
	);
	const mock = String.raw`#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
const state = JSON.parse(readFileSync(process.env.RELEASE_TEST_STATE, 'utf8'));
appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify({tool, args, cwd:process.cwd()})+'\n');
const save = () => writeFileSync(process.env.RELEASE_TEST_STATE, JSON.stringify(state));
if (tool === 'vp') {
 if (state.checkFails && (args[0] === 'check' || args[1] === 'cicheck')) process.exit(1);
 if (state.dirtyCheck && args[1] === 'cicheck') appendFileSync('CHANGELOG.md','changed by check');
 if (args[0] === 'exec') {
  if (!args.includes('--bump') || args.includes('--release')) throw new Error('Only local changelog updates are allowed');
  execFileSync(process.execPath, [process.env.RELEASE_TEST_CHANGELOGEN, ...args.slice(2)], {stdio:'inherit'});
 }
 if (args[0] === 'fmt') writeFileSync('package.json', JSON.stringify(JSON.parse(readFileSync('package.json','utf8')), null, '\t')+'\n');
} else if (tool === 'pnpm') {
 const packageDir = join(dirname(args[2]), 'pack-source-root');
 const packed = join(packageDir, 'package'); mkdirSync(packed, {recursive:true});
 copyFileSync('package.json', join(packed,'package.json'));
 writeFileSync(join(packed,'index.mjs'), 'export const value = '+(state.brokenTarball ? 0 : 1)+';');
 writeFileSync(join(packed,'index.cjs'), 'exports.value = '+(state.brokenTarball ? 0 : 1)+';');
 execFileSync('tar',['-czf',args[2],'-C',packageDir,'package']);
} else if (tool === 'npm') {
 if (args[0] === 'view') {
  if (state.npmError) { console.log(JSON.stringify({error:{code:state.npmError}})); process.exit(1); }
  if (!state.published) { console.log(JSON.stringify({error:{code:'E404'}})); process.exit(1); }
  console.log(JSON.stringify(JSON.parse(readFileSync('package.json','utf8')).version));
 } else if (args[0] === 'run') {
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  const result=spawnSync('/bin/sh',['-c',pkg.scripts.smoke],{stdio:'inherit'}); process.exit(result.status);
 } else if (args[0] === 'publish') {
  if (state.publishFails) process.exit(1);
  state.published=true; save();
 }
} else if (tool === 'gh') {
 if (args[0] === 'api') {
  console.log('HTTP/2.0 '+state.githubStatus+' Status\n\n{}');
  if (state.githubStatus !== 200) process.exit(1);
 } else {
  if (state.failRelease) process.exit(1);
  state.githubStatus=200; save();
 }
}
`;
	// Keep stubs and their state outside the repo so git status stays clean.
	for (const tool of ["vp", "pnpm", "npm", "gh"]) {
		writeFileSync(join(bin, tool), mock, { mode: 0o755 });
	}
	const env = {
		...process.env,
		PATH: `${bin}:${process.env.PATH}`,
		SIGREA_RELEASE_VERSION: "1.0.1",
		GITHUB_REF_TYPE: "tag",
		GITHUB_REF_NAME: "v1.0.1",
		GITHUB_REPOSITORY: "sigrea/fixture",
		GITHUB_TOKEN: "",
		GH_TOKEN: "",
		RELEASE_TEST_STATE: stateFile,
		RELEASE_TEST_LOG: logFile,
		RELEASE_TEST_CHANGELOGEN: join(
			repository,
			"node_modules/changelogen/dist/cli.mjs",
		),
	};
	return {
		cwd,
		remote,
		git,
		state(update) {
			writeFileSync(
				stateFile,
				JSON.stringify({
					...JSON.parse(readFileSync(stateFile, "utf8")),
					...update,
				}),
			);
		},
		events() {
			return readFileSync(logFile, "utf8")
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line));
		},
		run(action, override = {}, input = "y\n") {
			return spawnSync(
				process.execPath,
				[join(repository, "scripts/release.js"), action],
				{
					cwd,
					env: { ...env, ...override },
					encoding: "utf8",
					input,
					timeout: 15000,
				},
			);
		},
	};
}

function prepare(f) {
	const result = f.run("prepare");
	expect(result.status, result.stdout + result.stderr).toBe(0);
}

test("prepares one formatted commit and an annotated tag without publishing", () => {
	const f = fixture();
	const before = f.git("rev-parse", "HEAD");
	prepare(f);
	expect(f.git("rev-list", "--count", `${before}..HEAD`)).toBe("1");
	expect(f.git("show", "HEAD:package.json")).toContain('\n\t"name"');
	expect(f.git("cat-file", "-t", "v1.0.1")).toBe("tag");
	expect(f.git("rev-parse", "v1.0.1^{commit}")).toBe(
		f.git("rev-parse", "HEAD"),
	);
	expect(f.git("status", "--porcelain")).toBe("");
	expect(f.events().every((event) => event.tool === "vp")).toBe(true);
});

test.each(["not-a-version", "v1.0.1", "1.0.0", "0.9.9", "1.0.1-beta.1", ""])(
	"rejects version %j before changing the tree",
	(version) => {
		const f = fixture();
		const before = f.git("rev-parse", "HEAD");
		expect(
			f.run("prepare", { SIGREA_RELEASE_VERSION: version }).status,
		).not.toBe(0);
		expect(f.git("rev-parse", "HEAD")).toBe(before);
		expect(f.git("status", "--porcelain")).toBe("");
		expect(f.events()).toEqual([]);
	},
);

test.each(["dirty", "branch", "tag", "remote-tag", "ahead", "behind"])(
	"rejects a %s preparation state",
	(state) => {
		const f = fixture();
		if (state === "dirty") appendFileSync(join(f.cwd, "CHANGELOG.md"), "dirty");
		if (state === "branch") f.git("switch", "-c", "feature");
		if (state === "tag" || state === "remote-tag") {
			f.git("tag", "-a", "v1.0.1", "-m", "already exists");
			if (state === "remote-tag") {
				f.git("push", "origin", "refs/tags/v1.0.1");
				f.git("tag", "-d", "v1.0.1");
			}
		}
		if (state === "ahead" || state === "behind") {
			appendFileSync(join(f.cwd, "CHANGELOG.md"), "another commit");
			f.git("commit", "-am", "docs: another change");
			if (state === "behind") {
				f.git("push", "origin", "main");
				f.git("switch", "--detach", "HEAD^");
				f.git("branch", "-f", "main", "HEAD");
				f.git("switch", "main");
			}
		}
		const before = f.git("rev-parse", "HEAD");
		const status = f.git("status", "--porcelain");
		expect(f.run("prepare").status).not.toBe(0);
		expect(f.git("rev-parse", "HEAD")).toBe(before);
		expect(f.git("status", "--porcelain")).toBe(status);
		expect(f.events()).toEqual([]);
	},
);

test.each([{ checkFails: true }, { dirtyCheck: true }])(
	"stops when the pre-release check fails or changes files: %j",
	(state) => {
		const f = fixture();
		const before = f.git("rev-parse", "HEAD");
		f.state(state);
		expect(f.run("prepare").status).not.toBe(0);
		expect(f.git("rev-parse", "HEAD")).toBe(before);
		expect(f.events()).toHaveLength(1);
		expect(f.git("tag", "--list", "v1.0.1")).toBe("");
	},
);

test("pushes only the release tag even when followTags is configured", () => {
	const f = fixture();
	prepare(f);
	f.git("tag", "-a", "unrelated", "-m", "unrelated");
	f.git("config", "push.followTags", "true");
	const result = f.run("push");
	expect(result.status, result.stdout + result.stderr).toBe(0);
	expect(f.git("ls-remote", "origin", "refs/tags/v1.0.1")).not.toBe("");
	expect(f.git("ls-remote", "origin", "refs/tags/unrelated")).toBe("");
	expect(f.git("rev-parse", "origin/main")).toBe(f.git("rev-parse", "HEAD"));
});

test("does not push the tag when the remote rejects main", () => {
	const f = fixture();
	prepare(f);
	const before = f.git("rev-parse", "origin/main");
	writeFileSync(
		join(f.remote, "hooks/update"),
		'#!/bin/sh\n[ "$1" != refs/heads/main ]\n',
		{ mode: 0o755 },
	);
	expect(f.run("push").status).not.toBe(0);
	expect(f.git("ls-remote", "origin", "refs/tags/v1.0.1")).toBe("");
	expect(f.git("ls-remote", "origin", "refs/heads/main").split("\t")[0]).toBe(
		before,
	);
});

test("rejects a release tag pointing to a different commit", () => {
	const f = fixture();
	prepare(f);
	f.git("commit", "--allow-empty", "-m", "chore: another commit");
	expect(f.run("push").status).not.toBe(0);
	expect(f.git("ls-remote", "origin", "refs/tags/v1.0.1")).toBe("");
});

test.each(["lightweight", "remote-changed", "cancel"])(
	"rejects unsafe or cancelled push: %s",
	(state) => {
		const f = fixture();
		prepare(f);
		if (state === "lightweight") {
			f.git("tag", "-d", "v1.0.1");
			f.git("tag", "v1.0.1");
		}
		if (state === "remote-changed") {
			f.git("commit", "--allow-empty", "-m", "chore: remote change");
			f.git("push", "origin", "main");
			f.git("switch", "--detach", "HEAD^");
			f.git("branch", "-f", "main", "HEAD");
			f.git("switch", "main");
		}
		const result = f.run("push", {}, state === "cancel" ? "n\n" : "y\n");
		expect(result.status).not.toBe(0);
		expect(f.git("ls-remote", "origin", "refs/tags/v1.0.1")).toBe("");
	},
);

test.each(["version", "off-main", "notes"])(
	"rejects invalid publish input: %s",
	(state) => {
		const f = fixture();
		pushed(f);
		if (state === "version") {
			expect(f.run("publish", { GITHUB_REF_NAME: "v9.9.9" }).status).not.toBe(
				0,
			);
		} else {
			if (state === "off-main")
				f.git("update-ref", "refs/remotes/origin/main", "HEAD^");
			if (state === "notes")
				writeFileSync(join(f.cwd, "CHANGELOG.md"), "# Changelog\n");
			expect(f.run("publish").status).not.toBe(0);
		}
		expect(
			f.events().some((event) => event.tool === "npm" || event.tool === "gh"),
		).toBe(false);
	},
);

function pushed(f) {
	prepare(f);
	expect(f.run("push").status).toBe(0);
}

test("checks the packed ESM/CJS package before publishing and creating the release", () => {
	const f = fixture();
	pushed(f);
	const result = f.run("publish");
	expect(result.status, result.stdout + result.stderr).toBe(0);
	const events = f.events();
	expect(events.filter((event) => event.tool === "pnpm")).toHaveLength(1);
	const smoke = events.findIndex(
		(event) => event.tool === "npm" && event.args[0] === "run",
	);
	const publish = events.findIndex(
		(event) => event.tool === "npm" && event.args[0] === "publish",
	);
	expect(smoke).toBeGreaterThan(-1);
	expect(publish).toBeGreaterThan(smoke);
	expect(events[smoke].cwd).not.toBe(f.cwd);
	expect(events.at(-1).args.slice(0, 2)).toEqual(["release", "create"]);
});

test("does not publish a broken tarball", () => {
	const f = fixture();
	pushed(f);
	f.state({ brokenTarball: true });
	expect(f.run("publish").status).not.toBe(0);
	expect(
		f
			.events()
			.some((event) => event.tool === "npm" && event.args[0] === "publish"),
	).toBe(false);
});

test.each(["ECONNRESET", "E403"])(
	"does not treat npm %s as an unpublished version",
	(npmError) => {
		const f = fixture();
		pushed(f);
		f.state({ npmError });
		expect(f.run("publish").status).not.toBe(0);
		expect(
			f.events().some((event) => event.tool === "pnpm" || event.tool === "gh"),
		).toBe(false);
	},
);

test("does not create a GitHub Release if npm publish fails", () => {
	const f = fixture();
	pushed(f);
	f.state({ publishFails: true });
	expect(f.run("publish").status).not.toBe(0);
	expect(f.events().some((event) => event.tool === "gh")).toBe(false);
});

test("retries release creation after publishing without publishing npm twice", () => {
	const f = fixture();
	pushed(f);
	f.state({ failRelease: true });
	expect(f.run("publish").status).not.toBe(0);
	f.state({ failRelease: false });
	const retry = f.run("publish");
	expect(retry.status, retry.stdout + retry.stderr).toBe(0);
	expect(
		f
			.events()
			.filter((event) => event.tool === "npm" && event.args[0] === "publish"),
	).toHaveLength(1);
	expect(f.run("publish").status).toBe(0);
	expect(f.events().at(-1).args.slice(0, 2)).toEqual(["release", "edit"]);
});

test("does not create a release when the GitHub lookup fails", () => {
	const f = fixture();
	pushed(f);
	f.state({ published: true, githubStatus: 503 });
	expect(f.run("publish").status).not.toBe(0);
	expect(f.events().at(-1).args[0]).toBe("api");
});
