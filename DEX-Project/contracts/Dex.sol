// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        uint filled;
    }

    event LimitOrderCreated(
        bytes32 ticker,
        Side side,
        uint price,
        uint amount
    );
    event TradeExecuted(
        address taker, 
        address maker, 
        bytes32 ticker, 
        uint amount, 
        uint price, 
        Side side
    );

    // Events - for testing purposes only
    event EnteredCreateMO(bytes32 ticker, Side side, uint amount);
    event AboutToProcessMO(bytes32 ticker, Side side, uint amount);
    event AmountLeftToFill(uint amount);
    event AboutToTrade();
    event InsideRemoveFilled();
    

    // State variables

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;    //Ticker => (Side => orders)
    uint nextId = 1;


    // Public & External Functions

    function depositETH() public payable {
        balances[msg.sender]["ETH"] += msg.value;
    }


    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory) {
        return(orderBook[ticker][uint(side)]);
    }


    function createLimitOrder(bytes32 ticker, Side side, uint price, uint amount)
        external
        isKnownToken(ticker)
    {
        if (side == Side.BUY)
            require(
                balances[msg.sender]["ETH"] >= amount * price,
                "Not enough ETH on deposit!"
            );
        else if (side == Side.SELL)
            require(
                balances[msg.sender][ticker] >= amount,
                "Too few tokens for sell order!"
            );
        else revert("Neither BUY nor SELL side!");
        
        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(nextId, msg.sender, side, ticker, amount, price, 0));
        nextId++;

        if (side == Side.BUY)
            _sortToDescedingPrice(orders);
        else //Sell-side
            _sortToAscendingPrice(orders);

        emit LimitOrderCreated(ticker, side, price, amount);
    }


    function createMarketOrder(bytes32 ticker, Side side, uint amount)
        external
        isKnownToken(ticker)
    {
        emit EnteredCreateMO(ticker, side, amount);    //DEBUGGING

        uint otherSide;
        if (side == Side.SELL) {
            require(balances[msg.sender][ticker] >= amount);
            otherSide = 0;  //Buy-side
        }
        else if (side == Side.BUY) otherSide = 1; //Sell-side
        else revert("Neither BUY nor SELL side!");

        Order[] storage orders = orderBook[ticker][otherSide];
        uint totalFilled;

        emit AboutToProcessMO(ticker, side, amount);    //DEBUGGING

        for (uint i = 0; (totalFilled < amount) && (i < orders.length); i++) {
            // Calculate amount of market order fillable from current limit order
            uint leftToFill = amount - totalFilled;

            emit AmountLeftToFill(leftToFill);  //DEBUGGING

            if ((orders[i].amount - orders[i].filled) >= leftToFill ) {  
                // Complete fill of market order from current limit order
                orders[i].filled += leftToFill;
                totalFilled += leftToFill;
                assert(totalFilled == amount); //Fill calculation error?

                _executeTrade(
                    msg.sender,
                    orders[i].trader,
                    ticker,
                    leftToFill,
                    orders[i].price,
                    side
                );
            }
            else {  
                // Partially fill market order (from current limit order)
                uint amountAvailable = orders[i].amount - orders[i].filled;
                orders[i].filled += amountAvailable;
                totalFilled += amountAvailable;
                assert(orders[i].filled == orders[i].amount); //Calc. error?

                _executeTrade(
                    msg.sender,
                    orders[i].trader,
                    ticker,
                    amountAvailable,
                    orders[i].price,
                    side
                );
            }
        }
        // Remove 100% filled orders from the orderbook
        _removeFilled(orders);
    }


// Internal and private functions

    function _sortToDescedingPrice(Order[] storage orders)
        internal
    {
        for (uint i = orders.length-1; i > 0; i--)
            if (orders[i].price > orders[i-1].price)
                _swapOrderPosition(orders, i-1, i);
    }


    function _sortToAscendingPrice(Order[] storage orders)
        internal
    {
        for (uint i = orders.length-1; i > 0; i--)
            if (orders[i].price < orders[i-1].price)
                _swapOrderPosition(orders, i-1, i);
    }


    function _swapOrderPosition(
        Order[] storage orders,
        uint position1,
        uint position2
    )
        internal
    {
        Order memory tempOrder = orders[position1];
        orders[position1] = orders[position2]; 
        orders[position2] = tempOrder;
    }


    function _executeTrade(
        address taker,  // creator of market order
        address maker,  // creator of limit order
        bytes32 ticker,
        uint amount,
        uint price,
        Side side
    )
        internal
    {
        // emit AboutToTrade();    //DEBUGGING

        uint valueInWei = price * amount;
        if (side == Side.BUY) {
            require(
                balances[taker]["ETH"] >= valueInWei,
                "Not enough ETH to complete fill!"
            );
            _shiftBalances(taker, maker, ticker, amount, valueInWei);
        }
        else //Sell-side
            _shiftBalances(maker, taker, ticker, amount, valueInWei);

        emit TradeExecuted(taker, maker, ticker, amount, price, side);
    }


    function _shiftBalances(
        address buyer,
        address seller,
        bytes32 ticker,
        uint amount,
        uint valueInWei
    )
        internal
    {
        balances[buyer]["ETH"] -= valueInWei;
        balances[seller]["ETH"] += valueInWei;
        balances[buyer][ticker] += amount;
        balances[seller][ticker] -= amount;
    }


    function _removeFilled(Order[] storage orders) internal {
        // Find where filled orders end in order book
 //       emit InsideRemoveFilled();  //DEBUGGING
        uint i;
        while ((i < orders.length) && (orders[i].filled == orders[i].amount))
            i++;

        // Move unfilled orders up in order book (overwriting filled orders)
        for (uint j = i; j < orders.length; j++)
            orders[j-i] = orders[j];

        // Remove redundant orders (from end of orderbook) 
        for (uint k = 0; k < i; k++) orders.pop();

    }

}
