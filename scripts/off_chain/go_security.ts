import {
  tap,
  map,
  retry
} from "rxjs"

import { fetch } from "../ops"

type Address = string

type GoSecurityResponse = {
  code: Number,
  message: string,
  result: {
    [key: Address]: GoSecurityResult
  }
}

type GoSecurityResult = {
  anti_whale_modifiable: string,
  buy_tax: string,
  cannot_buy: string,
  can_take_back_ownership: string,
  creator_address: string,
  creator_balance: string,
  creator_percent: string,
  external_call: string,
  hidden_owner: string,
  holder_count: string,
  holders: Array<any>,
  honeypot_with_same_creator: string,
  is_anti_whale: string,
  is_blacklisted: string,
  is_honeypot: string,
  is_in_dex: string,
  is_mintable: string,
  is_open_source: string,
  is_proxy: string,
  is_whitelisted: string,
  owner_address: string,
  owner_balance: string,
  owner_change_balance: string,
  owner_percent: string,
  personal_slippage_modifiable: string,
  selfdestruct: string,
  sell_tax: string,
  slippage_modifiable: string,
  token_name: string,
  token_symbol: string,
  total_supply: string,
  trading_cooldown: string,
  transfer_pausable: string
}


const fetchGoSecurity = (chainId: Number, address: Address) => {
  return fetch<GoSecurityResponse>(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`
  ).pipe(
    tap(() => console.log(`GoSecurity fetched for ${address}`)),
    map(response => {
      const result = response.data.result[address.toLowerCase()]
      if (!result) throw "No result found"

      return result
    }),
    retry({ count: 2, delay: 3000 })
  )
}

export { fetchGoSecurity }
