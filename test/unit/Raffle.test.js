const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig} = require("../../helper-hardhat-config");

// run test using 'yarn hardhat test' or 'hh test'. 
// To run a specific "it" unit test run 'hh test --grep "it-string to match against"'

!developmentChains.includes(network.name) 
    ?   describe.skip
    :   describe("Raffle Unit Tests", function () {
            let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
            const chainId = network.config.chainId;

            beforeEach(async function(){
                deployer = (await getNamedAccounts()).deployer;
                await deployments.fixture(["all"]);  // runs all scripts with "all" tag in deploy folder
                raffle = await ethers.getContract("Raffle", deployer);
                vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
                raffleEntranceFee = await raffle.getEntranceFee();
                interval = await raffle.getInterval();
            })

            describe("constructor", function() {
                it("Initializes the raffle correctly", async function () {
                    const raffleState  = await raffle.getRaffleState();
                    assert.equal(raffleState.toString(), "0"); // enum gets returned as uint256, here 0 == OPEN
                    assert.equal(interval.toString(), networkConfig[chainId]["interval"]); 
                })
            })

            describe("enterRaffle", function() {
                it("Reverts when you don't pay enough", async function () {
                    await expect(raffle.enterRaffle()).to.be.reverted;
                })
                it("Records players when they enter", async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    const playerFromContract = await raffle.getPlayer(0);
                    assert.equal(playerFromContract, deployer);
                })
                it("Emits event on enter", async function () {
                    await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
                })
                // Throws InvalidConsumer() error when calling performUpkeep([]) in VRFCoordinatorV2Mock.sol
                it("Doesn't allow entrance when raffle is calculating", async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    /* How do we get it into calculating state? From Raffle.sol we see PerformUpkeep changes state to 
                    calculating but it requires checkUpkeep to return true. So we ensure it returns true and then we 
                    call performUpkeep ourselves. */ 
                    await network.provider.send("evm_increaseTime", [interval.toNumber()+1]); // speed up blockchain time
                    await network.provider.send("evm_mine", []); // mine next block
                    await raffle.performUpkeep([]); // Pretend to be a Chainlink Keeper and call performUpkeep
                    await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.reverted;
                })
            })
            describe("checkUpkeep", function() {
                it("Returns false if people haven't sent any ETH (balance is 0)", async function () {
                    // We skip ahead in time because we want 'timePassed' inside checkUpkeep to be true
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                    await network.provider.send("evm_mine", []);
                    const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]); // CallStatic simulates a transaction 
                    assert(!upkeepNeeded);
                })
                it("Returns false if raffle isn't open", async function () {
                    // We skip ahead in time because we want 'timePassed' inside checkUpkeep to be true
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep("0x"); // "0x" is the same as [] for blank bytes object
                    const raffleState  = await raffle.getRaffleState();
                    const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]); 
                    assert.equal(raffleState.toString(), "1");
                    assert.equal(upkeepNeeded, false);
                })
                it("Returns false if enough time hasn't passed", async () => {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() - 2]); // why does -1 not work?
                    await network.provider.request({ method: "evm_mine", params: [] });
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(!upkeepNeeded);
                })
                it("Returns true if enough time has passed, has players, eth, and is open", async () => {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                    await network.provider.request({ method: "evm_mine", params: [] });
                    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(upkeepNeeded);
                })
            })
            describe("performUpkeep", function() {
                it("It can only run if checkUpkeep is true", async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.send("evm_mine", []);
                    const tx = await raffle.performUpkeep([]);
                    assert(tx); // If performUpkeep errors out, tx will be 0 / false
                })
                it("It reverts when checkUpkeep is false", async function () {
                    await expect(raffle.performUpkeep([])).to.be.reverted;
                })
                it("Updates the raffle state, emits an event and calls the vrf coordinator", async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.send("evm_mine", []);  
                    const txResponse = await raffle.performUpkeep([]);
                    const txReceipt = await txResponse.wait(1);
                    // Because requestRandomWords emits an event before we emit our RequestedRaffleWinner event, 
                    // we must index our event with 1 instead of 0. 
                    const requestId = txReceipt.events[1].args.requestId;
                    const raffleState  = await raffle.getRaffleState();
                    assert(requestId.toNumber() > 0);
                    assert(raffleState.toString() == "1");
                })
            })
            describe("fulfillRandomWords", function() {
                beforeEach(async function(){
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.send("evm_mine", []);  
                })
                it("fulfillRandomWords can only be called after performUpkeep", async function () {
                    await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request");
                    await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request");                
                })
                // Waayyy to big (This test is similar to how staging tests will look)
                it("picks a winner, resets the lottery and sends money", async function() {
                    // We begin by having a bunch of random people enter the lottery (in addition to the deployer in the beforeEach)
                    const additionalEntrants = 3;
                    const startingAccountIndex = 1; // since deployer is 0
                    const accounts = await ethers.getSigners();
                    for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                        const accountConnectedRaffle = raffle.connect(accounts[i])
                        await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                    }
                    const startingTimeStamp = await raffle.getLatestTimeStamp();
                    await new Promise(async (resolve, reject) => {
                        // Set up a listener for the WinnerPicked event
                        raffle.once("WinnerPicked", async () => {
                            console.log("Found the event!")
                            try {
                                const recentWinner = await raffle.getRecentWinner();
                                // console.log(recentWinner);
                                // console.log(accounts[0].address);
                                // console.log(accounts[1].address);
                                // console.log(accounts[2].address);
                                // console.log(accounts[3].address);
                                const raffleState = await raffle.getRaffleState();
                                const endingTimeStamp = await raffle.getLatestTimeStamp();
                                const numPlayers = await raffle.getNumberOfPlayers();
                                const winnerEndingBalance = await accounts[1].getBalance();
                                assert.equal(numPlayers.toString(), "0");
                                assert.equal(raffleState.toString(), "0");
                                assert(endingTimeStamp > startingTimeStamp);
                                assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee).toString()));
                            } catch(e) {
                                reject(e);
                            }
                            resolve();
                        })
                        // On a TEST net we won't have the following lines. They'll be run by the actual Chainlink Keepers
                        // contract and VRF contract. The promise / listener above is what we'll rely on to catch the
                        // time when the fullRandomWords function is called (through the WinnerPicked event).
                        // 1. Mock Chainlink Keepers 
                        const tx = await raffle.performUpkeep([]);
                        const txReceipt = await tx.wait(1);
                        // We ran test once with logs to wee which account wins -> It's account 1
                        const winnerStartingBalance = await accounts[1].getBalance();
                        // 2. Mock VRF coordinator which emits the "WinnerPicked" event and triggers the above listerner
                        await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
                    });
                })
            })
        })