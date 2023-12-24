import { ethers } from "ethers"
import {
  mergeMap,
  map,
  forkJoin,
  from,
  retry,
  catchError
} from "rxjs"

import poolAbi from "../abis/pool.json"
import erc20Abi from "../abis/erc20.json"

const ETH_PRICE = 2200

type Address = `0x${string}`

const getNonce = (wallet: ethers.Wallet) => {
  return from(wallet.provider!.getTransactionCount(wallet.address))
}

const getEthBalance = (wallet: ethers.Wallet) => {
  return from(wallet.provider!.getBalance(wallet.address))
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
    // catchError((error) => {
    //   console.log("Error fetching liquidity", error.info)
    //   throw error
    // }),
    // retry({ count: 2, delay: 3000 }),
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

type PairCreated = {
  token0: Address,
  token1: Address,
  pair: Address
}

const fetchFees = (wallet: ethers.Wallet) => {
  if (!wallet.provider) throw "Missing provider"

  return from(
    new Promise<ethers.FeeData>(async resolve => {
      const feeData = await wallet.provider!.getFeeData()
      resolve(feeData)
    })
  )
}

const fetchOnChainData = (wallet: ethers.Wallet, wethAddress: Address) => {
  return mergeMap((pair: PairCreated) => {
    return forkJoin({
      token0: fetchTokenInfo(pair.token0, wallet),
      token1: fetchTokenInfo(pair.token1, wallet),
      liquidity: fetchLiqudity(pair.pair, wallet),
      fees: fetchFees(wallet)
    }).pipe(
      map(({ token0, token1, liquidity, fees }) => {
        if (token0.address.toLowerCase() === wethAddress.toLowerCase()) {
          return {
            fees,
            klast: liquidity.klast,
            weth: {
              ...token1,
              ...liquidity.token1
            },
            token: {
              ...token0,
              ...liquidity.token0
            }
          }
        } else {
          return {
            fees,
            klast: liquidity.klast,
            weth: {
              ...token1,
              ...liquidity.token1
            },
            token: {
              ...token0,
              ...liquidity.token0
            }
          }
        }
      }),
      map((data) => {
        const liquidityUsd = parseFloat(ethers.formatEther(data.weth.reserves)) * 2 * ETH_PRICE

        return {
          ...data,
          liquidityUsd
        }
      })
    )
  })
}

export { fetchOnChainData, getBalance, getEthBalance, getNonce }
