const LinkMock = artifacts.require("LinkMock")
const Wallet = artifacts.require("Wallet")

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(LinkMock)
  let wallet = await Wallet.deployed()
  let link = await LinkMock.deployed()
  await link.approve(wallet.address, 500)
  await wallet.addToken(web3.utils.fromUtf8("LINK"),link.address)
  await wallet.deposit(100, web3.utils.fromUtf8("LINK"))
  const linkBalance = await wallet.balances(accounts[0], web3.utils.fromUtf8("LINK"))
  console.log("LINK balance: "+linkBalance)
}