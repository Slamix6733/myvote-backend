const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();
const path = require("path");

async function main() {
  console.log("Starting the VoterID contract redeployment process...");
  
  console.log("Network:", hre.network.name);
  console.log("Signer:", (await hre.ethers.getSigners())[0].address);
  
  try {
    // Get the contract factory
    const VoterID = await hre.ethers.getContractFactory("VoterID");
    console.log("Contract factory created successfully");
    
    // Deploy the contract
    console.log("Deploying contract...");
    const voterID = await VoterID.deploy();
    console.log("Contract deployment transaction sent");
    
    // Wait for deployment to finish
    console.log("Waiting for deployment to be mined...");
    await voterID.waitForDeployment();
    
    // Get the deployed contract address
    const contractAddress = await voterID.getAddress();
    
    console.log(`VoterID contract deployed successfully!`);
    console.log(`Contract Address: ${contractAddress}`);
    
    // Save deployment info
    const deploymentInfo = {
      network: hre.network.name,
      contractAddress: contractAddress,
      deploymentTime: new Date().toISOString(),
      deployer: (await hre.ethers.getSigners())[0].address
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }
    
    // Write deployment info to a file
    const filePath = path.join(deploymentsDir, `${hre.network.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Deployment info saved to: ${filePath}`);
    
    // Update .env file with the new contract address
    const envFilePath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Replace existing CONTRACT_ADDRESS or add if not found
    if (envContent.includes('CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /CONTRACT_ADDRESS=.*/,
        `CONTRACT_ADDRESS=${contractAddress}`
      );
    } else {
      envContent += `\nCONTRACT_ADDRESS=${contractAddress}`;
    }
    
    fs.writeFileSync(envFilePath, envContent);
    console.log(".env file updated with new contract address");
    
    console.log("\nDeployment completed successfully!");
    console.log(`Your new contract address is: ${contractAddress}`);
    console.log("Restart your server to use the new contract.");
    
  } catch (error) {
    console.error("Deployment failed with error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 