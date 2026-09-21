#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const GRAPHS_DIR = path.join(RUNTIME_DIR, 'graphs');

class GraphEngine {
  constructor(runtimeDir = RUNTIME_DIR) {
    this.graphsDir = path.join(runtimeDir, 'graphs');
    if (!fs.existsSync(this.graphsDir)) {
      fs.mkdirSync(this.graphsDir, { recursive: true });
    }
  }

  // Palettes designed with perceptual luminance separation and high contrast against dark backgrounds
  getPalette() {
    return {
      bg: '#0f172a',
      cardBg: '#1e293b',
      border: '#334155',
      grid: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      accentPrimary: '#38bdf8',    // Cyan
      accentSuccess: '#34d399',    // Emerald
      accentWarning: '#fbbf24',    // Amber
      accentDanger: '#fb7185',     // Rose
      accentPurple: '#a78bfa',     // Violet
      accentIndigo: '#818cf8',     // Indigo
      series: ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf']
    };
  }

  /**
   * Automatically select best chart type if not specified
   */
  inferChartType(dataset) {
    if (!dataset || (Array.isArray(dataset) && dataset.length === 0)) return 'task_distribution';
    if (dataset.dimensions && Array.isArray(dataset.dimensions)) return 'radar';
    if (Array.isArray(dataset)) {
      const sample = dataset[0];
      if (sample.passed !== undefined || sample.failed !== undefined) return 'test_trend';
      if (sample.remaining !== undefined || sample.ideal !== undefined) return 'burndown';
      if (sample.latency !== undefined || sample.ops_sec !== undefined) return 'benchmark';
      if (sample.status !== undefined || sample.category !== undefined) return 'task_distribution';
    }
    return 'task_distribution';
  }

  generateChart({ type, title, data, filename }) {
    const chartType = type || this.inferChartType(data);
    let svg = '';

    switch (chartType) {
      case 'test_trend':
        svg = this.renderTestTrend(title || 'Test Execution & Pass Rates', data);
        break;
      case 'burndown':
        svg = this.renderBurndown(title || 'Sprint Task Burndown', data);
        break;
      case 'task_distribution':
        svg = this.renderTaskDistribution(title || 'Project Task Status Breakdown', data);
        break;
      case 'benchmark':
        svg = this.renderBenchmark(title || 'Performance & Latency Benchmarks', data);
        break;
      case 'module_metrics':
        svg = this.renderModuleMetrics(title || 'Module Complexity & Test Coverage', data);
        break;
      case 'radar':
        svg = this.renderRadar(title || 'Project Engineering Health Profile', data);
        break;
      default:
        svg = this.renderTaskDistribution(title || 'Task Breakdown', data);
    }

    const safeName = (filename || `chart_${Date.now()}`).replace(/[^a-z0-9_-]/gi, '_') + '.svg';
    const filePath = path.join(this.graphsDir, safeName);
    fs.writeFileSync(filePath, svg, 'utf8');

    return {
      type: chartType,
      title: title || 'Project Chart',
      filePath,
      svg
    };
  }

  renderTestTrend(title, data = []) {
    const p = this.getPalette();
    const width = 800;
    const height = 400;
    const padLeft = 70;
    const padRight = 40;
    const padTop = 60;
    const padBottom = 60;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const items = data.length > 0 ? data : [
      { timestamp: 'Run 1', passed: 12, failed: 3, skipped: 1 },
      { timestamp: 'Run 2', passed: 14, failed: 2, skipped: 0 },
      { timestamp: 'Run 3', passed: 15, failed: 1, skipped: 0 },
      { timestamp: 'Run 4', passed: 16, failed: 1, skipped: 0 },
      { timestamp: 'Run 5', passed: 18, failed: 0, skipped: 0 }
    ];

    const maxVal = Math.max(...items.map(d => (d.passed || 0) + (d.failed || 0)), 10) * 1.15;
    const stepX = chartW / Math.max(items.length - 1, 1);

    const passPoints = items.map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartH - ((d.passed || 0) / maxVal) * chartH;
      return `${x},${y}`;
    }).join(' ');

    const failPoints = items.map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartH - ((d.failed || 0) / maxVal) * chartH;
      return `${x},${y}`;
    }).join(' ');

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="${padLeft}" y="45" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${title}</text>
  
  <!-- Legend -->
  <circle cx="${width - 190}" cy="40" r="5" fill="${p.accentSuccess}" />
  <text x="${width - 180}" y="44" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12">Passed</text>
  <circle cx="${width - 110}" cy="40" r="5" fill="${p.accentDanger}" />
  <text x="${width - 100}" y="44" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12">Failed</text>

  <!-- Horizontal Grid Lines -->
  ${[0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = padTop + chartH * (1 - pct);
    const val = Math.round(maxVal * pct);
    return `
    <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="${p.border}" stroke-width="1" stroke-dasharray="3,3" />
    <text x="${padLeft - 10}" y="${y + 4}" fill="${p.textMuted}" font-family="system-ui, sans-serif" font-size="11" text-anchor="end">${val}</text>`;
  }).join('')}

  <!-- Data Lines -->
  <polyline fill="none" stroke="${p.accentSuccess}" stroke-width="3" points="${passPoints}" />
  <polyline fill="none" stroke="${p.accentDanger}" stroke-width="2.5" stroke-dasharray="4,4" points="${failPoints}" />

  <!-- Data Dots & X Labels -->
  ${items.map((d, i) => {
    const x = padLeft + i * stepX;
    const py = padTop + chartH - ((d.passed || 0) / maxVal) * chartH;
    const fy = padTop + chartH - ((d.failed || 0) / maxVal) * chartH;
    const label = d.timestamp ? (d.timestamp.length > 10 ? d.timestamp.substring(11, 19) : d.timestamp) : `#${i+1}`;
    return `
    <circle cx="${x}" cy="${py}" r="4.5" fill="${p.accentSuccess}" stroke="${p.cardBg}" stroke-width="1.5" />
    <circle cx="${x}" cy="${fy}" r="4" fill="${p.accentDanger}" stroke="${p.cardBg}" stroke-width="1.5" />
    <text x="${x}" y="${padTop + chartH + 24}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">${label}</text>`;
  }).join('')}
</svg>`.trim();
  }

  renderTaskDistribution(title, tasks = []) {
    const p = this.getPalette();
    const width = 700;
    const height = 360;

    let completed = 0, inProgress = 0, todo = 0, blocked = 0;
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(t => {
        if (t.status === 'completed' || t.status === 'done') completed++;
        else if (t.status === 'in_progress') inProgress++;
        else if (t.status === 'blocked') blocked++;
        else todo++;
      });
    } else {
      completed = 6; inProgress = 3; todo = 4; blocked = 1;
    }

    const categories = [
      { label: 'Completed', count: completed, color: p.accentSuccess },
      { label: 'In Progress', count: inProgress, color: p.accentPrimary },
      { label: 'Todo / Backlog', count: todo, color: p.accentWarning },
      { label: 'Blocked / Risk', count: blocked, color: p.accentDanger }
    ];

    const total = categories.reduce((s, c) => s + c.count, 0) || 1;
    const maxCount = Math.max(...categories.map(c => c.count), 5);
    const chartY = 80;
    const barHeight = 32;
    const gap = 24;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="50" y="55" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${title}</text>
  <text x="${width - 50}" y="55" fill="${p.textMuted}" font-family="system-ui, sans-serif" font-size="12" text-anchor="end">Total Tasks: ${total}</text>

  ${categories.map((c, i) => {
    const y = chartY + i * (barHeight + gap);
    const barWidth = Math.max((c.count / maxCount) * 380, 4);
    const pct = Math.round((c.count / total) * 100);
    return `
    <text x="50" y="${y + 20}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="13" font-weight="500">${c.label}</text>
    <!-- Background track -->
    <rect x="180" y="${y}" width="380" height="${barHeight}" fill="${p.bg}" rx="4" />
    <!-- Value bar -->
    <rect x="180" y="${y}" width="${barWidth}" height="${barHeight}" fill="${c.color}" rx="4" />
    <text x="${180 + barWidth + 12}" y="${y + 21}" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="13" font-weight="600">${c.count} <tspan fill="${p.textMuted}" font-size="11">(${pct}%)</tspan></text>`;
  }).join('')}
</svg>`.trim();
  }

  renderBurndown(title, data = []) {
    const p = this.getPalette();
    const width = 800;
    const height = 400;
    const padLeft = 60;
    const padRight = 40;
    const padTop = 60;
    const padBottom = 50;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const points = data.length > 0 ? data : [
      { day: 'Day 1', ideal: 20, actual: 20 },
      { day: 'Day 2', ideal: 16, actual: 18 },
      { day: 'Day 3', ideal: 12, actual: 15 },
      { day: 'Day 4', ideal: 8, actual: 9 },
      { day: 'Day 5', ideal: 4, actual: 5 },
      { day: 'Day 6', ideal: 0, actual: 1 }
    ];

    const maxVal = Math.max(...points.map(d => Math.max(d.ideal || 0, d.actual || 0)), 10) * 1.1;
    const stepX = chartW / Math.max(points.length - 1, 1);

    const idealCoords = points.map((d, i) => `${padLeft + i * stepX},${padTop + chartH - (d.ideal / maxVal) * chartH}`).join(' ');
    const actualCoords = points.map((d, i) => `${padLeft + i * stepX},${padTop + chartH - (d.actual / maxVal) * chartH}`).join(' ');

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="${padLeft}" y="45" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${title}</text>
  
  <circle cx="${width - 190}" cy="40" r="5" fill="${p.textMuted}" />
  <text x="${width - 180}" y="44" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12">Ideal Guideline</text>
  <circle cx="${width - 80}" cy="40" r="5" fill="${p.accentPrimary}" />
  <text x="${width - 70}" y="44" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12">Actual</text>

  <!-- Data Lines -->
  <polyline fill="none" stroke="${p.textMuted}" stroke-width="2" stroke-dasharray="5,5" points="${idealCoords}" />
  <polyline fill="none" stroke="${p.accentPrimary}" stroke-width="3" points="${actualCoords}" />

  ${points.map((d, i) => {
    const x = padLeft + i * stepX;
    const ay = padTop + chartH - (d.actual / maxVal) * chartH;
    return `
    <circle cx="${x}" cy="${ay}" r="4.5" fill="${p.accentPrimary}" stroke="${p.cardBg}" stroke-width="1.5" />
    <text x="${x}" y="${padTop + chartH + 24}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">${d.day}</text>`;
  }).join('')}
</svg>`.trim();
  }

  renderBenchmark(title, data = []) {
    const p = this.getPalette();
    const width = 760;
    const height = 380;
    const padLeft = 140;
    const padRight = 50;
    const padTop = 60;
    const padBottom = 40;

    const items = data.length > 0 ? data : [
      { name: 'Cold Startup', val: 120, unit: 'ms' },
      { name: 'MCP Dispatch', val: 4.2, unit: 'ms' },
      { name: 'Git Scan (100 commits)', val: 45, unit: 'ms' },
      { name: 'Memory Reconcile', val: 12, unit: 'ms' },
      { name: 'SVG Render', val: 3.1, unit: 'ms' }
    ];

    const maxVal = Math.max(...items.map(d => d.val), 10) * 1.15;
    const chartW = width - padLeft - padRight;
    const rowH = (height - padTop - padBottom) / items.length;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="50" y="45" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${title}</text>

  ${items.map((item, i) => {
    const y = padTop + i * rowH;
    const barW = Math.max((item.val / maxVal) * chartW, 5);
    const color = p.series[i % p.series.length];
    return `
    <text x="${padLeft - 15}" y="${y + 20}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12" text-anchor="end">${item.name}</text>
    <rect x="${padLeft}" y="${y + 6}" width="${chartW}" height="18" fill="${p.bg}" rx="3" />
    <rect x="${padLeft}" y="${y + 6}" width="${barW}" height="18" fill="${color}" rx="3" />
    <text x="${padLeft + barW + 10}" y="${y + 20}" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="12" font-weight="600">${item.val} ${item.unit || ''}</text>`;
  }).join('')}
</svg>`.trim();
  }

  renderModuleMetrics(title, data = []) {
    const p = this.getPalette();
    const width = 760;
    const height = 380;
    const padLeft = 130;
    const chartW = 540;

    const items = data.length > 0 ? data : [
      { module: 'Core Server', coverage: 92, complexity: 14 },
      { module: 'Git Engine', coverage: 88, complexity: 18 },
      { module: 'Reconciler', coverage: 95, complexity: 8 },
      { module: 'CLI Tools', coverage: 84, complexity: 22 },
      { module: 'Plugins/Hooks', coverage: 90, complexity: 11 }
    ];

    const rowH = 50;
    const startY = 75;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="50" y="48" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${title}</text>
  <text x="${width - 50}" y="48" fill="${p.textMuted}" font-family="system-ui, sans-serif" font-size="11" text-anchor="end">Coverage (%) & Cyclomatic Score</text>

  ${items.map((item, i) => {
    const y = startY + i * rowH;
    const covW = (item.coverage / 100) * 360;
    return `
    <text x="${padLeft - 15}" y="${y + 16}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="12" text-anchor="end">${item.module}</text>
    <rect x="${padLeft}" y="${y}" width="360" height="22" fill="${p.bg}" rx="4" />
    <rect x="${padLeft}" y="${y}" width="${covW}" height="22" fill="${p.accentSuccess}" rx="4" />
    <text x="${padLeft + covW + 10}" y="${y + 16}" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="12" font-weight="600">${item.coverage}%</text>
    <text x="${width - 50}" y="${y + 16}" fill="${p.accentPurple}" font-family="system-ui, sans-serif" font-size="12" text-anchor="end">C: ${item.complexity}</text>`;
  }).join('')}
</svg>`.trim();
  }

  renderRadar(title, data) {
    const p = this.getPalette();
    const width = 600;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2 + 15;
    const radius = 160;

    const dimensions = (data && data.dimensions) || [
      { name: 'Test Coverage', score: 88 },
      { name: 'Build Speed', score: 94 },
      { name: 'Code Modularity', score: 82 },
      { name: 'Git Discipline', score: 90 },
      { name: 'Doc Completeness', score: 85 }
    ];

    const numAxes = dimensions.length;
    const angleStep = (Math.PI * 2) / numAxes;

    // Web circles
    const webs = [0.25, 0.5, 0.75, 1.0].map(pct => {
      const pts = [];
      for (let i = 0; i < numAxes; i++) {
        const a = i * angleStep - Math.PI / 2;
        pts.push(`${cx + Math.cos(a) * radius * pct},${cy + Math.sin(a) * radius * pct}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="${p.border}" stroke-width="1" />`;
    }).join('');

    // Axis lines
    const axes = dimensions.map((d, i) => {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      const lx = cx + Math.cos(a) * (radius + 24);
      const ly = cy + Math.sin(a) * (radius + 24);
      return `
      <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${p.border}" stroke-width="1" />
      <text x="${lx}" y="${ly + 4}" fill="${p.textSecondary}" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">${d.name} (${d.score})</text>`;
    }).join('');

    // Data polygon
    const dataPoints = dimensions.map((d, i) => {
      const a = i * angleStep - Math.PI / 2;
      const r = (d.score / 100) * radius;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(' ');

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${p.bg}" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="${p.cardBg}" rx="8" stroke="${p.border}" stroke-width="1" />
  
  <text x="${cx}" y="45" fill="${p.textPrimary}" font-family="system-ui, sans-serif" font-size="16" font-weight="600" text-anchor="middle">${title}</text>

  ${webs}
  ${axes}

  <polygon points="${dataPoints}" fill="${p.accentPrimary}" fill-opacity="0.25" stroke="${p.accentPrimary}" stroke-width="2.5" />
  ${dimensions.map((d, i) => {
    const a = i * angleStep - Math.PI / 2;
    const r = (d.score / 100) * radius;
    return `<circle cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="4" fill="${p.accentPrimary}" stroke="${p.cardBg}" stroke-width="1.5" />`;
  }).join('')}
</svg>`.trim();
  }
}

module.exports = GraphEngine;
