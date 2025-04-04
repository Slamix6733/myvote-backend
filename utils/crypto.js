const crypto = require('crypto');
const { ethers } = require('ethers');
require('dotenv').config();

// For hashing sensitive data to store on blockchain
const createHash = (data) => {
  try {
    // Ensure data is a string by converting if necessary
    if (data === null || data === undefined) {
      throw new Error("Cannot hash null or undefined data");
    }
    
    if (typeof data !== 'string') {
      data = String(data);
    }
    
    console.log("Original data to hash:", data);
    
    // IMPORTANT: ethers v6 needs explicit conversion to bytes
    // Create a fixed-length bytes32 hash using keccak256
    
    // Convert string to bytes
    const dataBytes = ethers.toUtf8Bytes(data);
    
    // Apply keccak256 hashing algorithm
    const hash = ethers.keccak256(dataBytes);
    console.log("Generated hash:", hash);
    
    // Check if hash has correct length (0x + 64 hex chars = 66 total)
    if (!hash.startsWith('0x') || hash.length !== 66) {
      throw new Error(`Invalid hash format: ${hash}`);
    }
    
    return hash;
  } catch (error) {
    console.error("Error creating hash:", error);
    throw error;
  }
};

// Encrypt data before storing in MongoDB
const encrypt = (data) => {
  try {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    
    console.log("Encrypting data of length:", data.length);
    
    // Get the encryption key from environment
    let key = process.env.ENCRYPTION_KEY || '';
    
    // Ensure key is the correct length for AES-256 (32 bytes)
    // If it's too short, pad it; if it's too long, truncate it
    key = key.padEnd(32, '0').substring(0, 32);
    
    // Create an initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(key), 
      iv
    );
    
    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return iv and encrypted data
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted
    };
  } catch (error) {
    console.error("Encryption error:", error);
    // Use a simple fallback for now
    return {
      iv: "fallback",
      encryptedData: Buffer.from(data).toString('base64')
    };
  }
};

// Decrypt data from MongoDB
const decrypt = (encryptedObj) => {
  try {
    const { iv, encryptedData } = encryptedObj;
    
    // If using fallback encryption
    if (iv === "fallback") {
      const result = Buffer.from(encryptedData, 'base64').toString('utf8');
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    
    // Get the encryption key from environment
    let key = process.env.ENCRYPTION_KEY || '';
    
    // Ensure key is the correct length for AES-256 (32 bytes)
    key = key.padEnd(32, '0').substring(0, 32);
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(key), 
      Buffer.from(iv, 'hex')
    );
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Try to parse as JSON if it's a JSON string
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      // Return as is if not JSON
      return decrypted;
    }
  } catch (error) {
    console.error("Decryption error:", error);
    return {}; // Return empty object on error
  }
};

// Encrypt all sensitive fields in an object
const encryptSensitiveData = (userData) => {
  // Create the data object to encrypt - only include fields that exist
  const dataToEncrypt = {};
  
  // List of all possible fields that might be encrypted
  const sensitiveFields = [
    'name', 'gender', 'dob', 'city', 'state', 'aadharNumber', 
    'phoneNumber', 'email'
  ];
  
  // Only include fields that exist in userData
  for (const field of sensitiveFields) {
    if (userData[field]) {
      dataToEncrypt[field] = userData[field];
    }
  }
  
  // Encrypt the whole object at once for better security
  const encrypted = encrypt(JSON.stringify(dataToEncrypt));
  
  return {
    data: encrypted.encryptedData,
    iv: encrypted.iv
  };
};

// Decrypt all sensitive fields in an object
const decryptSensitiveData = (encryptedData) => {
  try {
    // Check if using the new format
    if (encryptedData.data && encryptedData.iv) {
      const encryptedObj = {
        iv: encryptedData.iv,
        encryptedData: encryptedData.data
      };
      
      return decrypt(encryptedObj);
    }
    
    // Legacy format (field-by-field encryption)
    const decryptedData = {};
    
    // List of fields to decrypt
    const fields = ['name', 'gender', 'dob', 'city', 'state', 'aadharNumber', 'phoneNumber', 'email'];
    
    for (const field of fields) {
      if (encryptedData[field] && encryptedData[`${field}Iv`]) {
        const encryptedObj = {
          iv: encryptedData[`${field}Iv`],
          encryptedData: encryptedData[field]
        };
        
        decryptedData[field] = decrypt(encryptedObj);
      }
    }
    
    return decryptedData;
  } catch (error) {
    console.error("Error decrypting data:", error);
    return {}; // Return empty object on error
  }
};

// Create the hashes for blockchain storage
const createBlockchainHashes = (userData) => {
  console.log("Creating blockchain hashes for userData:", userData);
  
  // Check if the required fields exist
  if (!userData || !userData.name) {
    throw new Error("name is not defined");
  }
  
  if (!userData || !userData.aadharNumber) {
    throw new Error("aadharNumber is not defined");
  }
  
  const { name, aadharNumber } = userData;
  console.log("Extracted values:", { name, aadharNumber });
  
  // Create the hashes
  const nameHash = createHash(name);
  const aadharHash = createHash(aadharNumber);
  
  return {
    nameHash,
    aadharHash
  };
};

module.exports = {
  createHash,
  encrypt,
  decrypt,
  encryptSensitiveData,
  decryptSensitiveData,
  createBlockchainHashes
}; 