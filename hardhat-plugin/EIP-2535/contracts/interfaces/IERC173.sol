// SPDX-License-Identifier: CC0-1.0
/**
 * IERC173 — Contract ownership standard used by Diamonds (owner/transferOwnership).
 */
pragma solidity ^0.8.0;

/// @title ERC-173: Contract Ownership Standard
interface IERC173 {
    /// @dev This emits when ownership of a contract changes.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Get the address of the owner
    function owner() external view returns (address);

    /// @notice Set the address of the new owner of the contract
    /// @dev Set _newOwner to address(0) to renounce any ownership.
    function transferOwnership(address _newOwner) external;
}
