const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) 
    ?   describe.skip
    :   describe("Raffle Unit Tests", async function () {
            let raffle, vrfCoordinatorV2Mock, raffleEntranceFee;
            const chainId = network.config.chainId;

            beforeEach(async function(){
                deployer = (await getNamedAccounts()).deployer;
                await deployments.fixture(["all"]);  // runs all scripts with "all" tag in deploy folder
                raffle = await ethers.getContract("Raffle", deployer);
                vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
                raffleEntranceFee = await raffle.getEntranceFee();
            })

            describe("constructor", async function() {
                it("Initializes the raffle correctly", async function () {
                    const raffleState  = await raffle.getRaffleState();
                    const interval = await raffle.getInterval();
                    assert.equal(raffleState.toString(), "0"); // enum gets returned as uint256, here 0 == OPEN
                    assert.equal(interval.toString(), networkConfig[chainId]["interval"]); 
                })
            })

            describe("constructor", async function() {
                it("Reverts when you don't pay enough", async function () {
                    await expect(raffle.enterRaffle()).to.be.reverted;
                })
                it("Records players when they enter", async function () {
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                    const playerFromContract = await raffle.getPlayer(0);
                    assert.equal(playerFromContract, deployer);
                })
            })
        })