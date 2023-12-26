import { ethers } from "ethers"
import {
  tap,
  map,
  concatMap,
  from,
} from "rxjs"
import hre from "hardhat"
import Client from "./client"
import RouterV2 from "./router_v2"

type Address = `0x${string}`
type Data = {
  weth: {
    address: Address,
  },
  token: {
    address: Address,
    decimals: number,
  },
  fees: ethers.FeeData,
}

const resetFork = <T>(client: Client) => {
  return concatMap((data: T) => {
    return new Promise<typeof data>(async resolve => {
      const latestBlock = await client.latestBlockNumber()
      console.log("Resetting local chain...")
      await hre.network.provider.request({
        method: "anvil_reset",
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

const unwrapTransaction = (tx: ethers.ContractTransactionResponse) => {
  const receipt = tx.wait()
  if (!receipt) throw new Error("No receipt")

  return receipt as Promise<ethers.ContractTransactionReceipt>
}

const calculateGas = (receipt: ethers.ContractTransactionReceipt) => {
  return {
    used: receipt.gasUsed,
    price: receipt.gasPrice,
    total: receipt.gasUsed * receipt.gasPrice,
    formatted: ethers.formatEther(receipt.gasUsed * receipt.gasPrice)
  }
}

type SwapParams = {
  token: Address
  weth: Address
  amountIn: bigint
  amountOutMin: bigint
  gasPrice: bigint
  side: "buy" | "sell"
}

const swapTokens = (
  router: RouterV2,
  params: SwapParams
) => {
  return from(router.swapTokens(params)).pipe(
    concatMap(unwrapTransaction),
    map(calculateGas),
    tap((gas) => console.log("GAS REPORT:", gas))
  )
}

const approveToken = (
  router: RouterV2,
  token: Address
) => {
  return from(router.approve(token)).pipe(
    concatMap((tx) => {
      return tx.wait()
    })
  )
}


const simulateSwap = (client: Client) => {
  const router = new RouterV2(client)

  return concatMap((data: Data) => {
    let originalBalance: bigint
    let boughtBalance: bigint
    let finalBalance: bigint
    let buyGas: any
    let sellGas: any

    return from(client.balance()).pipe(
      tap((balance) => { originalBalance = balance }),
      concatMap(() => {
        return swapTokens(
          router,
          {
            weth: data.weth.address,
            token: data.token.address,
            amountIn: ethers.parseUnits("0.05"),
            amountOutMin: 0n,
            gasPrice: data.fees.maxFeePerGas || 18044090000n,
            side: "buy"
          }
        )
      }),
      tap((gasReport) => {
        buyGas = gasReport
      }),
      concatMap(() => {
        return approveToken(router, data.token.address)
      }),
      concatMap(() => {
        return client.balanceOf(data.token.address)
      }),
      tap((balance) => {
        boughtBalance = balance
      }),
      concatMap((balance) => {
        return swapTokens(
          router,
          {
            token: data.token.address,
            weth: data.weth.address,
            amountIn: balance,
            amountOutMin: 0n,
            gasPrice: data.fees.maxFeePerGas || 18044090000n,
            side: "sell"
          }
        )
      }),
      tap((gasReport) => {
        sellGas = gasReport
      }),
      concatMap(() => {
        return client.balance()
      }),
      tap((balance) => {
        finalBalance = balance
      }),
      map(() => {
        const difference = finalBalance - originalBalance
        const fees = difference + (buyGas.total + sellGas.total)

        return {
          ...data,
          simulation: {
            originalBalance: ethers.formatEther(originalBalance),
            boughtBalance: ethers.formatUnits(boughtBalance, data.token.decimals),
            finalBalance: ethers.formatEther(finalBalance),
            difference: ethers.formatEther(difference),
            fees: ethers.formatEther(fees),
            feePercent: (parseFloat(ethers.formatEther(fees)) / 0.05) * 100.0,
            buyGas,
            sellGas,
          }
        }
      })
    )
  })
}

export { simulateSwap, resetFork }
