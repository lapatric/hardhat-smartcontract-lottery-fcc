const { ethers } = require("hardhat");

const networkConfig = {
    4: {
        name: "rinkeby",
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId: "10025", // get this from https://vrf.chain.link/rinkeby/10025
        callbackGasLimit: "500000",
        interval: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // not used
        callbackGasLimit: "500000",
        interval: "30",
    },
}

const developmentChains = ["hardhat", "localhost"];

// The following export allows us to import the above variable easily through
// const {networkConfig} = require("../helper-hardhat-config");
// Otherwise we would need to do 
// const helperConfig = require("../helper-hardhat-config");
// const networkConfig = helperConfig.networkConfig;
module.exports = {
    networkConfig,
    developmentChains,
}