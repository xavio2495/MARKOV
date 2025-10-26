import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import type { Commit, BranchConfig } from "../types.js";
import { validateBranchFile, createEmptyBranchFile, type BranchFile } from "./validators.js";

/**
 * Abstract interface for history storage.
 * Simplified architecture: only uses branch files in .markov/branches/<name>.json
 * Each branch file is self-contained with config and commits.
 * No more history.json, HEAD, or commits folder.
 */
export interface IHistoryStorage {
  // Branch operations
  createBranch(name: string, config: Omit<BranchConfig, "name">): Promise<void>;
  getBranchFile(name: string): Promise<BranchFile | null>;
  getAllBranchFiles(): Promise<BranchFile[]>;
  listBranches(): Promise<string[]>;
  deleteBranch(name: string): Promise<void>;
  updateBranchFile(branchFile: BranchFile): Promise<void>;

  // Commit operations
  addCommit(branchName: string, commit: Commit): Promise<void>;
  getCommit(hash: string): Promise<Commit | null>;
  getCommitsForBranch(branchName: string, limit?: number): Promise<Commit[]>;

  // Config operations (active branch tracking via config.json)
  getCurrentBranchName(): Promise<string>;
  setCurrentBranchName(branchName: string): Promise<void>;
  
  // Branch config sync
  getBranchConfig(branchName: string): Promise<BranchConfig | null>;
  updateBranchConfig(branchName: string, config: BranchConfig): Promise<void>;

  // Utility
  exists(): Promise<boolean>;
  initialize(rootPath: string): Promise<void>;
}

/**
 * File-based implementation of history storage.
 * NEW SIMPLIFIED ARCHITECTURE:
 * - No history.json, HEAD, or commits folder
 * - Only .markov/config.json and .markov/branches/<name>.json files
 * - Each branch file is self-contained with config + commits
 * - config.json tracks current branch and syncs with active branch's config
 */
export class FileHistoryStorage implements IHistoryStorage {
  private rootPath: string;
  private markovPath: string;
  private configPath: string;
  private branchesPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.markovPath = path.join(rootPath, ".markov");
    this.configPath = path.join(this.markovPath, "config.json");
    this.branchesPath = path.join(this.markovPath, "branches");
  }

  async initialize(rootPath: string): Promise<void> {
    this.rootPath = rootPath;
    this.markovPath = path.join(rootPath, ".markov");
    this.configPath = path.join(this.markovPath, "config.json");
    this.branchesPath = path.join(this.markovPath, "branches");

    // Create directories
    await fs.mkdir(this.markovPath, { recursive: true });
    await fs.mkdir(this.branchesPath, { recursive: true });

    // Initialize config.json with currentBranch if it doesn't exist
    if (!existsSync(this.configPath)) {
      const initialConfig = {
        currentBranch: "main",
      };
      await fs.writeFile(this.configPath, JSON.stringify(initialConfig, null, 2));
    }
  }

  async exists(): Promise<boolean> {
    return existsSync(this.markovPath) && existsSync(this.configPath);
  }

  // Branch operations
  async createBranch(name: string, config: Omit<BranchConfig, "name">): Promise<void> {
    const branchFilePath = path.join(this.branchesPath, `${name}.json`);

    // Check if branch already exists
    if (existsSync(branchFilePath)) {
      throw new Error(`Branch '${name}' already exists`);
    }

    // Create empty branch file with config
    const branchFile = createEmptyBranchFile(name, config);

    // Validate before saving
    const validation = validateBranchFile(branchFile);
    if (!validation.valid) {
      throw new Error(`Invalid branch file: ${validation.errors.join(", ")}`);
    }

    // Save branch file
    await fs.writeFile(branchFilePath, JSON.stringify(branchFile, null, 2));
  }

  async getBranchFile(name: string): Promise<BranchFile | null> {
    const branchFilePath = path.join(this.branchesPath, `${name}.json`);

    if (!existsSync(branchFilePath)) {
      return null;
    }

    const content = await fs.readFile(branchFilePath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate branch file
    const validation = validateBranchFile(parsed);
    if (!validation.valid) {
      console.warn(`Warning: Branch file ${name}.json failed validation:`, validation.errors);
      // Return anyway for backwards compatibility, but log warning
    }

    return parsed as BranchFile;
  }

  async getAllBranchFiles(): Promise<BranchFile[]> {
    if (!existsSync(this.branchesPath)) {
      return [];
    }

    const files = await fs.readdir(this.branchesPath);
    const branches: BranchFile[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const branchName = file.replace(".json", "");
        const branch = await this.getBranchFile(branchName);
        if (branch) {
          branches.push(branch);
        }
      }
    }

    return branches;
  }

  async listBranches(): Promise<string[]> {
    if (!existsSync(this.branchesPath)) {
      return [];
    }

    const files = await fs.readdir(this.branchesPath);
    const branchNames: string[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        branchNames.push(file.replace(".json", ""));
      }
    }

    return branchNames.sort();
  }

  async deleteBranch(name: string): Promise<void> {
    const branchFilePath = path.join(this.branchesPath, `${name}.json`);

    if (!existsSync(branchFilePath)) {
      throw new Error(`Branch '${name}' does not exist`);
    }

    // Prevent deleting current branch
    const currentBranch = await this.getCurrentBranchName();
    if (currentBranch === name) {
      throw new Error(`Cannot delete current branch '${name}'. Switch to another branch first.`);
    }

    // Delete branch file
    await fs.unlink(branchFilePath);
  }

  async updateBranchFile(branchFile: BranchFile): Promise<void> {
    const branchFilePath = path.join(this.branchesPath, `${branchFile.name}.json`);

    // Validate before saving
    const validation = validateBranchFile(branchFile);
    if (!validation.valid) {
      throw new Error(`Invalid branch file: ${validation.errors.join(", ")}`);
    }

    // Save branch file
    await fs.writeFile(branchFilePath, JSON.stringify(branchFile, null, 2));
  }

  // Commit operations
  async addCommit(branchName: string, commit: Commit): Promise<void> {
    const branch = await this.getBranchFile(branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    // Add commit to branch
    branch.commits.push(commit);

    // Update branch file
    await this.updateBranchFile(branch);
  }

  async getCommit(hash: string): Promise<Commit | null> {
    // Search all branches for the commit with this hash
    const branches = await this.getAllBranchFiles();

    for (const branch of branches) {
      const commit = branch.commits.find((c) => c.hash === hash);
      if (commit) {
        return commit;
      }
    }

    return null;
  }

  async getCommitsForBranch(branchName: string, limit?: number): Promise<Commit[]> {
    const branch = await this.getBranchFile(branchName);
    if (!branch) {
      return [];
    }

    const commits = branch.commits;
    if (limit && limit > 0) {
      return commits.slice(-limit).reverse();
    }

    return [...commits].reverse();
  }

  // Config operations (track current branch via config.json)
  async getCurrentBranchName(): Promise<string> {
    if (!existsSync(this.configPath)) {
      return "main";
    }

    const content = await fs.readFile(this.configPath, "utf-8");
    const config = JSON.parse(content);
    return config.currentBranch || "main";
  }

  async setCurrentBranchName(branchName: string): Promise<void> {
    // Verify branch exists
    const branch = await this.getBranchFile(branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    // Read current config
    let config: Record<string, any> = { currentBranch: branchName };
    if (existsSync(this.configPath)) {
      const content = await fs.readFile(this.configPath, "utf-8");
      config = JSON.parse(content);
      config.currentBranch = branchName;
    }

    // Update config.json with new current branch
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  // Branch config operations
  async getBranchConfig(branchName: string): Promise<BranchConfig | null> {
    const branch = await this.getBranchFile(branchName);
    if (!branch) {
      return null;
    }
    return branch.config;
  }

  async updateBranchConfig(branchName: string, config: BranchConfig): Promise<void> {
    const branch = await this.getBranchFile(branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    // Update config in branch file
    branch.config = config;
    await this.updateBranchFile(branch);
  }
}

/**
 * Utility function to generate commit hash
 */
export function generateCommitHash(commit: Omit<Commit, "hash">): string {
  const content = JSON.stringify({
    timestamp: commit.timestamp,
    author: commit.author,
    message: commit.message,
    diamondAddress: commit.diamondAddress,
    cut: commit.cut,
    parentHash: commit.parentHash,
    branch: commit.branch,
  });

  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Factory function to create storage instance.
 * In the future, can return MongoDB implementation based on config.
 */
export function createHistoryStorage(rootPath: string, type: "file" | "mongo" = "file"): IHistoryStorage {
  if (type === "mongo") {
    // TODO: Implement MongoDB storage
    throw new Error("MongoDB storage not yet implemented. Use 'file' type.");
  }

  return new FileHistoryStorage(rootPath);
}
