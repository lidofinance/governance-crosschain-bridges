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
  MockLineaMessageService__factory,
  MockLineaMessageService,
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

let messageService: MockLineaMessageService;
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

    // Mocking Linea Message Service
    messageService = await new MockLineaMessageService__factory(user).deploy();
    messageService.setSender(ethereumGovernanceExecutor.address);

    bridgeExecutor = await new LineaBridgeExecutor__factory(user).deploy(
      messageService.address,
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

    it('Queue and execute an actions set to set a message in Greeter', async () => {
      const greeter = await new Greeter__factory(user).deploy();
      expect(await greeter.message()).to.be.equal('');

      const NEW_MESSAGE = 'hello';

      expect(await bridgeExecutor.getActionsSetCount()).to.be.equal(0);
      await expect(bridgeExecutor.getCurrentState(0)).to.be.revertedWith(
        ExecutorErrors.InvalidActionsSetId
      );

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor,
        greeter.address,
        'setMessage(string)',
        [NEW_MESSAGE]
      );

      const tx = await messageService
        .connect(ethereumGovernanceExecutor)
        .sendMessage(bridgeExecutor.address, 0, encodedData, {
          gasLimit: 12000000,
        });
      const executionTime = (await timeLatest()).add(DELAY);

      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      expect(await bridgeExecutor.getActionsSetCount()).to.be.equal(1);
      expect(await bridgeExecutor.getCurrentState(0)).to.be.equal(ActionsSetState.Queued);

      const actionsSet = await bridgeExecutor.getActionsSetById(0);
      expect(actionsSet[0]).to.be.eql(data[0]);
      expect(actionsSet[1]).to.be.eql(data[1]);
      expect(actionsSet[2]).to.be.eql(data[2]);
      expect(actionsSet[3]).to.be.eql(data[3]);
      expect(actionsSet[4]).to.be.eql(data[4]);
      expect(actionsSet[5]).to.be.eql(executionTime);
      expect(actionsSet[6]).to.be.eql(false);
      expect(actionsSet[7]).to.be.eql(false);

      await expect(bridgeExecutor.execute(0)).to.be.revertedWith(
        ExecutorErrors.TimelockNotFinished
      );

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(greeter, 'MessageUpdated')
        .withArgs(NEW_MESSAGE);

      expect(await greeter.message()).to.be.equal(NEW_MESSAGE);
      expect(await bridgeExecutor.getCurrentState(0)).to.be.equal(ActionsSetState.Executed);
      expect((await bridgeExecutor.getActionsSetById(0)).executed).to.be.equal(true);
    });
  });
});
