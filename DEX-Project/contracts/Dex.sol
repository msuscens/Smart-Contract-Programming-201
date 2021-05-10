pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

// TODO - import Wallet (via an interface??)
import "./Wallet.sol";

contract Dex is Wallet {

    using SafeMath for uint256;

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

    // State variables

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;    //Ticker => (Side => orders)
    uint nextId = 1;


    // Public & External Functions

    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory) {
        return(orderBook[ticker][uint(side)]);
    }


    function createLimitOrder(bytes32 ticker, Side side, uint price, uint amount)
        external
        isKnownToken(ticker)
    {
        if (side == Side.BUY)
            require(
                balances[msg.sender]["ETH"] >= amount.mul(price),
                "Not enough ETH on deposit!"
            );
        else if (side == Side.SELL)
            require(
                balances[msg.sender][ticker] >= amount,
                "Too few tokens for sell order!"
            );
        else revert("Neither BUY nor SELL side!");
        
        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(nextId, msg.sender, side, ticker, amount, price));
        nextId = nextId.add(1);

        if (side == Side.BUY) sortToDescedingPrice(orders);
        else if (side == Side.SELL) sortToAscendingPrice(orders);
    }


    function depositETH() public payable {
        balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(msg.value);
    }


// Internal and private functions

    function sortToDescedingPrice(Order[] storage orders)
        internal
    {
        for (uint i=orders.length-1; i>0; i--)
            if (orders[i].price > orders[i-1].price)
                swapOrderPosition(orders, i-1, i);
    }


    function sortToAscendingPrice(Order[] storage orders)
        internal
    {
            for (uint i=orders.length-1; i>0; i--)
                if (orders[i].price < orders[i-1].price)
                    swapOrderPosition(orders, i-1, i);
    }


    function swapOrderPosition(Order[] storage orders, uint pos1, uint pos2)
        internal
    {
        Order memory tempOrder = orders[pos1];
        orders[pos1] = orders[pos2]; 
        orders[pos2] = tempOrder;
    }

}
