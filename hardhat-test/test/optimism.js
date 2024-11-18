const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");
//const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const config = require('../../config/config.json');

const testToken = config.listeningNetwork.tokens[0];
console.log("");
console.log("From network/token: ", config.listeningNetwork.networkName + "/" + testToken.tokenName);
console.log("To network/token: ", testToken.toNetwork + "/" + testToken.toToken);
console.log("listening Address: ", testToken.listeningAddress);
console.log("Send Token Address: ", testToken.tokenContractAddress);
console.log("Receive Token Address: ", testToken.toTokenContractAddress);

// use the fisrt entry of RPC_URL
const providerSend = new ethers.providers.JsonRpcProvider(config.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
const providerReceive = new ethers.providers.JsonRpcProvider(config.networks[0].RPC_URL); // optimism sepolia
const contractSendTokenAddress = testToken.tokenContractAddress; // sepolia link 0x779877A7B0D9E8603169DdbD7836e478b4624789
const contractReceiveTokenAddress = testToken.toTokenContractAddress; // optimism sepolia link 0xE4aB69C077896252FAFBD49EFD26B5D171A32410

const signerReceive = testToken.listeningAddress; // 0x962aC815B1249027Cfd80D6b0476C9090B5aeF39

const serverAddress = "http://localhost:3000/";

const abi = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
];

const waitingTime = 1000;
const maxTime = 20;

expect(process.env.Sepolia_PRIVATE_KEY, "Invalid private key !").to.be.a.properPrivateKey;
const signer = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);

describe("test Sepolia optimism", function () {
    it("send token", async function () {
		// check if daemon is running
		try {
			await fetch(serverAddress);
		} catch(error) {
			expect(true, "localhost Error, daemon not started !").to.be.false;
		}

		// get and check initial network balance
		signer_balance = await providerSend.getBalance(signer.address);
		signer_receive_balance = await providerReceive.getBalance(signerReceive);

		expect(signer_balance, "Sender Not enough network coins for fees !").to.gt(1);
		expect(signer_receive_balance, "Receiver Not enough network coins for fees !").to.gt(1);

		// get initial token balance
		const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
		const initial_balance_of_emit_token = await contractSend.balanceOf(signer.address);

		const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
		const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

		// check token balances
		expect(initial_balance_of_emit_token, "Sender not enough tokens !").to.gt(10);
		expect(initial_balance_of_receiver, "Receiver not enough tokens !").to.gt(10);

		return;

		// send tokens
		const initial_balance_of_receive_token = await contractReceive.balanceOf(signer.address);

		//await signer.sendTransaction({ to: "0x962aC815B1249027Cfd80D6b0476C9090B5aeF39", value: ethers.utils.parseEther("1.0") }); // Sends exactly 1.0 ether
		const transactionTx = await contractSend.connect(signer).transfer(signerReceive, "1000000000000000000", {gasPrice: 200000000000, gasLimit: 177302});
		await transactionTx.wait(1);
		const new_balance_of_emit_token = await contractSend.balanceOf(signer.address);
		expect(new_balance_of_emit_token).to.lt(initial_balance_of_emit_token);
    
		// wait for exchange or refund
		let new_balance_of_receive_token = 0;
		let i = 0;
		while (true) {
			await sleep(waitingTime);
			new_balance_of_receive_token = await contractReceive.balanceOf(signer.address);
			if (new_balance_of_receive_token !== initial_balance_of_receive_token) break;
			// TODO check refund
			i++;
			if (i > maxTime) break;
		}

		// ok/error
		if (i > maxTime) {
			expect(true, "Error max waiting time !").to.be.false;
		}
		else {
			expect(new_balance_of_receive_token).to.gt(initial_balance_of_receive_token);
		}
	});
});

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}