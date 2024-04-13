import { Balance } from "@proto-kit/library";
import { Balances } from "./balances";
import { SpyManager } from "./spy_manager";
import { ModulesConfig } from "@proto-kit/common";

export const modules = {
  Balances,
  SpyManager,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },

  SpyManager: {},
};

export default {
  modules,
  config,
};
