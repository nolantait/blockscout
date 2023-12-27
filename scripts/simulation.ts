import { ethers } from "ethers"
import hre from "hardhat"
import Client from "./client"
import RouterV2 from "./router_v2"

const resetFork = async () => {
  await hre.network.provider.request({
    method: "anvil_reset",
    params: [{
      forking: {
        jsonRpcUrl: "https://mainnet.infura.io/v3/c71051e5a5a54c1c9d1f51cff8838316",
      }
    }]
  })
}

const measure = async(name: string, func: () => Promise<any>) => {
  const timeStart = performance.now()
  const result = await func()
  const timeEnd = performance.now()
  console.log(name, "Time:", timeEnd - timeStart)
  return result
}

const fastTransaction = async (client: Client, promise: Promise<ethers.TransactionResponse>) => {
  const tx = await measure("Sending transaction:", async () => await promise)
  await measure("Mining transaction:", async () => await hre.network.provider.send("anvil_mine"))
  const receipt = await measure("Fetching receipt:", async () => await client.provider.getTransactionReceipt(tx.hash))
  if (!receipt) throw new Error("Could not fetch receipt...")
  return receipt
}

const snapshot = async (client: Client, promise: Promise<ethers.TransactionResponse>) => {
  const latestBlock = await client.latestBlockNumber()
  const originalBalance = await client.balance(latestBlock)
  const receipt = await fastTransaction(client, promise)
  const finalBalance = await client.balance(latestBlock + 1)

  if (!receipt) throw new Error("Could not fetch receipt...")

  const gas = receipt.gasUsed as bigint * receipt.gasPrice as bigint

  return {
    start: originalBalance,
    finish: finalBalance,
    sansGas: finalBalance + gas,
    gas
  }
}

const simulateSwap = async (client: Client, data: any) => {
  const simulation = new Simulation()
  console.log("Simulating swap...")
  const router = new RouterV2(client)
  await measure("Fork reset:", async () => resetFork())
  console.log("Fork reset...")
  const spent = ethers.parseUnits("0.05")
  console.log("Buying...")
  const buy = await snapshot(
    client,
    router.swapTokens({
      weth: data.weth.address,
      token: data.token.address,
      amountIn: spent,
      amountOutMin: 0n,
      side: "buy"
    })
  )

  simulation.addStage("Buy", buy.start, buy.finish, buy.gas)

  console.log("Approving...")
  const approve = await snapshot(
    client,
    router.approve(data.token.address)
  )

  simulation.addStage("Approve", approve.finish, approve.finish, approve.gas)

  const balance = await client.balanceOf(data.token.address)
  console.log("Selling...")
  const sell = await snapshot(
    client,
    router.swapTokens({
      token: data.token.address,
      weth: data.weth.address,
      amountIn: balance,
      amountOutMin: 0n,
      side: "sell"
    })
  )

  simulation.addStage("Sell", sell.start, sell.finish, sell.gas)
  console.log("SOLD!!")

  return simulation
}

type Stage = {
  name: string,
  start: bigint,
  finish: bigint,
  gas: bigint
}

class Simulation {
  stages: Stage[]

  constructor(stages: Stage[] = []) {
    this.stages = stages
  }

  addStage(name: string, start: bigint, finish: bigint, gas: bigint) {
    this.stages.push({ name, start, finish, gas })
  }

  get fees(): number {
    return 1 - Number(this.loss) / Number(this.totalGas)
  }

  get originalBalance(): bigint {
    return this.stages[0].start
  }

  get totalGas(): bigint {
    return this.stages.reduce((acc, stage) => acc + stage.gas, 0n)
  }

  get loss(): bigint {
    return this.stages[-1].finish - this.stages[0].start
  }
}

export { simulateSwap }
