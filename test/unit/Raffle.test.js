const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) 
    ?   describe.skip
    :   describe("Raffle Unit Tests", async function () {
            let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval;
            const chainId = network.config.chainId;

            beforeEach(async function(){
                deployer = (await getNamedAccounts()).deployer;
                await deployments.fixture(["all"]);  // runs all scripts with "all" tag in deploy folder
                raffle = await ethers.getContract("Raffle", deployer);
                vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
                raffleEntranceFee = await raffle.getEntranceFee();
                interval = await raffle.getInterval();
            })

            describe("constructor", async function() {
                it("Initializes the raffle correctly", async function () {
                    const raffleState  = await raffle.getRaffleState();
                    assert.equal(raffleState.toString(), "0"); // enum gets returned as uint256, here 0 == OPEN
                    assert.equal(interval.toString(), networkConfig[chainId]["interval"]); 
                })
            })

            describe("enterRaffle", async function() {
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
        })