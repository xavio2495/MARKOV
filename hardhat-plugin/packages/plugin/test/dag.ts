import { describe, it } from "node:test";
import assert from "node:assert";
import { CommitDAG, ConflictInfo } from "../src/utils/dag.js";
import type { FacetCut } from "../src/types.js";

describe("CommitDAG", () => {
  describe("Initialization", () => {
    it("should initialize with a root commit", () => {
      const dag = new CommitDAG();
      const rootHash = dag.initialize("main");

      assert.ok(rootHash, "Root hash should be generated");
      assert.strictEqual(dag.getCurrentBranch(), "main");
      assert.strictEqual(dag.getCommitCount(), 1);

      const rootCommit = dag.getCommit(rootHash);
      assert.ok(rootCommit, "Root commit should exist");
      assert.strictEqual(rootCommit.message, "Initialize Diamond project");
      assert.strictEqual(rootCommit.author, "system");
    });

    it("should initialize with custom branch name", () => {
      const dag = new CommitDAG();
      dag.initialize("develop");

      assert.strictEqual(dag.getCurrentBranch(), "develop");
      assert.deepStrictEqual(dag.getBranches(), ["develop"]);
    });
  });

  describe("Adding Commits", () => {
    it("should add a commit to the current branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");

      const cut: FacetCut[] = [
        {
          facetAddress: "0x123",
          action: 0,
          functionSelectors: ["0xabcd1234"],
        },
      ];

      const hash = dag.addCommit(
        "Add facet",
        "developer",
        "0xDiamond",
        cut,
      );

      assert.ok(hash, "Commit hash should be generated");
      assert.strictEqual(dag.getCommitCount(), 2);

      const commit = dag.getCommit(hash);
      assert.ok(commit, "Commit should exist");
      assert.strictEqual(commit.message, "Add facet");
      assert.strictEqual(commit.author, "developer");
      assert.deepStrictEqual(commit.cut, cut);
    });

    it("should link commits in parent-child relationship", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");

      const hash1 = dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      const hash2 = dag.addCommit("Commit 2", "dev", "0xDiamond", []);

      const commit2 = dag.getCommit(hash2);
      assert.strictEqual(commit2?.parentHash, hash1);

      // Verify history order
      const history = dag.getHistory("main");
      assert.strictEqual(history.length, 3);
      assert.strictEqual(history[0].hash, hash2);
      assert.strictEqual(history[1].hash, hash1);
      assert.strictEqual(history[2].hash, root);
    });

    it("should update branch HEAD after commit", () => {
      const dag = new CommitDAG();
      dag.initialize("main");

      const hash = dag.addCommit("New commit", "dev", "0xDiamond", []);
      assert.strictEqual(dag.getHead("main"), hash);
    });

    it("should throw error when adding commit without initialization", () => {
      const dag = new CommitDAG();

      assert.throws(() => {
        dag.addCommit("Commit", "dev", "0xDiamond", []);
      }, /No parent commit found/);
    });
  });

  describe("Branch Management", () => {
    it("should create a new branch from current HEAD", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      const hash = dag.addCommit("Commit 1", "dev", "0xDiamond", []);

      dag.createBranch("feature");

      assert.ok(dag.getBranches().includes("feature"));
      assert.strictEqual(dag.getHead("feature"), hash);
    });

    it("should create a branch from specific commit", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      dag.addCommit("Commit 1", "dev", "0xDiamond", []);

      dag.createBranch("feature", root);

      assert.strictEqual(dag.getHead("feature"), root);
    });

    it("should throw error when creating duplicate branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      dag.createBranch("feature");

      assert.throws(() => {
        dag.createBranch("feature");
      }, /already exists/);
    });

    it("should switch between branches", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      dag.createBranch("feature");

      dag.switchBranch("feature");
      assert.strictEqual(dag.getCurrentBranch(), "feature");

      dag.switchBranch("main");
      assert.strictEqual(dag.getCurrentBranch(), "main");
    });

    it("should throw error when switching to non-existent branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");

      assert.throws(() => {
        dag.switchBranch("nonexistent");
      }, /does not exist/);
    });

    it("should delete a branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      dag.createBranch("feature");

      dag.deleteBranch("feature");
      assert.ok(!dag.getBranches().includes("feature"));
    });

    it("should not allow deleting current branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");

      assert.throws(() => {
        dag.deleteBranch("main");
      }, /Cannot delete current branch/);
    });
  });

  describe("Merge Operations", () => {
    it("should create a merge commit with two parents", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      
      const mainCommit = dag.addCommit("Main commit", "dev", "0xDiamond", []);
      
      dag.createBranch("feature");
      dag.switchBranch("feature");
      const featureCommit = dag.addCommit("Feature commit", "dev", "0xDiamond", []);
      
      dag.switchBranch("main");
      const mergeHash = dag.mergeCommit(
        "Merge feature",
        "dev",
        "0xDiamond",
        [],
        "feature",
      );

      const mergeCommit = dag.getCommit(mergeHash);
      assert.ok(mergeCommit, "Merge commit should exist");
      assert.ok(mergeCommit.parentHashes, "Should have parentHashes");
      assert.strictEqual(mergeCommit.parentHashes?.length, 2);
      assert.ok(mergeCommit.parentHashes?.includes(mainCommit));
      assert.ok(mergeCommit.parentHashes?.includes(featureCommit));
    });

    it("should throw error when merging already merged branch", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      
      dag.createBranch("feature");
      dag.switchBranch("feature");
      dag.addCommit("Feature commit", "dev", "0xDiamond", []);
      
      dag.switchBranch("main");
      dag.mergeCommit("Merge feature", "dev", "0xDiamond", [], "feature");

      // Try to merge again
      assert.throws(() => {
        dag.mergeCommit("Merge again", "dev", "0xDiamond", [], "feature");
      }, /already merged/);
    });
  });

  describe("History and Traversal", () => {
    it("should return history in chronological order", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      const hash1 = dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      const hash2 = dag.addCommit("Commit 2", "dev", "0xDiamond", []);
      const hash3 = dag.addCommit("Commit 3", "dev", "0xDiamond", []);

      const history = dag.getHistory("main");
      
      assert.strictEqual(history.length, 4);
      assert.strictEqual(history[0].hash, hash3);
      assert.strictEqual(history[1].hash, hash2);
      assert.strictEqual(history[2].hash, hash1);
      assert.strictEqual(history[3].hash, root);
    });

    it("should limit history results", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      dag.addCommit("Commit 2", "dev", "0xDiamond", []);
      dag.addCommit("Commit 3", "dev", "0xDiamond", []);

      const history = dag.getHistory("main", 2);
      
      assert.strictEqual(history.length, 2);
    });

    it("should check if commit is ancestor", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      const hash1 = dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      const hash2 = dag.addCommit("Commit 2", "dev", "0xDiamond", []);

      assert.ok(dag.isAncestor(root, hash2));
      assert.ok(dag.isAncestor(hash1, hash2));
      assert.ok(!dag.isAncestor(hash2, hash1));
    });

    it("should find common ancestor", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      const base = dag.addCommit("Base", "dev", "0xDiamond", []);
      
      dag.createBranch("branch1");
      const hash1 = dag.addCommit("Branch 1 commit", "dev", "0xDiamond", []);
      
      dag.switchBranch("main");
      dag.createBranch("branch2", base);
      dag.switchBranch("branch2");
      const hash2 = dag.addCommit("Branch 2 commit", "dev", "0xDiamond", []);

      const ancestor = dag.findCommonAncestor(hash1, hash2);
      assert.strictEqual(ancestor, base);
    });

    it("should get commit range", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      const hash1 = dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      const hash2 = dag.addCommit("Commit 2", "dev", "0xDiamond", []);
      const hash3 = dag.addCommit("Commit 3", "dev", "0xDiamond", []);

      const range = dag.getCommitRange(hash1, hash3);
      
      assert.strictEqual(range.length, 2);
      assert.strictEqual(range[0].hash, hash3);
      assert.strictEqual(range[1].hash, hash2);
    });
  });

  describe("Conflict Detection", () => {
    it("should detect selector conflicts between branches", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      
      // Base commit adds a selector
      const baseCut: FacetCut[] = [{
        facetAddress: "0xBase",
        action: 0,
        functionSelectors: ["0x22222222"],
      }];
      const base = dag.addCommit("Base", "dev", "0xDiamond", baseCut);
      
      // Branch 1: Replace the selector
      dag.createBranch("branch1");
      dag.switchBranch("branch1"); // SWITCH TO branch1 before adding commit
      const cut1: FacetCut[] = [{
        facetAddress: "0xFacet1",
        action: 1, // Replace
        functionSelectors: ["0x22222222"],
      }];
      const branch1Commit = dag.addCommit("Branch 1 change", "dev", "0xDiamond", cut1);
      
      // Branch 2: Remove the same selector
      dag.switchBranch("main");
      dag.createBranch("branch2", base);
      dag.switchBranch("branch2"); // SWITCH TO branch2 before adding commit
      const cut2: FacetCut[] = [{
        facetAddress: "0xFacet2",
        action: 2, // Remove
        functionSelectors: ["0x22222222"],
      }];
      const branch2Commit = dag.addCommit("Branch 2 change", "dev", "0xDiamond", cut2);
      
      const conflicts = dag.detectConflicts("branch1", "branch2");
      
      assert.strictEqual(conflicts.length, 1);
      assert.strictEqual(conflicts[0].selector, "0x22222222");
      assert.strictEqual(conflicts[0].sourceAction, 1);
      assert.strictEqual(conflicts[0].targetAction, 2);
    });

    it("should not detect conflicts for non-overlapping changes", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      const base = dag.addCommit("Base", "dev", "0xDiamond", []);
      
      dag.createBranch("branch1");
      const cut1: FacetCut[] = [{
        facetAddress: "0xFacet1",
        action: 0,
        functionSelectors: ["0x11111111"],
      }];
      dag.addCommit("Branch 1", "dev", "0xDiamond", cut1);
      
      dag.switchBranch("main");
      dag.createBranch("branch2", base);
      dag.switchBranch("branch2");
      const cut2: FacetCut[] = [{
        facetAddress: "0xFacet2",
        action: 0,
        functionSelectors: ["0x22222222"],
      }];
      dag.addCommit("Branch 2", "dev", "0xDiamond", cut2);
      
      const conflicts = dag.detectConflicts("branch1", "branch2");
      assert.strictEqual(conflicts.length, 0);
    });
  });

  describe("Serialization", () => {
    it("should export and import DAG state", () => {
      const dag = new CommitDAG();
      dag.initialize("main");
      dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      dag.createBranch("feature");
      
      const state = dag.toJSON();
      const restoredDag = CommitDAG.fromJSON(state);
      
      assert.strictEqual(restoredDag.getCommitCount(), dag.getCommitCount());
      assert.strictEqual(restoredDag.getCurrentBranch(), dag.getCurrentBranch());
      assert.deepStrictEqual(restoredDag.getBranches().sort(), dag.getBranches().sort());
      
      const originalHistory = dag.getHistory("main");
      const restoredHistory = restoredDag.getHistory("main");
      assert.strictEqual(restoredHistory.length, originalHistory.length);
    });

    it("should preserve commit relationships after serialization", () => {
      const dag = new CommitDAG();
      const root = dag.initialize("main");
      const hash1 = dag.addCommit("Commit 1", "dev", "0xDiamond", []);
      
      const state = dag.toJSON();
      const restoredDag = CommitDAG.fromJSON(state);
      
      const commit = restoredDag.getCommit(hash1);
      assert.strictEqual(commit?.parentHash, root);
    });
  });
});
