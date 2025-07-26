---
description: Initialize Kiro steering documents for persistent project knowledge
allowed-tools: Bash, Read, Write, Edit, MultiEdit, Glob, Grep, LS
---

# Kiro Steering Initialization

Create foundational steering documents in `.kiro/steering/` to establish consistent project standards and conventions that will guide AI interactions throughout spec-driven development.

## Project Analysis

### Current Project Structure

- Project files: !`find . -type f -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.java" -o -name "*.go" -o -name "*.rs" | grep -v node_modules | grep -v .git | grep -v dist | head -30`
- Configuration files: !`find . -maxdepth 3 -name "package.json" -o -name "requirements.txt" -o -name "pom.xml" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pyproject.toml" -o -name "tsconfig.json"`
- Documentation: !`find . -maxdepth 3 -name "README*" -o -name "CHANGELOG*" -o -name "LICENSE*" -o -name "*.md" | grep -v node_modules | grep -v .git`

### Existing Documentation

- Main README: @README.md
- Package configuration: @package.json
- Python requirements: @requirements.txt
- TypeScript config: @tsconfig.json
- Project documentation: @docs/

## Task: Generate Kiro Steering Documents

Create the three foundational steering documents that provide persistent knowledge about your project:

### 1. Product Overview (`product.md`)

Generate a comprehensive product overview that includes:

- **Product Overview**: Brief description of what the product is
- **Core Features**: Bulleted list of main capabilities
- **Target Use Case**: Specific scenarios the product addresses
- **Key Value Proposition**: Unique benefits and differentiators

This helps AI understand the context for technical decisions and business requirements.

### 2. Technology Stack (`tech.md`)

Document the complete technology landscape:

- **Architecture**: High-level system design (monolith, microservices, etc.)
- **Frontend**: Frameworks, libraries, build tools (if applicable)
- **Backend**: Language, framework, server technology (if applicable)
- **Development Environment**: Required tools and setup
- **Common Commands**: Frequently used development commands
- **Environment Variables**: Key configuration variables
- **Port Configuration**: Standard ports used by services

This guides AI to prefer established technology choices and patterns.

### 3. Project Structure (`structure.md`)

Outline the codebase organization:

- **Root Directory Organization**: Top-level structure with descriptions
- **Subdirectory Structures**: Detailed breakdown of key directories
- **Code Organization Patterns**: How code is structured (MVC, domain-driven, etc.)
- **File Naming Conventions**: Standards for naming files and directories
- **Import Organization**: How imports/dependencies are organized
- **Key Architectural Principles**: Core design decisions and patterns

This ensures generated code fits seamlessly into the existing codebase.

## Instructions

1. **Create `.kiro/steering/` directory** if it doesn't exist
2. **Analyze the codebase thoroughly** to understand current patterns and architecture
3. **Generate comprehensive but focused documents** - each file should be readable in 2-3 minutes
4. **Use clear markdown formatting** with proper headers and sections
5. **Include concrete examples** where helpful for understanding
6. **Focus on facts over assumptions** - document what exists, not what might be ideal
7. **Follow spec-driven development principles** - these documents will guide future specifications

The goal is to create a solid foundation of project knowledge that will make all future AI interactions more consistent and aligned with your project's standards, enabling effective spec-driven development.
ultrathink
