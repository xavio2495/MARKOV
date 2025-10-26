;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;; Markov Audit System - MeTTa Knowledge Base
;;; Version: 2.0.0
;;; Updated: 2025-10-26 06:01:44 UTC
;;; Developer: charlesms-eth
;;; License: MIT (FREE OPEN SOURCE)
;;;
;;; This knowledge base contains vulnerability taxonomy, security
;;; patterns, and reasoning rules for smart contract auditing.
;;; Total: ~300 lines
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;; ============================================================
;;; VULNERABILITY TAXONOMY
;;; ============================================================

;;; Vulnerability severity levels
(: severity-critical (-> vulnerability Bool))
(: severity-high (-> vulnerability Bool))
(: severity-medium (-> vulnerability Bool))
(: severity-low (-> vulnerability Bool))

;;; Vulnerability categories
(: reentrancy vulnerability)
(: access-control vulnerability)
(: integer-overflow vulnerability)
(: external-call vulnerability)
(: gas-optimization vulnerability)
(: front-running vulnerability)
(: timestamp-dependence vulnerability)
(: denial-of-service vulnerability)

;;; ============================================================
;;; REENTRANCY PATTERNS
;;; ============================================================

;;; Reentrancy vulnerability detection
(= (has-reentrancy-vulnerability $contract)
   (and (has-external-call $contract)
        (not (has-reentrancy-guard $contract))
        (state-change-after-call $contract)))

;;; CEI Pattern (Checks-Effects-Interactions)
(= (follows-cei-pattern $contract)
   (and (checks-first $contract)
        (effects-before-interactions $contract)))

;;; Reentrancy guard patterns
(= (has-reentrancy-guard $contract)
   (or (has-nonreentrant-modifier $contract)
       (has-mutex-lock $contract)))

;;; Compound reentrancy detection
(= (has-cross-function-reentrancy $contract)
   (and (has-multiple-external-calls $contract)
        (shared-state-between-functions $contract)))

;;; Reentrancy severity calculation
(= (reentrancy-severity $contract)
   (if (can-drain-all-funds $contract)
       critical
       (if (can-drain-user-funds $contract)
           high
           medium)))

;;; ============================================================
;;; ACCESS CONTROL PATTERNS
;;; ============================================================

;;; Access control mechanisms
(= (has-access-control $contract)
   (or (has-ownable $contract)
       (has-role-based-access $contract)
       (has-custom-modifiers $contract)))

;;; Unprotected functions
(= (unprotected-privileged-function $function)
   (and (is-privileged-function $function)
        (not (has-access-modifier $function))))

;;; Privileged function types
(= (is-privileged-function $function)
   (or (is-withdrawal-function $function)
       (is-ownership-transfer $function)
       (is-pause-function $function)
       (is-mint-burn-function $function)))

;;; tx.origin vulnerability
(= (uses-tx-origin-auth $contract)
   (and (uses-tx-origin $contract)
        (in-authorization-context $contract)))

;;; Missing access control severity
(= (access-control-severity $function)
   (if (is-withdrawal-function $function)
       critical
       (if (is-ownership-transfer $function)
           critical
           (if (is-mint-burn-function $function)
               high
               medium))))

;;; ============================================================
;;; INTEGER OVERFLOW/UNDERFLOW
;;; ============================================================

;;; Overflow vulnerability detection
(= (has-overflow-vulnerability $contract)
   (and (not (safe-solidity-version $contract))
        (not (uses-safemath $contract))
        (has-arithmetic-operations $contract)))

;;; Safe Solidity versions (0.8.0+)
(= (safe-solidity-version $version)
   (>= (version-major $version) 0.8))

;;; SafeMath patterns
(= (uses-safemath $contract)
   (or (imports-safemath $contract)
       (uses-safemath-library $contract)))

;;; Unchecked block analysis
(= (safe-unchecked-block $block)
   (and (in-solidity-08 $block)
        (only-simple-increments $block)
        (no-user-input $block)))

;;; Arithmetic operation types
(= (risky-arithmetic-op $op)
   (or (is-multiplication $op)
       (is-exponentiation $op)
       (is-complex-calculation $op)))

;;; Precision loss detection
(= (has-precision-loss $operation)
   (division-before-multiplication $operation))

;;; ============================================================
;;; EXTERNAL CALL SAFETY
;;; ============================================================

;;; External call patterns
(= (unsafe-external-call $call)
   (and (is-external-call $call)
        (not (checks-return-value $call))))

;;; Delegatecall safety
(= (unsafe-delegatecall $call)
   (and (is-delegatecall $call)
        (user-controlled-address $call)))

;;; Low-level call patterns
(= (is-low-level-call $call)
   (or (is-call $call)
       (is-delegatecall $call)
       (is-staticcall $call)))

;;; Pull payment pattern
(= (uses-pull-pattern $contract)
   (has-withdrawal-mapping $contract))

;;; External call ordering
(= (safe-external-call-ordering $function)
   (state-changes-before-calls $function))

;;; Gas limit considerations
(= (has-gas-limit $call)
   (specifies-gas-limit $call))

;;; ============================================================
;;; GAS OPTIMIZATION PATTERNS
;;; ============================================================

;;; Storage optimization
(= (optimal-storage-packing $contract)
   (variables-ordered-by-size $contract))

;;; Memory vs Calldata
(= (should-use-calldata $param)
   (and (is-external-function $param)
        (is-read-only $param)
        (is-array-or-string $param)))

;;; Loop optimizations
(= (optimized-loop $loop)
   (and (caches-array-length $loop)
        (uses-pre-increment $loop)
        (minimal-storage-operations $loop)))

;;; Constant vs immutable
(= (should-be-constant $variable)
   (and (never-modified $variable)
        (known-at-compile-time $variable)))

(= (should-be-immutable $variable)
   (and (set-in-constructor $variable)
        (never-modified-after $variable)))

;;; Redundant storage reads
(= (has-redundant-storage-read $function)
   (multiple-reads-same-variable $function))

;;; ============================================================
;;; COMPOUND VULNERABILITIES
;;; ============================================================

;;; Detect compound vulnerabilities (multiple issues amplifying risk)
(= (compound-vulnerability $vulnerabilities)
   (detect-compound $vulnerabilities))

;;; Reentrancy + Access Control = Critical
(= (detect-compound $vulns)
   (if (and (member reentrancy $vulns)
            (member access-control $vulns))
       (compound critical "Reentrancy with weak access control allows unauthorized fund drainage")
       (check-other-compounds $vulns)))

;;; Integer Overflow + External Call = High
(= (check-other-compounds $vulns)
   (if (and (member integer-overflow $vulns)
            (member external-call $vulns))
       (compound high "Integer overflow in external call context can corrupt state")
       (no-compound $vulns)))

;;; No compound detected
(= (no-compound $vulns)
   (compound none "No compound vulnerabilities detected"))

;;; ============================================================
;;; RISK SCORING
;;; ============================================================

;;; Calculate overall risk score (0-10 scale)
(= (calculate-risk-score $vulnerabilities)
   (fold-left add-severity-weight 0 $vulnerabilities))

;;; Severity weights
(= (severity-weight critical) 10)
(= (severity-weight high) 7)
(= (severity-weight medium) 4)
(= (severity-weight low) 2)
(= (severity-weight info) 1)

;;; Add severity weight helper
(= (add-severity-weight $acc $vuln)
   (+ $acc (severity-weight (get-severity $vuln))))

;;; Normalize risk score to 0-10
(= (normalize-risk-score $score $count)
   (if (> $count 0)
       (min (/ $score $count) 10)
       0))

;;; ============================================================
;;; EXPLOIT PROBABILITY
;;; ============================================================

;;; Calculate probability of successful exploitation
(= (exploit-probability $vulnerability $context)
   (multiply-factors
      (base-probability $vulnerability)
      (complexity-factor $vulnerability)
      (exposure-factor $context)))

;;; Base probability by vulnerability type
(= (base-probability reentrancy) 0.9)
(= (base-probability access-control) 0.95)
(= (base-probability integer-overflow) 0.7)
(= (base-probability external-call) 0.6)
(= (base-probability gas-optimization) 0.3)

;;; Complexity factor (how hard to exploit)
(= (complexity-factor $vuln)
   (if (requires-complex-attack $vuln)
       0.5
       1.0))

;;; Exposure factor (how accessible)
(= (exposure-factor $context)
   (if (is-public-function $context)
       1.0
       0.7))

;;; ============================================================
;;; REMEDIATION PRIORITY
;;; ============================================================

;;; Calculate remediation priority
(= (remediation-priority $vulnerability)
   (combine-factors
      (severity-factor $vulnerability)
      (exploit-likelihood $vulnerability)
      (fix-complexity $vulnerability)))

;;; Priority levels
(: immediate priority)
(: urgent priority)
(: medium priority)
(: low priority)

;;; Priority assignment
(= (assign-priority $score)
   (if (>= $score 0.8)
       immediate
       (if (>= $score 0.6)
           urgent
           (if (>= $score 0.4)
               medium
               low))))

;;; ============================================================
;;; SECURITY BEST PRACTICES
;;; ============================================================

;;; Check if contract follows best practices
(= (follows-best-practices $contract)
   (and (has-access-control $contract)
        (follows-cei-pattern $contract)
        (uses-safe-arithmetic $contract)
        (checks-external-calls $contract)
        (optimized-gas-usage $contract)))

;;; OpenZeppelin patterns
(= (uses-openzeppelin-patterns $contract)
   (or (uses-oz-ownable $contract)
       (uses-oz-reentrancy-guard $contract)
       (uses-oz-pausable $contract)))

;;; Audit checklist
(= (passes-audit-checklist $contract)
   (and (no-critical-issues $contract)
        (no-high-issues $contract)
        (documented-code $contract)
        (has-tests $contract)))

;;; ============================================================
;;; CONTEXTUAL REASONING
;;; ============================================================

;;; Reason about contract context
(= (contract-context $contract)
   (if (is-defi-contract $contract)
       defi-context
       (if (is-nft-contract $contract)
           nft-context
           (if (is-token-contract $contract)
               token-context
               general-context))))

;;; DeFi-specific checks
(= (defi-specific-checks $contract)
   (and (checks-oracle-manipulation $contract)
        (checks-flash-loan-attacks $contract)
        (checks-liquidity-issues $contract)))

;;; NFT-specific checks
(= (nft-specific-checks $contract)
   (and (checks-metadata-storage $contract)
        (checks-royalty-implementation $contract)
        (checks-minting-logic $contract)))

;;; ============================================================
;;; ATTACK VECTORS
;;; ============================================================

;;; Identify attack vectors
(= (identify-attack-vectors $vulnerability)
   (match $vulnerability
      (reentrancy (list "Recursive call attack" "State manipulation"))
      (access-control (list "Unauthorized access" "Privilege escalation"))
      (integer-overflow (list "Balance manipulation" "Logic bypass"))
      (external-call (list "Call injection" "Return value manipulation"))
      (otherwise (list "Generic attack"))))

;;; Attack complexity
(= (attack-complexity $vector)
   (match $vector
      ("Recursive call attack" high)
      ("Unauthorized access" low)
      ("Balance manipulation" medium)
      (otherwise medium)))

;;; ============================================================
;;; RECOMMENDATIONS
;;; ============================================================

;;; Generate recommendations
(= (generate-recommendations $vulnerabilities)
   (map generate-fix-recommendation $vulnerabilities))

;;; Fix recommendations by vulnerability type
(= (generate-fix-recommendation reentrancy)
   "Add ReentrancyGuard modifier or follow checks-effects-interactions pattern")

(= (generate-fix-recommendation access-control)
   "Implement proper access control using Ownable or AccessControl")

(= (generate-fix-recommendation integer-overflow)
   "Upgrade to Solidity 0.8.0+ or use SafeMath library")

(= (generate-fix-recommendation external-call)
   "Check return values and use pull payment pattern")

(= (generate-fix-recommendation gas-optimization)
   "Cache array lengths, use calldata, and optimize storage")

;;; ============================================================
;;; CONFIDENCE LEVELS
;;; ============================================================

;;; Calculate confidence in vulnerability detection
(= (detection-confidence $vulnerability $evidence)
   (if (strong-evidence $evidence)
       0.95
       (if (moderate-evidence $evidence)
           0.80
           0.65)))

;;; Evidence strength
(= (strong-evidence $evidence)
   (>= (count-indicators $evidence) 3))

(= (moderate-evidence $evidence)
   (>= (count-indicators $evidence) 2))

;;; ============================================================
;;; END OF KNOWLEDGE BASE
;;; ============================================================

;;; Total lines: ~300
;;; Categories covered:
;;; - Vulnerability taxonomy
;;; - Reentrancy patterns
;;; - Access control
;;; - Integer overflow
;;; - External calls
;;; - Gas optimization
;;; - Compound vulnerabilities
;;; - Risk scoring
;;; - Exploit probability
;;; - Remediation priority
;;; - Best practices
;;; - Attack vectors
;;; - Recommendations