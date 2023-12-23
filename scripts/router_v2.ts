import { ethers } from "ethers"
import {
  map,
  from
} from "rxjs"

import routerAbi from "../abis/router_v2.json"

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
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOutMin: bigint
}

const swapTokens = (
  wallet: ethers.Wallet,
  { router, tokenIn, tokenOut, amountIn, amountOutMin }: SwapParams
) => {
  const contract = new ethers.Contract(router, routerAbi, wallet)

  return from(contract.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [tokenIn, tokenOut],
    wallet.address,
    Math.floor(Date.now() / 1000) + 60 * 20
  )).pipe(
    map((tx) => {
      return tx.wait()
    })
  )
}

type ApproveParams = {
  token: Address
  router: Address
}

const approveTokens = (
  wallet: ethers.Wallet,
  { token, router }: ApproveParams
) => {
  const contract = new ethers.Contract(token, routerAbi, wallet)

  return from(contract.approve(router, ethers.MaxUint256)).pipe(
    map((tx) => {
      return tx.wait()
    })
  )
}

export { fetchQuote, swapTokens, approveTokens }
