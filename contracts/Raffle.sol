//SPDX-License-Identifier: MIT

// Raffle
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract Raffle is VRFConsumerBaseV2 {
    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /* Events */
    event RaffleEnter(address indexed player);

    constructor(address vrfCoorinatorV2, uint256 entranceFee) VRFConsumerBaseV2(vrfCoorinatorV2){
        i_entranceFee = entranceFee;
    }

    function enterRaffle() public payable {
        // For deploy (and runtime) gas saving, use https://blog.soliditylang.org/2021/04/21/custom-errors/
        require(msg.value > i_entranceFee, "Not enough ETH!");
        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // Event naming convention: reverse words of function that emits them
        emit RaffleEnter(msg.sender);
    }

    // external: Our contract can't call it, optimises gas
    function requestRandomWinner() external {
        // Request the random number
        // Do something with it
        // 2 transaction process
    }

    /* 
        Overrides the (virtual) fulfillRandomWords function in node_modules/@chainlink/src/v0.8/VRFConsumerBaseV2 
        which we must do as we inheret VRFConsumerBaseV2
    */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {

    }

    /* View / Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

}