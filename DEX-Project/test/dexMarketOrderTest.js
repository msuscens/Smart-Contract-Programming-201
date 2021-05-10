    //When creating a SELL market order, the seller needs to have enough tokens for the trade
    //Market orders can be submitted even if the order book is empty
    //Market orders should be filled until the order book is empty or the market order is 100% filled
    //The eth balance of the buyer should decrease with the filled amount
    //The token balances of the limit order sellers should decrease with the filled amounts.
    //Filled limit orders should be removed from the orderbook
    //Partly filled limit orders should be modified to represent the filled/remaining amount
    //When creating a BUY market order, the buyer needs to have enough ETH for the trade
