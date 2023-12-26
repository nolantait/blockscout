import { ethers } from "ethers"
import {
  Subject,
  tap,
  filter,
} from "rxjs"

import factoryV2Abi from "../abis/factory_v2.json"
import { fetchOnChainData } from "./on_chain"
import { simulateSwap, resetFork } from "./simulation"

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

const wethOnly = (pair: PairCreated) => {
  const valid = pair.token0.toLowerCase() === config.weth.toLowerCase() ||
    pair.token1.toLowerCase() === config.weth.toLowerCase()
  if (!valid) console.log("Skipping pair, not weth", pair)
  return valid
}

const enoughLiquidty = (data: any) => {
  const valid = data.liquidityUsd >= 10_000
  if (!valid) console.log("Skipping pair, insufficient liquidity", data)
  return valid
}

const lowFees = (data: any) => {
  const valid = data.simulation.feePercent <= 15.0
  if (!valid) console.log("Skipping pair, high fees", data)
  return valid
}

async function main() {
  const provider = new ethers.WebSocketProvider(config.websocketUrl)
  const wallet = new ethers.Wallet(config.privateKey, provider)
  const localProvider = new ethers.JsonRpcProvider("http://localhost:8545")
  const localWallet = new ethers.Wallet(config.privateKey, localProvider)
  const contract = new ethers.Contract(config.factoryV2, factoryV2Abi, wallet)

  console.log("Listening for new pairs...")

  const stream = new Subject<PairCreated>()

  stream.pipe(
    tap(logPairCreated),
    filter(wethOnly),
    fetchOnChainData(wallet, config.weth),
    filter(enoughLiquidty),
    resetFork(provider),
    simulateSwap(localWallet, config.routerV2),
    filter(lowFees),
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

  stream.next({
    token0: "0x14feE680690900BA0ccCfC76AD70Fd1b95D10e16" as const,
    token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
    pair: "0x2a6c340bCbb0a79D3deecD3bc5cBc2605ea9259f" as const
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
});
