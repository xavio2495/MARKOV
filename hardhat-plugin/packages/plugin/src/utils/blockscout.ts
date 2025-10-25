import type { FacetCut } from "../types.js";

/**
 * Blockscout MCP/REST API client for blockchain data access
 * 
 * Provides integration with Blockscout's API for:
 * - Contract inspection and ABI retrieval
 * - Transaction and event log queries
 * - Diamond contract state analysis
 * - On-chain history reconstruction
 */
export class BlockscoutClient {
  private baseUrl: string;
  private chainId: number;

  constructor(chainId: number = 1, useRestApi: boolean = true) {
    this.chainId = chainId;
    this.baseUrl = useRestApi 
      ? "https://mcp.blockscout.com/v1"
      : "https://mcp.blockscout.com/mcp";
  }

  /**
   * Get comprehensive information about an address
   */
  async getAddressInfo(address: string): Promise<AddressInfo> {
    const response = await this.callApi("get_address_info", {
      chain_id: this.chainId,
      address,
    });

    // Handle different possible response structures
    let data = response;
    
    // Blockscout MCP API returns data nested in data.basic_info
    if (response.data && response.data.basic_info) {
      data = response.data.basic_info;
    } 
    // If response has a 'data' field without basic_info
    else if (response.data) {
      data = response.data;
    }
    // If response has a 'result' field (some APIs use this)
    else if (response.result) {
      data = response.result;
    }

    // Determine if it's a contract by checking multiple possible fields
    const isContract = 
      data.is_contract === true || 
      data.is_contract === "true" ||
      data.isContract === true ||
      Boolean(data.contract_code) ||
      Boolean(data.bytecode) ||
      false;

    const isVerified = 
      data.is_verified === true || 
      data.is_verified === "true" ||
      data.isVerified === true ||
      Boolean(data.source_code) ||
      false;

    // Try to get transaction counts from REST API if MCP doesn't provide them
    let txCount = data.tx_count || data.transactions_count || 0;
    let tokenTransfersCount = data.token_transfers_count || data.transfer_count || 0;
    
    if (txCount === 0 && tokenTransfersCount === 0) {
      try {
        const restApiCounts = await this.getAddressTransactionCounts(address);
        txCount = restApiCounts.txCount;
        tokenTransfersCount = restApiCounts.transferCount;
      } catch (e) {
        // Silently fail and use 0 defaults
      }
    }

    return {
      address: data.hash || data.address || address,
      isContract,
      balance: data.coin_balance || data.balance || "0",
      blockNumber: data.block_number_balance_updated_at || data.blockNumber || 0,
      creator: data.creator_address_hash || data.creator,
      creationTxHash: data.creation_transaction_hash || data.creation_tx_hash || data.creationTxHash,
      isVerified,
      name: data.name || data.contract_name,
      tx_count: txCount,
      token_transfers_count: tokenTransfersCount,
      transactions_count: txCount,
    };
  }

  /**
   * Get detailed information about a specific transaction by hash
   * Uses REST API: /api/v2/transactions/{hash}
   * Returns: timestamp, gas_used, gas_price, gas_limit, transaction_fee
   */
  async getTransactionByHash(txHash: string): Promise<any> {
    try {
      if (!txHash) {
        return null;
      }

      // Use direct_api_call to query Blockscout REST API v2 transactions endpoint
      // This endpoint provides comprehensive transaction details including:
      // - timestamp: block timestamp in Unix seconds
      // - gas_used: actual gas consumed
      // - gas_price: gas price in Wei
      // - gas_limit: transaction gas limit
      // - result: transaction status
      const response = await this.callApi("direct_api_call", {
        chain_id: this.chainId,
        endpoint_path: `/api/v2/transactions/${txHash}`,
      });

      const debug = process.env.DEBUG_BLOCKSCOUT === "true";
      
      // Extract the response data
      let data = response;
      if (response.data && typeof response.data === "object") {
        data = response.data;
      }

      if (debug) {
        console.log("[DEBUG] REST API /transactions response:", JSON.stringify(data, null, 2).substring(0, 1000));
      }

      return data;
    } catch (error) {
      const debug = process.env.DEBUG_BLOCKSCOUT === "true";
      if (debug) {
        console.log(`[DEBUG] Failed to get transaction ${txHash}:`, error instanceof Error ? error.message : error);
      }
      return null;
    }
  }

  /**
   * Get address transaction and transfer counts from REST API v2
   * Queries: /api/v2/addresses/{address}
   * Returns: { tx_count, token_transfers_count }
   */
  private async getAddressTransactionCounts(address: string): Promise<{ txCount: number; transferCount: number }> {
    try {
      // Use direct_api_call to query Blockscout REST API v2 addresses endpoint
      // This endpoint returns comprehensive address statistics including transaction counts
      const response = await this.callApi("direct_api_call", {
        chain_id: this.chainId,
        endpoint_path: `/api/v2/addresses/${address}`,
      });

      const debug = process.env.DEBUG_BLOCKSCOUT === "true";
      
      // Extract the response data - direct_api_call returns nested structure
      let data = response;
      if (response.data && typeof response.data === "object") {
        data = response.data;
      }

      if (debug) {
        console.log("[DEBUG] REST API /addresses response:", JSON.stringify(data, null, 2).substring(0, 1000));
      }

      // Extract counts from the API response
      // The /api/v2/addresses/{address} endpoint returns various possible field names
      // depending on configuration, so check multiple possibilities
      let txCount = Number(data.tx_count) || Number(data.transactions_count) || 0;
      let transferCount = Number(data.token_transfers_count) || Number(data.transfer_count) || 0;

      // If counts are still 0, they might not be available in this endpoint
      // The Blockscout REST API v2 may not always include these aggregate counts
      // Use get_transactions_by_address endpoint to fetch and count instead
      if (txCount === 0) {
        try {
          const txResponse = await this.callApi("get_transactions_by_address", {
            chain_id: this.chainId,
            address,
            limit: 1,  // Just need count, not full data
          });
          
          // The response should include pagination info with total count
          if (txResponse && txResponse.total) {
            txCount = Number(txResponse.total);
          }
          
          if (debug) {
            console.log(`[DEBUG] Fetched tx_count from get_transactions_by_address: ${txCount}`);
          }
        } catch (fallbackError) {
          if (debug) {
            console.log(`[DEBUG] Fallback tx count fetch failed:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
          }
        }
      }

      if (debug) {
        console.log(`[DEBUG] Extracted from /api/v2/addresses: tx_count=${txCount}, token_transfers_count=${transferCount}`);
      }

      return {
        txCount,
        transferCount,
      };
    } catch (e) {
      // If direct_api_call fails, return defaults
      const debug = process.env.DEBUG_BLOCKSCOUT === "true";
      if (debug) {
        console.log(`[DEBUG] Failed to fetch transaction counts from REST API:`, e instanceof Error ? e.message : e);
      }
      return { txCount: 0, transferCount: 0 };
    }
  }

  /**
   * Retrieve the ABI for a verified smart contract
   */
  async getContractAbi(address: string): Promise<any[]> {
    const response = await this.callApi("get_contract_abi", {
      chain_id: this.chainId,
      address,
    });

    // Handle nested response structure
    const abiData = response.data?.abi || response.data;

    if (!abiData || !Array.isArray(abiData)) {
      throw new Error(`Contract ${address} is not verified or has no ABI`);
    }

    return abiData;
  }

  /**
   * Inspect verified contract source code
   * @param address Contract address
   * @param fileName Optional specific file name from source_code_tree_structure
   */
  async inspectContractCode(address: string, fileName?: string): Promise<ContractCode> {
    const params: any = {
      chain_id: this.chainId,
      address,
    };

    if (fileName) {
      params.file_name = fileName;
    }

    const response = await this.callApi("inspect_contract_code", params);

    // When file_name is specified, Blockscout returns file_content instead of source_code
    const sourceCode = response.data.file_content || response.data.source_code;

    return {
      name: response.data.name,
      compiler: response.data.compiler_version,
      optimizationEnabled: response.data.optimization_enabled || false,
      optimizationRuns: response.data.optimization_runs || 0,
      sourceCode: sourceCode,
      abi: response.data.abi,
      constructorArgs: response.data.constructor_args,
      evmVersion: response.data.evm_version,
      isProxy: response.data.is_proxy || false,
      implementations: response.data.implementations || [],
      sourceCodeTreeStructure: response.data.source_code_tree_structure || [],
      sourcifyRepoUrl: response.data.sourcify_repo_url,
    };
  }

  /**
   * Fetch source code from Sourcify repository
   * Downloads the metadata.json and all source files from a Sourcify-verified contract
   */
  async fetchSourceFromSourcify(sourcifyUrl: string): Promise<SourcifySource | null> {
    try {
      // Sourcify repo structure: https://repo.sourcify.dev/contracts/full_match/{chainId}/{address}/
      // Contains: metadata.json and sources/ directory with all .sol files
      
      const metadataUrl = `${sourcifyUrl.replace(/\/$/, "")}/metadata.json`;
      const metadataResponse = await fetch(metadataUrl);
      
      if (!metadataResponse.ok) {
        return null;
      }

      const metadata = await metadataResponse.json() as any;
      const sources: Record<string, string> = {};

      // metadata.sources contains file paths, fetch each one
      if (metadata.sources && typeof metadata.sources === "object") {
        for (const [filePath, _] of Object.entries(metadata.sources)) {
          try {
            // Sourcify stores files in sources/ directory
            const sourceUrl = `${sourcifyUrl.replace(/\/$/, "")}/sources/${filePath}`;
            const sourceResponse = await fetch(sourceUrl);
            
            if (sourceResponse.ok) {
              sources[filePath] = await sourceResponse.text();
            }
          } catch (e) {
            // Skip files that fail to fetch
            continue;
          }
        }
      }

      return {
        metadata,
        sources,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get transaction logs with decoded event data
   * Essential for reconstructing Diamond upgrade history
   */
  async getTransactionLogs(
    txHash: string,
    eventSignature?: string,
  ): Promise<TransactionLog[]> {
    const response = await this.callApi("get_transaction_logs", {
      chain_id: this.chainId,
      transaction_hash: txHash,
    });

    let logs = response.data || [];

    // Filter by event signature if provided
    if (eventSignature) {
      logs = logs.filter((log: any) => 
        log.topics && log.topics[0] === eventSignature
      );
    }

    return logs.map((log: any) => ({
      address: log.address,
      topics: log.topics || [],
      data: log.data,
      blockNumber: log.block_number,
      txHash: log.transaction_hash,
      logIndex: log.log_index,
      decoded: log.decoded || null,
    }));
  }

  /**
   * Get DiamondCut events for a Diamond contract
   * DiamondCut event signature: DiamondCut(FacetCut[],address,bytes)
   */
  async getDiamondCutEvents(
    diamondAddress: string,
    fromBlock?: number,
    toBlock?: number,
  ): Promise<DiamondCutEvent[]> {
    try {
      // First, get all transactions for this address
      const transactions = await this.getTransactionsByAddress(diamondAddress);
      
      if (transactions.length === 0) {
        return [];
      }

      // DiamondCut event signature hash
      const DIAMOND_CUT_SIGNATURE = "0x8faa70878671ccd212d20771b795c50af8fd3ff6cf27f4bde57e5d4de0aeb673";

      const events: DiamondCutEvent[] = [];

      // Get logs for each transaction and filter for DiamondCut events
      for (const tx of transactions) {
        try {
          const logs = await this.getTransactionLogs(tx.hash, DIAMOND_CUT_SIGNATURE);

          for (const log of logs) {
            // parseDiamondCutEvent now async to allow fetching full truncated logs
            const ev = await this.parseDiamondCutEvent(log);
            events.push(ev);
          }
        } catch (error) {
          // Skip transactions that error
          continue;
        }
      }

      return events;
    } catch (error) {
      // If we can't get transaction history, return empty array
      return [];
    }
  }

  /**
   * Get implementations (deployments) for a Diamond proxy with optional names
   */
  async getImplementations(diamondAddress: string): Promise<Array<{ address: string; name?: string }>> {
    const addressInfo = await this.callApi("get_address_info", {
      chain_id: this.chainId,
      address: diamondAddress,
    });

    const basicInfo = addressInfo.data?.basic_info || addressInfo.data || addressInfo;
    const implementations = basicInfo?.implementations;
    if (!implementations || !Array.isArray(implementations)) return [];

    const unique = new Map<string, string | undefined>();
    for (const impl of implementations) {
      const addr: string | undefined = impl.address_hash || impl.address;
      if (addr && !unique.has(addr)) unique.set(addr, impl.name);
    }
    return Array.from(unique.entries()).map(([address, name]) => ({ address, name }));
  }

  /**
   * Parse a DiamondCut event log into structured data.
   * This function is async because Blockscout may return truncated `data`/`decoded` fields.
   * When truncated, we fetch full transaction logs and re-attempt decoding.
   */
  private async parseDiamondCutEvent(log: any): Promise<DiamondCutEvent> {
    let facetCuts: any[] = [];
    let decoded = log.decoded || log.decoded_event || null;

    // If decoding is missing or truncated, attempt to fetch full logs for this tx
    try {
      if ((!decoded || Object.keys(decoded).length === 0) && log.txHash && log.data_truncated) {
        try {
          const full = await this.getFullTransactionLogs(log.txHash || log.transaction_hash);
          if (full && Array.isArray(full) && full.length > 0) {
            // try to find the exact log by index if possible
            const match = full.find((l: any) => l.index === log.index) || full[0];
            if (match && match.decoded) decoded = match.decoded;
          }
        } catch (e) {
          // ignore fetch errors, continue with whatever decoded we have
        }
      }
    } catch {
      // swallow
    }

    // Extract facetCuts from various decoded shapes
    try {
      if (decoded && typeof decoded === "object") {
        // many shapes: decoded.args, decoded.arguments, decoded.parameters, decoded.values
        const args = decoded.args || decoded.arguments || decoded.params || decoded.values || decoded.parameters || decoded.data;
        if (Array.isArray(args) && args.length > 0) {
          if (Array.isArray(args[0])) {
            facetCuts = args[0];
          } else if (args[0] && typeof args[0] === "object") {
            facetCuts = args[0].facets || args[0]._facets || args[0].facetCuts || args[0].value || [];
          }
        }

        // last resort: try to extract structured arrays from decoded object
        if ((!facetCuts || facetCuts.length === 0)) {
          facetCuts = this._extractFacetCutsFromDecoded(decoded) || [];
        }
      }
    } catch (e) {
      facetCuts = [];
    }

    // Normalize initAddress if provided in topics (topic[1] may be padded address)
    let initAddress = "0x0000000000000000000000000000000000000000";
    try {
      if (Array.isArray(log.topics) && log.topics[1]) {
        const t = log.topics[1];
        if (typeof t === "string" && t.startsWith("0x") && t.length >= 42) {
          initAddress = `0x${t.slice(-40)}`.toLowerCase();
        }
      }
    } catch {
      // keep default
    }

    return {
      txHash: log.transaction_hash || log.transactionHash || log.txHash || "",
      blockNumber: log.block_number || log.blockNumber || 0,
      timestamp: log.timestamp || 0,
      facetCuts: facetCuts || [],
      initAddress,
      calldata: log.data || log.calldata || "",
    };
  }

  // Try to extract an array of facet cut objects from various decoded shapes
  private _extractFacetCutsFromDecoded(decoded: any): any[] | null {
    try {
      if (!decoded) return null;
      // check parameters or value fields for nested arrays of objects
      const candidates = [] as any[];
      if (Array.isArray(decoded.parameters)) candidates.push(...decoded.parameters.map((p: any) => p.value));
      if (Array.isArray(decoded.args)) candidates.push(...decoded.args.map((p: any) => p.value));
      // include top-level arrays
      for (const k of Object.keys(decoded)) {
        if (Array.isArray(decoded[k])) candidates.push(decoded[k]);
      }

      for (const cand of candidates) {
        if (!Array.isArray(cand)) continue;
        if (cand.length === 0) continue;
        // check if items look like facet cut objects
        const first = cand[0];
        if (first && typeof first === 'object') {
          const hasKeys = 'action' in first || 'facetAddress' in first || 'facet' in first || 'target' in first;
          if (hasKeys) return cand;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Fetch full transaction logs (v2 endpoint) to avoid truncated data
  async getFullTransactionLogs(txHash: string) {
    try {
      const url = `/api/v2/transactions/${txHash}/logs`;
      const resp = await this.callApi(url, { chain_id: this.chainId });
      return resp?.data || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Read a view/pure function from a contract
   */
  async readContract(
    address: string,
    functionName: string,
    args: any[] = [],
    abi?: any[],
  ): Promise<any> {
    const params: any = {
      chain_id: this.chainId,
      address,
      function_name: functionName,
    };

    // Add args if provided (as JSON array)
    if (args.length > 0) {
      params.args = args;
    }

    // Add ABI if provided (as JSON object/array, not stringified)
    if (abi) {
      params.abi = abi;
    }

    const response = await this.callApi("read_contract", params);

    // Blockscout variants:
    // - { data: <decodedValue> }
    // - { data: { decoded: <decodedValue> } }
    // - { data: { result: <decodedValue> } }
    // - { result: <decodedValue> }
    const d = response?.data ?? response;
    if (d && typeof d === "object") {
      if ("decoded" in d) return (d as any).decoded;
      if ("result" in d) return (d as any).result;
    }
    return d;
  }

  /**
   * Get all facets from a Diamond contract (using DiamondLoupe)
   * Calls the facets() function which returns FacetCut[] array
   */
  async getDiamondFacets(diamondAddress: string): Promise<DiamondFacet[]> {
    // Standard DiamondLoupe function ABIs (minimal)
    const FACETS_FN_ABI = [{
      inputs: [],
      name: "facets",
      outputs: [
        {
          components: [
            { internalType: "address", name: "facetAddress", type: "address" },
            { internalType: "bytes4[]", name: "functionSelectors", type: "bytes4[]" },
          ],
          internalType: "struct IDiamondLoupe.Facet[]",
          name: "facets_",
          type: "tuple[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    }];
    const FACET_ADDRESSES_ABI = [{
      inputs: [],
      name: "facetAddresses",
      outputs: [{ internalType: "address[]", name: "facetAddresses_", type: "address[]" }],
      stateMutability: "view",
      type: "function",
    }];
    const FACET_SELECTORS_ABI = [{
      inputs: [{ internalType: "address", name: "_facet", type: "address" }],
      name: "facetFunctionSelectors",
      outputs: [{ internalType: "bytes4[]", name: "_facetFunctionSelectors", type: "bytes4[]" }],
      stateMutability: "view",
      type: "function",
    }];

    const debug = process.env.DEBUG_BLOCKSCOUT === "true";

    // Attempt 1: Use facets() for precise current state
    try {
      if (debug) console.log("[DEBUG] Trying facets() call...");
      const result = await this.readContract(diamondAddress, "facets", [], FACETS_FN_ABI);

      if (Array.isArray(result)) {
        if (debug) console.log(`[DEBUG] facets() succeeded, returned ${result.length} facets`);
        const facets: DiamondFacet[] = [];
        const seen = new Set<string>();
        for (const facet of result) {
          const rawAddress = facet.facetAddress || facet[0];
          // Validate address format
          if (rawAddress && typeof rawAddress === 'string' && rawAddress.startsWith('0x') && rawAddress.length === 42) {
            const facetAddress = rawAddress.toLowerCase();
            if (seen.has(facetAddress)) continue;
            seen.add(facetAddress);
            facets.push({
              facetAddress,
              functionSelectors: (facet.functionSelectors || facet[1] || []).map((s: string) => String(s)),
            });
          }
        }
        if (facets.length > 0) {
          return facets;
        }
      }
    } catch (e) {
      if (debug) console.log(`[DEBUG] facets() failed: ${e instanceof Error ? e.message : String(e)}`);
      // continue to fallback
    }

    // Attempt 2: facetAddresses() + facetFunctionSelectors(address)
    try {
      if (debug) console.log("[DEBUG] Trying facetAddresses() call...");
      const addresses = await this.readContract(diamondAddress, "facetAddresses", [], FACET_ADDRESSES_ABI);
        if (Array.isArray(addresses) && addresses.length > 0) {
        if (debug) console.log(`[DEBUG] facetAddresses() succeeded, returned ${addresses.length} addresses`);
        const facets: DiamondFacet[] = [];
        const seen = new Set<string>();
        for (const addr of addresses) {
          // Validate address format
          if (addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42) {
            const normalized = addr.toLowerCase();
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            try {
              const selectors = await this.readContract(
                diamondAddress,
                "facetFunctionSelectors",
                [addr],
                FACET_SELECTORS_ABI,
              );
              facets.push({ facetAddress: normalized, functionSelectors: Array.isArray(selectors) ? selectors : [] });
            } catch {
              // If selectors call fails, still include the address
              facets.push({ facetAddress: normalized, functionSelectors: [] });
            }
          }
        }
        if (facets.length > 0) {
          return facets;
        }
      }
    } catch (e) {
      if (debug) console.log(`[DEBUG] facetAddresses() failed: ${e instanceof Error ? e.message : String(e)}`);
      // continue to fallback
    }

    // Final fallback: use Blockscout implementations list
    try {
      if (debug) console.log("[DEBUG] Falling back to implementations list from get_address_info...");
      const addressInfo = await this.callApi("get_address_info", {
        chain_id: this.chainId,
        address: diamondAddress,
      });

      const basicInfo = addressInfo.data?.basic_info || addressInfo.data || addressInfo;
      if (basicInfo.implementations && Array.isArray(basicInfo.implementations)) {
        const unique = new Set<string>();
        const facets: DiamondFacet[] = [];
        for (const impl of basicInfo.implementations) {
          const raw = impl.address_hash || impl.address || impl;
          if (!raw || typeof raw !== 'string') continue;
          const addr = raw.toLowerCase();
          // Validate that this is actually an address, not a transaction hash
          if (/^0x[0-9a-f]{40}$/.test(addr) && !unique.has(addr)) {
            unique.add(addr);
            facets.push({ facetAddress: addr, functionSelectors: [] });
          }
        }
        if (debug) console.log(`[DEBUG] Implementations fallback succeeded, found ${facets.length} valid addresses`);
        return facets;
      }
    } catch (e) {
      if (debug) console.log(`[DEBUG] Implementations fallback failed: ${e instanceof Error ? e.message : String(e)}`);
      // ignore and throw below
    }

    throw new Error(`Unable to determine Diamond facets via loupe or address info`);
  }

  /**
   * Get facet address for a specific function selector
   */
  async getFacetAddress(
    diamondAddress: string,
    selector: string,
  ): Promise<string> {
    const FACET_ADDRESS_ABI = [{
      inputs: [{ internalType: "bytes4", name: "_functionSelector", type: "bytes4" }],
      name: "facetAddress",
      outputs: [{ internalType: "address", name: "facetAddress_", type: "address" }],
      stateMutability: "view",
      type: "function",
    }];
    const result = await this.readContract(diamondAddress, "facetAddress", [selector], FACET_ADDRESS_ABI);
    return result;
  }

  /**
   * Get all function selectors for a facet
   */
  async getFacetFunctionSelectors(
    diamondAddress: string,
    facetAddress: string,
  ): Promise<string[]> {
    const FACET_SELECTORS_ABI = [{
      inputs: [{ internalType: "address", name: "_facet", type: "address" }],
      name: "facetFunctionSelectors",
      outputs: [{ internalType: "bytes4[]", name: "_facetFunctionSelectors", type: "bytes4[]" }],
      stateMutability: "view",
      type: "function",
    }];
    const result = await this.readContract(diamondAddress, "facetFunctionSelectors", [facetAddress], FACET_SELECTORS_ABI);
    return Array.isArray(result) ? result : [];
  }

  /**
   * Get transactions for an address with time range filtering
   */
  async getTransactionsByAddress(
    address: string,
    ageFrom?: string, // e.g., "7d", "1h", "30m"
    ageTo?: string,
    limit?: number,
  ): Promise<Transaction[]> {
    const params: any = {
      chain_id: this.chainId,
      address,
    };

    if (ageFrom) params.age_from = ageFrom;
    if (ageTo) params.age_to = ageTo;
    if (limit) params.limit = limit;

    const response = await this.callApi("get_transactions_by_address", params);
    
    return (response.data || []).map((tx: any) => ({
      hash: tx.hash,
      from: tx.from?.hash,
      to: tx.to?.hash,
      value: tx.value,
      gas: tx.gas,
      gasPrice: tx.gas_price,
      gasUsed: tx.gas_used,
      blockNumber: tx.block,
      timestamp: tx.timestamp,
      status: tx.status,
      method: tx.method,
    }));
  }

  /**
   * Get human-readable transaction summary
   */
  async getTransactionSummary(txHash: string): Promise<string> {
    const response = await this.callApi("transaction_summary", {
      chain_id: this.chainId,
      transaction_hash: txHash,
    });

    return response.data?.summary || response.data || "No summary available";
  }

  /**
   * Get the latest indexed block
   */
  async getLatestBlock(): Promise<BlockInfo> {
    const response = await this.callApi("get_latest_block", {
      chain_id: this.chainId,
    });

    return {
      number: response.data.block_number,
      timestamp: response.data.timestamp,
      hash: response.data.hash,
    };
  }

  /**
   * Get detailed block information
   */
  async getBlockInfo(blockNumber: number): Promise<BlockInfo> {
    const response = await this.callApi("get_block_info", {
      chain_id: this.chainId,
      block_number: blockNumber,
    });

    return {
      number: response.data.height,
      timestamp: response.data.timestamp,
      hash: response.data.hash,
      parentHash: response.data.parent_hash,
      miner: response.data.miner?.hash,
      gasUsed: response.data.gas_used,
      gasLimit: response.data.gas_limit,
      transactionCount: response.data.tx_count || 0,
    };
  }

  /**
   * Resolve ENS name to address
   */
  async resolveEnsName(ensName: string): Promise<string> {
    const response = await this.callApi("get_address_by_ens_name", {
      ens_name: ensName,
    });

    if (!response.data?.address) {
      throw new Error(`ENS name ${ensName} not found`);
    }

    return response.data.address;
  }

  /**
   * Get list of supported chains
   */
  async getChainsList(): Promise<Chain[]> {
    const response = await this.callApi("get_chains_list", {});
    
    return (response.data || []).map((chain: any) => ({
      id: chain.id,
      name: chain.name,
      shortName: chain.short_name,
      nativeCurrency: chain.native_currency_symbol,
      isTestnet: chain.is_testnet || false,
    }));
  }

  /**
   * Make a generic API call
   */
  private async callApi(endpoint: string, params: any = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    
    // Add query parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        // For arrays and objects, stringify them as JSON
        if (typeof value === 'object') {
          url.searchParams.append(key, JSON.stringify(value));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Blockscout API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json() as any;
      
      // Debug logging (can be removed later)
      if (process.env.DEBUG_BLOCKSCOUT === "true") {
        console.log(`\n[DEBUG] Blockscout API call: ${endpoint}`);
        console.log(`[DEBUG] URL: ${url.toString()}`);
        console.log(`[DEBUG] Response:`, JSON.stringify(data, null, 2));
      }
      
      // Handle error responses
      if (data.error) {
        throw new Error(`Blockscout API error: ${data.error}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Blockscout API call failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Change the chain ID for subsequent requests
   */
  setChainId(chainId: number): void {
    this.chainId = chainId;
  }

  /**
   * Get current chain ID
   */
  getChainId(): number {
    return this.chainId;
  }
}

// Type definitions

export interface AddressInfo {
  address: string;
  isContract: boolean;
  balance: string;
  blockNumber: number;
  creator?: string;
  creationTxHash?: string;
  isVerified: boolean;
  name?: string;
  tx_count?: number;
  token_transfers_count?: number;
  transactions_count?: number;
}

export interface ContractCode {
  name: string;
  compiler: string;
  optimizationEnabled: boolean;
  optimizationRuns: number;
  sourceCode: string;
  abi: any[];
  constructorArgs?: string;
  evmVersion: string;
  isProxy: boolean;
  implementations: string[];
  sourceCodeTreeStructure?: string[];
  sourcifyRepoUrl?: string;
}

export interface SourcifySource {
  metadata: any;
  sources: Record<string, string>;
}

export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  decoded: any | null;
}

export interface DiamondCutEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  facetCuts: FacetCut[];
  initAddress: string;
  calldata: string;
}

export interface DiamondFacet {
  facetAddress: string;
  functionSelectors: string[];
}

export interface Transaction {
  hash: string;
  from?: string;
  to?: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  blockNumber: number;
  timestamp: string;
  status: string;
  method?: string;
}

export interface BlockInfo {
  number: number;
  timestamp: string;
  hash: string;
  parentHash?: string;
  miner?: string;
  gasUsed?: string;
  gasLimit?: string;
  transactionCount?: number;
}

export interface Chain {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: string;
  isTestnet: boolean;
}

/**
 * Chain ID constants for common networks
 */
export const CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  SEPOLIA: 11155111,
  GOERLI: 5,
  POLYGON: 137,
  POLYGON_MUMBAI: 80001,
  BSC: 56,
  BSC_TESTNET: 97,
  AVALANCHE: 43114,
  AVALANCHE_FUJI: 43113,
  ARBITRUM: 42161,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM: 10,
  OPTIMISM_SEPOLIA: 11155420,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
} as const;

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const entry = Object.entries(CHAIN_IDS).find(([_, id]) => id === chainId);
  return entry ? entry[0].replace(/_/g, " ").toLowerCase() : `Chain ${chainId}`;
}
