const hre = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying VoterID contract...");
    
    // Get the contract factory
    const VoterID = await hre.ethers.getContractFactory("VoterID");
    
    // Deploy the contract
    const voterID = await VoterID.deploy();
    
    // Wait for deployment to finish
    await voterID.waitForDeployment();
    
    // Get the deployed contract address
    const contractAddress = await voterID.getAddress();
    
    console.log(`VoterID contract deployed to: ${contractAddress}`);
    console.log(`Network: ${hre.network.name}`);
    
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
    fs.writeFileSync(
        path.join(deploymentsDir, `${hre.network.name}.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("Deployment info saved to deployments directory");
    console.log("\nNext steps:");
    console.log("1. Add the contract address to your .env file:");
    console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
    console.log("2. Add your account address as the admin:");
    console.log(`   ADMIN_ADDRESS=${deploymentInfo.deployer}`);
    console.log("3. Start the server with: npm run dev");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
