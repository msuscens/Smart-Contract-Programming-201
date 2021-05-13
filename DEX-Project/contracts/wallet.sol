// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract Wallet is Ownable {

    struct Token {
        bytes32 ticker;
        address tokenAddress;   // Token's ERC20 Contract address 
    }
    mapping(bytes32 => Token) public tokenMapping;  // Ticker => Token Struct
    bytes32[] public tokenList;                     // List of all the token Tickers
    
    mapping(address=>mapping(bytes32 => uint256)) public balances; // owner's address? => (tokenTicker => balance)

    event TokenAdded(address tokenAddress, bytes32 ticker);
    event TokensDeposited(address depositor, bytes32 ticker, uint amount);
    event TokensWithdrawn(address withdrawer, bytes32 ticker, uint amount);

    modifier isKnownToken(bytes32 ticker){
        require(
            tokenMapping[ticker].tokenAddress != address(0),
            "Unknown token; addToken first!"
        );
        _;
    }

    // Public & External Functions

    function addToken(bytes32 ticker, address tokenAddress) external onlyOwner {
        tokenMapping[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);

        emit TokenAdded(tokenAddress, ticker);
    }


    function getBalance(address account, bytes32 ticker)
        view
        external
        returns(uint amount)
    {
        return balances[account][ticker];
    }

    // Deposit tokens into the wallet (must be the owner of token in ERC20
    // token contract).  Ie. The wallet contact needs to instruct the token
    // contract to transfer the amount of tokens from the owner's address to
    // the wallet contract's address.  The wallet must have been granted 
    // operator privlidges beforehand in order for the token contract to 
    // perform this transfer of token ownership (ie. update its' internal
    // token owner balances)
    function deposit(uint amount, bytes32 ticker) external isKnownToken(ticker) {
        require(amount > 0, "Asked to deposit 0 tokens!");          // Checks

        balances[msg.sender][ticker] += amount;                     // Effects

        IERC20(tokenMapping[ticker].tokenAddress).transferFrom(     // Interact
            msg.sender,
            address(this),
            amount
        ); 
        emit TokensDeposited(msg.sender, ticker, amount);
    }
    
    function withdraw(uint amount, bytes32 ticker) external isKnownToken(ticker) {
        require(balances[msg.sender][ticker] >= amount, "Balance not sufficient!");

        balances[msg.sender][ticker] += amount;
        IERC20(tokenMapping[ticker].tokenAddress).transfer(msg.sender, amount);

        emit TokensWithdrawn(msg.sender, ticker, amount);
    }
}