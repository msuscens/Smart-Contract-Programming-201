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
        await dex.depositETH({value: 10000})
    })

    //When creating a market order it must be for a known token
    it("should throw when creating a sell market order for an unknown token", async () => {
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
    it("should throw when creating a sell market order if inadequate tokens have been deposited for the trade", async () => {
        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               1,  //Sell-side
               501,  //amount
               {from: accounts[0]}
            )
        )
    })

    //Market orders (BUY & SELL) can be submitted even if the order book is empty
    //In which case, the MO should fill for 0 tokens, 0 ETH (since orderbook is empty)
    it("should process market orders even when order book is empty", async () => {

        // CHECK: Initial balances
        const linkBefore = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("LINK"))
        const ethInWeiBefore = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("ETH"))

        // CHECK: Order books should be empty (buy & sell side)
        let buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 0)
        assert.equal(buyOrderBook.length, 0, `Expected empty buy-side order `+
            `book, but has ${buyOrderBook.length} orders in it!`)
        let sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 0, `Expected empty sell-side order `+
            `book, but has ${sellOrderBook.length} orders in it!`)

        // ACTION: BUY-SIDE MARKET ORDER (against empty order book)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,  //Buy-side
               10,  //amount
               {from: accounts[0]}
            )
        )

        // CHECK: No tokens have been bought and ETH balance is as before
        // (ie. buy-order has filled for 0 LINK tokens, and for 0 ETH).
        let linkAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("LINK"))
        let ethInWeiAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("ETH"))
        assert.equal(linkBefore, linkAfter, "LINK balance shouldn't have changed!") 
        assert.equal(ethInWeiBefore, ethInWeiAfter, "ETH balance shouldn't have changed!") 
       
        // CHECK: Orderbook is still empty (buy & sell side)
        buyOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 0)
        assert.equal(buyOrderBook.length, 0, `Expected empty buy-side order `+
            `book, but has ${buyOrderBook.length} orders in it!`)
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 0, `Expected empty sell-side order `+
            `book, but has ${sellOrderBook.length} orders in it!`)

        // ACTION: Sell-side Market Order (against an empty buy-side order book)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               1,  //Sell-side
               10,  //amount
               {from: accounts[0]}
           )
        )

        // CHECK: No tokens have been sold and sellers ETH balance is as before
        // (ie. sell-order has filled for 0 LINK tokens, and for 0 ETH).
        linkAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("LINK"))
        ethInWeiAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("ETH"))
        asset.equal(linkBefore, linkAfter, `LINK balance shouldn't have changed!`) 
        asset.equal(ethInWeiBefore, ethInWeiAfter, `ETH balance shouldn't have changed!`) 
       
        buyOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 0)
        assert.equal( buyOrderBook.length, 0, `Expected empty buy-side order `+
            `book, but has ${buyOrderBook.length} orders in it!`)
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 0, `Expected empty sell-side order `+
            `book, but has ${sellOrderBook.length} orders in it!`)

        
        // Check that 10 tokens haven't been sold and ETH balance still the same
        // (ie. sell order fullfilled for 0 tokens)

        // QUESTION / DILEMA
        // How to fullfill when order book is empty but 2 market orders - 
        // one buy, one sell are submitted ?
        // i.e There are no limit orders (with a price) in the order book
        // to fullfill either order but both could potentailly be filled
        // against each other!
        //
        // Possibly fill these 2 MO's against each other but at what price?:
        //
        //  Sell-side Market Order filled at 0 price, since that's the lowest
        // price a buyer could create a limit order (with an empty buy-side
        // order book and have the order fullfiled)
        //  However similar argument for fullfiling at a very high price!
        // (i.e buyer could create a limit order at a very high price,
        //  especially if they've noticed an empty/almost empty sell-side
        //  order book.)
        //
        // Perhaps instead: Both MOs (one buy the other sell) sit in the
        // order book and are only filled when a limit-order arrives into 
        // the order book (ie. a sell-side market order will NOT fill 
        // against a buy-side market-order and vica versa! 
        //
        // BEST solution: Each MO is created but imediatlely tries to fill
        // which results in the MO completing but with no token bought/sold.

    })

    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("should not fill more limit orders amounts than the market order amount", async () => {

        // CHECK: Sell-side orderbook is empty
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 0, `Expected an empty sell-side `+
            `orderbook, but it has ${sellOrderBook.length} orders in it!`)

        //SETUP: Create a populated order book from other (user) accounts
        await link.transfer(accounts[1], 100)
        await link.transfer(accounts[2], 100)
        await link.transfer(accounts[3], 100)
        //SETUP: Approve DEX for accounts 1, 2, 3
        await link.approve(dex.address, 80, {from: accounts[1]});
        await link.approve(dex.address, 80, {from: accounts[2]});
        await link.approve(dex.address, 80, {from: accounts[3]});
        //SETUP: Deposit LINK into DEX for accounts 1, 2, 3
        await dex.deposit(80, web3.utils.fromUtf8("LINK"), {from: accounts[1]});
        await dex.deposit(80, web3.utils.fromUtf8("LINK"), {from: accounts[2]});
        await dex.deposit(80, web3.utils.fromUtf8("LINK"), {from: accounts[3]});
        //SETUP: Add sell limit orders to order book
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 15, 400, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1,  5, 300, {from: accounts[2]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 10, 500, {from: accounts[3]})

        // CHECK: Sell-side orderbook contains newly created limit orders
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 3, `Expected three sell-side `+
            `orders, but it has ${sellOrderBook.length} orders in it!`)

        // ACTION: Place Market Order  
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,  //Buy-side
               20,  //amount
               {from: accounts[0]}
            )
        )

        // CHECK: Expected number of sell orders remain in orderbook
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert(sellOrderBook.length == 1, `Expected one remaining sell-side `+
            `order, but it has ${sellOrderBook.length} orders in it!`)
    })

    //Market orders should be filled until the order book is empty or the market order is 100% filled
    it("should fill market orders until the order book is empty", async () => {

        // CHECK: Sell-side orderbook contains 1 order
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 1, `Should be one remaining sell-side `+
            `order, but it has ${sellOrderBook.length} orders in it!`)

        //SETUP: Add further sell orders to the order book
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 15, 400, {from: accounts[1]})
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"),  5, 300, {from: accounts[2]})
    
        // CHECK: Sell-side orderbook now contains number of expected orders
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 3, `Expected three sell-side orders, `+
            `but it has ${sellOrderBook.length} orders in it!`)

        // ACTION: Place buy Market Order that will fill all sell orders in the orderbook
        // (Note: Should be total of 30 LINK in sell-side order book)
        await truffleAssert.passes(
            dex.createMarketOrder(
                web3.utils.utf8ToHex("LINK"),
                0,  //Buy-side
                35, //amount - NB. More than total of sell limit orders in orderbook
                {from: accounts[0]}
            )
        )

        // CHECK: Sell-side orderbook is empty
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 0, `Expected an empty sell-side `+
            `orderbook, but it has ${sellOrderBook.length} orders in it!`)
    })

    //The ETH balance of the buyer (and seller) should decrease (and increase) with the filled amount
    it("should update the ETH balances of the token buyer & seller with the filled total price", async () => {

        // SETUP: Add sell orders to the orderbook
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 15, 400, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1,  5, 300, {from: accounts[2]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 10, 500, {from: accounts[3]})
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 3, `Expected three sell-side `+
            `orders, but it has ${sellOrderBook.length} orders in it!`)

        // CHECK: Starting ETH balance of buyer and seller  
        const buyersWeiBefore = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("ETH"))
        const firstSellersWeiBefore = await dex.getBalance(accounts[2], web3.utils.utf8ToHex("ETH"))
        const secondSellersWeiBefore = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("ETH"))

        // ACTION: Buy from sell-side Orderbook : 
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

        // CHECK: Sell-side orderbook (after buy order fill) 
        //        contains remaining sell orders: 10xLINK @ 400, 10xLINK @ 500 
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 2, `Expected two sell-side `+
            `orders, but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 400, `Unexpected sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount, 10, `Unexpected sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
        assert.equal(sellOrderBook[1].price, 500, `Unexpected sellOrderBook[1].price: ${sellOrderBook[1].price}`)
        assert.equal(sellOrderBook[1].amount, 10, `Unexpected sellOrderBook[1].amount: ${sellOrderBook[1].amount}`)

        // CHECK: Buyer's and seller's ETH balances have been correctly updated
        const buyersWeiAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("ETH"))
        const firstSellersWeiAfter = await dex.getBalance(accounts[2], web3.utils.utf8ToHex("ETH"))
        const secondSellersWeiAfter = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("ETH"))
        assert.equal(buyersWeiBefore, buyersWeiAfter + 3500,
            `Should have bought 10 LINK for 3,500 Wei but intial balance was `+
            `${ethInWeiBefore} Wei and now is ${ethInWeiAfter} Wei.`)
        assert.equal(firstSellersWeiBefore+1500, firstSellersWeiAfter,
            `Should have sold 5 LINK for 1,500 Wei but intial balance was `+
            `${firstSellersWeiBefore} Wei and now is ${firstSellersWeiAfter} Wei.`)
        assert.equal(secondSellersWeiBefore+2000, secondSellersWeiAfter,
            `Should have sold 5 LINK for 2,000 Wei but intial balance was `+
            `${secondSellersWeiBefore} Wei and now is ${secondSellersWeiAfter} Wei.`)
    })

    //The token balances of limit order sellers and buyers should updated with filled amounts.
    it("should correctly update sellers & buyers token balance when limit order is filled", async () => {

        // CHECK: Confirm current number of orders in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length,  0, `Expected an empty sell-side `+
            `orderbook, but it has ${sellOrderBook.length} orders in it!`)

        // SETUP: Add to the sell-side order book
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 400, {from: accounts[1]})
        await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), 1, 5, 300, {from: accounts[2]})
 
        // CHECK SETUP: Sell-side orderbook contains expected orders:
        //        5xLINK @ 300, 10xLINK @ 400, 5xLINK @ 400, 10xLINK @ 500 
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 4, `Expected four sell-side `+
            `orders, but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 300, `Unexpected sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount,  5, `Unexpected sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
        assert.equal(sellOrderBook[1].price, 400, `Unexpected sellOrderBook[1].price: ${sellOrderBook[1].price}`)
        assert.equal(sellOrderBook[1].amount, 10, `Unexpected sellOrderBook[1].amount: ${sellOrderBook[1].amount}`)
        assert.equal(sellOrderBook[2].price, 400, `Unexpected sellOrderBook[2].price: ${sellOrderBook[2].price}`)
        assert.equal(sellOrderBook[2].amount,  5, `Unexpected sellOrderBook[2].amount: ${sellOrderBook[2].amount}`)
        assert.equal(sellOrderBook[3].price, 500, `Unexpected sellOrderBook[3].price: ${sellOrderBook[3].price}`)
        assert.equal(sellOrderBook[3].amount, 10, `Unexpected sellOrderBook[3].amount: ${sellOrderBook[3].amount}`)
       
        // CHECK: Starting LINK balance of seller(s) and buyer   
        const buyersLinkBefore = await dex.getBalance(accounts[3], web3.utils.utf8ToHex("LINK"))
        const firstSellersLinkBefore = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("LINK"))
        const secondSellersLinkBefore = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("LINK"))

        //ACTION: Create buy market order (which will be fullfiled from sell-side orderbook)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               10,   //amount
               {from: accounts[1]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )

        // CHECK: Seller's and buyer's LINK balances have been correctly updated
        const buyersLinkAfter = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("LINK"))
        const firstSellersLinkAfter = await dex.getBalance(accounts[0], web3.utils.utf8ToHex("LINK"))
        const secondSellersLinkAfter = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("LINK"))
        assert.equal(buyersLinkBefore+10, buyersLinkAfter,
            `Should have bought 5 LINK but buyer's intial balance was `+
            `${buyersLinkBefore} LINK and now is ${buyersLinkAfter} LINK.`)
        assert.equal(firstSellersLinkAfter, firstSellersLinkAfter+5,
            `First seller should have sold 5 LINK but their intial balance was `+
            `${firstSellersLinkBefore} LINK and now is ${firstSellersLinkAfter} LINK.`)
        assert.equal(secondSellersLinkAfter, secondSellersLinkAfter+5,
            `Second seller should have sold 5 LINK (of 10 for sale) but their intial balance `+
            `was ${secondSellersLinkBefore} LINK and now is ${secondSellersLinkAfter} LINK.`)
    })

    //Filled (BUY & SELL) limit orders should be removed from the orderbook
    it("should remove filled limit orders from the order book ", async () => {

        // CHECK: Confirm expected number of orders in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 3, `Expected three sell-side orders `+
            `in orderbook, but it has ${sellOrderBook.length} orders in it!`)

        // SETUP: Add to the sell-side order book
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 400, {from: accounts[1]})
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300, {from: accounts[2]})

        // CHECK SETUP: Sell-side orderbook contains expected orders:
        //        5xLINK @ 300, 10xLINK @ 400, 5xLINK @ 400, 10xLINK @ 500 
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 5, `Expected five sell-side orders, `+
            `but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 300, `Unexpected sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount,  5, `Unexpected sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
        assert.equal(sellOrderBook[1].price, 400, `Unexpected sellOrderBook[1].price: ${sellOrderBook[1].price}`)
        assert.equal(sellOrderBook[1].amount, 10, `Unexpected sellOrderBook[1].amount: ${sellOrderBook[1].amount}`)
        assert.equal(sellOrderBook[2].price, 400, `Unexpected sellOrderBook[2].price: ${sellOrderBook[2].price}`)
        assert.equal(sellOrderBook[2].amount,  5, `Unexpected sellOrderBook[2].amount: ${sellOrderBook[2].amount}`)
        assert.equal(sellOrderBook[3].price, 400, `Unexpected sellOrderBook[3].price: ${sellOrderBook[3].price}`)
        assert.equal(sellOrderBook[3].amount,  5, `Unexpected sellOrderBook[3].amount: ${sellOrderBook[3].amount}`)
        assert.equal(sellOrderBook[4].price, 500, `Unexpected sellOrderBook[4].price: ${sellOrderBook[4].price}`)
        assert.equal(sellOrderBook[4].amount, 10, `Unexpected sellOrderBook[4].amount: ${sellOrderBook[4].amount}`)
       
        //ACTION: Create buy market order (which should fill one sell-side limit order)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               5,   //amount
               {from: accounts[1]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )
        // CHECK: Confirm expected number of orders in sell-side orderbook
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 4, `Expected four remaining sell-side `+
            `orders in orderbook, but it has ${sellOrderBook.length} orders in it!`)

        //ACTION: Create buy market order (which should fill three sell-side limit orders)
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               20,   //amount
               {from: accounts[1]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )        
        // CHECK: Confirm expected single order remians in sell-side orderbook
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 1, `Expected single remaining sell-side `+
            `order in orderbook, but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 500, `Unexpected order - sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount, 10, `Unexpected order - sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
    })

    //Partly filled (BUY & SELL) limit orders should be modified to represent the filled/remaining amount
    it("should modify part-filled limit orders to correctly represent the filled/remaining amount after the trade", async () => {

        // CHECK: Confirm expected single order remians in sell-side orderbook
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 1, `Expected single sell-side order `+
            `in orderbook, but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 500, `Unexpected order - sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount, 10, `Unexpected order - sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)

        //ACTION: Create buy market order that will only partially fill a (sell) limit-order
        await truffleAssert.passes(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               5,   //amount
               {from: accounts[0]}
           ),
           "Create Buy Limit Order failed for unknown reason!"
        )  
        // CHECK: Confirm expected single (sell-side) limit order still remains,
        // with amount of tokens (in that sell limit-order) reduced from 10 to 5
        sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 1, `Expected single sell-side order `+
            `in orderbook, but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price, 500, `Unexpected sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount, 5, `Unexpected sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
    })

    //When creating a BUY market order, the buyer needs to have enough ETH for the trade.
    it("should throw an error when creating a buy market order without an adequate ETH balance", async () => {

        // SETUP: Prepare account with enough LINK (ready for placing a large sell order)
        await link.transfer(accounts[0], 1000)
        await link.approve(dex.address, 1000, {from: accounts[0]});
        await dex.deposit(100, web3.utils.fromUtf8("LINK"), {from: accounts[0]});

        // SETUP: Place a large sell limit order into the orderbook
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1000, 499, {from: accounts[0]})

        // CHECK SETUP: Sell-side orderbook contains expected orders:
        //        1000xLINK @ 499, 5xLINK @ 500 
        let sellOrderBook = await dex.getOrderBook(web3.utils.utf8ToHex("LINK"), 1)
        assert.equal(sellOrderBook.length, 2, `Expected two sell-side orders, `+
            `but it has ${sellOrderBook.length} orders in it!`)
        assert.equal(sellOrderBook[0].price,   499, `Unexpected sellOrderBook[0].price: ${sellOrderBook[0].price}`)
        assert.equal(sellOrderBook[0].amount, 1000, `Unexpected sellOrderBook[0].amount: ${sellOrderBook[0].amount}`)
        assert.equal(sellOrderBook[1].price,   500, `Unexpected sellOrderBook[1].price: ${sellOrderBook[1].price}`)
        assert.equal(sellOrderBook[1].amount,    5, `Unexpected sellOrderBook[1].amount: ${sellOrderBook[1].amount}`)

        // CHECK: Hopeful buyer doesn't have enough ETH for such a large buy
        const weiBalance = await dex.getBalance(accounts[1], web3.utils.utf8ToHex("ETH"))
        assert(weiBalance < 5000*499, "Buyer needs less ETH for this test to be performed!")

        //ACTION: Create buy market order that will cost more than buyer's
        //        DEX ETH balance - to ensure that CreateMarketOrder fails
        await truffleAssert.reverts(
            dex.createMarketOrder(
               web3.utils.utf8ToHex("LINK"),
               0,    //Buy-side
               5000, //amount
               {from: accounts[1]}
           ),
           "Should not be able to Create Market Order with insufficeint ETH for buy!"
        )  

    })

        // *** TODO: CHECK ETH BALANCES - PERHAPS IN PREVIOUS TEST CASE OR A NEW ONE!
        // *** Q. WHAT HAPPENS IF A BUY LIMIT ORDER IS CREATED AT A PRICE THAT IS HIGHER THAN
        // *** THE LOWEST SELL-ORDER IN THE ORDERBOOK?  IE. At what price is the order filled?
        // ***  - At the seller's lower price, or the buyer's higher price???
        // ***  AND also if the situation is reversed, ie. sell limit order created at a price
        // ***  lower than the lowest buy-order in the orderbook.
        // *** Is the newly requested limit orders actually created as a Market Order???


})
