import { BigNumber, ethers } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { NETWORKS_RPC_URL } from '../../helper-hardhat-config';
import { ADDRESSES } from '../../helpers/gov-constants';

import { DRE } from '../../helpers/misc-utils';
import { eLineaNetwork } from '../../helpers/types';
import {
  LineaBridgeExecutor__factory,
  Greeter__factory,
  IMessageService__factory,
} from '../../typechain';

task('linea:proposal-count', '').setAction(async (_, hre) => {
  await hre.run('set-DRE');

  const chainId = DRE.network.config.chainId;
  if (!chainId) {
    throw new Error('Missing chain id');
  }

  if (DRE.network.name != eLineaNetwork.main && DRE.network.name != eLineaNetwork.testnet) {
    throw new Error('Only applicable on linea L2');
  }

  const { deployer: deployerAddress } = await DRE.getNamedAccounts();
  const deployer = await DRE.ethers.getSigner(deployerAddress);
  console.log(
    `Deployer address: ${deployer.address} (${formatUnits(await deployer.getBalance())})`
  );

  const lineaGov = LineaBridgeExecutor__factory.connect(
    (await hre.deployments.get('LineaGov')).address,
    deployer
  );
  console.log(
    `Linea Gov at ${lineaGov.address} has ${await lineaGov.getActionsSetCount()} proposal`
  );
});

task(
  'linea:initiate-greeting',
  'Queue a greeting in the governance executor on Linea by transacting on L2'
).setAction(async (_, hre) => {
  await hre.run('set-DRE');

  if (!process.env.PRIVATE_KEY) {
    throw new Error('No signer defined');
  }

  if (DRE.network.name != eLineaNetwork.testnet && DRE.network.name != eLineaNetwork.main) {
    throw new Error('Only applicable on linea L2');
  }

  const MESSAGE = 'Miguel was also here ;)';
  const GAS_LIMIT = 1500000;

  let L1_LINEA_MESSAGE_SERVICE = ADDRESSES['L1_LINEA_MESSAGE_SERVICE_MAINNET'];
  if (DRE.network.name == eLineaNetwork.testnet) {
    L1_LINEA_MESSAGE_SERVICE = ADDRESSES['L1_LINEA_MESSAGE_SERVICE_TESTNET'];
  }

  const { deployer: deployerAddress } = await DRE.getNamedAccounts();
  const deployer = await DRE.ethers.getSigner(deployerAddress);
  console.log(
    `Deployer address: ${deployer.address} (${formatUnits(await deployer.getBalance())})`
  );

  const l1Name = DRE.network.companionNetworks['l1'];
  const l1Provider = new ethers.providers.JsonRpcProvider(NETWORKS_RPC_URL[l1Name]);
  const l1Signer = new ethers.Wallet(process.env.PRIVATE_KEY, l1Provider);

  const lineaGov = LineaBridgeExecutor__factory.connect(
    (await hre.deployments.get('LineaGov')).address,
    deployer
  );
  console.log(`Linea Gov at ${lineaGov.address}`);

  const greeter = Greeter__factory.connect(
    (await hre.deployments.get('Greeter')).address,
    deployer
  );
  console.log(`Greeter at ${greeter.address}`);

  const messageService = IMessageService__factory.connect(L1_LINEA_MESSAGE_SERVICE, l1Signer);
  console.log(`L1_LINEA_MESSAGE_SERVICE at: ${messageService.address}`);

  const encodedGreeting = greeter.interface.encodeFunctionData('setMessage', [MESSAGE]);

  const targets: string[] = [greeter.address];
  const values: BigNumber[] = [BigNumber.from(0)];
  const signatures: string[] = [''];
  const calldatas: string[] = [encodedGreeting];
  const withDelegatecalls: boolean[] = [false];

  const encodedQueue = lineaGov.interface.encodeFunctionData('queue', [
    targets,
    values,
    signatures,
    calldatas,
    withDelegatecalls,
  ]);

  const tx = await messageService.sendMessage(lineaGov.address, 0, encodedQueue, {
    gasLimit: GAS_LIMIT,
  });

  console.log(`Transactions initiated: ${tx.hash}`);
});

task('linea:execute-greeting', '')
  .addParam('id', 'Id of the proposal to execute')
  .setAction(async (taskArg, hre) => {
    await hre.run('set-DRE');

    if (DRE.network.name != eLineaNetwork.main && DRE.network.name != eLineaNetwork.testnet) {
      throw new Error('Only applicable on linea L2');
    }

    const id = taskArg.id;

    const { deployer: deployerAddress } = await DRE.getNamedAccounts();
    const deployer = await DRE.ethers.getSigner(deployerAddress);
    console.log(
      `Deployer address: ${deployer.address} (${formatUnits(await deployer.getBalance())})`
    );

    // Note, the contract is on the linea network, but only used to encode so no issue
    const lineaGov = LineaBridgeExecutor__factory.connect(
      (await DRE.deployments.get('OptimisticGov')).address,
      deployer
    );
    console.log(`Optimistic Gov at ${lineaGov.address}`);

    // Note, the contract is on the linea network, but only used to encode so no issue
    const greeter = Greeter__factory.connect(
      (await DRE.deployments.get('Greeter')).address,
      deployer
    );
    console.log(`Greeter at ${greeter.address}`);

    const tx = await lineaGov.execute(id);

    console.log(`Transaction initiated: ${tx.hash}`);
  });
