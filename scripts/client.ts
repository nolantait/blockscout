import { ethers } from "ethers"
import erc20Abi from "../abis/erc20.json"
import poolAbi from "../abis/pool.json"

type Address = `0x${string}`

type FeeData = {
  gasPrice: bigint | null
  maxFeePerGas: bigint | null
  maxPriorityFeePerGas: bigint | null
}

export default class Client {
  provider: ethers.WebSocketProvider | ethers.JsonRpcProvider
  wallet: ethers.Wallet
  private _contracts: Record<Address, ethers.Contract>

  constructor(url: string, privateKey: string) {
    if (url.startsWith("ws")) {
      this.provider = new ethers.WebSocketProvider(url)
    } else {
      this.provider = new ethers.JsonRpcProvider(url)
    }
    this.wallet = new ethers.Wallet(privateKey, this.provider)
    this._contracts = {}
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
    const nonce = await this.nonce()
    return this.token(token).approve(recipient, ethers.MaxUint256, { nonce })
  }

  async latestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber()
  }

  async nonce(): Promise<number> {
    return this.provider.getTransactionCount(this.wallet.address)
  }

  async balance(): Promise<bigint> {
    return this.provider.getBalance(this.wallet.address)
  }

  async balanceOf(address: Address): Promise<bigint> {
    return this.token(address).balanceOf(this.wallet.address)
  }

  async fees(): Promise<FeeData> {
    return this.provider.getFeeData()
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
}
