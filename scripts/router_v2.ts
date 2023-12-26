import { ethers } from "ethers"
import Client from "./client"
import routerAbi from "../abis/router_v2.json"

const routerV2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as const

type Address = `0x${string}`

type QuoteParams = {
  router: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
}

type SwapParams = {
  token: Address
  weth: Address
  amountIn: bigint
  amountOutMin: bigint
  gasPrice: bigint
  side: "buy" | "sell"
}

export default class RouterV2 {
  private _client: Client
  private _contract: ethers.Contract

  constructor(client: Client) {
    this._client = client
    this._contract = this._client.contract(routerV2, routerAbi)
  }

  async quote(params: QuoteParams): Promise<bigint> {
    return await this._contract.getAmountsOut(params.amountIn, [params.tokenIn, params.tokenOut])
  }

  async approve(token: Address): Promise<ethers.ContractTransactionResponse> {
    return await this._client.approve(token, routerV2)
  }

  async swapTokens({
    side,
    token,
    weth,
    amountIn,
    amountOutMin,
    gasPrice
  }: SwapParams): Promise<ethers.ContractTransactionResponse> {
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const nonce = await this._client.nonce()

    if (side === "sell") {
      return await this.sellTokens(
        amountIn,
        amountOutMin,
        [token, weth],
        this._client.walletAddress,
        deadline,
        {
          gasLimit: 2000000n,
          gasPrice,
          nonce
        }
      )
    } else {
      return await this.buyTokens(
        amountOutMin,
        [weth, token],
        this._client.walletAddress,
        deadline,
        {
          gasLimit: 2000000n,
          gasPrice,
          value: amountIn,
          nonce
        }
      )
    }
  }

  sellTokens(...params: any[]): Promise<ethers.ContractTransactionResponse> {
    return this._contract.swapExactTokensForETHSupportingFeeOnTransferTokens(...params)
  }

  buyTokens(...params: any[]): Promise<ethers.ContractTransactionResponse> {
    return this._contract.swapExactETHForTokensSupportingFeeOnTransferTokens(...params)
  }
}
