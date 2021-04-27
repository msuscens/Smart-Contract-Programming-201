pragma solidity ^0.8;

contract Ownable {
    
    address internal owner;
    
    modifier onlyOwner {
        require(msg.sender == owner, "Not owner!");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
}