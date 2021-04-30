pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20Capped, Ownable {

    constructor() ERC20("MarkToken", "MKT") ERC20Capped(10000){
        // Below doesn't compile, see known issue: OpenZeppelin/openzeppelin-contracts#2580 
        //_mint(msg.sender, 1000); 

        // Workaround to address above issue.  Note this workaround doesn't check that the 
        // total supply isn't exceeded during the mint in the constructor!
        ERC20._mint(msg.sender, 1000); 
    }
}
