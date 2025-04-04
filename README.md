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

## 📚 API Documentation

### Authentication

Most admin endpoints require authentication using the admin Ethereum address. Include the admin address in the request headers:

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

### Voter Endpoints

#### Register a Voter

```http
POST /api/voters/register
```

**Request Body:**

```json
{
  "address": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
  "name": "John Doe",
  "gender": "Male",
  "dob": "1990-01-01",
  "city": "Mumbai",
  "state": "Maharashtra",
  "aadharNumber": "123456789012",
  "phoneNumber": "9876543210",
  "email": "johndoe@example.com",
  "aadharImageUrl": "/uploads/example.png"
}
```

**Response (Success - 201):**

```json
{
  "message": "Voter registered successfully",
  "blockchainAddress": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
  "blockchainTxHash": "0xa1b2c3...",
  "onBlockchain": true
}
```

**Response (Error - 400/500):**

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

#### Verify a Voter (Admin Only)

```http
POST /api/voters/verify
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Request Body:**

```json
{
  "adminAddress": "0x6E5ceE75158A189939F6d945351dBD86370672AD",
  "voterAddress": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
  "verificationNotes": "Verified manually after document check"
}
```

**Response (Success - 200):**

```json
{
  "message": "Voter verified successfully",
  "verificationDate": "2023-04-05T10:30:45.123Z"
}
```

#### Check Voter Status

```http
GET /api/voters/status/:address
```

**Parameters:**

- `:address` - Ethereum address of the voter

**Response (Success - 200):**

```json
{
  "isVerified": true,
  "registrationDate": "2023-04-01T15:30:45.123Z",
  "verificationDate": "2023-04-05T10:30:45.123Z"
}
```

#### Get Voter Details

```http
GET /api/voters/:address
```

**Parameters:**

- `:address` - Ethereum address of the voter

**Response (Success - 200):**

```json
{
  "voter": {
    "blockchainAddress": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
    "rawData": {
      "name": "John Doe",
      "aadharNumber": "123456789012"
    },
    "district": "Mumbai, Maharashtra",
    "gender": "Male",
    "dob": "1990-01-01T00:00:00.000Z",
    "aadharImage": "/uploads/example.png",
    "isVerified": true,
    "verificationDate": "2023-04-05T10:30:45.123Z",
    "createdAt": "2023-04-01T15:30:45.123Z",
    "updatedAt": "2023-04-05T10:30:45.123Z"
  }
}
```

### Admin Endpoints

#### List All Voters (Admin Only)

```http
GET /api/admin/voters
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Query Parameters:**

- `verified` (optional): Filter by verification status (true/false)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of records per page (default: 10)
- `search` (optional): Search by name, address, or aadhar number
- `state` (optional): Filter by state

**Response (Success - 200):**

```json
{
  "voters": [
    {
      "blockchainAddress": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
      "rawData": {
        "name": "John Doe",
        "aadharNumber": "123456******"
      },
      "district": "Mumbai, Maharashtra",
      "gender": "Male",
      "isVerified": true
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "pages": 5
  }
}
```

#### Admin Dashboard Stats (Admin Only)

```http
GET /api/admin/stats
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Response (Success - 200):**

```json
{
  "totalVoters": 45,
  "verifiedVoters": 32,
  "pendingVerification": 13,
  "verificationRate": "71.11",
  "todayRegistrations": 3,
  "todayVerifications": 2,
  "genderDistribution": {
    "male": 24,
    "female": 20,
    "other": 1
  },
  "registrationTrends": [
    { "_id": "2023-04-01", "count": 5 },
    { "_id": "2023-04-02", "count": 8 }
  ],
  "verificationTrends": [
    { "_id": "2023-04-02", "count": 3 },
    { "_id": "2023-04-03", "count": 6 }
  ],
  "stateDistribution": [
    { "_id": "Maharashtra", "total": 15, "verified": 12, "unverified": 3 },
    { "_id": "Delhi", "total": 10, "verified": 7, "unverified": 3 }
  ],
  "ageDistribution": {
    "below18": 0,
    "age18to25": 12,
    "age26to35": 18,
    "age36to45": 10,
    "age46to60": 4,
    "above60": 1
  }
}
```

#### Admin Activity Logs (Admin Only)

```http
GET /api/admin/logs
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Query Parameters:**

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of records per page (default: 20)
- `adminAddress` (optional): Filter by admin address
- `action` (optional): Filter by action type (e.g., VERIFY_VOTER)
- `status` (optional): Filter by status (SUCCESS, FAILURE)
- `fromDate` (optional): Filter from date (format: YYYY-MM-DD)
- `toDate` (optional): Filter to date (format: YYYY-MM-DD)

**Response (Success - 200):**

```json
{
  "logs": [
    {
      "adminAddress": "0x6E5ceE75158A189939F6d945351dBD86370672AD",
      "action": "VERIFY_VOTER",
      "description": "Admin verified voter 0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
      "targetAddress": "0x851BdD62Fd471a652CCFb4a0aa65E41e33B0508C",
      "transactionHash": "0xa1b2c3...",
      "status": "SUCCESS",
      "timestamp": "2023-04-05T10:30:45.123Z",
      "ipAddress": "192.168.1.1"
    }
  ],
  "pagination": {
    "total": 57,
    "page": 1,
    "pages": 3
  }
}
```

#### State-wise Voter Distribution (Admin Only)

```http
GET /api/admin/stats/states
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Response (Success - 200):**

```json
{
  "stateDistribution": [
    {
      "_id": "Maharashtra",
      "total": 15,
      "verified": 12,
      "unverified": 3
    },
    {
      "_id": "Delhi",
      "total": 10,
      "verified": 7,
      "unverified": 3
    }
  ]
}
```

#### Historical Statistics (Admin Only)

```http
GET /api/admin/stats/historical
```

**Headers:**

```
x-admin-address: 0x6E5ceE75158A189939F6d945351dBD86370672AD
```

**Query Parameters:**

- `days` (optional): Number of days of history (default: 30)

**Response (Success - 200):**

```json
{
  "stats": [
    {
      "date": "2023-04-01T00:00:00.000Z",
      "totalRegisteredVoters": 30,
      "totalVerifiedVoters": 20,
      "dailyRegistrations": 5,
      "dailyVerifications": 3
    },
    {
      "date": "2023-04-02T00:00:00.000Z",
      "totalRegisteredVoters": 38,
      "totalVerifiedVoters": 26,
      "dailyRegistrations": 8,
      "dailyVerifications": 6
    }
  ]
}
```

### Upload Endpoints

#### Upload Aadhar Image

```http
POST /api/upload/aadhar
```

**Form Data:**

- `file`: The image file
- `address`: The blockchain address of the voter

**Response (Success - 200):**

```json
{
  "message": "File uploaded successfully",
  "filePath": "/uploads/23ff9c56c6d9571d050d7d845b6218de.png"
}
```

### Health Check

```http
GET /health
```

**Response (Success - 200):**

```json
{
  "status": "ok",
  "timestamp": "2023-04-05T10:30:45.123Z",
  "services": {
    "blockchain": true,
    "database": true
  }
}
```

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
