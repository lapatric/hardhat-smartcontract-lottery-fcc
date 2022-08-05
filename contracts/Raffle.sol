//SPDX-License-Identifier: MIT

// Raffle
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__TransferFailed();
error Raffle_UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/** @title A sample Raffle Contract
 *  @notice This contract is for creating an untamperable decentralized smart contract
 *  @dev This implements Chainlink VRF v2 and Chainlink Keepers.
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    enum RaffleState {
        OPEN,
        CALCULATING 
    }

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState; // ~ uint256 private s_state; for pending, open, closed, calculating 
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;


    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(address vrfCoordinatorV2, uint256 entranceFee, bytes32 gasLane, uint64 subscriptionId, uint32 callbackGasLimit, uint256 interval) VRFConsumerBaseV2(vrfCoordinatorV2){
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2); // vrfCoordinatorV2 is a contract
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        // For deploy (and runtime) gas saving, use https://blog.soliditylang.org/2021/04/21/custom-errors/
        require(msg.value >= i_entranceFee, "Not enough ETH!");
        require(s_raffleState == RaffleState.OPEN, "Raffle not open!");
        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // Event naming convention: reverse words of function that emits them
        emit RaffleEnter(msg.sender);
    }

    /**
    * @dev This is the function that the Chainlink Keeper nodes call. The look for the 'upkeepNeeded' to return true.
    * The following whould be true in order to return true:
    * 1. Our time interval should have passed.  
    * 2. The lottery should have at least 1 player, and have some ETH.
    * 3. Our subscription is funded with LINK.
    * 4. The lottery should be in an 'open' state.
    */
    function checkUpkeep(bytes memory /* heckData */) public override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance;
    }

    // external: Our contract can't call it, optimises gas
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle_UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // gasLane - max gas you're willing to pay for request
            i_subscriptionId, // given to us from the subscription contract we use to pay the oracle gas
            REQUEST_CONFIRMATIONS, // how many confirmations before we receive generated random number
            i_callbackGasLimit, // gas limit on the fulfillRandomWords callback function
            NUM_WORDS // how many random numbers to return (to the fulfillRandomWords callback)
        );
        // Actually redundant as requestRndomWords emits a similar event already
        emit RequestedRaffleWinner(requestId);
    }

    /* 
        Overrides the (virtual) fulfillRandomWords function in node_modules/@chainlink/src/v0.8/VRFConsumerBaseV2 
        which we must do as we inheret VRFConsumerBaseV2
    */
    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        // require(success);
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns(RaffleState) {
        return s_raffleState;
    }

    // NUM_WORDS is a constant variable (stored in the byte code) -> no reading or writing to storage -> 'pure'
    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns(uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns(uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns(uint256) {
        return i_interval;
    }
 }