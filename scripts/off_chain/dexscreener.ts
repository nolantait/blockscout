import {
  tap,
  map,
  retry,
} from "rxjs"

import { fetch } from "../ops"

type Address = string

type DexscreenerToken = {
  chainId: string,
  dexId: string,
  url: string,
  pairAddress: Address,
  baseToken: any,
  quoteToken: any,
  priceNative: string,
  priceUsd: string,
}

type DexscreenerResponse = {
  schemaVersion: string,
  pairs: Array<DexscreenerToken> | null
}

const fetchDexscreener = (address: String) => {
  return fetch<DexscreenerResponse>(`https://api.dexscreener.com/latest/dex/tokens/${address}`).pipe(
    tap(() => console.log(`Dexscreener fetched for ${address}`)),
    map(response => {
      const pairs = response.data.pairs
      if (!pairs) throw "No pairs found"

      return response.data.pairs
    }),
    retry({ count: 2, delay: 3000 })
  )
}

export { fetchDexscreener }
