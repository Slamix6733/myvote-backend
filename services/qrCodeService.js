const QRCode = require('qrcode');
const { storage } = require('../config/firebase');
const { ref, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');

class QRCodeService {
    /**
     * Generate QR code for verified voter with expiration
     */
    async generateQRCodeForVoter(voterData, expirationMinutes = 30) {
        try {
            // Access hashes from the blockchain object
            const nameHash = voterData.blockchain?.nameHash || voterData.nameHash;
            const aadharHash = voterData.blockchain?.aadharHash || voterData.aadharHash;
            const txHash = voterData.blockchain?.txHash || voterData.txHash;

            console.log('Voter data structure:', {
                hasBlockchain: !!voterData.blockchain,
                nameHash,
                aadharHash,
                txHash
            });

            // Validate that we have the required hashes
            if (!nameHash || !aadharHash) {
                console.error('Missing hashes. Voter data:', JSON.stringify(voterData, null, 2));
                throw new Error('Missing nameHash or aadharHash in voter data');
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + (expirationMinutes * 60 * 1000));

            // Create QR code data object with expiration
            const qrData = {
                nameHash: nameHash,
                aadharHash: aadharHash,
                txHash: txHash || 'manual_verification',
                voterAddress: voterData.blockchainAddress || voterData.voterAddress,
                verificationDate: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                systemId: 'MYVOTE_SYSTEM_V1'
            };

            console.log('Generated QR data:', qrData);

            // Generate QR code as buffer
            const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
                type: 'png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 512
            });

            // Create file path using aadhar hash structure
            const cleanAadharHash = aadharHash.slice(2);
            const fileName = `${cleanAadharHash}/qr-code.png`;
            const storageRef = ref(storage, fileName);

            const metadata = {
                contentType: 'image/png',
                customMetadata: {
                    'voterAddress': voterData.blockchainAddress || voterData.voterAddress,
                    'aadharHash': aadharHash,
                    'nameHash': nameHash,
                    'generatedAt': new Date().toISOString(),
                    'purpose': 'voter-verification',
                    'systemId': 'MYVOTE_SYSTEM_V1'
                }
            };

            // Upload file to Firebase
            const snapshot = await uploadBytes(storageRef, qrCodeBuffer, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return {
                success: true,
                qrCodeData: qrData,
                firebaseUrl: downloadURL,
                fileName: fileName,
                aadharHash: aadharHash,
                size: qrCodeBuffer.length,
                expiresAt: expiresAt
            };

        } catch (error) {
            console.error('QR Code generation error:', error);
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    /**
     * Get QR code by Aadhar hash
     */
    async getQRCodeByAadharHash(aadharHash) {
        try {
            const cleanAadharHash = aadharHash.startsWith('0x') ? aadharHash.slice(2) : aadharHash;
            const fileName = `${cleanAadharHash}/qr-code.png`;
            const storageRef = ref(storage, fileName);

            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;

        } catch (error) {
            if (error.code === 'storage/object-not-found') {
                throw new Error('QR code not found for this Aadhar hash');
            }
            throw new Error(`Failed to retrieve QR code: ${error.message}`);
        }
    }

    /**
     * Check if QR code exists
     */
    async qrCodeExists(aadharHash) {
        try {
            await this.getQRCodeByAadharHash(aadharHash);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Delete QR code by Aadhar hash
     */
    async deleteQRCodeByAadharHash(aadharHash) {
        try {
            const cleanAadharHash = aadharHash.startsWith('0x') ? aadharHash.slice(2) : aadharHash;
            const fileName = `${cleanAadharHash}/qr-code.png`;
            const storageRef = ref(storage, fileName);

            await deleteObject(storageRef);
            return true;

        } catch (error) {
            console.error('QR Code deletion error:', error);
            throw new Error(`Failed to delete QR code: ${error.message}`);
        }
    }

    /**
     * Verify QR code data with expiration check
     */
    verifyQRCode(qrDataString) {
        try {
            const qrData = JSON.parse(qrDataString);

            const requiredFields = ['nameHash', 'aadharHash', 'txHash', 'voterAddress', 'systemId', 'expiresAt'];
            const missingFields = requiredFields.filter(field => !qrData[field]);

            if (missingFields.length > 0) {
                return {
                    valid: false,
                    error: `Missing required fields: ${missingFields.join(', ')}`
                };
            }

            if (qrData.systemId !== 'MYVOTE_SYSTEM_V1') {
                return {
                    valid: false,
                    error: 'Invalid system ID'
                };
            }

            // Check if QR code has expired
            const now = new Date();
            const expiresAt = new Date(qrData.expiresAt);

            if (now > expiresAt) {
                return {
                    valid: false,
                    error: 'QR code has expired'
                };
            }

            return {
                valid: true,
                data: qrData
            };

        } catch (error) {
            return {
                valid: false,
                error: 'Invalid QR code format'
            };
        }
    }

    /**
     * Process voting via QR scan
     */
    async processVoting(qrDataString) {
        try {
            // First verify the QR code
            const verification = this.verifyQRCode(qrDataString);

            if (!verification.valid) {
                return {
                    success: false,
                    error: verification.error
                };
            }

            const qrData = verification.data;
            const Voter = require('../models/Voter');

            // Find voter by blockchain address
            const voter = await Voter.findOne({
                blockchainAddress: qrData.voterAddress,
                isVerified: true
            });

            if (!voter) {
                return {
                    success: false,
                    error: 'Voter not found or not verified'
                };
            }

            if (voter.isVoted) {
                return {
                    success: false,
                    error: 'Voter has already voted'
                };
            }

            // Check if QR code is still active
            if (!voter.qrCode?.isActive) {
                return {
                    success: false,
                    error: 'QR code is no longer active'
                };
            }

            // Update voter as voted
            voter.isVoted = true;
            voter.votingDate = new Date();
            voter.qrCode.isActive = false; // Deactivate QR code after use

            await voter.save();

            return {
                success: true,
                message: 'Vote recorded successfully',
                voterAddress: voter.blockchainAddress,
                votingDate: voter.votingDate
            };

        } catch (error) {
            console.error('Voting process error:', error);
            return {
                success: false,
                error: `Failed to process vote: ${error.message}`
            };
        }
    }
}

module.exports = new QRCodeService();