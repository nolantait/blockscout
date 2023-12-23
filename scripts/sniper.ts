import { ethers } from "ethers"
import {
  Subject,
  tap,
} from "rxjs"

import factoryV2Abi from "../abis/factory_v2.json"
import { fetchOnChainData } from "./on_chain"

const config = {
  privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  websocketUrl: "wss://mainnet.infura.io/ws/v3/c71051e5a5a54c1c9d1f51cff8838316",
  weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" as const,
  factoryV2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" as const
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

async function main() {
  const provider = new ethers.WebSocketProvider(config.websocketUrl)
  const wallet = new ethers.Wallet(config.privateKey, provider)
  const contract = new ethers.Contract(config.factoryV2, factoryV2Abi, wallet)

  console.log("Listening for new pairs...")

  const stream = new Subject<PairCreated>()

  stream.pipe(
    tap(logPairCreated),
    fetchOnChainData(wallet, config.weth)
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
      stream.next({token0, token1, pair})
    }
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
});
