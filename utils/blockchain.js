const { ethers } = require("ethers");
const voterIDArtifact = require("../artifacts/contracts/voterID.sol/VoterID.json");
require("dotenv").config();

let provider;
let contract;

// Determine provider based on environment
const initProvider = () => {
  if (process.env.NODE_ENV === "production") {
    // For production, use a provider like Infura or Alchemy
    const network = process.env.NETWORK || "sepolia";
    const rpcUrl = network === "sepolia" 
      ? process.env.SEPOLIA_RPC_URL 
      : process.env.MUMBAI_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`RPC URL for ${network} not provided in environment variables`);
    }
    
    provider = new ethers.JsonRpcProvider(rpcUrl);
  } else {
    // For development, use local hardhat node
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  }
  return provider;
};

// Initialize the contract instance
const initContract = () => {
  if (!provider) {
    provider = initProvider();
  }
  
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Contract address not provided in environment variables");
  }
  
  // For read-only operations
  contract = new ethers.Contract(
    contractAddress,
    voterIDArtifact.abi,
    provider
  );
  
  return contract;
};

// Get signer with private key for transactions that modify the blockchain
const getSigner = () => {
  if (!provider) {
    provider = initProvider();
  }
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Private key not provided in environment variables");
  }
  
  return new ethers.Wallet(privateKey, provider);
};

// Get contract instance with signer for write operations
const getContractWithSigner = () => {
  const signer = getSigner();
  return new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    voterIDArtifact.abi,
    signer
  );
};

// Functions for interacting with the smart contract
const registerVoter = async (address, name, dob, voterIdHash, aadharNumber, residentialAddress) => {
  try {
    const contractWithSigner = getContractWithSigner();
    const tx = await contractWithSigner.registerVoter(name, dob, voterIdHash, aadharNumber, residentialAddress);
    return await tx.wait();
  } catch (error) {
    console.error("Error registering voter:", error);
    throw error;
  }
};

const verifyVoter = async (voterAddress) => {
  try {
    const contractWithSigner = getContractWithSigner();
    const tx = await contractWithSigner.verifyVoter(voterAddress);
    return await tx.wait();
  } catch (error) {
    console.error("Error verifying voter:", error);
    throw error;
  }
};

const checkVoterStatus = async (voterAddress) => {
  try {
    if (!contract) {
      contract = initContract();
    }
    return await contract.checkVoterStatus(voterAddress);
  } catch (error) {
    console.error("Error checking voter status:", error);
    throw error;
  }
};

const getVoterDetails = async (voterAddress) => {
  try {
    if (!contract) {
      contract = initContract();
    }
    const details = await contract.getVoterDetails(voterAddress);
    return {
      name: details[0],
      dob: Number(details[1]),
      isVerified: details[2],
      residentialAddress: details[3],
      registrationTimestamp: Number(details[4]),
      lastVerifiedTimestamp: Number(details[5])
    };
  } catch (error) {
    console.error("Error getting voter details:", error);
    throw error;
  }
};

const setRegistrationStatus = async (isOpen) => {
  try {
    const contractWithSigner = getContractWithSigner();
    const tx = await contractWithSigner.setRegistrationStatus(isOpen);
    return await tx.wait();
  } catch (error) {
    console.error("Error setting registration status:", error);
    throw error;
  }
};

module.exports = {
  initProvider,
  initContract,
  getSigner,
  registerVoter,
  verifyVoter,
  checkVoterStatus,
  getVoterDetails,
  setRegistrationStatus
}; 