pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LinkMock is ERC20 {
    constructor() ERC20("ChainLink (mock)", "LINK") {
        _mint(msg.sender, 1000);
    }
}