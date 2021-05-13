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
        address maker;
        Side side;
        bytes32 ticker;
        uint amount;
        uint price;
        uint filled;
    }

    event EthDeposited(address depositor, uint amountInWei);
    event LimitOrderCreated(
        Side side,
        bytes32 ticker,
        uint price,
        uint amount
    );
    event TradeExecuted(
        Side side,
        address taker, 
        address maker, 
        bytes32 ticker, 
        uint fillAmount, 
        uint price, 
        uint totalWei
    );
    event MarketOrderProcessed(
        Side side,
        address taker, 
        bytes32 ticker,
        uint orderAmount, 
        uint totalAmountFilled 
    );

    
    // State variables

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;    //Ticker => (Side => orders)
    uint nextId = 1;


    // Public & External Functions

    function depositETH() public payable {
        balances[msg.sender]["ETH"] += msg.value;
        emit EthDeposited(msg.sender, msg.value);
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

        emit LimitOrderCreated(side, ticker, price, amount);
    }


    function createMarketOrder(bytes32 ticker, Side side, uint amount)
        external
        isKnownToken(ticker)
    {
        uint otherSide;
        if (side == Side.SELL) {
            require(
                balances[msg.sender][ticker] >= amount,
                "Insufficent token balance!"
            );
            otherSide = 0;  //Buy-side
        }
        else if (side == Side.BUY) otherSide = 1; //Sell-side
        else revert("Neither BUY nor SELL side!");

        Order[] storage orders = orderBook[ticker][otherSide];
        uint totalFilled;

        for (uint i = 0; (totalFilled < amount) && (i < orders.length); i++) {

            // Calculate amount of market order to fill from current limit order
            uint leftToFill = amount - totalFilled;
            uint availableToFill = orders[i].amount - orders[i].filled;
            bool fillAllMarketOrder = (availableToFill >= leftToFill );
            uint toFillNow = fillAllMarketOrder? leftToFill : availableToFill;

            orders[i].filled += toFillNow;
            totalFilled += toFillNow;

            // Invariant check for fill calculation
            fillAllMarketOrder?
                assert(totalFilled == amount) :
                assert(orders[i].filled == orders[i].amount);

            _executeTrade(
                msg.sender,
                orders[i],
                toFillNow,
                side
            );
        }
        // Remove 100% filled limit orders from order book
        _removeFilled(orders);

        emit MarketOrderProcessed(
            side,
            msg.sender, 
            ticker,
            amount, 
            totalFilled
        );
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
        Order storage limitOrder,
        uint fillAmount,
        Side side
    )
        internal
    {
        uint valueInWei = limitOrder.price * fillAmount;
        if (side == Side.BUY) {
            require(
                balances[taker]["ETH"] >= valueInWei,
                "Not enough ETH to complete fill!"
            );
            _shiftBalances(
                taker,
                limitOrder.maker,
                limitOrder.ticker,
                fillAmount,
                valueInWei
            );
        }
        else //Sell-side
            _shiftBalances(
                limitOrder.maker,
                taker,
                limitOrder.ticker,
                fillAmount,
                valueInWei
            );

        emit TradeExecuted(side, taker, limitOrder.maker, limitOrder.ticker, fillAmount, limitOrder.price, valueInWei);
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
