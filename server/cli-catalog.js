#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const TOOLS_REGISTRY_PATH = path.join(RUNTIME_DIR, 'cli_tools.json');

// Game development & asset pipeline format definitions
const GAME_DEV_FORMATS = {
  models: ['.dts', '.dae', '.gltf', '.glb', '.obj', '.fbx', '.3ds', '.blend'],
  interiors_and_maps: ['.dif', '.map', '.bsp', '.mis', '.ter', '.prefab'],
  textures: ['.dds', '.png', '.tga', '.bmp', '.jpg', '.jpeg', '.pvr', '.ktx'],
  scripts_and_config: ['.cs', '.gui', '.ts', '.lua', '.json', '.xml', '.ini', '.cfg'],
  audio: ['.wav', '.ogg', '.flac', '.mp3']
};

class CliCatalog {
  constructor(runtimeDir = RUNTIME_DIR) {
    this.runtimeDir = runtimeDir;
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }
    this.registryFile = path.join(this.runtimeDir, 'cli_tools.json');
    this.ensureRegistry();
  }

  ensureRegistry() {
    if (!fs.existsSync(this.registryFile)) {
      fs.writeFileSync(this.registryFile, JSON.stringify({ tools: [], custom: [] }, null, 2), 'utf8');
    }
  }

  getRegistry() {
    try {
      return JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
    } catch {
      return { tools: [], custom: [] };
    }
  }

  saveRegistry(data) {
    try {
      fs.writeFileSync(this.registryFile, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scans a codebase for CLI tools, asset converters, build scripts, and game dev pipelines.
   */
  scanProject(cwd = process.cwd()) {
    const discovered = [];
    const gameAssetsFound = {
      models: 0,
      interiors_and_maps: 0,
      textures: 0,
      scripts_and_config: 0,
      audio: 0
    };

    // 1. Scan package.json scripts (if Node / JS / TS project)
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts) {
          for (const [name, cmd] of Object.entries(pkg.scripts)) {
            discovered.push({
              name: `npm run ${name}`,
              type: 'npm-script',
              command: `npm run ${name}`,
              category: this.inferCategory(name, cmd),
              description: `package.json script: ${cmd}`,
              source: 'package.json'
            });
          }
        }
      } catch {}
    }

    // 2. Scan Makefile targets
    const makefilePath = path.join(cwd, 'Makefile');
    if (fs.existsSync(makefilePath)) {
      try {
        const content = fs.readFileSync(makefilePath, 'utf8');
        const targetRegex = /^([a-zA-Z0-9_\-\.]+)\s*:(?!=)/gm;
        let match;
        const targets = new Set();
        while ((match = targetRegex.exec(content)) !== null) {
          const t = match[1];
          if (!t.startsWith('.') && t !== 'Makefile') {
            targets.add(t);
          }
        }
        targets.forEach(t => {
          discovered.push({
            name: `make ${t}`,
            type: 'make-target',
            command: `make ${t}`,
            category: this.inferCategory(t, ''),
            description: `Makefile target`,
            source: 'Makefile'
          });
        });
      } catch {}
    }

    // 3. Scan CMakeLists.txt (Standard for C/C++ game engines like Torque / Tribes)
    const cmakePath = path.join(cwd, 'CMakeLists.txt');
    if (fs.existsSync(cmakePath)) {
      try {
        const content = fs.readFileSync(cmakePath, 'utf8');
        const execRegex = /add_executable\s*\(\s*([a-zA-Z0-9_\-\.]+)/gi;
        let match;
        while ((match = execRegex.exec(content)) !== null) {
          discovered.push({
            name: `cmake target: ${match[1]}`,
            type: 'cmake-executable',
            command: `cmake --build . --target ${match[1]}`,
            category: 'Build & Binary',
            description: `CMake executable target`,
            source: 'CMakeLists.txt'
          });
        }
      } catch {}
    }

    // 4. Scan tool directories: tools/, scripts/, bin/, utilities/
    const candidateDirs = ['tools', 'scripts', 'bin', 'utilities', 'src/tools'];
    for (const dir of candidateDirs) {
      const fullDir = path.join(cwd, dir);
      if (fs.existsSync(fullDir)) {
        try {
          const files = fs.readdirSync(fullDir);
          for (const file of files) {
            const filePath = path.join(fullDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const ext = path.extname(file).toLowerCase();
              const isExec = (stat.mode & 0o111) !== 0 || ['.sh', '.py', '.js', '.pl', '.bash'].includes(ext);
              if (isExec) {
                const headerInfo = this.extractHeaderHelp(filePath);
                discovered.push({
                  name: file,
                  type: 'script-tool',
                  command: `./${path.relative(cwd, filePath)}`,
                  category: this.inferCategory(file, headerInfo),
                  description: headerInfo || `Tool located in ${dir}/`,
                  source: path.relative(cwd, filePath)
                });
              }
            }
          }
        } catch {}
      }
    }

    // 5. Game Development Asset Pipeline Detector (DTS, DIF, TER, CS, DDS, etc.)
    try {
      const scanExts = Object.values(GAME_DEV_FORMATS).flat();
      // Fast non-recursive check of common asset directories
      const assetDirs = ['.', 'data', 'assets', 'art', 'shapes', 'interiors', 'terrains', 'missions', 'scripts'];
      for (const ad of assetDirs) {
        const fullAd = path.join(cwd, ad);
        if (fs.existsSync(fullAd)) {
          const entries = fs.readdirSync(fullAd);
          for (const e of entries) {
            const ext = path.extname(e).toLowerCase();
            if (GAME_DEV_FORMATS.models.includes(ext)) gameAssetsFound.models++;
            else if (GAME_DEV_FORMATS.interiors_and_maps.includes(ext)) gameAssetsFound.interiors_and_maps++;
            else if (GAME_DEV_FORMATS.textures.includes(ext)) gameAssetsFound.textures++;
            else if (GAME_DEV_FORMATS.scripts_and_config.includes(ext)) gameAssetsFound.scripts_and_config++;
            else if (GAME_DEV_FORMATS.audio.includes(ext)) gameAssetsFound.audio++;
          }
        }
      }
    } catch {}

    // Merge with custom registered tools
    const reg = this.getRegistry();
    const custom = reg.custom || [];

    const totalTools = [...discovered, ...custom];
    reg.tools = discovered;
    this.saveRegistry(reg);

    const isGameProject = Object.values(gameAssetsFound).some(v => v > 0);

    return {
      timestamp: new Date().toISOString(),
      cwd,
      totalCount: totalTools.length,
      discoveredCount: discovered.length,
      customCount: custom.length,
      tools: totalTools,
      isGameProject,
      gameAssetsFound
    };
  }

  /**
   * Infer a human-friendly category from tool name/content
   */
  inferCategory(name, info = '') {
    const text = `${name} ${info}`.toLowerCase();
    if (text.includes('convert') || text.includes('export') || text.includes('import') || text.includes('dts') || text.includes('dif') || text.includes('asset') || text.includes('mesh')) {
      return 'Asset Converter / Pipeline';
    }
    if (text.includes('build') || text.includes('compile') || text.includes('cmake') || text.includes('pack')) {
      return 'Build System';
    }
    if (text.includes('test') || text.includes('spec') || text.includes('check') || text.includes('lint')) {
      return 'Test & Verification';
    }
    if (text.includes('server') || text.includes('dedicated') || text.includes('host') || text.includes('run')) {
      return 'Engine / Runtime';
    }
    return 'Utility';
  }

  /**
   * Safely extract header comments or usage from a script without running it
   */
  extractHeaderHelp(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').slice(0, 15);
      const comments = [];
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
          const c = trimmed.replace(/^[#\/]+\s*/, '');
          if (c && !c.startsWith('!') && !c.includes('eslint') && !c.includes('@ts-')) {
            comments.push(c);
          }
        }
      }
      return comments.slice(0, 2).join(' — ') || '';
    } catch {
      return '';
    }
  }

  /**
   * Register a custom tool or CLI shortcut
   */
  registerTool({ name, command, category = 'Custom Utility', description = '', args = '' }) {
    if (!name || !command) {
      return { success: false, error: 'Both name and command are required' };
    }

    const reg = this.getRegistry();
    if (!reg.custom) reg.custom = [];

    // Check if exists
    const idx = reg.custom.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
    const toolObj = {
      name,
      command,
      category,
      description,
      args,
      type: 'custom',
      created_at: new Date().toISOString()
    };

    if (idx >= 0) {
      reg.custom[idx] = toolObj;
    } else {
      reg.custom.push(toolObj);
    }

    this.saveRegistry(reg);
    return { success: true, tool: toolObj, isNew: idx < 0 };
  }

  /**
   * Remove a tool from the custom registry
   */
  removeTool(name) {
    if (!name) return { success: false, error: 'Tool name is required' };

    const reg = this.getRegistry();
    if (!reg.custom) return { success: false, error: 'No custom tools registered' };

    const initialLen = reg.custom.length;
    reg.custom = reg.custom.filter(t => t.name.toLowerCase() !== name.toLowerCase());

    if (reg.custom.length === initialLen) {
      return { success: false, error: `Tool "${name}" not found in custom registry` };
    }

    this.saveRegistry(reg);
    return { success: true, removed: name, remaining: reg.custom.length };
  }

  /**
   * Formats a clean, readable text overview of all project tools
   */
  renderCatalog(cwd = process.cwd()) {
    const scan = this.scanProject(cwd);
    let out = `╔══════════════════════════════════════════════════════════════╗\n`;
    out += `║  🛠️  PROJECT TOOLCHAIN & CLI CATALOG                        ║\n`;
    out += `╚══════════════════════════════════════════════════════════════╝\n`;

    if (scan.isGameProject) {
      out += `\x1b[1m\x1b[35m[Game Dev Asset Detection Active]\x1b[0m\n`;
      out += `  • 3D Shapes/Models (.dts, .dae, .gltf): ${scan.gameAssetsFound.models}\n`;
      out += `  • Interiors & Maps (.dif, .mis, .ter): ${scan.gameAssetsFound.interiors_and_maps}\n`;
      out += `  • Textures (.dds, .png): ${scan.gameAssetsFound.textures}\n`;
      out += `  • Game Scripts (.cs, .gui): ${scan.gameAssetsFound.scripts_and_config}\n`;
      out += `  • Audio (.wav, .ogg): ${scan.gameAssetsFound.audio}\n\n`;
    }

    if (scan.totalCount === 0) {
      out += `No custom CLI tools or scripts detected in ${cwd}.\n`;
      out += `Register new project commands with:\n  anchor-labs-projects tool add "<name>" "<command>" [desc]\n`;
      return out;
    }

    // Group by category
    const categories = {};
    scan.tools.forEach(t => {
      const cat = t.category || 'General Utilities';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(t);
    });

    for (const [cat, list] of Object.entries(categories)) {
      out += `\x1b[1m\x1b[36m[${cat}]\x1b[0m\n`;
      list.forEach(t => {
        const cmdText = t.command ? ` \x1b[90m(${t.command})\x1b[0m` : '';
        const descText = t.description ? `\n      \x1b[37m${t.description}\x1b[0m` : '';
        out += `  • \x1b[1m\x1b[32m${t.name}\x1b[0m${cmdText}${descText}\n`;
      });
      out += `\n`;
    }

    out += `\x1b[90mTip: Run 'anchor-labs-projects tool add <name> <cmd>' to add or remove tools as needed.\x1b[0m\n`;
    return out;
  }
}

module.exports = CliCatalog;
