import { ethers } from "ethers"
import {
  map,
  from,
  mergeMap,
  concatMap,
} from "rxjs"

import routerAbi from "../abis/router_v2.json"
import erc20Abi from "../abis/erc20.json"

import { getNonce } from "./on_chain"

type Address = `0x${string}`
type QuoteParams = {
  router: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
}

const fetchQuote = (
  wallet: ethers.Wallet,
  { router, tokenIn, tokenOut, amountIn }: QuoteParams
) => {
  const contract = new ethers.Contract(router, routerAbi, wallet)

  return from(contract.getAmountsOut(amountIn, [tokenIn, tokenOut])).pipe(
    map(([amountOut]) => {
      return ethers.formatEther(amountOut)
    })
  )
}

type SwapParams = {
  router: Address
  token: Address
  weth: Address
  amountIn: bigint
  amountOutMin: bigint
  gasPrice: bigint
  side: "buy" | "sell"
}

const swapTokens = (
  wallet: ethers.Wallet,
  { router, token, weth, amountIn, amountOutMin, gasPrice, side }: SwapParams
) => {
  const contract = new ethers.Contract(router, routerAbi, wallet)
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20

  console.log(`
    router: ${router}
    amountIn: ${amountIn}
    amountOutMin: ${amountOutMin}
    token: ${token}
    weth: ${weth}
    wallet.address: ${wallet.address}
    deadline: ${deadline}
  `)

  return getNonce(wallet).pipe(
    concatMap((nonce) => {
      console.log("swapTokens nonce", nonce)

      if (side === "sell") {
        return from(contract.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn,
          amountOutMin,
          [token, weth],
          wallet.address,
          deadline,
          {
            gasLimit: 2000000,
            gasPrice,
            nonce
          }
        )).pipe(
          concatMap((tx) => {
            return tx.wait()
          })
        )
      } else {
        return from(contract.swapExactETHForTokensSupportingFeeOnTransferTokens(
          amountOutMin,
          [weth, token],
          wallet.address,
          deadline,
          {
            gasLimit: 2000000,
            gasPrice,
            value: amountIn,
            nonce
          }
        )).pipe(
          concatMap((tx) => {
            return tx.wait()
          })
        )
      }
    })
  )
}

type ApproveParams = {
  token: Address
  router: Address
}

const approveToken = (
  wallet: ethers.Wallet,
  { token, router }: ApproveParams
) => {
  const contract = new ethers.Contract(token, erc20Abi, wallet)

  return getNonce(wallet).pipe(
    concatMap((nonce) => {
      console.log("approveToken nonce", nonce)

      return from(contract.approve(router, ethers.MaxUint256, { nonce })).pipe(
        concatMap((tx) => {
          return tx.wait()
        })
      )
    })
  )
}

export { fetchQuote, swapTokens, approveToken }
