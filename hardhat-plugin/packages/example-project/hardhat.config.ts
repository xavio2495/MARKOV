import { HardhatUserConfig } from "hardhat/config";
import markov from "markov-plugin";

export default {
  plugins: [markov],
  solidity: "0.8.29",
  // Optional: markov config (defaults provided by plugin)
  // markov: {
  //   chain: "localhost",
  //   author: "Example User",
  // },
} satisfies HardhatUserConfig;
