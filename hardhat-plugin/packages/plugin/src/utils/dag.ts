import crypto from "crypto";
import type { Commit, FacetCut } from "../types.js";

/**
 * Directed Acyclic Graph (DAG) for managing commit history
 * 
 * This implementation provides:
 * - O(1) commit lookup by hash
 * - Efficient traversal for history operations
 * - Branch management with merge support
 * - Topological ordering for commit sequences
 * - Conflict detection for merges
 */
export class CommitDAG {
  // Core data structures
  private commits: Map<string, DAGNode>; // hash -> node
  private branches: Map<string, string>; // branch name -> HEAD hash
  private currentBranch: string;

  constructor() {
    this.commits = new Map();
    this.branches = new Map();
    this.currentBranch = "main";
  }

  /**
   * Initialize the DAG with a root commit
   */
  initialize(branchName: string = "main"): string {
    const rootCommit: Commit = {
      hash: this.generateHash("root", Date.now().toString()),
      timestamp: Date.now(),
      author: "system",
      message: "Initialize Diamond project",
      diamondAddress: "",
      cut: [],
      branch: branchName,
    };

    const rootNode: DAGNode = {
      commit: rootCommit,
      parents: [],
      children: [],
    };

    this.commits.set(rootCommit.hash, rootNode);
    this.branches.set(branchName, rootCommit.hash);
    this.currentBranch = branchName;

    return rootCommit.hash;
  }

  /**
   * Add a new commit to the DAG
   */
  addCommit(
    message: string,
    author: string,
    diamondAddress: string,
    cut: FacetCut[],
    parentHash?: string,
  ): string {
    const parent = parentHash || this.getHead(this.currentBranch);
    if (!parent) {
      throw new Error("No parent commit found. Initialize the DAG first.");
    }

    const parentNode = this.commits.get(parent);
    if (!parentNode) {
      throw new Error(`Parent commit ${parent} not found in DAG`);
    }

    const timestamp = Date.now();
    const hash = this.generateCommitHash(
      message,
      author,
      timestamp,
      diamondAddress,
      cut,
      parent,
    );

    const commit: Commit = {
      hash,
      timestamp,
      author,
      message,
      diamondAddress,
      cut,
      parentHash: parent,
      branch: this.currentBranch,
    };

    const node: DAGNode = {
      commit,
      parents: [parent],
      children: [],
    };

    // Add to commits map
    this.commits.set(hash, node);

    // Update parent's children
    parentNode.children.push(hash);

    // Update branch HEAD
    this.branches.set(this.currentBranch, hash);

    return hash;
  }

  /**
   * Create a merge commit with multiple parents
   */
  mergeCommit(
    message: string,
    author: string,
    diamondAddress: string,
    cut: FacetCut[],
    sourceBranch: string,
    targetBranch?: string,
  ): string {
    const target = targetBranch || this.currentBranch;
    const targetHead = this.getHead(target);
    const sourceHead = this.getHead(sourceBranch);

    if (!targetHead || !sourceHead) {
      throw new Error("Source or target branch not found");
    }

    // Check if already merged (source is ancestor of target)
    if (this.isAncestor(sourceHead, targetHead)) {
      throw new Error(`${sourceBranch} is already merged into ${target}`);
    }

    const timestamp = Date.now();
    const hash = this.generateCommitHash(
      message,
      author,
      timestamp,
      diamondAddress,
      cut,
      targetHead,
      sourceHead,
    );

    const commit: Commit = {
      hash,
      timestamp,
      author,
      message,
      diamondAddress,
      cut,
      parentHashes: [targetHead, sourceHead],
      branch: target,
    };

    const node: DAGNode = {
      commit,
      parents: [targetHead, sourceHead],
      children: [],
    };

    // Add to commits map
    this.commits.set(hash, node);

    // Update both parents' children
    this.commits.get(targetHead)?.children.push(hash);
    this.commits.get(sourceHead)?.children.push(hash);

    // Update target branch HEAD
    this.branches.set(target, hash);

    return hash;
  }

  /**
   * Create a new branch from current HEAD or specified commit
   */
  createBranch(branchName: string, startCommit?: string): void {
    if (this.branches.has(branchName)) {
      throw new Error(`Branch ${branchName} already exists`);
    }

    const start = startCommit || this.getHead(this.currentBranch);
    if (!start) {
      throw new Error("No commit to branch from");
    }

    if (!this.commits.has(start)) {
      throw new Error(`Commit ${start} not found`);
    }

    this.branches.set(branchName, start);
  }

  /**
   * Switch to a different branch
   */
  switchBranch(branchName: string): void {
    if (!this.branches.has(branchName)) {
      throw new Error(`Branch ${branchName} does not exist`);
    }
    this.currentBranch = branchName;
  }

  /**
   * Delete a branch
   */
  deleteBranch(branchName: string): void {
    if (branchName === this.currentBranch) {
      throw new Error("Cannot delete current branch");
    }
    if (!this.branches.has(branchName)) {
      throw new Error(`Branch ${branchName} does not exist`);
    }
    this.branches.delete(branchName);
  }

  /**
   * Get the HEAD commit hash of a branch
   */
  getHead(branchName: string): string | undefined {
    return this.branches.get(branchName);
  }

  /**
   * Get a commit by hash
   */
  getCommit(hash: string): Commit | undefined {
    return this.commits.get(hash)?.commit;
  }

  /**
   * Get commit history in topological order (newest first)
   */
  getHistory(
    branchName?: string,
    limit?: number,
  ): Commit[] {
    const branch = branchName || this.currentBranch;
    const head = this.getHead(branch);
    
    if (!head) {
      return [];
    }

    const history: Commit[] = [];
    const visited = new Set<string>();
    const queue: string[] = [head];

    while (queue.length > 0 && (!limit || history.length < limit)) {
      const hash = queue.shift()!;
      
      if (visited.has(hash)) {
        continue;
      }
      
      visited.add(hash);
      const node = this.commits.get(hash);
      
      if (!node) {
        continue;
      }

      history.push(node.commit);

      // Add parents to queue (breadth-first for chronological order)
      queue.push(...node.parents);
    }

    return history;
  }

  /**
   * Get all commits between two commits (for diff/merge analysis)
   */
  getCommitRange(from: string, to: string): Commit[] {
    const fromNode = this.commits.get(from);
    const toNode = this.commits.get(to);

    if (!fromNode || !toNode) {
      throw new Error("Invalid commit range");
    }

    // BFS from 'to' until we reach 'from'
    const range: Commit[] = [];
    const visited = new Set<string>();
    const queue: string[] = [to];

    while (queue.length > 0) {
      const hash = queue.shift()!;
      
      if (hash === from) {
        break;
      }

      if (visited.has(hash)) {
        continue;
      }

      visited.add(hash);
      const node = this.commits.get(hash);

      if (!node) {
        continue;
      }

      range.push(node.commit);
      queue.push(...node.parents);
    }

    return range;
  }

  /**
   * Check if commit A is an ancestor of commit B
   */
  isAncestor(ancestor: string, descendant: string): boolean {
    if (ancestor === descendant) {
      return true;
    }

    const visited = new Set<string>();
    const queue: string[] = [descendant];

    while (queue.length > 0) {
      const hash = queue.shift()!;

      if (hash === ancestor) {
        return true;
      }

      if (visited.has(hash)) {
        continue;
      }

      visited.add(hash);
      const node = this.commits.get(hash);

      if (!node) {
        continue;
      }

      queue.push(...node.parents);
    }

    return false;
  }

  /**
   * Find the common ancestor of two commits (for merge base)
   */
  findCommonAncestor(hash1: string, hash2: string): string | null {
    const ancestors1 = this.getAncestors(hash1);
    const ancestors2 = this.getAncestors(hash2);

    // Find first common ancestor in chronological order
    for (const ancestor of ancestors1) {
      if (ancestors2.has(ancestor)) {
        return ancestor;
      }
    }

    return null;
  }

  /**
   * Get all ancestors of a commit
   */
  private getAncestors(hash: string): Set<string> {
    const ancestors = new Set<string>();
    const queue: string[] = [hash];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (ancestors.has(current)) {
        continue;
      }

      ancestors.add(current);
      const node = this.commits.get(current);

      if (node) {
        queue.push(...node.parents);
      }
    }

    return ancestors;
  }

  /**
   * Detect conflicts between two branches
   * Returns array of conflicting function selectors
   */
  detectConflicts(sourceBranch: string, targetBranch: string): ConflictInfo[] {
    const sourceHead = this.getHead(sourceBranch);
    const targetHead = this.getHead(targetBranch);

    if (!sourceHead || !targetHead) {
      throw new Error("Invalid branches for conflict detection");
    }

    const commonAncestor = this.findCommonAncestor(sourceHead, targetHead);
    if (!commonAncestor) {
      throw new Error("No common ancestor found");
    }

    // Get changes from common ancestor to each branch (EXCLUDING the ancestor itself)
    const sourceChanges = this.getCommitRange(commonAncestor, sourceHead);
    const targetChanges = this.getCommitRange(commonAncestor, targetHead);

    // Analyze facet cuts for conflicts
    const conflicts: ConflictInfo[] = [];
    const sourceSelectors = this.extractSelectors(sourceChanges);
    const targetSelectors = this.extractSelectors(targetChanges);

    // Check for selector conflicts - when both branches modify the same selector differently
    for (const [selector, sourceInfo] of sourceSelectors) {
      const targetInfo = targetSelectors.get(selector);
      if (targetInfo) {
        // Conflict if different actions OR different facet addresses (even with same action)
        if (
          targetInfo.action !== sourceInfo.action ||
          targetInfo.facetAddress !== sourceInfo.facetAddress
        ) {
          conflicts.push({
            selector,
            sourceAction: sourceInfo.action,
            targetAction: targetInfo.action,
            sourceFacet: sourceInfo.facetAddress,
            targetFacet: targetInfo.facetAddress,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Extract function selectors from commit range
   */
  private extractSelectors(
    commits: Commit[],
  ): Map<string, { action: number; facetAddress: string }> {
    const selectors = new Map<string, { action: number; facetAddress: string }>();

    for (const commit of commits) {
      for (const cut of commit.cut) {
        for (const selector of cut.functionSelectors) {
          selectors.set(selector, {
            action: cut.action,
            facetAddress: cut.facetAddress,
          });
        }
      }
    }

    return selectors;
  }

  /**
   * Get all branches
   */
  getBranches(): string[] {
    return Array.from(this.branches.keys());
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return this.currentBranch;
  }

  /**
   * Get total commit count
   */
  getCommitCount(): number {
    return this.commits.size;
  }

  /**
   * Generate a commit hash from content
   */
  private generateCommitHash(
    message: string,
    author: string,
    timestamp: number,
    diamondAddress: string,
    cut: FacetCut[],
    ...parents: string[]
  ): string {
    const content = JSON.stringify({
      message,
      author,
      timestamp,
      diamondAddress,
      cut,
      parents,
    });
    return this.generateHash(content, timestamp.toString()).substring(0, 8);
  }

  /**
   * Generate SHA-256 hash
   */
  private generateHash(...inputs: string[]): string {
    const hash = crypto.createHash("sha256");
    for (const input of inputs) {
      hash.update(input);
    }
    return hash.digest("hex");
  }

  /**
   * Export DAG state for serialization
   */
  toJSON(): DAGState {
    return {
      commits: Array.from(this.commits.entries()).map(([hash, node]) => ({
        hash,
        commit: node.commit,
        parents: node.parents,
        children: node.children,
      })),
      branches: Array.from(this.branches.entries()).map(([name, head]) => ({
        name,
        head,
      })),
      currentBranch: this.currentBranch,
    };
  }

  /**
   * Import DAG state from serialized data
   */
  static fromJSON(state: DAGState): CommitDAG {
    const dag = new CommitDAG();
    
    // Restore commits
    for (const entry of state.commits) {
      const node: DAGNode = {
        commit: entry.commit,
        parents: entry.parents,
        children: entry.children,
      };
      dag.commits.set(entry.hash, node);
    }

    // Restore branches
    for (const branch of state.branches) {
      dag.branches.set(branch.name, branch.head);
    }

    dag.currentBranch = state.currentBranch;

    return dag;
  }
}

/**
 * DAG Node representing a commit with graph connections
 */
interface DAGNode {
  commit: Commit;
  parents: string[]; // Parent commit hashes
  children: string[]; // Child commit hashes
}

/**
 * Conflict information for merge operations
 */
export interface ConflictInfo {
  selector: string;
  sourceAction: number;
  targetAction: number;
  sourceFacet: string;
  targetFacet: string;
}

/**
 * Serializable DAG state
 */
export interface DAGState {
  commits: Array<{
    hash: string;
    commit: Commit;
    parents: string[];
    children: string[];
  }>;
  branches: Array<{
    name: string;
    head: string;
  }>;
  currentBranch: string;
}
