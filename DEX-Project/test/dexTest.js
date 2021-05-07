// The user must have ETH deposited such that deposited ETH >= buy order value
// The user must have enough tokens deposited such that token balance >= sell order amount
// The BUY order book should be ordered on price from highest to lowest (starting at index 0)
// The SELL order book should be ordered on price from lowest to highest (starting at index 0)
// The order can only be placed for a token known to the DEX
// The order created must contain the correct details


const Dex = artifacts.require("Dex")
const LinkMock = artifacts.require("LinkMock")
const truffleAssert = require("truffle-assertions")


contract("Dex", accounts => {
    
    it("should have required ETH deposited in users account for the buy order", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )

        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.fromUtf8("LINK"),
               0,  //Buy-side
               1,  //price
               1,  //amount
               {from: accounts[0]}
            ),
            "Created buy-side limit order without any deposited ETH!"
       )

        await dex.depositETH({value: 100})

        await truffleAssert.reverts(
            dex.createLimitOrder(
                web3.utils.fromUtf8("LINK"),
                0,    //Buy-side
                101,  //price
                1,    //amount
                {from: accounts[0]}
            ),
            "Created buy-side limit order with to few deposited ETH!"
        )
        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.fromUtf8("LINK"),
               0,   //Buy-side
               10,  //price
               11,  //amount
               {from: accounts[0]}
           ),
           "Created buy-side limit order with to few deposited ETH given amount tokens required!"
        )
        await truffleAssert.passes(
            dex.createLimitOrder(
               web3.utils.fromUtf8("LINK"),
               0,   //Buy-side
               10,  //price
               10,  //amount
               {from: accounts[0]}
           ),
           "Enough deposited ETH for limit buy-side order but failed for unknown reason!"
        )

    })

    it("should have required tokens deposited in the users account for the sell order", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )

        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.fromUtf8("LINK"),
               1,  //Sell-side
               10, //price
               8,  //amount
               {from: accounts[0]}
            ),
            "Created sell-side limit order despite not having no tokens to sell!"
        )

        await link.approve(dex.address, 100)
        await dex.deposit(100, web3.utils.fromUtf8("LINK"))
        await truffleAssert.passes(
            dex.createLimitOrder(
               web3.utils.fromUtf8("LINK"),
               1,   //Sell-side
               13,  //price
               100, //amount
               {from: accounts[0]}
            ),
            "Has the tokens to sell but limit order creation still failed!"
        )
    })

    it("should have BUY order book ordered on price from highest to lowest (starting at index 0)", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )

        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            0,   //Buy-side
            10,  //price
            20,  //amount
            {from: accounts[0]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            0,   //Buy-side
            12,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            0,   //Buy-side
            11,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            0,   //Buy-side
            9,  //price
            20,  //amount
            {from: accounts[0]}
        )     

        const buyOrderBook = await dex.getOrderBook(
            web3.utils.fromUtf8("LINK"),
            0  //Buy-side
        )
        assert(
            buyOrderBook.length == 4,
            `Expected 4 orders in buy-side order book, but there are ${buyOrderBook.length}!`
        )
        for (let order=0; order<buyOrderBook.length-1; order++){
            assert(buyOrderBook[order] >= buyOrderBook[order+1]
                `Buy order ${order}'s price (${buyOrderBook[order].price}) is not >= ` +
                `buy order ${order+1}'s price (${buyOrderBook[order+1].price})`                
            )
        }
    })

    it("should have SELL order book ordered on price from lowest to highest (starting at index 0)", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )
        await link.approve(dex.address, 80)
        await dex.deposit(80, web3.utils.fromUtf8("LINK"))

        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,   //Sell-side
            10,  //price
            20,  //amount
            {from: accounts[0]}
        )
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,   //Sell-side
            12,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,   //Sell-side
            11,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,   //Sell-side
            9,  //price
            20,  //amount
            {from: accounts[0]}
        ) 

        const sellOrderBook = await dex.getOrderBook(
            web3.utils.fromUtf8("LINK"),
            1  //Sell-side
        )
        assert(
            sellOrderBook.length == 4,
            `Expected 4 orders in sell-side order book, but there are ${sellOrderBook.length}!`
        )

        for (let order=0; order<sellOrderBook.length-1; order++){
            assert(sellOrderBook[order].price <= sellOrderBook[order+1].price,
                `Sell order ${order}'s price (${sellOrderBook[order].price}) is not <= ` +
                `sell order ${order+1}'s price (${sellOrderBook[order+1].price})`
            )
        }
    })

    it("should only accept orders for known tokens", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
             web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )

        await dex.depositETH({value: 80})
        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.fromUtf8("AAVE"),
               0,  //Buy-side
               10, //price
               8,  //amount
               {from: accounts[0]}
           ),
           "Created buy-side limit order despite not knowing the token!"
        )

         await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.fromUtf8("AAVE"),
               1,  //Sell-side
               10, //price
               8,  //amount
               {from: accounts[0]}
           ),
           "Created sell-side limit order despite not knowing the token!"
        )

        await link.approve(dex.address, 10)
        await dex.deposit(10, web3.utils.fromUtf8("LINK"))
        await truffleAssert.passes(
            dex.createLimitOrder(
                web3.utils.fromUtf8("LINK"),
                1,  //Sell-side
                10, //price
                10   //amount
            ),
            "Known token but failed to create a limit sell-order for unknown reason!"
        )

    })

    it("should create buy and sell orders with the correct details", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.fromUtf8("LINK"),link.address, {from: accounts[0]}
        )

        // Buy-side order
        await dex.depositETH({value: 99})
        const buyOrder = await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            0,  //Buy-side
            9,  //price
            11, //amount
            {from: accounts[0]}
        )
        assert.equal(
            buyOrder.trader,
            accounts[0],
            "Order's account doesn't match user's account!"
        )
        assert.equal(
            buyOrder.side,
            0, //Buy-side
            "Order's side doesn't match user's input of buy-side!"
        )
        assert.equal(
            buyOrder.ticker,
            web3.utils.fromUtf8("LINK"),
            "Order's ticker doesn't match user's input ticker!"
        )
        assert.equal(
            buyOrder.price, 
            9,
            "Order's price doesn't match user's input price!"
        )
        assert.equal(
            buyOrder.amount,
            11,
            "Order's token amount doesn't match user's input amount!"
        )

        // Sell-side order
        await link.approve(dex.address, 12)
        await dex.deposit(12, web3.utils.fromUtf8("LINK"))
        const sellOrder = await dex.createLimitOrder(
            web3.utils.fromUtf8("LINK"),
            1,  //Sell-side
            10, //price
            12, //amount
            {from: accounts[0]}
        )
        assert.equal(
            sellOrder.trader,
            accounts[0],
            "Order's account doesn't match user's account!"
        )
        assert.equal(
            sellOrder.side,
            1, //Sell-side
            "Order's side doesn't match user's input of sell-side!"
        )
        assert.equal(
            sellOrder.ticker,
            web3.utils.fromUtf8("LINK"),
            "Order's ticker doesn't match user's input ticker!"
        )
        assert.equal(
            sellOrder.price, 
            9,
            "Order's price doesn't match user's input price!"
        )
        assert.equal(
            sellOrder.amount,
            11,
            "Order's token amount doesn't match user's input amount!"
        )
    })

})