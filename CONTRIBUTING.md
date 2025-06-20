# Contributing to Minecraft Mod Updater

First off, thank you for considering contributing to Minecraft Mod Updater! Your help is highly appreciated and helps me improve this tool for the community.

This document outlines the process for contributing to this project, including setting up your development environment, submitting changes, and adhering to our coding standards.

---

## Table of Contents

- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Reporting Bugs and Issues](#reporting-bugs-and-issues)
- [Feature Requests](#feature-requests)
- [License](#license)

---

## How to Contribute

There are many ways to contribute to this project:

- Reporting bugs
- Suggesting features
- Improving documentation
- Submitting code changes (bug fixes, improvements, new features)

I appreciate all forms of contributions, big or small!

---

## Development Setup

To contribute code, follow these steps:

1. **Fork** this repository.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/<your-username>/AngularModUpdater.git
   cd AngularModUpdater
    ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Start the development server**:

   ```bash
   npm run start
   ```

5. Make your changes in a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

6. Commit and push your changes:

   ```bash
   git commit -m "feat(<scope>): <Add your feature summary>"
   git push origin feature/your-feature-name
   ```
   
## Development Notes

### Vercel Functions
 If you want to debug Vercel functions (e.g. proxy-file), you can install the Vercel CLI and run the functions locally:

 ```bash
  npm install -g vercel
  vercel dev
  ```

---

## Pull Request Guidelines

* Make sure your code builds and do a sanity check with the interface.
* Ensure your branch is up to date with `main` before submitting the PR.
* Include a clear description of your changes.
* Reference any related issues using `Fixes #issue-number`.

---

## Coding Standards

* Follow the Angular style guide: [https://angular.io/guide/styleguide](https://angular.io/guide/styleguide)
* Use clear, concise naming conventions.
* Format your code using Prettier or the default Angular formatter.

---

## Reporting Bugs and Issues

Please use [GitHub Issues](https://github.com/IsAvaible/AngularModUpdater/issues) to report problems or unexpected behavior.

When reporting a bug, include:

* A clear and descriptive title.
* Steps to reproduce the issue.
* Expected vs actual behavior.
* Environment (OS, Node version, Angular version).

---

## Feature Requests

If you have an idea for a new feature, open a [Feature Request](https://github.com/IsAvaible/AngularModUpdater/issues/new?labels=enhancement&template=feature_request.md). Describe the motivation and expected outcome.

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Minecraft Mod Updater! Your efforts help make this tool better for everyone in the community.
