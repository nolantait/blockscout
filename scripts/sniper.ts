import { ethers } from "ethers"
import {
  Subject,
  tap,
  concatMap,
  filter,
} from "rxjs"
import hre from "hardhat"

import factoryV2Abi from "../abis/factory_v2.json"
import erc20Abi from "../abis/erc20.json"
import { fetchOnChainData } from "./on_chain"
import { simulateSwap } from "./simulation"

const config = {
  privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  websocketUrl: "wss://mainnet.infura.io/ws/v3/c71051e5a5a54c1c9d1f51cff8838316",
  rpcUrl: "https://mainnet.infura.io/v3/c71051e5a5a54c1c9d1f51cff8838316",
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
  factoryV2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" as const,
  routerV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as const,
}

type Address = `0x${string}`

type PairCreated = {
  token0: Address,
  token1: Address,
  pair: Address
}

const logPairCreated = (event: PairCreated) => {
  console.log(`
  PAIR CREATED
  ============
  Token0: ${event.token0}
  Token1: ${event.token1}
  Pair: ${event.pair}
  `)
}

const resetFork = <T>(provider: ethers.WebSocketProvider) => {
  return concatMap((data: T) => {
    return new Promise<typeof data>(async resolve => {
      const latestBlock = await provider.getBlockNumber()
      console.log("Resetting local chain...")
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{
          forking: {
            jsonRpcUrl: "https://mainnet.infura.io/v3/c71051e5a5a54c1c9d1f51cff8838316",
            blockNumber: latestBlock,
          }
        }]
      })
      console.log("Reset complete.")
      resolve(data)
    })
  })
}

async function main() {
  const provider = new ethers.WebSocketProvider(config.websocketUrl)
  const wallet = new ethers.Wallet(config.privateKey, provider)
  const localProvider = new ethers.JsonRpcProvider("http://localhost:8545")
  const localWallet = new ethers.Wallet(config.privateKey, localProvider)
  const contract = new ethers.Contract(config.factoryV2, factoryV2Abi, wallet)

  const wethContract = new ethers.Contract(config.weth, erc20Abi, localWallet)
  await wethContract.approve(config.factoryV2, ethers.MaxUint256)

  console.log("Listening for new pairs...")

  const stream = new Subject<PairCreated>()

  stream.pipe(
    tap(logPairCreated),
    filter((pair) => {
      const valid = pair.token0.toLowerCase() === config.weth.toLowerCase() ||
        pair.token1.toLowerCase() === config.weth.toLowerCase()

      if (!valid) console.log("Skipping pair", pair)

      return valid
    }),
    fetchOnChainData(wallet, config.weth),
    resetFork(provider),
    simulateSwap(localWallet, config.routerV2),
  ).subscribe({
    next: (result) => {
      console.log("Result", result)
    },
    error: (error) => {
      console.log("Error", error)
    },
  })

  contract.on(
    "PairCreated",
    (token0, token1, pair) => {
      stream.next({ token0, token1, pair })
    }
  )

  // stream.next({
  //   token0: "0xA9E8aCf069C58aEc8825542845Fd754e41a9489A" as const,
  //   token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
  //   pair: "0xDDd23787a6B80A794d952f5fb036D0b31A8E6aff" as const
  // })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
});
