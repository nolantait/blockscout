import { ethers } from "ethers"
import erc20Abi from "../abis/erc20.json"
import poolAbi from "../abis/pool.json"

type Address = `0x${string}`

type FeeData = {
  gasPrice: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

export default class Client {
  provider: ethers.WebSocketProvider | ethers.JsonRpcProvider
  wallet: ethers.Wallet
  private _contracts: Record<Address, ethers.Contract>
  private _nonceOffset: number
  private _baseNonce: number
  private _fees: FeeData
  private _startTime: number

  constructor(url: string, privateKey: string) {
    const network = ethers.Network.from(1)

    if (url.startsWith("ws")) {
      this.provider = new ethers.WebSocketProvider(
        url,
        network,
        {
          staticNetwork: network,
          batchStallTime: 0
        }
      )
    } else {
      this.provider = new ethers.JsonRpcProvider(
        url,
        network,
        {
          staticNetwork: network,
          batchStallTime: 0
        }
      )
    }
    this.wallet = new ethers.Wallet(privateKey, this.provider)
    this._contracts = {}
    this._baseNonce = 0
    this._nonceOffset = 0
    this._fees = {
      gasPrice: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n
    }
    this._startTime = performance.now()
    const logger = (info: any) => {
      const time = performance.now() - this._startTime
      console.log("==============================")
      console.log("TIME SINCE START:", time)
      console.log(url, info)
      console.log("==============================")
    }
    this.provider.on('debug', logger.bind(this))
  }

  token(address: Address): ethers.Contract {
    return this.contract(address, erc20Abi)
  }

  pool(address: Address): ethers.Contract {
    return this.contract(address, poolAbi)
  }

  contract(address: Address, abi: any): ethers.Contract {
    if (this._contracts[address] === undefined) {
      this._contracts[address] = new ethers.Contract(address, abi, this.wallet)
    }

    return this._contracts[address]
  }

  isWeth(address: Address): boolean {
    return address.toLowerCase() === this.wethAddress.toLowerCase()
  }

  async approve(token: Address, recipient: Address): Promise<ethers.ContractTransactionResponse> {
    return await this.token(token).approve(
      recipient,
      ethers.MaxUint256,
      this.overrides
    )
  }

  async latestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber()
  }

  async balance(): Promise<bigint> {
    return this.provider.getBalance(this.wallet.address)
  }

  async balanceOf(address: Address): Promise<bigint> {
    return this.token(address).balanceOf(this.wallet.address)
  }

  async syncFees() {
    const fee = await this.provider.getFeeData()
    this._fees = {
      gasPrice: fee.gasPrice || 0n,
      maxFeePerGas: fee.maxFeePerGas || 0n,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas || 0n
    }
  }

  async syncNonce() {
    this._baseNonce = await this.provider.getTransactionCount(this.wallet.address)
  }

  get overrides(): ethers.Overrides {
    return {
      gasPrice: this.fees.maxFeePerGas,
      gasLimit: 200_000n,
      nonce: this.nonce,
      chainId: this.chainId,
      from: this.wallet.address
    }
  }

  get fees(): FeeData {
    return this._fees
  }

  get nonce(): number {
    const result = this._baseNonce + this._nonceOffset
    console.log("Nonce:", result)
    this._nonceOffset += 1
    return result
  }

  get baseNonce(): number {
    return this._baseNonce
  }

  get walletAddress(): Address {
    return this.wallet.address as Address
  }

  get wethAddress(): Address {
    return "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const
  }

  get wethPrice(): number {
    return 2000
  }

  get chainId(): bigint {
    return 1n
  }
}
