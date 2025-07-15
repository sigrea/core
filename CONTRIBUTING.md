# Contributing to Sigrea

Thank you for your interest in contributing to Sigrea! We're excited to have you join our community. This guide will help you get started with contributing to the project.

## Code of Conduct

Please be respectful and considerate in all interactions. We strive to maintain a welcoming and inclusive community.

## How to Contribute

### Reporting Issues

- **Search first**: Check if the issue already exists before creating a new one
- **Be specific**: Include reproduction steps, expected behavior, and actual behavior
- **Provide context**: Include TypeScript version, Node.js version, and relevant environment details
- **Use templates**: Follow the issue template if provided

### Suggesting Features

- Open an issue to discuss the feature before implementing
- Explain the use case and why it benefits the library
- Consider the impact on API surface area and backward compatibility

### Pull Requests

We love pull requests! Here's how to contribute code:

1. **Fork the repository** and create your branch from `master`
2. **Install dependencies**: `pnpm install`
3. **Make your changes** following our coding standards
4. **Add tests** for any new functionality
5. **Run tests**: `pnpm test`
6. **Format code**: `pnpm format`
7. **Commit** using descriptive commit messages
8. **Push** to your fork and submit a pull request

## Development Setup

### Prerequisites

- Node.js 16+
- pnpm 8+

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/sigrea.git
cd sigrea

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Build the library
pnpm build

# Format code
pnpm format

# Run example
pnpm start
```

## Project Structure

```
packages/
├── reactive-system/    # Core reactive system
├── signal/            # Signal implementation
├── computed/          # Computed implementation
├── asyncComputed/     # Async computed implementation
├── effect/            # Effect implementation
├── watch/             # Watch implementation
├── batch/             # Batching utilities
└── utils/             # Type guards and utilities
```

Each package has:
- `index.ts` - Implementation
- `index.test.ts` - Unit tests

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Provide explicit return types for public APIs
- Use generics appropriately
- Avoid `any` types

### Code Style

- We use Biome for formatting and linting
- Run `pnpm format` before committing
- Follow existing patterns in the codebase
- Keep functions small and focused
- Use descriptive variable names

### Testing

- Write tests for all new features
- Place tests in `*.test.ts` files
- Use Vitest for testing
- Aim for high coverage but focus on meaningful tests
- Test edge cases and error conditions

### Performance

- Consider performance implications of changes
- Avoid unnecessary allocations
- Test with large datasets when relevant
- Profile before and after significant changes

## Commit Guidelines

We follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(signal): add batch update support
fix(computed): prevent memory leak in circular dependencies
docs: update API reference for asyncComputed
```

## Review Process

1. All submissions require review before merging
2. We'll review your PR as soon as possible
3. Be responsive to feedback
4. Keep PRs focused - one feature/fix per PR

## Documentation

- Update README.md if you change the API
- Add JSDoc comments for public APIs
- Include examples for new features
- Keep documentation concise and clear

## Dependency Management

### Renovate Bot

We use Renovate to automatically manage dependency updates:

- **Automatic PRs**: Renovate creates PRs for dependency updates
- **Grouped Updates**: Minor and patch updates are grouped together
- **Automerge**: Non-major updates are automatically merged after tests pass
- **Schedule**: Updates run on weekday evenings and weekends (Asia/Tokyo timezone)
- **Lock File Maintenance**: pnpm lock file is updated weekly

### Manual Updates

If you need to update dependencies manually:

```bash
# Update a specific package
pnpm update package-name

# Update all dependencies
pnpm update

# After updating, ensure lock file is clean
pnpm install
```

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion in GitHub Discussions
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Sigrea! 🎉