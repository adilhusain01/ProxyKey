import { create } from "zustand"

type ProxyKeyState = {
  account: string
  setAccount: (account: string) => void
  clearAccount: () => void
}

export const useProxyKeyStore = create<ProxyKeyState>((set) => ({
  account: "",
  setAccount: (account) => set({ account }),
  clearAccount: () => set({ account: "" }),
}))
