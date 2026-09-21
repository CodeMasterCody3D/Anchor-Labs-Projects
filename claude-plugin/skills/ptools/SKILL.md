---
name: ptools
description: Scan repository for CLI commands, build targets, asset converters, game pipelines, and helper scripts
---

# /ptools — Project Toolchain & CLI Catalog

When this skill is invoked:
1. Run `anchor-labs-projects tools` (or call MCP tool `project_discover_tools`) to scan the current repository.
2. The scanner inspects:
   - Package scripts (`package.json`, `Cargo.toml`)
   - Build system targets (`Makefile`, `CMakeLists.txt`)
   - Custom executable scripts in `tools/`, `scripts/`, `bin/`, `utilities/`
   - Game development asset pipelines (Tribes/Torque formats: `.dts`, `.dif`, `.ter`, `.mis`, `.cs`, `.dds`, textures, maps)
3. Present the discovered tools categorized by function:
   - **Asset Converters & Pipelines**: Model, texture, audio, and map conversion scripts
   - **Build Systems**: Compilers, CMake targets, bundlers
   - **Engine & Runtime**: Dedicated server launchers, headless runners
   - **Test & Verification**: Linters, test suites, smoke scripts
4. If arguments are passed (e.g. `/ptools add <name> <cmd>` or `/ptools remove <name>`), manage custom tool registrations.
