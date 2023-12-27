import { ethers } from "ethers"
import {
  concatMap,
  map,
  forkJoin,
  from,
  tap
} from "rxjs"

import Client from "./client"

type Address = `0x${string}`

const fetchLiqudity = (pair: Address, client: Client) => {
  const contract = client.pool(pair)

  return from(Promise.all([
    contract.getReserves(),
    contract.price0CumulativeLast(),
    contract.price1CumulativeLast(),
  ])).pipe(
    map(([reserves, price0, price1]) => {
      const [tokenReserves0, tokenReserves1] = reserves

      return {
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

const fetchTokenInfo = (token: Address, client: Client) => {
  const contract = client.token(token)

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

const fetchOnChainData = (client: Client) => {
  return concatMap(({ token0, token1, pair }: PairCreated) => {
    return forkJoin({
      token0: fetchTokenInfo(token0, client),
      token1: fetchTokenInfo(token1, client),
      liquidity: fetchLiqudity(pair, client),
    }).pipe(
      map(({ token0, token1, liquidity }) => {
        return {
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
          if (client.isWeth(data.token0.address)) {
            return {
              weth: data.token0,
              token: data.token1,
            }
          } else {
            return {
              weth: data.token1,
              token: data.token0,
            }
          }
      }),
      map((data) => {
      const liquidityUsd = parseFloat(ethers.formatEther(data.weth.reserves)) * 2 * client.wethPrice
        return {
          ...data,
          liquidityUsd
        }
      }),
      tap((data) => console.log("Data", data))
    )
  })
}

export { fetchOnChainData }
