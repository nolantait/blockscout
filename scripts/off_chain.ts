import { fetchGoSecurity } from "./off_chain/go_security"
import { fetchDexscreener } from "./off_chain/dexscreener"
import {
  concatMap,
  map,
  forkJoin,
} from "rxjs"

type Address = `0x${string}`

type PairCreated = {
  token: {
    address: Address
  },
}

const fetchOffChainData = () => {
  return concatMap((data: any) => {
    const security = fetchGoSecurity(1, data.token.address)
    const dexscreener = fetchDexscreener(data.token.address)

    return forkJoin([security, dexscreener]).pipe(
      map(([security, dexscreener]) => {
        return {
          ...data,
          security,
          dexscreener,
        }
      })
    )
  })
}


export { fetchOffChainData }
