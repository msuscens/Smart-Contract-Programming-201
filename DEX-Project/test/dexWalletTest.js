const Dex = artifacts.require("Dex")    //Dex is also a wallet
const LinkMock = artifacts.require("LinkMock")
const truffleAssert = require("truffle-assertions")

contract.skip("Dex", accounts => {
    it("should only be possible for owner to add tokens", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()
        await truffleAssert.passes(
            dex.addToken(
                web3.utils.utf8ToHex("LINK"),link.address, {from: accounts[0]}
            )
        )
        await truffleAssert.reverts(
            dex.addToken(
                web3.utils.utf8ToHex("AAVE"),link.address, {from: accounts[1]}
            )
        )
    })
    it("should handle deposits correctly", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()
        await link.approve(dex.address, 500)
        await dex.deposit(100, web3.utils.utf8ToHex("LINK"))
        const linkBalance = await dex.balances(accounts[0], web3.utils.utf8ToHex("LINK"))
        assert.equal(linkBalance, 100)
    })
    it("should handle faulty withdrawals correctly", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()
        await truffleAssert.reverts(
            dex.withdraw(500, web3.utils.utf8ToHex("LINK"))
        )
    })
    it("should handle permitted withdrawals correctly", async () => {
        const dex = await Dex.deployed()
        const link = await LinkMock.deployed()
        await truffleAssert.passes(
            dex.withdraw(100, web3.utils.utf8ToHex("LINK"))
        )
    })
})