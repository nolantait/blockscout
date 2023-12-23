import { ethers } from "ethers"
import {
  mergeMap,
  map,
  forkJoin,
  from
} from "rxjs"

import poolAbi from "../abis/pool.json"
import erc20Abi from "../abis/erc20.json"

type Address = `0x${string}`

const fetchLiqudity = (pair: Address, wallet: ethers.Wallet) => {
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
    })
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

type PairCreated = {
  token0: Address,
  token1: Address,
  pair: Address
}

const fetchOnChainData = (wallet: ethers.Wallet, wethAddress: Address) => {
  return mergeMap((pair: PairCreated) => {

    return forkJoin({
      token0: fetchTokenInfo(pair.token0, wallet),
      token1: fetchTokenInfo(pair.token1, wallet),
      liqudity: fetchLiqudity(pair.pair, wallet)
    }).pipe(
      map(({ token0, token1, liqudity }) => {
        if (token0.address.toLowerCase() === wethAddress.toLowerCase()) {
          return {
            klast: liqudity.klast,
            weth: {
              ...token1,
              ...liqudity.token1
            },
            token: {
              ...token0,
              ...liqudity.token0
            }
          }
        } else {
          return {
            klast: liqudity.klast,
            weth: {
              ...token1,
              ...liqudity.token1
            },
            token: {
              ...token0,
              ...liqudity.token0
            }
          }
        }
      })
    )
  })
}

export { fetchOnChainData }
