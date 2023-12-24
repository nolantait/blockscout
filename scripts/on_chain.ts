import { ethers } from "ethers"
import {
  concatMap,
  map,
  forkJoin,
  from,
  tap
} from "rxjs"

import poolAbi from "../abis/pool.json"
import erc20Abi from "../abis/erc20.json"

const ETH_PRICE = 2200

type Address = `0x${string}`

const getNonce = (wallet: ethers.Wallet) => {
  if (wallet.provider === null) throw "Missing provider"

  return from(wallet.provider.getTransactionCount(wallet.address))
}

const getEthBalance = (wallet: ethers.Wallet) => {
  if (wallet.provider === null) throw "Missing provider"

  return from(wallet.provider.getBalance(wallet.address))
}

const getBalance = (token: Address, wallet: ethers.Wallet) => {
  const contract = new ethers.Contract(token, erc20Abi, wallet)

  return from(contract.balanceOf(wallet.address))
}

const fetchLiqudity = (pair: Address, wallet: ethers.Wallet) => {
  console.log("Fetching liquidity for", pair)
  const contract = new ethers.Contract(pair, poolAbi, wallet)

  return from(Promise.all([
    contract.getReserves(),
    contract.price0CumulativeLast(),
    contract.price1CumulativeLast(),
    contract.kLast()
  ])).pipe(
    map(([reserves, price0, price1, klast]) => {
      const [tokenReserves0, tokenReserves1] = reserves

      return {
        klast,
        token0: {
          reserves: tokenReserves0,
          price: price0
        },
        token1: {
          reserves: tokenReserves1,
          price: price1
        },
      }
    }),
  )
}

type TokenInfo = {
  name: string,
  symbol: string,
  decimals: Number,
  totalSupply: string,
  address: Address
}

const fetchTokenInfo = (token: Address, wallet: ethers.Wallet) => {
  const contract = new ethers.Contract(token, erc20Abi, wallet)

  return from(Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply(),
  ])).pipe(
    map(([name, symbol, decimals, totalSupply]) => {
      return {
        name,
        symbol,
        decimals,
        totalSupply,
        address: token
      } as TokenInfo
    })
  )
}

const fetchFees = (wallet: ethers.Wallet) => {
  if (wallet.provider === null) throw "Missing provider"

  return from(wallet.provider.getFeeData())
}

type PairCreated = {
  token0: Address,
  token1: Address,
  pair: Address
}

const fetchOnChainData = (wallet: ethers.Wallet, wethAddress: Address) => {
  return concatMap(({ token0, token1, pair }: PairCreated) => {
    return forkJoin({
      token0: fetchTokenInfo(token0, wallet),
      token1: fetchTokenInfo(token1, wallet),
      liquidity: fetchLiqudity(pair, wallet),
      fees: fetchFees(wallet)
    }).pipe(
      map(({ token0, token1, liquidity, fees }) => {
        return {
          klast: liquidity.klast,
          fees,
          token0: {
            ...token0,
            ...liquidity.token0
          },
          token1: {
            ...token1,
            ...liquidity.token1
          }
        }
      }),
      map((data) => {
          if (data.token0.address.toLowerCase() === wethAddress.toLowerCase()) {
            return {
              weth: data.token0,
              token: data.token1,
              fees: data.fees,
              klast: data.klast
            }
          } else {
            return {
              weth: data.token1,
              token: data.token0,
              fees: data.fees,
              klast: data.klast
            }
          }
      }),
      map((data) => {
        return {
          ...data,
          liquidityUsd: parseFloat(ethers.formatEther(data.weth.reserves)) * 2 * ETH_PRICE
        }
      }),
      tap((data) => console.log("Data", data))
    )
  })
}

export { fetchOnChainData, getBalance, getEthBalance, getNonce }
