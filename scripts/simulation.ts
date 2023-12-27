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
  const originalBalance = await client.balance()
  const receipt = await fastTransaction(client, promise)
  const finalBalance = await client.balance()

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
  console.log("Simulating swap...")
  const router = new RouterV2(client)
  await measure("Fork reset:", async () => await resetFork())
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
  console.log("Approving...")
  const approve = await snapshot(
    client,
    router.approve(data.token.address)
  )

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
  console.log("SOLD!!")

  const loss = sell.finish - buy.start
  const totalGas = buy.gas + sell.gas + approve.gas
  const fee = Number(loss + totalGas) / Number(spent) * 100.0

  return {
    spent,
    buy,
    approve,
    sell,
    loss: ethers.formatEther(loss),
    fee,
    totalGas: ethers.formatEther(totalGas)
  }
}

export { simulateSwap }
