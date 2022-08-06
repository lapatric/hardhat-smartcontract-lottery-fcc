const { network, ethers } = require("hardhat");
const { networkConfig, developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = "1000000000000000000000"; // ethers.utils.parseEther("30"); // can be any amount for mock

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorV2Mock, vrfCoordinatorV2Address, subscriptionId;
    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        // programatically fund subscription to pay for our requests
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait();
        subscriptionId = transactionReceipt.events[0].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        // can be done programatically too, but instead we use Chainlink website to set up subscription
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }    
    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args, // constructor arguments
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // To fix InvalidConsumer() error in VRFCoordinatorV2Mock.sol when calling requestRandomWords
    // we must add the caller (the raffle contract) to the list of consumers under our subscription ID.
    // We (deployer) call performUpkeep in raffle contract but inside performUpkeep raffle contract calls 
    // requestRandomWords from vrfCoordinatorV2 interface.
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address);
    }

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        log("Verifying...");
        await verify(raffle.address, args);
    }
    log("-------------------------------------------------------------------")
}

module.exports.tags = ["all", "raffle"];