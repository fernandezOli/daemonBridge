/*
ABI for deamon bridge to call the contract functions
*/

const transferABI = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
    "function decimals() view returns (uint256)"
];

module.exports = transferABI;
