pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

// TODO - import Wallet (via an interface??)
import "./Wallet.sol";

contract Dex is Wallet {

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint price; 
    }
    // order.side = Side.BUY;

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;    //Ticker => (Side => orders)

    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory) {
        return(orderBook[ticker][uint(side)]);
    }
    // Note: Call would be :
    //  getOrderBook(bytes32("LINK"), Side.BUY);

/*
    function createLimitOrder(bytes32 ticker, Side side, uint price, uint amount)
        external
        isKnownToken(ticker)
        returns(Order memory limitOrder) 
    {
    //     // TODO
        return limitOrder;
    }
*/

    function createLimitOrder(bytes32 ticker, Side side, uint price, uint amount)
        external
        returns(Order memory limitOrder) 
    {

    }

    function depositETH() public payable {

    }

    function getETHBalance() view public returns(uint ethBalance){

    }
}