// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/**
 * @title VulnerableBank
 * @dev INTENTIONALLY VULNERABLE CONTRACT FOR TESTING
 * DO NOT DEPLOY TO MAINNET
 * 
 * Contains multiple vulnerabilities for Markov to detect:
 * - Reentrancy
 * - Missing access control
 * - Integer overflow (Solidity < 0.8.0)
 * - Unchecked external calls
 */
contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Deposit ETH into the bank
     */
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    /**
     * @dev VULNERABLE: Reentrancy attack
     * External call before state update
     */
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // VULNERABILITY: External call before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        // State updated AFTER external call - reentrancy risk!
        balances[msg.sender] -= amount;
    }
    
    /**
     * @dev VULNERABLE: No access control
     * Anyone can call this function!
     */
    function emergencyWithdraw() public {
        // VULNERABILITY: No onlyOwner modifier
        payable(msg.sender).transfer(address(this).balance);
    }
    
    /**
     * @dev VULNERABLE: Integer overflow
     * No SafeMath and Solidity < 0.8.0
     */
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // VULNERABILITY: Potential integer overflow
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
    
    /**
     * @dev VULNERABLE: Unchecked external call
     */
    function sendFunds(address payable recipient, uint256 amount) public {
        require(balances[msg.sender] >= amount);
        
        balances[msg.sender] -= amount;
        
        // VULNERABILITY: Return value not checked
        recipient.send(amount);
    }
    
    receive() external payable {
        deposit();
    }
}