import { Signer, BigNumber } from 'ethers';
import {
  LineaBridgeExecutor,
  LineaBridgeExecutor__factory,
  MockLineaMessageService,
  MockLineaMessageService__factory,
} from '../typechain';
import { tEthereumAddress } from './types';

export const deployLineaMessageService = async (
  signer: Signer
): Promise<MockLineaMessageService> => {
  const messageService = await new MockLineaMessageService__factory(signer).deploy();
  await messageService.deployTransaction.wait();
  return messageService;
};

export const deployLineaBridgeExecutor = async (
  messageService: tEthereumAddress,
  ethereumExecutor: tEthereumAddress,
  delay: BigNumber,
  gracePeriod: BigNumber,
  minimumDelay: BigNumber,
  maximumDelay: BigNumber,
  guardian: tEthereumAddress,
  signer: Signer
): Promise<LineaBridgeExecutor> => {
  const lineaBridgeExecutorFactory = new LineaBridgeExecutor__factory(signer);
  const lineaBridgeExecutor = await lineaBridgeExecutorFactory.deploy(
    messageService,
    ethereumExecutor,
    delay,
    gracePeriod,
    minimumDelay,
    maximumDelay,
    guardian
  );
  await lineaBridgeExecutor.deployTransaction.wait();
  return lineaBridgeExecutor;
};
