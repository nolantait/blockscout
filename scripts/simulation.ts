import { ethers } from "ethers"
import {
  tap,
  map,
  concatMap,
} from "rxjs"
import hre from "hardhat"

import { getBalance, getEthBalance } from "./on_chain"
import { swapTokens, approveToken } from "./router_v2"

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

const resetFork = <T>(provider: ethers.WebSocketProvider) => {
  return concatMap((data: T) => {
    return new Promise<typeof data>(async resolve => {
      const latestBlock = await provider.getBlockNumber()
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


const simulateSwap = (wallet: ethers.Wallet, router: Address) => {
  return concatMap((data: Data) => {
    let originalBalance: bigint
    let boughtBalance: bigint
    let finalBalance: bigint
    let buyGas: any
    let sellGas: any

    return getEthBalance(wallet).pipe(
      tap((balance) => {
        originalBalance = balance
      }),
      concatMap(() => {
        return swapTokens(
          wallet,
          {
            router,
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
        return approveToken(
          wallet,
          { token: data.token.address, router }
        )
      }),
      concatMap(() => {
        return getBalance(data.token.address, wallet)
      }),
      tap((balance) => {
        boughtBalance = balance
      }),
      concatMap((balance) => {
        return swapTokens(
          wallet,
          {
            router,
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
        return getEthBalance(wallet)
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
