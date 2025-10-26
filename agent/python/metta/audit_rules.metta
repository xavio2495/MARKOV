;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;; Markov Audit System - Audit Rules
;;; Version: 2.0.0
;;; Updated: 2025-10-26 06:01:44 UTC
;;; Developer: charlesms-eth
;;; License: MIT (FREE OPEN SOURCE)
;;;
;;; Detection rules for specific vulnerability patterns
;;; Total: ~250 lines
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;; ============================================================
;;; REENTRANCY DETECTION RULES
;;; ============================================================

;;; Rule: Detect reentrancy in function
(= (detect-reentrancy-in-function $function)
   (and (has-external-call-pattern $function)
        (has-state-change-after-call $function)
        (not (has-protection $function))))

;;; External call patterns
(= (has-external-call-pattern $function)
   (or (has-call-with-value $function)
       (has-transfer-call $function)
       (has-send-call $function)
       (has-delegatecall $function)))

;;; State change detection
(= (has-state-change-after-call $function)
   (exists-state-update-after-line $function (external-call-line $function)))

;;; Protection mechanisms
(= (has-protection $function)
   (or (has-nonreentrant-modifier $function)
       (has-mutex $function)
       (follows-cei-strictly $function)))

;;; CEI pattern verification
(= (follows-cei-strictly $function)
   (let* (($checks (get-checks $function))
          ($effects (get-effects $function))
          ($interactions (get-interactions $function)))
      (and (all-before $checks $effects)
           (all-before $effects $interactions))))

;;; ============================================================
;;; ACCESS CONTROL RULES
;;; ============================================================

;;; Rule: Detect missing access control
(= (detect-missing-access-control $function)
   (and (is-sensitive-function $function)
        (not (has-access-control-modifier $function))))

;;; Sensitive function patterns
(= (is-sensitive-function $function)
   (or (matches-pattern $function "withdraw.*")
       (matches-pattern $function "transfer.*Ownership")
       (matches-pattern $function "pause")
       (matches-pattern $function "unpause")
       (matches-pattern $function "mint")
       (matches-pattern $function "burn")
       (matches-pattern $function "setFee.*")
       (matches-pattern $function "setAdmin.*")
       (matches-pattern $function "upgrade.*")))

;;; Access control modifier patterns
(= (has-access-control-modifier $function)
   (or (has-modifier $function "onlyOwner")
       (has-modifier $function "onlyRole")
       (has-modifier $function "onlyAdmin")
       (has-modifier $function "authorized")))

;;; Rule: Detect tx.origin usage
(= (detect-tx-origin-vulnerability $contract)
   (and (uses-tx-origin $contract)
        (in-authorization-check $contract)))

;;; ============================================================
;;; INTEGER OVERFLOW RULES
;;; ============================================================

;;; Rule: Detect unsafe arithmetic
(= (detect-unsafe-arithmetic $contract)
   (and (not (safe-solidity-version $contract))
        (not (uses-safemath $contract))
        (has-arithmetic-with-user-input $contract)))

;;; Arithmetic with user input
(= (has-arithmetic-with-user-input $function)
   (exists-arithmetic-on
      (or (function-parameter $function)
          (msg-value $function)
          (user-controllable-state $function))))

;;; Rule: Detect unchecked block risks
(= (detect-unchecked-risk $block)
   (and (in-unchecked-block $block)
        (has-risky-operation $block)))

;;; Risky operations in unchecked
(= (has-risky-operation $block)
   (or (has-multiplication $block)
       (has-exponentiation $block)
       (uses-user-input $block)
       (modifies-balance $block)))

;;; Rule: Precision loss detection
(= (detect-precision-loss $operation)
   (matches-pattern $operation ".*/.*\\*"))

;;; ============================================================
;;; EXTERNAL CALL RULES
;;; ============================================================

;;; Rule: Unchecked external call
(= (detect-unchecked-call $call)
   (and (is-low-level-call $call)
        (not (checks-success $call))))

;;; Success checking patterns
(= (checks-success $call)
   (or (has-require-on-success $call)
       (has-if-check-on-success $call)
       (uses-success-variable $call)))

;;; Rule: Unsafe delegatecall
(= (detect-unsafe-delegatecall $call)
   (and (is-delegatecall $call)
        (not (is-trusted-address $call))))

;;; Trusted address verification
(= (is-trusted-address $address)
   (or (is-constant $address)
       (is-immutable $address)
       (in-whitelist $address)))

;;; Rule: Missing pull pattern
(= (should-use-pull-pattern $function)
   (and (transfers-to-multiple-users $function)
        (not (uses-withdrawal-pattern $function))))

;;; ============================================================
;;; GAS OPTIMIZATION RULES
;;; ============================================================

;;; Rule: Memory vs calldata
(= (should-use-calldata $parameter)
   (and (is-external-function-param $parameter)
        (is-reference-type $parameter)
        (not-modified-in-function $parameter)
        (uses-memory $parameter)))

;;; Reference types
(= (is-reference-type $type)
   (or (is-array-type $type)
       (is-string-type $type)
       (is-struct-type $type)))

;;; Rule: Storage packing optimization
(= (detect-suboptimal-packing $variables)
   (and (are-state-variables $variables)
        (can-pack-better $variables)))

;;; Packing analysis
(= (can-pack-better $variables)
   (let* (($current-slots (calculate-slots $variables))
          ($optimal-slots (calculate-optimal-slots $variables)))
      (> $current-slots $optimal-slots)))

;;; Rule: Array length caching
(= (should-cache-length $loop)
   (and (accesses-array-length $loop)
        (in-loop-condition $loop)
        (not-cached $loop)))

;;; Rule: Pre-increment optimization
(= (should-use-pre-increment $loop)
   (and (has-post-increment $loop)
        (not-uses-old-value $loop)))

;;; Rule: Redundant storage read
(= (detect-redundant-sload $function)
   (let (($reads (get-storage-reads $function)))
      (has-duplicates $reads)))

;;; Rule: Constant opportunity
(= (should-be-constant $variable)
   (and (is-state-variable $variable)
        (assigned-literal-value $variable)
        (never-reassigned $variable)
        (not (is-constant $variable))
        (not (is-immutable $variable))))

;;; Rule: Immutable opportunity
(= (should-be-immutable $variable)
   (and (is-state-variable $variable)
        (assigned-in-constructor-only $variable)
        (never-reassigned-after-construction $variable)
        (not (is-immutable $variable))))

;;; ============================================================
;;; FRONT-RUNNING RULES
;;; ============================================================

;;; Rule: Transaction ordering dependence
(= (detect-front-running-risk $function)
   (and (is-public-function $function)
        (price-dependent $function)
        (not (has-commit-reveal $function))
        (not (has-deadline $function))))

;;; Price-dependent operations
(= (price-dependent $function)
   (or (is-swap-function $function)
       (is-purchase-function $function)
       (uses-oracle-price $function)))

;;; ============================================================
;;; DENIAL OF SERVICE RULES
;;; ============================================================

;;; Rule: Unbounded loop DOS
(= (detect-unbounded-loop-dos $loop)
   (and (iterates-over-user-data $loop)
        (no-iteration-limit $loop)
        (has-expensive-operation $loop)))

;;; Rule: Block gas limit DOS
(= (detect-block-gas-dos $function)
   (and (processes-array $function)
        (array-size-unbounded $function)
        (gas-per-item-high $function)))

;;; ============================================================
;;; TIMESTAMP DEPENDENCE RULES
;;; ============================================================

;;; Rule: Dangerous timestamp usage
(= (detect-timestamp-manipulation $function)
   (and (uses-block-timestamp $function)
        (in-critical-logic $function)
        (small-time-threshold $function)))

;;; Critical logic detection
(= (in-critical-logic $function)
   (or (determines-winner $function)
       (unlocks-funds $function)
       (affects-randomness $function)))

;;; ============================================================
;;; CROSS-CONTRACT RULES
;;; ============================================================

;;; Rule: Interface compliance
(= (verify-interface-compliance $contract $interface)
   (all-functions-implemented $contract $interface))

;;; Rule: Upgrade safety
(= (verify-upgrade-safety $oldContract $newContract)
   (and (storage-layout-compatible $oldContract $newContract)
        (no-selfdestruct-in-new $newContract)
        (maintains-critical-functions $oldContract $newContract)))

;;; ============================================================
;;; LOGIC VERIFICATION RULES
;;; ============================================================

;;; Rule: Business logic verification
(= (verify-balance-consistency $contract)
   (sum-of-balances-equals-total $contract))

;;; Rule: Access hierarchy
(= (verify-access-hierarchy $contract)
   (and (owner-can-all $contract)
        (admin-can-subset $contract)
        (user-can-own-only $contract)))

;;; ============================================================
;;; INTEGRATION RULES
;;; ============================================================

;;; Rule: External dependency safety
(= (verify-external-dependency $contract $dependency)
   (and (is-verified-contract $dependency)
        (is-audited $dependency)
        (version-pinned $dependency)))

;;; Rule: Oracle integration
(= (verify-oracle-integration $contract)
   (and (uses-chainlink-pattern $contract)
        (checks-stale-price $contract)
        (has-fallback-oracle $contract)))

;;; ============================================================
;;; AGGREGATE ANALYSIS RULES
;;; ============================================================

;;; Rule: Overall contract safety
(= (assess-overall-safety $contract)
   (let* (($vulns (find-all-vulnerabilities $contract))
          ($critical (filter is-critical $vulns))
          ($high (filter is-high $vulns)))
      (if (> (length $critical) 0)
          unsafe
          (if (> (length $high) 0)
              risky
              (if (> (length $vulns) 0)
                  needs-review
                  safe)))))

;;; Rule: Deployment readiness
(= (ready-for-deployment $contract)
   (and (no-critical-vulnerabilities $contract)
        (no-high-vulnerabilities $contract)
        (has-passing-tests $contract)
        (code-coverage-above-80 $contract)
        (documented-functions $contract)))

;;; ============================================================
;;; END OF AUDIT RULES
;;; ============================================================

;;; Total lines: ~250
;;; Rules cover:
;;; - Reentrancy detection
;;; - Access control verification
;;; - Integer overflow checks
;;; - External call safety
;;; - Gas optimizations
;;; - Front-running risks
;;; - DoS vulnerabilities
;;; - Timestamp dependence
;;; - Cross-contract interactions
;;; - Logic verification
;;; - Integration safety
;;; - Aggregate analysis