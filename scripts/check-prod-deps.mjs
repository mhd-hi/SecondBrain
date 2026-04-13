import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nextDir = path.join(root, '.next');
const pkgJsonPath = path.join(root, 'package.json');

if (!fs.existsSync(pkgJsonPath)) {
  console.error('package.json not found.');
  process.exit(1);
}

if (!fs.existsSync(nextDir)) {
  console.error('Missing .next build output. Run `bun run build` first.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const devDependencies = new Set(Object.keys(pkg.devDependencies ?? {}));

if (devDependencies.size === 0) {
  console.log('No devDependencies declared. Nothing to verify.');
  process.exit(0);
}

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, files);
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function getPackageNameFromNodeModulesPath(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const markerIndex = normalizedPath.lastIndexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const packagePath = normalizedPath.slice(markerIndex + marker.length);
  const segments = packagePath.split('/');

  if (segments.length === 0 || !segments[0]) {
    return null;
  }

  if (segments[0].startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0];
}

function addFinding(findings, packageName, source) {
  if (!findings.has(packageName)) {
    findings.set(packageName, new Set());
  }
  findings.get(packageName).add(source);
}

const findings = new Map();

const traceFiles = walk(nextDir, filePath => filePath.endsWith('.nft.json'));
for (const traceFile of traceFiles) {
  const relativeTraceFile = path.relative(root, traceFile).replace(/\\/g, '/');
  if (!relativeTraceFile.startsWith('.next/server/')) {
    continue;
  }

  const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  for (const tracedFile of trace.files ?? []) {
    const packageName = getPackageNameFromNodeModulesPath(tracedFile);
    if (!packageName || !devDependencies.has(packageName)) {
      continue;
    }

    addFinding(
      findings,
      packageName,
      `trace:${relativeTraceFile}`,
    );
  }
}

if (findings.size > 0) {
  console.error('Dev-only packages were traced into the production runtime output:');
  for (const packageName of [...findings.keys()].sort()) {
    console.error(`- ${packageName}`);
    for (const source of [...findings.get(packageName)].sort()) {
      console.error(`  ${source}`);
    }
  }
  process.exit(1);
}

console.log('Production dependency check passed against app/server Next traces.');
