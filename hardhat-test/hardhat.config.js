require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "sepolia",
  solidity: "0.8.27",
    networks: {
      sepolia: {
		chainId: 11155111,
        url: `https://rpc2.sepolia.org`,
      },
	}
};

//        accounts: [GOERLI_PRIVATE_KEY],
