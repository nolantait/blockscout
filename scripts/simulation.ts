import { ethers } from "ethers"
import {
  tap,
  map,
  concatMap,
  mergeMap,
} from "rxjs"

import { getNonce, getBalance, getEthBalance } from "./on_chain"
import { swapTokens, approveToken } from "./router_v2"

type Address = `0x${string}`
type Data = {
  weth: {
    address: Address,
  },
  token: {
    address: Address,
  },
  fees: ethers.FeeData,
}

const simulateSwap = (wallet: ethers.Wallet, router: Address) => {
  return mergeMap((data: Data) => {
    let originalBalance: bigint
    let boughtBalance: bigint
    let finalBalance: bigint

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
      concatMap(() => {
        return getEthBalance(wallet)
      }),
      tap((balance) => {
        finalBalance = balance
      }),
      map(() => (
        {
          originalBalance: ethers.formatEther(originalBalance),
          boughtBalance: ethers.formatEther(boughtBalance),
          finalBalance: ethers.formatEther(finalBalance),
          difference: ethers.formatEther(finalBalance - originalBalance)
        }
      ))
    )
  })
}

export { simulateSwap }
