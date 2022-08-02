const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the cost for the random number request (premium)
const GAS_PRICE_LINK = 1e9 // How much LINK we pay to compensate for the gas payed by the LINK nodes when calling our callbacks. ~ LINK per gas 

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK]; // constructor arguments for deploying VRFCoordinatorV2Mock

    // Only deploy mock if on a local network (which doesn't have VRF contract)
    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // deploy a mock vrfCoordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
            waitConfirmations: network.config.blockConfirmations || 1,
        });
    }
    
    log("Mocks Deployed!");
    log("-------------------------------------------------------------------");
}

module.exports.tags = ["all", "mocks"];