const express = require('express');
const router = express.Router();
const qrCodeService = require('../services/qrCodeService');
const { generateVotingQR, processVoteViaScan } = require('../controllers/voterController');

// Middleware to check admin access
const isAdmin = async (req, res, next) => {
    try {
        const adminAddress = process.env.ADMIN_ADDRESS;
        if (!adminAddress) {
            return res.status(500).json({ error: "Admin address not configured" });
        }

        const providedAdmin = req.headers['x-admin-address'] || req.query.adminAddress || req.body.adminAddress;

        if (providedAdmin && providedAdmin.toLowerCase() === adminAddress.toLowerCase()) {
            next();
        } else {
            return res.status(403).json({ error: "Unauthorized access" });
        }
    } catch (error) {
        console.error("Admin check error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Generate QR code for verified voter (Admin only)
 */
router.post('/generate/:voterAddress', isAdmin, async (req, res) => {
    try {
        const { voterAddress } = req.params;

        console.log(`Generating QR code for voter: ${voterAddress}`);

        // Fetch complete voter data from database
        const voter = await Voter.findOne({ blockchainAddress: voterAddress });

        if (!voter) {
            return res.status(404).json({
                success: false,
                error: 'Voter not found'
            });
        }

        console.log('Found voter with blockchain data:', {
            name: voter.name,
            aadharNumber: voter.aadharNumber,
            isVerified: voter.isVerified,
            hasBlockchain: !!voter.blockchain,
            nameHash: voter.blockchain?.nameHash,
            aadharHash: voter.blockchain?.aadharHash
        });

        // Check if voter is verified
        if (!voter.isVerified) {
            return res.status(400).json({
                success: false,
                error: 'Voter must be verified before generating QR code'
            });
        }

        // Check if blockchain hashes exist
        if (!voter.blockchain?.nameHash || !voter.blockchain?.aadharHash) {
            return res.status(400).json({
                success: false,
                error: 'Voter blockchain data incomplete. Hashes not found.'
            });
        }

        // Prepare voter data for QR generation using existing hashes
        const voterDataForQR = {
            name: voter.name,
            aadharNumber: voter.aadharNumber,
            nameHash: voter.blockchain.nameHash,
            aadharHash: voter.blockchain.aadharHash,
            txHash: voter.blockchain.txHash || 'manual_verification',
            voterAddress: voter.blockchainAddress,
            blockchainAddress: voter.blockchainAddress,
            blockchain: {
                nameHash: voter.blockchain.nameHash,
                aadharHash: voter.blockchain.aadharHash,
                txHash: voter.blockchain.txHash
            }
        };

        console.log('Using existing hashes for QR:', {
            nameHash: voterDataForQR.nameHash,
            aadharHash: voterDataForQR.aadharHash
        });

        // Generate QR code
        const qrResult = await qrCodeService.generateQRCodeForVoter(voterDataForQR);

        res.json({
            success: true,
            message: 'QR code generated successfully',
            data: {
                voterAddress: voter.blockchainAddress,
                aadharHash: qrResult.aadharHash,
                qrCodeUrl: qrResult.firebaseUrl,
                fileName: qrResult.fileName,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate QR code',
            details: error.message
        });
    }
});

/**
 * Get QR code by Aadhar hash
 */
router.get('/aadhar/:aadharHash', async (req, res) => {
    try {
        const { aadharHash } = req.params;

        if (!aadharHash || (aadharHash.length !== 64 && aadharHash.length !== 66)) {
            return res.status(400).json({ error: 'Invalid Aadhar hash format' });
        }

        const qrCodeUrl = await qrCodeService.getQRCodeByAadharHash(aadharHash);

        const voter = await Voter.findOne({
            'qrCode.aadharHash': aadharHash.startsWith('0x') ? aadharHash : `0x${aadharHash}`
        });

        res.status(200).json({
            qrCodeUrl: qrCodeUrl,
            aadharHash: aadharHash.startsWith('0x') ? aadharHash : `0x${aadharHash}`,
            filePath: `${aadharHash.startsWith('0x') ? aadharHash.slice(2) : aadharHash}/qr-code.png`,
            generatedAt: voter?.qrCode?.generatedAt || null,
            voterName: voter?.rawData?.name || null
        });

    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: 'QR code not found for this Aadhar hash' });
        }
        res.status(500).json({
            error: 'Failed to retrieve QR code',
            details: error.message
        });
    }
});

/**
 * Get voter's QR code by voter address
 */
router.get('/voter/:voterAddress', async (req, res) => {
    try {
        const { voterAddress } = req.params;

        const voter = await Voter.findOne({ blockchainAddress: voterAddress });
        if (!voter) {
            return res.status(404).json({ error: 'Voter not found' });
        }

        if (!voter.qrCode || !voter.qrCode.aadharHash) {
            return res.status(404).json({ error: 'QR code not generated for this voter' });
        }

        const qrCodeUrl = await qrCodeService.getQRCodeByAadharHash(voter.qrCode.aadharHash);

        res.status(200).json({
            qrCodeUrl: qrCodeUrl,
            aadharHash: voter.qrCode.aadharHash,
            filePath: `${voter.qrCode.aadharHash.slice(2)}/qr-code.png`,
            generatedAt: voter.qrCode.generatedAt,
            nameHash: voter.qrCode.nameHash,
            txHash: voter.qrCode.txHash
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve QR code',
            details: error.message
        });
    }
});

/**
 * Verify QR code data
 */
router.post('/verify', async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({ error: 'QR data is required' });
        }

        const verification = qrCodeService.verifyQRCode(qrData);

        if (!verification.valid) {
            return res.status(400).json({
                error: 'Invalid QR code',
                details: verification.error
            });
        }

        const voter = await Voter.findOne({
            blockchainAddress: verification.data.voterAddress
        });

        if (!voter) {
            return res.status(404).json({ error: 'Voter not found' });
        }

        if (!voter.isVerified) {
            return res.status(400).json({ error: 'Voter is not verified' });
        }

        const qrExists = await qrCodeService.qrCodeExists(verification.data.aadharHash);
        if (!qrExists) {
            return res.status(404).json({ error: 'QR code not found in storage' });
        }

        res.status(200).json({
            valid: true,
            voterName: voter.rawData?.name,
            voterAddress: verification.data.voterAddress,
            aadharHash: verification.data.aadharHash,
            verificationDate: voter.verificationDate,
            qrGeneratedAt: voter.qrCode?.generatedAt,
            filePath: `${verification.data.aadharHash.slice(2)}/qr-code.png`
        });

    } catch (error) {
        res.status(500).json({
            error: 'Verification failed',
            details: error.message
        });
    }
});

/**
 * List all QR codes (Admin only)
 */
router.get('/list', isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const voters = await Voter.find({
            'qrCode.aadharHash': { $exists: true }
        })
            .select('blockchainAddress rawData.name qrCode.aadharHash qrCode.generatedAt qrCode.firebaseUrl')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ 'qrCode.generatedAt': -1 });

        const total = await Voter.countDocuments({
            'qrCode.aadharHash': { $exists: true }
        });

        const qrCodes = voters.map(voter => ({
            voterAddress: voter.blockchainAddress,
            voterName: voter.rawData?.name,
            aadharHash: voter.qrCode.aadharHash,
            filePath: `${voter.qrCode.aadharHash.slice(2)}/qr-code.png`,
            qrCodeUrl: voter.qrCode.firebaseUrl,
            generatedAt: voter.qrCode.generatedAt
        }));

        res.status(200).json({
            qrCodes,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to list QR codes',
            details: error.message
        });
    }
});

/**
 * Delete QR code (Admin only)
 */
router.delete('/aadhar/:aadharHash', isAdmin, async (req, res) => {
    try {
        const { aadharHash } = req.params;

        await qrCodeService.deleteQRCodeByAadharHash(aadharHash);

        const voter = await Voter.findOne({
            'qrCode.aadharHash': aadharHash.startsWith('0x') ? aadharHash : `0x${aadharHash}`
        });

        if (voter) {
            voter.qrCode = undefined;
            await voter.save();
        }

        res.status(200).json({
            message: 'QR code deleted successfully',
            aadharHash: aadharHash
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete QR code',
            details: error.message
        });
    }
});

/**
 * Generate voting QR code
 */
router.post('/generate-qr/:aadharNumber', isAdmin, generateVotingQR);

/**
 * Process vote via QR scan
 */
router.post('/scan-vote', processVoteViaScan);

/**
 * Verify QR code without processing vote
 */
router.post('/verify-qr', async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({ error: "QR data is required" });
        }

        const verification = qrCodeService.verifyQRCode(qrData);

        res.json(verification);

    } catch (error) {
        console.error("QR verification error:", error);
        res.status(500).json({ error: "Failed to verify QR code" });
    }
});

module.exports = router;