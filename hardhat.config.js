require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const getEnv = (key, defaultValue = "") => process.env[key] || defaultValue;

// Only use accounts if private key is properly set
const getAccounts = () => {
  const privateKey = getEnv("PRIVATE_KEY");
  return privateKey.length >= 64 ? [privateKey] : [];
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.PRIVATE_KEY]
    },
    sepolia: {
      url: getEnv("SEPOLIA_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/tCH4tNrSzoTvWI3mDLhDtEe0sGW-_Koe"),
      accounts: getAccounts(),
    },
    mumbai: {
      url: getEnv("MUMBAI_RPC_URL", "https://polygon-mumbai.infura.io/v3/"),
      accounts: getAccounts(),
    }
  },
  etherscan: {
    apiKey: getEnv("ETHERSCAN_API_KEY"),
  },
  paths: {
    artifacts: "./artifacts",
  },
};
