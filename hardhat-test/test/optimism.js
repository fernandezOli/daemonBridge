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
console.log("Send Contract Token Address: ", testToken.tokenContractAddress);
console.log("Receive Contract Token Address: ", testToken.toTokenContractAddress);

// use the fisrt entry of RPC_URL
const providerSend = new ethers.providers.JsonRpcProvider(config.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
const providerReceive = new ethers.providers.JsonRpcProvider(config.networks[0].RPC_URLs[0].rpcurl); // optimism sepolia
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
const signerSender = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);

let signer_balance = null;
let signer_receive_balance = null;
let gasPrice = null;

describe("Test Sepolia to Optimism", function () {
	beforeEach(async function () {
		// check if daemon is running
		try {
			await fetch(serverAddress);
		} catch(error) {
			expect(true, "localhost Error, daemon not started !").to.be.false;
		}

		// get and check initial network balance
		signer_balance = await providerSend.getBalance(signerSender.address); // balance In Wei { BigNumber: "37426320346873870455" }
		signer_receive_balance = await providerReceive.getBalance(signerReceive);
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("1.0")))), "Sender Not enough network coins [sepolia] for fees !").to.be.true;
		expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("1.0")))), "Receiver Not enough network coins [optimism sepolia] for fees !").to.be.true;

		//if(gasPrice === null) gasPrice = await providerSend.getGasPrice(); // The gas price (in wei) return BigNumber
		//gasPrice = "400000000000";
		gasPrice = 400000000000;
	});

	describe("-- Test token --", function () {
		it("Test transfert token", async function () {

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);

			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			const amount = ethers.utils.parseEther("2.0");

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(amount)), "Receiver not enough tokens !").to.be.true; //default convert = 1/1

			//return;

			console.log("Sending token ...");
			// send tokens
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			//await hardhatToken.connect(addr1).transfer(addr2.address, 50);
			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount); // gas = 200000000000
			//const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount, { gasPrice: gasPrice, gasLimit: 40000 }); // 200000000000
			console.log("transactionTx: ", transactionTx.hash);
			await transactionTx.wait(1); // error on wait(1) => change rpc_url
			//await providerSend.waitForTransaction(transactionTx.hash, 3);

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "new_balance_of_emit_token unchanged").to.lt(initial_balance_of_emit_token);

			// wait for exchange or refund
			console.log("Waiting ...");
			let new_balance_of_receive_token = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
				if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
				new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
				if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) break;
				i++;
				if (i > maxTime) break;
			}

			// ok/error
			if (i > maxTime) {
				expect(true, "Error max waiting time !").to.be.false;
			}
			else {
				expect(new_balance_of_emit_token, "Refund !!").to.not.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "No token receive !!!").to.gt(initial_balance_of_receive_token);
			}
		});

		xit("Test max token", async function () {
		});

		xit("Test min token", async function () {
		});

		xit("Test minNoRefund token", async function () {
		});
	});
});

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}