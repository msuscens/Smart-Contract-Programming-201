const Dex = artifacts.require("Dex")
const LinkMock = artifacts.require("LinkMock")
const truffleAssert = require('truffle-assertions')

contract("Dex", accounts => {

    let dex, link

    before(async function() {
        dex = await Dex.deployed()
        link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.utf8ToHex("LINK"),link.address, {from: accounts[0]}
        )
        // For account[0]: Add intial amount of LINK and ETH (in Wei)
        await link.approve(dex.address, 500)
        await dex.deposit(500, web3.utils.utf8ToHex("LINK"))
        await dex.depositETH({value: 26000})
    })

    //When creating a market order it must be for a known token
    it("should throw when creating a market order for an unknown token", async () => {

        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("AAVE"),
               0,  //Buy-side
               5,  //amount
               {from: accounts[0]}
            )
        )
        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("AAVE"),
               1,  //Sell-side
               5,  //amount
               {from: accounts[0]}
            )
        )
    })

    //When creating a SELL market order, the seller needs to have enough tokens for the trade
    it("should throw when creating a sell market order with inadequate token balance for the trade", async () => {
        
        //CHECK SETUP: Initial LINK balance
        const linkBalance = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("LINK")
        )
        assert.equal(linkBalance, 500, "SETUP: LINK balance should be 500!")

        //TEST: Place a sell order for more tokens than deposited
        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               1,   //Sell-side
               501, //amount
               {from: accounts[0]}
            )
        )
    })

    //Market Orders can be submitted even if the order book is empty
    //In which case, MO should fill for 0 tokens, 0 ETH (as orderbook is empty)
    it("should allow market orders even when order book is empty", async () => {

        //CHECK SETUP: Initial balances
        const linkBefore = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("LINK")
        )
        const ethInWeiBefore = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("ETH")
        )

        //CHECK SETUP: Order books should be empty (buy & sell side)
        let buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            0   //Buy-side
        )
        assert.equal(
            buyOrderBook.length, 
            0,
            `SETUP: Expected empty buy-side order book, but it has ` +
            `${buyOrderBook.length} orders in it!`
        )
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            0,
            `SETUP: Expected empty sell-side order book, but it has ` +
            `${sellOrderBook.length} orders in it!`
        )

        //TEST: BUY-SIDE MARKET ORDER (against empty order book)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,  //Buy-side
               10, //amount
               {from: accounts[0]}
            )
        )

        //POST-TEST CHECK: No tokens bought and ETH balance is unchanged?
        // (ie. buy-order has filled for 0 LINK tokens, and for 0 ETH).
        let linkAfter = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("LINK")
        )
        let ethInWeiAfter = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(linkBefore),
            Number(linkAfter),
            "POST-TEST: LINK balance shouldn't have changed!"
        ) 
        assert.equal(
            Number(ethInWeiBefore),
            Number(ethInWeiAfter),
            "POST-TEST: ETH balance shouldn't have changed!"
        ) 
       
        //POST-TEST CHECK: Orderbook is still empty (buy & sell side)
        buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            0   //Buy-side
        )
        assert.equal(
            buyOrderBook.length, 
            0,
            `POST-TEST: Expected empty buy-side order book, but it has ` +
            `${buyOrderBook.length} orders in it!`
        )
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1 //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            0,
            `POST-TEST: Expected empty sell-side order book, but has ` + 
            `${sellOrderBook.length} orders in it!`
        )

        //TEST: SELL-SIDE MARKET ORDER (against empty order book)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               1,  //Sell-side
               10, //amount
               {from: accounts[0]}
           )
        )

        //POST-TEST CHECK: No tokens sold and sellers ETH balance is unchanged?
        // (ie. sell-order has filled for 0 LINK tokens, and for 0 ETH).
        linkAfter = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("LINK")
        )
        ethInWeiAfter = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(linkBefore), 
            Number(linkAfter),
            `POST-TEST: LINK balance shouldn't have changed!`
        ) 
        assert.equal(
            Number(ethInWeiBefore),
            Number(ethInWeiAfter),
            `POST-TEST: ETH balance shouldn't have changed!`
        ) 
       
        buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            0   //Buy-side
        )
        assert.equal(
            buyOrderBook.length,
            0,
            `POST-TEST: Expected empty buy-side order book, but has `+
            `${buyOrderBook.length} orders in it!`
        )
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            0,
            `POST-TEST: Expected empty sell-side order book, but has `+
            `${sellOrderBook.length} orders in it!`
        )
    })

    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("Market Order should not fill limit orders beyond the market order amount", async () => {

        //CHECK SETUP: Sell-side orderbook is empty
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            0,
            `SETUP: Expected an empty sell-side order book, but has `+
            `${sellOrderBook.length} orders in it!`
        )

        //SETUP: Create a populated sell-side order book
        await link.transfer(accounts[1], 100)
        await link.transfer(accounts[2], 100)
        await link.transfer(accounts[3], 100)
        await link.approve(dex.address, 100, {from: accounts[1]})
        await link.approve(dex.address, 100, {from: accounts[2]})
        await link.approve(dex.address, 100, {from: accounts[3]})
        await dex.deposit(
            100,
            web3.utils.fromUtf8("LINK"),
            {from: accounts[1]}
        )
        await dex.deposit(
            100,
            web3.utils.fromUtf8("LINK"),
            {from: accounts[2]}
        )
        await dex.deposit(
            100,
            web3.utils.fromUtf8("LINK"),
            {from: accounts[3]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1, 
            400, 
            15, 
            {from: accounts[1]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,
            300,
            5,
            {from: accounts[2]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1, 
            500,
            10,
            {from: accounts[3]}
        )

        //CHECK SETUP: Sell-side order book contains now populated?
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            3,
            `SETUP: Expected 3 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        // CHECK SETUP: Buyer has enough ETH for purchase (7,500Wei)?
        // (Required == 5*300 + 15*400 = 1,500 + 6,000 = 7,500)
        const buyersWei = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWei) >= 7500,
            true,
            `SETUP: Buyer has ${buyersWei} Wei, but needs 7,500 Wei!`
        )

        //TEST: Place Market Order to fill 2 of the 3 limit orders  
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,  //Buy-side
               20, //amount
               {from: accounts[0]}
            )
        )

        //CHECK POST-TEST: 1 remaining sell orders in order book?
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            1,
            `POST-TEST: Expected 1 remaining sell-side order, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            0,
            "POST-TEST: Expected sell-side order should have 0 filled!"
        )
    })

    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("should fill market orders until the order book is empty", async () => {

        //CHECK SETUP: Sell-side orderbook contains 1 order
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            1, 
            `SETUP: Should be 1 remaining sell-side order, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        //SETUP: Add further sell orders to the order book
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side
            400,    //price
            15,     //amount
            {from: accounts[1]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side
            300,    //price
            5,      //amount
            {from: accounts[2]}
        )
    
        // CHECK SETUP: Sell-side orderbook now contains number of expected orders
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"),
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            3, 
            `SETUP: Expected 3 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        // CHECK SETUP: Buyer has enough ETH for purchase (12,500Wei)?
        // (Required == 5*300 + 15*400 + 10*500 = 1500 + 6000 + 5000)
        const buyersWei = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWei) >= 12500,
            true,
            `SETUP: Buyer has ${buyersWei} Wei, but needs 12,500 Wei!`
        )

        //TEST: Place buy Market Order that will fill all sell orders
        // (Note: There should be total of 30 LINK in sell-side order book)
        const buyersLinkBefore = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("LINK")
        )
        await truffleAssert.passes(
            dex.createMarketOrder(
                web3.utils.utf8ToHex("LINK"),
                0,  //Buy-side
                35, //amount - NB. More tokens than 30 total in sell-side orderbook
                {from: accounts[0]}
            )
        )

        //POST-TEST CHECK: Sell-side orderbook is empty?
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"),
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            0, 
            `POST-TEST: Expected an empty sell-side orderbook, but it has `+
            `${sellOrderBook.length} orders in it!`
        )

        //POST-TEST CHECK: Buyer's LINK balance has been correctly updated?
        const buyersLinkAfter = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("LINK")
        )
        assert.equal(
            Number(buyersLinkBefore)+30, 
            Number(buyersLinkAfter),
            `POST-TEST: Should have bought 30 LINK but buyer's intial balance was `+
            `${buyersLinkBefore} LINK and now is ${buyersLinkAfter} LINK.`
        )
    })

    //The ETH balance of the buyer (and seller) should decrease (and increase) with the filled amount
    it("should update the ETH balances of the token buyer & seller with the filled total price", async () => {

        //SETUP: Add sell orders to the orderbook
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side
            400,    //price 
            15,     //amount
            {from: accounts[1]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side 
            300,    //price  
            5,      //amount
            {from: accounts[2]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side 
            500,    //price  
            10,     //amount
            {from: accounts[3]}
        )
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )

        assert.equal(
            sellOrderBook.length, 
            3,
            `SETUP: Expected 3 sell-side orders in order book, but it has `+
            `${sellOrderBook.length} orders in it!`
        )

        // Get initial ETH balance of buyer and seller  
        const buyersWeiBefore = await dex.getBalance(
            accounts[0], 
            web3.utils.utf8ToHex("ETH")
        )
        const firstSellersWeiBefore = await dex.getBalance(
            accounts[2], 
            web3.utils.utf8ToHex("ETH")
        )
        const secondSellersWeiBefore = await dex.getBalance(
            accounts[1],
            web3.utils.utf8ToHex("ETH")
        )

        // CHECK SETUP: Buyer has enough ETH for the purchase (3,500Wei)?
        assert.equal(
            Number(buyersWeiBefore) >= 3500,
            true,
            `SETUP: Buyer has ${buyersWeiBefore} Wei, but needs 3,500 Wei!`
        )

        //TEST: Buy from sell-side Orderbook : 
        //          5xLINK @ 300 = 1500Wei, 5xLINK @ 400 = 2000Wei
        //          Total 10xLINK, for 3,500 Wei
        await truffleAssert.passes(
            dex.createMarketOrder(
                web3.utils.utf8ToHex("LINK"),
                0,   //Buy-side
                10,  //amount
                {from: accounts[0]}
            ),
            "Create Market Order failed for unknown reason!"
        )

        //POST-TEST CHECK: Sell-side orderbook (after buy order fill) contains
        //         the remaining sell orders: 10xLINK @ 400, 10xLINK @ 500 ?
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            2, 
            `POST-TEST: Expected 2 sell-side orders in order book, but it has `+
            `${sellOrderBook.length} orders in it!`
        )
        assert.equal(
            sellOrderBook[0].price, 
            400,
            `POST-TEST: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount, 
            15, 
            `POST-TEST: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            5, 
            `POST-TEST: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )
        assert.equal(
            sellOrderBook[1].price, 
            500, 
            `POST-TEST: Unexpected sellOrderBook[1].price: `+
            `${sellOrderBook[1].price}`
        )
        assert.equal(
            sellOrderBook[1].amount, 
            10, 
            `POST-TEST: Unexpected sellOrderBook[1].amount: `+
            `${sellOrderBook[1].amount}`
        )
        assert.equal(
            sellOrderBook[1].filled, 
            0, 
            `POST-TEST: Unexpected sellOrderBook[1].filled: `+
            `${sellOrderBook[1].filled}`
        )

        //POST-TEST CHECK: Buyer's and seller's ETH balances correctly updated?
        const buyersWeiAfter = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("ETH")
        )
        const firstSellersWeiAfter = await dex.getBalance(
            accounts[2], 
            web3.utils.utf8ToHex("ETH")
        )
        const secondSellersWeiAfter = await dex.getBalance(
            accounts[1],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWeiBefore), 
            Number(buyersWeiAfter)+3500,
            `POST-TEST: Bought 10 LINK for 3,500 Wei but intial balance was `+
            `${buyersWeiBefore} Wei and now is ${buyersWeiAfter} Wei.`
        )
        assert.equal(
            Number(firstSellersWeiBefore)+1500, 
            Number(firstSellersWeiAfter),
            `POST-TEST: Sold 5 LINK for 1,500 Wei but intial balance was `+
            `${firstSellersWeiBefore} and now is ${firstSellersWeiAfter} Wei`
        )

        assert.equal(
            Number(secondSellersWeiBefore)+2000, Number(secondSellersWeiAfter),
            `POST-TEST: Should have sold 5 LINK for 2,000 Wei but intial balance was `+
            `${secondSellersWeiBefore} Wei and now is ${secondSellersWeiAfter} Wei`
        )
    })

    //The token balances of limit order sellers and buyers should updated with filled amounts.
    it("should correctly update sellers & buyers token balance when limit order is filled", async () => {

        //CHECK SETUP: Confirm current number of orders in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            2, 
            `SETUP: Expected 2 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        //SETUP: Add to the sell-side order book
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,      //Sell-side
            400,    //price
            5,      //amount
            {from: accounts[1]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,      //Sell-side
            300,    //price
            5,      //amount
            {from: accounts[2]}
        )
 
        //CHECK SETUP: Sell-side orderbook contains expected orders:
        //        5xLINK @ 300, 10xLINK @ 400, 5xLINK @ 400, 10xLINK @ 500 
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"),
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            4,
            `SETUP: Expected 4 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )
        assert.equal(
            sellOrderBook[0].price,
            300, 
            `SETUP: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount,
            5, 
            `SETUP: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled,
            0, 
            `SETUP: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )
        assert.equal(
            sellOrderBook[1].price, 
            400, 
            `SETUP: Unexpected sellOrderBook[1].price: `+
            `${sellOrderBook[1].price}`
        )
        assert.equal(
            sellOrderBook[1].amount, 
            15, 
            `SETUP: Unexpected sellOrderBook[1].amount: `+
            `${sellOrderBook[1].amount}`
        )
        assert.equal(
            sellOrderBook[1].filled,
            5, 
            `SETUP: Unexpected sellOrderBook[1].filled: `+
            `${sellOrderBook[1].filled}`
        )
        assert.equal(
            sellOrderBook[2].price, 
            400, 
            `SETUP: Unexpected sellOrderBook[2].price: `+
            `${sellOrderBook[2].price}`
        )
        assert.equal(
            sellOrderBook[2].amount,
            5, 
            `SETUP: Unexpected sellOrderBook[2].amount: `+
            `${sellOrderBook[2].amount}`
        )
        assert.equal(
            sellOrderBook[2].filled,
            0, 
            `SETUP: Unexpected sellOrderBook[2].filled: `+
            `${sellOrderBook[2].filled}`
        )
        assert.equal(
            sellOrderBook[3].price,
            500, 
            `SETUP: Unexpected sellOrderBook[3].price: `+
            `${sellOrderBook[3].price}`
        )
        assert.equal(
            sellOrderBook[3].amount, 
            10, 
            `SETUP: Unexpected sellOrderBook[3].amount: `+
            `${sellOrderBook[3].amount}`
        )
        assert.equal(
            sellOrderBook[3].filled,
            0, 
            `SETUP: Unexpected sellOrderBook[3].filled: `+
            `${sellOrderBook[3].filled}`
        )
       
        //CHECK: Starting LINK balance of buyer & seller(s)   
        const buyersLinkBefore = await dex.getBalance(
            accounts[3], 
            web3.utils.utf8ToHex("LINK")
        )
        const firstSellersLinkBefore = await dex.getBalance(
            sellOrderBook[0].trader, 
            web3.utils.utf8ToHex("LINK")
        )
        const secondSellersLinkBefore = await dex.getBalance(
            sellOrderBook[1].trader, 
            web3.utils.utf8ToHex("LINK")
        )

        // CHECK SETUP: Buyer has enough ETH for purchase (3,500Wei)?
        // (Required == 5*300 + 5*400 = 1500 + 2000 = 3,500)
        const buyersWei = await dex.getBalance(
            accounts[3],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWei) >= 3500,
            true,
            `SETUP: Buyer has ${buyersWei} Wei, but needs 12,500 Wei!`
        )

        //TEST: Create buy market order (to fill 1.5 sell-side limit orders)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               10,  //amount
               {from: accounts[3]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )

        //POST-TEST CHECK: Seller's and buyer's LINK balances correctly updated?
        const buyersLinkAfter = await dex.getBalance(
            accounts[3], 
            web3.utils.utf8ToHex("LINK")
        )
        const firstSellersLinkAfter = await dex.getBalance(
            sellOrderBook[0].trader,
            web3.utils.utf8ToHex("LINK")
        )
        const secondSellersLinkAfter = await dex.getBalance(
            sellOrderBook[1].trader, 
            web3.utils.utf8ToHex("LINK")
        )
        assert.equal(
            Number(buyersLinkBefore)+10, 
            Number(buyersLinkAfter),
            `POST-TEST: Bought 5 LINK but buyer's intial balance was `+
            `${buyersLinkBefore} LINK and is now ${buyersLinkAfter} LINK.`
        )
        assert.equal(
            Number(firstSellersLinkBefore), 
            Number(firstSellersLinkAfter)+5,
            `POST-TEST: First seller sold 5 LINK but their intial balance was `+
            `${firstSellersLinkBefore} LINK and is now ${firstSellersLinkAfter} LINK.`
        )
        assert.equal(
            Number(secondSellersLinkBefore),
            Number(secondSellersLinkAfter)+5,
            `POST-TEST: Second seller sold 5 LINK (of 10 for sale) but their intial balance `+
            `was ${secondSellersLinkBefore} LINK and is now ${secondSellersLinkAfter} LINK.`
        )
    })

    //Filled (BUY & SELL) limit orders should be removed from the orderbook
    it("should remove filled limit orders from the order book ", async () => {

        //SETUP CHECK: Confirm expected number of orders in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            3, 
            `SETUP: Expected 3 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        //SETUP: Add limit orders to the sell-side order book
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side
            400,    //price
            5,      //amount
            {from: accounts[1]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side 
            300,    //price 
            5,      //amount 
            {from: accounts[2]}
        )

        //CHECK SETUP: Sell-side orderbook contains expected orders:
        //        5xLINK @ 300, 10xLINK @ 400, 5xLINK @ 400, 10xLINK @ 500 
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            5,
            `SETUP: Expected 5 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        assert.equal(
            sellOrderBook[0].price, 
            300, 
            `SETUP: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount,
            5, 
            `SETUP: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            0, 
            `SETUP: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )

        assert.equal(
            sellOrderBook[1].price, 
            400, 
            `SETUP: Unexpected sellOrderBook[1].price: `+
            `${sellOrderBook[1].price}`
        )
        assert.equal(
            sellOrderBook[1].amount, 
            15, 
            `SETUP: Unexpected sellOrderBook[1].amount: `+
            `${sellOrderBook[1].amount}`
        )
        assert.equal(
            sellOrderBook[1].filled, 
            10, 
            `SETUP: Unexpected sellOrderBook[1].filled: `+
            `${sellOrderBook[1].filled}`
        )

        assert.equal(
            sellOrderBook[2].price,
            400, 
            `SETUP: Unexpected sellOrderBook[2].price: `+
            `${sellOrderBook[2].price}`
        )
        assert.equal(
            sellOrderBook[2].amount,
            5, 
            `SETUP: Unexpected sellOrderBook[2].amount: `+
            `${sellOrderBook[2].amount}`
        )
        assert.equal(
            sellOrderBook[2].filled, 
            0, 
            `SETUP-TEST: Unexpected sellOrderBook[2].filled: `+
            `${sellOrderBook[2].filled}`
        )

        assert.equal(
            sellOrderBook[3].price, 
            400, 
            `SETUP: Unexpected sellOrderBook[3].price: `+
            `${sellOrderBook[3].price}`
        )
        assert.equal(
            sellOrderBook[3].amount,
            5, 
            `SETUP: Unexpected sellOrderBook[3].amount: `+
            `${sellOrderBook[3].amount}`
        )
        assert.equal(
            sellOrderBook[3].filled, 
            0, 
            `SETUP: Unexpected sellOrderBook[3].filled: `+
            `${sellOrderBook[3].filled}`
        )

        assert.equal(
            sellOrderBook[4].price, 
            500, 
            `SETUP: Unexpected sellOrderBook[4].price: `+
            `${sellOrderBook[4].price}`
        )
        assert.equal(
            sellOrderBook[4].amount,
            10, 
            `SETUP: Unexpected sellOrderBook[4].amount: `+
            `${sellOrderBook[4].amount}`
        )
        assert.equal(
            sellOrderBook[4].filled, 
            0, 
            `SETUP: Unexpected sellOrderBook[4].filled: `+
            `${sellOrderBook[4].filled}`
        )
       
        //TEST: Create buy market order (to fill 1 sell-side limit order)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               5,   //amount
               {from: accounts[1]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )

        //POST-TEST CHECK: Confirm expected number of orders in sell-side orderbook
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            4,
            `POST-TEST: Expected 4 remaining sell-side orders, but `+
            `order book has ${sellOrderBook.length} orders in it!`
        )

        //TEST: Create buy market order (which should fill three sell-side limit orders)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               20,  //amount
               {from: accounts[1]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )

        //POST-TEST CHECK: Confirm expected single order remains in sell-side orderbook
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            1, 
            `POST-TEST: Expected single remaining sell-side order, but `+
            `order book has ${sellOrderBook.length} orders in it!`
        )
        assert.equal(
            sellOrderBook[0].price, 
            500, 
            `POST-TEST: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount, 
            10,
            `POST-TEST: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            5, 
            `POST-TEST: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )
    })

    //Partly filled (BUY & SELL) limit orders should be modified to represent the filled/remaining amount
    it("should modify part-filled limit orders to correctly represent the filled/remaining amount after the trade", async () => {

        // CHECK SETUP: Confirm expected single order remains in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length,
            1,
            `SETUP: Expected single sell-side order, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        assert.equal(
            sellOrderBook[0].price, 
            500, 
            `SETUP: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount, 
            10, 
            `SETUP: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            5, 
            `SETUP: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )

        // CHECK SETUP: Buyer has enough ETH for purchase (2,500Wei)?
        // (Required == 4*500 = 2,000)
        const buyersWei = await dex.getBalance(
            accounts[0],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWei) >= 2000,
            true,
            `SETUP: Buyer has ${buyersWei} Wei, but needs 2,000 Wei!`
        )

        //TEST: Create buy market order that will partially fill 1 limit-order
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               4,   //amount
               {from: accounts[0]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )  

        // POST-TEST CHECK: Confirm expected single part-filled limit remains in order book,
        sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            1, 
            `POST-TEST: Expected single sell-side order, but `+
            `order book has ${sellOrderBook.length} orders in it!`
        )

        // POST-TEST CHECK: Confirm part-filled limit order has been updated with the filled amount
        assert.equal(
            sellOrderBook[0].price, 
            500,
            `POST-TEST: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount, 
            10, 
            `POST-TEST: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            9, 
            `POST-TEST: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )
    })

    //When creating a BUY market order, the buyer needs to have enough ETH for the trade.
    it("should throw an error when creating a buy market order with an inadequate ETH balance", async () => {

        //SETUP: Place a large sell limit order into the orderbook
        await link.transfer(accounts[0], 20)
        await link.approve(dex.address, 20, {from: accounts[0]})
        await dex.deposit(
            20,   //amount 
            web3.utils.fromUtf8("LINK"),
            {from: accounts[0]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"), 
            1,      //Sell-side 
            550,    //price 
            20,     //amount 
            {from: accounts[0]}
        )

        //CHECK SETUP: Sell-side orderbook contains expected orders:
        //        1xLINK @ 500, 20xLINK @ 550 
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 
            1   //Sell-side
        )
        assert.equal(
            sellOrderBook.length, 
            2,
            `SETUP: Expected 2 sell-side orders, but order book has `+
            `${sellOrderBook.length} orders in it!`
        )

        assert.equal(
            sellOrderBook[0].price, 
            500, 
            `SETUP: Unexpected sellOrderBook[0].price: `+
            `${sellOrderBook[0].price}`
        )
        assert.equal(
            sellOrderBook[0].amount, 
            10, 
            `SETUP: Unexpected sellOrderBook[0].amount: `+
            `${sellOrderBook[0].amount}`
        )
        assert.equal(
            sellOrderBook[0].filled, 
            9, 
            `SETUP: Unexpected sellOrderBook[0].filled: `+
            `${sellOrderBook[0].filled}`
        )

        assert.equal(
            sellOrderBook[1].price, 
            550, 
            `SETUP: Unexpected sellOrderBook[1].price: `+
            `${sellOrderBook[1].price}`
        )
        assert.equal(
            sellOrderBook[1].amount,
            20, 
            `SETUP: Unexpected sellOrderBook[1].amount: `+
            `${sellOrderBook[1].amount}`
        )
        assert.equal(
            sellOrderBook[1].filled, 
            0, 
            `SETUP: Unexpected sellOrderBook[1].filled: `+
            `${sellOrderBook[1].filled}`
        )

        // CHECK SETUP: Buyer SHOULDN'T have ETH for purchase
        // (Purchase == 1*500 + 20*550 = 500 + 11,000 = 11,500)
        const buyersWei = await dex.getBalance(
            accounts[3],
            web3.utils.utf8ToHex("ETH")
        )
        assert.equal(
            Number(buyersWei) < 11500,
            true,
            `SETUP: Buyer's balance must be less than 11,500 Wei `+
            `but is ${buyersWei} Wei!`
        )

        //TEST: Create buy market order that will cost more than buyer's
        //        DEX ETH balance - to ensure that CreateMarketOrder fails
        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               21,  //amount
               {from: accounts[3]}
           )
        )  
    })

})
