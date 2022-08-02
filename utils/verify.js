// Programatically verify your code on etherscan using the hardhat etherscan plugin
// You can refer to the hardhat documentation to see how we installed this plugin. 
// Then in the hardhat.config.js file we make our hardhat environment aware of it.
// Using the run library we can run any hardhat commands we could run from the command line.
// To see which hardhat commands exist you can simple run "yarn hardhat".
const { run } = require("hardhat");

const verify = async (contractAddress, args) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified!");
        }
    }
}

module.exports = { verify };