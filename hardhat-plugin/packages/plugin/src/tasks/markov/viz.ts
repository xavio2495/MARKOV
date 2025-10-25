import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import { displayCompactSplash } from "../../utils/splash.js";

interface MarkovVizArguments extends TaskArguments {
  format?: string;
}

/**
 * Check if contracts directory exists and has Solidity files
 */
function checkContractsDirectory(projectRoot: string): { exists: boolean; hasContracts: boolean; contractsDir: string } {
  const contractsDir = path.join(projectRoot, "contracts");

  if (!fs.existsSync(contractsDir)) {
    return { exists: false, hasContracts: false, contractsDir };
  }

  const hasContracts = fs.readdirSync(contractsDir).some(file => file.endsWith('.sol'));
  return { exists: true, hasContracts, contractsDir };
}

/**
 * Recursively find all Solidity files in a directory
 */
function findSolidityFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string, relativePath: string = "") {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath, path.join(relativePath, item));
      } else if (item.endsWith('.sol')) {
        files.push(path.join(relativePath, item));
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Parse Solidity file to extract imports
 */
function parseSolidityImports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ')) {
        // Handle both import patterns:
        // 1. import "file.sol";
        // 2. import { ... } from "file.sol";
        let match;
        
        // Pattern 1: import "file.sol";
        match = trimmed.match(/import\s+["']([^"']+)["']/);
        if (match) {
          imports.push(match[1]);
          continue;
        }
        
        // Pattern 2: import { ... } from "file.sol";
        match = trimmed.match(/import\s+{[^}]*}\s+from\s+["']([^"']+)["']/);
        if (match) {
          imports.push(match[1]);
        }
      }
    }

    return imports;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
    return [];
  }
}

/**
 * Build dependency graph from Solidity files
 */
function buildDependencyGraph(contractsDir: string, files: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const file of files) {
    const fullPath = path.join(contractsDir, file);
    const imports = parseSolidityImports(fullPath);
    graph.set(file, imports);
  }

  return graph;
}

/**
 * Generate ASCII tree structure
 */
function generateAsciiTree(files: string[], graph: Map<string, string[]>): string[] {
  const lines: string[] = [];
  const processed = new Set<string>();

  function addFile(file: string, prefix: string = "", isLast: boolean = true) {
    if (processed.has(file)) {
      return;
    }
    processed.add(file);

    // File name with color
    const fileName = path.basename(file);
    const dirName = path.dirname(file);
    const displayName = dirName && dirName !== '.' ? `${dirName}/${fileName}` : fileName;

    lines.push(`${prefix}${isLast ? "└── " : "├── "}${chalk.cyan(fileName)}`);

    // Add dependencies
    const deps = graph.get(file) || [];
    if (deps.length > 0) {
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      deps.forEach((dep, index) => {
        const isLastDep = index === deps.length - 1;
        lines.push(`${newPrefix}${isLastDep ? "└── " : "├── "}${chalk.gray(dep)} (import)`);
      });
    }
  }

  // Group files by directory for better organization
  const fileGroups = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file);
    const dirKey = dir === '.' ? 'root' : dir;
    if (!fileGroups.has(dirKey)) {
      fileGroups.set(dirKey, []);
    }
    fileGroups.get(dirKey)!.push(file);
  }

  // Sort directories and files
  const sortedDirs = Array.from(fileGroups.keys()).sort((a, b) => {
    if (a === 'root') return -1;
    if (b === 'root') return 1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < sortedDirs.length; i++) {
    const dir = sortedDirs[i];
    const dirFiles = fileGroups.get(dir)!;
    const isLastDir = i === sortedDirs.length - 1;

    if (dir !== 'root') {
      lines.push(`${isLastDir ? "└── " : "├── "}${chalk.blue(dir)}/`);
      const dirPrefix = isLastDir ? "    " : "│   ";

      dirFiles.sort().forEach((file, fileIndex) => {
        const isLastFile = fileIndex === dirFiles.length - 1;
        addFile(file, dirPrefix, isLastFile);
      });
    } else {
      // Root level files
      dirFiles.sort().forEach((file, fileIndex) => {
        const isLastFile = fileIndex === dirFiles.length - 1;
        addFile(file, "", isLastFile);
      });
    }
  }

  return lines;
}

/**
 * Generate ASCII dependency map
 */
function generateDependencyMap(files: string[], graph: Map<string, string[]>): string[] {
  const lines: string[] = [];
  const processed = new Set<string>();
  const fileIndex = new Map<string, number>();
  
  // Assign indices to files
  files.forEach((file, index) => {
    fileIndex.set(file, index);
  });

  function getShortName(file: string): string {
    return path.basename(file, '.sol');
  }

  // Show each file and its dependencies
  for (const file of files) {
    if (processed.has(file)) continue;
    processed.add(file);

    const shortName = getShortName(file);
    lines.push(chalk.cyan(`${shortName}`));
    
    const deps = graph.get(file) || [];
    if (deps.length > 0) {
      // Group dependencies by type
      const localDeps: string[] = [];
      const externalDeps: string[] = [];
      
      deps.forEach(dep => {
        if (dep.startsWith('./') || dep.startsWith('../')) {
          localDeps.push(dep);
        } else if (dep.startsWith('@') || dep.includes('/')) {
          externalDeps.push(dep);
        } else {
          localDeps.push(dep);
        }
      });

      // Show local dependencies
      if (localDeps.length > 0) {
        localDeps.forEach((dep, index) => {
          const isLast = index === localDeps.length - 1 && externalDeps.length === 0;
          const prefix = isLast ? "└── " : "├── ";
          const depName = dep.replace('./', '').replace('../', '').replace('.sol', '');
          lines.push(`    ${prefix}${chalk.green(depName)}`);
        });
      }

      // Show external dependencies
      if (externalDeps.length > 0) {
        if (localDeps.length > 0) {
          lines.push("    ├──");
        }
        externalDeps.forEach((dep, index) => {
          const isLast = index === externalDeps.length - 1;
          const prefix = isLast ? "└── " : "├── ";
          lines.push(`    ${prefix}${chalk.yellow(dep)} (external)`);
        });
      }
    } else {
      lines.push("    (no dependencies)");
    }
    
    lines.push("");
  }

  return lines;
}

/**
 * Visualize Diamond structure and history.
 */
export default async function markovViz(
  taskArguments: MarkovVizArguments,
  hre: HardhatRuntimeEnvironment,
) {
  displayCompactSplash();
  console.log(chalk.bold.blue("\n=== Contract Structure Visualization ===\n"));

  const projectRoot = process.cwd();
  const { exists, hasContracts, contractsDir } = checkContractsDirectory(projectRoot);

  if (!exists) {
    console.log(chalk.red("No contracts directory found."));
    console.log(chalk.yellow("Please ensure you have a 'contracts' directory with Solidity files."));
    return;
  }

  if (!hasContracts) {
    console.log(chalk.red("No Solidity files found in contracts directory."));
    console.log(chalk.yellow("Please add .sol files to your contracts directory."));
    return;
  }

  console.log(chalk.green(`Found contracts directory: ${chalk.cyan(contractsDir)}`));

  // Find all Solidity files
  const solidityFiles = findSolidityFiles(contractsDir);
  console.log(chalk.green(`Found ${chalk.cyan(solidityFiles.length.toString())} Solidity file(s)`));

  if (solidityFiles.length === 0) {
    console.log(chalk.yellow("No Solidity files to visualize."));
    return;
  }

  // Build dependency graph
  console.log(chalk.blue("\nAnalyzing dependencies..."));
  const dependencyGraph = buildDependencyGraph(contractsDir, solidityFiles);

  // Generate and display dependency map
  console.log(chalk.red("\nDependency Map:"));
  const mapLines = generateDependencyMap(solidityFiles, dependencyGraph);
  mapLines.forEach(line => console.log(line));

  // Summary statistics
  const totalImports = Array.from(dependencyGraph.values()).reduce((sum, deps) => sum + deps.length, 0);
  const filesWithDeps = Array.from(dependencyGraph.values()).filter(deps => deps.length > 0).length;

  console.log(chalk.blue(`\nSummary:`));
  console.log(chalk.white(`  Total files: ${chalk.cyan(solidityFiles.length.toString())}`));
  console.log(chalk.white(`  Files with dependencies: ${chalk.cyan(filesWithDeps.toString())}`));
  console.log(chalk.white(`  Total imports: ${chalk.cyan(totalImports.toString())}`));

  if (taskArguments.format === "json") {
    console.log(chalk.blue("\nJSON Output:"));
    const jsonOutput = {
      contractsDir,
      files: solidityFiles,
      dependencies: Object.fromEntries(dependencyGraph),
      summary: {
        totalFiles: solidityFiles.length,
        filesWithDeps,
        totalImports
      }
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  }
}
