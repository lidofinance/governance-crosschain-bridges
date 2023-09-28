//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0;

contract MockLineaMessageService {
  uint256 public messageNum;
  address private _messageSender;

  function sendMessage(
    address destAddr,
    uint256, // fees
    bytes calldata data
  ) external payable returns (uint256) {
    bool success;
    (success, ) = destAddr.call(data);
    return messageNum;
  }

  function setSender(address sender) external payable {
    _messageSender = sender;
  }

  function sender() external view returns (address) {
    return _messageSender;
  }
}
