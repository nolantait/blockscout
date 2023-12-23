import axios from "axios"
import { from } from "rxjs"

const fetch = <T>(url: string) => {
  return from(
    axios.get<T>(url)
  )
}

export { fetch }
