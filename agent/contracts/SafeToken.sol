// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafeVault
 * @dev SECURE CONTRACT EXAMPLE
 * 
 * Demonstrates security best practices:
 * - ReentrancyGuard
 * - Access control
 * - Solidity 0.8.0+ (built-in overflow protection)
 * - Checked external calls
 */
contract SafeVault is ReentrancyGuard, Ownable {
    mapping(address => uint256) public balances;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Deposit ETH into vault
     */
    function deposit() public payable {
        require(msg.value > 0, "Must deposit non-zero amount");
        
        balances[msg.sender] += msg.value;
        
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw funds with reentrancy protection
     */
    function withdraw(uint256 amount) public nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Checks-Effects-Interactions pattern
        // 1. Checks done above
        // 2. Effects (state changes) BEFORE interactions
        balances[msg.sender] -= amount;
        
        // 3. Interactions (external calls) LAST
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * @dev Emergency withdraw with proper access control
     */
    function emergencyWithdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Get vault balance
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    receive() external payable {
        deposit();
    }
}