
const TOKEN_NAME = "Mark Token";
const TOKEN_SYMBOL = "MKT";
const TOKEN_CAP = 10000;

const MyToken = artifacts.require("MyToken");

module.exports = function (deployer) {
  deployer.deploy(MyToken, TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP);
};