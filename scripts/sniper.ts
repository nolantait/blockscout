import { ethers } from "ethers"
import {
  Subject,
  tap,
  filter,
  forkJoin,
  concatMap,
  from
} from "rxjs"

import { fetchOnChainData } from "./on_chain"
import { simulateSwap } from "./simulation"
import Client from "./client"

type Address = `0x${string}`

const config = {
  privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  websocketUrl: "wss://mainnet.infura.io/ws/v3/c71051e5a5a54c1c9d1f51cff8838316",
  rpcUrl: "https://mainnet.infura.io/v3/c71051e5a5a54c1c9d1f51cff8838316",
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
  factoryV2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" as Address,
  routerV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as Address,
}


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

const wethOnly = (pair: PairCreated): boolean => {
  const valid = pair.token0.toLowerCase() === config.weth.toLowerCase() ||
    pair.token1.toLowerCase() === config.weth.toLowerCase()
  if (!valid) console.log("Skipping pair, not weth", pair)
  return valid
}

const enoughLiquidty = (data: any): boolean => {
  const valid = data.liquidityUsd >= 10_000
  if (!valid) console.log("Skipping pair, insufficient liquidity", data)
  return valid
}

const lowFees = (data: any) => {
  // const valid = data.simulation.fees <= 15.0
  // if (!valid) console.log("Skipping pair, high fees", data.simulation)
  // return valid
  return true
}

async function main() {
  console.log("Starting sniper...")
  const client = new Client(config.rpcUrl, config.privateKey)
  console.log("Client started:", client.walletAddress)
  const testClient = new Client("http://127.0.0.1:8545", config.privateKey)
  console.log("Test client started:", client.walletAddress)

  // const factory = new ethers.Contract(config.factoryV2, factoryAbi, client.wallet)

  console.log("Syncing fees...")
  await Promise.all([
    testClient.syncNonce(),
    testClient.syncFees(),
    client.syncNonce(),
    client.syncFees(),
  ])
  console.log("Fees synced...")

  console.log("Client nonce:", client.baseNonce)
  console.log("Test client nonce:", testClient.baseNonce)

  console.log("Listening for new pairs...")

  const stream = new Subject<PairCreated>()

  let timeStart = 0
  let timeFinish = 0
  stream.pipe(
    tap(() => timeStart = performance.now()),
    tap(logPairCreated),
    filter(wethOnly),
    fetchOnChainData(client),
    filter(enoughLiquidty),
    concatMap((data) => from(simulateSwap(testClient, data))),
    filter(lowFees),
    tap(() => {
      timeFinish = performance.now()
      console.log("Time taken:", timeFinish - timeStart)
    }),
  ).subscribe({
    next: (result) => {
      console.log("Result", result)
    },
    error: (error) => {
      console.log("Error", error)
    },
  })

  // factory.on(
  //   "PairCreated",
  //   (token0, token1, pair) => {
  //     stream.next({ token0, token1, pair } as PairCreated)
  //   }
  // )

  console.log("Sending down the pipe...")
  stream.next({
    token0: "0x12eF10A4fc6e1Ea44B4ca9508760fF51c647BB71" as Address,
    token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
    pair: "0x8C894D91748a42fC68f681090db06720779a7347" as Address
  })

  console.log("After sending down the pipe...")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
});
