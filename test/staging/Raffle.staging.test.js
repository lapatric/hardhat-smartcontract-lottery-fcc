const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig} = require("../../helper-hardhat-config");

// Unit tests are meant for testing on local networks. It requires that we mock any (3rd party) contracts
// with which we interact. Staging tests are meant for testing on test networks. For (3rd party) contracts
// with which we interact we use readily available contracts on the test network instead of mocking them.

// To test our contract on the test network using this test script we must first complete the following steps:
// 1. Get a subscription for Chainlink VRF on the test network and fund it - vrf.chain.link
// 2. Deploy the contract using our obtained subscription ID (in the constructor)
// 3. Register the contract with our Chainlink VRF subscription by adding it as a consumer - vrf.chain.link
// 4. Register the contract with Chainlink Keepers at - keepers.chain.link (logic based keepers node)
// 5. Finally, run staging tests using "hh test --network rinkeby"

developmentChains.includes(network.name) 
    ?   describe.skip
    :   describe("Raffle Unit Tests", function () {
            let raffle, raffleEntranceFee, deployer;

            beforeEach(async function(){
                deployer = (await getNamedAccounts()).deployer;
                // Contract already deployed to test network at this point
                // await deployments.fixture(["all"]);  // runs all scripts with "all" tag in deploy folder
                raffle = await ethers.getContract("Raffle", deployer);
                raffleEntranceFee = await raffle.getEntranceFee();
            })

            describe("fulfillRandomWords", function() {
                it("Works with live Chaihnlink Keepers and Chainlink VRF, we get a random winner", async function () {
                    console.log("Setting up test...")
                    const startingTimeStamp = await raffle.getLatestTimeStamp();
                    const accounts = await ethers.getSigners();

                    console.log("Setting up Listener...")
                    await new Promise(async (resolve, reject) => {
                        // Set up a listener for the WinnerPicked event
                        raffle.once("WinnerPicked", async () => {
                            console.log("WinnerPicked event fired!")
                            try {
                                const recentWinner = await raffle.getRecentWinner();
                                const raffleState = await raffle.getRaffleState();
                                const winnerEndingBalance = await accounts[0].getBalance(); // account 0 is deployer
                                const endingTimeStamp = await raffle.getLatestTimeStamp();
                                await expect(raffle.getPlayer(0)).to.be.reverted; // another way to check array has length 0
                                assert.equal(recentWinner.toString(), accounts[0].address);
                                assert.equal(raffleState, 0);
                                assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString());
                                assert(endingTimeStamp > startingTimeStamp);
                                resolve();
                            } catch(e) {
                                console.log(e)
                                reject(e);
                            }
                        })

                        console.log("Entering Raffle...")
                        const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                        await tx.wait(1);
                        console.log("Ok, time to wait...")
                        const winnerStartingBalance = await accounts[0].getBalance(); // account 0 is deployer
                        // When the execution reaches this point the listener has been set up (see above once() call)
                        // and the deployer has entered the raffle. However because the promise has not been resolved 
                        // yet (by call to resolve or reject) the execution waits until that is completed.
                    });
                })
            })
        })