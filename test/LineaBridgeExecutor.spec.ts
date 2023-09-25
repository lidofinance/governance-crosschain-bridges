import hardhat, { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  Greeter__factory,
  GreeterPayload__factory,
  LineaBridgeExecutor,
  LineaBridgeExecutor__factory,
  MockInbox__factory,
  MockInbox,
} from '../typechain';
import {
  evmSnapshot,
  evmRevert,
  advanceBlocks,
  setBlocktime,
  timeLatest,
  setCode,
  getImpersonatedSigner,
} from '../helpers/misc-utils';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../helpers/constants';
import { ActionsSetState, ExecutorErrors } from './helpers/executor-helpers';
import { ALIASING_OFFSET, applyL1ToL2Alias, undoL1ToL2Alias } from '../helpers/arbitrum-helpers';
import { parseEther } from 'ethers/lib/utils';

chai.use(solidity);

let user: SignerWithAddress;
let ethereumGovernanceExecutor: SignerWithAddress;
let guardian: SignerWithAddress;
let users: SignerWithAddress[];

let arbitrumInbox: MockInbox;
let bridgeExecutor: LineaBridgeExecutor;

const DELAY = 50;
const MAXIMUM_DELAY = 100;
const MINIMUM_DELAY = 1;
const GRACE_PERIOD = 1000;

const encodeSimpleActionsSet = (
  bridgeExecutor: LineaBridgeExecutor,
  target: string,
  fn: string,
  params: any[]
) => {
  const paramTypes = fn.split('(')[1].split(')')[0].split(',');
  const data = [
    [target],
    [BigNumber.from(0)],
    [fn],
    [ethers.utils.defaultAbiCoder.encode(paramTypes, [...params])],
    [false],
  ];
  const encodedData = bridgeExecutor.interface.encodeFunctionData('queue', data as any);

  return { data, encodedData };
};

describe('LineaBridgeExecutor', async function () {
  let snapId;

  before(async () => {
    await hardhat.run('set-DRE');
    [user, ethereumGovernanceExecutor, guardian, ...users] = await ethers.getSigners();

    bridgeExecutor = await new LineaBridgeExecutor__factory(user).deploy(
      ethereumGovernanceExecutor.address,
      DELAY,
      GRACE_PERIOD,
      MINIMUM_DELAY,
      MAXIMUM_DELAY,
      guardian.address
    );
  });

  beforeEach(async () => {
    snapId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(snapId);
  });

  it('Check initial parameters', async () => {
    // Executor parameters
    expect(await bridgeExecutor.getDelay()).to.be.equal(DELAY);
    expect(await bridgeExecutor.getGracePeriod()).to.be.equal(GRACE_PERIOD);
    expect(await bridgeExecutor.getMinimumDelay()).to.be.equal(MINIMUM_DELAY);
    expect(await bridgeExecutor.getMaximumDelay()).to.be.equal(MAXIMUM_DELAY);
    expect(await bridgeExecutor.getGuardian()).to.be.equal(guardian.address);

    // ActionsSet
    expect(await bridgeExecutor.getActionsSetCount()).to.be.equal(0);
    await expect(bridgeExecutor.getCurrentState(0)).to.be.revertedWith(
      ExecutorErrors.InvalidActionsSetId
    );

    // Arbitrum Bridge Executor parameters
    expect(await bridgeExecutor.getEthereumGovernanceExecutor()).to.be.equal(
      ethereumGovernanceExecutor.address
    );
  });

  context('Ethereum Governance Executor queues an actions sets', () => {
    it('Tries to queue and actions set without being the Ethereum Governance Executor (revert expected)', async () => {
      await expect(bridgeExecutor.queue([], [], [], [], [])).to.be.revertedWith(
        ExecutorErrors.UnauthorizedEthereumExecutor
      );
    });
  });
});
