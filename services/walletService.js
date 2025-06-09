const { ethers } = require('ethers');
const crypto = require('crypto');

class WalletAbstractionService {
    constructor() {
        // Initialize provider with error handling
        try {
            this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
            this.masterWallet = new ethers.Wallet(process.env.MASTER_PRIVATE_KEY, this.provider);
            this.walletSalt = process.env.WALLET_SALT || 'default_salt_12345';
            this.initialFunding = process.env.INITIAL_FUNDING_AMOUNT || '0.01';
        } catch (error) {
            console.error('WalletService initialization error:', error);
            throw new Error('Failed to initialize wallet service');
        }
    }

    generateWalletFromAadhar(aadharNumber) {
        try {
            // Derive a hash from Aadhaar + salt using a cryptographic function
            const hash = crypto
                .createHash("sha256")
                .update(aadharNumber + this.walletSalt)
                .digest("hex");

            // Use first 64 characters as the private key
            const privateKey = `0x${hash.slice(0, 64)}`;

            console.log(`Generating wallet for Aadhar: ${aadharNumber}`);
            console.log(`Private key length: ${privateKey.length}`);

            // Generate the wallet
            const wallet = new ethers.Wallet(privateKey, this.provider);

            console.log(`Generated wallet address: ${wallet.address}`);

            return {
                address: wallet.address,
                privateKey: wallet.privateKey
            };
        } catch (error) {
            console.error('Wallet generation error:', error);
            throw new Error(`Failed to generate wallet: ${error.message}`);
        }
    }

    encryptPrivateKey(privateKey, aadharNumber) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(process.env.ENCRYPTION_KEY + aadharNumber, 'salt', 32);
            const iv = crypto.randomBytes(16);

            const cipher = crypto.createCipher(algorithm, key);
            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            return {
                encrypted,
                iv: iv.toString('hex')
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt private key');
        }
    }

    decryptPrivateKey(encryptedData, aadharNumber) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(process.env.ENCRYPTION_KEY + aadharNumber, 'salt', 32);

            const decipher = crypto.createDecipher(algorithm, key);
            let decrypted = decipher.update(encryptedData.encrypted || encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt private key');
        }
    }

    async fundWallet(address, amount = null) {
        try {
            const fundingAmount = amount || this.initialFunding;

            // Check master wallet balance first
            const masterBalance = await this.provider.getBalance(this.masterWallet.address);
            const fundingAmountWei = ethers.parseEther(fundingAmount);

            console.log(`Master wallet balance: ${ethers.formatEther(masterBalance)} ETH`);
            console.log(`Trying to fund with: ${fundingAmount} ETH`);

            if (masterBalance < fundingAmountWei) {
                console.warn('Insufficient funds in master wallet, skipping funding...');
                return null; // Don't fail registration due to funding issues
            }

            // Send funding transaction
            const tx = await this.masterWallet.sendTransaction({
                to: address,
                value: fundingAmountWei,
                gasLimit: 21000
            });

            console.log(`Funding transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`Funding confirmed in block: ${receipt.blockNumber}`);

            return tx.hash;
        } catch (error) {
            console.error('Wallet funding error:', error);
            // Don't throw error, just log and continue
            return null;
        }
    }

    async getWalletBalance(address) {
        try {
            const balance = await this.provider.getBalance(address);
            return {
                wei: balance.toString(),
                eth: ethers.formatEther(balance)
            };
        } catch (error) {
            console.error('Balance check error:', error);
            throw new Error('Failed to check balance');
        }
    }

    // Helper method to get wallet instance from Aadhar for transactions
    getWalletFromAadhar(aadharNumber) {
        const walletData = this.generateWalletFromAadhar(aadharNumber);
        return new ethers.Wallet(walletData.privateKey, this.provider);
    }
}

module.exports = WalletAbstractionService;