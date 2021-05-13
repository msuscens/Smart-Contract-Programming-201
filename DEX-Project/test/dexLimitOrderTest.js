const Dex = artifacts.require("Dex")
const LinkMock = artifacts.require("LinkMock")
const truffleAssert = require('truffle-assertions')

contract.skip("Dex", accounts => {

    let dex, link

    before(async function() {
        dex = await Dex.deployed()
        link = await LinkMock.deployed()

        await dex.addToken(
            web3.utils.utf8ToHex("LINK"),link.address, {from: accounts[0]}
        )
    })

    // The user must have ETH deposited such that deposited ETH >= buy order value
    it("should have required ETH deposited in users account for the buy order", async () => {

        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("LINK"),
               0,  //Buy-side
               1,  //price
               1,  //amount
               {from: accounts[0]}
            ),
            "Not enough ETH on deposit!"
       )

        await dex.depositETH({value: 100})

        // Attempt to create buy-side limit order with too little ETH deposited
        await truffleAssert.reverts(
            dex.createLimitOrder(
                web3.utils.utf8ToHex("LINK"),
                0,    //Buy-side
                101,  //price
                1,    //amount
                {from: accounts[0]}
            ),
            "Not enough ETH on deposit!"
        )

        // Attempt to create buy-side limit order with to little ETH deposited given amount tokens required
        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               10,  //price
               11,  //amount
               {from: accounts[0]}
           ),
           "Not enough ETH on deposit!"
        )

        await truffleAssert.passes(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("LINK"),
               0,   //Buy-side
               10,  //price
               10,  //amount
               {from: accounts[0]}
           ),
           "Enough ETH deposited but failed for unknown reason!"
        )
    })

    // The user must have enough tokens deposited such that token balance >= sell order amount
    it("should have required tokens deposited in the users account for the sell order", async () => {

        // Attempt to create sell-side limit order despite not having the tokens to sell!"
        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("LINK"),
               1,  //Sell-side
               10, //price
               8,  //amount
               {from: accounts[0]}
            ),
            "Too few tokens for sell order!"
        )

        await link.approve(dex.address, 100)
        await dex.deposit(100, web3.utils.utf8ToHex("LINK"))
        await truffleAssert.passes(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("LINK"),
               1,   //Sell-side
               13,  //price
               100, //amount
               {from: accounts[0]}
            ),
            "Has the tokens to sell but limit order creation still failed!"
        )
    })

    // The BUY order book should be ordered on price from highest to lowest (starting at index 0)
    it("should have BUY order book ordered on price from highest to lowest (starting at index 0)", async () => {

        await dex.depositETH({value: 1000})

        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            0,   //Buy-side
            10,  //price
            20,  //amount
            {from: accounts[0]}
        )
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            0,   //Buy-side
            12,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            0,   //Buy-side
            11,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            0,   //Buy-side
            9,  //price
            20,  //amount
            {from: accounts[0]}
        )     

        const buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"),
            0  //Buy-side
        )
        assert(
            buyOrderBook.length >= 4,
            `Expected 4+ orders in buy-side order book, but there are ${buyOrderBook.length}!`
        )

        // Check buy orderbook prices are ordered highest to lowest (starting at index 0)
        for (let i=1; i<buyOrderBook.length-1; i++){
            assert(Number(buyOrderBook[i-1].price) >= Number(buyOrderBook[i].price),
                `Buy order ${i-1}'s price (${buyOrderBook[i-1].price}) ` +
                `is not >= buy order ${i}'s price (${buyOrderBook[i].price})`                
            )
        }
    })

    // The SELL order book should be ordered on price from lowest to highest (starting at index 0)
    it("should have SELL order book ordered on price from lowest to highest (starting at index 0)", async () => {

        await link.approve(dex.address, 80)
        await dex.deposit(80, web3.utils.utf8ToHex("LINK"))

        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            1,   //Sell-side
            10,  //price
            20,  //amount
            {from: accounts[0]}
        )
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            1,   //Sell-side
            12,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            1,   //Sell-side
            11,  //price
            20,  //amount
            {from: accounts[0]}
        ) 
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            1,   //Sell-side
            9,  //price
            20,  //amount
            {from: accounts[0]}
        ) 

        const sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"),
            1  //Sell-side
        )
        assert(
            sellOrderBook.length >= 4,
            `Expected 4+ orders in sell-side order book, but there are ${sellOrderBook.length}!`
        )

        // Check sell orderbook prices are ordered lowest to highest (starting at index 0)
        for (let i=1; i<sellOrderBook.length-1; i++){
            assert(
                Number(sellOrderBook[i-1].price) <= Number(sellOrderBook[i].price),
                `Sell order ${i-1}'s price (${sellOrderBook[i-1].price}) ` +
                `is not <= sell order ${i}'s price (${sellOrderBook[i].price})`                
            )
        }
    })

    // The order can only be placed for a token known to the DEX
    it("shouldn't accept orders for unknown tokens", async () => {

        await dex.depositETH({value: 80})
        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("AAVE"),
               0,  //Buy-side
               10, //price
               8,  //amount
               {from: accounts[0]}
           )
        )

        await truffleAssert.reverts(
            dex.createLimitOrder(
               web3.utils.utf8ToHex("AAVE"),
               1,  //Sell-side
               10, //price
               8,  //amount
               {from: accounts[0]}
           )
        )

        await link.approve(dex.address, 10)
        await dex.deposit(10, web3.utils.utf8ToHex("LINK"))
        await truffleAssert.passes(
            dex.createLimitOrder(
                web3.utils.utf8ToHex("LINK"),
                1,  //Sell-side
                10, //price
                10   //amount
            ),
            "Known token but failed to create a limit sell-order for unknown reason!"
        )
    })

    // The created buy-side order must contain the correct details
    it("should create buy-side order with the correct details", async () => {

        await dex.depositETH({value: 99})
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            0,  //Buy-side
            1,  //price - set low so it'll be last order in buy-orderbook
            11, //amount
            {from: accounts[0]}
        )
        const buyOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 0  //Buy-side
        )
        const buyOrder = buyOrderBook[buyOrderBook.length-1]

        assert.equal(
            buyOrder.maker, accounts[0],
            "Order's account doesn't match user's account!"
        )
        assert.equal(
            buyOrder.side, 0, //Buy-side
            "Order's side doesn't match user's input of buy-side!"
        )
        assert.equal(
            web3.utils.hexToUtf8(buyOrder.ticker), "LINK",
            "Order's ticker doesn't match user's input ticker!"
        )
        assert.equal(
            buyOrder.price, 1,
            "Order's price doesn't match user's input price!"
        )
        assert.equal(
            buyOrder.amount, 11,
            "Order's token amount doesn't match user's input amount!"
        )
    })

    // The created sell-side order must contain the correct details
    it("should create sell-side order with the correct details", async () => {

        await link.approve(dex.address, 12)
        await dex.deposit(12, web3.utils.utf8ToHex("LINK"))
        await dex.createLimitOrder(
            web3.utils.utf8ToHex("LINK"),
            1,  //Sell-side
            9999, //price - set high so it'll be last order in sell-orderbook
            12, //amount
            {from: accounts[0]}
        )
        const sellOrderBook = await dex.getOrderBook(
            web3.utils.utf8ToHex("LINK"), 1  //Sell-side
        )
        const sellOrder = sellOrderBook[sellOrderBook.length-1]

        assert.equal(
            sellOrder.maker, accounts[0],
            "Order's account doesn't match user's account!"
        )
        assert.equal(
            sellOrder.side, 1, //Sell-side
            "Order's side doesn't match user's input of sell-side!"
        )
        assert.equal(
            web3.utils.hexToUtf8(sellOrder.ticker), "LINK",
            "Order's ticker doesn't match user's input ticker!"
        )
        assert.equal(
            sellOrder.price, 9999,
            "Order's price doesn't match user's input price!"
        )
        assert.equal(
            sellOrder.amount, 12,
            "Order's token amount doesn't match user's input amount!"
        )
    })

})