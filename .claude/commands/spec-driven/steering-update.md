---
description: Update Kiro steering documents based on recent project changes
allowed-tools: Bash, Read, Write, Edit, MultiEdit, Glob, Grep, LS
---

# Kiro Steering Update

Update existing steering documents in `.kiro/steering/` to reflect recent project changes and maintain accurate project knowledge for ongoing spec-driven development.

## Change Analysis

### Recent Git Activity

- Recent commits: !`git log --oneline -10`
- Last steering update: !`git log -1 --oneline -- .kiro/steering/`
- Current working tree: !`git status --porcelain`

### Dependency Changes

- Python (uv): !`test -f pyproject.toml && echo "pyproject.toml found" || echo "No pyproject.toml"`
- Python (pip): !`test -f requirements.txt && echo "requirements.txt found" || echo "No requirements.txt"`
- JavaScript: !`test -f package.json && echo "package.json found" || echo "No package.json"`
- Rust: !`test -f Cargo.toml && echo "Cargo.toml found" || echo "No Cargo.toml"`
- Go: !`test -f go.mod && echo "go.mod found" || echo "No go.mod"`
- Java: !`test -f pom.xml && echo "Maven pom.xml found" || test -f build.gradle && echo "Gradle build.gradle found" || echo "No Java project"`

### Current Project State

Use native tools to analyze:

- **Glob**: Find source files with patterns like `**/*.{js,ts,py,java,go,rs}`
- **Glob**: Find config files (`**/package.json`, `**/tsconfig.json`, etc.)
- **Grep**: Search for new technologies or patterns
- **LS**: Examine directory structure changes

**Important**: Exclude files ignored by git when analyzing project state:

- Use `git ls-files` instead of `find` to get only tracked files
- Avoid analyzing files/directories listed in .gitignore
- Focus only on files that are part of the actual project codebase

## Current Steering Documents

### Load Existing Steering Context

- Product overview: @.kiro/steering/product.md
- Technology stack: @.kiro/steering/tech.md
- Project structure: @.kiro/steering/structure.md
- Custom steering: Use **Glob** pattern `.kiro/steering/*.md` to find additional files

## Task: Update Steering Documents

Analyze recent changes and update the steering documents to maintain accuracy:

### 1. Update Product Overview (`product.md`)

Review and update if there are:

- **New features** added to the product
- **Removed features** or deprecated functionality
- **Changed use cases** or target audience
- **Updated value propositions** or benefits
- **Modified product goals** or roadmap items

Only update sections that have actually changed.

### 2. Update Technology Stack (`tech.md`)

Check for changes in:

- **New dependencies** added via package managers
- **Removed libraries** or frameworks
- **Version upgrades** of major dependencies
- **New development tools** or build processes
- **Changed environment variables** or configuration
- **Modified port assignments** or service architecture
- **Updated common commands** or scripts

Focus on significant technology changes, not minor version bumps.

### 3. Update Project Structure (`structure.md`)

Look for changes in:

- **New directories** or major reorganization
- **Changed file organization** patterns
- **New or modified naming conventions**
- **Updated architectural patterns** or principles
- **Refactored code structure** or module boundaries
- **Changed import patterns** or dependencies

Update only if there are meaningful structural changes.

### 4. Review Custom Steering Files

If custom steering files exist:

- Check if they're still relevant to current project state
- Update content based on recent changes
- Remove if no longer applicable
- Note any new areas that might need custom steering

## Instructions

1. **Analyze the git history** to understand what has changed
2. **Use native tools** for file discovery (Glob, Grep, LS)
3. **Compare current state** with existing steering documents
4. **Update only what has changed** - don't rewrite unchanged sections
5. **Preserve existing structure** and formatting consistency
6. **Add new sections** only if there are significant new areas
7. **Mark deprecated content** rather than deleting (unless completely removed)
8. **Include dates** for major changes if helpful for context
9. **Maintain spec-driven development alignment** - ensure changes support future specifications

## Best Practices

- **Keep changes focused** - steering should remain concise and readable
- **Maintain consistency** with existing document style and format
- **Explain reasoning** for significant changes or architectural decisions
- **Provide examples** for new patterns or conventions
- **Regular maintenance** - run this after major features or refactoring
- **Version awareness** - consider backward compatibility when updating

The goal is to keep steering documents current without unnecessary churn, ensuring they continue to provide accurate guidance for AI interactions and support effective spec-driven development. think deeply
