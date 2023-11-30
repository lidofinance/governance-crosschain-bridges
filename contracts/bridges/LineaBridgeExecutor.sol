// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.10;

import {IMessageService} from '../dependencies/linea/interfaces/IMessageService.sol';
import {L2BridgeExecutor} from './L2BridgeExecutor.sol';

/**
 * @title LineaBridgeExecutor
 * @author Linea
 * @notice Implementation of the Linea Bridge Executor, able to receive cross-chain transactions from Ethereum
 * @dev Queuing an ActionsSet into this Executor can only be done by the L2 Address Alias of the L1 EthereumGovernanceExecutor
 */
contract LineaBridgeExecutor is L2BridgeExecutor {
  // Address of the Linea Message Service, in charge of redirecting cross-chain transactions in L2
  address public immutable LINEA_MESSAGE_SERVICE;

  /// @inheritdoc L2BridgeExecutor
  modifier onlyEthereumGovernanceExecutor() override {
    if (
      msg.sender != LINEA_MESSAGE_SERVICE ||
      IMessageService(LINEA_MESSAGE_SERVICE).sender() != _ethereumGovernanceExecutor
    ) revert UnauthorizedEthereumExecutor();
    _;
  }

  /**
   * @dev Constructor
   *
   * @param ethereumGovernanceExecutor The address of the EthereumGovernanceExecutor
   * @param delay The delay before which an actions set can be executed
   * @param gracePeriod The time period after a delay during which an actions set can be executed
   * @param minimumDelay The minimum bound a delay can be set to
   * @param maximumDelay The maximum bound a delay can be set to
   * @param guardian The address of the guardian, which can cancel queued proposals (can be zero)
   */
  constructor(
    address lineaMessageService,
    address ethereumGovernanceExecutor,
    uint256 delay,
    uint256 gracePeriod,
    uint256 minimumDelay,
    uint256 maximumDelay,
    address guardian
  )
    L2BridgeExecutor(
      ethereumGovernanceExecutor,
      delay,
      gracePeriod,
      minimumDelay,
      maximumDelay,
      guardian
    )
  {
    LINEA_MESSAGE_SERVICE = lineaMessageService;
  }
}
