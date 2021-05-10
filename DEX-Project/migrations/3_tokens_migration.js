const LinkMock = artifacts.require("LinkMock")

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(LinkMock)
}