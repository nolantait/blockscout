import { fetchGoSecurity } from "./off_chain/go_security"
import { fetchDexscreener } from "./off_chain/dexscreener"
import {
  concatMap,
  map,
  forkJoin,
} from "rxjs"

type Address = `0x${string}`

type PairCreated = {
  token0: Address,
}

const fetchOffChainData = () => {
  return concatMap((pair: PairCreated) => {
    const security = fetchGoSecurity(1, pair.token0)
    const dexscreener = fetchDexscreener(pair.token0)

    return forkJoin([security, dexscreener]).pipe(
      map(([security, dexscreener]) => {
        return {
          security,
          dexscreener,
        }
      })
    )
  })
}


export { fetchOffChainData }
