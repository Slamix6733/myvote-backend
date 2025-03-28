# Voter Identification Portal - Backend

A blockchain-based voter identification system that securely registers and verifies voters using Ethereum smart contracts.

## 🚀 Quick Start Guide for Beginners

### Prerequisites

You'll need to install these tools before you begin:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/get-npm) (comes with Node.js)
- [Git](https://git-scm.com/downloads) (optional, for cloning the repository)

### Step 1: Clone or Download the Project

```bash
git clone <repository-url>
cd myvote-backend
```

Or download and extract the ZIP file if you don't have Git.

### Step 2: Install Dependencies

Open a terminal/command prompt in the project folder and run:

```bash
npm install
```

This will install all the required packages.

### Step 3: Set Up Ganache (Local Blockchain)

1. Install Ganache globally:

   ```bash
   npm install -g ganache
   ```

2. Start Ganache:

   ```bash
   ganache
   ```

3. You'll see a list of accounts and private keys. Copy the address and private key of the first account (this will be your admin account).

### Step 4: Create Environment Variables

1. Create a file named `.env` in the root directory of the project
2. Add the following content:

```
PORT=5000
PRIVATE_KEY=paste_your_ganache_private_key_here
ADMIN_ADDRESS=paste_your_ganache_address_here
```

Replace the placeholders with:

- `paste_your_ganache_private_key_here`: The private key from Ganache (starts with 0x)
- `paste_your_ganache_address_here`: The address from Ganache (starts with 0x)

### Step 5: Deploy the Smart Contract

1. Compile the smart contract:

   ```bash
   npx hardhat compile
   ```

2. Deploy the smart contract to your local Ganache blockchain:

   ```bash
   npx hardhat run scripts/deploy.js --network ganache
   ```

3. You'll see a message with the contract address. Copy this address.

4. Add the contract address to your `.env` file:
   ```
   CONTRACT_ADDRESS=paste_your_contract_address_here
   ```

### Step 6: Start the Backend Server

```bash
npm run dev
```

You should see a message indicating that the server is running on http://localhost:5000.

## 🧪 Testing the API

You can use Postman, curl, or any API testing tool to test the endpoints.

### Register a Voter

```
POST http://localhost:5000/api/blockchain/register

Body (JSON):
{
  "address": "0x...", (an Ethereum address, can be another from Ganache)
  "name": "John Doe",
  "dob": "1990-01-01",
  "voterIdHash": "uniqueID123",
  "aadharNumber": "123456789012",
  "residentialAddress": "123 Main St, City, State"
}
```

### Verify a Voter (Admin Only)

```
POST http://localhost:5000/api/blockchain/verify

Body (JSON):
{
  "adminAddress": "your_admin_address_from_env",
  "voterAddress": "address_of_voter_to_verify"
}
```

### Check Voter Status

```
GET http://localhost:5000/api/blockchain/status/0x...
```

Replace `0x...` with the voter's Ethereum address.

### Get Voter Details

```
GET http://localhost:5000/api/blockchain/details/0x...
```

Replace `0x...` with the voter's Ethereum address.

## 🔍 Understanding the System

- **Smart Contract**: The backbone of the system, securely stores voter data on the blockchain
- **Admin**: The address that deployed the contract, has special permissions to verify voters
- **Verification**: Voters register with their details but start with `isVerified: false`. The admin must verify them.

## ❓ Troubleshooting

### "Cannot find module" errors

Make sure you've run `npm install` and all dependencies are installed.

### "Insufficient funds" errors

Make sure you're using the correct private key from Ganache and that account has ETH.

### "Contract not deployed" errors

Ensure you've completed the deployment step and added the correct contract address to your `.env` file.

### Connection errors

Make sure Ganache is running when you deploy or interact with the contract.

## 📱 Connecting to MetaMask (Optional)

To use MetaMask with your local Ganache blockchain:

1. Install the [MetaMask browser extension](https://metamask.io/download.html)
2. Open MetaMask, create or import an account
3. Add a new network with these settings:
   - Network Name: Ganache
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ETH
4. Import a Ganache account by going to "Import Account" and pasting one of the private keys from Ganache

## 🔄 Switching to a Public Testnet (Optional)

When you're ready to move beyond local testing, you can deploy to Sepolia testnet:

1. Get a Sepolia RPC URL from [Alchemy](https://www.alchemy.com/) or [Infura](https://infura.io/)
2. Update your `.env` file:
   ```
   SEPOLIA_RPC_URL=your_sepolia_rpc_url
   ```
3. Get some test ETH from a [Sepolia faucet](https://sepoliafaucet.com/)
4. Deploy to Sepolia:
   ```
   npx hardhat run scripts/deploy.js --network sepolia
   ```
5. Update your CONTRACT_ADDRESS in the `.env` file with the new address

## 📄 License

[MIT License](LICENSE)
