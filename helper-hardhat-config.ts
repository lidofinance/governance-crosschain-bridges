import {
  eArbitrumNetwork,
  eEthereumNetwork,
  eOptimismNetwork,
  ePolygonNetwork,
  eXDaiNetwork,
  iParamsPerNetwork,
} from './helpers/types';

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const TENDERLY_FORK = process.env.TENDERLY_FORK || '';

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
    [eEthereumNetwork.sepolia]: ALCHEMY_KEY
    ? `https://eth-sepolia.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://sepolia.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.goerli]: ALCHEMY_KEY
    ? `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://goerli.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.main]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.coverage]: 'http://localhost:8555',
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.tenderlyMain]: `https://rpc.tenderly.co/fork/${TENDERLY_FORK}`,
  [ePolygonNetwork.mumbai]: 'https://rpc-mumbai.maticvigil.com',
  [ePolygonNetwork.matic]: 'https://rpc-mainnet.matic.network',
  [eXDaiNetwork.xdai]: 'https://rpc.xdaichain.com/',
  [eArbitrumNetwork.arbitrum]: `https://arb1.arbitrum.io/rpc`,
  [eArbitrumNetwork.arbitrumTestnet]: `https://sepolia-rollup.arbitrum.io/rpc`,
  [eOptimismNetwork.main]: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  [eOptimismNetwork.testnet]: "https://sepolia.optimism.io",
};
