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
const registerVoter = async (nameHash, aadharHash, voterAddress = null) => {
  try {
    console.log("Input hashes raw:", { 
      nameHash, 
      aadharHash,
      nameHashType: typeof nameHash,
      aadharHashType: typeof aadharHash,
      voterAddress
    });
    
    // Ensure the hashes are strings with 0x prefix
    if (!nameHash || typeof nameHash !== 'string') {
      throw new Error(`Invalid nameHash: ${nameHash}`);
    }
    
    if (!aadharHash || typeof aadharHash !== 'string') {
      throw new Error(`Invalid aadharHash: ${aadharHash}`);
    }
    
    // Ensure 0x prefix
    if (!nameHash.startsWith('0x')) {
      nameHash = '0x' + nameHash;
    }
    
    if (!aadharHash.startsWith('0x')) {
      aadharHash = '0x' + aadharHash;
    }
    
    // Validate hash format - must be 0x-prefixed 32-byte hex strings (66 chars total)
    if (nameHash.length !== 66 || !nameHash.startsWith('0x')) {
      throw new Error(`Invalid nameHash format: ${nameHash}`);
    }
    
    if (aadharHash.length !== 66 || !aadharHash.startsWith('0x')) {
      throw new Error(`Invalid aadharHash format: ${aadharHash}`);
    }
    
    const contractWithSigner = getContractWithSigner();
    
    console.log("Contract address being used:", process.env.CONTRACT_ADDRESS);
    const sender = await getSigner().getAddress();
    console.log("Sender address (admin):", sender);
    
    // Verify the contract code exists
    const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
    if (code === '0x') {
      throw new Error("No contract code at the specified address!");
    }
    
    let tx;
    
    // If voter address is provided and different from sender, use registerVoterByAdmin
    if (voterAddress && voterAddress.toLowerCase() !== sender.toLowerCase()) {
      console.log("Registering voter by admin for address:", voterAddress);
      
      // Use the admin function that registers for a specific address
      tx = await contractWithSigner.registerVoterByAdmin(
        voterAddress,  // address _voterAddress
        nameHash,      // bytes32 _nameHash
        aadharHash,    // bytes32 _aadharHash
        {
          gasLimit: 500000
        }
      );
    } else {
      // Use the standard registration function (self-registration)
      console.log("Using standard registration (self-registration)");
      tx = await contractWithSigner.registerVoter(
        nameHash,  // bytes32 _nameHash
        aadharHash, // bytes32 _aadharHash
        {
          gasLimit: 500000
        }
      );
    }
    
    console.log("Transaction sent:", tx.hash);
    try {
      const receipt = await tx.wait();
      console.log("Transaction receipt:", {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status
      });
      return receipt;
    } catch (waitError) {
      console.error("Error waiting for transaction:", waitError);
      
      // If the receipt is available in the error, return that
      if (waitError.receipt) {
        console.log("Transaction receipt from error:", waitError.receipt);
        return waitError.receipt;
      }
      
      // Otherwise, return basic transaction info
      return {
        hash: tx.hash,
        success: false,
        error: waitError.message
      };
    }
  } catch (error) {
    console.error("Error registering voter:", error);
    
    // More detailed error handling
    if (error.code === 'CALL_EXCEPTION') {
      console.error("Contract call exception. Details:", error.transaction);
      console.error("Receipt:", error.receipt);
      
      // The transaction was mined but reverted
      if (error.receipt && error.receipt.status === 0) {
        console.error("Transaction reverted by the contract. This might be because:");
        console.error("1. You're already registered");
        console.error("2. Registration is closed");
        console.error("3. The Aadhar hash is already used");
        console.error("4. One of the hashes is empty (all zeros)");
      }
    }
    
    throw error;
  }
};

const verifyVoter = async (voterAddress) => {
  try {
    console.log("Verifying voter on blockchain:", voterAddress);
    
    // Ensure address is valid
    if (!voterAddress || typeof voterAddress !== 'string' || !voterAddress.startsWith('0x')) {
      throw new Error(`Invalid voter address: ${voterAddress}`);
    }
    
    const contractWithSigner = getContractWithSigner();
    const tx = await contractWithSigner.verifyVoter(voterAddress, {
      gasLimit: 300000
    });
    
    console.log("Verification transaction sent:", tx.hash);
    try {
      const receipt = await tx.wait();
      console.log("Verification receipt:", {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status
      });
      return receipt;
    } catch (waitError) {
      console.error("Error waiting for verification:", waitError);
      
      // If the receipt is available in the error, return that
      if (waitError.receipt) {
        return waitError.receipt;
      }
      
      // Otherwise, return basic transaction info
      return {
        hash: tx.hash,
        success: false,
        error: waitError.message
      };
    }
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
      nameHash: details[0],
      aadharHash: details[1],
      isVerified: details[2],
      registrationTimestamp: Number(details[3]),
      lastVerifiedTimestamp: Number(details[4])
    };
  } catch (error) {
    console.error("Error getting voter details:", error);
    throw error;
  }
};

const setRegistrationStatus = async (isOpen) => {
  try {
    const contractWithSigner = getContractWithSigner();
    const tx = await contractWithSigner.setRegistrationStatus(isOpen, {
      gasLimit: 200000
    });
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